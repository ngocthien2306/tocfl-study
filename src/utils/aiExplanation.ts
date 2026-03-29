/**
 * AI Explanation helper for Reading and Listening exam questions.
 *
 * - Caches explanations in localStorage (permanent until regenerated).
 * - Reading: text questions → gpt-4o-mini; image questions → gpt-4o vision
 * - Listening: Whisper transcript → gpt-4o-mini or gpt-4o vision
 */

import type { AIVocabItem, OptionKey } from '../types';

// ─── Cache types ───────────────────────────────────────────────────────────────

export interface AIExplanationData {
  explanation: string;
  vocabulary:  AIVocabItem[];
  cachedAt:    string;        // ISO timestamp
}

const CACHE_KEY     = 'tocfl_ai_explanations';
const WHISPER_CACHE = 'tocfl_audio_transcripts';

function loadCache(): Record<string, AIExplanationData> {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, AIExplanationData>) : {};
  } catch { return {}; }
}
function saveCache(cache: Record<string, AIExplanationData>) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch { /* quota */ }
}

export function loadExplanation(cacheKey: string): AIExplanationData | null {
  return loadCache()[cacheKey] ?? null;
}
export function saveExplanation(cacheKey: string, data: AIExplanationData) {
  const cache = loadCache();
  cache[cacheKey] = data;
  saveCache(cache);
}

/** Canonical cache key: "exam_A_exam1_q5" or "listening_B_exam1_q3" */
export function buildCacheKey(
  module:     'exam' | 'listening',
  band:       'A' | 'B',
  examKey:    string,
  questionId: number,
): string {
  return `${module}_${band}_${examKey}_q${questionId}`;
}

// ─── Whisper transcript cache ──────────────────────────────────────────────────

function loadTranscriptCache(): Record<string, string> {
  try {
    const raw = localStorage.getItem(WHISPER_CACHE);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch { return {}; }
}
function saveTranscriptCache(cache: Record<string, string>) {
  try { localStorage.setItem(WHISPER_CACHE, JSON.stringify(cache)); } catch { /* quota */ }
}
export function loadTranscript(audioPath: string): string | null {
  return loadTranscriptCache()[audioPath] ?? null;
}
export function saveTranscript(audioPath: string, text: string) {
  const cache = loadTranscriptCache();
  cache[audioPath] = text;
  saveTranscriptCache(cache);
}

// ─── OpenAI streaming helper ───────────────────────────────────────────────────

const CHAT_URL    = 'https://api.openai.com/v1/chat/completions';
const WHISPER_URL = 'https://api.openai.com/v1/audio/transcriptions';

interface TextPart     { type: 'text'; text: string }
interface ImagePart    { type: 'image_url'; image_url: { url: string; detail?: 'low' | 'high' | 'auto' } }
type ContentPart = TextPart | ImagePart;

interface ChatMessage {
  role:    'system' | 'user' | 'assistant';
  content: string | ContentPart[];
}

async function streamCompletion(
  apiKey:  string,
  messages: ChatMessage[],
  model:   string,
  onToken: (token: string) => void,
): Promise<string> {
  const res = await fetch(CHAT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages, temperature: 0.4, stream: true }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(err.error?.message ?? `HTTP ${res.status}`);
  }
  const reader  = res.body!.getReader();
  const decoder = new TextDecoder();
  let fullText  = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const raw = decoder.decode(value, { stream: true });
    for (const line of raw.split('\n')) {
      if (!line.startsWith('data: ')) continue;
      const payload = line.slice(6).trim();
      if (payload === '[DONE]') continue;
      try {
        const frame = JSON.parse(payload) as { choices: { delta: { content?: string } }[] };
        const token = frame.choices[0]?.delta?.content ?? '';
        if (!token) continue;
        fullText += token;
        onToken(token);
      } catch { /* skip malformed SSE frames */ }
    }
  }
  return fullText;
}

/**
 * Strip the trailing JSON vocabulary block from a streaming text so the user
 * never sees raw JSON while the model is still generating.
 */
export function stripJsonSuffix(text: string): string {
  // Cut at the first `{"vocabulary":` marker (model may start emitting it mid-stream)
  const marker = text.indexOf('{"vocabulary":');
  if (marker !== -1) return text.slice(0, marker).trimEnd();
  // Also cut at a bare `{` that looks like it starts a JSON object at the tail
  // (conservative: only strip if it appears after a newline or at end of text)
  const lastBrace = text.lastIndexOf('\n{');
  if (lastBrace !== -1) return text.slice(0, lastBrace).trimEnd();
  return text;
}

