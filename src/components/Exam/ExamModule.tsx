import React, { useMemo, useState } from 'react';
import type { ExamData, FlatQuestion, OptionKey, ExamRecord } from '../../types';
import { useTimer } from '../../hooks/useTimer';
import { useLang } from '../../i18n/LangContext';

interface Props {
  examData: ExamData;
  addExam: (r: ExamRecord) => void;
  pastExams: ExamRecord[];
}

type Phase = 'select' | 'exam' | 'result';

const EXAM_DURATION = 60 * 60; // 60 min

function buildExamQuestions(band: 'A' | 'B', data: ExamData): FlatQuestion[] {
  const out: FlatQuestion[] = [];
  if (band === 'A') {
    const r = data.bandA.exam1.reading;

    // Part 1 — image choice (select picture matching sentence)
    if (r.part1) {
      r.part1.questions.forEach(q => out.push({
        id: q.id, type: 'image_choice', part: 'part1',
        sentence: q.sentence,
        options: { A: '(A)', B: '(B)', C: '(C)' } as Record<OptionKey, string>,
        answer: q.answer,
        pageImage: `${r.part1!.image_dir}/${q.page_image}`,
      }));
    }

    // Part 2 — picture description (look at picture, pick matching sentence)
    if (r.part2) {
      r.part2.questions.forEach(q => out.push({
        id: q.id, type: 'picture_description', part: 'part2',
        options: q.options,
        answer: q.answer,
        pageImage: `${r.part2!.image_dir}/${q.page_image}`,
      }));
    }

    // Part 3
    r.part3.groups.forEach(g =>
      g.questions.forEach(q => out.push({
        ...q, type: 'gap', part: 'part3', context: g.context,
        pageImage: g.page_image && r.part3.image_dir ? `${r.part3.image_dir}/${g.page_image}` : undefined,
      }))
    );
    // Part 4 — treat each blank as a separate MC question
    r.part4.passages.forEach(p =>
      p.blanks.forEach(b => out.push({
        id: b, type: 'cloze', part: 'part4',
        passage: p.passage,
        question: `Điền vào ô (${b})`,
        options: p.options as Record<OptionKey, string>,
        answer: p.answers[String(b)] as OptionKey,
      }))
    );
    // Part 5
    r.part5.passages.forEach(p =>
      p.questions.forEach(q => out.push({ ...q, type: 'mc', part: 'part5', passage: p.text, passageId: p.id }))
    );
  } else {
    const r = data.bandB.exam1.reading;
    // Part 1
    r.part1.passages.forEach(p =>
      p.questions.forEach(q => out.push({ ...q, type: 'mc', part: 'part1', passage: p.passage_raw, passageId: p.id }))
    );
    // Part 2 — text passages
    r.part2.passages.forEach(p =>
      p.questions.forEach(q => out.push({ ...q, type: 'mc', part: 'part2', passage: p.text, passageId: p.id }))
    );
    // Part 2 — image passages
    if (r.part2.image_passages && r.part2.image_dir) {
      r.part2.image_passages.forEach(ip =>
        ip.questions.forEach(q => out.push({
          id: q.id, type: 'image_material', part: 'part2',
          question: q.text,
          options: q.options,
          answer: q.answer,
          pageImage: `${r.part2.image_dir}/${ip.page_image}`,
          passageId: ip.id,
        }))
      );
    }
  }
  return out.sort((a, b) => a.id - b.id);
}

