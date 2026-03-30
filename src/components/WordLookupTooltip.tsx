/**
 * WordLookupTooltip
 *
 * Bôi đen văn bản CJK → popup nổi gồm:
 *  - Văn bản đã chọn (truncated nếu dài)
 *  - Pinyin + nghĩa Tiếng Việt (chỉ với từ ≤8 ký tự CJK)
 *  - Nút 🔊 Phát âm (SpeechSynthesis, miễn phí)
 *  - Nút 🖍 Highlight với 4 màu → lưu vào HighlightsContext (BE + localStorage)
 *
 * Design: SVG icons, minimal, hoạt động tốt với đoạn ngắn lẫn đoạn dài.
 */
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useApiKey } from '../contexts/ApiKeyContext';
import { useHighlights, type NewHighlight } from '../contexts/HighlightsContext';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const HAS_CJK_RE  = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/;
const SHORT_CJK_RE = /^[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]{1,8}$/;

const COLORS = [
  { hex: '#fde68a', label: 'Vàng' },
  { hex: '#bbf7d0', label: 'Xanh lá' },
  { hex: '#bfdbfe', label: 'Xanh dương' },
  { hex: '#fecaca', label: 'Đỏ' },
];

// ─── In-memory lookup cache ───────────────────────────────────────────────────
const cache: Record<string, { pinyin: string; meaning: string }> = {};

async function lookupWord(apiKey: string, word: string) {
  if (cache[word]) return cache[word];
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'Bạn là từ điển Hán-Việt (Tiếng Trung Phồn Thể). Trả lời CHÍNH XÁC theo format JSON: {"pinyin":"...","meaning":"..."}\n' +
            'Pinyin phải có dấu thanh đầy đủ. Meaning là nghĩa tiếng Việt ngắn gọn (1–6 từ). Không thêm text ngoài JSON.',
        },
        { role: 'user', content: word },
      ],
      temperature: 0.1,
      max_tokens: 80,
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { choices: { message: { content: string } }[] };
  const raw   = data.choices[0]?.message?.content ?? '{}';
  const match = raw.match(/\{[^}]+\}/);
  const parsed = match ? (JSON.parse(match[0]) as { pinyin?: string; meaning?: string }) : {};
  const result = { pinyin: parsed.pinyin ?? '—', meaning: parsed.meaning ?? '—' };
  cache[word] = result;
  return result;
}

function speak(word: string) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(word);
  utt.lang = 'zh-TW'; utt.rate = 0.85; utt.pitch = 1;
  window.speechSynthesis.speak(utt);
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────
const IcoSpeaker = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
  </svg>
);

const IcoMarker = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m9 11-6 6v3h9l3-3"/>
    <path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>
  </svg>
);

const IcoCheck = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

// ─── Tooltip state ────────────────────────────────────────────────────────────
interface TipState {
  word:      string;
  isLong:    boolean;   // word.length > 8 CJK chars
  x:         number;
  y:         number;
  flipDown:  boolean;
  pinyin:    string;
  meaning:   string;
  loading:   boolean;
  ctxBefore: string;
  ctxAfter:  string;
  pageKey:   string;
}

