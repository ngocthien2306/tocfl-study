import React, { useState, useEffect } from "react";
import { useLang } from "../../i18n/LangContext";

// ── i18n strings (inline for self-containment) ────────────────────────────────
const TX = {
  login:        { vi: "Đăng nhập",       zh: "登入",     en: "Log in"      },
  register:     { vi: "Đăng ký",         zh: "註冊",     en: "Sign up"     },
  name:         { vi: "Tên hiển thị",    zh: "顯示名稱", en: "Display name" },
  email:        { vi: "Email",           zh: "電子郵件", en: "Email"       },
  password:     { vi: "Mật khẩu",        zh: "密碼",     en: "Password"    },
  submitting:   { vi: "Đang xử lý…",     zh: "處理中…",  en: "Processing…" },
  no_account:   { vi: "Chưa có tài khoản?", zh: "還沒有帳號？", en: "No account?" },
  has_account:  { vi: "Đã có tài khoản?", zh: "已有帳號？", en: "Have an account?" },
  switch_reg:   { vi: "Đăng ký ngay",   zh: "立即註冊", en: "Sign up"     },
  switch_login: { vi: "Đăng nhập",       zh: "登入",     en: "Log in"      },
  close:        { vi: "Đóng",            zh: "關閉",     en: "Close"       },
  skip:         { vi: "Dùng không cần đăng nhập", zh: "免登入繼續使用", en: "Continue without account" },
  title_login:  { vi: "Đăng nhập",       zh: "登入帳號", en: "Log In"      },
  title_reg:    { vi: "Tạo tài khoản",   zh: "建立帳號", en: "Create Account" },
  benefit:      { vi: "Đăng nhập để lưu tiến độ học tập trên mọi thiết bị.", zh: "登入後可在所有裝置同步學習進度。", en: "Log in to sync your progress across all devices." },
} as const;

interface Props {
  onSuccess: () => void;
  onClose:   () => void;
  onLogin:   (email: string, password: string) => Promise<boolean>;
  onRegister:(email: string, name: string, password: string) => Promise<boolean>;
  authError: string | null;
  loading:   boolean;
}

export const AuthModal: React.FC<Props> = ({
  onSuccess, onClose, onLogin, onRegister, authError, loading,
}) => {
  const { lang } = useLang();
  const tx = (k: keyof typeof TX) => TX[k][lang];

  const [mode,     setMode    ] = useState<"login" | "register">("login");
  const [email,    setEmail   ] = useState("");
  const [name,     setName    ] = useState("");
  const [password, setPassword] = useState("");
  const [localErr, setLocalErr] = useState<string | null>(null);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLocalErr(null);

    if (!email.trim() || !password.trim()) {
      setLocalErr("Vui lòng điền đầy đủ thông tin."); return;
    }
    if (mode === "register" && !name.trim()) {
      setLocalErr("Vui lòng nhập tên hiển thị."); return;
    }

    let ok: boolean;
    if (mode === "login") {
      ok = await onLogin(email.trim(), password);
    } else {
      ok = await onRegister(email.trim(), name.trim(), password);
    }
    if (ok) onSuccess();
  }

  const err = localErr ?? authError;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,.45)",
          zIndex: 1000, backdropFilter: "blur(3px)",
        }}
      />

      {/* Modal */}
      <div style={{
        position: "fixed", top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 1001,
        background: "var(--card-bg, #fff)",
        borderRadius: 16,
        boxShadow: "0 20px 60px rgba(0,0,0,.25)",
        width: "min(420px, 92vw)",
        padding: "32px 28px 24px",
      }}>
        {/* Close btn */}
        <button
          onClick={onClose}
          style={{
            position: "absolute", top: 14, right: 16,
            background: "none", border: "none", cursor: "pointer",
            fontSize: 20, color: "var(--text-secondary)", lineHeight: 1,
          }}
          aria-label={tx("close")}
        >×</button>

        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: "1.3rem", fontWeight: 700 }}>
            {mode === "login" ? tx("title_login") : tx("title_reg")}
          </h2>
          <p style={{ margin: "6px 0 0", fontSize: ".85rem", color: "var(--text-secondary)" }}>
            {tx("benefit")}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {mode === "register" && (
            <div>
              <label style={labelStyle}>{tx("name")}</label>
              <input
                style={inputStyle}
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Nguyễn Văn A"
                autoComplete="name"
                disabled={loading}
              />
            </div>
          )}

          <div>
            <label style={labelStyle}>{tx("email")}</label>
            <input
              style={inputStyle}
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              disabled={loading}
              autoFocus
            />
          </div>

          <div>
            <label style={labelStyle}>{tx("password")}</label>
            <input
              style={inputStyle}
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              disabled={loading}
            />
          </div>

          {err && (
            <div style={{
              background: "#fef2f2", border: "1px solid #fca5a5",
              borderRadius: 8, padding: "8px 12px",
              color: "#dc2626", fontSize: ".83rem",
            }}>
              {err}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 4,
              padding: "11px 0",
              background: loading ? "var(--border)" : "var(--accent, #3b82f6)",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontSize: "1rem",
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              transition: "background .15s",
            }}
          >
            {loading ? tx("submitting") : (mode === "login" ? tx("login") : tx("register"))}
          </button>
        </form>

        {/* Switch mode */}
        <p style={{ textAlign: "center", marginTop: 16, fontSize: ".85rem", color: "var(--text-secondary)" }}>
          {mode === "login" ? tx("no_account") : tx("has_account")}{" "}
          <button
            onClick={() => { setMode(mode === "login" ? "register" : "login"); setLocalErr(null); }}
            style={{ background: "none", border: "none", color: "var(--accent, #3b82f6)", cursor: "pointer", fontWeight: 600, padding: 0 }}
          >
            {mode === "login" ? tx("switch_reg") : tx("switch_login")}
          </button>
        </p>

        {/* Skip */}
        <p style={{ textAlign: "center", marginTop: 4 }}>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: ".8rem" }}
          >
            {tx("skip")}
          </button>
        </p>
      </div>
    </>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: ".8rem",
  fontWeight: 600,
  marginBottom: 4,
  color: "var(--text-secondary)",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  border: "1px solid var(--border, #e2e8f0)",
  borderRadius: 8,
  fontSize: ".95rem",
  background: "var(--bg, #f8fafc)",
  color: "var(--text, #1e293b)",
  boxSizing: "border-box",
  outline: "none",
};
