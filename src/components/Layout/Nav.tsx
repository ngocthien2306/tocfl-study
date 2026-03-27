import React from 'react';

export type TabId = 'flashcard' | 'reading' | 'exam' | 'progress';

const TABS: { id: TabId; label: string }[] = [
  { id: 'flashcard', label: '📚 Từ vựng' },
  { id: 'reading',   label: '📖 Luyện đọc' },
  { id: 'exam',      label: '📝 Thi thử' },
  { id: 'progress',  label: '📊 Tiến độ' },
];

interface NavProps {
  active: TabId;
  onChange: (tab: TabId) => void;
}

export const Nav: React.FC<NavProps> = ({ active, onChange }) => (
  <nav className="nav-tabs">
    {TABS.map(t => (
      <button
        key={t.id}
        className={`nav-tab ${active === t.id ? 'active' : ''}`}
        onClick={() => onChange(t.id)}
      >
        {t.label}
      </button>
    ))}
  </nav>
);
