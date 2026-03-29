/**
 * ApiKeyContext — quản lý OpenAI API key tập trung.
 *
 * Bảo mật:
 * - Mặc định lưu vào sessionStorage (xóa khi đóng tab/trình duyệt)
 * - Người dùng có thể chọn "Nhớ key" → lưu vào localStorage
 * - Key KHÔNG bao giờ được gửi lên backend
 * - Không encrypt trong JS (encrypt bằng JS không thêm bảo mật thực sự
 *   vì encryption key cũng nằm trong JS)
 */
import React, { createContext, useContext, useState, useCallback } from 'react';

// Storage keys — intentionally vague names (không rõ ràng với attacker)
const SESS_KEY  = '_tap_s';   // sessionStorage — xóa khi đóng tab
const LOCAL_KEY = '_tap_l';   // localStorage   — persist khi chọn

// ─── Load on init ─────────────────────────────────────────────────────────────
function loadStoredKey(): { key: string; persisted: boolean } {
  try {
    // Ưu tiên session (tab hiện tại)
    const sess = sessionStorage.getItem(SESS_KEY);
    if (sess) return { key: sess, persisted: false };

    // Fallback sang localStorage nếu user đã chọn "nhớ key"
    const local = localStorage.getItem(LOCAL_KEY);
    if (local) {
      // Sync sang session để nhanh hơn lần sau
      sessionStorage.setItem(SESS_KEY, local);
      return { key: local, persisted: true };
    }
  } catch {
    // Private browsing hoặc storage bị block
  }
  return { key: '', persisted: false };
}

// ─── Context types ────────────────────────────────────────────────────────────
interface ApiKeyContextValue {
  apiKey:    string;
  hasKey:    boolean;
  persisted: boolean;                              // đang lưu localStorage?
  setKey:    (key: string, persist: boolean) => void;
  clearKey:  () => void;
}

const ApiKeyContext = createContext<ApiKeyContextValue>({
  apiKey: '', hasKey: false, persisted: false,
  setKey: () => {}, clearKey: () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────
export const ApiKeyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initial = loadStoredKey();
  const [apiKey,    setApiKey   ] = useState(initial.key);
  const [persisted, setPersisted] = useState(initial.persisted);

  const setKey = useCallback((key: string, persist: boolean) => {
    const trimmed = key.trim();
    setApiKey(trimmed);
    setPersisted(persist);

    try {
      if (trimmed) {
        sessionStorage.setItem(SESS_KEY, trimmed);
        if (persist) {
          localStorage.setItem(LOCAL_KEY, trimmed);
        } else {
          localStorage.removeItem(LOCAL_KEY);
        }
      } else {
        sessionStorage.removeItem(SESS_KEY);
        localStorage.removeItem(LOCAL_KEY);
      }
    } catch { /* storage blocked */ }
  }, []);

  const clearKey = useCallback(() => {
    setApiKey('');
    setPersisted(false);
    try {
      sessionStorage.removeItem(SESS_KEY);
      localStorage.removeItem(LOCAL_KEY);
    } catch { /* storage blocked */ }
  }, []);

  return (
    <ApiKeyContext.Provider value={{ apiKey, hasKey: !!apiKey, persisted, setKey, clearKey }}>
      {children}
    </ApiKeyContext.Provider>
  );
};

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useApiKey(): ApiKeyContextValue {
  return useContext(ApiKeyContext);
}
