import type { AISentenceResult, AIReadingResult, AIVocabItem } from '../../types';

const API_URL = 'https://api.openai.com/v1/chat/completions';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface VocabWord {
  hanzi:   string;
  pinyin:  string;
  meaning: string;
  pos:     string;
}

// ─── Prompts ──────────────────────────────────────────────────────────────────
function sentencePrompt(band: string, topic: string, count: number, vocab: VocabWord[]): string {
  const vocabSection = vocab.length > 0
    ? `\nBẮT BUỘC dùng các từ sau trong câu (mỗi từ dùng ít nhất 1 lần, phân bổ đều):\n${
        vocab.map(w => `- ${w.hanzi} (${w.pinyin}): ${w.meaning}`).join('\n')
      }\n`
    : '';

  return `Bạn là giáo viên tiếng Trung chuyên luyện thi TOCFL.
Hãy tạo ${count} câu ví dụ bằng tiếng Trung phồn thể (Traditional Chinese) phù hợp với trình độ TOCFL Band ${band}.
${topic ? `Chủ đề: ${topic}.` : 'Chọn chủ đề đời thường phù hợp với trình độ.'}${vocabSection}
Yêu cầu:
- Câu dài ${band === 'A' ? '10-18' : '18-30'} chữ Hán
- Ngữ pháp và từ vựng chuẩn TOCFL Band ${band}
- Đa dạng cấu trúc câu
- key_words: gồm các từ đã cho (nếu có) + từ quan trọng khác trong câu (2-5 từ)

Trả về JSON chính xác (KHÔNG thêm text ngoài JSON):
{
  "sentences": [
    {
      "chinese": "...",
      "pinyin": "...",
      "vietnamese": "Dịch tiếng Việt",
      "grammar_note": "Ghi chú ngữ pháp ngắn gọn bằng tiếng Việt",
      "key_words": [
        { "word": "...", "pinyin": "...", "meaning": "nghĩa tiếng Việt" }
      ]
    }
  ]
}`;
}

function readingPrompt(band: string, topic: string, vocab: VocabWord[]): string {
  const length = band === 'A' ? '120-180' : '200-300';
  const qCount = band === 'A' ? 3 : 5;
  const vocabSection = vocab.length > 0
    ? `\nBẮT BUỘC sử dụng các từ vựng sau trong bài đọc:\n${
        vocab.map(w => `- ${w.hanzi} (${w.pinyin}): ${w.meaning}`).join('\n')
      }\n`
    : '';

  return `Bạn là giáo viên tiếng Trung chuyên luyện thi TOCFL.
Hãy tạo một bài đọc hiểu bằng tiếng Trung phồn thể (Traditional Chinese) phù hợp với TOCFL Band ${band}.
${topic ? `Chủ đề: ${topic}.` : 'Chọn chủ đề đời thường, thú vị, phù hợp trình độ.'}${vocabSection}
Yêu cầu:
- Độ dài ${length} chữ Hán
- Từ vựng và ngữ pháp chuẩn Band ${band}
- Nội dung mạch lạc, tự nhiên
- ${qCount} câu hỏi trắc nghiệm 4 đáp án (A/B/C/D)
- Giải thích đáp án chi tiết bằng tiếng Việt

Trả về JSON chính xác (KHÔNG thêm text ngoài JSON):
{
  "passage": "Toàn bộ đoạn văn chữ Hán...",
  "passage_pinyin": "Phiên âm pinyin đầy đủ...",
  "passage_vietnamese": "Dịch toàn bộ đoạn văn sang tiếng Việt...",
  "questions": [
    {
      "question": "Câu hỏi bằng tiếng Trung?",
      "options": { "A": "...", "B": "...", "C": "...", "D": "..." },
      "answer": "A",
      "explanation": "Giải thích chi tiết (bằng tiếng Việt)"
    }
  ]
}`;
}

// ─── API call ─────────────────────────────────────────────────────────────────
async function callOpenAI(apiKey: string, prompt: string): Promise<string> {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.8,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = (err as { error?: { message?: string } }).error?.message ?? `HTTP ${res.status}`;
    throw new Error(msg);
  }

  const data = await res.json() as { choices: { message: { content: string } }[] };
  return data.choices[0].message.content;
}

