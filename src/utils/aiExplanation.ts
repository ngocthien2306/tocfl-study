/**
 * AI Explanation helper for Reading and Listening exam questions.
 *
 * - Caches explanations in localStorage (permanent until regenerated).
 * - Reading: text questions → gpt-4o-mini; image questions → gpt-4o vision
 * - Listening: Whisper transcript → gpt-4o-mini or gpt-4o vision
 */

import type { AIVocabItem, OptionKey } from '../types';

// ─── Cache types ───────────────────────────────────────────────────────────────

export interface TranscriptLine {
  hanzi:      string;
  pinyin:     string;
  vietnamese: string;
}

export interface AIExplanationData {
  explanation:       string;
  vocabulary:        AIVocabItem[];
  transcript?:       TranscriptLine[];   // listening only — audio transcript
  passage_analysis?: TranscriptLine[];   // exam only — reading passage breakdown
  cachedAt:          string;             // ISO timestamp
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
  band:       'A' | 'B' | 'C',
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
    body: JSON.stringify({
      model,
      messages,
      // o-series models (o1, o3, o4-mini, …) only accept temperature=1 (the default),
      // so we omit the parameter entirely for them.
      ...(/^o\d/i.test(model) ? {} : { temperature: 0.4 }),
      stream: true,
    }),
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
 * Find the position in `text` where the JSON vocabulary block starts.
 * Returns -1 if not found. Handles multiple model output variants:
 *   {"vocabulary":[...]}
 *   vocabulary":[...]
 *   \n{...}
 */
function findJsonStart(text: string): number {
  // Pattern 1: clean {"vocabulary":
  const p1 = text.search(/\{"vocabulary"\s*:/);
  if (p1 !== -1) return p1;

  // Pattern 2: model skipped opening brace — "vocabulary":
  const p2 = text.search(/"?vocabulary"?\s*"?\s*:\s*\[/);
  if (p2 !== -1) {
    // walk back to find the nearest { (or start of the token)
    const before = text.slice(0, p2);
    const brace = before.lastIndexOf('{');
    return brace !== -1 ? brace : p2;
  }

  // Pattern 3: last bare { on its own line
  const p3 = text.lastIndexOf('\n{');
  if (p3 !== -1) return p3 + 1; // +1 to skip the \n

  return -1;
}

/**
 * Strip the trailing JSON vocabulary block from a streaming text so the user
 * never sees raw JSON while the model is still generating.
 */
export function stripJsonSuffix(text: string): string {
  const pos = findJsonStart(text);
  if (pos !== -1) return text.slice(0, pos).trimEnd();
  return text;
}

/**
 * Try to extract a balanced JSON array string starting from `str`.
 * Returns the matched array string or null.
 */
function extractArray(str: string): string | null {
  const start = str.indexOf('[');
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < str.length; i++) {
    if (str[i] === '[') depth++;
    else if (str[i] === ']') { depth--; if (depth === 0) return str.slice(start, i + 1); }
  }
  return null;
}

function parseExplanationResponse(raw: string): { explanation: string; vocabulary: AIVocabItem[]; transcript?: TranscriptLine[]; passage_analysis?: TranscriptLine[] } {
  const trimmed = raw.trim();

  const jsonStart = findJsonStart(trimmed);
  // Always split text here — even if JSON is malformed we still hide it from explanation
  const explanation = jsonStart !== -1 ? trimmed.slice(0, jsonStart).trim() : trimmed;
  const jsonChunk   = jsonStart !== -1 ? trimmed.slice(jsonStart) : '';

  if (jsonChunk) {
    // Attempt 1: direct JSON.parse on the whole chunk
    try {
      const meta = JSON.parse(jsonChunk) as { vocabulary?: AIVocabItem[]; transcript?: TranscriptLine[]; passage_analysis?: TranscriptLine[] };
      const vocabulary        = Array.isArray(meta.vocabulary)        ? meta.vocabulary        : [];
      const transcript        = Array.isArray(meta.transcript)        ? meta.transcript        : undefined;
      const passage_analysis  = Array.isArray(meta.passage_analysis)  ? meta.passage_analysis  : undefined;
      return { explanation, vocabulary, transcript, passage_analysis };
    } catch { /* try repair */ }

    // Attempt 2: pull out vocabulary array and parse that directly
    const arrStr = extractArray(jsonChunk);
    if (arrStr) {
      try {
        const vocab = JSON.parse(arrStr) as AIVocabItem[];
        if (Array.isArray(vocab)) {
          return { explanation, vocabulary: vocab };
        }
      } catch { /* give up */ }
    }
  }

  // No vocabulary parsed — at least return clean explanation (JSON stripped)
  return { explanation, vocabulary: [] };
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

// ─── System prompts ────────────────────────────────────────────────────────────

const FORMAT_RULES = `QUY TẮC ĐỊNH DẠNG — bắt buộc tuân theo:
- KHÔNG dùng markdown: không có **bold**, không có *italic*, không có # heading, không có --- separator
- Dùng số thứ tự (1. 2. 3.) và dấu gạch đầu dòng (-) thông thường
- Viết văn xuôi tự nhiên, dễ đọc`;

const SYSTEM_PROMPT = `Bạn là gia sư tiếng Trung phồn thể (Traditional Chinese / 繁體中文) chuyên luyện thi TOCFL. Phân tích câu hỏi và giải thích rõ ràng bằng tiếng Việt.
QUAN TRỌNG: Tất cả chữ Hán trong phản hồi (từ vựng, ví dụ, trích dẫn) PHẢI dùng phồn thể (繁體字). Tuyệt đối KHÔNG dùng giản thể (簡體字).

${FORMAT_RULES}

Cấu trúc phản hồi:
1. Giải thích tại sao đáp án đúng là đúng (trích dẫn từ ngữ liệu hoặc hình ảnh nếu có)
2. Giải thích ngắn gọn tại sao từng đáp án sai bị loại (mỗi đáp án sai một dòng)
3. Ghi chú ngữ pháp hoặc văn hóa nếu hữu ích (có thể bỏ qua nếu không cần)

SAU KHI VIẾT XONG PHẦN GIẢI THÍCH, xuống dòng và thêm JSON (phải là JSON hợp lệ):
{"vocabulary":[{"word":"漢字","pinyin":"hànzì","meaning":"chữ Hán","example":"我學漢字。"}],"passage_analysis":[{"hanzi":"我是學生。","pinyin":"Wǒ shì xuéshēng.","vietnamese":"Tôi là học sinh."},{"hanzi":"你好嗎？","pinyin":"Nǐ hǎo ma?","vietnamese":"Bạn có khỏe không?"}]}

Yêu cầu JSON:
- Phải là JSON hợp lệ, đầy đủ dấu ngoặc kép cho tất cả key và value
- Tất cả chữ Hán trong JSON PHẢI là phồn thể (繁體字)
- vocabulary: liệt kê 3-6 từ vựng quan trọng nhất trong câu hỏi; nếu không có thì dùng []
- passage_analysis: phân tích toàn bộ đoạn văn/ngữ cảnh (nếu có) thành từng câu/cụm có nghĩa. Mỗi phần tử gồm: hanzi phồn thể đầy đủ + pinyin có dấu thanh đầy đủ + bản dịch tiếng Việt tự nhiên. Nếu câu hỏi chỉ có hình ảnh hoặc không có văn bản đáng phân tích, dùng passage_analysis:[]
- KHÔNG thêm bất kỳ text nào sau JSON`;

const LISTENING_SYSTEM_PROMPT = `Bạn là gia sư tiếng Trung phồn thể (Traditional Chinese / 繁體中文) chuyên luyện thi TOCFL phần Nghe. Phân tích câu hỏi và giải thích rõ ràng bằng tiếng Việt.
QUAN TRỌNG: Tất cả chữ Hán trong phản hồi (từ vựng, ví dụ, bản ghi âm) PHẢI dùng phồn thể (繁體字). Tuyệt đối KHÔNG dùng giản thể (簡體字).

${FORMAT_RULES}

Cấu trúc phản hồi:
1. Giải thích tại sao đáp án đúng là đúng (dựa vào bản ghi âm)
2. Giải thích ngắn gọn tại sao từng đáp án sai bị loại (mỗi đáp án sai một dòng)
3. Ghi chú ngữ pháp hoặc từ ngữ quan trọng nếu hữu ích (có thể bỏ qua nếu không cần)

SAU KHI VIẾT XONG PHẦN GIẢI THÍCH, xuống dòng và thêm JSON (phải là JSON hợp lệ):
{"vocabulary":[{"word":"漢字","pinyin":"hànzì","meaning":"chữ Hán","example":"我學漢字。"}],"transcript":[{"hanzi":"你好嗎？","pinyin":"Nǐ hǎo ma?","vietnamese":"Bạn có khỏe không?"},{"hanzi":"我很好。","pinyin":"Wǒ hěn hǎo.","vietnamese":"Tôi rất khỏe."}]}

Yêu cầu JSON:
- Phải là JSON hợp lệ, đầy đủ dấu ngoặc kép cho tất cả key và value
- Tất cả chữ Hán trong JSON PHẢI là phồn thể (繁體字)
- vocabulary: liệt kê 3-6 từ vựng quan trọng nhất trong bản ghi âm; nếu không có thì dùng []
- transcript: chia bản ghi âm thành từng câu/cụm có nghĩa, mỗi phần tử gồm hanzi phồn thể + pinyin có dấu thanh + bản dịch tiếng Việt tự nhiên
- KHÔNG thêm bất kỳ text nào sau JSON`;

// ─── Reading explanation ───────────────────────────────────────────────────────

export interface ExplainReadingOpts {
  apiKey:         string;
  model:          string;       // caller-specified model (from user preference)
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
  const { apiKey, model, questionId, question, sentence, options, answer, context, passage, pageImageUrl, onToken } = opts;

  const qText       = question ?? sentence ?? `Câu ${questionId}`;
  const optionsText = Object.entries(options).map(([k, v]) => `${k}. ${v}`).join('\n');

  let userContent: string | ContentPart[];

  if (pageImageUrl) {
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
  const { explanation, vocabulary, passage_analysis } = parseExplanationResponse(raw);
  return { explanation, vocabulary, passage_analysis, cachedAt: new Date().toISOString() };
}

// ─── Listening explanation ──────────────────────────────────────────────────────

export interface ExplainListeningOpts {
  apiKey:          string;
  model:           string;      // caller-specified model (from user preference)
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
  const { apiKey, model, questionId, audioPaths, audioBaseUrl, question, options, answer, pageImageUrl, onToken, onProgress } = opts;

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
    { role: 'system', content: LISTENING_SYSTEM_PROMPT },
    { role: 'user',   content: userContent             },
  ];

  const raw = await streamCompletion(apiKey, messages, model, onToken);
  const { explanation, vocabulary, transcript } = parseExplanationResponse(raw);
  return { explanation, vocabulary, transcript, cachedAt: new Date().toISOString() };
}
