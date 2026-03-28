import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { ListeningData, ListeningExam, ListeningQuestion, OptionKey } from '../../types';
import { useLang } from '../../i18n/LangContext';

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
type Phase = 'select' | 'exam' | 'result';

export const ListeningModule: React.FC<Props> = ({ listeningData }) => {
  const { lang } = useLang();
  const [band, setBand] = useState<'A' | 'B'>('A');
  const [phase, setPhase] = useState<Phase>('select');
  const [qIdx, setQIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, OptionKey>>({});
  const [timerRunning, setTimerRunning] = useState(false);

  const exam: ListeningExam = band === 'A'
    ? listeningData.bandA.exam1
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
    setPhase('result');
  }

  // ── Select phase ────────────────────────────────────────────────────────────
  if (phase === 'select') {
    const lbl = {
      vi: { title: 'Thi Nghe TOCFL', sub: 'Chọn band và bắt đầu · Đếm giờ 60 phút', start: 'Bắt đầu →', bandA: 'Band A · 50 câu', bandB: 'Band B · 50 câu' },
      zh: { title: 'TOCFL 聽力測驗', sub: '選擇程度並開始 · 計時60分鐘', start: '開始考試 →', bandA: 'A級 · 50題', bandB: 'B級 · 50題' },
      en: { title: 'TOCFL Listening Exam', sub: 'Choose band and start · 60-minute timer', start: 'Start →', bandA: 'Band A · 50 q', bandB: 'Band B · 50 q' },
    }[lang];

    return (
      <div>
        <div className="card" style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🎧</div>
          <h2 style={{ fontSize: '1.1rem', marginBottom: 4 }}>{lbl.title}</h2>
          <p className="text-sm text-muted">{lbl.sub}</p>
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          {(['A', 'B'] as const).map(b => (
            <button
              key={b}
              className={`btn ${band === b ? 'btn-primary' : 'btn-outline'}`}
              style={{ flex: 1, minHeight: 52, fontSize: '.95rem' }}
              onClick={() => setBand(b)}
            >
              {b === 'A' ? lbl.bandA : lbl.bandB}
            </button>
          ))}
        </div>

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

        <button className="btn btn-outline" style={{ width: '100%', minHeight: 48 }} onClick={() => { setPhase('select'); }}>
          {lbl.back}
        </button>
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
