import React, { useState, useRef, useEffect } from 'react';
import { useLang } from '../../i18n/LangContext';
import type { Lang } from '../../i18n/translations';
import { useApiKey } from '../../contexts/ApiKeyContext';
import { useAIModel } from '../../hooks/useAIModel';
import type { AIModelId } from '../../hooks/useAIModel';
import { AI_MODELS } from '../../hooks/useAIModel';
import {
  IconKey, IconLock, IconUnlock, IconEye, IconEyeOff,
  IconClose, IconCheck, IconWarning,
} from '../UI/Icons';

interface AuthUser { name: string; email: string }

interface Props {
  vocabCount:   number;
  user?:        AuthUser | null;
  onLoginClick: () => void;
  onLogout:     () => void;
}

const LANGS: { id: Lang; label: string }[] = [
  { id: 'vi', label: 'VI' },
  { id: 'zh', label: '中' },
  { id: 'en', label: 'EN' },
];

const TX = {
  login:        { vi: 'Đăng nhập',     zh: '登入',       en: 'Log in'         },
  logout:       { vi: 'Đăng xuất',     zh: '登出',       en: 'Log out'        },
  tagline:      { vi: 'Luyện thi TOCFL hiệu quả', zh: '高效備考 TOCFL', en: 'Master TOCFL effectively' },
  words:        { vi: 'từ vựng',       zh: '詞彙',       en: 'words'          },
  apiKey:       { vi: 'API Key',       zh: 'API 金鑰',    en: 'API Key'        },
  apiKeySet:    { vi: 'Đã cài API Key', zh: '已設定金鑰', en: 'API Key set'    },
  apiKeySave:   { vi: 'Lưu',           zh: '儲存',        en: 'Save'           },
  apiKeyClear:  { vi: 'Xóa key',       zh: '清除金鑰',    en: 'Clear key'      },
  apiKeyRemember:{ vi: 'Nhớ key khi mở lại trình duyệt', zh: '重啟後記住金鑰', en: 'Remember after restart' },
  apiKeyNote:   { vi: 'Key chỉ dùng trong trình duyệt, không gửi lên server.', zh: '金鑰僅在瀏覽器中使用，不會上傳至伺服器。', en: 'Key is used only in your browser, never sent to any server.' },
  apiKeyPlaceholder: { vi: 'sk-…', zh: 'sk-…', en: 'sk-…' },
} as const;

