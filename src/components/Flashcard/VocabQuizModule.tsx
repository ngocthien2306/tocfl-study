/**
 * VocabQuizModule — 4 interactive quiz types for TOCFL vocabulary:
 *   1. Meaning Choice  – show hanzi → pick Vietnamese meaning (4 options)
 *   2. Pinyin Match    – show hanzi → pick correct pinyin (4 options)
 *   3. Reverse Quiz    – show Vietnamese meaning → pick hanzi (4 options)
 *   4. Matching Game   – match 6 hanzi cards with their meanings
 */
import React, { useMemo, useState, useCallback } from 'react';
import type { Word, Progress } from '../../types';
import { useLang } from '../../i18n/LangContext';
import { SpeakButton } from '../UI/SpeakButton';

interface Props {
  vocabulary: Word[];
  progress: Progress;
  markWord: (hanzi: string, known: boolean) => void;
}

type QuizType = 'meaning' | 'pinyin' | 'reverse' | 'matching';
type LevelFilter = 'all' | 'A1' | 'A2' | 'A3' | 'A4' | 'B1' | 'B2' | 'C1';
type BandFilter  = 'all' | 'A' | 'B' | 'C';

const LEVEL_META: Record<string, { label: string; color: string }> = {
  A1: { label: '準備一', color: '#e05d3a' },
  A2: { label: '準備二', color: '#d4793a' },
  A3: { label: '入門',   color: '#c0861a' },
  A4: { label: '基礎',   color: '#a07c10' },
  B1: { label: '進階',   color: '#2e8b57' },
  B2: { label: '高階',   color: '#1d6b8a' },
  C1: { label: '流利',   color: '#5a3ea8' },
};

