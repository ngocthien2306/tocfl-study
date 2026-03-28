import { useState } from 'react';
import './styles/global.css';

import { useData }     from './hooks/useData';
import { useProgress } from './hooks/useProgress';

import { Header }              from './components/Layout/Header';
import { Nav }                 from './components/Layout/Nav';
import type { TabId }          from './components/Layout/Nav';
import { FlashcardModule }     from './components/Flashcard/FlashcardModule';
import { ReadingModule }       from './components/Reading/ReadingModule';
import { ExamModule }          from './components/Exam/ExamModule';
import { ListeningModule }     from './components/Listening/ListeningModule';
import { ProgressModule }      from './components/Progress/ProgressModule';
import { AIGeneratorModule }   from './components/AIGenerator/AIGeneratorModule';

export default function App() {
  const [tab, setTab] = useState<TabId>('flashcard');
  const { vocabulary, examData, listeningData, loading, error } = useData();
  const { progress, markWord, markReading, addExam, resetAll } = useProgress();

  if (loading) return (
    <div className="flex-center" style={{ minHeight: '100vh', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: '.9rem', color: 'var(--text-secondary)' }}>Đang tải dữ liệu…</div>
    </div>
  );

  if (error) return (
    <div className="flex-center" style={{ minHeight: '100vh' }}>
      <div className="card" style={{ maxWidth: 400, textAlign: 'center' }}>
        <p style={{ color: 'var(--error)', fontWeight: 600 }}>Lỗi tải dữ liệu</p>
        <p className="text-sm text-muted mt-8">{error}</p>
        <p className="text-sm mt-8">Hãy chắc chắn bạn chạy <code>npm run dev</code> đúng cách.</p>
      </div>
    </div>
  );

  return (
    <div className="app-shell">
      <Header vocabCount={vocabulary.length} />
      <Nav active={tab} onChange={setTab} />

      {tab === 'flashcard' && (
        <FlashcardModule
          vocabulary={vocabulary}
          progress={progress}
          markWord={markWord}
        />
      )}

      {tab === 'reading' && examData && (
        <ReadingModule
          examData={examData}
          progress={progress}
          markReading={markReading}
        />
      )}

      {tab === 'exam' && examData && (
        <ExamModule
          examData={examData}
          addExam={addExam}
          pastExams={progress.exams}
        />
      )}

      {tab === 'listening' && listeningData && (
        <ListeningModule listeningData={listeningData} />
      )}

      {tab === 'ai' && (
        <AIGeneratorModule />
      )}

      {tab === 'progress' && (
        <ProgressModule
          progress={progress}
          vocabulary={vocabulary}
          onReset={resetAll}
        />
      )}
    </div>
  );
}
