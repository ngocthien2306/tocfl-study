// ── API base URL ──────────────────────────────────────────────────────────────
export const API_BASE = "https://tocfl-study-api.ngrok.app";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface AuthResponse {
  access_token: string;
  token_type:   string;
  user_id:      number;
  name:         string;
  email:        string;
}

export interface UserInfo {
  user_id: number;
  name:    string;
  email:   string;
}

export interface ProgressData {
  words:   Record<string, boolean>;
  reading: Record<string, boolean>;
}

export interface ExamRecord {
  id:       number;
  band:     string;
  exam_key: string;
  score:    number;
  total:    number;
  taken_at: string;
}

// ── Fetch helper ──────────────────────────────────────────────────────────────
async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    // ngrok free tier cần header này để bypass browser warning page
    "ngrok-skip-browser-warning": "true",
    ...(options.headers as Record<string, string> ?? {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "API error");
  }
  return res.json() as Promise<T>;
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  register: (email: string, name: string, password: string) =>
    apiFetch<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, name, password }),
    }),

  login: (email: string, password: string) =>
    apiFetch<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  me: (token: string) =>
    apiFetch<UserInfo>("/auth/me", {}, token),
};

// ── Progress ──────────────────────────────────────────────────────────────────
export const progressApi = {
  get: (token: string) =>
    apiFetch<ProgressData>("/progress", {}, token),

  sync: (token: string, data: ProgressData) =>
    apiFetch<{ synced: number }>("/progress/sync", {
      method: "POST",
      body: JSON.stringify(data),
    }, token),

  markWord: (token: string, key: string, correct: boolean) =>
    apiFetch<{ ok: boolean }>(`/progress/word/${key}?correct=${correct}`, {
      method: "POST",
    }, token),

  markReading: (token: string, key: string, correct: boolean) =>
    apiFetch<{ ok: boolean }>(`/progress/reading/${key}?correct=${correct}`, {
      method: "POST",
    }, token),

  getExams: (token: string) =>
    apiFetch<ExamRecord[]>("/progress/exams", {}, token),

  addExam: (token: string, band: string, exam_key: string, score: number, total: number) =>
    apiFetch<ExamRecord>("/progress/exams", {
      method: "POST",
      body: JSON.stringify({ band, exam_key, score, total }),
    }, token),
};

// ── AI Content ────────────────────────────────────────────────────────────────
export interface AIContentItem {
  id:           number;
  type:         string;
  band:         string;
  topic:        string;
  title:        string;
  note:         string | null;
  content_json: string;
  vocab_used:   string[] | null;
  created_at:   string;
  updated_at:   string;
}

export const aiContentApi = {
  list: (token: string) =>
    apiFetch<AIContentItem[]>("/ai-content", {}, token),

  create: (token: string, payload: {
    type: string; band: string; topic: string;
    title: string; note?: string;
    content_json: string; vocab_used?: string[];
  }) =>
    apiFetch<AIContentItem>("/ai-content", {
      method: "POST",
      body: JSON.stringify(payload),
    }, token),

  update: (token: string, id: number, patch: { title?: string; note?: string }) =>
    apiFetch<AIContentItem>(`/ai-content/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }, token),

  delete: (token: string, id: number) =>
    fetch(`${API_BASE}/ai-content/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        "ngrok-skip-browser-warning": "true",
      },
    }),
};
// ── Interview ──────────────────────────────────────────────────────────────────
import type {
  InterviewDocument, InterviewSession, SessionMessage,
} from '../types';

async function apiFetchMultipart<T>(
  path: string,
  formData: FormData,
  token: string,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "ngrok-skip-browser-warning": "true",
      // Do NOT set Content-Type — browser sets it with boundary
    },
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Upload error");
  }
  return res.json() as Promise<T>;
}

export const interviewApi = {
  // Documents
  uploadDocument: (token: string, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return apiFetchMultipart<InterviewDocument>("/interview/documents/upload", fd, token);
  },

  listDocuments: (token: string) =>
    apiFetch<InterviewDocument[]>("/interview/documents", {}, token),

  saveAnalysis: (token: string, docId: number, profile_json: string, analysis_json: string) =>
    apiFetch<InterviewDocument>(`/interview/documents/${docId}/analyze`, {
      method: "POST",
      body: JSON.stringify({ profile_json, analysis_json }),
    }, token),

  deleteDocument: (token: string, docId: number) =>
    fetch(`${API_BASE}/interview/documents/${docId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}`, "ngrok-skip-browser-warning": "true" },
    }),

  // Sessions
  createSession: (token: string, payload: {
    title?: string; job_title?: string; company?: string;
    mode: string; doc_ids?: number[];
  }) =>
    apiFetch<InterviewSession>("/interview/sessions", {
      method: "POST",
      body: JSON.stringify(payload),
    }, token),

  listSessions: (token: string) =>
    apiFetch<InterviewSession[]>("/interview/sessions", {}, token),

  getSession: (token: string, id: number) =>
    apiFetch<InterviewSession>(`/interview/sessions/${id}`, {}, token),

  updateSession: (token: string, id: number, patch: { title?: string; job_title?: string; company?: string }) =>
    apiFetch<InterviewSession>(`/interview/sessions/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }, token),

  deleteSession: (token: string, id: number) =>
    fetch(`${API_BASE}/interview/sessions/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}`, "ngrok-skip-browser-warning": "true" },
    }),

  // Messages
  addMessage: (token: string, sessionId: number, msg: {
    role: string; content: string; score?: number | null; feedback_json?: string | null;
  }) =>
    apiFetch<SessionMessage>(`/interview/sessions/${sessionId}/messages`, {
      method: "POST",
      body: JSON.stringify(msg),
    }, token),

  bulkAddMessages: (token: string, sessionId: number, messages: {
    role: string; content: string; score?: number | null; feedback_json?: string | null;
  }[]) =>
    apiFetch<{ saved: number }>(`/interview/sessions/${sessionId}/messages/bulk`, {
      method: "POST",
      body: JSON.stringify(messages),
    }, token),
};
