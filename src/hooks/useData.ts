import { useState, useEffect } from 'react';
import type { Word, ExamData, ListeningData } from '../types';

interface DataState {
  vocabulary: Word[];
  examData: ExamData | null;
  listeningData: ListeningData | null;
  loading: boolean;
  error: string | null;
}

export function useData(): DataState {
  const [state, setState] = useState<DataState>({
    vocabulary: [],
    examData: null,
    listeningData: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    // import.meta.env.BASE_URL = '/' in dev, '/TOCFL-Study/' in production
    const base = import.meta.env.BASE_URL;
    Promise.all([
      fetch(`${base}data/vocabulary.json`).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() as Promise<Word[]>; }),
      fetch(`${base}data/exam_data.json`).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() as Promise<ExamData>; }),
      fetch(`${base}data/listening_data.json`).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() as Promise<ListeningData>; }),
    ])
      .then(([vocabulary, examData, listeningData]) => {
        setState({ vocabulary, examData, listeningData, loading: false, error: null });
      })
      .catch(err => {
        setState(s => ({ ...s, loading: false, error: String(err) }));
      });
  }, []);

  return state;
}
