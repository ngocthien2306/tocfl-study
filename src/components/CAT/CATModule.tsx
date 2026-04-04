/**
 * CATModule — TOCFL Computer Adaptive Testing
 *
 * Modes:
 *   reading   → questions from exam_data.json  (Reading parts 1–5)
 *   listening → questions from listening_data.json (Listening parts 1–4)
 *
 * All UI text driven by useLang() — respects VI / 中 / EN toggle.
 */

import React, {
  useState, useEffect, useRef, useMemo, useCallback,
} from 'react';
import type { ExamData, ListeningData } from '../../types';
import { useLang } from '../../i18n/LangContext';
import {
  buildCATPool,
  buildListeningCATPool,
  selectNextQuestion,
  updateTheta,
  thetaToScore,
  scoreToLevel,
  thetaToLevel,
  TOCFL_LEVELS,
  expectedTimeSecs,
  type CATItem,
  type CATResponse,
} from '../../utils/catAlgorithm';

// ─── Constants ─────────────────────────────────────────────────────────────────

const TOTAL_QUESTIONS = 35;
const INITIAL_THETA   = 0.0;
const FLASH_MS        = 700;

type CATMode = 'reading' | 'listening';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtSecs(s: number) {
  const m   = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

function DifficultyDots({ b }: { b: number }) {
  const filled = Math.min(5, Math.round(b));
  return (
    <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} style={{
          width: 7, height: 7, borderRadius: '50%',
          background: i <= filled ? 'var(--primary)' : 'var(--border)',
          transition: 'background .3s',
        }} />
      ))}
    </div>
  );
}

// ─── Audio Player ─────────────────────────────────────────────────────────────

interface AudioPlayerProps {
  src:          string;
  base:         string;
  labelPlaying: string;
  labelPaused:  string;
  labelStart:   string;
  labelReplay:  string;
  onFirstPlay?: () => void;
}

