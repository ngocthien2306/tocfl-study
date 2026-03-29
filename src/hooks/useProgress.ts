import { useState, useCallback } from 'react';
import type { Progress, ExamRecord } from '../types';

const STORAGE_KEY = 'tocfl_progress_v2';

function load(): Progress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { known: {}, reading: {}, exams: [] };
  } catch {
    return { known: {}, reading: {}, exams: [] };
  }
}

function save(p: Progress) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}

export function useProgress() {
  const [progress, setProgress] = useState<Progress>(load);

  const markWord = useCallback((hanzi: string, known: boolean) => {
    setProgress(prev => {
      const next: Progress = { ...prev, known: { ...prev.known, [hanzi]: known } };
      save(next);
      return next;
    });
  }, []);

  const markReading = useCallback((key: string, correct: boolean) => {
    setProgress(prev => {
      const next: Progress = { ...prev, reading: { ...prev.reading, [key]: correct } };
      save(next);
      return next;
    });
  }, []);

  const addExam = useCallback((record: ExamRecord) => {
    setProgress(prev => {
      const next: Progress = { ...prev, exams: [...prev.exams, record] };
      save(next);
      return next;
    });
  }, []);

  const resetAll = useCallback(() => {
    const empty: Progress = { known: {}, reading: {}, exams: [] };
    save(empty);
    setProgress(empty);
  }, []);

  /** Merge server progress into local state (called after login) */
  const mergeFromServer = useCallback((
    serverWords: Record<string, boolean>,
    serverReading: Record<string, boolean>,
  ) => {
    setProgress(prev => {
      // Strip "word_" / "read_" prefixes that the server uses
      const knownFromServer: Record<string, boolean> = {};
      Object.entries(serverWords).forEach(([k, v]) => {
        const key = k.startsWith('word_') ? k.slice(5) : k;
        knownFromServer[key] = v;
      });
      const readingFromServer: Record<string, boolean> = {};
      Object.entries(serverReading).forEach(([k, v]) => {
        const key = k.startsWith('read_') ? k.slice(5) : k;
        readingFromServer[key] = v;
      });

      // Merge: server wins on conflict (server is source of truth)
      const next: Progress = {
        ...prev,
        known:   { ...prev.known,   ...knownFromServer   },
        reading: { ...prev.reading, ...readingFromServer },
      };
      save(next);
      return next;
    });
  }, []);

  return { progress, markWord, markReading, addExam, resetAll, mergeFromServer };
}
