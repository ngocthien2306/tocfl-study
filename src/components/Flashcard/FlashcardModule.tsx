import React, { useMemo, useState } from 'react';
import type { Word, Progress } from '../../types';

interface Props {
  vocabulary: Word[];
  progress: Progress;
  markWord: (hanzi: string, known: boolean) => void;
}

type Band  = 'all' | 'A' | 'B';
type Level = 'all' | 'A1' | 'A2' | 'B1' | 'B2';

export const FlashcardModule: React.FC<Props> = ({ vocabulary, progress, markWord }) => {
  const [band,       setBand]       = useState<Band>('all');
  const [level,      setLevel]      = useState<Level>('all');
  const [hideKnown,  setHideKnown]  = useState(false);
  const [idx,        setIdx]        = useState(0);
  const [flipped,    setFlipped]    = useState(false);

  const filtered = useMemo(() => {
    return vocabulary.filter(w => {
      if (band  !== 'all' && w.band  !== band)  return false;
      if (level !== 'all' && w.level !== level) return false;
      if (hideKnown && progress.known[w.hanzi]) return false;
      return true;
    });
  }, [vocabulary, band, level, hideKnown, progress.known]);

  const total   = filtered.length;
  const word    = filtered[idx];
  const knownCt = Object.values(progress.known).filter(Boolean).length;

  function go(dir: 1 | -1) {
    setFlipped(false);
    setTimeout(() => setIdx(i => Math.max(0, Math.min(total - 1, i + dir))), 10);
  }
  function jump(n: number) { setFlipped(false); setIdx(n); }
  function shuffle() { jump(Math.floor(Math.random() * total)); }

  function changeFilter<T>(setter: (v: T) => void, val: T) {
    setter(val);
    setIdx(0);
    setFlipped(false);
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  const bandA  = vocabulary.filter(w => w.band === 'A').length;
  const bandB  = vocabulary.filter(w => w.band === 'B').length;

  return (
    <div>
      {/* Stats */}
      <div className="stats-row">
        <div className="stat-box">
          <div className="stat-num">{bandA}</div>
          <div className="stat-label">Từ Band A</div>
        </div>
        <div className="stat-box">
          <div className="stat-num">{bandB}</div>
          <div className="stat-label">Từ Band B</div>
        </div>
        <div className="stat-box">
          <div className="stat-num">{knownCt}</div>
          <div className="stat-label">Đã thuộc</div>
        </div>
      </div>

      {/* Filters */}
      <div className="card card--compact mb-12">
        <div className="filter-group mb-8">
          <span className="filter-label">Band</span>
          {(['all','A','B'] as Band[]).map(b => (
            <button
              key={b}
              className={`chip ${band === b ? 'active' : ''}`}
              onClick={() => changeFilter(setBand, b)}
            >
              {b === 'all' ? 'Tất cả' : `Band ${b}`}
            </button>
          ))}
        </div>
        <div className="filter-group mb-8">
          <span className="filter-label">Cấp</span>
          {(['all','A1','A2','B1','B2'] as Level[]).map(l => (
            <button
              key={l}
              className={`chip ${level === l ? 'active' : ''}`}
              onClick={() => changeFilter(setLevel, l)}
            >
              {l === 'all' ? 'Tất cả' : l}
            </button>
          ))}
        </div>
        <div className="filter-group">
          <button
            className={`chip ${hideKnown ? 'active' : ''}`}
            onClick={() => changeFilter(setHideKnown, !hideKnown)}
          >
            {hideKnown ? '● Ẩn từ đã biết' : '○ Hiện từ đã biết'}
          </button>
        </div>
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div className="progress-row">
            <span>{idx + 1} / {total}</span>
            <span>{Math.round((idx + 1) / total * 100)}%</span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${(idx + 1) / total * 100}%` }} />
          </div>
        </div>
      )}

      {/* Card or empty state */}
      {!word ? (
        <div className="card empty-state">
          <p style={{ fontSize: '2rem' }}>✓</p>
          <p>Không còn từ nào trong bộ lọc này.<br />Thử thay đổi bộ lọc hoặc bật "Hiện từ đã biết".</p>
        </div>
      ) : (
        <>
          <div className="fc-wrap" onClick={() => setFlipped(f => !f)}>
            <div className={`fc-inner ${flipped ? 'flipped' : ''}`}>
              {/* Front */}
              <div className="fc-face fc-front">
                <span className={`badge badge-${word.level} fc-level`}>{word.level}</span>
                <div className="fc-hanzi">{word.hanzi}</div>
                <div className="fc-pinyin">{word.pinyin}</div>
                <span className="fc-hint">Nhấn để xem nghĩa</span>
              </div>
              {/* Back */}
              <div className="fc-face fc-back">
                <span className={`badge badge-${word.band} fc-level`}>Band {word.band}</span>
                <div className="fc-hanzi" style={{ fontSize: '2.2rem' }}>{word.hanzi}</div>
                <div className="fc-pinyin">{word.pinyin}</div>
                <div className="divider" style={{ width: '50%' }} />
                <div className="fc-meaning">{word.meaning}</div>
                {word.pos && <div className="fc-pos">{word.pos}</div>}
              </div>
            </div>
          </div>

          {/* Action row */}
          <div className="flex-center gap-8" style={{ marginBottom: 8 }}>
            <button className="btn btn-outline" onClick={() => go(-1)} disabled={idx === 0}>← Trước</button>
            <button className="btn btn-danger"  onClick={() => markWord(word.hanzi, false)}>✗ Chưa biết</button>
            <button className="btn btn-success" onClick={() => { markWord(word.hanzi, true); go(1); }}>✓ Đã biết</button>
            <button className="btn btn-outline" onClick={() => go(1)} disabled={idx === total - 1}>Sau →</button>
          </div>
          <div className="flex-center">
            <button className="btn btn-ghost btn-sm" onClick={shuffle}>↺ Ngẫu nhiên</button>
          </div>
        </>
      )}
    </div>
  );
};
