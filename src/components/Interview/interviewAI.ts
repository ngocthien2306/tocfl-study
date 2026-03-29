/**
 * Client-side OpenAI calls for interview features.
 * BE chỉ lưu trữ; AI gọi từ FE để nhất quán với phần còn lại của app.
 */

const API_URL = 'https://api.openai.com/v1/chat/completions';

interface ChatMessage { role: 'system' | 'user' | 'assistant'; content: string; }

/** Non-streaming call — used for JSON-heavy tasks (profile extraction). */
async function callOpenAI(apiKey: string, messages: ChatMessage[]): Promise<string> {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.75,
      response_format: { type: 'json_object' },
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(err.error?.message ?? `HTTP ${res.status}`);
  }
  const data = await res.json() as { choices: { message: { content: string } }[] };
  return data.choices[0].message.content;
}

/**
 * Streaming call — used for chat replies.
 *
 * The model outputs the conversational reply as plain text, followed by a
 * JSON metadata object on a separate line at the very end:
 *
 *   Some natural reply here…
 *   {"score": 7.5, "feedback": {...}}
 *
 * `onToken` receives each text token so the UI renders progressively.
 * The full accumulated text is returned for final parsing by the caller.
 */
async function streamOpenAI(
  apiKey: string,
  messages: ChatMessage[],
  onToken: (token: string) => void,
): Promise<string> {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: 'gpt-4o-mini', messages, temperature: 0.75, stream: true }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(err.error?.message ?? `HTTP ${res.status}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const raw = decoder.decode(value, { stream: true });

    for (const line of raw.split('\n')) {
      if (!line.startsWith('data: ')) continue;
      const payload = line.slice(6).trim();
      if (payload === '[DONE]') continue;
      try {
        const frame = JSON.parse(payload) as {
          choices: { delta: { content?: string } }[];
        };
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
 * Extract reply + optional STAR metadata from the raw streamed text.
 * The model appends a JSON object on its own line at the end for score/feedback.
 * Everything before that line is the human-readable reply.
 */
function parseStreamedReply(raw: string): {
  reply: string;
  score?: number;
  feedback?: Record<string, unknown>;
} {
  const trimmed = raw.trim();
  // Find last JSON-object line (starts with '{')
  const lastNewline = trimmed.lastIndexOf('\n{');
  if (lastNewline !== -1) {
    const replyPart = trimmed.slice(0, lastNewline).trim();
    const jsonPart  = trimmed.slice(lastNewline).trim();
    try {
      const meta = JSON.parse(jsonPart) as { score?: number; feedback?: Record<string, unknown> };
      return { reply: replyPart, score: meta.score, feedback: meta.feedback };
    } catch { /* fall through */ }
  }
  // No metadata line — whole text is the reply
  return { reply: trimmed };
}

// ─── Profile extraction ───────────────────────────────────────────────────────
export async function extractProfile(apiKey: string, rawText: string): Promise<{
  profile_json: string;
  analysis_json: string;
}> {
  const prompt: ChatMessage[] = [
    {
      role: 'system',
      content: `Bạn là chuyên gia phân tích hồ sơ ứng viên. Phân tích tài liệu sau và trả về JSON chính xác.`,
    },
    {
      role: 'user',
      content: `Phân tích tài liệu này và trả về JSON với 2 key:

"profile": {
  "name": "tên ứng viên hoặc null",
  "current_role": "vị trí hiện tại hoặc null",
  "years_experience": số năm kinh nghiệm hoặc 0,
  "skills": ["skill1", "skill2", ...],
  "education": ["Đại học A - Ngành B (năm)", ...],
  "achievements": ["thành tích quan trọng nhất", ...],
  "languages": ["Tiếng Việt", "English", ...],
  "doc_type": "cv" | "cover_letter" | "portfolio" | "other"
}

"analysis": {
  "strengths": ["điểm mạnh 1", "điểm mạnh 2", ...],
  "gaps": ["điểm cần cải thiện 1", ...],
  "ats_keywords": ["keyword ATS quan trọng", ...],
  "highlight": "một câu tóm tắt achievement ấn tượng nhất để dùng trong interview"
}

Tài liệu:
---
${rawText.slice(0, 8000)}
---`,
    },
  ];

  const raw = await callOpenAI(apiKey, prompt);
  const parsed = JSON.parse(raw) as { profile: unknown; analysis: unknown };
  return {
    profile_json:  JSON.stringify(parsed.profile),
    analysis_json: JSON.stringify(parsed.analysis),
  };
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export interface ChatOptions {
  apiKey:    string;
  mode:      'mock' | 'coach';
  jobTitle:  string;
  company:   string;
  profile:   string;    // JSON string
  history:   ChatMessage[];
  userMsg:   string;
  /** Called with each streamed token as it arrives — enables progressive rendering & TTS. */
  onToken?:  (token: string) => void;
}

export interface ChatResponse {
  content:       string;
  score?:        number;
  feedback_json?: string;
}

function buildSystemPrompt(opts: ChatOptions): string {
  const { mode, jobTitle, company, profile } = opts;
  const profileSection = profile
    ? `\nHồ sơ ứng viên:\n${profile}\n`
    : '';

  if (mode === 'mock') {
    return `Bạn là nhà tuyển dụng chuyên nghiệp đang phỏng vấn cho vị trí "${jobTitle || 'ứng viên muốn tập luyện'}"${company ? ` tại ${company}` : ''}.
${profileSection}
Nhiệm vụ của bạn:
1. Hỏi các câu hỏi phỏng vấn thực tế, đa dạng (behavioral, situational, technical, motivation)
2. Chỉ hỏi 1 câu mỗi lượt
3. Sau mỗi câu trả lời của ứng viên, đánh giá ngắn gọn theo STAR framework
4. Sau đó hỏi câu tiếp theo hoặc follow-up nếu cần

Cách trả lời: Viết câu hỏi/phản hồi dưới dạng văn bản tự nhiên, ngắn gọn, chuyên nghiệp.
Trên một dòng riêng ở CUỐI CÙNG (không có dòng trống trước đó), thêm JSON metadata:
- Khi hỏi câu mới (chưa có câu trả lời để chấm): {"score":null,"feedback":null}
- Khi phản hồi câu trả lời của ứng viên: {"score":7.5,"feedback":{"situation":7,"task":8,"action":7,"result":8,"overall":7,"tips":["gợi ý ngắn 1","gợi ý ngắn 2"]}}

Ví dụ định dạng:
Cảm ơn bạn đã chia sẻ! Câu trả lời của bạn khá rõ ràng. Bạn có thể làm nổi bật kết quả cụ thể hơn. Tiếp theo: Hãy kể về một tình huống bạn phải xử lý áp lực cao.
{"score":7.0,"feedback":{"situation":7,"task":7,"action":8,"result":6,"overall":7,"tips":["Thêm số liệu cụ thể vào phần Result","Nêu rõ vai trò của bạn trong team"]}}

Bắt đầu bằng lời giới thiệu ngắn và câu hỏi đầu tiên.`;
  } else {
    return `Bạn là huấn luyện viên phỏng vấn chuyên nghiệp.
${profileSection}${jobTitle ? `Ứng viên đang ứng tuyển vị trí: ${jobTitle}${company ? ` tại ${company}` : ''}\n` : ''}
Nhiệm vụ của bạn:
1. Giúp ứng viên cải thiện câu trả lời phỏng vấn
2. Gợi ý cách dùng phương pháp STAR hiệu quả hơn
3. Chỉ ra từ khóa nên nhấn mạnh
4. Đưa ra ví dụ câu trả lời tốt hơn, cá nhân hóa theo hồ sơ
5. Chỉ ra những điều không nên nói

Viết phản hồi và gợi ý của bạn dưới dạng văn bản tự nhiên, rõ ràng. Không cần JSON.`;
  }
}

export async function sendChatMessage(opts: ChatOptions): Promise<ChatResponse> {
  const systemPrompt = buildSystemPrompt(opts);

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...opts.history,
    { role: 'user', content: opts.userMsg },
  ];

  // Always stream — onToken is optional (no-op if not provided)
  const raw = await streamOpenAI(opts.apiKey, messages, opts.onToken ?? (() => {}));
  const { reply, score, feedback } = parseStreamedReply(raw);

  return {
    content:       reply,
    score:         typeof score === 'number' ? score : undefined,
    feedback_json: feedback ? JSON.stringify(feedback) : undefined,
  };
}
