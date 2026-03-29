/**
 * useSpeechRecognition
 *
 * Wraps the browser's Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`).
 *
 * Usage:
 *   const { isListening, interimText, start, stop, supported } =
 *     useSpeechRecognition({ lang: 'vi-VN', onResult: (text) => send(text) });
 *
 * - `start()`   begins recording; recognition auto-stops after a pause.
 * - `stop()`    forces recording to stop immediately.
 * - `onResult`  is called with the final recognised text when recording ends.
 * - `interimText` is the live partial transcript while the user is speaking.
 */

import { useState, useRef, useCallback } from 'react';

// ── Type shims (Web Speech API is not fully covered by all TS DOM libs) ─────────

interface SpeechRecognitionResultItem {
  readonly transcript: string;
  readonly confidence: number;
}
interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length:  number;
  [index: number]: SpeechRecognitionResultItem;
}
interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results:     SpeechRecognitionResultList;
}
interface SpeechRecognitionErrorEvent extends Event {
  readonly error:   string;
  readonly message: string;
}
interface ISpeechRecognition extends EventTarget {
  lang:            string;
  interimResults:  boolean;
  continuous:      boolean;
  maxAlternatives: number;
  onresult:  ((ev: SpeechRecognitionEvent) => void)      | null;
  onend:     ((ev: Event) => void)                       | null;
  onerror:   ((ev: SpeechRecognitionErrorEvent) => void) | null;
  start(): void;
  stop():  void;
  abort(): void;
}
interface ISpeechRecognitionConstructor {
  new (): ISpeechRecognition;
}

declare global {
  interface Window {
    SpeechRecognition?:       ISpeechRecognitionConstructor;
    webkitSpeechRecognition?: ISpeechRecognitionConstructor;
  }
}

interface UseSpeechRecognitionOptions {
  /** BCP-47 language tag, e.g. 'vi-VN', 'zh-TW', 'en-US' */
  lang?:     string;
  /** Called with the final transcript text when recording finishes. */
  onResult?: (text: string) => void;
}

interface UseSpeechRecognitionReturn {
  /** True while the microphone is actively recording. */
  isListening:  boolean;
  /** Live partial transcript (updates while user is speaking). */
  interimText:  string;
  /** Start recording. No-op if already listening or not supported. */
  start: () => void;
  /** Stop recording immediately. */
  stop:  () => void;
  /** Whether the browser supports the Web Speech API. */
  supported: boolean;
}

export function useSpeechRecognition(
  opts: UseSpeechRecognitionOptions = {},
): UseSpeechRecognitionReturn {
  const { lang = 'vi-VN', onResult } = opts;

  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');

  const recRef          = useRef<ISpeechRecognition | null>(null);
  const finalTextRef    = useRef('');

  const supported = !!(window.SpeechRecognition ?? window.webkitSpeechRecognition);

  const start = useCallback(() => {
    if (!supported || isListening) return;

    const SpeechRec = (window.SpeechRecognition ?? window.webkitSpeechRecognition)!;
    const rec = new SpeechRec();

    rec.lang            = lang;
    rec.interimResults  = true;   // show live partial transcripts
    rec.continuous      = false;  // auto-stop after a pause
    rec.maxAlternatives = 1;

    finalTextRef.current = '';
    setInterimText('');
    setIsListening(true);

    rec.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      let final   = finalTextRef.current;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      finalTextRef.current = final;
      setInterimText(final + interim);
    };

    rec.onend = () => {
      setIsListening(false);
      setInterimText('');
      const text = finalTextRef.current.trim();
      if (text && onResult) {
        onResult(text);
      }
      finalTextRef.current = '';
    };

    rec.onerror = (event: SpeechRecognitionErrorEvent) => { // eslint-disable-line
      // 'no-speech' and 'aborted' are benign; ignore silently
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        console.warn('[STT] error:', event.error);
      }
      setIsListening(false);
      setInterimText('');
      finalTextRef.current = '';
    };

    rec.start();
    recRef.current = rec;
  }, [supported, isListening, lang, onResult]);

  const stop = useCallback(() => {
    recRef.current?.stop();
    recRef.current = null;
  }, []);

  return { isListening, interimText, start, stop, supported };
}
