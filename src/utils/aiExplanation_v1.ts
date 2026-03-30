/**
 * AI Explanation helper for Reading and Listening exam questions.
 *
 * - Caches explanations in localStorage (permanent until regenerated).
 * - Reading: text questions → gpt-4o-mini; image questions → gpt-4o vision
 * - Listening: Whisper transcript → gpt-4o-mini or gpt-4o vision
 */

import type { AIVocabItem, OptionKey } from '../types';
import { examExplanationsApi } from '../api/client';

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

/**
 * Save explanation to localStorage.
 * If token is provided, also push to BE asynchronously (fire-and-forget).
 */
export function saveExplanation(cacheKey: string, data: AIExplanationData, token?: string | null) {
  const cache = loadCache();
  cache[cacheKey] = data;
  saveCache(cache);
  if (token) {
    examExplanationsApi
      .upsert(token, cacheKey, JSON.stringify(data))
      .catch(() => { /* ignore BE errors — localStorage is source of truth */ });
  }
}

/**
 * On login: fetch all explanations from BE and merge into localStorage,
 * then push any localStorage-only entries to BE.
 */
export async function syncExplanationsWithBE(token: string): Promise<void> {
  try {
    // Pull BE list
    const beList = await examExplanationsApi.list(token);
    const cache  = loadCache();

    // Merge BE → localStorage (BE wins for existing keys)
    for (const rec of beList) {
      try {
        cache[rec.cache_key] = JSON.parse(rec.explanation_json) as AIExplanationData;
      } catch { /* skip malformed */ }
    }
    saveCache(cache);

    // Push localStorage-only entries to BE
    const beKeys = new Set(beList.map(r => r.cache_key));
    const toSync = Object.entries(cache).filter(([k]) => !beKeys.has(k));
    if (toSync.length > 0) {
      await examExplanationsApi.bulkSync(
        token,
        toSync.map(([k, v]) => ({ cache_key: k, explanation_json: JSON.stringify(v) })),
      ).catch(() => { /* ignore */ });
    }
  } catch { /* BE unreachable — keep local only */ }
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

const COMMON_RULES = `QUAN TRỌNG:
- Tất cả chữ Hán PHẢI dùng phồn thể (繁體字), tuyệt đối KHÔNG dùng giản thể.
- KHÔNG dùng markdown (**bold**, *italic*, # heading, --- separator).
- Trả lời CỰC NGẮN GỌN — chỉ liệt kê keyword, không viết văn xuôi dài dòng.`;

const SYSTEM_PROMPT = `Bạn là gia sư TOCFL. Giải thích câu hỏi đọc hiểu bằng tiếng Việt, cực ngắn gọn.
${COMMON_RULES}

Định dạng bắt buộc — dùng đúng ký tự ✓ và ✗, mỗi dòng có 3 phần:
✓/✗ [đáp án]: KEYWORD_HÁN_TỰ (pīnyīn keyword) — nghĩa keyword → CÂU_NGẮN_HÁN_TỰ (pīnyīn của câu đó) — nghĩa Việt của câu

Ví dụ đúng cách viết:
✓ A: 看報紙 (kàn bàozhǐ) — đọc báo → 他正在看報紙 (tā zhèngzài kàn bàozhǐ) — anh ấy đang đọc báo
✗ B: 洗杯子 (xǐ bēizi) — rửa cốc → 沒有提到洗杯子 (méiyǒu tídào xǐ bēizi) — không đề cập việc rửa cốc
✗ C: 穿衣服 (chuān yīfu) — mặc quần áo → 已經穿好衣服了 (yǐjīng chuān hǎo yīfu le) — đã mặc quần áo sẵn rồi

Quy tắc:
- Câu sau → phải là hán tự thật (trích từ bài hoặc tóm tắt ngắn), có pinyin đi kèm, có nghĩa Việt
- Chỉ liệt kê đúng số dòng bằng số đáp án (1 đúng + các sai). Không thêm gì khác ngoài JSON.

SAU ĐÓ xuống dòng và thêm JSON hợp lệ:
{"vocabulary":[{"word":"漢字","pinyin":"hànzì","meaning":"chữ Hán","example":"我學漢字。"}],"passage_analysis":[{"hanzi":"我是學生。","pinyin":"Wǒ shì xuéshēng.","vietnamese":"Tôi là học sinh."}]}

Yêu cầu JSON:
- Phải là JSON hợp lệ, đầy đủ dấu ngoặc kép
- vocabulary: 3-10 keyword quan trọng nhất (example để "" nếu không có)
- passage_analysis: phân tích đoạn văn/ngữ cảnh thành từng câu — hanzi phồn thể + pinyin + nghĩa Việt. Nếu chỉ có hình ảnh thì dùng []
- KHÔNG thêm bất kỳ text nào sau JSON`;

const LISTENING_SYSTEM_PROMPT = `Bạn là gia sư TOCFL phần Nghe. Giải thích câu hỏi bằng tiếng Việt, cực ngắn gọn.
${COMMON_RULES}

Định dạng bắt buộc — dùng đúng ký tự ✓ và ✗, mỗi dòng có 3 phần:
✓/✗ [đáp án]: KEYWORD_HÁN_TỰ (pīnyīn keyword) — nghĩa keyword → CÂU_NGẮN_HÁN_TỰ (pīnyīn của câu đó) — nghĩa Việt của câu

Ví dụ đúng cách viết:
✓ A: 看報紙 (kàn bàozhǐ) — đọc báo → 他正在看報紙 (tā zhèngzài kàn bàozhǐ) — anh ấy đang đọc báo
✗ B: 洗杯子 (xǐ bēizi) — rửa cốc → 沒有提到洗杯子 (méiyǒu tídào xǐ bēizi) — không đề cập việc rửa cốc
✗ C: 穿衣服 (chuān yīfu) — mặc quần áo → 已經穿好衣服了 (yǐjīng chuān hǎo yīfu le) — đã mặc quần áo sẵn rồi

Quy tắc:
- Câu sau → phải là hán tự thật (trích từ bản ghi âm hoặc tóm tắt ngắn), có pinyin đi kèm, có nghĩa Việt
- Chỉ liệt kê đúng số dòng bằng số đáp án (1 đúng + các sai). Không thêm gì khác ngoài JSON.

SAU ĐÓ xuống dòng và thêm JSON hợp lệ:
{"vocabulary":[{"word":"漢字","pinyin":"hànzì","meaning":"chữ Hán","example":""}],"transcript":[{"hanzi":"你好嗎？","pinyin":"Nǐ hǎo ma?","vietnamese":"Bạn có khỏe không?"}]}

Yêu cầu JSON:
- Phải là JSON hợp lệ, đầy đủ dấu ngoặc kép
- vocabulary: 3-10 keyword quan trọng nhất từ bản ghi âm
- transcript: toàn bộ bản ghi âm chia thành từng câu — hanzi phồn thể + pinyin + nghĩa Việt
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
    formData.append('prompt', '這是一段繁體中文的練習音檔。');

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
