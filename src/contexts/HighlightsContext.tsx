/**
 * HighlightsContext
 *
 * Quản lý danh sách highlight toàn app:
 *  - Load từ localStorage khi khởi động (offline-first)
 *  - Sync lên BE khi có token (sau khi đăng nhập)
 *  - add/remove tự động cập nhật cả local + BE
 */
import React, {
  createContext, useCallback, useContext, useEffect, useRef, useState,
} from 'react';
import { highlightsApi, type HighlightRecord } from '../api/client';

// ─── localStorage key ─────────────────────────────────────────────────────────
const LS_KEY = 'tocfl_highlights';

function loadLocal(): HighlightRecord[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as HighlightRecord[]) : [];
  } catch {
    return [];
  }
}

function saveLocal(list: HighlightRecord[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(list));
  } catch { /* storage full */ }
}

// ─── Context types ────────────────────────────────────────────────────────────
export interface NewHighlight {
  page_key:   string;
  text:       string;
  ctx_before?: string;
  ctx_after?:  string;
  color?:      string;
  pinyin?:     string;
  meaning?:    string;
  note?:       string;
}

interface HighlightsContextValue {
  highlights:     HighlightRecord[];
  /** Thêm highlight mới; trả về record đã lưu (id có thể là temp nếu offline) */
  add:            (h: NewHighlight) => Promise<HighlightRecord>;
  /** Xoá highlight theo id */
  remove:         (id: number) => Promise<void>;
  /** Lấy highlights theo page_key */
  getForPage:     (page_key: string) => HighlightRecord[];
  isLoading:      boolean;
}

const HighlightsContext = createContext<HighlightsContextValue>({
  highlights: [],
  add:        async () => ({} as HighlightRecord),
  remove:     async () => {},
  getForPage: () => [],
  isLoading:  false,
});

// ─── Provider ─────────────────────────────────────────────────────────────────
interface Props {
  token?: string | null;
  children: React.ReactNode;
}

export const HighlightsProvider: React.FC<Props> = ({ token, children }) => {
  const [highlights, setHighlights] = useState<HighlightRecord[]>(loadLocal);
  const [isLoading,  setIsLoading]  = useState(false);
  // Track last synced token to re-fetch when user logs in
  const lastToken = useRef<string | null>(null);

  // ── Sync from BE on login ──────────────────────────────────────────────────
  useEffect(() => {
    if (!token || token === lastToken.current) return;
    lastToken.current = token;

    setIsLoading(true);
    highlightsApi.list(token).then(beList => {
      // Merge: BE is source of truth; keep any local-only highlights
      // (those with negative/temp ids added while offline — not supported yet,
      // but safe to keep in mind)
      setHighlights(beList);
      saveLocal(beList);
    }).catch(() => {
      // BE unreachable — keep local copy
    }).finally(() => {
      setIsLoading(false);
    });
  }, [token]);

  // ── add ───────────────────────────────────────────────────────────────────
  const add = useCallback(async (h: NewHighlight): Promise<HighlightRecord> => {
    if (token) {
      // BE-first when authenticated
      const created = await highlightsApi.create(token, {
        ...h,
        pinyin:  h.pinyin,
        meaning: h.meaning,
      });
      setHighlights(prev => {
        const next = [...prev, created];
        saveLocal(next);
        return next;
      });
      return created;
    } else {
      // Offline: store with a temporary negative id
      const tmp: HighlightRecord = {
        id:         -(Date.now()),
        page_key:   h.page_key,
        text:       h.text,
        ctx_before: h.ctx_before ?? null,
        ctx_after:  h.ctx_after  ?? null,
        color:      h.color      ?? '#fde68a',
        pinyin:     h.pinyin     ?? null,
        meaning:    h.meaning    ?? null,
        note:       h.note       ?? null,
        created_at: new Date().toISOString(),
      };
      setHighlights(prev => {
        const next = [...prev, tmp];
        saveLocal(next);
        return next;
      });
      return tmp;
    }
  }, [token]);

  // ── remove ────────────────────────────────────────────────────────────────
  const remove = useCallback(async (id: number): Promise<void> => {
    // Optimistic local removal
    setHighlights(prev => {
      const next = prev.filter(h => h.id !== id);
      saveLocal(next);
      return next;
    });
    if (token && id > 0) {
      await highlightsApi.delete(token, id).catch(() => {
        // If delete fails we keep the local removal (user intention)
      });
    }
  }, [token]);

  // ── getForPage ────────────────────────────────────────────────────────────
  const getForPage = useCallback(
    (page_key: string) => highlights.filter(h => h.page_key === page_key),
    [highlights],
  );

  return (
    <HighlightsContext.Provider value={{ highlights, add, remove, getForPage, isLoading }}>
      {children}
    </HighlightsContext.Provider>
  );
};

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useHighlights(): HighlightsContextValue {
  return useContext(HighlightsContext);
}
