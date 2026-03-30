/**
 * HighlightableText
 *
 * Renders a block of Chinese text with persisted highlights.
 * - Splits text into segments: plain or highlighted
 * - Clicking a highlighted span opens a small delete popup
 * - New highlights are added via the WordLookupTooltip (external flow)
 *
 * Props:
 *   text      — full passage / sentence string
 *   page_key  — identifier for the page, used for context matching
 *   className — forwarded to the wrapper <span>
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useHighlights } from '../contexts/HighlightsContext';
import type { HighlightRecord } from '../api/client';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Segment {
  text:      string;
  highlight: HighlightRecord | null;
}

// ─── Text splitting ───────────────────────────────────────────────────────────
/**
 * Given the full text and a list of highlights for this page_key,
 * try to locate each highlight using ctx_before/ctx_after and split
 * the text into alternating plain/highlighted segments.
 */
function buildSegments(text: string, highlights: HighlightRecord[]): Segment[] {
  if (!highlights.length) return [{ text, highlight: null }];

  // Find the best match position for each highlight
  type Located = { start: number; end: number; h: HighlightRecord };
  const located: Located[] = [];

  for (const h of highlights) {
    const needle = h.text;
    // Try to find with context first (most precise)
    let idx = -1;
    if (h.ctx_before) {
      const anchor = h.ctx_before + needle;
      const pos = text.indexOf(anchor);
      if (pos !== -1) {
        idx = pos + h.ctx_before.length;
      }
    }
    // Fallback: plain search
    if (idx === -1) {
      idx = text.indexOf(needle);
    }
    if (idx !== -1) {
      located.push({ start: idx, end: idx + needle.length, h });
    }
  }

  if (!located.length) return [{ text, highlight: null }];

  // Sort by start position; resolve overlaps (keep first)
  located.sort((a, b) => a.start - b.start);
  const resolved: Located[] = [];
  let cursor = 0;
  for (const loc of located) {
    if (loc.start < cursor) continue; // overlaps previous
    resolved.push(loc);
    cursor = loc.end;
  }

  // Build segments
  const segments: Segment[] = [];
  let pos = 0;
  for (const loc of resolved) {
    if (loc.start > pos) {
      segments.push({ text: text.slice(pos, loc.start), highlight: null });
    }
    segments.push({ text: text.slice(loc.start, loc.end), highlight: loc.h });
    pos = loc.end;
  }
  if (pos < text.length) {
    segments.push({ text: text.slice(pos), highlight: null });
  }
  return segments;
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────
const IcoTrash = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6M14 11v6"/>
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
);

const IcoSpeakerSm = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
  </svg>
);

// ─── DeletePopup ─────────────────────────────────────────────────────────────
interface DeletePopupProps {
  x:        number;
  y:        number;
  flipDown: boolean;
  h:        HighlightRecord;
  onDelete: () => void;
  onClose:  () => void;
}

const DeletePopup: React.FC<DeletePopupProps> = ({ x, y, flipDown, h, onDelete, onClose }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('pointerdown', handle);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('pointerdown', handle);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  const hasMeaning = !!(h.pinyin || h.meaning);
  const isLongText = h.text.length > 8;
  const displayText = h.text.length > 24 ? h.text.slice(0, 22) + '…' : h.text;

  const speak = () => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(h.text);
    utt.lang = 'zh-TW'; utt.rate = 0.85;
    window.speechSynthesis.speak(utt);
  };

  return createPortal(
    <div
      ref={ref}
      style={{
        position:      'absolute',
        left:          x,
        top:           y,
        transform:     flipDown ? 'translateX(-50%)' : 'translate(-50%, -100%)',
        zIndex:        99998,
        background:    '#16213e',
        color:         '#e2e8f0',
        borderRadius:  14,
        padding:       0,
        boxShadow:     '0 12px 40px rgba(0,0,0,.45), 0 2px 8px rgba(0,0,0,.3), 0 0 0 1px rgba(255,255,255,.06)',
        minWidth:      200,
        maxWidth:      300,
        pointerEvents: 'auto',
        userSelect:    'none',
        overflow:      'hidden',
        fontFamily:    'inherit',
      }}
    >
      {/* Arrow */}
      <div style={{
        position:  'absolute',
        [flipDown ? 'top' : 'bottom']: -6,
        left:      '50%',
        transform: 'translateX(-50%)',
        width: 0, height: 0,
        borderLeft:  '7px solid transparent',
        borderRight: '7px solid transparent',
        ...(flipDown
          ? { borderBottom: '7px solid #16213e' }
          : { borderTop:    '7px solid #16213e' }),
      }} />

      {/* ── Content ─────────────────────────────────────────────── */}
      <div style={{ padding: '14px 16px 10px' }}>
        {/* Color dot + label */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8,
        }}>
          <span style={{
            width: 10, height: 10, borderRadius: '50%',
            background: h.color, flexShrink: 0,
            boxShadow: `0 0 0 2px ${h.color}50`,
          }} />
          <span style={{ fontSize: '.7rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>
            Highlight đã lưu
          </span>
        </div>

        {/* Hanzi / selected text */}
        <div style={{
          fontSize:      isLongText ? '1rem' : '1.5rem',
          fontWeight:    700,
          color:         '#f8fafc',
          lineHeight:    1.25,
          letterSpacing: isLongText ? '.01em' : '.06em',
          marginBottom:  hasMeaning ? 4 : 0,
          wordBreak:     'break-all',
        }}>
          {displayText}
        </div>

        {/* Pinyin */}
        {h.pinyin && (
          <div style={{
            fontSize: '.82rem', color: '#7dd3fc',
            fontStyle: 'italic', letterSpacing: '.03em', marginBottom: 2,
          }}>
            {h.pinyin}
          </div>
        )}

        {/* Meaning */}
        {h.meaning && (
          <div style={{
            fontSize: '.85rem', fontWeight: 600, color: '#cbd5e1',
          }}>
            {h.meaning}
          </div>
        )}
      </div>

      {/* ── Divider ──────────────────────────────────────────────── */}
      <div style={{ height: 1, background: 'rgba(255,255,255,.07)', margin: '0 16px' }} />

      {/* ── Actions ──────────────────────────────────────────────── */}
      <div style={{
        padding: '10px 16px', display: 'flex', gap: 8, alignItems: 'center',
      }}>
        {/* Speak */}
        <button
          onPointerDown={e => e.stopPropagation()}
          onClick={speak}
          style={actionBtnStyle(false)}
          onMouseEnter={e => Object.assign((e.currentTarget as HTMLButtonElement).style, hoverOn)}
          onMouseLeave={e => Object.assign((e.currentTarget as HTMLButtonElement).style, hoverOff)}
        >
          <IcoSpeakerSm /> Phát âm
        </button>

        {/* Delete */}
        <button
          onPointerDown={e => e.stopPropagation()}
          onClick={onDelete}
          style={actionBtnStyle(true)}
          onMouseEnter={e => Object.assign((e.currentTarget as HTMLButtonElement).style, { background: 'rgba(239,68,68,.28)', color: '#fca5a5', borderColor: 'rgba(239,68,68,.5)' })}
          onMouseLeave={e => Object.assign((e.currentTarget as HTMLButtonElement).style, actionBtnStyle(true))}
        >
          <IcoTrash /> Xoá
        </button>
      </div>
    </div>,
    document.body,
  );
};

