import React from 'react';
import { useLang } from '../../i18n/LangContext';

interface HeaderProps {
  vocabCount: number;
}

export const Header: React.FC<HeaderProps> = ({ vocabCount }) => {
  const { lang } = useLang();
  const subtitle = {
    vi: `Học từ vựng & luyện đọc hiểu · ${vocabCount.toLocaleString()} từ`,
    zh: `詞彙學習與閱讀練習 · ${vocabCount.toLocaleString()} 詞`,
    en: `Vocabulary & reading practice · ${vocabCount.toLocaleString()} words`,
  }[lang];

  return (
    <header className="app-header">
      <div className="flex-between">
        <div>
          <h1 style={{ fontSize: '1.1rem' }}>TOCFL Band A &amp; B</h1>
          <p style={{ fontSize: '.78rem' }}>{subtitle}</p>
        </div>
        <span className="badge badge-A" style={{ fontSize: '.75rem', padding: '4px 10px', flexShrink: 0 }}>
          TOCFL
        </span>
      </div>
    </header>
  );
};
