import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { ListeningData, ListeningExam, ListeningQuestion, OptionKey, ExamKey, ExamAttempt, AttemptQuestion } from '../../types';
import type { AIExplanationData } from '../../utils/aiExplanation';
import { useLang } from '../../i18n/LangContext';
import { loadAttempts, saveAttempt, deleteAttempt, fmtDuration, fmtDate } from '../../utils/historyStorage';
import { useApiKey } from '../../contexts/ApiKeyContext';
import {
  buildCacheKey, loadExplanation, saveExplanation,
  generateListeningExplanation, stripJsonSuffix,
} from '../../utils/aiExplanation';

interface Props {
  listeningData: ListeningData;
}

// ── Timer hook ────────────────────────────────────────────────────────────────
function useCountdown(seconds: number, running: boolean) {
  const [remaining, setRemaining] = useState(seconds);
  useEffect(() => {
    if (!running) return;
    if (remaining <= 0) return;
    const id = setInterval(() => setRemaining(r => r - 1), 1000);
    return () => clearInterval(id);
  }, [running, remaining]);
  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');
  return { remaining, display: `${mm}:${ss}` };
}

// ── Audio player component ────────────────────────────────────────────────────
interface AudioPlayerProps {
  tracks: string[];       // full URLs
  onEnded?: () => void;
}
const AudioPlayer: React.FC<AudioPlayerProps> = ({ tracks, onEnded }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [trackIdx, setTrackIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Reset when tracks change
  useEffect(() => {
    setTrackIdx(0);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, [tracks.join('|')]);

  const handleTimeUpdate = () => {
    if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
  };
  const handleLoadedMetadata = () => {
    if (audioRef.current) setDuration(audioRef.current.duration);
  };
  const handleEnded = () => {
    if (trackIdx < tracks.length - 1) {
      setTrackIdx(i => i + 1);
    } else {
      setIsPlaying(false);
      onEnded?.();
    }
  };
  const handleCanPlay = () => {
    if (isPlaying && audioRef.current) {
      audioRef.current.play().catch(() => {});
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const replay = () => {
    setTrackIdx(0);
    setCurrentTime(0);
    setIsPlaying(true);
    // audio src change triggers canplay → play
  };

  const seek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return;
    const t = Number(e.target.value);
    audioRef.current.currentTime = t;
    setCurrentTime(t);
  };

  const fmt = (s: number) => {
    if (!isFinite(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: '14px 16px',
      marginBottom: 16,
    }}>
      <audio
        ref={audioRef}
        src={tracks[trackIdx]}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onCanPlay={handleCanPlay}
      />

      {/* Track indicator */}
      {tracks.length > 1 && (
        <div style={{ fontSize: '.72rem', color: 'var(--text-secondary)', marginBottom: 8, textAlign: 'center' }}>
          {tracks.map((_, i) => (
            <span key={i} style={{
              display: 'inline-block',
              width: 8, height: 8,
              borderRadius: '50%',
              background: i === trackIdx ? 'var(--accent)' : 'var(--border)',
              margin: '0 3px',
            }} />
          ))}
        </div>
      )}

      {/* Progress */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: '.72rem', color: 'var(--text-secondary)', minWidth: 36 }}>{fmt(currentTime)}</span>
        <input
          type="range"
          min={0}
          max={duration || 1}
          value={currentTime}
          onChange={seek}
          style={{ flex: 1, accentColor: 'var(--accent)', height: 4 }}
        />
        <span style={{ fontSize: '.72rem', color: 'var(--text-secondary)', minWidth: 36, textAlign: 'right' }}>{fmt(duration)}</span>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <button
          onClick={replay}
          style={{
            padding: '8px 14px',
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'transparent',
            cursor: 'pointer',
            fontSize: '.85rem',
            color: 'var(--text-secondary)',
            display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          ↩ Phát lại
        </button>

        <button
          onClick={togglePlay}
          style={{
            width: 52, height: 52,
            borderRadius: '50%',
            border: 'none',
            background: 'var(--accent)',
            color: '#fff',
            fontSize: '1.4rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,.15)',
            transition: 'transform .1s',
          }}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>

        <div style={{ width: 80, textAlign: 'center', fontSize: '.75rem', color: 'var(--text-secondary)' }}>
          {isPlaying ? 'Đang phát' : 'Nhấn ▶'}
        </div>
      </div>
    </div>
  );
};

// ── Flat question builder ─────────────────────────────────────────────────────
interface FlatListeningQ extends ListeningQuestion {
  partTitle: string;
  partType: 'image_choice' | 'text_choice';
  partIdx: number;
}

function buildFlat(exam: ListeningExam): FlatListeningQ[] {
  const flat: FlatListeningQ[] = [];
  exam.parts.forEach((part, pi) => {
    part.questions.forEach(q => {
      flat.push({ ...q, partTitle: part.title, partType: part.type, partIdx: pi });
    });
  });
  return flat;
}

// ── Main component ────────────────────────────────────────────────────────────
type Phase = 'select' | 'exam' | 'result' | 'history' | 'review';

export const ListeningModule: React.FC<Props> = ({ listeningData }) => {
  const { lang } = useLang();
  const { apiKey, hasKey } = useApiKey();
  const [band, setBand] = useState<'A' | 'B'>('A');
  const [examKey, setExamKey] = useState<ExamKey>('exam1');
  const [phase, setPhase] = useState<Phase>('select');
  const [qIdx, setQIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, OptionKey>>({});
  const [timerRunning, setTimerRunning] = useState(false);
  const [reviewAttempt, setReviewAttempt] = useState<ExamAttempt | null>(null);
  const [attempts, setAttempts] = useState<ExamAttempt[]>(() => loadAttempts('listening'));
  // Track elapsed time (exam start timestamp)
  const startTimeRef = useRef<number>(0);

  const exam: ListeningExam = band === 'A'
    ? (listeningData.bandA[examKey] ?? listeningData.bandA.exam1)
    : listeningData.bandB.exam1;

  const flat = useMemo(() => buildFlat(exam), [exam]);
  const total = flat.length;
  const q = flat[qIdx];

  const { remaining, display: timerDisplay } = useCountdown(
    exam.duration,
    timerRunning && phase === 'exam'
  );

  // Auto-submit when time runs out
  useEffect(() => {
    if (remaining === 0 && phase === 'exam') {
      setTimerRunning(false);
      setPhase('result');
    }
  }, [remaining, phase]);

  const base = import.meta.env.BASE_URL;

  function startExam() {
    setAnswers({});
    setQIdx(0);
    setTimerRunning(true);
    startTimeRef.current = Date.now();
    setPhase('exam');
  }

  function pick(key: OptionKey) {
    setAnswers(a => ({ ...a, [q.id]: key }));
  }

  function go(dir: 1 | -1) {
    setQIdx(i => Math.max(0, Math.min(total - 1, i + dir)));
  }

  function submit() {
    setTimerRunning(false);
    const timeTakenSecs = Math.round((Date.now() - startTimeRef.current) / 1000);

    // Build and persist detailed attempt
    const attemptQs: AttemptQuestion[] = flat.map(fq => ({
      id:       fq.id,
      part:     `part${fq.partIdx + 1}`,
      type:     'listening',
      question: fq.question,
      options:  fq.options,
      answer:   fq.answer,
      chosen:   answers[fq.id] ?? null,
      pageImage: fq.page_image ? `${base}${fq.page_image}` : undefined,
    }));
    const attempt: ExamAttempt = {
      id:            String(Date.now()),
      module:        'listening',
      band,
      examKey,
      score:         flat.filter(fq => answers[fq.id] === fq.answer).length,
      total:         flat.length,
      date:          new Date().toISOString(),
      timeTakenSecs,
      questions:     attemptQs,
    };
    saveAttempt(attempt);
    setAttempts(loadAttempts('listening'));
    setReviewAttempt(attempt);

    setPhase('result');
  }

  // ── History phase ────────────────────────────────────────────────────────────
  if (phase === 'history') {
    const lbl = {
      vi: { title: 'Lịch sử thi Nghe', back: '← Quay lại', empty: 'Chưa có lần thi nào được lưu.', delete: 'Xoá', review: '🔍 Xem lại', wrong: 'câu sai', time: 'Thời gian' },
      zh: { title: '聽力考試紀錄', back: '← 返回', empty: '尚無考試紀錄。', delete: '刪除', review: '🔍 回顧', wrong: '題錯誤', time: '用時' },
      en: { title: 'Listening Exam History', back: '← Back', empty: 'No attempts saved yet.', delete: 'Delete', review: '🔍 Review', wrong: 'wrong', time: 'Time' },
    }[lang];

    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setPhase('select')}>{lbl.back}</button>
          <h2 style={{ margin: 0, fontSize: '1rem' }}>{lbl.title}</h2>
        </div>
        {attempts.length === 0 ? (
          <div className="card text-center" style={{ color: 'var(--text-muted)' }}>{lbl.empty}</div>
        ) : attempts.map((a) => {
          const pct = Math.round(a.score / a.total * 100);
          const wrongCt = a.questions.filter(q => q.chosen !== q.answer).length;
          return (
            <div key={a.id} className="card card--compact" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{
                width: 52, height: 52, borderRadius: '50%',
                border: `3px solid ${pct >= 70 ? 'var(--success)' : 'var(--error)'}`,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <span style={{ fontSize: '.85rem', fontWeight: 700, color: pct >= 70 ? 'var(--success)' : 'var(--error)', lineHeight: 1.1 }}>{pct}%</span>
                <span style={{ fontSize: '.65rem', color: 'var(--text-muted)' }}>{a.score}/{a.total}</span>
              </div>
              <div style={{ flex: 1, minWidth: 140 }}>
                <div style={{ fontWeight: 600, fontSize: '.88rem' }}>Band {a.band} · {a.examKey.replace('exam', 'Đề ')}</div>
                <div style={{ fontSize: '.78rem', color: 'var(--text-muted)' }}>
                  {fmtDate(a.date)} · {lbl.time} {fmtDuration(a.timeTakenSecs)} · <span style={{ color: wrongCt > 0 ? 'var(--error)' : 'var(--success)' }}>{wrongCt} {lbl.wrong}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button className="btn btn-primary btn-sm" onClick={() => { setReviewAttempt(a); setPhase('review'); }}>{lbl.review}</button>
                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--error)' }}
                  onClick={() => { if (confirm('Xoá lần thi này?')) { deleteAttempt('listening', a.id); setAttempts(loadAttempts('listening')); } }}>
                  {lbl.delete}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ── Review phase ─────────────────────────────────────────────────────────────
  if (phase === 'review' && reviewAttempt) {
    return <ListeningReview attempt={reviewAttempt} onBack={() => setPhase('history')} base={base} />;
  }

  // ── Select phase ────────────────────────────────────────────────────────────
  if (phase === 'select') {
    const lbl = {
      vi: { title: 'Thi Nghe TOCFL', sub: 'Chọn band và đề thi · Đếm giờ 60 phút', start: 'Bắt đầu →' },
      zh: { title: 'TOCFL 聽力測驗', sub: '選擇程度與試題 · 計時60分鐘', start: '開始考試 →' },
      en: { title: 'TOCFL Listening Exam', sub: 'Choose band & exam · 60-minute timer', start: 'Start →' },
    }[lang];

    const examLabels: Record<ExamKey, Record<string, string>> = {
      exam1: { vi: 'Đề 1', zh: '第1套', en: 'Exam 1' },
      exam2: { vi: 'Đề 2', zh: '第2套', en: 'Exam 2' },
      exam3: { vi: 'Đề 3', zh: '第3套', en: 'Exam 3' },
    };
    const availableBandAExams = Object.keys(listeningData.bandA) as ExamKey[];

    return (
      <div>
        <div className="card" style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🎧</div>
          <h2 style={{ fontSize: '1.1rem', marginBottom: 4 }}>{lbl.title}</h2>
          <p className="text-sm text-muted">{lbl.sub}</p>
        </div>

        {/* Band selector */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
          {(['A', 'B'] as const).map(b => (
            <button
              key={b}
              className={`btn ${band === b ? 'btn-primary' : 'btn-outline'}`}
              style={{ flex: 1, minHeight: 48, fontSize: '.95rem' }}
              onClick={() => setBand(b)}
            >
              Band {b}
            </button>
          ))}
        </div>

        {/* Exam selector (Band A only) */}
        {band === 'A' && availableBandAExams.length > 1 && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            {availableBandAExams.map(ek => (
              <button
                key={ek}
                className={`btn btn-sm ${examKey === ek ? 'btn-primary' : 'btn-outline'}`}
                style={{ flex: 1, minHeight: 40 }}
                onClick={() => setExamKey(ek)}
              >
                {examLabels[ek][lang]}
              </button>
            ))}
          </div>
        )}

        {/* Exam info */}
        <div className="card card--compact mb-12">
          <p className="text-sm text-muted" style={{ marginBottom: 6 }}>
            <strong>{exam.title}</strong>
          </p>
          {exam.parts.map(p => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border)', fontSize: '.82rem' }}>
              <span>{p.title}</span>
              <span className="text-muted">{p.questions.length} câu</span>
            </div>
          ))}
        </div>

        <button className="btn btn-primary" style={{ width: '100%', minHeight: 52, fontSize: '1rem' }} onClick={startExam}>
          {lbl.start}
        </button>

        {attempts.length > 0 && (
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontWeight: 600, fontSize: '.9rem' }}>
                {{vi:'Lịch sử gần đây',zh:'近期紀錄',en:'Recent attempts'}[lang]}
              </span>
              <button className="btn btn-ghost btn-sm" onClick={() => setPhase('history')}>
                📋 {{vi:'Xem tất cả',zh:'查看全部',en:'View all'}[lang]} ({attempts.length})
              </button>
            </div>
            {attempts.slice(0, 3).map((a) => {
              const pct = Math.round(a.score / a.total * 100);
              const wrongCt = a.questions.filter(q => q.chosen !== q.answer).length;
              return (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--bg)', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 120 }}>
                    <div style={{ fontSize: '.82rem' }}>Band {a.band} · {a.examKey.replace('exam', 'Đề ')} · ⏱ {fmtDuration(a.timeTakenSecs)}</div>
                    <div style={{ fontSize: '.75rem', color: 'var(--text-muted)' }}>{fmtDate(a.date)}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontWeight: 700, color: pct >= 70 ? 'var(--success)' : 'var(--error)' }}>{a.score}/{a.total} ({pct}%)</div>
                    <div style={{ fontSize: '.75rem', color: 'var(--text-muted)' }}>{wrongCt} {{vi:'câu sai',zh:'題錯',en:'wrong'}[lang]}</div>
                  </div>
                  <button className="btn btn-outline btn-sm" onClick={() => { setReviewAttempt(a); setPhase('review'); }}>
                    🔍 {{vi:'Xem lại',zh:'回顧',en:'Review'}[lang]}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── Result phase ────────────────────────────────────────────────────────────
  if (phase === 'result') {
    const correct = flat.filter(fq => answers[fq.id] === fq.answer).length;
    const pct = Math.round(correct / total * 100);
    const lbl = {
      vi: { title: 'Kết quả', score: 'Điểm', back: '← Làm lại', excellent: 'Xuất sắc!', good: 'Khá tốt!', keep: 'Cần ôn thêm!', detail: 'Chi tiết' },
      zh: { title: '考試結果', score: '成績', back: '← 重考', excellent: '非常優秀！', good: '很不錯！', keep: '需要加油！', detail: '詳細' },
      en: { title: 'Result', score: 'Score', back: '← Retry', excellent: 'Excellent!', good: 'Good job!', keep: 'Keep studying!', detail: 'Details' },
    }[lang];

    const emoji = pct >= 80 ? '🏆' : pct >= 60 ? '👍' : '📖';
    const msg = pct >= 80 ? lbl.excellent : pct >= 60 ? lbl.good : lbl.keep;

    // Per-part stats
    const partStats = exam.parts.map(p => {
      const pqs = flat.filter(fq => fq.partIdx === exam.parts.indexOf(p));
      const c = pqs.filter(fq => answers[fq.id] === fq.answer).length;
      return { title: p.title, correct: c, total: pqs.length };
    });

    return (
      <div>
        <div className="card" style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>{emoji}</div>
          <h2 style={{ fontSize: '1.1rem', marginBottom: 4 }}>{msg}</h2>
          <div style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--accent)', margin: '8px 0' }}>
            {correct} / {total}
          </div>
          <div style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>{pct}%</div>
        </div>

        <div className="card card--compact mb-12">
          <p style={{ fontWeight: 600, marginBottom: 8, fontSize: '.9rem' }}>{lbl.detail}</p>
          {partStats.map((ps, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border)', fontSize: '.82rem' }}>
              <span style={{ flex: 1, paddingRight: 8 }}>{ps.title}</span>
              <span style={{ fontWeight: 600, color: ps.correct === ps.total ? 'var(--success)' : 'var(--text)' }}>
                {ps.correct}/{ps.total}
              </span>
            </div>
          ))}
        </div>

        {/* Wrong answers */}
        <div className="card card--compact mb-12">
          <p style={{ fontWeight: 600, marginBottom: 8, fontSize: '.9rem' }}>Câu sai</p>
          {flat.filter(fq => answers[fq.id] !== fq.answer).length === 0 ? (
            <p className="text-sm text-muted">🎉 Không có câu nào sai!</p>
          ) : (
            flat.filter(fq => answers[fq.id] !== fq.answer).map(fq => (
              <div key={fq.id} style={{ padding: '4px 0', borderBottom: '1px solid var(--border)', fontSize: '.82rem' }}>
                <span style={{ fontWeight: 600 }}>Câu {fq.id}</span>
                {' · '}
                <span style={{ color: 'var(--error)' }}>Bạn: {answers[fq.id] ?? '–'}</span>
                {' · '}
                <span style={{ color: 'var(--success)' }}>Đúng: {fq.answer}</span>
              </div>
            ))
          )}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline" style={{ flex: 1, minHeight: 48 }} onClick={() => { setPhase('select'); }}>
            {lbl.back}
          </button>
          {reviewAttempt && (
            <button className="btn btn-primary" style={{ flex: 1, minHeight: 48 }} onClick={() => setPhase('review')}>
              🔍 {{vi:'Xem lại chi tiết',zh:'回顧詳情',en:'Review details'}[lang]}
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Exam phase ──────────────────────────────────────────────────────────────
  const answeredCt = Object.keys(answers).length;
  const chosen = answers[q.id];
  const optKeys = Object.keys(q.options) as OptionKey[];

  const timerColor = remaining < 300 ? 'var(--error)' : remaining < 600 ? '#f59e0b' : 'var(--text)';

  const lbl = {
    vi: { prev: '← Trước', next: 'Sau →', submit: 'Nộp bài', answered: 'đã trả lời', question: 'Câu' },
    zh: { prev: '← 上題', next: '下題 →', submit: '交卷', answered: '已作答', question: '第' },
    en: { prev: '← Prev', next: 'Next →', submit: 'Submit', answered: 'answered', question: 'Q' },
  }[lang];

  // Full audio URL
  const audioUrls = q.audio.map(a => `${base}${a}`);

  return (
    <div>
      {/* Sticky exam header */}
      <div style={{
        position: 'sticky',
        top: 52,
        zIndex: 90,
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        padding: '8px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
      }}>
        <div style={{ fontSize: '.78rem', color: 'var(--text-secondary)' }}>
          {answeredCt}/{total} {lbl.answered}
        </div>
        <div style={{
          fontSize: '.85rem',
          fontWeight: 700,
          color: timerColor,
          fontVariantNumeric: 'tabular-nums',
        }}>
          ⏱ {timerDisplay}
        </div>
        <button
          className="btn btn-primary btn-sm"
          style={{ fontSize: '.78rem', padding: '4px 10px' }}
          onClick={submit}
        >{lbl.submit}</button>
      </div>

      {/* Part label */}
      <div style={{ fontSize: '.75rem', color: 'var(--text-secondary)', marginBottom: 6, textAlign: 'center' }}>
        {q.partTitle}
      </div>

      {/* Audio player */}
      <AudioPlayer key={q.audio.join('|')} tracks={audioUrls} />

      {/* Page image (image_choice) */}
      {q.page_image && q.partType === 'image_choice' && (
        <div style={{ marginBottom: 14, textAlign: 'center' }}>
          <img
            src={`${base}${q.page_image}`}
            alt={`Câu ${q.id}`}
            style={{ maxWidth: '100%', borderRadius: 8, border: '1px solid var(--border)' }}
            loading="lazy"
          />
        </div>
      )}

      {/* Question number + text */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
          <span className={`badge badge-${band === 'A' ? 'A1' : 'B1'}`} style={{ fontSize: '.72rem', flexShrink: 0 }}>
            {lbl.question} {q.id}
          </span>
          {q.question && (
            <span style={{ fontSize: '.92rem', lineHeight: 1.5 }}>{q.question}</span>
          )}
          {!q.question && q.partType === 'text_choice' && (
            <span style={{ fontSize: '.85rem', color: 'var(--text-secondary)' }}>請聽錄音選出正確答案</span>
          )}
        </div>
      </div>

      {/* Options */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {optKeys.map(key => {
          const val = q.options[key] ?? '';
          const isChosen = chosen === key;
          const isImageLabel = q.partType === 'image_choice' && (val === `(${key})` || val === key || val === '');

          return (
            <button
              key={key}
              onClick={() => pick(key)}
              className={`option-btn ${isChosen ? 'selected' : ''}`}
              style={{
                minHeight: q.partType === 'image_choice' ? 48 : 52,
                justifyContent: 'flex-start',
                fontSize: q.partType === 'image_choice' ? '1rem' : '.9rem',
                fontWeight: isChosen ? 700 : 500,
                background: isChosen ? 'var(--accent-light)' : 'var(--surface)',
                borderColor: isChosen ? 'var(--accent)' : 'var(--border)',
                color: isChosen ? 'var(--accent)' : 'var(--text)',
                transition: 'all .15s',
              }}
            >
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 28, height: 28,
                borderRadius: '50%',
                background: isChosen ? 'var(--accent)' : 'var(--border)',
                color: isChosen ? '#fff' : 'var(--text)',
                fontWeight: 700,
                fontSize: '.8rem',
                flexShrink: 0,
                marginRight: 10,
              }}>{key}</span>
              {isImageLabel ? `選項 ${key}` : val}
            </button>
          );
        })}
      </div>

      {/* AI Drawer */}
      <ListeningAIDrawer
        apiKey={apiKey}
        hasKey={hasKey}
        cacheKey={buildCacheKey('listening', band, examKey, q.id)}
        questionId={q.id}
        question={q.question}
        options={q.options}
        answer={q.answer}
        audioPaths={q.audio}
        audioBaseUrl={base}
        pageImageUrl={q.page_image && q.partType === 'image_choice' ? `${base}${q.page_image}` : undefined}
      />

      {/* Q-grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(10, 1fr)',
        gap: 4,
        marginBottom: 12,
      }}>
        {flat.map((fq, i) => {
          const isAnswered = fq.id in answers;
          const isCurrent = i === qIdx;
          return (
            <button
              key={fq.id}
              onClick={() => setQIdx(i)}
              style={{
                aspectRatio: '1',
                borderRadius: 4,
                border: isCurrent ? '2px solid var(--accent)' : '1px solid var(--border)',
                background: isCurrent ? 'var(--accent)' : isAnswered ? 'var(--accent-light)' : 'transparent',
                color: isCurrent ? '#fff' : isAnswered ? 'var(--accent)' : 'var(--text-secondary)',
                fontSize: '.68rem',
                fontWeight: isCurrent ? 700 : 500,
                cursor: 'pointer',
                padding: 0,
              }}
            >
              {fq.id}
            </button>
          );
        })}
      </div>

      {/* Prev / Next */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          className="btn btn-outline"
          style={{ flex: 1, minHeight: 48 }}
          onClick={() => go(-1)}
          disabled={qIdx === 0}
        >{lbl.prev}</button>
        <button
          className="btn btn-outline"
          style={{ flex: 1, minHeight: 48 }}
          onClick={() => go(1)}
          disabled={qIdx === total - 1}
        >{lbl.next}</button>
      </div>
    </div>
  );
};

// ── Listening AI Drawer ────────────────────────────────────────────────────────

interface ListeningAIDrawerProps {
  apiKey:        string;
  hasKey:        boolean;
  cacheKey:      string;
  questionId:    number;
  question?:     string;
  options:       Partial<Record<OptionKey, string>>;
  answer:        OptionKey;
  audioPaths:    string[];
  audioBaseUrl:  string;
  pageImageUrl?: string;
}

const ListeningAIDrawer: React.FC<ListeningAIDrawerProps> = ({
  apiKey, hasKey, cacheKey,
  questionId, question, options, answer,
  audioPaths, audioBaseUrl, pageImageUrl,
}) => {
  const [status,     setStatus    ] = useState<'idle' | 'loading' | 'done'>('idle');
  const [step,       setStep      ] = useState<'transcribing' | 'analyzing' | null>(null);
  const [expanded,   setExpanded  ] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [data,       setData      ] = useState<AIExplanationData | null>(() => loadExplanation(cacheKey));
  const prevKey = useRef(cacheKey);

  // Reload cache when question changes
  useEffect(() => {
    if (prevKey.current !== cacheKey) {
      prevKey.current = cacheKey;
      const cached = loadExplanation(cacheKey);
      setData(cached);
      setStatus(cached ? 'done' : 'idle');
      setExpanded(false);
      setStreamText('');
      setStep(null);
    }
  }, [cacheKey]);

  const handleAsk = useCallback(async () => {
    if (!hasKey || status === 'loading') return;
    setStatus('loading');
    setStreamText('');
    setExpanded(true);

    try {
      const result = await generateListeningExplanation({
        apiKey,
        questionId,
        audioPaths,
        audioBaseUrl,
        question,
        options,
        answer,
        pageImageUrl,
        onToken: (token) => setStreamText(prev => prev + token),
        onProgress: (s) => setStep(s),
      });
      saveExplanation(cacheKey, result);
      setData(result);
      setStatus('done');
      setStreamText('');
      setStep(null);
    } catch (err) {
      console.error('[ListeningAIDrawer]', err);
      setStatus('idle');
      setExpanded(false);
      setStep(null);
    }
  }, [apiKey, hasKey, status, cacheKey, questionId, audioPaths, audioBaseUrl, question, options, answer, pageImageUrl]);

  if (!hasKey) {
    return (
      <div style={{
        marginBottom: 12, padding: '8px 12px', borderRadius: 8,
        background: 'var(--bg)', border: '1px dashed var(--border)',
        fontSize: '.78rem', color: 'var(--text-muted)', textAlign: 'center',
      }}>
        🤖 Nhập OpenAI API key để dùng AI giải thích câu này
      </div>
    );
  }

  const hasCached = !!data;
  const stepLabel = step === 'transcribing' ? '🎙 Đang chép âm thanh...' : '🧠 Đang phân tích...';

  return (
    <div style={{ marginBottom: 12 }}>
      {/* Trigger row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: expanded ? 8 : 0 }}>
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
            {stepLabel}
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

          {/* ── Explanation box ── */}
          <div style={{
            padding: '12px 14px', borderRadius: 8,
            background: 'var(--bg)', border: '1px solid var(--border)',
            fontSize: '.83rem', lineHeight: 1.75,
          }}>
            {status === 'loading' && (
              <div style={{ color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                {stripJsonSuffix(streamText) || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{stepLabel}</span>}
                {streamText && <span className="iv-typing-cursor">▍</span>}
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

// ── ListeningReview — drill-down review of a saved listening attempt ───────────
const ListeningReview: React.FC<{
  attempt: ExamAttempt;
  onBack: () => void;
  base: string;
}> = ({ attempt, onBack, base }) => {
  const { lang } = useLang();
  const [filter,     setFilter    ] = useState<'all' | 'wrong' | 'correct'>('all');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const lbl = {
    vi: { back: '← Lịch sử', filterAll: 'Tất cả', filterWrong: '✗ Sai', filterCorrect: '✓ Đúng', correct: 'Đáp án đúng', yours: 'Bạn chọn', skipped: 'Bỏ qua', noQ: 'Không có câu nào.' },
    zh: { back: '← 紀錄', filterAll: '全部', filterWrong: '✗ 錯誤', filterCorrect: '✓ 正確', correct: '正確答案', yours: '你選擇', skipped: '未作答', noQ: '沒有題目。' },
    en: { back: '← History', filterAll: 'All', filterWrong: '✗ Wrong', filterCorrect: '✓ Correct', correct: 'Correct', yours: 'You chose', skipped: 'Skipped', noQ: 'No questions.' },
  }[lang];

  const pct     = Math.round(attempt.score / attempt.total * 100);
  const wrongCt = attempt.questions.filter(q => q.chosen !== q.answer).length;

  const displayed = attempt.questions.filter(q => {
    if (filter === 'wrong')   return q.chosen !== q.answer;
    if (filter === 'correct') return q.chosen === q.answer;
    return true;
  });

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <button className="btn btn-ghost btn-sm" onClick={onBack}>{lbl.back}</button>
        <span style={{ fontSize: '.85rem', color: 'var(--text-muted)' }}>
          🎧 Band {attempt.band} · {attempt.examKey.replace('exam', 'Đề ')} · {fmtDate(attempt.date)} · ⏱ {fmtDuration(attempt.timeTakenSecs)}
        </span>
      </div>

      {/* Score summary */}
      <div className="card card--compact" style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10, flexWrap: 'wrap' }}>
        <div style={{
          width: 60, height: 60, borderRadius: '50%', flexShrink: 0,
          border: `4px solid ${pct >= 70 ? 'var(--success)' : 'var(--error)'}`,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: '1rem', fontWeight: 700, color: pct >= 70 ? 'var(--success)' : 'var(--error)' }}>{pct}%</span>
          <span style={{ fontSize: '.65rem', color: 'var(--text-muted)' }}>{attempt.score}/{attempt.total}</span>
        </div>
        <div style={{ flex: 1, fontSize: '.85rem' }}>
          <div style={{ fontWeight: 600 }}>{attempt.score} câu đúng / {attempt.total} câu</div>
          <div style={{ color: 'var(--text-muted)' }}>{wrongCt} câu sai · ⏱ {fmtDuration(attempt.timeTakenSecs)}</div>
        </div>
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        {(['all', 'wrong', 'correct'] as const).map(f => (
          <button key={f} className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-outline'}`} onClick={() => setFilter(f)}>
            {f === 'all' ? lbl.filterAll : f === 'wrong' ? lbl.filterWrong : lbl.filterCorrect}
            {f === 'wrong'   && wrongCt > 0     && <span style={{ marginLeft: 4, fontSize: '.75rem' }}>{wrongCt}</span>}
            {f === 'correct' && attempt.score > 0 && <span style={{ marginLeft: 4, fontSize: '.75rem' }}>{attempt.score}</span>}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 700, fontSize: '.9rem', color: isCorrect ? 'var(--success)' : q.chosen ? 'var(--error)' : 'var(--text-muted)', minWidth: 16 }}>
                {isCorrect ? '✓' : '✗'}
              </span>
              <span style={{ flex: 1, fontSize: '.85rem', fontWeight: 600 }}>
                🎧 Câu {q.id}
              </span>
              <div style={{ display: 'flex', gap: 6, fontSize: '.8rem', flexShrink: 0 }}>
                <span style={{ color: 'var(--success)', fontWeight: 700 }}>{q.answer}</span>
                {!isCorrect && q.chosen && <span style={{ color: 'var(--error)' }}>({q.chosen})</span>}
                {!isCorrect && !q.chosen && <span style={{ color: 'var(--text-muted)' }}>–</span>}
              </div>
              <span style={{ fontSize: '.75rem', color: 'var(--text-muted)' }}>{isExpanded ? '▲' : '▼'}</span>
            </div>

            {isExpanded && (
              <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                {/* Page image if stored */}
                {q.pageImage && (
                  <div style={{ marginBottom: 8, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)', background: '#f8f9fa' }}>
                    <img
                      src={q.pageImage.startsWith('http') ? q.pageImage : `${base}${q.pageImage}`}
                      alt={`Câu ${q.id}`}
                      style={{ maxWidth: '100%', maxHeight: 280, objectFit: 'contain', display: 'block', margin: '0 auto' }}
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  </div>
                )}
                {/* Question text */}
                {q.question && <div style={{ fontSize: '.88rem', marginBottom: 8, fontWeight: 500 }}>{q.question}</div>}
                {/* Options */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {(Object.entries(q.options) as [OptionKey, string][]).map(([key, text]) => {
                    const isAns    = key === q.answer;
                    const isChosen = key === q.chosen;
                    let bg = 'var(--bg)'; let color = 'var(--text)'; let border = '1px solid var(--border)';
                    if (isAns)    { bg = '#dcfce7'; border = '1px solid var(--success)'; color = '#15803d'; }
                    if (isChosen && !isAns) { bg = '#fee2e2'; border = '1px solid var(--error)'; color = '#b91c1c'; }
                    return (
                      <div key={key} style={{ display: 'flex', gap: 8, padding: '5px 10px', borderRadius: 6, background: bg, border, color, fontSize: '.83rem' }}>
                        <span style={{ fontWeight: 700, minWidth: 16 }}>{key}</span>
                        <span>{text || `選項 ${key}`}</span>
                        {isAns    && <span style={{ marginLeft: 'auto', fontSize: '.75rem' }}>✓ {lbl.correct}</span>}
                        {isChosen && !isAns && <span style={{ marginLeft: 'auto', fontSize: '.75rem' }}>← {lbl.yours}</span>}
                      </div>
                    );
                  })}
                  {!q.chosen && <div style={{ fontSize: '.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>({lbl.skipped})</div>}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