export const ExamModule: React.FC<Props> = ({ examData, addExam, pastExams }) => {
  const { t } = useLang();
  const [phase, setPhase] = useState<Phase>('select');
  const [band,  setBand]  = useState<'A' | 'B'>('B');
  const [answers, setAnswers] = useState<Record<number, OptionKey>>({});
  const [qIdx,  setQIdx]  = useState(0);

  const questions = useMemo(() => buildExamQuestions(band, examData), [band, examData]);

  const timer = useTimer(EXAM_DURATION, () => finishExam());

  function startExam(b: 'A' | 'B') {
    setBand(b);
    setAnswers({});
    setQIdx(0);
    setPhase('exam');
    timer.reset();
    setTimeout(() => timer.start(), 50);
  }

  function finishExam() {
    timer.stop();
    const score = questions.filter(q => answers[q.id] === q.answer).length;
    addExam({ band, score, total: questions.length, date: new Date().toLocaleDateString('vi-VN') });
    setPhase('result');
  }

  if (phase === 'select') return <SelectPhase onStart={startExam} pastExams={pastExams} examData={examData} />;
  if (phase === 'result') return (
    <ResultPhase
      questions={questions}
      answers={answers}
      onRetry={() => setPhase('select')}
    />
  );

  // ── Exam phase ─────────────────────────────────────────────────────────────
  const base    = import.meta.env.BASE_URL;
  const q       = questions[qIdx];
  const doneCt  = Object.keys(answers).length;
  const prevQ   = qIdx > 0 ? questions[qIdx - 1] : null;
  const showPassage = !!q.passage && q.passage !== prevQ?.passage;

  // Part label map
  const partLabel: Record<string, string> = {
    part1: t('part1_label'),
    part2: t('part2_label'),
    part3: t('part3_label'),
    part4: t('part4_label'),
    part5: t('part5_label'),
  };

  return (
    <div>
      {/* Exam header — sticky on mobile */}
      <div className="card card--compact mb-12" style={{ position: 'sticky', top: 52, zIndex: 90, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: '.9rem' }}>Band {band}</span>
          <span className="text-sm text-muted">{doneCt}/{questions.length}</span>
        </div>
        <span className={`timer ${timer.timeLeft < 300 ? 'warn' : ''}`}>{timer.formatted}</span>
        <button className="btn btn-danger btn-sm" onClick={finishExam}>{t('btn_submit')}</button>
      </div>

      {/* Q-grid */}
      <div className="card card--compact mb-12">
        <div className="q-grid">
          {questions.map((qq, i) => (
            <div
              key={qq.id}
              className={`q-dot${answers[qq.id] ? ' done' : ''}${i === qIdx ? ' current' : ''}`}
              onClick={() => setQIdx(i)}
              title={`${t('question_prefix')} ${qq.id}`}
            >
              {qq.id}
            </div>
          ))}
        </div>
      </div>

      {/* Current question */}
      <div className="card">
        {/* Part label */}
        <div style={{ fontSize: '.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
          {partLabel[q.part] ?? q.part}
        </div>

        {/* Context box (Part 3) */}
        {q.context && (
          <div style={{ background: 'var(--warn-light)', border: '1px solid #fde68a', borderRadius: 'var(--radius)', padding: '8px 12px', marginBottom: 12, fontSize: '.83rem', color: 'var(--warn)' }}>
            {q.context}
          </div>
        )}

        {/* Text passage (Part 4/5) */}
        {showPassage && q.passage && (
          <div className="passage-box">
            <div className="passage-label">{t('passage_label')}</div>
            {q.passage}
          </div>
        )}

        {/* Page image — always shown when present, for every question on that page */}
        {q.pageImage && (
          <div style={{
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            overflow: 'hidden',
            background: '#f8f9fa',
            marginBottom: 14,
          }}>
            <img
              src={`${base}${q.pageImage}`}
              alt={`${t('question_prefix')} ${q.id}`}
              style={{ width: '100%', display: 'block', maxHeight: 560, objectFit: 'contain' }}
            />
          </div>
        )}

        {/* Question text */}
        <div className="question-header">
          <span className="question-num">{t('question_prefix')} {q.id}.</span>
          {q.type === 'image_choice' && q.sentence && (
            <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>{q.sentence}</span>
          )}
          {(q.type === 'picture_description' || q.type === 'image_material') && q.question && (
            <span>{q.question}</span>
          )}
          {(q.type === 'mc' || q.type === 'gap' || q.type === 'cloze') && (
            <span>{q.question ?? q.sentence}</span>
          )}
        </div>

        {/* Options */}
        <div className="option-list">
          {(Object.entries(q.options) as [OptionKey, string][]).map(([key, text]) => (
            <button
              key={key}
              className={`option-btn${answers[q.id] === key ? ' selected' : ''}`}
              onClick={() => setAnswers(a => ({ ...a, [q.id]: key }))}
            >
              <span className="option-key">{key}</span>
              {q.type === 'image_choice'
                ? <span style={{ color: 'var(--text-secondary)', fontSize: '.85rem' }}>{t('pick_image')} {key}</span>
                : <span>{text}</span>
              }
            </button>
          ))}
        </div>

        {/* Prev / Next — full width on mobile for easy thumb tap */}
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button
            className="btn btn-outline"
            style={{ flex: 1, justifyContent: 'center', minHeight: 48 }}
            onClick={() => setQIdx(i => Math.max(0, i - 1))}
            disabled={qIdx === 0}
          >
            {t('btn_prev')}
          </button>
          <button
            className="btn btn-primary"
            style={{ flex: 1, justifyContent: 'center', minHeight: 48 }}
            onClick={() => setQIdx(i => Math.min(questions.length - 1, i + 1))}
            disabled={qIdx === questions.length - 1}
          >
            {t('btn_next')}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Select phase ───────────────────────────────────────────────────────────────
const SelectPhase: React.FC<{
  onStart: (b: 'A' | 'B') => void;
  pastExams: ExamRecord[];
  examData: ExamData;
}> = ({ onStart, pastExams, examData }) => {
  const { t } = useLang();

  const countA = (() => {
    const r = examData.bandA.exam1.reading;
    return (r.part1?.questions.length ?? 0)
         + (r.part2?.questions.length ?? 0)
         + r.part3.groups.reduce((s, g) => s + g.questions.length, 0)
         + r.part4.passages.reduce((s, p) => s + p.blanks.length, 0)
         + r.part5.passages.reduce((s, p) => s + p.questions.length, 0);
  })();
  const countB = (() => {
    const r = examData.bandB.exam1.reading;
    const imgCount = r.part2.image_passages?.reduce((s, ip) => s + ip.questions.length, 0) ?? 0;
    return r.part1.passages.reduce((s, p) => s + p.questions.length, 0)
         + r.part2.passages.reduce((s, p) => s + p.questions.length, 0)
         + imgCount;
  })();

  return (
    <div>
      <div className="card">
        <h2 style={{ marginBottom: 6 }}>{t('exam_title')}</h2>
        <p className="text-sm text-muted" style={{ marginBottom: 20 }}>{t('exam_subtitle')}</p>
        <div className="flex gap-12" style={{ flexWrap: 'wrap' }}>
          <ExamCard band="A" count={countA} parts="Phần 1 · 2 · 3 · 4 · 5" onClick={() => onStart('A')} />
          <ExamCard band="B" count={countB} parts="Phần 1 · 2"              onClick={() => onStart('B')} />
        </div>
      </div>

      {pastExams.length > 0 && (
        <div className="card">
          <h3 style={{ marginBottom: 12 }}>{t('exam_history')}</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '6px 0' }}>{t('exam_date')}</th>
                <th>Band</th>
                <th>{t('exam_result')}</th>
                <th>%</th>
              </tr>
            </thead>
            <tbody>
              {[...pastExams].reverse().slice(0, 8).map((e, i) => {
                const pct = Math.round(e.score / e.total * 100);
                return (
                  <tr key={i} style={{ borderBottom: '1px solid var(--bg)' }}>
                    <td style={{ padding: '7px 0', color: 'var(--text-secondary)' }}>{e.date}</td>
                    <td><span className={`badge badge-${e.band}`}>Band {e.band}</span></td>
                    <td style={{ fontWeight: 600 }}>{e.score}/{e.total}</td>
                    <td style={{ fontWeight: 700, color: pct >= 70 ? 'var(--success)' : 'var(--error)' }}>{pct}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const ExamCard: React.FC<{ band: 'A' | 'B'; count: number; parts: string; onClick: () => void }> = ({ band, count, parts, onClick }) => {
  const { t } = useLang();
  return (
    <div style={{ flex: 1, minWidth: 200, border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px', cursor: 'pointer', transition: 'border-color .15s' }}
         onClick={onClick}
         onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
         onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
      <span className={`badge badge-${band}`} style={{ marginBottom: 10, display: 'inline-block' }}>Band {band}</span>
      <div style={{ fontSize: '2rem', fontWeight: 700 }}>{count} câu</div>
      <div className="text-sm text-muted" style={{ marginTop: 4 }}>{parts} · 60 phút</div>
      <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={e => { e.stopPropagation(); onClick(); }}>
        {t('exam_start')}
      </button>
    </div>
  );
};

// ── Result phase ───────────────────────────────────────────────────────────────
const ResultPhase: React.FC<{
  questions: FlatQuestion[];
  answers: Record<number, OptionKey>;
  onRetry: () => void;
}> = ({ questions, answers, onRetry }) => {
  const { t } = useLang();
  const score = questions.filter(q => answers[q.id] === q.answer).length;
  const pct   = Math.round(score / questions.length * 100);

  const byPart = questions.reduce<Record<string, { correct: number; total: number }>>((acc, q) => {
    if (!acc[q.part]) acc[q.part] = { correct: 0, total: 0 };
    acc[q.part].total++;
    if (answers[q.id] === q.answer) acc[q.part].correct++;
    return acc;
  }, {});

  const partLabel: Record<string, string> = {
    part1: t('part1_label'), part2: t('part2_label'), part3: t('part3_label'),
    part4: t('part4_label'), part5: t('part5_label'),
  };

  return (
    <div>
      <div className="card text-center">
        <div className="score-ring" style={{ borderColor: pct >= 70 ? 'var(--success)' : 'var(--error)' }}>
          <span className="num">{pct}%</span>
          <span className="label">{score}/{questions.length}</span>
        </div>
        <h2>
          {pct >= 70 ? t('result_excellent') : pct >= 50 ? t('result_good') : t('result_keep_going')}
        </h2>

        {/* Per-part summary */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginTop: 12 }}>
          {Object.entries(byPart).map(([part, s]) => (
            <div key={part} style={{ background: 'var(--bg)', borderRadius: 'var(--radius)', padding: '6px 14px', fontSize: '.8rem' }}>
              <div style={{ fontWeight: 700 }}>{partLabel[part] ?? part}</div>
              <div style={{ color: s.correct / s.total >= 0.7 ? 'var(--success)' : 'var(--error)' }}>
                {s.correct}/{s.total}
              </div>
            </div>
          ))}
        </div>

        <button className="btn btn-outline btn-sm mt-12" onClick={onRetry}>{t('btn_back')}</button>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 12 }}>{t('result_detail')}</h3>
        {questions.map(q => {
          const chosen  = answers[q.id];
          const correct = chosen === q.answer;
          return (
            <div key={q.id} style={{ display: 'flex', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--bg)', fontSize: '.85rem', alignItems: 'flex-start' }}>
              <span style={{ color: correct ? 'var(--success)' : 'var(--error)', fontWeight: 700, minWidth: 14 }}>
                {correct ? '✓' : '✗'}
              </span>
              <span style={{ flex: 1 }}>
                {t('question_prefix')} {q.id}: {t('correct_ans')} <strong>{q.answer}</strong>
                {!correct && chosen && <span style={{ color: 'var(--error)' }}> · {t('you_chose')} {chosen}</span>}
                {!correct && !chosen && <span style={{ color: 'var(--text-muted)' }}> · {t('not_answered')}</span>}
                {(q.type === 'image_choice' || q.type === 'picture_description' || q.type === 'image_material') && (
                  <span style={{ color: 'var(--text-secondary)', marginLeft: 4 }}>📸</span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