// ─── Component ────────────────────────────────────────────────────────────────
export const WordLookupTooltip: React.FC = () => {
  const { apiKey, hasKey } = useApiKey();
  const { add }            = useHighlights();
  const [tip,     setTip    ] = useState<TipState | null>(null);
  const [showHl,  setShowHl ] = useState(false);
  const [hlSaved, setHlSaved] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const pendingRef = useRef<string>('');

  useEffect(() => {
    const handlePointerUp = async (e: PointerEvent) => {
      if (tooltipRef.current?.contains(e.target as Node)) return;
      await new Promise(r => setTimeout(r, 60));

      const sel  = window.getSelection();
      const word = sel?.toString().trim() ?? '';
      if (!word || !HAS_CJK_RE.test(word)) { setTip(null); return; }

      const range   = sel!.getRangeAt(0);
      const rect    = range.getBoundingClientRect();
      const centerX = rect.left + rect.width  / 2 + window.scrollX;
      const topY    = rect.top  + window.scrollY;
      const botY    = rect.bottom + window.scrollY;
      const flipDown = rect.top < 150;

      // ── Walk DOM up from startContainer to find page_key + full text ────────
      const startNode = range.startContainer;
      const startEl   = startNode.nodeType === Node.TEXT_NODE
        ? startNode.parentElement
        : (startNode as HTMLElement);

      let pageKey  = '';
      let fullText = startEl?.textContent ?? '';
      let walker: HTMLElement | null = startEl;
      while (walker) {
        const pk = walker.dataset?.pageKey;
        if (pk) {
          pageKey  = pk;
          // Use this element's full textContent for better ctx extraction
          fullText = walker.textContent ?? fullText;
          break;
        }
        walker = walker.parentElement;
      }

      // ── Context extraction ─────────────────────────────────────────────────
      const wordIdx  = fullText.indexOf(word);
      const ctxBefore = wordIdx > 0
        ? fullText.slice(Math.max(0, wordIdx - 30), wordIdx)
        : '';
      const ctxAfter = wordIdx >= 0
        ? fullText.slice(wordIdx + word.length, wordIdx + word.length + 30)
        : '';

      const isLong = !SHORT_CJK_RE.test(word);

      setShowHl(false);
      setHlSaved(false);
      setTip({
        word, isLong, ctxBefore, ctxAfter, pageKey,
        x: centerX, y: flipDown ? botY + 10 : topY - 10, flipDown,
        pinyin: '', meaning: '', loading: !isLong,
      });

      if (isLong) return; // no pinyin fetch for long text

      if (!hasKey) {
        setTip(prev => prev?.word === word
          ? { ...prev, loading: false, pinyin: '', meaning: 'Cần API key để tra nghĩa' }
          : prev);
        return;
      }

      pendingRef.current = word;
      try {
        const result = await lookupWord(apiKey, word);
        if (pendingRef.current === word)
          setTip(prev => prev?.word === word ? { ...prev, loading: false, ...result } : prev);
      } catch {
        if (pendingRef.current === word)
          setTip(prev => prev?.word === word
            ? { ...prev, loading: false, pinyin: '', meaning: 'Lỗi kết nối' }
            : prev);
      }
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) setTip(null);
    };
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setTip(null); };

    document.addEventListener('pointerup',   handlePointerUp);
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown',     handleKey);
    return () => {
      document.removeEventListener('pointerup',   handlePointerUp);
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown',     handleKey);
    };
  }, [apiKey, hasKey]);

  if (!tip) return null;

  const saveHighlight = async (color: string) => {
    if (!tip) return;
    const pk = tip.pageKey || `hl_${Date.now()}`;
    const h: NewHighlight = {
      page_key:   pk,
      text:       tip.word,
      ctx_before: tip.ctxBefore || undefined,
      ctx_after:  tip.ctxAfter  || undefined,
      color,
      // Persist pinyin/meaning so they show again when clicking the highlight later
      pinyin:  (!tip.isLong && tip.pinyin  && tip.pinyin  !== '—') ? tip.pinyin  : undefined,
      meaning: (!tip.isLong && tip.meaning && tip.meaning !== '—') ? tip.meaning : undefined,
    };
    await add(h);
    setShowHl(false);
    setHlSaved(true);
    setTimeout(() => setHlSaved(false), 1800);
  };

  // ── Position ─────────────────────────────────────────────────────────────────
  const tooltipStyle: React.CSSProperties = {
    position:     'absolute',
    left:         tip.x,
    top:          tip.y,
    transform:    tip.flipDown ? 'translateX(-50%)' : 'translate(-50%, -100%)',
    zIndex:       99999,
    background:   '#16213e',
    color:        '#e2e8f0',
    borderRadius: 14,
    padding:      0,
    boxShadow:    '0 12px 40px rgba(0,0,0,.45), 0 2px 8px rgba(0,0,0,.3), 0 0 0 1px rgba(255,255,255,.06)',
    minWidth:     200,
    maxWidth:     300,
    pointerEvents:'auto',
    userSelect:   'none',
    overflow:     'hidden',
    fontFamily:   'inherit',
  };

  const arrowStyle = (down: boolean): React.CSSProperties => ({
    position:  'absolute',
    [down ? 'top' : 'bottom']: -6,
    left:      '50%',
    transform: 'translateX(-50%)',
    width: 0, height: 0,
    borderLeft:  '7px solid transparent',
    borderRight: '7px solid transparent',
    ...(down
      ? { borderBottom: '7px solid #16213e' }
      : { borderTop:    '7px solid #16213e' }),
  });

  const displayWord = tip.word.length > 24
    ? tip.word.slice(0, 22) + '…'
    : tip.word;

  return createPortal(
    <div ref={tooltipRef} style={tooltipStyle}>
      {/* Arrow */}
      <div style={arrowStyle(tip.flipDown)} />

      {/* ── Content area ───────────────────────────────────────────────── */}
      <div style={{ padding: '14px 16px 10px' }}>

        {/* Selected text */}
        <div style={{
          fontSize:      tip.isLong ? '1rem' : '1.5rem',
          fontWeight:    700,
          color:         '#f8fafc',
          lineHeight:    1.25,
          letterSpacing: tip.isLong ? '.01em' : '.06em',
          marginBottom:  4,
          wordBreak:     'break-all',
        }}>
          {displayWord}
        </div>

        {/* Char count for long text */}
        {tip.isLong && (
          <div style={{ fontSize: '.72rem', color: '#64748b', marginBottom: 6 }}>
            {tip.word.length} ký tự đã chọn
          </div>
        )}

        {/* Pinyin + meaning (short words only) */}
        {!tip.isLong && (
          tip.loading ? (
            <div style={{ fontSize: '.75rem', color: '#475569', padding: '2px 0 6px' }}>
              <LoadingDots />
            </div>
          ) : (
            <>
              {tip.pinyin && tip.pinyin !== '—' && (
                <div style={{
                  fontSize: '.82rem', color: '#7dd3fc',
                  fontStyle: 'italic', letterSpacing: '.03em', marginBottom: 2,
                }}>
                  {tip.pinyin}
                </div>
              )}
              {tip.meaning && tip.meaning !== '—' && (
                <div style={{
                  fontSize: '.85rem', fontWeight: 600, color: '#cbd5e1', marginBottom: 4,
                }}>
                  {tip.meaning}
                </div>
              )}
            </>
          )
        )}
      </div>

      {/* ── Divider ──────────────────────────────────────────────────────── */}
      <div style={{ height: 1, background: 'rgba(255,255,255,.07)', margin: '0 16px' }} />

      {/* ── Action buttons ───────────────────────────────────────────────── */}
      <div style={{
        padding:        '10px 16px',
        display:        'flex',
        gap:            8,
        alignItems:     'center',
      }}>
        {/* Speak */}
        <ActionBtn
          icon={<IcoSpeaker />}
          label="Phát âm"
          onClick={() => speak(tip.word)}
        />

        {/* Highlight / Saved */}
        {hlSaved ? (
          <ActionBtn
            icon={<IcoCheck />}
            label="Đã lưu"
            accent="#86efac"
          />
        ) : (
          <ActionBtn
            icon={<IcoMarker />}
            label="Highlight"
            active={showHl}
            onClick={() => setShowHl(v => !v)}
          />
        )}
      </div>

      {/* ── Color picker ────────────────────────────────────────────────── */}
      {showHl && !hlSaved && (
        <div style={{
          borderTop:      '1px solid rgba(255,255,255,.07)',
          padding:        '10px 16px 12px',
          display:        'flex',
          gap:            10,
          justifyContent: 'center',
          alignItems:     'center',
        }}>
          {COLORS.map(c => (
            <ColorSwatch
              key={c.hex}
              color={c.hex}
              label={c.label}
              onPick={() => saveHighlight(c.hex)}
            />
          ))}
        </div>
      )}
    </div>,
    document.body,
  );
};