function AudioPlayer({
  src, base, labelPlaying, labelPaused, labelStart, labelReplay, onFirstPlay,
}: AudioPlayerProps) {
  const audioRef   = useRef<HTMLAudioElement>(null);
  const [playing,  setPlaying ] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [played,   setPlayed  ] = useState(false);
  const onFirstPlayRef = useRef(onFirstPlay);
  onFirstPlayRef.current = onFirstPlay;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.load();
    setProgress(0);
    setPlaying(false);
    setPlayed(false);
    audio.play().then(() => {
      setPlaying(true);
      if (!played) { setPlayed(true); onFirstPlayRef.current?.(); }
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause(); setPlaying(false);
    } else {
      audio.play().then(() => {
        setPlaying(true);
        if (!played) { setPlayed(true); onFirstPlayRef.current?.(); }
      }).catch(() => {});
    }
  };

  const replay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    audio.play().then(() => setPlaying(true)).catch(() => {});
  };

  const statusLabel = playing ? labelPlaying : played ? labelPaused : labelStart;

  return (
    <div style={{
      background: 'var(--surface)', border: '1.5px solid var(--primary)',
      borderRadius: 10, padding: '10px 14px', marginBottom: 12,
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <audio
        ref={audioRef}
        src={`${base}${src}`}
        onTimeUpdate={e => {
          const a = e.currentTarget;
          setProgress(a.duration ? a.currentTime / a.duration : 0);
        }}
        onDurationChange={e => setDuration(e.currentTarget.duration)}
        onEnded={() => setPlaying(false)}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={toggle} style={{
          width: 36, height: 36, borderRadius: '50%', border: 'none',
          background: 'var(--primary)', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', flexShrink: 0, fontSize: '1rem',
        }}>
          {playing ? '⏸' : '▶'}
        </button>

        <div
          onClick={e => {
            const rect  = e.currentTarget.getBoundingClientRect();
            const ratio = (e.clientX - rect.left) / rect.width;
            const audio = audioRef.current;
            if (audio?.duration) audio.currentTime = ratio * audio.duration;
          }}
          style={{
            flex: 1, height: 6, background: 'var(--border)', borderRadius: 3,
            cursor: 'pointer', overflow: 'hidden',
          }}
        >
          <div style={{
            height: '100%', width: `${progress * 100}%`,
            background: 'var(--primary)', borderRadius: 3,
            transition: 'width .1s linear',
          }} />
        </div>

        <span style={{
          fontSize: '.72rem', color: 'var(--text-secondary)',
          minWidth: 32, textAlign: 'right', fontVariantNumeric: 'tabular-nums',
        }}>
          {duration > 0 ? `${Math.round(duration)}s` : '--'}
        </span>

        <button onClick={replay} title={labelReplay} style={{
          padding: '3px 8px', borderRadius: 6, border: '1px solid var(--border)',
          background: 'var(--card)', color: 'var(--text-secondary)',
          cursor: 'pointer', fontSize: '.72rem',
        }}>
          ↺
        </button>
      </div>

      <div style={{ fontSize: '.72rem', color: 'var(--primary)', fontWeight: 600 }}>
        {statusLabel}
      </div>
    </div>
  );
}

// ─── Theta chart ──────────────────────────────────────────────────────────────

function ThetaChart({ responses }: { responses: CATResponse[] }) {
  if (responses.length < 2) return null;

  const W = 560, H = 130, PAD = { t: 14, r: 20, b: 30, l: 36 };
  const iW = W - PAD.l - PAD.r;
  const iH = H - PAD.t - PAD.b;
  const MIN_T = -3, MAX_T = 3;

  const toX = (i: number) => PAD.l + (i / Math.max(1, responses.length - 1)) * iW;
  const toY = (t: number) => PAD.t + ((MAX_T - t) / (MAX_T - MIN_T)) * iH;

  const bands = [
    { min: -0.83, max: 0.22, color: '#10B981', label: 'A1' },
    { min: 0.22,  max: 0.67, color: '#3B82F6', label: 'A2' },
    { min: 0.67,  max: 1.56, color: '#8B5CF6', label: 'B1' },
    { min: 1.56,  max: 2.0,  color: '#F59E0B', label: 'B2' },
    { min: 2.0,   max: 2.89, color: '#EF4444', label: 'C1' },
    { min: 2.89,  max: 3.0,  color: '#EC4899', label: 'C2' },
  ];

  const polyPoints = responses.map((r, i) => `${toX(i)},${toY(r.thetaAfter)}`).join(' ');
  const areaPoints = [
    `${toX(0)},${toY(MIN_T)}`,
    ...responses.map((r, i) => `${toX(i)},${toY(r.thetaAfter)}`),
    `${toX(responses.length - 1)},${toY(MIN_T)}`,
  ].join(' ');

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', maxWidth: W }}>
      {bands.map(band => {
        const y1 = toY(Math.min(MAX_T, band.max));
        const y2 = toY(Math.max(MIN_T, band.min));
        if (y2 <= PAD.t || y1 >= PAD.t + iH) return null;
        return <rect key={band.label} x={PAD.l} y={Math.max(PAD.t, y1)}
          width={iW} height={Math.min(iH, y2 - y1)} fill={band.color} fillOpacity={0.08} />;
      })}
      {[-0.83, 0.22, 0.67, 1.56, 2.0, 2.89].map(t => (
        <line key={t} x1={PAD.l} y1={toY(t)} x2={PAD.l + iW} y2={toY(t)}
          stroke="var(--border)" strokeWidth={0.8} strokeDasharray="4,3" />
      ))}
      <polygon points={areaPoints} fill="var(--primary)" fillOpacity={0.08} />
      <polyline points={polyPoints} fill="none" stroke="var(--primary)" strokeWidth={2}
        strokeLinejoin="round" strokeLinecap="round" />
      {responses.map((r, i) => (
        <circle key={i} cx={toX(i)} cy={toY(r.thetaAfter)} r={4}
          fill={r.correct ? '#10B981' : '#EF4444'} stroke="white" strokeWidth={1.5} />
      ))}
      {[-2, -1, 0, 1, 2].map(t => (
        <text key={t} x={PAD.l - 6} y={toY(t) + 4}
          textAnchor="end" fontSize={9} fill="var(--text-secondary)">
          {t > 0 ? `+${t}` : t}
        </text>
      ))}
      {bands.map(band => {
        const mid = (band.min + band.max) / 2;
        if (mid < MIN_T || mid > MAX_T) return null;
        return <text key={band.label} x={PAD.l + iW + 4} y={toY(mid) + 4}
          fontSize={8} fill={band.color} fontWeight={600}>{band.label}</text>;
      })}
      {[1, Math.round(responses.length / 2), responses.length].map((n, i) => (
        <text key={i} x={toX(n - 1)} y={H - 6}
          textAnchor="middle" fontSize={9} fill="var(--text-secondary)">{n}</text>
      ))}
    </svg>
  );
}

