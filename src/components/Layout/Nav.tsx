import React from 'react';
import { useLang } from '../../i18n/LangContext';
import type { Lang } from '../../i18n/translations';

export type TabId = 'flashcard' | 'reading' | 'exam' | 'listening' | 'ai' | 'progress';

interface NavProps {
  active: TabId;
  onChange: (tab: TabId) => void;
}

// Each tab: emoji shown always, text label hidden on very small screens via CSS
const TABS_STATIC: { id: TabId; emoji: string; viLabel: string }[] = [
  { id: 'flashcard',  emoji: '📚', viLabel: 'Từ vựng'  },
  { id: 'reading',    emoji: '📖', viLabel: 'Đọc'      },
  { id: 'exam',       emoji: '📝', viLabel: 'Thi'      },
  { id: 'listening',  emoji: '🎧', viLabel: 'Nghe'     },
  { id: 'ai',         emoji: '🤖', viLabel: 'AI'       },
  { id: 'progress',   emoji: '📊', viLabel: 'Tiến độ'  },
];

const LANGS: { id: Lang; label: string }[] = [
  { id: 'vi', label: 'VI' },
  { id: 'zh', label: '中' },
  { id: 'en', label: 'EN' },
];

const TAB_TEXTS: Record<TabId, { vi: string; zh: string; en: string }> = {
  flashcard:  { vi: 'Từ vựng',   zh: '詞彙',   en: 'Vocab'    },
  reading:    { vi: 'Luyện đọc', zh: '閱讀',   en: 'Reading'  },
  exam:       { vi: 'Thi thử',   zh: '考試',   en: 'Exam'     },
  listening:  { vi: 'Nghe',      zh: '聽力',   en: 'Listen'   },
  ai:         { vi: 'AI Tạo',    zh: 'AI生成', en: 'AI Gen'   },
  progress:   { vi: 'Tiến độ',   zh: '進度',   en: 'Progress' },
};

export const Nav: React.FC<NavProps> = ({ active, onChange }) => {
  const { lang, setLang } = useLang();

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
      {/* Tab strip — scrollable on mobile */}
      <div style={{
        display: 'flex',
        flex: 1,
        overflowX: 'auto',
        scrollbarWidth: 'none',
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
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                padding: '8px 14px',
                border: 'none',
                borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                marginBottom: -2,
                background: 'transparent',
                color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                fontWeight: isActive ? 700 : 500,
                fontFamily: 'inherit',
                cursor: 'pointer',
                transition: 'color .15s, border-color .15s',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>{tab.emoji}</span>
              <span className="nav-tab-text" style={{ fontSize: '.72rem' }}>{label}</span>
            </button>
          );
        })}
      </div>

      {/* Language switcher — always visible, compact */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        padding: '0 8px',
        borderLeft: '1px solid var(--border)',
        flexShrink: 0,
        background: 'var(--surface)',
      }}>
        {LANGS.map(l => (
          <button
            key={l.id}
            onClick={() => setLang(l.id)}
            style={{
              padding: '4px 6px',
              fontSize: '.68rem',
              fontWeight: lang === l.id ? 700 : 500,
              borderRadius: 4,
              border: lang === l.id ? '1px solid var(--accent)' : '1px solid transparent',
              background: lang === l.id ? 'var(--accent-light)' : 'transparent',
              color: lang === l.id ? 'var(--accent)' : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all .15s',
              minWidth: 26,
              textAlign: 'center',
              minHeight: 28,
              fontFamily: 'inherit',
            }}
          >
            {l.label}
          </button>
        ))}
      </div>
    </nav>
  );
};
