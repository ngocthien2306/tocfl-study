import React, { useMemo, useState } from 'react';
import type { ExamData, FlatQuestion, OptionKey, ExamRecord } from '../../types';
import { useTimer } from '../../hooks/useTimer';

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
    // Part 3
    r.part3.groups.forEach(g =>
      g.questions.forEach(q => out.push({ ...q, type: 'gap', part: 'part3', context: g.context }))
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
    // Part 2
    r.part2.passages.forEach(p =>
      p.questions.forEach(q => out.push({ ...q, type: 'mc', part: 'part2', passage: p.text, passageId: p.id }))
    );
  }
  return out;
}

export const ExamModule: React.FC<Props> = ({ examData, addExam, pastExams }) => {
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
    // Start timer after a tick
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
  const q          = questions[qIdx];
  const doneCt     = Object.keys(answers).length;
  const prevPassage = qIdx > 0 ? questions[qIdx - 1].passage : null;
  const showPassage = !!q.passage && q.passage !== prevPassage;

  return (
    <div>
      {/* Exam header */}
      <div className="card card--compact mb-12 flex-between">
        <div>
          <span style={{ fontWeight: 700 }}>Band {band}</span>
          <span className="text-sm text-muted" style={{ marginLeft: 8 }}>{doneCt}/{questions.length} đã trả lời</span>
        </div>
        <span className={`timer ${timer.timeLeft < 300 ? 'warn' : ''}`}>{timer.formatted}</span>
        <button className="btn btn-danger btn-sm" onClick={finishExam}>Nộp bài</button>
      </div>

      {/* Q-grid */}
      <div className="card card--compact mb-12">
        <div className="q-grid">
          {questions.map((q, i) => (
            <div
              key={q.id}
              className={`q-dot${answers[q.id] ? ' done' : ''}${i === qIdx ? ' current' : ''}`}
              onClick={() => setQIdx(i)}
              title={`Câu ${q.id}`}
            >
              {q.id}
            </div>
          ))}
        </div>
      </div>

      {/* Current question */}
      <div className="card">
        {q.context && (
          <div style={{ background: 'var(--warn-light)', border: '1px solid #fde68a', borderRadius: 'var(--radius)', padding: '8px 12px', marginBottom: 12, fontSize: '.83rem', color: 'var(--warn)' }}>
            {q.context}
          </div>
        )}
        {showPassage && q.passage && (
          <div className="passage-box">
            <div className="passage-label">Đoạn văn</div>
            {q.passage}
          </div>
        )}
        <div className="question-header">
          <span className="question-num">Câu {q.id}.</span>
          {q.question ?? q.sentence}
        </div>
        <div className="option-list">
          {(Object.entries(q.options) as [OptionKey, string][]).map(([key, text]) => (
            <button
              key={key}
              className={`option-btn${answers[q.id] === key ? ' selected' : ''}`}
              onClick={() => setAnswers(a => ({ ...a, [q.id]: key }))}
            >
              <span className="option-key">{key}</span>
              <span>{text}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-8 mt-16">
          <button className="btn btn-outline" onClick={() => setQIdx(i => Math.max(0, i - 1))} disabled={qIdx === 0}>← Trước</button>
          <button className="btn btn-primary" onClick={() => setQIdx(i => Math.min(questions.length - 1, i + 1))} disabled={qIdx === questions.length - 1}>Sau →</button>
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
  const countA = (() => {
    const r = examData.bandA.exam1.reading;
    return r.part3.groups.reduce((s, g) => s + g.questions.length, 0)
         + r.part4.passages.reduce((s, p) => s + p.blanks.length, 0)
         + r.part5.passages.reduce((s, p) => s + p.questions.length, 0);
  })();
  const countB = (() => {
    const r = examData.bandB.exam1.reading;
    return r.part1.passages.reduce((s, p) => s + p.questions.length, 0)
         + r.part2.passages.reduce((s, p) => s + p.questions.length, 0);
  })();

  return (
    <div>
      <div className="card">
        <h2 style={{ marginBottom: 6 }}>Thi thử TOCFL</h2>
        <p className="text-sm text-muted" style={{ marginBottom: 20 }}>Làm bài đọc mô phỏng đề thi thật · Đếm giờ 60 phút</p>
        <div className="flex gap-12" style={{ flexWrap: 'wrap' }}>
          <ExamCard band="A" count={countA} parts="Phần 3 · 4 · 5" onClick={() => onStart('A')} />
          <ExamCard band="B" count={countB} parts="Phần 1 · 2"     onClick={() => onStart('B')} />
        </div>
      </div>

      {pastExams.length > 0 && (
        <div className="card">
          <h3 style={{ marginBottom: 12 }}>Lịch sử thi</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '6px 0' }}>Ngày</th>
                <th>Band</th>
                <th>Kết quả</th>
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

const ExamCard: React.FC<{ band: 'A' | 'B'; count: number; parts: string; onClick: () => void }> = ({ band, count, parts, onClick }) => (
  <div style={{ flex: 1, minWidth: 200, border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px', cursor: 'pointer', transition: 'border-color .15s' }}
       onClick={onClick}
       onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
       onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
    <span className={`badge badge-${band}`} style={{ marginBottom: 10, display: 'inline-block' }}>Band {band}</span>
    <div style={{ fontSize: '2rem', fontWeight: 700 }}>{count} câu</div>
    <div className="text-sm text-muted" style={{ marginTop: 4 }}>{parts} · 60 phút</div>
    <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={e => { e.stopPropagation(); onClick(); }}>
      Bắt đầu thi →
    </button>
  </div>
);

// ── Result phase ───────────────────────────────────────────────────────────────
const ResultPhase: React.FC<{
  questions: FlatQuestion[];
  answers: Record<number, OptionKey>;
  onRetry: () => void;
}> = ({ questions, answers, onRetry }) => {
  const score = questions.filter(q => answers[q.id] === q.answer).length;
  const pct   = Math.round(score / questions.length * 100);

  return (
    <div>
      <div className="card text-center">
        <div className="score-ring" style={{ borderColor: pct >= 70 ? 'var(--success)' : 'var(--error)' }}>
          <span className="num">{pct}%</span>
          <span className="label">{score}/{questions.length}</span>
        </div>
        <h2>{pct >= 70 ? 'Xuất sắc!' : pct >= 50 ? 'Khá tốt!' : 'Cần ôn thêm!'}</h2>
        <button className="btn btn-outline btn-sm mt-12" onClick={onRetry}>← Quay lại</button>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 12 }}>Chi tiết kết quả</h3>
        {questions.map(q => {
          const chosen   = answers[q.id];
          const correct  = chosen === q.answer;
          return (
            <div key={q.id} style={{ display: 'flex', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--bg)', fontSize: '.85rem', alignItems: 'flex-start' }}>
              <span style={{ color: correct ? 'var(--success)' : 'var(--error)', fontWeight: 700, minWidth: 14 }}>
                {correct ? '✓' : '✗'}
              </span>
              <span style={{ flex: 1 }}>
                Câu {q.id}: đáp án <strong>{q.answer}</strong>
                {!correct && chosen && <span style={{ color: 'var(--error)' }}> · bạn chọn {chosen}</span>}
                {!correct && !chosen && <span style={{ color: 'var(--text-muted)' }}> · chưa trả lời</span>}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
