/**
 * useAIModel — persistent model preference for AI explanation features.
 * Saved to localStorage so it survives page reloads.
 */
import { useState, useCallback } from 'react';

const MODEL_KEY = 'tocfl_ai_model';

export const AI_MODELS = [
  // ── GPT-5.4 series (Latest - March 2026) ───────────────────────────────────
  { id: 'gpt-5.4-nano',  label: 'GPT-5.4 Nano',  desc: 'Siêu tốc · Tối ưu chi phí',    group: 'GPT-5.4' },
  { id: 'gpt-5.4-mini',  label: 'GPT-5.4 Mini',  desc: 'Nhanh · Hỗ trợ Agentic',       group: 'GPT-5.4' },
  { id: 'gpt-5.4',       label: 'GPT-5.4 Standard', desc: 'Cân bằng · Thông minh',    group: 'GPT-5.4' },
  { id: 'gpt-5.4-pro',   label: 'GPT-5.4 Pro',    desc: 'Mạnh nhất · 1M Context',      group: 'GPT-5.4' },

  // ── Specialized Reasoning ──────────────────────────────────────────────────
  { id: 'o3-pro',        label: 'o3-pro',         desc: 'Suy luận cực hạn (Math/Sci)', group: 'Reasoning' },
  { id: 'gpt-5.3-codex', label: 'GPT-5.3 Codex',  desc: 'Chuyên gia lập trình',         group: 'Coding' },
] as const;

export type AIModelId = typeof AI_MODELS[number]['id'];

function loadModel(): AIModelId {
  try {
    const v = localStorage.getItem(MODEL_KEY);
    if (v && AI_MODELS.some(m => m.id === v)) return v as AIModelId;
  } catch { /* storage blocked */ }
  return 'gpt-5.4-mini';
}

function persistModel(id: AIModelId) {
  try { localStorage.setItem(MODEL_KEY, id); } catch { /* quota */ }
}

export function useAIModel() {
  const [model, setModelState] = useState<AIModelId>(loadModel);

  const setModel = useCallback((id: AIModelId) => {
    setModelState(id);
    persistModel(id);
  }, []);

  return { model, setModel, models: AI_MODELS };
}

/** Read model preference without a React hook (for use outside components) */
export function getStoredModel(): AIModelId {
  return loadModel();
}
