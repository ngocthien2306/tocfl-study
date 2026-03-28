import type { AISentenceResult, AIReadingResult } from '../../types';

const API_URL = 'https://api.openai.com/v1/chat/completions';

// ─── Prompts ─────────────────────────────────────────────────────────────────

function sentencePrompt(band: string, topic: string, count: number): string {
  return `Bạn là giáo viên tiếng Trung chuyên luyện thi TOCFL.
Hãy tạo ${count} câu ví dụ bằng tiếng Trung phồn thể (Traditional Chinese) phù hợp với trình độ TOCFL Band ${band}.
${topic ? `Chủ đề: ${topic}.` : 'Chọn chủ đề đời thường phù hợp với trình độ.'}

Yêu cầu:
- Câu dài ${band === 'A' ? '10-18' : '18-30'} chữ Hán
- Ngữ pháp và từ vựng chuẩn TOCFL Band ${band}
- Đa dạng cấu trúc câu
- Từ chìa khoá (key_words) là từ QUAN TRỌNG cần học trong câu đó (2-4 từ)

Trả về JSON chính xác theo format sau, KHÔNG thêm text ngoài JSON:
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

function readingPrompt(band: string, topic: string): string {
  const length = band === 'A' ? '120-180' : '200-300';
  const qCount = band === 'A' ? 3 : 5;
  return `Bạn là giáo viên tiếng Trung chuyên luyện thi TOCFL.
Hãy tạo một bài đọc hiểu bằng tiếng Trung phồn thể (Traditional Chinese) phù hợp với TOCFL Band ${band}.
${topic ? `Chủ đề: ${topic}.` : 'Chọn chủ đề đời thường, thú vị, phù hợp trình độ.'}

Yêu cầu bài đọc:
- Độ dài ${length} chữ Hán
- Từ vựng và ngữ pháp chuẩn Band ${band}
- Nội dung mạch lạc, tự nhiên
- ${qCount} câu hỏi trắc nghiệm 4 đáp án (A/B/C/D)
- Giải thích đáp án chi tiết bằng tiếng Việt (nêu rõ tại sao đúng và tại sao các đáp án kia sai)

Trả về JSON chính xác theo format sau, KHÔNG thêm text ngoài JSON:
{
  "passage": "Toàn bộ đoạn văn chữ Hán...",
  "passage_pinyin": "Phiên âm pinyin đầy đủ...",
  "passage_vietnamese": "Dịch toàn bộ đoạn văn sang tiếng Việt...",
  "questions": [
    {
      "question": "Câu hỏi bằng tiếng Trung?",
      "options": {
        "A": "Đáp án A",
        "B": "Đáp án B",
        "C": "Đáp án C",
        "D": "Đáp án D"
      },
      "answer": "A",
      "explanation": "Giải thích chi tiết tại sao A đúng, B/C/D sai... (bằng tiếng Việt)"
    }
  ]
}`;
}

// ─── API call ─────────────────────────────────────────────────────────────────

async function callOpenAI(apiKey: string, prompt: string): Promise<string> {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
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
): Promise<AISentenceResult> {
  const prompt = sentencePrompt(band, topic, count);
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
): Promise<AIReadingResult> {
  const prompt = readingPrompt(band, topic);
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
