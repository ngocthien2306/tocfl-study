import { useState, useCallback, useEffect } from 'react';
import './styles/global.css';
import { ApiKeyProvider } from './contexts/ApiKeyContext';

import { useData }     from './hooks/useData';
import { useProgress } from './hooks/useProgress';
import { useAuth }     from './hooks/useAuth';
import { progressApi } from './api/client';

import { AppHeader }         from './components/Layout/AppHeader';
import { AppNav }            from './components/Layout/AppNav';
import { AppFooter }         from './components/Layout/AppFooter';
import type { TabId }        from './components/Layout/AppNav';
import { FlashcardModule }   from './components/Flashcard/FlashcardModule';
import { ReadingModule }     from './components/Reading/ReadingModule';
import { ExamModule }        from './components/Exam/ExamModule';
import { ListeningModule }   from './components/Listening/ListeningModule';
import { ProgressModule }    from './components/Progress/ProgressModule';
import { AIGeneratorModule } from './components/AIGenerator/AIGeneratorModule';
import { InterviewModule }   from './components/Interview/InterviewModule';
import { AuthModal }         from './components/Auth/AuthModal';

export default function App() {
  const [tab,      setTab     ] = useState<TabId>('flashcard');
  const [showAuth, setShowAuth] = useState(false);

  const { vocabulary, examData, listeningData, loading, error } = useData();
  const { progress, markWord, markReading, addExam, resetAll, mergeFromServer } = useProgress();
  const auth = useAuth();

  // ── Load server progress after login ──────────────────────────────────────
  useEffect(() => {
    if (!auth.token) return;
    progressApi.get(auth.token)
      .then(data => mergeFromServer(data.words, data.reading))
      .catch(() => {});
  }, [auth.token, mergeFromServer]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  function buildSyncPayload() {
    const words:   Record<string, boolean> = {};
    const reading: Record<string, boolean> = {};
    Object.entries(progress.known).forEach(([k, v])   => { words[`word_${k}`]   = v; });
    Object.entries(progress.reading).forEach(([k, v]) => { reading[`read_${k}`] = v; });
    return { words, reading };
  }

  // ── Mark word — localStorage + backend ────────────────────────────────────
  const handleMarkWord = useCallback((hanzi: string, known: boolean) => {
    markWord(hanzi, known);
    if (auth.token) {
      progressApi.markWord(auth.token, hanzi, known).catch(() => {});
    }
  }, [markWord, auth.token]);

  // ── Mark reading — localStorage + backend ─────────────────────────────────
  const handleMarkReading = useCallback((key: string, correct: boolean) => {
    markReading(key, correct);
    if (auth.token) {
      progressApi.markReading(auth.token, key, correct).catch(() => {});
    }
  }, [markReading, auth.token]);

  // ── Add exam — localStorage + backend ─────────────────────────────────────
  const handleAddExam = useCallback((record: import('./types').ExamRecord) => {
    addExam(record);
    if (auth.token) {
      progressApi.addExam(auth.token, {
        module:          record.module          ?? 'exam',
        band:            record.band,
        exam_key:        record.examKey         ?? 'exam1',
        score:           record.score,
        total:           record.total,
        time_taken_secs: record.timeTakenSecs   ?? null,
      }).catch(() => {});
    }
  }, [addExam, auth.token]);

  // ── Auth handlers ─────────────────────────────────────────────────────────
  async function handleLogin(email: string, password: string) {
    return auth.login(email, password, buildSyncPayload());
  }
  async function handleRegister(email: string, name: string, password: string) {
    return auth.register(email, name, password, buildSyncPayload());
  }

  // ── Loading / error states ────────────────────────────────────────────────
  if (loading) return (
    <div className="page-loading">
      <div className="loading-spinner" />
      <span>Đang tải dữ liệu…</span>
    </div>
  );

  if (error) return (
    <div className="page-loading">
      <div style={{ color: 'var(--error)', fontWeight: 600, fontSize: '1rem' }}>Lỗi tải dữ liệu</div>
      <div style={{ fontSize: '.85rem', color: 'var(--text-secondary)', marginTop: 6 }}>{error}</div>
    </div>
  );

  return (
    <ApiKeyProvider>
    <div className="app-layout">
      {/* ── Header ── */}
      <AppHeader
        vocabCount={vocabulary.length}
        user={auth.user}
        onLoginClick={() => setShowAuth(true)}
        onLogout={auth.logout}
      />

      {/* ── Nav ── */}
      <AppNav active={tab} onChange={setTab} />

      {/* ── Main content ── */}
      <main className="app-main">
        <div className="content-wrapper">
          {tab === 'flashcard' && (
            <FlashcardModule
              vocabulary={vocabulary}
              progress={progress}
              markWord={handleMarkWord}
            />
          )}

          {tab === 'reading' && examData && (
            <ReadingModule
              examData={examData}
              progress={progress}
              markReading={handleMarkReading}
            />
          )}

          {tab === 'exam' && examData && (
            <ExamModule
              examData={examData}
              addExam={handleAddExam}
              pastExams={progress.exams}
            />
          )}

          {tab === 'listening' && listeningData && (
            <ListeningModule listeningData={listeningData} token={auth.token} />
          )}

          {tab === 'ai' && <AIGeneratorModule vocabulary={vocabulary} progress={progress} />}

          {tab === 'interview' && <InterviewModule />}

          {tab === 'progress' && (
            <ProgressModule
              progress={progress}
              vocabulary={vocabulary}
              onReset={resetAll}
            />
          )}
        </div>
      </main>

      {/* ── Footer ── */}
      <AppFooter />

      {/* ── Auth modal ── */}
      {showAuth && (
        <AuthModal
          onSuccess={() => setShowAuth(false)}
          onClose={() => { setShowAuth(false); auth.clearError(); }}
          onLogin={handleLogin}
          onRegister={handleRegister}
          authError={auth.error}
          loading={auth.loading}
        />
      )}
    </div>
    </ApiKeyProvider>
  );
}
