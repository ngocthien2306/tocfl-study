import React from 'react';
import { useLang } from '../../i18n/LangContext';
import type { Lang } from '../../i18n/translations';

export type TabId = 'flashcard' | 'reading' | 'exam' | 'listening' | 'ai' | 'progress';

interface NavProps {
  active:       TabId;
  onChange:     (tab: TabId) => void;
  user?:        { name: string; email: string } | null;
  onLoginClick: () => void;
  onLogout:     () => void;
}

const TABS_STATIC: { id: TabId; emoji: string }[] = [
  { id: 'flashcard', emoji: '📚' },
  { id: 'reading',   emoji: '📖' },
  { id: 'exam',      emoji: '📝' },
  { id: 'listening', emoji: '🎧' },
  { id: 'ai',        emoji: '🤖' },
  { id: 'progress',  emoji: '📊' },
];

const LANGS: { id: Lang; label: string }[] = [
  { id: 'vi', label: 'VI' },
  { id: 'zh', label: '中' },
  { id: 'en', label: 'EN' },
];

const TAB_TEXTS: Record<TabId, { vi: string; zh: string; en: string }> = {
  flashcard:  { vi: 'Từ vựng',   zh: '詞彙',   en: 'Vocab'   },
  reading:    { vi: 'Luyện đọc', zh: '閱讀',   en: 'Reading' },
  exam:       { vi: 'Thi thử',   zh: '考試',   en: 'Exam'    },
  listening:  { vi: 'Nghe',      zh: '聽力',   en: 'Listen'  },
  ai:         { vi: 'AI Tạo',    zh: 'AI生成', en: 'AI Gen'  },
  progress:   { vi: 'Tiến độ',   zh: '進度',   en: 'Progress'},
};

const USER_TX = {
  login:    { vi: 'Đăng nhập', zh: '登入', en: 'Log in'  },
  logout:   { vi: 'Đăng xuất', zh: '登出', en: 'Log out' },
} as const;

function initials(name: string): string {
  return name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

export const Nav: React.FC<NavProps> = ({ active, onChange, user, onLoginClick, onLogout }) => {
  const { lang, setLang } = useLang();
  const [showUserMenu, setShowUserMenu] = React.useState(false);

  return (
    <nav style={{
      display: 'flex',
      alignItems: 'stretch',
      borderBottom: '2px solid var(--border)',
      marginBottom: 16,
      background: 'var(--surface)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      {/* Tab strip */}
      <div style={{
        display: 'flex', flex: 1,
        overflowX: 'auto', scrollbarWidth: 'none',
        WebkitOverflowScrolling: 'touch',
      }}>
        {TABS_STATIC.map(tab => {
          const isActive = active === tab.id;
          const label = TAB_TEXTS[tab.id][lang];
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              style={{
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: 2, padding: '8px 14px',
                border: 'none',
                borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                marginBottom: -2,
                background: 'transparent',
                color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                fontWeight: isActive ? 700 : 500,
                fontFamily: 'inherit', cursor: 'pointer',
                transition: 'color .15s, border-color .15s',
                whiteSpace: 'nowrap', flexShrink: 0,
              }}
            >
              <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>{tab.emoji}</span>
              <span className="nav-tab-text" style={{ fontSize: '.72rem' }}>{label}</span>
            </button>
          );
        })}
      </div>

      {/* Right side: Lang + User */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '0 8px', borderLeft: '1px solid var(--border)',
        flexShrink: 0, background: 'var(--surface)',
      }}>
        {/* Lang switcher */}
        {LANGS.map(l => (
          <button
            key={l.id}
            onClick={() => setLang(l.id)}
            style={{
              padding: '4px 6px', fontSize: '.68rem',
              fontWeight: lang === l.id ? 700 : 500, borderRadius: 4,
              border: lang === l.id ? '1px solid var(--accent)' : '1px solid transparent',
              background: lang === l.id ? 'var(--accent-light)' : 'transparent',
              color: lang === l.id ? 'var(--accent)' : 'var(--text-secondary)',
              cursor: 'pointer', transition: 'all .15s',
              minWidth: 26, textAlign: 'center', minHeight: 28,
              fontFamily: 'inherit',
            }}
          >
            {l.label}
          </button>
        ))}

        {/* Divider */}
        <div style={{ width: 1, height: 24, background: 'var(--border)', margin: '0 2px' }} />

        {/* User area */}
        {user ? (
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowUserMenu(v => !v)}
              title={user.name}
              style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'var(--accent, #3b82f6)',
                color: '#fff', border: 'none', cursor: 'pointer',
                fontSize: '.72rem', fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {initials(user.name)}
            </button>

            {/* Dropdown */}
            {showUserMenu && (
              <>
                {/* backdrop */}
                <div onClick={() => setShowUserMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 200 }} />
                <div style={{
                  position: 'absolute', top: 40, right: 0,
                  background: 'var(--card-bg, #fff)',
                  border: '1px solid var(--border)',
                  borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.12)',
                  padding: '10px 0', minWidth: 180, zIndex: 201,
                }}>
                  <div style={{ padding: '6px 14px 10px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontWeight: 700, fontSize: '.9rem' }}>{user.name}</div>
                    <div style={{ fontSize: '.75rem', color: 'var(--text-secondary)' }}>{user.email}</div>
                  </div>
                  <button
                    onClick={() => { setShowUserMenu(false); onLogout(); }}
                    style={{
                      display: 'block', width: '100%', padding: '8px 14px',
                      background: 'none', border: 'none', textAlign: 'left',
                      cursor: 'pointer', color: '#dc2626', fontWeight: 600,
                      fontSize: '.85rem', fontFamily: 'inherit',
                    }}
                  >
                    {USER_TX.logout[lang]}
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <button
            onClick={onLoginClick}
            style={{
              padding: '5px 10px', fontSize: '.75rem', fontWeight: 600,
              borderRadius: 6, border: '1px solid var(--accent, #3b82f6)',
              background: 'transparent', color: 'var(--accent, #3b82f6)',
              cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
            }}
          >
            {USER_TX.login[lang]}
          </button>
        )}
      </div>
    </nav>
  );
};
