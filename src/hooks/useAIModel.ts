/**
 * useAIModel — persistent model preference for AI explanation features.
 * Saved to localStorage so it survives page reloads.
 */
import { useState, useCallback } from 'react';

const MODEL_KEY = 'tocfl_ai_model';

export const AI_MODELS = [
  // ── GPT-4o series ───────────────────────────────────────────────────────────
  { id: 'gpt-4o-mini',   label: 'GPT-4o Mini',   desc: 'Nhanh · Rẻ · Mặc định',        group: 'GPT-4o' },
  { id: 'gpt-4o',        label: 'GPT-4o',         desc: 'Chất lượng cao',                group: 'GPT-4o' },
  // ── GPT-4.1 series (April 2025) ─────────────────────────────────────────────
  { id: 'gpt-4.1-nano',  label: 'GPT-4.1 Nano',  desc: 'Siêu nhanh · Rẻ nhất',         group: 'GPT-4.1' },
  { id: 'gpt-4.1-mini',  label: 'GPT-4.1 Mini',  desc: 'Nhanh · Cân bằng tốt',         group: 'GPT-4.1' },
  { id: 'gpt-4.1',       label: 'GPT-4.1',        desc: 'Mạnh · Độ chính xác cao',      group: 'GPT-4.1' },
  // ── o-series reasoning ──────────────────────────────────────────────────────
  { id: 'o4-mini',       label: 'o4-mini',        desc: 'Suy luận sâu · Nhanh',         group: 'o-series' },
  { id: 'o3',            label: 'o3',             desc: 'Suy luận mạnh nhất',            group: 'o-series' },
] as const;

export type AIModelId = typeof AI_MODELS[number]['id'];

function loadModel(): AIModelId {
  try {
    const v = localStorage.getItem(MODEL_KEY);
    if (v && AI_MODELS.some(m => m.id === v)) return v as AIModelId;
  } catch { /* storage blocked */ }
  return 'gpt-4o-mini';
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