const actionBtnStyle = (danger: boolean): React.CSSProperties => ({
  display:      'flex',
  alignItems:   'center',
  gap:          5,
  padding:      '5px 12px 5px 10px',
  borderRadius: 8,
  cursor:       'pointer',
  fontSize:     '.75rem',
  fontWeight:   600,
  fontFamily:   'inherit',
  background:   danger ? 'rgba(239,68,68,.15)' : 'rgba(255,255,255,.07)',
  color:        danger ? '#fca5a5'             : '#94a3b8',
  border:       danger ? '1px solid rgba(239,68,68,.35)' : '1px solid rgba(255,255,255,.1)',
  transition:   'background .12s, color .12s',
});

const hoverOn:  React.CSSProperties = { background: 'rgba(255,255,255,.14)', color: '#f1f5f9' };
const hoverOff: React.CSSProperties = { background: 'rgba(255,255,255,.07)', color: '#94a3b8' };

// ─── Main component ───────────────────────────────────────────────────────────
interface HighlightableTextProps {
  text:      string;
  page_key:  string;
  className?: string;
  style?:    React.CSSProperties;
}

interface PopupState {
  x:        number;
  y:        number;
  flipDown: boolean;
  h:        HighlightRecord;
}

export const HighlightableText: React.FC<HighlightableTextProps> = ({
  text, page_key, className, style,
}) => {
  const { getForPage, remove } = useHighlights();
  const pageHighlights = getForPage(page_key);
  const segments = buildSegments(text, pageHighlights);

  const [popup, setPopup] = useState<PopupState | null>(null);

  const handleHighlightClick = useCallback(
    (e: React.MouseEvent, h: HighlightRecord) => {
      e.stopPropagation();
      const rect     = (e.target as HTMLElement).getBoundingClientRect();
      const flipDown = rect.top < 150;
      setPopup({
        x:        rect.left + rect.width / 2 + window.scrollX,
        y:        flipDown  ? rect.bottom + window.scrollY + 10
                            : rect.top   + window.scrollY - 10,
        flipDown,
        h,
      });
    },
    [],
  );

  const handleDelete = useCallback(async () => {
    if (!popup) return;
    await remove(popup.h.id);
    setPopup(null);
  }, [popup, remove]);

  return (
    <>
      {/* data-page-key here lets WordLookupTooltip find the page key via DOM walk-up */}
      <span
        className={className}
        style={style}
        data-page-key={page_key}
        data-highlightable="true"
      >
        {segments.map((seg, i) =>
          seg.highlight ? (
            <mark
              key={i}
              onClick={e => handleHighlightClick(e, seg.highlight!)}
              title="Click để xoá highlight"
              style={{
                background:    seg.highlight.color,
                borderRadius:  3,
                padding:       '1px 0',
                cursor:        'pointer',
                color:         'inherit',
                // subtle pulse on hover
                transition:    'filter .15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(0.88)')}
              onMouseLeave={e => (e.currentTarget.style.filter = 'none')}
            >
              {seg.text}
            </mark>
          ) : (
            <span key={i}>{seg.text}</span>
          )
        )}
      </span>

      {popup && (
        <DeletePopup
          x={popup.x}
          y={popup.y}
          flipDown={popup.flipDown}
          h={popup.h}
          onDelete={handleDelete}
          onClose={() => setPopup(null)}
        />
      )}
    </>
  );
};
