import React, { useState } from 'react';
import type { ExamData, ExamRecord } from '../../types';
import type { ListeningData } from '../../types';
import { ExamModule } from './ExamModule';
import { ListeningModule } from '../Listening/ListeningModule';
import { useLang } from '../../i18n/LangContext';

type SubTab = 'reading' | 'listening';

interface Props {
  examData:      ExamData;
  listeningData: ListeningData;
  addExam:       (r: ExamRecord) => void;
  pastExams:     ExamRecord[];
  token?:        string | null;
}

const IcoReading = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="9" y1="13" x2="15" y2="13"/>
    <line x1="9" y1="17" x2="15" y2="17"/>
  </svg>
);

const IcoListening = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }}>
    <path d="M3 18v-6a9 9 0 0 1 18 0v6"/>
    <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>
  </svg>
);

const LABELS: Record<SubTab, Record<'vi' | 'zh' | 'en', string>> = {
  reading:   { vi: 'Đọc hiểu', zh: '閱讀測驗', en: 'Reading' },
  listening: { vi: 'Nghe hiểu', zh: '聽力測驗', en: 'Listening' },
};

export const ExamHubModule: React.FC<Props> = ({
  examData, listeningData, addExam, pastExams, token,
}) => {
  const { lang } = useLang();
  const [subTab, setSubTab] = useState<SubTab>('reading');

  return (
    <div>
      {/* ── Sub-tab switcher ── */}
      <div className="reading-mode-bar">
        <button
          className={`reading-mode-btn${subTab === 'reading' ? ' active' : ''}`}
          onClick={() => setSubTab('reading')}
        >
          <IcoReading />
          {LABELS.reading[lang]}
        </button>
        <button
          className={`reading-mode-btn${subTab === 'listening' ? ' active' : ''}`}
          onClick={() => setSubTab('listening')}
        >
          <IcoListening />
          {LABELS.listening[lang]}
        </button>
      </div>

      {/* ── Module content ── */}
      {subTab === 'reading' && (
        <ExamModule
          examData={examData}
          addExam={addExam}
          pastExams={pastExams}
          token={token}
        />
      )}
      {subTab === 'listening' && (
        <ListeningModule listeningData={listeningData} token={token} />
      )}
    </div>
  );
};
