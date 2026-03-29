import React, { useCallback, useRef, useState } from 'react';

function pickVoice(): SpeechSynthesisVoice | null {
  if (!('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find(v => v.lang === 'zh-TW') ??
    voices.find(v => v.lang === 'zh-HK') ??
    voices.find(v => v.lang.startsWith('zh')) ??
    null
  );
}

interface Props {
  /** Chinese text to speak */
  text:     string;
  /** button size: 'sm' | 'md' | 'lg' — default 'md' */
  size?:    'sm' | 'md' | 'lg';
  /** extra className */
  className?: string;
}

export const SpeakButton: React.FC<Props> = ({ text, size = 'md', className = '' }) => {
  const [speaking, setSpeaking] = useState(false);
  const utterRef  = useRef<SpeechSynthesisUtterance | null>(null);
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();   // don't flip flashcard etc.
    if (!supported || !text.trim()) return;

    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }

    window.speechSynthesis.cancel();

    const utter  = new SpeechSynthesisUtterance(text);
    utter.rate   = 0.82;
    utter.pitch  = 1.0;
    const voice  = pickVoice();
    if (voice) { utter.voice = voice; utter.lang = voice.lang; }
    else        { utter.lang = 'zh-TW'; }

    utter.onstart = () => setSpeaking(true);
    utter.onend   = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);

    utterRef.current = utter;
    requestAnimationFrame(() => window.speechSynthesis.speak(utter));
  }, [text, speaking, supported]);

  if (!supported) return null;

  const sizeClass = size === 'sm' ? 'speak-btn--sm' : size === 'lg' ? 'speak-btn--lg' : '';
  const iconSize  = size === 'sm' ? 13 : size === 'lg' ? 20 : 16;

  return (
    <button
      className={`speak-btn ${sizeClass} ${speaking ? 'speaking' : ''} ${className}`}
      onClick={handleClick}
      title={speaking ? 'Dừng' : 'Nghe phát âm'}
      aria-label={speaking ? 'Dừng phát âm' : 'Phát âm'}
      type="button"
    >
      {speaking
        ? <span className="speak-wave"><span /><span /><span /></span>
        : <svg
            width={iconSize}
            height={iconSize}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          </svg>
      }
    </button>
  );
};