function parseExplanationResponse(raw: string): { explanation: string; vocabulary: AIVocabItem[] } {
  const trimmed = raw.trim();

  // Strategy 1: look for {"vocabulary": anywhere in the string (model may or may not newline before it)
  const vocabMarker = trimmed.lastIndexOf('{"vocabulary":');
  if (vocabMarker !== -1) {
    const jsonPart = trimmed.slice(vocabMarker);
    const textPart = trimmed.slice(0, vocabMarker).trim();
    try {
      const meta = JSON.parse(jsonPart) as { vocabulary?: AIVocabItem[] };
      if (Array.isArray(meta.vocabulary)) {
        return { explanation: textPart, vocabulary: meta.vocabulary };
      }
    } catch { /* fall through to next strategy */ }
  }

  // Strategy 2: scan backwards from the end for any JSON object
  const lastBrace = trimmed.lastIndexOf('{');
  if (lastBrace !== -1) {
    const jsonPart = trimmed.slice(lastBrace);
    const textPart = trimmed.slice(0, lastBrace).trim();
    try {
      const meta = JSON.parse(jsonPart) as { vocabulary?: AIVocabItem[] };
      if (Array.isArray(meta.vocabulary)) {
        return { explanation: textPart, vocabulary: meta.vocabulary };
      }
    } catch { /* fall through */ }
  }

  return { explanation: trimmed, vocabulary: [] };
}

/** Fetch an image and return a data-URL (base64) for vision API */
async function imageToBase64(url: string): Promise<string> {
  const res  = await fetch(url);
  const blob = await res.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ─── System prompt (shared for reading + listening) ───────────────────────────

const SYSTEM_PROMPT = `Bạn là gia sư tiếng Trung chuyên luyện thi TOCFL. Phân tích câu hỏi và giải thích rõ ràng bằng tiếng Việt.

Định dạng bắt buộc:
1. Giải thích tại sao đáp án đúng là đúng (trích dẫn từ ngữ liệu nếu có)
2. Giải thích ngắn gọn tại sao từng đáp án sai bị loại
3. (Tuỳ chọn) Ghi chú ngữ pháp hoặc ngữ cảnh văn hóa nếu hữu ích

Ở cuối (trên một DÒNG RIÊNG biệt, không có khoảng trắng hoặc dòng trống trước đó), thêm JSON từ vựng:
{"vocabulary":[{"word":"漢字","pinyin":"hànzì","meaning":"chữ Hán","example":"我學漢字。"},...]}

Chỉ liệt kê 3-6 từ vựng quan trọng nhất. Nếu không có, dùng mảng rỗng [].`;

// ─── Reading explanation ───────────────────────────────────────────────────────

export interface ExplainReadingOpts {
  apiKey:         string;
  questionId:     number;
  question?:      string;
  sentence?:      string;
  options:        Partial<Record<OptionKey, string>>;
  answer:         OptionKey;
  context?:       string;       // Part 3 context snippet
  passage?:       string;       // Part 4/5 reading passage
  pageImageUrl?:  string;       // full URL when image question
  onToken:        (token: string) => void;
}

export async function generateReadingExplanation(opts: ExplainReadingOpts): Promise<AIExplanationData> {
  const { apiKey, questionId, question, sentence, options, answer, context, passage, pageImageUrl, onToken } = opts;

  const isImage = !!pageImageUrl;
  const model   = isImage ? 'gpt-4o' : 'gpt-4o-mini';

  const qText       = question ?? sentence ?? `Câu ${questionId}`;
  const optionsText = Object.entries(options).map(([k, v]) => `${k}. ${v}`).join('\n');

  let userContent: string | ContentPart[];

  if (isImage) {
    let imgData: string;
    try {
      imgData = await imageToBase64(pageImageUrl);
    } catch {
      imgData = pageImageUrl; // CORS fallback — vision API also accepts URLs
    }
    userContent = [
      { type: 'image_url', image_url: { url: imgData, detail: 'high' } },
      {
        type: 'text',
        text: `Câu ${questionId}: ${qText}\n\nCác lựa chọn:\n${optionsText}\n\nĐáp án đúng: ${answer}\n\nHãy phân tích dựa vào hình ảnh trên.`,
      },
    ] as ContentPart[];
  } else {
    let ctx = '';
    if (context) ctx += `\nNgữ cảnh:\n${context}\n`;
    if (passage) ctx += `\nĐoạn văn:\n${passage}\n`;
    userContent = `Câu ${questionId}: ${qText}\n${ctx}\nCác lựa chọn:\n${optionsText}\n\nĐáp án đúng: ${answer}\n\nHãy giải thích.`;
  }

  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user',   content: userContent   },
  ];

  const raw = await streamCompletion(apiKey, messages, model, onToken);
  const { explanation, vocabulary } = parseExplanationResponse(raw);
  return { explanation, vocabulary, cachedAt: new Date().toISOString() };
}

