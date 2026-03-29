import { useState, useCallback, useRef } from 'react';

const ZH_LANG = 'zh-TW';   // phồn thể — ưu tiên zh-TW

/** Chọn giọng tiếng Trung tốt nhất hiện có */
function pickVoice(): SpeechSynthesisVoice | null {
  if (!('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  // ưu tiên: zh-TW, sau đó zh-HK, sau đó zh
  return (
    voices.find(v => v.lang === 'zh-TW') ??
    voices.find(v => v.lang === 'zh-HK') ??
    voices.find(v => v.lang.startsWith('zh')) ??
    null
  );
}

export interface UseSpeechReturn {
  speak:     (text: string) => void;
  stop:      () => void;
  speaking:  boolean;
  supported: boolean;
}

export function useSpeech(): UseSpeechReturn {
  const [speaking, setSpeaking] = useState(false);
  const utterRef  = useRef<SpeechSynthesisUtterance | null>(null);
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  const stop = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported]);

  const speak = useCallback((text: string) => {
    if (!supported || !text.trim()) return;

    // cancel any ongoing speech
    window.speechSynthesis.cancel();
    setSpeaking(false);

    const utter = new SpeechSynthesisUtterance(text);
    utter.rate  = 0.82;
    utter.pitch = 1.0;

    // Assign best available voice
    const voice = pickVoice();
    if (voice) {
      utter.voice = voice;
      utter.lang  = voice.lang;
    } else {
      utter.lang = ZH_LANG;
    }

    utter.onstart = () => setSpeaking(true);
    utter.onend   = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);

    utterRef.current = utter;

    // Some browsers need a small delay after cancel()
    requestAnimationFrame(() => {
      window.speechSynthesis.speak(utter);
    });
  }, [supported]);

  return { speak, stop, speaking, supported };
}

/** Standalone speak helper (no hook needed — for use outside React) */
export function speakText(text: string, lang = ZH_LANG): void {
  if (!('speechSynthesis' in window) || !text.trim()) return;
  window.speechSynthesis.cancel();
  const utter  = new SpeechSynthesisUtterance(text);
  const voice  = pickVoice();
  if (voice) { utter.voice = voice; utter.lang = voice.lang; }
  else        { utter.lang = lang; }
  utter.rate = 0.82;
  requestAnimationFrame(() => window.speechSynthesis.speak(utter));
}