function initials(name: string) {
  return name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

// ─── API Key Panel (popover) ──────────────────────────────────────────────────
const ApiKeyPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { lang } = useLang();
  const { apiKey, hasKey, persisted, setKey, clearKey } = useApiKey();
  const { model, setModel } = useAIModel();
  const [input,   setInput  ] = useState('');
  const [persist, setPersist] = useState(persisted);
  const [showKey, setShowKey] = useState(false);
  const [saved,   setSaved  ] = useState(false);

  const maskedKey = apiKey ? `${apiKey.slice(0, 7)}${'•'.repeat(20)}` : '';

  const handleSave = () => {
    if (!input.trim()) return;
    setKey(input.trim(), persist);
    setInput('');
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClear = () => { clearKey(); setInput(''); };

  return (
    <div className="apikey-panel">
      <div className="apikey-panel-arrow" />

      <div className="apikey-header">
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <IconKey size={15} />
          OpenAI API Key
        </span>
        <button className="apikey-close" onClick={onClose} aria-label="Close">
          <IconClose size={14} />
        </button>
      </div>

      {/* Current key status */}
      {hasKey && (
        <div className="apikey-status">
          <span className="apikey-status-dot" />
          <span className="apikey-masked">
            {showKey ? apiKey : maskedKey}
          </span>
          <button className="apikey-show-btn" onClick={() => setShowKey(v => !v)} aria-label="Toggle visibility">
            {showKey ? <IconEyeOff size={14} /> : <IconEye size={14} />}
          </button>
          <button className="apikey-clear-btn" onClick={handleClear}>
            {TX.apiKeyClear[lang]}
          </button>
        </div>
      )}

      {/* Input */}
      <div className="apikey-input-row">
        <input
          type="password"
          className="apikey-input"
          placeholder={TX.apiKeyPlaceholder[lang]}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          autoComplete="off"
          spellCheck={false}
        />
        <button
          className={`apikey-save-btn${saved ? ' saved' : ''}`}
          onClick={handleSave}
          disabled={!input.trim()}
        >
          {saved
            ? <IconCheck size={14} />
            : TX.apiKeySave[lang]}
        </button>
      </div>

      {/* Persist toggle */}
      <label className="apikey-persist-row">
        <input
          type="checkbox"
          checked={persist}
          onChange={e => setPersist(e.target.checked)}
        />
        <span>{TX.apiKeyRemember[lang]}</span>
        {persist && <IconWarning size={13} className="apikey-persist-warn" />}
      </label>

      {/* AI Model selector */}
      <div style={{ borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 10 }}>
        <label style={{ fontSize: '.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.04em', display: 'block', marginBottom: 6 }}>
          🤖 Model AI giải thích
        </label>
        <select
          value={model}
          onChange={e => setModel(e.target.value as AIModelId)}
          style={{
            width: '100%',
            padding: '7px 10px',
            borderRadius: 6,
            border: '1.5px solid var(--accent)',
            background: 'var(--surface)',
            color: 'var(--text)',
            fontSize: '.82rem',
            fontWeight: 600,
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          {AI_MODELS.map(m => (
            <option key={m.id} value={m.id}>
              {m.label} — {m.desc}
            </option>
          ))}
        </select>
        <div style={{ fontSize: '.68rem', color: 'var(--text-muted)', marginTop: 4 }}>
          Model hiện tại: <strong style={{ color: 'var(--accent)' }}>{AI_MODELS.find(m => m.id === model)?.label}</strong>
        </div>
      </div>

      {/* Security note */}
      <p className="apikey-note">
        <IconLock size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
        {TX.apiKeyNote[lang]}
        {!persist && (
          <span className="apikey-session-note"> Key tự xóa khi đóng tab.</span>
        )}
      </p>
    </div>
  );
};

// ─── Main Header ──────────────────────────────────────────────────────────────
export const AppHeader: React.FC<Props> = ({ vocabCount, user, onLoginClick, onLogout }) => {
  const { lang, setLang } = useLang();
  const { hasKey } = useApiKey();
  const [menuOpen,     setMenuOpen    ] = useState(false);
  const [keyPanelOpen, setKeyPanelOpen] = useState(false);
  const keyBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!keyPanelOpen) return;
    const handler = (e: MouseEvent) => {
      const panel = document.querySelector('.apikey-panel');
      if (panel && !panel.contains(e.target as Node) && !keyBtnRef.current?.contains(e.target as Node)) {
        setKeyPanelOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [keyPanelOpen]);

  return (
    <header className="app-header">
      <div className="header-inner">
        {/* Left: Brand */}
        <div className="header-brand">
          <div className="brand-logo"><span>T</span></div>
          <div className="brand-text">
            <div className="brand-name">TOCFL Study</div>
            <div className="brand-sub">
              {TX.tagline[lang]} · {vocabCount.toLocaleString()} {TX.words[lang]}
            </div>
          </div>
        </div>

        {/* Right */}
        <div className="header-right">
          {/* Language switcher */}
          <div className="lang-switcher">
            {LANGS.map(l => (
              <button
                key={l.id}
                className={`lang-btn${lang === l.id ? ' lang-btn--active' : ''}`}
                onClick={() => setLang(l.id)}
              >
                {l.label}
              </button>
            ))}
          </div>

          {/* API Key button */}
          <div className="apikey-area">
            <button
              ref={keyBtnRef}
              className={`apikey-btn${hasKey ? ' apikey-btn--set' : ''}${keyPanelOpen ? ' active' : ''}`}
              onClick={() => setKeyPanelOpen(v => !v)}
              title={hasKey ? TX.apiKeySet[lang] : TX.apiKey[lang]}
            >
              <span className="apikey-btn-icon">
                {hasKey ? <IconKey size={15} /> : <IconUnlock size={15} />}
              </span>
              <span className="apikey-btn-label">
                {hasKey ? TX.apiKeySet[lang] : TX.apiKey[lang]}
              </span>
              {hasKey && <span className="apikey-dot" />}
            </button>

            {keyPanelOpen && (
              <ApiKeyPanel onClose={() => setKeyPanelOpen(false)} />
            )}
          </div>

          {/* User */}
          {user ? (
            <div className="user-area">
              <button
                className="user-avatar"
                onClick={() => setMenuOpen(v => !v)}
                title={user.name}
              >
                {initials(user.name)}
              </button>
              {menuOpen && (
                <>
                  <div className="user-backdrop" onClick={() => setMenuOpen(false)} />
                  <div className="user-menu">
                    <div className="user-menu-info">
                      <div className="user-menu-name">{user.name}</div>
                      <div className="user-menu-email">{user.email}</div>
                    </div>
                    <button
                      className="user-menu-logout"
                      onClick={() => { setMenuOpen(false); onLogout(); }}
                    >
                      {TX.logout[lang]}
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button className="header-login-btn" onClick={onLoginClick}>
              {TX.login[lang]}
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