// ─── Listening explanation ─────────────────────────────────────────────────────

export interface ExplainListeningOpts {
  apiKey:          string;
  questionId:      number;
  audioPaths:      string[];    // relative paths (relative to public/)
  audioBaseUrl:    string;      // BASE_URL prefix for absolute URL
  question?:       string;
  options:         Partial<Record<OptionKey, string>>;
  answer:          OptionKey;
  pageImageUrl?:   string;      // for image_choice parts
  onToken:         (token: string) => void;
  onProgress?:     (step: 'transcribing' | 'analyzing') => void;
}

export async function generateListeningExplanation(opts: ExplainListeningOpts): Promise<AIExplanationData> {
  const { apiKey, questionId, audioPaths, audioBaseUrl, question, options, answer, pageImageUrl, onToken, onProgress } = opts;

  // ── Step 1: Whisper transcription (one per audio clip, cached) ─────────────
  onProgress?.('transcribing');

  const transcripts: string[] = [];
  for (const relPath of audioPaths) {
    const cached = loadTranscript(relPath);
    if (cached) {
      transcripts.push(cached);
      continue;
    }
    // Fetch audio file → Blob → Whisper
    const audioUrl  = `${audioBaseUrl}${relPath}`;
    const audioRes  = await fetch(audioUrl);
    const audioBlob = await audioRes.blob();
    // Determine file extension for correct MIME type
    const ext  = relPath.split('.').pop() ?? 'mp3';
    const file = new File([audioBlob], `audio.${ext}`, { type: `audio/${ext}` });

    const formData = new FormData();
    formData.append('file',  file);
    formData.append('model', 'whisper-1');
    formData.append('language', 'zh');

    const whisperRes = await fetch(WHISPER_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });
    if (!whisperRes.ok) {
      const err = await whisperRes.json().catch(() => ({})) as { error?: { message?: string } };
      throw new Error(`Whisper: ${err.error?.message ?? `HTTP ${whisperRes.status}`}`);
    }
    const { text } = await whisperRes.json() as { text: string };
    saveTranscript(relPath, text);
    transcripts.push(text);
  }

  const transcriptText = transcripts.join('\n');

  // ── Step 2: GPT explanation ────────────────────────────────────────────────
  onProgress?.('analyzing');

  const isImage = !!pageImageUrl;
  const model   = isImage ? 'gpt-4o' : 'gpt-4o-mini';
  const qText   = question ?? `Câu ${questionId}`;
  const optText = Object.entries(options).map(([k, v]) => `${k}. ${v}`).join('\n');

  let userContent: string | ContentPart[];

  if (isImage) {
    let imgData: string;
    try {
      imgData = await imageToBase64(pageImageUrl);
    } catch {
      imgData = pageImageUrl;
    }
    userContent = [
      { type: 'image_url', image_url: { url: imgData, detail: 'high' } },
      {
        type: 'text',
        text: `Bản ghi âm:\n${transcriptText}\n\nCâu ${questionId}: ${qText}\n\nCác lựa chọn:\n${optText}\n\nĐáp án đúng: ${answer}\n\nDựa vào bản ghi âm và hình ảnh, hãy giải thích.`,
      },
    ] as ContentPart[];
  } else {
    userContent = `Bản ghi âm:\n${transcriptText}\n\nCâu ${questionId}: ${qText}\n\nCác lựa chọn:\n${optText}\n\nĐáp án đúng: ${answer}\n\nHãy giải thích.`;
  }

  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user',   content: userContent   },
  ];

  const raw = await streamCompletion(apiKey, messages, model, onToken);
  const { explanation, vocabulary } = parseExplanationResponse(raw);
  return { explanation, vocabulary, cachedAt: new Date().toISOString() };
}