const BAND_COLORS: Record<'A'|'B'|'C', { grad: string; dark: string }> = {
  A: { grad: '#F4A080', dark: '#D05A4C' },
  B: { grad: '#F5C55A', dark: '#C8881A' },
  C: { grad: '#68BBBC', dark: '#2E8E90' },
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickDistractors(pool: Word[], correct: Word, count: number, field: 'meaning' | 'pinyin' | 'hanzi'): Word[] {
  const candidates = pool.filter(w => w.hanzi !== correct.hanzi && w[field] && w[field] !== correct[field]);
  return shuffle(candidates).slice(0, count);
}

// ── Sub-component: Multiple Choice Question ───────────────────────────────────
interface MCQProps {
  word: Word;
  pool: Word[];
  type: 'meaning' | 'pinyin' | 'reverse';
  onResult: (correct: boolean) => void;
  lang: string;
}

const MCQuestion: React.FC<MCQProps> = ({ word, pool, type, onResult, lang }) => {
  const [chosen, setChosen] = useState<string | null>(null);

  const { prompt, correctAnswer, options } = useMemo(() => {
    if (type === 'meaning') {
      // Show hanzi → pick meaning
      const distractors = pickDistractors(pool.filter(w => w.meaning), word, 3, 'meaning');
      const opts = shuffle([word, ...distractors]);
      return { prompt: word.hanzi, correctAnswer: word.meaning, options: opts.map(w => w.meaning) };
    } else if (type === 'pinyin') {
      // Show hanzi → pick pinyin
      const distractors = pickDistractors(pool, word, 3, 'pinyin');
      const opts = shuffle([word, ...distractors]);
      return { prompt: word.hanzi, correctAnswer: word.pinyin, options: opts.map(w => w.pinyin) };
    } else {
      // Reverse: show meaning → pick hanzi
      const distractors = pickDistractors(pool, word, 3, 'hanzi');
      const opts = shuffle([word, ...distractors]);
      return { prompt: word.meaning, correctAnswer: word.hanzi, options: opts.map(w => w.hanzi) };
    }
  }, [word, pool, type]);

  const isCorrect = chosen === correctAnswer;
  const lm = LEVEL_META[word.level];
  const bc = BAND_COLORS[word.band as 'A'|'B'|'C'] ?? BAND_COLORS['A'];

  const qLabel: Record<string, string> = {
    vi: type === 'meaning' ? 'Chữ Hán này có nghĩa là gì?' : type === 'pinyin' ? 'Cách đọc pinyin nào đúng?' : 'Từ nào có nghĩa là:',
    zh: type === 'meaning' ? '這個詞的意思是？'  : type === 'pinyin' ? '正確的拼音是？' : '哪個詞的意思是：',
    en: type === 'meaning' ? 'What does this word mean?' : type === 'pinyin' ? 'Which pinyin is correct?' : 'Which word means:',
  };

  return (
    <div>
      {/* Question prompt */}
      <div style={{
        background: `linear-gradient(145deg, ${bc.grad}44, ${bc.dark}22)`,
        border: `1.5px solid ${bc.dark}30`,
        borderRadius: 20, padding: '28px 20px', textAlign: 'center', marginBottom: 20,
        position: 'relative',
      }}>
        {lm && (
          <div style={{
            position: 'absolute', top: 12, left: 12,
            background: lm.color, color: '#fff',
            borderRadius: 20, padding: '2px 8px',
            fontSize: '.62rem', fontWeight: 800,
          }}>
            {word.level} · {lm.label}
          </div>
        )}
        <div style={{ fontSize: '.75rem', color: 'var(--text-muted)', marginBottom: 12, fontWeight: 600 }}>
          {qLabel[lang] ?? qLabel['en']}
        </div>
        <div style={{
          fontSize: type === 'reverse' ? '1rem' : '3.2rem',
          fontWeight: type === 'reverse' ? 600 : 800,
          color: 'var(--text)',
          lineHeight: 1.2,
          letterSpacing: type === 'reverse' ? 0 : '.04em',
        }}>
          {prompt}
        </div>
        {type !== 'reverse' && word.pinyin && (
          <div style={{ fontSize: '1rem', color: bc.dark, marginTop: 8, fontWeight: 500 }}>
            {type === 'meaning' ? word.pinyin : ''}
          </div>
        )}
        {type !== 'reverse' && (
          <div style={{ marginTop: 8 }}>
            <SpeakButton text={word.hanzi} />
          </div>
        )}
      </div>

      {/* Options grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        {options.map((opt, i) => {
          const isChosen = chosen === opt;
          const isRight  = opt === correctAnswer;
          const showResult = chosen !== null;
          let bg = 'var(--surface)';
          let border = 'var(--border)';
          let color = 'var(--text)';
          if (showResult && isRight)  { bg = '#f0fdf4'; border = '#16a34a'; color = '#16a34a'; }
          if (showResult && isChosen && !isRight) { bg = '#fef2f2'; border = '#dc2626'; color = '#dc2626'; }

          return (
            <button
              key={i}
              disabled={chosen !== null}
              onClick={() => { setChosen(opt); onResult(opt === correctAnswer); }}
              style={{
                borderRadius: 14, padding: '14px 12px',
                border: `2px solid ${border}`,
                background: bg, color,
                cursor: chosen ? 'default' : 'pointer',
                fontFamily: 'inherit', fontSize: type === 'meaning' ? '.88rem' : type === 'reverse' ? '1.5rem' : '1rem',
                fontWeight: 700, textAlign: 'center',
                transition: 'all .15s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                minHeight: 56,
              }}
            >
              {showResult && isRight && <span>✓</span>}
              {showResult && isChosen && !isRight && <span>✗</span>}
              {opt}
            </button>
          );
        })}
      </div>

      {/* Feedback */}
      {chosen !== null && (
        <div style={{
          padding: '12px 16px', borderRadius: 12,
          background: isCorrect ? '#f0fdf4' : '#fef2f2',
          border: `1.5px solid ${isCorrect ? '#16a34a' : '#dc2626'}`,
          color: isCorrect ? '#16a34a' : '#dc2626',
          fontSize: '.88rem', fontWeight: 700, textAlign: 'center',
        }}>
          {isCorrect
            ? ({ vi: '🎉 Chính xác!', zh: '🎉 答對了！', en: '🎉 Correct!' }[lang] ?? '🎉')
            : ({ vi: `✗ Đáp án đúng: ${correctAnswer}`, zh: `✗ 正確答案：${correctAnswer}`, en: `✗ Correct: ${correctAnswer}` }[lang] ?? `✗ ${correctAnswer}`)
          }
        </div>
      )}
    </div>
  );
};

// ── Sub-component: Matching Game ──────────────────────────────────────────────
const MATCH_SIZE = 6;

interface MatchCard { id: string; word: Word; side: 'hanzi' | 'meaning'; }

const MatchingGame: React.FC<{ pool: Word[]; onComplete: (score: number, total: number) => void; lang: string }> = ({ pool, onComplete, lang }) => {
  const words = useMemo(() => shuffle(pool.filter(w => w.meaning)).slice(0, MATCH_SIZE), [pool]);

  const cards: MatchCard[] = useMemo(() => {
    const hanziCards: MatchCard[] = words.map(w => ({ id: `h-${w.hanzi}`, word: w, side: 'hanzi' }));
    const meaningCards: MatchCard[] = words.map(w => ({ id: `m-${w.hanzi}`, word: w, side: 'meaning' }));
    return shuffle([...hanziCards, ...meaningCards]);
  }, [words]);

  const [selected, setSelected] = useState<MatchCard | null>(null);
  const [matched,  setMatched]  = useState<Set<string>>(new Set());
  const [wrong,    setWrong]    = useState<Set<string>>(new Set());
  const [score,    setScore]    = useState(0);
  const [attempts, setAttempts] = useState(0);

  const tap = useCallback((card: MatchCard) => {
    if (matched.has(card.word.hanzi)) return;
    if (wrong.has(card.id)) return;
    if (selected?.id === card.id) { setSelected(null); return; }

    if (!selected) { setSelected(card); return; }

    // Same word, different sides → match!
    if (selected.word.hanzi === card.word.hanzi && selected.side !== card.side) {
      const newMatched = new Set(matched);
      newMatched.add(card.word.hanzi);
      setMatched(newMatched);
      setSelected(null);
      const newScore = score + 1;
      setScore(newScore);
      setAttempts(a => a + 1);
      if (newMatched.size === MATCH_SIZE) {
        setTimeout(() => onComplete(newScore, attempts + 1), 300);
      }
    } else {
      // Wrong pair — flash red then clear
      const newWrong = new Set([selected.id, card.id]);
      setWrong(newWrong);
      setAttempts(a => a + 1);
      setTimeout(() => { setWrong(new Set()); setSelected(null); }, 800);
    }
  }, [selected, matched, wrong, score, attempts, onComplete]);

  const bc = BAND_COLORS['B'];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: '.82rem', color: 'var(--text-muted)' }}>
          {{ vi: `Ghép đúng: ${matched.size}/${MATCH_SIZE}`, zh: `已配對：${matched.size}/${MATCH_SIZE}`, en: `Matched: ${matched.size}/${MATCH_SIZE}` }[lang] ?? `${matched.size}/${MATCH_SIZE}`}
        </div>
        <div style={{ fontSize: '.82rem', color: 'var(--text-muted)' }}>
          {{ vi: `Lần thử: ${attempts}`, zh: `嘗試次數：${attempts}`, en: `Attempts: ${attempts}` }[lang] ?? String(attempts)}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {cards.map(card => {
          const isMatched  = matched.has(card.word.hanzi);
          const isSelected = selected?.id === card.id;
          const isWrong    = wrong.has(card.id);

          let bg     = 'var(--surface)';
          let border = 'var(--border)';
          let color  = 'var(--text)';
          if (isMatched)  { bg = '#f0fdf4'; border = '#16a34a'; color = '#16a34a'; }
          if (isSelected) { bg = `${bc.grad}44`; border = bc.dark; color = bc.dark; }
          if (isWrong)    { bg = '#fef2f2'; border = '#dc2626'; color = '#dc2626'; }

          return (
            <button
              key={card.id}
              disabled={isMatched}
              onClick={() => tap(card)}
              style={{
                borderRadius: 12, padding: '14px 10px',
                border: `2px solid ${border}`,
                background: bg, color,
                cursor: isMatched ? 'default' : 'pointer',
                fontFamily: 'inherit',
                fontSize: card.side === 'hanzi' ? '1.6rem' : '.82rem',
                fontWeight: card.side === 'hanzi' ? 800 : 600,
                textAlign: 'center', minHeight: 68,
                transition: 'all .15s',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {card.side === 'hanzi' ? card.word.hanzi : card.word.meaning}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ── Main VocabQuizModule ──────────────────────────────────────────────────────
export const VocabQuizModule: React.FC<Props> = ({ vocabulary, markWord }) => {
  const { lang } = useLang();
  const [quizType,  setQuizType]  = useState<QuizType>('meaning');
  const [band,      setBand]      = useState<BandFilter>('all');
  const [level,     setLevel]     = useState<LevelFilter>('all');
  const [qIdx,      setQIdx]      = useState(0);
  const [session,   setSession]   = useState<Word[]>([]);
  const [results,   setResults]   = useState<boolean[]>([]);
  const [phase,     setPhase]     = useState<'setup' | 'quiz' | 'result'>('setup');
  const [matchKey,  setMatchKey]  = useState(0);

  const SESSION_SIZE = 10;

  // Words pool: only use words WITH meanings for meaning/reverse quiz
  const pool = useMemo(() => {
    return vocabulary.filter(w => {
      if (band  !== 'all' && w.band  !== band)  return false;
      if (level !== 'all' && w.level !== level) return false;
      if ((quizType === 'meaning' || quizType === 'reverse') && !w.meaning) return false;
      return true;
    });
  }, [vocabulary, band, level, quizType]);

  const byCounts = useMemo(() => {
    const m: Record<string, number> = {};
    vocabulary.forEach(w => { m[w.level] = (m[w.level] ?? 0) + 1; });
    return m;
  }, [vocabulary]);

  function startSession() {
    const words = shuffle(pool).slice(0, SESSION_SIZE);
    setSession(words);
    setResults([]);
    setQIdx(0);
    setPhase('quiz');
    setMatchKey(k => k + 1);
  }

  function handleResult(correct: boolean) {
    const w = session[qIdx];
    if (correct) markWord(w.hanzi, true);
    setTimeout(() => {
      const newResults = [...results, correct];
      if (qIdx + 1 >= session.length) {
        setResults(newResults);
        setPhase('result');
      } else {
        setResults(newResults);
        setQIdx(i => i + 1);
      }
    }, 900);
  }

  function handleMatchComplete(score: number, _attempts: number) {
    // For matching game: award each correctly matched word
    session.forEach(w => markWord(w.hanzi, true));
    const fakeResults = Array(score).fill(true).concat(Array(MATCH_SIZE - score).fill(false));
    setResults(fakeResults);
    setPhase('result');
  }

  const lbl = {
    vi: {
      title: 'Luyện từ vựng', subtitle: 'Chọn kiểu bài tập',
      q_meaning: 'Đoán nghĩa', q_pinyin: 'Đoán pinyin', q_reverse: 'Đoán chữ Hán', q_matching: 'Ghép cặp',
      q_meaning_desc: 'Nhìn chữ → chọn nghĩa', q_pinyin_desc: 'Nhìn chữ → chọn pinyin',
      q_reverse_desc: 'Nhìn nghĩa → chọn chữ', q_matching_desc: 'Ghép 6 cặp nhanh nhất',
      start: 'Bắt đầu luyện tập', restart: 'Làm lại', back: '← Về menu',
      result_title: 'Kết quả', correct: 'Đúng', wrong: 'Sai',
      band_all: 'Tất cả', level_all: 'Tất cả', filter_band: 'Band', filter_level: 'Cấp',
      pool_warn: 'Không đủ từ vựng để tạo bài quiz. Thử chọn cấp độ khác.',
      q_of: 'câu',
    },
    zh: {
      title: '詞彙練習', subtitle: '選擇題型',
      q_meaning: '猜意思', q_pinyin: '猜拼音', q_reverse: '猜漢字', q_matching: '配對遊戲',
      q_meaning_desc: '看漢字→選意思', q_pinyin_desc: '看漢字→選拼音',
      q_reverse_desc: '看意思→選漢字', q_matching_desc: '快速配對6組',
      start: '開始練習', restart: '再做一次', back: '← 回選單',
      result_title: '結果', correct: '答對', wrong: '答錯',
      band_all: '全部', level_all: '全部', filter_band: '級別', filter_level: '等級',
      pool_warn: '詞彙不足，請選其他等級。',
      q_of: '題',
    },
    en: {
      title: 'Vocab Practice', subtitle: 'Choose quiz type',
      q_meaning: 'Meaning Quiz', q_pinyin: 'Pinyin Quiz', q_reverse: 'Hanzi Quiz', q_matching: 'Matching',
      q_meaning_desc: 'Hanzi → pick meaning', q_pinyin_desc: 'Hanzi → pick pinyin',
      q_reverse_desc: 'Meaning → pick hanzi', q_matching_desc: 'Match 6 pairs',
      start: 'Start Practice', restart: 'Try Again', back: '← Menu',
      result_title: 'Result', correct: 'Correct', wrong: 'Wrong',
      band_all: 'All', level_all: 'All', filter_band: 'Band', filter_level: 'Level',
      pool_warn: 'Not enough vocabulary. Try a different level.',
      q_of: 'Q',
    },
  }[lang] ?? {
    title: 'Vocab Practice', subtitle: 'Choose quiz type',
    q_meaning: 'Meaning Quiz', q_pinyin: 'Pinyin Quiz', q_reverse: 'Hanzi Quiz', q_matching: 'Matching',
    q_meaning_desc: 'Hanzi → pick meaning', q_pinyin_desc: 'Hanzi → pick pinyin',
    q_reverse_desc: 'Meaning → pick hanzi', q_matching_desc: 'Match 6 pairs',
    start: 'Start Practice', restart: 'Try Again', back: '← Menu',
    result_title: 'Result', correct: 'Correct', wrong: 'Wrong',
    band_all: 'All', level_all: 'All', filter_band: 'Band', filter_level: 'Level',
    pool_warn: 'Not enough vocabulary. Try a different level.',
    q_of: 'Q',
  };

  const QUIZ_TYPES: { type: QuizType; icon: string; label: string; desc: string }[] = [
    { type: 'meaning',  icon: '🈯', label: lbl.q_meaning,  desc: lbl.q_meaning_desc },
    { type: 'pinyin',   icon: '🔤', label: lbl.q_pinyin,   desc: lbl.q_pinyin_desc },
    { type: 'reverse',  icon: '🔄', label: lbl.q_reverse,  desc: lbl.q_reverse_desc },
    { type: 'matching', icon: '🧩', label: lbl.q_matching,  desc: lbl.q_matching_desc },
  ];

  const canStart = quizType === 'matching' ? pool.filter(w => w.meaning).length >= MATCH_SIZE : pool.length >= 4;

  // ── Setup screen ─────────────────────────────────────────────────────────
  if (phase === 'setup') {
    return (
      <div>
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ margin: '0 0 4px', fontSize: '1.1rem' }}>{lbl.title}</h2>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '.82rem' }}>{lbl.subtitle}</p>
        </div>

        {/* Quiz type cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          {QUIZ_TYPES.map(({ type, icon, label, desc }) => {
            const active = quizType === type;
            return (
              <button key={type} onClick={() => setQuizType(type)}
                style={{
                  borderRadius: 14, padding: '16px 12px', textAlign: 'left',
                  border: `2px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                  background: active ? 'var(--accent-light)' : 'var(--surface)',
                  cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'all .15s',
                }}>
                <div style={{ fontSize: '1.6rem', marginBottom: 8 }}>{icon}</div>
                <div style={{ fontWeight: 700, fontSize: '.88rem', color: active ? 'var(--accent)' : 'var(--text)', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: '.72rem', color: 'var(--text-muted)' }}>{desc}</div>
              </button>
            );
          })}
        </div>

        {/* Filters */}
        <div className="card card--compact" style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: '.65rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>{lbl.filter_band}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(['all','A','B','C'] as BandFilter[]).map(b => {
                const active = band === b;
                const bc = b !== 'all' ? BAND_COLORS[b as 'A'|'B'|'C'] : null;
                return (
                  <button key={b}
                    onClick={() => { setBand(b); setLevel('all'); }}
                    style={{
                      padding: '4px 14px', borderRadius: 20, fontSize: '.78rem', fontWeight: 700,
                      cursor: 'pointer', border: 'none', fontFamily: 'inherit',
                      background: active ? (bc ? bc.dark : 'var(--accent)') : 'var(--bg)',
                      color: active ? '#fff' : 'var(--text-muted)',
                    }}>
                    {b === 'all' ? lbl.band_all : `Band ${b}`}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '.65rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>{lbl.filter_level}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button onClick={() => setLevel('all')}
                style={{
                  padding: '4px 14px', borderRadius: 20, fontSize: '.78rem', fontWeight: 700,
                  cursor: 'pointer', border: 'none', fontFamily: 'inherit',
                  background: level === 'all' ? 'var(--accent)' : 'var(--bg)',
                  color: level === 'all' ? '#fff' : 'var(--text-muted)',
                }}>
                {lbl.level_all}
              </button>
              {(Object.keys(LEVEL_META) as LevelFilter[])
                .filter(l => {
                  if (band === 'A') return ['A1','A2','A3','A4'].includes(l);
                  if (band === 'B') return ['B1','B2'].includes(l);
                  if (band === 'C') return l === 'C1';
                  return true;
                })
                .filter(l => (byCounts[l] ?? 0) > 0)
                .map(l => {
                  const meta = LEVEL_META[l];
                  return (
                    <button key={l}
                      onClick={() => setLevel(l)}
                      style={{
                        padding: '4px 14px', borderRadius: 20, fontSize: '.78rem', fontWeight: 700,
                        cursor: 'pointer', border: 'none', fontFamily: 'inherit',
                        background: level === l ? meta.color : `${meta.color}18`,
                        color: level === l ? '#fff' : meta.color,
                      }}>
                      {l} · {meta.label}
                    </button>
                  );
                })}
            </div>
          </div>
        </div>

        {/* Pool info */}
        <div style={{
          padding: '10px 14px', borderRadius: 10, marginBottom: 16,
          background: canStart ? 'var(--accent-light)' : '#fef9e7',
          border: `1px solid ${canStart ? 'var(--accent)' : '#f0c040'}30`,
          fontSize: '.82rem', color: canStart ? 'var(--accent)' : '#b45309',
        }}>
          {canStart
            ? ({ vi: `📚 ${pool.length} từ trong pool · Mỗi phiên ${quizType === 'matching' ? MATCH_SIZE : SESSION_SIZE} từ`, zh: `📚 ${pool.length} 個詞 · 每次 ${quizType === 'matching' ? MATCH_SIZE : SESSION_SIZE} 題`, en: `📚 ${pool.length} words in pool · ${quizType === 'matching' ? MATCH_SIZE : SESSION_SIZE} per session` }[lang] ?? '')
            : lbl.pool_warn
          }
        </div>

        <button
          disabled={!canStart}
          onClick={startSession}
          style={{
            width: '100%', minHeight: 52, borderRadius: 14, cursor: canStart ? 'pointer' : 'not-allowed',
            border: 'none', fontFamily: 'inherit', fontSize: '1rem', fontWeight: 700,
            background: canStart ? 'var(--accent)' : 'var(--border)',
            color: canStart ? '#fff' : 'var(--text-muted)',
          }}>
          {lbl.start} →
        </button>
      </div>
    );
  }

  // ── Quiz screen ─────────────────────────────────────────────────────────
  if (phase === 'quiz') {
    const current = session[qIdx];
    const bc = current ? BAND_COLORS[current.band as 'A'|'B'|'C'] ?? BAND_COLORS['A'] : BAND_COLORS['A'];
    const progressPct = quizType === 'matching' ? 0 : ((qIdx) / session.length) * 100;

    return (
      <div>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <button onClick={() => setPhase('setup')}
            style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '.88rem', padding: 0, fontFamily: 'inherit' }}>
            {lbl.back}
          </button>
          <div style={{ flex: 1 }} />
          {quizType !== 'matching' && (
            <span style={{ fontSize: '.78rem', color: 'var(--text-muted)' }}>
              {qIdx + 1} / {session.length} {lbl.q_of}
            </span>
          )}
        </div>

        {/* Progress bar */}
        {quizType !== 'matching' && (
          <div style={{ height: 5, borderRadius: 4, background: 'var(--border)', overflow: 'hidden', marginBottom: 20 }}>
            <div style={{ height: '100%', width: `${progressPct}%`, background: bc.dark, borderRadius: 4, transition: 'width .3s' }} />
          </div>
        )}

        {quizType === 'matching' ? (
          <MatchingGame
            key={matchKey}
            pool={pool.filter(w => w.meaning)}
            onComplete={handleMatchComplete}
            lang={lang}
          />
        ) : current ? (
          <MCQuestion
            key={`${qIdx}-${current.hanzi}`}
            word={current}
            pool={pool}
            type={quizType as 'meaning' | 'pinyin' | 'reverse'}
            onResult={handleResult}
            lang={lang}
          />
        ) : null}
      </div>
    );
  }

  // ── Result screen ────────────────────────────────────────────────────────
  const correctCt = results.filter(Boolean).length;
  const totalCt   = results.length;
  const pct       = totalCt > 0 ? Math.round(correctCt / totalCt * 100) : 0;
  const emoji     = pct >= 80 ? '🏆' : pct >= 60 ? '👍' : '📖';

  return (
    <div>
      <div style={{ textAlign: 'center', padding: '24px 16px', marginBottom: 16 }}>
        <div style={{ fontSize: '3rem', marginBottom: 12 }}>{emoji}</div>
        <h2 style={{ margin: '0 0 8px', fontSize: '1.2rem' }}>{lbl.result_title}</h2>
        <div style={{ fontSize: '3rem', fontWeight: 800, color: pct >= 70 ? 'var(--success)' : 'var(--error)' }}>
          {correctCt}/{totalCt}
        </div>
        <div style={{ fontSize: '1rem', color: 'var(--text-muted)', marginTop: 4 }}>{pct}%</div>
      </div>

      {/* Per-question summary (only for MC quizzes) */}
      {quizType !== 'matching' && session.length > 0 && (
        <div className="card card--compact" style={{ marginBottom: 16 }}>
          {session.slice(0, results.length).map((w, i) => {
            const ok = results[i];
            return (
              <div key={w.hanzi} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '6px 0', borderBottom: i < results.length - 1 ? '1px solid var(--bg)' : 'none',
              }}>
                <span style={{ fontSize: '1.1rem', fontWeight: 800, minWidth: 32 }}>{ok ? '✓' : '✗'}</span>
                <span style={{ fontSize: '1.2rem', fontWeight: 700, minWidth: 48 }}>{w.hanzi}</span>
                <span style={{ fontSize: '.78rem', color: 'var(--text-muted)', flex: 1 }}>{w.pinyin}</span>
                <span style={{ fontSize: '.78rem', color: 'var(--text)', textAlign: 'right' }}>{w.meaning || '—'}</span>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={() => setPhase('setup')}
          style={{
            flex: 1, minHeight: 48, borderRadius: 12,
            border: '1.5px solid var(--border)', background: 'var(--surface)',
            cursor: 'pointer', fontFamily: 'inherit', fontSize: '.9rem', fontWeight: 600,
            color: 'var(--text)',
          }}>
          {lbl.back}
        </button>
        <button onClick={startSession}
          style={{
            flex: 2, minHeight: 48, borderRadius: 12, border: 'none',
            background: 'var(--accent)', color: '#fff',
            cursor: 'pointer', fontFamily: 'inherit', fontSize: '.9rem', fontWeight: 700,
          }}>
          {lbl.restart} →
        </button>
      </div>
    </div>
  );
};
