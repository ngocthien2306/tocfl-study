import React from 'react';

interface HeaderProps {
  vocabCount: number;
}

export const Header: React.FC<HeaderProps> = ({ vocabCount }) => (
  <header className="app-header">
    <div className="flex-between">
      <div>
        <h1>TOCFL Band A &amp; B</h1>
        <p>Học từ vựng &amp; luyện đọc hiểu · {vocabCount.toLocaleString()} từ</p>
      </div>
      <span className="badge badge-A" style={{ fontSize: '.8rem', padding: '4px 10px' }}>
        TOCFL
      </span>
    </div>
  </header>
);
