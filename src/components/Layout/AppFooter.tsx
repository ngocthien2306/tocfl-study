import React from 'react';
import { useLang } from '../../i18n/LangContext';

const TX = {
  desc:    { vi: 'Ứng dụng luyện thi TOCFL Band A & B', zh: 'TOCFL Band A & B 備考應用程式', en: 'TOCFL Band A & B Study App' },
  built:   { vi: 'Xây dựng bởi', zh: '由', en: 'Built by' },
  privacy: { vi: 'Học tập hiệu quả — chúc bạn thi đỗ! 🎉', zh: '祝您考試順利！🎉', en: 'Study smart — good luck! 🎉' },
} as const;

export const AppFooter: React.FC = () => {
  const { lang } = useLang();

  return (
    <footer className="app-footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <strong>TOCFL Study</strong>
          <span className="footer-sep">·</span>
          <span>{TX.desc[lang]}</span>
        </div>
        <div className="footer-right">
          <span>{TX.privacy[lang]}</span>
        </div>
      </div>
    </footer>
  );
};
