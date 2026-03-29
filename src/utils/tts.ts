/**
 * Text-to-Speech utilities for Interview voice mode.
 *
 * TTSPlayer   — sends text sentences to OpenAI TTS API and plays them
 *               sequentially using a promise-chain queue (no overlapping).
 *
 * SentenceBuffer — accumulates streaming tokens and emits complete sentences
 *               detected by punctuation boundaries, so TTS can start speaking
 *               the first sentence while the rest is still being generated.
 */

const TTS_URL = 'https://api.openai.com/v1/audio/speech';

export type TTSVoice = 'alloy' | 'echo' | 'fable' | 'nova' | 'onyx' | 'shimmer';

// ─── TTSPlayer ─────────────────────────────────────────────────────────────────

export class TTSPlayer {
  private apiKey: string;
  private voice:  TTSVoice;
  private model:  string;
  private queue:  Promise<void> = Promise.resolve();
  private _stopped = false;

  constructor(apiKey: string, voice: TTSVoice = 'nova', model = 'tts-1') {
    this.apiKey = apiKey;
    this.voice  = voice;
    this.model  = model;
  }

  /** Queue a sentence to be spoken after the current one finishes. */
  speak(text: string) {
    const trimmed = text.trim();
    if (this._stopped || !trimmed) return;
    this.queue = this.queue.then(() => this._playSegment(trimmed));
  }

  /** Stop any future playback (in-flight fetch will be silently discarded). */
  stop() {
    this._stopped = true;
  }

  private async _playSegment(text: string): Promise<void> {
    if (this._stopped) return;
    try {
      const res = await fetch(TTS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          input: text,
          voice: this.voice,
        }),
      });
      if (!res.ok || this._stopped) return;

      const blob = await res.blob();
      if (this._stopped) return;

      const url = URL.createObjectURL(blob);
      await new Promise<void>((resolve) => {
        const audio = new Audio(url);
        audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
        audio.onerror = () => { URL.revokeObjectURL(url); resolve(); };
        if (this._stopped) { resolve(); return; }
        audio.play().catch(() => resolve());
      });
    } catch {
      // Silently ignore TTS errors (network, quota, etc.)
    }
  }
}

// ─── SentenceBuffer ────────────────────────────────────────────────────────────

/**
 * Accumulates tokens from a streaming LLM response and calls `onSentence`
 * each time a complete sentence is detected (punctuation + whitespace boundary).
 *
 * Call `flush()` after the stream ends to emit any remaining text.
 */
export class SentenceBuffer {
  private buffer = '';
  private onSentence: (sentence: string) => void;

  constructor(onSentence: (sentence: string) => void) {
    this.onSentence = onSentence;
  }

  push(token: string) {
    this.buffer += token;

    // Find sentence boundaries: punctuation followed by whitespace
    const re = /[.!?。！？]+\s/g;
    let match: RegExpExecArray | null;
    let lastEnd = 0;

    while ((match = re.exec(this.buffer)) !== null) {
      // Include the punctuation but not the trailing space in the sentence
      const end = match.index + match[0].trimEnd().length;
      const sentence = this.buffer.slice(lastEnd, end).trim();
      if (sentence) this.onSentence(sentence);
      lastEnd = match.index + match[0].length; // skip trailing whitespace too
    }

    if (lastEnd > 0) {
      this.buffer = this.buffer.slice(lastEnd);
    }
  }

  /** Emit any remaining buffered text as a final sentence. */
  flush() {
    const remaining = this.buffer.trim();
    if (remaining) this.onSentence(remaining);
    this.buffer = '';
  }
}