// ─── Sub-components ───────────────────────────────────────────────────────────

interface ActionBtnProps {
  icon:     React.ReactNode;
  label:    string;
  onClick?: () => void;
  active?:  boolean;
  accent?:  string;
}

const ActionBtn: React.FC<ActionBtnProps> = ({ icon, label, onClick, active, accent }) => {
  const base = accent
    ? { background: `${accent}18`, color: accent, border: `1px solid ${accent}40` }
    : active
    ? { background: 'rgba(148,163,184,.22)', color: '#f1f5f9', border: '1px solid rgba(148,163,184,.3)' }
    : { background: 'rgba(255,255,255,.07)', color: '#94a3b8', border: '1px solid rgba(255,255,255,.1)' };

  return (
    <button
      onPointerDown={e => e.stopPropagation()}
      onClick={onClick}
      style={{
        display:      'flex',
        alignItems:   'center',
        gap:          5,
        padding:      '5px 12px 5px 10px',
        borderRadius: 8,
        cursor:       onClick ? 'pointer' : 'default',
        fontSize:     '.75rem',
        fontWeight:   600,
        fontFamily:   'inherit',
        transition:   'background .12s, color .12s',
        flexShrink:   0,
        ...base,
      }}
      onMouseEnter={e => {
        if (!accent && !active) {
          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,.14)';
          (e.currentTarget as HTMLButtonElement).style.color = '#f1f5f9';
        }
      }}
      onMouseLeave={e => {
        if (!accent && !active) {
          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,.07)';
          (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8';
        }
      }}
    >
      {icon}
      {label}
    </button>
  );
};

interface ColorSwatchProps {
  color:  string;
  label:  string;
  onPick: () => void;
}

const ColorSwatch: React.FC<ColorSwatchProps> = ({ color, label, onPick }) => (
  <button
    title={label}
    onPointerDown={e => e.stopPropagation()}
    onClick={onPick}
    style={{
      width:        28,
      height:       28,
      borderRadius: '50%',
      background:   color,
      border:       '2px solid rgba(255,255,255,.18)',
      cursor:       'pointer',
      transition:   'transform .12s, box-shadow .12s',
      flexShrink:   0,
    }}
    onMouseEnter={e => {
      const el = e.currentTarget as HTMLButtonElement;
      el.style.transform  = 'scale(1.22)';
      el.style.boxShadow  = `0 0 0 3px ${color}60`;
    }}
    onMouseLeave={e => {
      const el = e.currentTarget as HTMLButtonElement;
      el.style.transform  = 'none';
      el.style.boxShadow  = 'none';
    }}
  />
);

const LoadingDots: React.FC = () => (
  <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center', height: 14 }}>
    {[0, 1, 2].map(i => (
      <span key={i} style={{
        width: 5, height: 5,
        borderRadius: '50%',
        background: '#475569',
        display: 'inline-block',
        animation: `iv-dot-bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
      }} />
    ))}
  </span>
);
