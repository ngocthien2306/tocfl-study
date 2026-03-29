import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import type { ExamData, ExamKey, FlatQuestion, OptionKey, ExamRecord, ExamAttempt, AttemptQuestion } from '../../types';
import type { AIExplanationData } from '../../utils/aiExplanation';
import { useTimer } from '../../hooks/useTimer';
import { useLang } from '../../i18n/LangContext';
import { IconCamera } from '../UI/Icons';
import { loadAttempts, saveAttempt, deleteAttempt, fmtDuration, fmtDate } from '../../utils/historyStorage';
import { useApiKey } from '../../contexts/ApiKeyContext';
import { useAIModel } from '../../hooks/useAIModel';
import {
  buildCacheKey, loadExplanation, saveExplanation,
  generateReadingExplanation, stripJsonSuffix,
} from '../../utils/aiExplanation';

interface Props {
  examData: ExamData;
  addExam: (r: ExamRecord) => void;
  pastExams: ExamRecord[];
}

type Phase = 'select' | 'exam' | 'result' | 'history' | 'review';

const EXAM_DURATION = 60 * 60; // 60 min
const DRAFT_KEY = 'tocfl_exam_draft';

interface ExamDraft {
  band: 'A' | 'B';
  examKey: ExamKey;
  answers: Record<number, OptionKey>;
  qIdx: number;
  timeLeft: number;
  savedAt: number; // Date.now() timestamp
}

