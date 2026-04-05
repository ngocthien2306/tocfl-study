import React, { useMemo, useState } from 'react';
import type { Word, Progress } from '../../types';
import { useLang } from '../../i18n/LangContext';
import { SpeakButton } from '../UI/SpeakButton';
import { IconCheck, IconShuffle } from '../UI/Icons';

interface Props {
  vocabulary: Word[];
  progress: Progress;
  markWord: (hanzi: string, known: boolean) => void;
}

type BandFilter  = 'all' | 'A' | 'B' | 'C';
type LevelFilter = 'all' | 'A1' | 'A2' | 'A3' | 'A4' | 'B1' | 'B2' | 'C1';

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

export const FlashcardModule: React.FC<Props> = ({ vocabulary, progress, markWord }) => {
  const { lang } = useLang();
  const [band,        setBand]        = useState<BandFilter>('all');
  const [level,       setLevel]       = useState<LevelFilter>('all');
  const [context,     setContext]     = useState<string>('all');
  const [hideKnown,   setHideKnown]   = useState(false);
  const [hidePinyin,  setHidePinyin]  = useState(false);
  const [hideMeaning, setHideMeaning] = useState(false);
  const [idx,         setIdx]         = useState(0);
  const [flipped,     setFlipped]     = useState(false);

  const availableContexts = useMemo(() => {
    const ctxSet = new Set<string>();
    vocabulary.forEach(w => {
      if (band !== 'all' && w.band !== band) return;
      if (level !== 'all' && w.level !== level) return;
      if (w.context) ctxSet.add(w.context);
    });
    return Array.from(ctxSet).sort();
  }, [vocabulary, band, level]);

  const filtered = useMemo(() => {
    return vocabulary.filter(w => {
      if (band    !== 'all' && w.band    !== band)    return false;
      if (level   !== 'all' && w.level   !== level)   return false;
      if (context !== 'all' && w.context !== context) return false;
      if (hideKnown && progress.known[w.hanzi])       return false;
      return true;
    });
  }, [vocabulary, band, level, context, hideKnown, progress.known]);

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
    setter(val); setIdx(0); setFlipped(false);
  }

  const byCounts = useMemo(() => {
    const map: Record<string, number> = {};
    vocabulary.forEach(w => { map[w.level] = (map[w.level] ?? 0) + 1; });
    return map;
  }, [vocabulary]);

  const lbl = {
    vi: {
      bandAll: 'Tất cả', levelAll: 'Tất cả', ctxAll: 'Tất cả chủ đề',
      known: 'Đã thuộc', total_w: 'Tổng từ', filter_band: 'Band',
      filter_level: 'Cấp độ', filter_ctx: 'Chủ đề',
      mark_known: '✓ Đã thuộc', mark_unknown: '✗ Chưa thuộc',
      hide_known: 'Ẩn đã biết', hide_pinyin: 'Ẩn pinyin', hide_meaning: 'Ẩn nghĩa',
      no_words: 'Không có từ nào phù hợp', no_meaning: '(chưa có bản dịch)',
      prev: 'Trước', next: 'Sau', flip_hint: '↩ Nhấn để lật',
    },
    zh: {
      bandAll: '全部', levelAll: '全部', ctxAll: '全部主題',
      known: '已學習', total_w: '總字數', filter_band: '級別',
      filter_level: '等級', filter_ctx: '主題',
      mark_known: '✓ 已會', mark_unknown: '✗ 不會',
      hide_known: '隱藏已學', hide_pinyin: '隱藏拼音', hide_meaning: '隱藏釋義',
      no_words: '沒有符合的詞彙', no_meaning: '(暫無翻譯)',
      prev: '上一個', next: '下一個', flip_hint: '↩ 點擊翻轉',
    },
    en: {
      bandAll: 'All', levelAll: 'All', ctxAll: 'All topics',
      known: 'Known', total_w: 'Total', filter_band: 'Band',
      filter_level: 'Level', filter_ctx: 'Topic',
      mark_known: '✓ Known', mark_unknown: '✗ Unknown',
      hide_known: 'Hide known', hide_pinyin: 'Hide pinyin', hide_meaning: 'Hide meaning',
      no_words: 'No matching words', no_meaning: '(no translation)',
      prev: 'Prev', next: 'Next', flip_hint: '↩ Tap to flip',
    },
  }[lang];

  const isKnown   = word ? !!progress.known[word.hanzi] : false;
  const lm        = word ? LEVEL_META[word.level] : null;
  const bandColor = word ? BAND_COLORS[word.band as 'A'|'B'|'C'] ?? BAND_COLORS['A'] : BAND_COLORS['A'];

  return (
    <div>
      {/* ── Stats row ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto', scrollbarWidth: 'none' }}>
        {(['A','B','C'] as const).map(b => {
          const cnt  = vocabulary.filter(w => w.band === b).length;
          const knwn = Object.keys(progress.known).filter(h => {
            const w = vocabulary.find(x => x.hanzi === h);
            return w?.band === b && progress.known[h];
          }).length;
          const pct = cnt > 0 ? Math.round(knwn / cnt * 100) : 0;
          const bc  = BAND_COLORS[b];
          return (
            <div key={b} style={{
              flex: 1, minWidth: 90, borderRadius: 12,
              background: `${bc.grad}28`, border: `1.5px solid ${bc.dark}28`,
              padding: '10px 12px',
            }}>
              <div style={{ fontWeight: 800, fontSize: '.9rem', color: bc.dark }}>Band {b}</div>
              <div style={{ fontSize: '.7rem', color: 'var(--text-muted)', marginTop: 2 }}>
                {cnt} {{ vi:'từ', zh:'詞', en:'words' }[lang]}
              </div>
              <div style={{ marginTop: 6, height: 4, borderRadius: 4, background: `${bc.dark}22`, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: bc.dark, borderRadius: 4 }} />
              </div>
              <div style={{ fontSize: '.62rem', color: bc.dark, marginTop: 3, fontWeight: 700 }}>{pct}%</div>
            </div>
          );
        })}
        <div style={{
          flex: 1, minWidth: 80, borderRadius: 12,
          background: 'var(--accent-light)', border: '1.5px solid var(--accent)',
          padding: '10px 12px',
        }}>
          <div style={{ fontWeight: 800, fontSize: '.9rem', color: 'var(--accent)' }}>{knownCt}</div>
          <div style={{ fontSize: '.7rem', color: 'var(--text-muted)', marginTop: 2 }}>{lbl.known}</div>
          <div style={{ fontSize: '.7rem', color: 'var(--text-muted)', marginTop: 2 }}>{vocabulary.length} {lbl.total_w}</div>
        </div>
      </div>

      {/* ── Filters ───────────────────────────────────────────────────────── */}
      <div className="card card--compact" style={{ marginBottom: 14 }}>
        {/* Band */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: '.65rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>{lbl.filter_band}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(['all','A','B','C'] as BandFilter[]).map(b => {
              const active = band === b;
              const bc = b !== 'all' ? BAND_COLORS[b as 'A'|'B'|'C'] : null;
              return (
                <button key={b}
                  onClick={() => { changeFilter(setBand, b); changeFilter(setLevel, 'all'); changeFilter(setContext, 'all'); }}
                  style={{
                    padding: '4px 14px', borderRadius: 20, fontSize: '.78rem', fontWeight: 700,
                    cursor: 'pointer', border: 'none', fontFamily: 'inherit',
                    background: active ? (bc ? bc.dark : 'var(--accent)') : 'var(--bg)',
                    color: active ? '#fff' : 'var(--text-muted)',
                  }}>
                  {b === 'all' ? lbl.bandAll : `Band ${b}`}
                </button>
              );
            })}
          </div>
        </div>

        {/* Level */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: '.65rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>{lbl.filter_level}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button onClick={() => { changeFilter(setLevel, 'all'); changeFilter(setContext, 'all'); }}
              style={{
                padding: '4px 14px', borderRadius: 20, fontSize: '.78rem', fontWeight: 700,
                cursor: 'pointer', border: 'none', fontFamily: 'inherit',
                background: level === 'all' ? 'var(--accent)' : 'var(--bg)',
                color: level === 'all' ? '#fff' : 'var(--text-muted)',
              }}>
              {lbl.levelAll}
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
                    onClick={() => { changeFilter(setLevel, l); changeFilter(setContext, 'all'); }}
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

        {/* Context */}
        {availableContexts.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: '.65rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>{lbl.filter_ctx}</div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              <button onClick={() => changeFilter(setContext, 'all')}
                style={{
                  padding: '3px 10px', borderRadius: 20, fontSize: '.7rem', fontWeight: 600,
                  cursor: 'pointer', border: 'none', fontFamily: 'inherit',
                  background: context === 'all' ? 'var(--accent)' : 'var(--bg)',
                  color: context === 'all' ? '#fff' : 'var(--text-muted)',
                }}>
                {lbl.ctxAll}
              </button>
              {availableContexts.map(ctx => (
                <button key={ctx}
                  onClick={() => changeFilter(setContext, ctx)}
                  style={{
                    padding: '3px 10px', borderRadius: 20, fontSize: '.7rem', fontWeight: 600,
                    cursor: 'pointer', border: 'none', fontFamily: 'inherit',
                    background: context === ctx ? 'var(--accent)' : 'var(--bg)',
                    color: context === ctx ? '#fff' : 'var(--text)',
                  }}>
                  {ctx}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Toggles */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            { label: lbl.hide_known,   val: hideKnown,   fn: () => changeFilter(setHideKnown, !hideKnown) },
            { label: lbl.hide_pinyin,  val: hidePinyin,  fn: () => setHidePinyin(v => !v) },
            { label: lbl.hide_meaning, val: hideMeaning, fn: () => setHideMeaning(v => !v) },
          ].map(({ label, val, fn }, i) => (
            <button key={i} onClick={fn}
              style={{
                padding: '3px 10px', borderRadius: 20, fontSize: '.7rem', fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
                border: `1.5px solid ${val ? 'var(--accent)' : 'var(--border)'}`,
                background: val ? 'var(--accent-light)' : 'transparent',
                color: val ? 'var(--accent)' : 'var(--text-muted)',
              }}>
              {val ? '● ' : '○ '}{label}
            </button>
          ))}
        </div>
      </div>

      {/* ── No results ────────────────────────────────────────────────────── */}
      {total === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '2rem', marginBottom: 8 }}>🔍</div>
          <div>{lbl.no_words}</div>
        </div>
      )}

      {/* ── Flashcard ─────────────────────────────────────────────────────── */}
      {word && (
        <>
          {/* Progress bar */}
          <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, height: 4, borderRadius: 4, background: 'var(--border)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${((idx+1)/total)*100}%`, background: bandColor.dark, borderRadius: 4, transition: 'width .2s' }} />
            </div>
            <span style={{ fontSize: '.72rem', color: 'var(--text-muted)', flexShrink: 0 }}>{idx+1}/{total}</span>
          </div>

          {/* Card face */}
          <div
            onClick={() => setFlipped(v => !v)}
            style={{
              position: 'relative', borderRadius: 20, overflow: 'hidden', cursor: 'pointer',
              minHeight: 220, marginBottom: 14,
              background: flipped ? 'var(--surface)' : `linear-gradient(145deg, ${bandColor.grad}55, ${bandColor.dark}22)`,
              border: `1.5px solid ${bandColor.dark}30`,
              boxShadow: '0 4px 20px rgba(0,0,0,.08)',
              transition: 'background .2s',
              userSelect: 'none',
            }}
          >
            {lm && (
              <div style={{
                position: 'absolute', top: 14, left: 14,
                background: lm.color, color: '#fff',
                borderRadius: 20, padding: '3px 10px',
                fontSize: '.64rem', fontWeight: 800, letterSpacing: '.04em',
              }}>
                {word.level} · {lm.label}
              </div>
            )}
            {isKnown && (
              <div style={{
                position: 'absolute', top: 14, right: 14,
                background: '#16a34a', color: '#fff',
                borderRadius: 20, padding: '3px 8px',
                fontSize: '.64rem', fontWeight: 800,
              }}>✓</div>
            )}

            <div style={{ padding: '52px 24px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: '3rem', fontWeight: 800, color: 'var(--text)', lineHeight: 1.1, letterSpacing: '.04em' }}>
                {word.hanzi}
              </div>

              {!hidePinyin && (
                <div style={{ fontSize: '1.1rem', color: bandColor.dark, fontWeight: 500, letterSpacing: '.06em' }}>
                  {word.pinyin}
                </div>
              )}

              {(!hideMeaning || flipped) && (
                <div style={{
                  marginTop: 8, fontSize: '1rem', color: 'var(--text)',
                  background: 'rgba(0,0,0,.04)', borderRadius: 10, padding: '10px 18px',
                  maxWidth: 280, textAlign: 'center',
                  fontWeight: flipped ? 600 : 400,
                  opacity: (hideMeaning && !flipped) ? 0 : 1,
                  fontStyle: word.meaning ? 'normal' : 'italic',
                } as React.CSSProperties}>
                  {word.meaning || lbl.no_meaning}
                </div>
              )}

              {flipped && (
                <>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 }}>
                    {word.pos && (
                      <span style={{ background: `${bandColor.dark}18`, color: bandColor.dark, borderRadius: 8, padding: '2px 8px', fontSize: '.68rem', fontWeight: 700 }}>
                        {word.pos}
                      </span>
                    )}
                    {word.context && (
                      <span style={{ background: 'var(--accent-light)', color: 'var(--accent)', borderRadius: 8, padding: '2px 8px', fontSize: '.68rem', fontWeight: 600 }}>
                        {word.context}
                      </span>
                    )}
                  </div>
                  {word.example && (
                    <div style={{
                      marginTop: 10, fontSize: '.78rem', color: 'var(--text-muted)',
                      background: 'var(--bg)', borderRadius: 8, padding: '8px 12px',
                      textAlign: 'left', maxWidth: 300, lineHeight: 1.6,
                      borderLeft: `3px solid ${bandColor.dark}`,
                    }}>
                      {word.example}
                    </div>
                  )}
                </>
              )}

              {!flipped && (
                <div style={{ marginTop: 12, fontSize: '.66rem', color: 'var(--text-muted)', opacity: .7 }}>
                  {lbl.flip_hint}
                </div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
            <button
              onClick={() => markWord(word.hanzi, !isKnown)}
              style={{
                flex: 1, minHeight: 48, borderRadius: 12, cursor: 'pointer',
                border: `2px solid ${isKnown ? '#16a34a' : 'var(--border)'}`,
                background: isKnown ? '#f0fdf4' : 'var(--surface)',
                color: isKnown ? '#16a34a' : 'var(--text-muted)',
                fontFamily: 'inherit', fontSize: '.88rem', fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              <IconCheck size={16} />
              {isKnown ? lbl.mark_known : lbl.mark_unknown}
            </button>
            <button onClick={shuffle}
              style={{
                width: 48, height: 48, borderRadius: 12, cursor: 'pointer',
                border: '1.5px solid var(--border)', background: 'var(--surface)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
              <IconShuffle size={18} />
            </button>
            <SpeakButton text={word.hanzi} />
          </div>

          {/* Prev / Next */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => go(-1)} disabled={idx === 0}
              style={{
                flex: 1, minHeight: 44, borderRadius: 12, cursor: idx === 0 ? 'not-allowed' : 'pointer',
                border: '1.5px solid var(--border)', background: 'var(--surface)',
                fontFamily: 'inherit', fontSize: '.88rem', fontWeight: 600, color: 'var(--text)',
                opacity: idx === 0 ? .4 : 1,
              }}>
              ← {lbl.prev}
            </button>
            <button onClick={() => go(1)} disabled={idx === total - 1}
              style={{
                flex: 1, minHeight: 44, borderRadius: 12, cursor: idx === total-1 ? 'not-allowed' : 'pointer',
                border: '1.5px solid var(--border)', background: 'var(--surface)',
                fontFamily: 'inherit', fontSize: '.88rem', fontWeight: 600, color: 'var(--text)',
                opacity: idx === total-1 ? .4 : 1,
              }}>
              {lbl.next} →
            </button>
          </div>

          {/* Dot paginator (only for small sets) */}
          {total <= 80 && (
            <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 5, justifyContent: 'center' }}>
              {filtered.map((w, i) => (
                <div key={w.hanzi + i} onClick={() => jump(i)} title={w.hanzi}
                  style={{
                    width: 10, height: 10, borderRadius: '50%', cursor: 'pointer',
                    background: i === idx ? bandColor.dark : progress.known[w.hanzi] ? '#16a34a' : 'var(--border)',
                    transition: 'background .15s',
                  }} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};