// ─── Question view ────────────────────────────────────────────────────────────

interface QuestionProps {
  item:             CATItem;
  selected:         string | null;
  onSelect:         (opt: string) => void;
  base:             string;
  flash:            'correct' | 'wrong' | null;
  qNum:             number;
  elapsedSecs:      number;
  qLabel:           string;
  diffLabel:        string;
  seeImageLabel:    string;
  audioLabels:      { playing: string; paused: string; start: string; replay: string };
  onFirstAudioPlay?: () => void;
}

function QuestionView({
  item, selected, onSelect, base, flash, qNum, elapsedSecs,
  qLabel, diffLabel, seeImageLabel, audioLabels, onFirstAudioPlay,
}: QuestionProps) {
  const opts    = Object.entries(item.options);
  const expTime = expectedTimeSecs(item.difficulty, item.isListening);
  const ratio   = elapsedSecs / expTime;
  const timerColor = ratio < 0.7 ? '#10B981' : ratio < 1.5 ? '#F59E0B' : '#EF4444';

  return (
    <div style={{ animation: 'fadeIn .25s ease' }}>
      {/* Question meta */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{
          background: 'var(--primary)', color: '#fff',
          borderRadius: 6, padding: '2px 10px', fontSize: '.78rem', fontWeight: 700,
        }}>
          {qLabel} {qNum}
        </span>
        <span style={{ fontSize: '.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
          {diffLabel}: <strong style={{ color: 'var(--text)' }}>{item.difficulty.toFixed(1)}</strong>
          &nbsp;·&nbsp;
          <DifficultyDots b={item.difficulty} />
        </span>
        <span style={{
          marginLeft: 'auto', fontVariantNumeric: 'tabular-nums',
          fontSize: '.82rem', fontWeight: 600, color: timerColor,
        }}>
          ⏱ {fmtSecs(elapsedSecs)}
        </span>
      </div>

      {/* Audio player (listening) */}
      {item.isListening && item.audio && item.audio.length > 0 && (
        <AudioPlayer
          src={item.audio[0]}
          base={base}
          labelPlaying={audioLabels.playing}
          labelPaused={audioLabels.paused}
          labelStart={audioLabels.start}
          labelReplay={audioLabels.replay}
          onFirstPlay={onFirstAudioPlay}
        />
      )}

      {/* Page image */}
      {item.pageImage && (
        <div style={{ marginBottom: 12, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
          <img
            src={`${base}${item.pageImage}`}
            alt={`Q${item.id}`}
            style={{ width: '100%', display: 'block', maxHeight: 300, objectFit: 'contain' }}
          />
          <div style={{
            background: 'var(--primary)', color: '#fff',
            textAlign: 'center', fontSize: '.78rem', padding: '4px 0',
          }}>
            {seeImageLabel} <strong>{item.id}</strong>
          </div>
        </div>
      )}

      {/* Context (reading part3) */}
      {item.context && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 8, padding: '8px 12px', marginBottom: 10,
          fontSize: '.82rem', color: 'var(--text-secondary)', fontStyle: 'italic',
        }}>
          {item.context}
        </div>
      )}

      {/* Passage (reading part4/5) */}
      {item.passage && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 8, padding: '12px 14px', marginBottom: 12,
          fontSize: '.9rem', lineHeight: 1.8, color: 'var(--text)',
          maxHeight: 200, overflowY: 'auto',
        }}>
          {item.part === 'part4'
            ? <PassageWithBlank passage={item.passage} blankId={item.id} />
            : <span>{item.passage}</span>
          }
        </div>
      )}

      {/* Question text */}
      {(item.sentence || item.question) && (
        <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)', marginBottom: 14, lineHeight: 1.7 }}>
          {item.sentence ?? item.question}
        </div>
      )}

      {/* Flash overlay */}
      {flash && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: flash === 'correct' ? 'rgba(16,185,129,.12)' : 'rgba(239,68,68,.12)',
          borderRadius: 12, animation: 'fadeIn .1s ease',
        }}>
          <span style={{ fontSize: '3.5rem', filter: 'drop-shadow(0 2px 6px rgba(0,0,0,.15))' }}>
            {flash === 'correct' ? '✓' : '✗'}
          </span>
        </div>
      )}

      {/* Options */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {opts.map(([key, text]) => {
          const isSelected = selected === key;
          const isCorrect  = flash && key === item.answer;
          const isWrong    = flash && isSelected && key !== item.answer;
          return (
            <button key={key} disabled={!!flash} onClick={() => onSelect(key)} style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              padding: '10px 14px', borderRadius: 8, cursor: flash ? 'default' : 'pointer',
              border: '1.5px solid',
              borderColor: isCorrect ? '#10B981' : isWrong ? '#EF4444'
                : isSelected ? 'var(--primary)' : 'var(--border)',
              background: isCorrect ? 'rgba(16,185,129,.1)' : isWrong ? 'rgba(239,68,68,.08)'
                : isSelected ? 'rgba(var(--primary-rgb),.08)' : 'var(--card)',
              color: 'var(--text)', textAlign: 'left', fontSize: '.92rem', lineHeight: 1.5,
              transition: 'all .15s',
            }}>
              <span style={{
                minWidth: 24, height: 24, borderRadius: 6,
                background: isSelected || isCorrect ? 'var(--primary)' : 'var(--border)',
                color: isSelected || isCorrect ? '#fff' : 'var(--text-secondary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '.78rem', fontWeight: 700, flexShrink: 0, marginTop: 1,
              }}>
                {key}
              </span>
              <span style={{ flex: 1 }}>{text}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PassageWithBlank({ passage, blankId }: { passage: string; blankId: number }) {
  const regex = new RegExp(`[（(]?${blankId}[）)]?`, 'g');
  const parts = passage.split(regex);
  return (
    <>
      {parts.map((part, i) => (
        <React.Fragment key={i}>
          {part}
          {i < parts.length - 1 && (
            <span style={{
              background: 'var(--primary)', color: '#fff',
              borderRadius: 4, padding: '0 6px', margin: '0 2px',
              fontSize: '.82rem', fontWeight: 700,
            }}>
              （{blankId}）
            </span>
          )}
        </React.Fragment>
      ))}
    </>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

interface Props {
  examData:       ExamData;
  listeningData?: ListeningData;
}

type Phase = 'intro' | 'testing' | 'result';

export const CATModule: React.FC<Props> = ({ examData, listeningData }) => {
  const base        = import.meta.env.BASE_URL;
  const { lang, t } = useLang();

  // ── Build pools once ───────────────────────────────────────────────────────
  const readingPool   = useMemo(() => buildCATPool(examData), [examData]);
  const listeningPool = useMemo(() =>
    listeningData ? buildListeningCATPool(listeningData) : [],
  [listeningData]);

  // ── State ──────────────────────────────────────────────────────────────────
  const [phase,       setPhase      ] = useState<Phase>('intro');
  const [mode,        setMode       ] = useState<CATMode>('reading');
  const [theta,       setTheta      ] = useState(INITIAL_THETA);
  const [responses,   setResponses  ] = useState<CATResponse[]>([]);
  const [usedUids,    setUsedUids   ] = useState<Set<string>>(new Set());
  const [currentItem, setCurrentItem] = useState<CATItem | null>(null);
  const [selected,    setSelected   ] = useState<string | null>(null);
  const [flash,       setFlash      ] = useState<'correct' | 'wrong' | null>(null);
  const [elapsedSecs, setElapsedSecs] = useState(0);
  const [totalSecs,   setTotalSecs  ] = useState(0);

  // ── Timers ─────────────────────────────────────────────────────────────────
  const qTimerRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const totalTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const questionStart = useRef<number>(0);

  const stopQTimer = useCallback(() => {
    if (qTimerRef.current) { clearInterval(qTimerRef.current); qTimerRef.current = null; }
  }, []);

  const startQTimer = useCallback(() => {
    stopQTimer();
    questionStart.current = Date.now();
    setElapsedSecs(0);
    qTimerRef.current = setInterval(() => {
      setElapsedSecs(Math.floor((Date.now() - questionStart.current) / 1000));
    }, 500);
  }, [stopQTimer]);

  useEffect(() => () => {
    stopQTimer();
    if (totalTimerRef.current) clearInterval(totalTimerRef.current);
  }, [stopQTimer]);

  // ── Begin test ─────────────────────────────────────────────────────────────
  const beginTest = useCallback((selectedMode: CATMode) => {
    const pool      = selectedMode === 'listening' ? listeningPool : readingPool;
    const freshUids = new Set<string>();
    const first     = selectNextQuestion(pool, INITIAL_THETA, freshUids);
    if (!first) return;

    setMode(selectedMode);
    setTheta(INITIAL_THETA);
    setResponses([]);
    setUsedUids(freshUids);
    setCurrentItem(first);
    setSelected(null);
    setFlash(null);
    setTotalSecs(0);
    setPhase('testing');

    if (totalTimerRef.current) clearInterval(totalTimerRef.current);
    totalTimerRef.current = setInterval(() => setTotalSecs(s => s + 1), 1000);
    startQTimer();
  }, [readingPool, listeningPool, startQTimer]);

  // ── Confirm answer ─────────────────────────────────────────────────────────
  const handleConfirm = useCallback(() => {
    if (!currentItem || !selected || flash) return;

    stopQTimer();
    const responseTimeSecs = Math.round((Date.now() - questionStart.current) / 1000);
    const correct          = selected === currentItem.answer;
    setFlash(correct ? 'correct' : 'wrong');

    const newTheta = updateTheta(
      theta, currentItem.difficulty, correct,
      responseTimeSecs, responses.length + 1, currentItem.isListening,
    );

    const newResponse: CATResponse = {
      uid: currentItem.uid, difficulty: currentItem.difficulty,
      correct, responseTimeSecs, thetaBefore: theta, thetaAfter: newTheta,
    };

    const newResponses = [...responses, newResponse];
    const newUsed      = new Set(usedUids).add(currentItem.uid);
    const pool         = mode === 'listening' ? listeningPool : readingPool;

    setTheta(newTheta);
    setResponses(newResponses);
    setUsedUids(newUsed);

    setTimeout(() => {
      setFlash(null);
      setSelected(null);

      if (newResponses.length >= TOTAL_QUESTIONS) {
        if (totalTimerRef.current) { clearInterval(totalTimerRef.current); totalTimerRef.current = null; }
        setPhase('result');
        return;
      }
      const next = selectNextQuestion(pool, newTheta, newUsed, currentItem.examKey);
      if (!next) {
        if (totalTimerRef.current) { clearInterval(totalTimerRef.current); totalTimerRef.current = null; }
        setPhase('result');
        return;
      }
      setCurrentItem(next);
      startQTimer();
    }, FLASH_MS);
  }, [
    currentItem, selected, flash, theta, responses, usedUids,
    mode, readingPool, listeningPool, stopQTimer, startQTimer,
  ]);

  // ── Level name by current language ────────────────────────────────────────
  const lvName = (lv: typeof TOCFL_LEVELS[0]) =>
    lang === 'zh' ? lv.name : lang === 'vi' ? lv.viName : lv.enName;

  // ─── Intro screen ─────────────────────────────────────────────────────────

  if (phase === 'intro') {
    const poolSize = (m: CATMode) => m === 'listening' ? listeningPool.length : readingPool.length;

    return (
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '0 16px' }}>
        <div style={{
          background: 'var(--card)', borderRadius: 14,
          border: '1px solid var(--border)', padding: '28px 26px',
        }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 22 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'linear-gradient(135deg, var(--primary), #6366F1)',
              color: '#fff', borderRadius: 12, padding: '6px 18px',
              fontSize: '.8rem', fontWeight: 700, letterSpacing: '.04em', marginBottom: 12,
            }}>
              {t('cat_badge')}
            </div>
            <h2 style={{ margin: '0 0 6px', fontSize: '1.4rem', fontWeight: 800 }}>
              {t('cat_title')}
            </h2>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '.88rem' }}>
              {t('cat_subtitle')}
            </p>
          </div>

          {/* Mode selector */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
            {(['reading', 'listening'] as CATMode[]).map(m => {
              const isActive = mode === m;
              const disabled = m === 'listening' && listeningPool.length === 0;
              return (
                <button key={m} disabled={disabled} onClick={() => setMode(m)} style={{
                  padding: '14px 10px', borderRadius: 10,
                  border: `2px solid ${isActive ? 'var(--primary)' : 'var(--border)'}`,
                  background: isActive ? 'rgba(var(--primary-rgb),.08)' : 'var(--surface)',
                  color: isActive ? 'var(--primary)' : 'var(--text)',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  opacity: disabled ? 0.4 : 1,
                  textAlign: 'center', transition: 'all .15s',
                }}>
                  <div style={{ fontSize: '1.5rem', marginBottom: 4 }}>
                    {m === 'reading' ? '📖' : '🎧'}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '.9rem' }}>
                    {m === 'reading' ? t('cat_mode_r_short') : t('cat_mode_l_short')}
                  </div>
                  <div style={{ fontSize: '.72rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                    {poolSize(m)} {t('cat_questions_unit')}
                  </div>
                </button>
              );
            })}
          </div>

          {/* How it works */}
          <div style={{
            background: 'var(--surface)', borderRadius: 10,
            padding: '14px 16px', marginBottom: 20,
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            {[
              { icon: '🎯', key: 'cat_how1' as const },
              { icon: '⚡', key: 'cat_how2' as const },
              { icon: '⏱', key: mode === 'listening' ? ('cat_how3_listen' as const) : ('cat_how3_read' as const) },
              { icon: '📊', key: 'cat_how4' as const },
              { icon: '🔒', key: 'cat_how5' as const },
            ].map(({ icon, key }, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, fontSize: '.85rem', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '1rem', lineHeight: 1.5, flexShrink: 0 }}>{icon}</span>
                <span style={{ color: 'var(--text-secondary)', lineHeight: 1.55 }}>{t(key)}</span>
              </div>
            ))}
          </div>

          {/* Pool stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 22 }}>
            {[
              { label: t('cat_pool_label'),  value: poolSize(mode), unit: t('cat_pool_unit')  },
              { label: t('cat_test_label'),  value: TOTAL_QUESTIONS, unit: t('cat_per_test')  },
              { label: t('cat_scale_label'), value: '200–800',       unit: t('cat_scale_unit')},
            ].map(({ label, value, unit }) => (
              <div key={label} style={{
                background: 'var(--surface)', borderRadius: 8, padding: '10px',
                textAlign: 'center', border: '1px solid var(--border)',
              }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--primary)' }}>{value}</div>
                <div style={{ fontSize: '.7rem',  color: 'var(--text-secondary)', marginTop: 2 }}>{unit}</div>
                <div style={{ fontSize: '.68rem', color: 'var(--text-muted)',     marginTop: 1 }}>{label}</div>
              </div>
            ))}
          </div>

          <button
            onClick={() => beginTest(mode)}
            style={{
              width: '100%', padding: '13px', borderRadius: 10, border: 'none',
              background: 'linear-gradient(135deg, var(--primary), #6366F1)',
              color: '#fff', fontSize: '1rem', fontWeight: 700, cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(var(--primary-rgb),.35)',
            }}
          >
            {t('cat_start_btn')} {mode === 'reading' ? t('cat_mode_r_short') : t('cat_mode_l_short')} →
          </button>

          {/* Score table */}
          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: '.72rem', color: 'var(--text-muted)', marginBottom: 6, textAlign: 'center' }}>
              {t('cat_score_table')}
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
              {TOCFL_LEVELS.slice(1).map(lv => (
                <div key={lv.level} style={{
                  background: lv.color + '18', border: `1px solid ${lv.color}`,
                  borderRadius: 6, padding: '3px 8px', fontSize: '.7rem',
                  color: lv.color, fontWeight: 600,
                }}>
                  {lv.cefr} ≥ {lv.minScore}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Result screen ────────────────────────────────────────────────────────

  if (phase === 'result') {
    const finalScore = thetaToScore(theta);
    const level      = scoreToLevel(finalScore);
    const correct    = responses.filter(r => r.correct).length;
    const pct        = Math.round((correct / responses.length) * 100);
    const avgTime    = +(responses.reduce((s, r) => s + r.responseTimeSecs, 0) / responses.length).toFixed(1);
    const scoreLabel = mode === 'listening' ? t('cat_score_listen') : t('cat_score_reading');

    const secKey = (b: number) =>
      b <= 2 ? t('cat_sec_12') : b <= 3.9 ? t('cat_sec_3') : b <= 4.7 ? t('cat_sec_4') : t('cat_sec_5');

    const byDiff: Record<string, { correct: number; total: number }> = {};
    responses.forEach(r => {
      const key = secKey(r.difficulty);
      if (!byDiff[key]) byDiff[key] = { correct: 0, total: 0 };
      byDiff[key].total++;
      if (r.correct) byDiff[key].correct++;
    });

    return (
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 16px 40px' }}>
        <div style={{
          background: 'var(--card)', borderRadius: 14,
          border: '1px solid var(--border)', padding: '28px 24px',
        }}>
          {/* Score hero */}
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ fontSize: '.8rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
              {t('cat_done_header')} · {responses.length} {t('cat_sentences')} · {fmtSecs(totalSecs)}
            </div>
            <div style={{
              fontSize: '4rem', fontWeight: 900, lineHeight: 1,
              color: level.color, textShadow: `0 2px 20px ${level.color}44`,
            }}>
              {finalScore}
            </div>
            <div style={{ fontSize: '.85rem', color: 'var(--text-secondary)', margin: '4px 0 12px' }}>
              {scoreLabel}
            </div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: level.color + '18', border: `2px solid ${level.color}`,
              borderRadius: 10, padding: '8px 20px',
            }}>
              <span style={{ fontSize: '1.6rem', fontWeight: 900, color: level.color }}>
                {level.cefr}
              </span>
              <div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: level.color }}>
                  {level.name}
                </div>
                <div style={{ fontSize: '.75rem', color: 'var(--text-secondary)' }}>
                  {lvName(level)}
                </div>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 22 }}>
            {[
              { val: `${correct}/${responses.length}`, sub: t('cat_stat_correct') },
              { val: `${pct}%`,                        sub: t('cat_stat_pct')     },
              { val: `${avgTime}s`,                    sub: t('cat_stat_avg')     },
              { val: `${theta > 0 ? '+' : ''}${theta.toFixed(2)}`, sub: t('cat_stat_theta') },
            ].map(({ val, sub }) => (
              <div key={sub} style={{
                background: 'var(--surface)', borderRadius: 8,
                padding: '10px 6px', textAlign: 'center', border: '1px solid var(--border)',
              }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text)' }}>{val}</div>
                <div style={{ fontSize: '.68rem', color: 'var(--text-secondary)', marginTop: 2 }}>{sub}</div>
              </div>
            ))}
          </div>

          {/* Theta chart */}
          <div style={{
            background: 'var(--surface)', borderRadius: 10,
            border: '1px solid var(--border)', padding: '12px 14px', marginBottom: 18,
          }}>
            <div style={{ fontSize: '.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
              {t('cat_theta_journey')}
            </div>
            <ThetaChart responses={responses} />
          </div>

          {/* Per-section breakdown */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: '.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
              {t('cat_by_section')}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {Object.entries(byDiff).map(([label, { correct: c, total: tt }]) => {
                const p = tt > 0 ? c / tt : 0;
                return (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ fontSize: '.8rem', minWidth: 64, color: 'var(--text-secondary)' }}>{label}</div>
                    <div style={{ flex: 1, height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 4, width: `${p * 100}%`,
                        background: p >= 0.7 ? '#10B981' : p >= 0.4 ? '#F59E0B' : '#EF4444',
                        transition: 'width .6s ease',
                      }} />
                    </div>
                    <div style={{ fontSize: '.78rem', minWidth: 50, textAlign: 'right', color: 'var(--text)' }}>
                      {c}/{tt} ({Math.round(p * 100)}%)
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Level reference */}
          <div style={{
            background: 'var(--surface)', borderRadius: 10,
            border: '1px solid var(--border)', padding: '12px 14px', marginBottom: 22,
          }}>
            <div style={{ fontSize: '.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10 }}>
              {t('cat_score_table')}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {TOCFL_LEVELS.slice(1).map(lv => {
                const nextMin = TOCFL_LEVELS[lv.level + 1]?.minScore ?? 800;
                const inRange = finalScore >= lv.minScore && finalScore < nextMin;
                return (
                  <div key={lv.level} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '5px 8px', borderRadius: 6,
                    background: inRange ? lv.color + '18' : 'transparent',
                    border: inRange ? `1px solid ${lv.color}` : '1px solid transparent',
                  }}>
                    <span style={{ fontSize: '.75rem', fontWeight: 700, color: lv.color, minWidth: 26 }}>
                      {lv.cefr}
                    </span>
                    <span style={{ fontSize: '.78rem', color: 'var(--text-secondary)', flex: 1 }}>
                      {lv.name} · {lvName(lv)}
                    </span>
                    <span style={{ fontSize: '.72rem', color: 'var(--text-muted)' }}>≥ {lv.minScore}</span>
                    {inRange && <span style={{ fontSize: '1rem' }}>←</span>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => beginTest(mode)} style={{
              flex: 1, padding: '12px', borderRadius: 10, border: 'none',
              background: 'linear-gradient(135deg, var(--primary), #6366F1)',
              color: '#fff', fontSize: '.92rem', fontWeight: 700, cursor: 'pointer',
            }}>
              {t('cat_redo')}
            </button>
            <button onClick={() => setPhase('intro')} style={{
              flex: 1, padding: '12px', borderRadius: 10,
              border: '1.5px solid var(--border)',
              background: 'var(--card)', color: 'var(--text)',
              fontSize: '.92rem', fontWeight: 600, cursor: 'pointer',
            }}>
              {t('cat_home')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Testing screen ───────────────────────────────────────────────────────

  const qNum      = responses.length + 1;
  const progress  = (responses.length / TOTAL_QUESTIONS) * 100;
  const liveLevel = thetaToLevel(theta);
  const correct   = responses.filter(r => r.correct).length;
  const modeShort = mode === 'listening' ? t('cat_mode_l_short') : t('cat_mode_r_short');

  const audioLabels = {
    playing: t('cat_audio_playing'),
    paused:  t('cat_audio_paused'),
    start:   t('cat_audio_start'),
    replay:  t('cat_audio_replay'),
  };

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '0 16px 40px' }}>
      {/* ── Test header ── */}
      <div style={{
        background: 'var(--card)', borderRadius: '14px 14px 0 0',
        border: '1px solid var(--border)', borderBottom: 'none', padding: '12px 16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{
            background: 'linear-gradient(135deg, var(--primary), #6366F1)',
            color: '#fff', borderRadius: 6, padding: '2px 10px', fontSize: '.74rem', fontWeight: 700,
          }}>
            CAT {modeShort}
          </span>
          <span style={{ fontSize: '.8rem', color: 'var(--text-secondary)' }}>
            {responses.length}/{TOTAL_QUESTIONS} {t('cat_sentences')}
          </span>
          <span style={{ fontSize: '.78rem', color: '#10B981' }}>✓ {correct}</span>
          <span style={{ fontSize: '.78rem', color: '#EF4444' }}>✗ {responses.length - correct}</span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              fontSize: '.74rem', fontWeight: 700, color: liveLevel.color,
              background: liveLevel.color + '18', border: `1px solid ${liveLevel.color}`,
              borderRadius: 5, padding: '1px 7px',
            }}>
              {liveLevel.cefr !== '—' ? liveLevel.cefr : '—'} · {thetaToScore(theta)}
            </span>
            <span style={{ fontSize: '.72rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
              ⏱ {fmtSecs(totalSecs)}
            </span>
          </div>
        </div>
        <div style={{ marginTop: 8, height: 5, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${progress}%`,
            background: 'linear-gradient(90deg, var(--primary), #6366F1)',
            borderRadius: 3, transition: 'width .4s ease',
          }} />
        </div>
      </div>

      {/* ── Question card ── */}
      {currentItem && (
        <div style={{
          background: 'var(--card)', borderRadius: '0 0 14px 14px',
          border: '1px solid var(--border)', borderTop: 'none',
          padding: '18px 18px 16px', position: 'relative', minHeight: 300,
        }}>
          <QuestionView
            item={currentItem}
            selected={selected}
            onSelect={setSelected}
            base={base}
            flash={flash}
            qNum={qNum}
            elapsedSecs={elapsedSecs}
            qLabel={t('cat_q_label')}
            diffLabel={t('cat_difficulty')}
            seeImageLabel={t('cat_see_image')}
            audioLabels={audioLabels}
            onFirstAudioPlay={startQTimer}
          />

          {!flash && (
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={handleConfirm}
                disabled={!selected}
                style={{
                  padding: '10px 24px', borderRadius: 8, border: 'none',
                  background: selected
                    ? 'linear-gradient(135deg, var(--primary), #6366F1)'
                    : 'var(--border)',
                  color: selected ? '#fff' : 'var(--text-muted)',
                  fontSize: '.9rem', fontWeight: 700,
                  cursor: selected ? 'pointer' : 'default',
                  transition: 'all .2s',
                }}
              >
                {t('cat_confirm')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