function loadDraft(): ExamDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as ExamDraft) : null;
  } catch { return null; }
}
function saveDraft(d: ExamDraft) {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch { /* silent */ }
}
function clearDraft() {
  try { localStorage.removeItem(DRAFT_KEY); } catch { /* silent */ }
}
function fmtSeconds(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function buildExamQuestions(band: 'A' | 'B', examKey: ExamKey, data: ExamData): FlatQuestion[] {
  const out: FlatQuestion[] = [];
  if (band === 'A') {
    const exam = data.bandA[examKey] ?? data.bandA.exam1;
    const r = exam.reading;

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
    const r = (data.bandB[examKey] ?? data.bandB.exam1).reading;
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
  const { apiKey, hasKey } = useApiKey();
  const { model } = useAIModel();
  const [phase,         setPhase        ] = useState<Phase>('select');
  const [band,          setBand         ] = useState<'A' | 'B'>('B');
  const [examKey,       setExamKey      ] = useState<ExamKey>('exam1');
  const [answers,       setAnswers      ] = useState<Record<number, OptionKey>>({});
  const [qIdx,          setQIdx         ] = useState(0);
  const [draft,         setDraft        ] = useState<ExamDraft | null>(() => loadDraft());
  const [reviewAttempt, setReviewAttempt] = useState<ExamAttempt | null>(null);
  // Cached attempts list so it refreshes when we save a new one
  const [attempts,      setAttempts     ] = useState<ExamAttempt[]>(() => loadAttempts('exam'));

  const questions = useMemo(() => buildExamQuestions(band, examKey, examData), [band, examKey, examData]);

  const timer = useTimer(EXAM_DURATION, () => finishExam());

  // Auto-save draft every 5 s while exam is in progress
  useEffect(() => {
    if (phase !== 'exam') return;
    const save = () => saveDraft({
      band, examKey, answers, qIdx,
      timeLeft: timer.timeLeft,
      savedAt: Date.now(),
    });
    save(); // immediate save on any change
    const id = setInterval(save, 5000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, answers, qIdx]);

  function startExam(b: 'A' | 'B', ek: ExamKey) {
    clearDraft();
    setDraft(null);
    setBand(b);
    setExamKey(ek);
    setAnswers({});
    setQIdx(0);
    setPhase('exam');
    timer.reset();
    setTimeout(() => timer.start(), 50);
  }

  function resumeExam() {
    if (!draft) return;
    const elapsed = Math.floor((Date.now() - draft.savedAt) / 1000);
    const remaining = Math.max(0, draft.timeLeft - elapsed);
    setBand(draft.band);
    setExamKey(draft.examKey);
    setAnswers(draft.answers);
    setQIdx(draft.qIdx);
    setDraft(null);
    setPhase('exam');
    timer.setTo(remaining);
    setTimeout(() => timer.start(), 50);
  }

  function discardDraft() {
    clearDraft();
    setDraft(null);
  }

  function finishExam() {
    timer.stop();
    const timeTakenSecs = EXAM_DURATION - timer.timeLeft;
    clearDraft();
    setDraft(null);
    const score = questions.filter(q => answers[q.id] === q.answer).length;

    // Build and persist a detailed attempt record
    const attemptQs: AttemptQuestion[] = questions.map(q => ({
      id:        q.id,
      part:      q.part,
      type:      q.type,
      question:  q.question,
      sentence:  q.sentence,
      options:   q.options,
      answer:    q.answer,
      chosen:    answers[q.id] ?? null,
      context:   q.context,
      passage:   q.passage,
      pageImage: q.pageImage,
    }));
    const attempt: ExamAttempt = {
      id:            String(Date.now()),
      module:        'exam',
      band,
      examKey,
      score,
      total:         questions.length,
      date:          new Date().toISOString(),
      timeTakenSecs,
      questions:     attemptQs,
    };
    saveAttempt(attempt);
    setAttempts(loadAttempts('exam'));   // refresh cached list
    setReviewAttempt(attempt);           // pre-load for the result → review link

    addExam({
      band,
      examKey,
      score,
      total:          questions.length,
      date:           new Date().toISOString(),
      module:         'exam',
      timeTakenSecs:  timeTakenSecs,
    });
    setPhase('result');
  }

  if (phase === 'select') return (
    <SelectPhase
      onStart={startExam} onResume={resumeExam} onDiscardDraft={discardDraft}
      draft={draft} pastExams={pastExams} examData={examData}
      selectedBand={band} selectedExam={examKey}
      onBandChange={(b) => { setBand(b); setExamKey('exam1'); }} onExamChange={setExamKey}
      onViewHistory={() => setPhase('history')}
      attempts={attempts}
      onReview={(a) => { setReviewAttempt(a); setPhase('review'); }}
    />
  );
  if (phase === 'history') return (
    <HistoryPhase
      attempts={attempts}
      onBack={() => setPhase('select')}
      onReview={(a) => { setReviewAttempt(a); setPhase('review'); }}
      onDelete={(id) => {
        deleteAttempt('exam', id);
        setAttempts(loadAttempts('exam'));
      }}
    />
  );
  if (phase === 'review' && reviewAttempt) return (
    <ReviewPhase
      attempt={reviewAttempt}
      base={import.meta.env.BASE_URL}
      onBack={() => setPhase(reviewAttempt ? 'history' : 'select')}
    />
  );
  if (phase === 'result') return (
    <ResultPhase
      questions={questions}
      answers={answers}
      onRetry={() => setPhase('select')}
      onReview={() => { if (reviewAttempt) setPhase('review'); }}
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

        {/* AI Explanation Drawer */}
        <AIDrawer
          apiKey={apiKey}
          hasKey={hasKey}
          model={model}
          cacheKey={buildCacheKey('exam', band, examKey, q.id)}
          questionId={q.id}
          question={q.question}
          sentence={q.sentence}
          options={q.options}
          answer={q.answer}
          context={q.context}
          passage={q.passage}
          pageImageUrl={q.pageImage ? `${base}${q.pageImage}` : undefined}
        />

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
  onStart: (b: 'A' | 'B', ek: ExamKey) => void;
  onResume: () => void;
  onDiscardDraft: () => void;
  draft: ExamDraft | null;
  pastExams: ExamRecord[];
  examData: ExamData;
  selectedBand: 'A' | 'B';
  selectedExam: ExamKey;
  onBandChange: (b: 'A' | 'B') => void;
  onExamChange: (ek: ExamKey) => void;
  onViewHistory: () => void;
  attempts: ExamAttempt[];
  onReview: (a: ExamAttempt) => void;
}> = ({ onStart, onResume, onDiscardDraft, draft, examData, selectedBand, selectedExam, onBandChange, onExamChange, onViewHistory, attempts, onReview }) => {
  const { t, lang } = useLang();

  const availableBandAExams = Object.keys(examData.bandA) as ExamKey[];
  const availableBandBExams = Object.keys(examData.bandB) as ExamKey[];

  const countB = (() => {
    const r = (examData.bandB[selectedExam] ?? examData.bandB.exam1).reading;
    const imgCount = r.part2.image_passages?.reduce((s, ip) => s + ip.questions.length, 0) ?? 0;
    return r.part1.passages.reduce((s, p) => s + p.questions.length, 0)
         + r.part2.passages.reduce((s, p) => s + p.questions.length, 0)
         + imgCount;
  })();

  const examLabels: Record<ExamKey, Record<string, string>> = {
    exam1: { vi: 'Đề 1', zh: '第1套', en: 'Exam 1' },
    exam2: { vi: 'Đề 2', zh: '第2套', en: 'Exam 2' },
    exam3: { vi: 'Đề 3', zh: '第3套', en: 'Exam 3' },
  };

  return (
    <div>
      {/* ── Resume banner ─────────────────────────────────────────────────── */}
      {draft && (() => {
        const elapsed = Math.floor((Date.now() - draft.savedAt) / 1000);
        const remaining = Math.max(0, draft.timeLeft - elapsed);
        const answeredCount = Object.keys(draft.answers).length;
        return (
          <div style={{
            background: 'var(--accent-light)', border: '1px solid var(--accent)',
            borderRadius: 'var(--radius-lg)', padding: '14px 16px', marginBottom: 14,
            display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          }}>
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ fontWeight: 700, fontSize: '.95rem', color: 'var(--accent)', marginBottom: 3 }}>
                ⏸ Bài thi đang tạm dừng
              </div>
              <div style={{ fontSize: '.82rem', color: 'var(--text-secondary)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <span>Band {draft.band} · {draft.examKey.replace('exam', 'Đề ')}</span>
                <span>{answeredCount} câu đã trả lời</span>
                <span>⏱ Còn {fmtSeconds(remaining)}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button className="btn btn-primary btn-sm" onClick={onResume}>▶ Tiếp tục</button>
              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--error)' }} onClick={onDiscardDraft}>Huỷ bài</button>
            </div>
          </div>
        );
      })()}

      <div className="card">
        <h2 style={{ marginBottom: 6 }}>{t('exam_title')}</h2>
        <p className="text-sm text-muted" style={{ marginBottom: 16 }}>{t('exam_subtitle')}</p>

        {/* Band selector */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {(['A', 'B'] as const).map(b => (
            <button
              key={b}
              onClick={() => onBandChange(b)}
              className={`btn ${selectedBand === b ? 'btn-primary' : 'btn-outline'}`}
              style={{ flex: 1, minHeight: 44 }}
            >
              Band {b}
            </button>
          ))}
        </div>

        {/* Exam selector (Band A and Band B) */}
        {selectedBand === 'A' && availableBandAExams.length > 1 && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {availableBandAExams.map(ek => (
              <button
                key={ek}
                onClick={() => onExamChange(ek)}
                className={`btn btn-sm ${selectedExam === ek ? 'btn-primary' : 'btn-outline'}`}
                style={{ flex: 1, minHeight: 40 }}
              >
                {examLabels[ek][lang]}
              </button>
            ))}
          </div>
        )}
        {selectedBand === 'B' && availableBandBExams.length > 1 && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {availableBandBExams.map(ek => (
              <button
                key={ek}
                onClick={() => onExamChange(ek)}
                className={`btn btn-sm ${selectedExam === ek ? 'btn-primary' : 'btn-outline'}`}
                style={{ flex: 1, minHeight: 40 }}
              >
                {examLabels[ek][lang]}
              </button>
            ))}
          </div>
        )}

        <button
          className="btn btn-primary"
          style={{ width: '100%', minHeight: 52, fontSize: '1rem' }}
          onClick={() => onStart(selectedBand, selectedExam)}
        >
          {t('exam_start')}
        </button>

        <div className="flex gap-12 mt-12" style={{ flexWrap: 'wrap' }}>
          {selectedBand === 'A' ? (
            <ExamCard band="A" count={50} parts="Phần 1 · 2 · 3 · 4 · 5" onClick={() => onStart('A', selectedExam)} />
          ) : (
            <ExamCard band="B" count={countB} parts="Phần 1 · 2" onClick={() => onStart('B', selectedExam)} />
          )}
        </div>
      </div>

      {attempts.length > 0 && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>{t('exam_history')}</h3>
            <button className="btn btn-ghost btn-sm" onClick={onViewHistory}>
              📋 Xem tất cả ({attempts.length})
            </button>
          </div>
          {attempts.slice(0, 4).map((a) => {
            const pct = Math.round(a.score / a.total * 100);
            const wrongCt = a.questions.filter(q => q.chosen !== q.answer).length;
            return (
              <div key={a.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 0', borderBottom: '1px solid var(--bg)',
                flexWrap: 'wrap',
              }}>
                <div style={{ flex: 1, minWidth: 120 }}>
                  <div style={{ fontSize: '.82rem', color: 'var(--text-secondary)' }}>{fmtDate(a.date)}</div>
                  <div style={{ fontSize: '.8rem', color: 'var(--text-muted)' }}>
                    Band {a.band} · {a.examKey.replace('exam', 'Đề ')} · ⏱ {fmtDuration(a.timeTakenSecs)}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontWeight: 700, color: pct >= 70 ? 'var(--success)' : 'var(--error)' }}>
                    {a.score}/{a.total} ({pct}%)
                  </div>
                  <div style={{ fontSize: '.75rem', color: 'var(--text-muted)' }}>
                    {wrongCt} câu sai
                  </div>
                </div>
                <button className="btn btn-outline btn-sm" onClick={() => onReview(a)} style={{ flexShrink: 0 }}>
                  🔍 Xem lại
                </button>
              </div>
            );
          })}
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
  onReview: () => void;
}> = ({ questions, answers, onRetry, onReview }) => {
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

        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16, flexWrap: 'wrap' }}>
          <button className="btn btn-outline btn-sm" onClick={onRetry}>{t('btn_back')}</button>
          <button className="btn btn-primary btn-sm" onClick={onReview}>
            🔍 Xem lại chi tiết
          </button>
        </div>
      </div>

      {/* Quick wrong-answer list */}
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
                  <IconCamera size={13} style={{ color: 'var(--text-secondary)', marginLeft: 4, display: 'inline', verticalAlign: 'middle' }} />
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── History phase — full list of past attempts ─────────────────────────────────
const HistoryPhase: React.FC<{
  attempts: ExamAttempt[];
  onBack: () => void;
  onReview: (a: ExamAttempt) => void;
  onDelete: (id: string) => void;
}> = ({ attempts, onBack, onReview, onDelete }) => {
  const { lang } = useLang();
  const lbl = {
    vi: { title: 'Lịch sử thi Đọc', back: '← Quay lại', empty: 'Chưa có lần thi nào được lưu.', delete: 'Xoá', review: '🔍 Xem lại', wrong: 'câu sai', band: 'Band', time: 'Thời gian' },
    zh: { title: '閱讀考試紀錄', back: '← 返回', empty: '尚無考試紀錄。', delete: '刪除', review: '🔍 回顧', wrong: '題錯誤', band: 'Band', time: '用時' },
    en: { title: 'Reading Exam History', back: '← Back', empty: 'No attempts saved yet.', delete: 'Delete', review: '🔍 Review', wrong: 'wrong', band: 'Band', time: 'Time' },
  }[lang];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <button className="btn btn-ghost btn-sm" onClick={onBack}>{lbl.back}</button>
        <h2 style={{ margin: 0, fontSize: '1rem' }}>{lbl.title}</h2>
      </div>

      {attempts.length === 0 ? (
        <div className="card text-center" style={{ color: 'var(--text-muted)' }}>{lbl.empty}</div>
      ) : (
        attempts.map((a) => {
          const pct = Math.round(a.score / a.total * 100);
          const wrongCt = a.questions.filter(q => q.chosen !== q.answer).length;
          return (
            <div key={a.id} className="card card--compact" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              {/* Score ring small */}
              <div style={{
                width: 52, height: 52, borderRadius: '50%',
                border: `3px solid ${pct >= 70 ? 'var(--success)' : 'var(--error)'}`,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <span style={{ fontSize: '.85rem', fontWeight: 700, color: pct >= 70 ? 'var(--success)' : 'var(--error)', lineHeight: 1.1 }}>{pct}%</span>
                <span style={{ fontSize: '.65rem', color: 'var(--text-muted)' }}>{a.score}/{a.total}</span>
              </div>

              {/* Meta */}
              <div style={{ flex: 1, minWidth: 140 }}>
                <div style={{ fontWeight: 600, fontSize: '.88rem' }}>
                  {lbl.band} {a.band} · {a.examKey.replace('exam', 'Đề ')}
                </div>
                <div style={{ fontSize: '.78rem', color: 'var(--text-muted)' }}>
                  {fmtDate(a.date)} · {lbl.time} {fmtDuration(a.timeTakenSecs)} · <span style={{ color: wrongCt > 0 ? 'var(--error)' : 'var(--success)' }}>{wrongCt} {lbl.wrong}</span>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button className="btn btn-primary btn-sm" onClick={() => onReview(a)}>{lbl.review}</button>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ color: 'var(--error)' }}
                  onClick={() => { if (confirm('Xoá lần thi này?')) onDelete(a.id); }}
                >
                  {lbl.delete}
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};

// ── AI Drawer component ────────────────────────────────────────────────────────

interface AIDrawerProps {
  apiKey:        string;
  hasKey:        boolean;
  model:         string;
  cacheKey:      string;
  questionId:    number;
  question?:     string;
  sentence?:     string;
  options:       Partial<Record<OptionKey, string>>;
  answer:        OptionKey;
  context?:      string;
  passage?:      string;
  pageImageUrl?: string;
}

const AIDrawer: React.FC<AIDrawerProps> = ({
  apiKey, hasKey, model, cacheKey,
  questionId, question, sentence, options, answer,
  context, passage, pageImageUrl,
}) => {
  const [status,      setStatus     ] = useState<'idle' | 'loading' | 'done'>('idle');
  const [expanded,    setExpanded   ] = useState(false);
  const [streamText,  setStreamText ] = useState('');
  const [data,        setData       ] = useState<AIExplanationData | null>(() => loadExplanation(cacheKey));
  const prevCacheKey = useRef(cacheKey);

  // When question changes, reload cache for new question
  useEffect(() => {
    if (prevCacheKey.current !== cacheKey) {
      prevCacheKey.current = cacheKey;
      const cached = loadExplanation(cacheKey);
      setData(cached);
      setStatus(cached ? 'done' : 'idle');
      setExpanded(false);
      setStreamText('');
    }
  }, [cacheKey]);

  const handleAsk = useCallback(async () => {
    if (!hasKey || status === 'loading') return;
    setStatus('loading');
    setStreamText('');
    setExpanded(true);

    try {
      const result = await generateReadingExplanation({
        apiKey,
        model,
        questionId,
        question,
        sentence,
        options,
        answer,
        context,
        passage,
        pageImageUrl,
        onToken: (token) => setStreamText(prev => prev + token),
      });
      saveExplanation(cacheKey, result);
      setData(result);
      setStatus('done');
      setStreamText('');
    } catch (err) {
      console.error('[AIDrawer]', err);
      setStatus('idle');
      setExpanded(false);
    }
  }, [apiKey, hasKey, model, status, cacheKey, questionId, question, sentence, options, answer, context, passage, pageImageUrl]);

  // ── No API key ──────────────────────────────────────────────────────────────
  if (!hasKey) {
    return (
      <div style={{
        marginTop: 12, padding: '8px 12px', borderRadius: 8,
        background: 'var(--bg)', border: '1px dashed var(--border)',
        fontSize: '.78rem', color: 'var(--text-muted)', textAlign: 'center',
      }}>
        🤖 Nhập OpenAI API key để dùng AI giải thích câu này
      </div>
    );
  }

  // ── Badge row ───────────────────────────────────────────────────────────────
  const hasCached = !!data;

  return (
    <div style={{ marginTop: 12 }}>
      {/* Trigger / badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {status === 'idle' && !hasCached && (
          <button
            className="btn btn-ghost btn-sm"
            style={{
              border: '1px solid var(--accent)', color: 'var(--accent)',
              fontSize: '.78rem', padding: '4px 12px', borderRadius: 20,
            }}
            onClick={handleAsk}
          >
            🤖 Hỏi AI giải thích
          </button>
        )}

        {status === 'loading' && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: '.78rem', color: 'var(--accent)',
          }}>
            <span className="iv-typing-dots"><span/><span/><span/></span>
            Đang phân tích...
          </div>
        )}

        {(status === 'done' || (hasCached && status === 'idle')) && (
          <button
            className="btn btn-ghost btn-sm"
            style={{
              border: '1px solid var(--success)', color: 'var(--success)',
              fontSize: '.78rem', padding: '4px 12px', borderRadius: 20,
            }}
            onClick={() => setExpanded(e => !e)}
          >
            ✓ AI đã giải {expanded ? '▲' : '▼'}
          </button>
        )}

        {/* Regenerate button when cached */}
        {hasCached && status !== 'loading' && (
          <button
            className="btn btn-ghost btn-sm"
            style={{ fontSize: '.72rem', color: 'var(--text-muted)', padding: '3px 8px' }}
            onClick={handleAsk}
            title="Tạo lại giải thích"
          >
            ↻ Tạo lại
          </button>
        )}
      </div>

      {/* Expanded content */}
      {expanded && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>

          {/* ── Explanation box ── */}
          <div style={{
            padding: '12px 14px',
            background: 'var(--bg)', borderRadius: 8,
            border: '1px solid var(--border)',
            fontSize: '.83rem', lineHeight: 1.75,
          }}>
            {status === 'loading' && (
              <div style={{ color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                {stripJsonSuffix(streamText)}
                <span className="iv-typing-cursor">▍</span>
              </div>
            )}
            {status !== 'loading' && data && (
              <div style={{ whiteSpace: 'pre-wrap', color: 'var(--text)' }}>
                {data.explanation}
              </div>
            )}
          </div>

          {/* ── Vocabulary card — separate section ── */}
          {status !== 'loading' && data && data.vocabulary.length > 0 && (
            <div style={{
              borderRadius: 8,
              border: '1.5px solid var(--accent)',
              overflow: 'hidden',
            }}>
              {/* Header bar */}
              <div style={{
                background: 'var(--accent)', color: '#fff',
                padding: '7px 14px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span style={{ fontWeight: 700, fontSize: '.78rem', letterSpacing: '.05em' }}>
                  📚 TỪ VỰNG CẦN HỌC
                </span>
                <span style={{ fontSize: '.7rem', opacity: 0.85 }}>
                  {data.vocabulary.length} từ
                </span>
              </div>
              {/* Cards grid */}
              <div style={{
                background: 'var(--accent-light)',
                padding: '10px 12px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                gap: 8,
              }}>
                {data.vocabulary.map((v, i) => (
                  <div key={i} style={{
                    background: 'var(--surface)',
                    borderRadius: 8,
                    padding: '10px 12px',
                    border: '1px solid var(--border)',
                    boxShadow: '0 1px 4px rgba(0,0,0,.06)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
                      <span style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--accent)', lineHeight: 1 }}>
                        {v.word}
                      </span>
                      <span style={{ fontSize: '.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        {v.pinyin}
                      </span>
                    </div>
                    <div style={{ fontSize: '.8rem', fontWeight: 600, color: 'var(--text)', marginBottom: v.example ? 6 : 0 }}>
                      {v.meaning}
                    </div>
                    {v.example && (
                      <div style={{
                        fontSize: '.73rem', color: 'var(--text-secondary)',
                        borderTop: '1px dashed var(--border)', paddingTop: 5,
                        lineHeight: 1.5,
                      }}>
                        {v.example}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {/* Footer */}
              <div style={{
                background: 'var(--accent-light)',
                borderTop: '1px solid rgba(0,0,0,.07)',
                padding: '4px 14px',
                fontSize: '.68rem', color: 'var(--text-muted)', textAlign: 'right',
              }}>
                Lưu lúc {new Date(data.cachedAt).toLocaleString('vi-VN')}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
};

// ── Review phase — drill down into a single attempt ────────────────────────────
const ReviewPhase: React.FC<{
  attempt: ExamAttempt;
  base: string;
  onBack: () => void;
}> = ({ attempt, base, onBack }) => {
  const { lang } = useLang();
  const [filter, setFilter] = useState<'all' | 'wrong' | 'correct'>('all');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const lbl = {
    vi: { back: '← Lịch sử', filterAll: 'Tất cả', filterWrong: '✗ Sai', filterCorrect: '✓ Đúng', correct: 'Đáp án đúng', yours: 'Bạn chọn', skipped: 'Bỏ qua', noQ: 'Không có câu nào.', image: '[hình ảnh]', passage: 'Đoạn văn', context: 'Ngữ cảnh' },
    zh: { back: '← 紀錄', filterAll: '全部', filterWrong: '✗ 錯誤', filterCorrect: '✓ 正確', correct: '正確答案', yours: '你選擇', skipped: '未作答', noQ: '沒有題目。', image: '[圖片題]', passage: '文章', context: '語境' },
    en: { back: '← History', filterAll: 'All', filterWrong: '✗ Wrong', filterCorrect: '✓ Correct', correct: 'Correct', yours: 'You chose', skipped: 'Skipped', noQ: 'No questions.', image: '[image]', passage: 'Passage', context: 'Context' },
  }[lang];

  const pct      = Math.round(attempt.score / attempt.total * 100);
  const wrongCt  = attempt.questions.filter(q => q.chosen !== q.answer).length;
  const partLabel: Record<string, string> = { part1: 'Part 1', part2: 'Part 2', part3: 'Part 3', part4: 'Part 4', part5: 'Part 5' };

  const byPart = attempt.questions.reduce<Record<string, { correct: number; total: number }>>((acc, q) => {
    if (!acc[q.part]) acc[q.part] = { correct: 0, total: 0 };
    acc[q.part].total++;
    if (q.chosen === q.answer) acc[q.part].correct++;
    return acc;
  }, {});

  const displayed = attempt.questions.filter(q => {
    if (filter === 'wrong')   return q.chosen !== q.answer;
    if (filter === 'correct') return q.chosen === q.answer;
    return true;
  });

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <button className="btn btn-ghost btn-sm" onClick={onBack}>{lbl.back}</button>
        <span style={{ fontSize: '.85rem', color: 'var(--text-muted)' }}>
          Band {attempt.band} · {attempt.examKey.replace('exam', 'Đề ')} · {fmtDate(attempt.date)} · ⏱ {fmtDuration(attempt.timeTakenSecs)}
        </span>
      </div>

      {/* Score summary */}
      <div className="card card--compact" style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 10 }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%', flexShrink: 0,
          border: `4px solid ${pct >= 70 ? 'var(--success)' : 'var(--error)'}`,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: '1.1rem', fontWeight: 700, color: pct >= 70 ? 'var(--success)' : 'var(--error)' }}>{pct}%</span>
          <span style={{ fontSize: '.68rem', color: 'var(--text-muted)' }}>{attempt.score}/{attempt.total}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flex: 1 }}>
          {Object.entries(byPart).map(([part, s]) => (
            <div key={part} style={{ background: 'var(--bg)', borderRadius: 'var(--radius)', padding: '5px 12px', textAlign: 'center', fontSize: '.78rem' }}>
              <div style={{ fontWeight: 700 }}>{partLabel[part] ?? part}</div>
              <div style={{ color: s.correct / s.total >= 0.7 ? 'var(--success)' : 'var(--error)' }}>
                {s.correct}/{s.total}
              </div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: '.8rem', color: 'var(--text-muted)', flexShrink: 0 }}>
          {wrongCt} câu sai
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        {(['all', 'wrong', 'correct'] as const).map(f => (
          <button
            key={f}
            className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? lbl.filterAll : f === 'wrong' ? lbl.filterWrong : lbl.filterCorrect}
            {f === 'wrong'   && wrongCt > 0   && <span style={{ marginLeft: 4, background: 'rgba(255,255,255,.25)', borderRadius: 10, padding: '0 5px', fontSize: '.75rem' }}>{wrongCt}</span>}
            {f === 'correct' && attempt.score > 0 && <span style={{ marginLeft: 4, background: 'rgba(255,255,255,.25)', borderRadius: 10, padding: '0 5px', fontSize: '.75rem' }}>{attempt.score}</span>}
          </button>
        ))}
      </div>

      {/* Question list */}
      {displayed.length === 0 ? (
        <div className="card" style={{ color: 'var(--text-muted)', textAlign: 'center' }}>{lbl.noQ}</div>
      ) : displayed.map((q) => {
        const isCorrect  = q.chosen === q.answer;
        const isExpanded = expandedId === q.id;

        return (
          <div
            key={q.id}
            className="card card--compact"
            style={{ marginBottom: 6, border: `1.5px solid ${isCorrect ? 'var(--success)' : q.chosen ? 'var(--error)' : 'var(--border)'}`, cursor: 'pointer' }}
            onClick={() => setExpandedId(isExpanded ? null : q.id)}
          >
            {/* Collapsed row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                fontWeight: 700, fontSize: '.9rem',
                color: isCorrect ? 'var(--success)' : q.chosen ? 'var(--error)' : 'var(--text-muted)',
                minWidth: 16,
              }}>
                {isCorrect ? '✓' : '✗'}
              </span>
              <span style={{ flex: 1, fontSize: '.85rem', fontWeight: 600 }}>
                Câu {q.id} <span style={{ fontSize: '.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>({partLabel[q.part] ?? q.part})</span>
                {q.pageImage && <IconCamera size={12} style={{ marginLeft: 4, color: 'var(--text-muted)', display: 'inline', verticalAlign: 'middle' }} />}
              </span>
              <div style={{ display: 'flex', gap: 6, fontSize: '.8rem', flexShrink: 0 }}>
                <span style={{ color: 'var(--success)', fontWeight: 700 }}>{q.answer}</span>
                {!isCorrect && q.chosen && <span style={{ color: 'var(--error)' }}>({q.chosen})</span>}
                {!isCorrect && !q.chosen && <span style={{ color: 'var(--text-muted)' }}>–</span>}
              </div>
              <span style={{ fontSize: '.75rem', color: 'var(--text-muted)' }}>{isExpanded ? '▲' : '▼'}</span>
            </div>

            {/* Expanded detail */}
            {isExpanded && (
              <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                {/* Context / passage */}
                {q.context && (
                  <div style={{ background: 'var(--warn-light)', borderRadius: 6, padding: '6px 10px', marginBottom: 8, fontSize: '.82rem', color: 'var(--warn)' }}>
                    <strong>{lbl.context}:</strong> {q.context}
                  </div>
                )}
                {q.passage && (
                  <div style={{ background: 'var(--bg)', borderRadius: 6, padding: '6px 10px', marginBottom: 8, fontSize: '.82rem', color: 'var(--text-secondary)', maxHeight: 120, overflowY: 'auto' }}>
                    <strong>{lbl.passage}:</strong> {q.passage}
                  </div>
                )}
                {/* Image */}
                {q.pageImage && (
                  <div style={{ marginBottom: 8, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)', background: '#f8f9fa' }}>
                    <img
                      src={`${base}${q.pageImage}`}
                      alt={`Câu ${q.id}`}
                      style={{ maxWidth: '100%', maxHeight: 320, objectFit: 'contain', display: 'block', margin: '0 auto' }}
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  </div>
                )}
                {/* Question text */}
                {(q.question || q.sentence) && (
                  <div style={{ fontSize: '.88rem', marginBottom: 8, fontWeight: 500 }}>
                    {q.question ?? q.sentence}
                  </div>
                )}
                {/* Options */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {(Object.entries(q.options) as [OptionKey, string][]).map(([key, text]) => {
                    const isAns    = key === q.answer;
                    const isChosen = key === q.chosen;
                    let bg = 'var(--bg)';
                    let color = 'var(--text)';
                    let border = '1px solid var(--border)';
                    if (isAns)    { bg = '#dcfce7'; border = '1px solid var(--success)'; color = '#15803d'; }
                    if (isChosen && !isAns) { bg = '#fee2e2'; border = '1px solid var(--error)'; color = '#b91c1c'; }
                    return (
                      <div key={key} style={{ display: 'flex', gap: 8, padding: '5px 10px', borderRadius: 6, background: bg, border, color, fontSize: '.83rem' }}>
                        <span style={{ fontWeight: 700, minWidth: 16 }}>{key}</span>
                        <span>{text}</span>
                        {isAns    && <span style={{ marginLeft: 'auto', fontSize: '.75rem' }}>✓ {lbl.correct}</span>}
                        {isChosen && !isAns && <span style={{ marginLeft: 'auto', fontSize: '.75rem' }}>← {lbl.yours}</span>}
                      </div>
                    );
                  })}
                  {!q.chosen && (
                    <div style={{ fontSize: '.78rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '2px 0' }}>
                      ({lbl.skipped})
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