// ─── Public functions ─────────────────────────────────────────────────────────
export async function generateSentences(
  apiKey: string,
  band: string,
  topic: string,
  count: number,
  vocab: VocabWord[] = [],
): Promise<AISentenceResult> {
  const prompt = sentencePrompt(band, topic, count, vocab);
  const raw    = await callOpenAI(apiKey, prompt);
  const parsed = JSON.parse(raw) as { sentences: AISentenceResult['sentences'] };
  return {
    type: 'sentences',
    topic: topic || `Band ${band} — câu ví dụ`,
    band,
    sentences: parsed.sentences,
    createdAt: new Date().toLocaleString('vi-VN'),
  };
}

export async function generateReading(
  apiKey: string,
  band: string,
  topic: string,
  vocab: VocabWord[] = [],
): Promise<AIReadingResult> {
  const prompt = readingPrompt(band, topic, vocab);
  const raw    = await callOpenAI(apiKey, prompt);
  const parsed = JSON.parse(raw) as Omit<AIReadingResult, 'type' | 'topic' | 'band' | 'createdAt'>;
  return {
    type: 'reading',
    topic: topic || `Band ${band} — đọc hiểu`,
    band,
    ...parsed,
    createdAt: new Date().toLocaleString('vi-VN'),
  };
}

// ─── Prompt: generate from example (Reading tab AI) ──────────────────────────
function readingFromExamplePrompt(
  band: string,
  topic: string,
  examplePassage: string,
  exampleQuestions: string,
): string {
  const length  = band === 'A' ? '120-180' : '200-300';
  const qCount  = band === 'A' ? 3 : 5;
  const vocabN  = band === 'A' ? 8 : 12;

  return `Bạn là giáo viên tiếng Trung chuyên luyện thi TOCFL Band ${band}.
Dưới đây là một bài đọc mẫu từ đề thi TOCFL thực tế để bạn tham khảo phong cách và độ khó:

=== BÀI MẪU ===
${examplePassage}
${exampleQuestions}
=== KẾT THÚC BÀI MẪU ===

Bây giờ hãy tạo một bài đọc MỚI HOÀN TOÀN (không sao chép) theo phong cách và độ khó tương tự:
- Chủ đề: ${topic || 'Đời sống, xã hội, văn hóa Đài Loan'}
- Độ dài đoạn văn: ${length} chữ Hán (phồn thể)
- Ngữ pháp / từ vựng chuẩn TOCFL Band ${band}
- ${qCount} câu hỏi trắc nghiệm 4 đáp án (A/B/C/D)
- Giải thích đáp án CHI TIẾT bằng tiếng Việt (trích dẫn câu gốc, phân tích lý do đúng/sai)
- Danh sách ${vocabN}-${vocabN + 4} từ vựng quan trọng trong bài (kèm nghĩa tiếng Việt, ví dụ ngắn)

Trả về JSON chính xác (KHÔNG thêm text ngoài JSON):
{
  "passage": "Toàn bộ đoạn văn chữ Hán phồn thể...",
  "passage_pinyin": "Phiên âm pinyin đầy đủ...",
  "passage_vietnamese": "Bản dịch tiếng Việt đầy đủ...",
  "questions": [
    {
      "question": "Câu hỏi bằng tiếng Trung phồn thể?",
      "options": { "A": "...", "B": "...", "C": "...", "D": "..." },
      "answer": "A",
      "explanation": "Giải thích chi tiết (tiếng Việt): Theo đoạn văn '...' nên đáp án đúng là A vì..."
    }
  ],
  "vocabulary": [
    {
      "word": "chữ Hán",
      "pinyin": "pīn yīn",
      "meaning": "nghĩa tiếng Việt",
      "example": "ví dụ câu ngắn dùng từ này"
    }
  ]
}`;
}

export interface ReadingFromExampleOptions {
  apiKey: string;
  band: string;
  topic: string;
  examplePassage: string;
  exampleQuestions: string;
}

export async function generateReadingFromExample(
  opts: ReadingFromExampleOptions,
): Promise<AIReadingResult> {
  const { apiKey, band, topic, examplePassage, exampleQuestions } = opts;
  const prompt = readingFromExamplePrompt(band, topic, examplePassage, exampleQuestions);
  const raw    = await callOpenAI(apiKey, prompt);
  const parsed = JSON.parse(raw) as Omit<AIReadingResult, 'type' | 'topic' | 'band' | 'createdAt'>;
  return {
    type: 'reading',
    topic: topic || `Band ${band} — AI bài đọc`,
    band,
    passage:           parsed.passage,
    passage_pinyin:    parsed.passage_pinyin,
    passage_vietnamese: parsed.passage_vietnamese,
    questions:         parsed.questions,
    vocabulary:        (parsed as { vocabulary?: AIVocabItem[] }).vocabulary ?? [],
    createdAt: new Date().toLocaleString('vi-VN'),
  };
}
