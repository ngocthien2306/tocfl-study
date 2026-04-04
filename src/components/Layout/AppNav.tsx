import React from 'react';
import { useLang } from '../../i18n/LangContext';

export type TabId = 'flashcard' | 'reading' | 'exam' | 'ai' | 'progress' | 'interview';

interface Props {
  active:   TabId;
  onChange: (tab: TabId) => void;
}

// ── SVG icon components ──────────────────────────────────────────────────────

const IconFlashcard = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="5" width="20" height="14" rx="2"/>
    <line x1="2" y1="10" x2="22" y2="10"/>
  </svg>
);

const IconReading = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
  </svg>
);

const IconExam = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="9" y1="13" x2="15" y2="13"/>
    <line x1="9" y1="17" x2="15" y2="17"/>
    <polyline points="9 9 10 9"/>
  </svg>
);


const IconAI = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/>
    <circle cx="9" cy="14" r="1" fill="currentColor" stroke="none"/>
    <circle cx="15" cy="14" r="1" fill="currentColor" stroke="none"/>
  </svg>
);

const IconProgress = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/>
    <line x1="12" y1="20" x2="12" y2="4"/>
    <line x1="6"  y1="20" x2="6"  y2="14"/>
    <line x1="2"  y1="20" x2="22" y2="20"/>
  </svg>
);

const IconInterview = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 1a3 3 0 0 0-3 3v4a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
    <line x1="12" y1="19" x2="12" y2="23"/>
    <line x1="8"  y1="23" x2="16" y2="23"/>
  </svg>
);

// ── Tab definitions ──────────────────────────────────────────────────────────

const TABS: {
  id: TabId;
  icon: React.FC;
  label: Record<'vi' | 'zh' | 'en', string>;
}[] = [
  { id: 'flashcard', icon: IconFlashcard, label: { vi: 'Từ vựng',   zh: '詞彙',   en: 'Vocab'    } },
  { id: 'reading',   icon: IconReading,   label: { vi: 'Đoạn văn', zh: '閱讀',   en: 'Paragraph'  } },
  { id: 'exam',      icon: IconExam,      label: { vi: 'Thi thử', zh: '考試',   en: 'Mock Test'   } },
  { id: 'ai',        icon: IconAI,        label: { vi: 'AI Tạo',    zh: 'AI生成', en: 'AI Gen'   } },
  { id: 'progress',  icon: IconProgress,  label: { vi: 'Tiến độ',   zh: '進度',   en: 'Progress' } },
  { id: 'interview', icon: IconInterview, label: { vi: 'Interview',  zh: '面試',   en: 'Interview'} },
];

// ── Component ────────────────────────────────────────────────────────────────

export const AppNav: React.FC<Props> = ({ active, onChange }) => {
  const { lang } = useLang();

  return (
    <nav className="app-nav">
      <div className="nav-inner">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              className={`nav-tab${active === tab.id ? ' nav-tab--active' : ''}`}
              onClick={() => onChange(tab.id)}
            >
              <span className="nav-tab-icon"><Icon /></span>
              <span className="nav-tab-label">{tab.label[lang]}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
