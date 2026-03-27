import { useState, useEffect } from 'react';
import type { Word, ExamData } from '../types';

interface DataState {
  vocabulary: Word[];
  examData: ExamData | null;
  loading: boolean;
  error: string | null;
}

export function useData(): DataState {
  const [state, setState] = useState<DataState>({
    vocabulary: [],
    examData: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    Promise.all([
      fetch('/data/vocabulary.json').then(r => r.json() as Promise<Word[]>),
      fetch('/data/exam_data.json').then(r => r.json() as Promise<ExamData>),
    ])
      .then(([vocabulary, examData]) => {
        setState({ vocabulary, examData, loading: false, error: null });
      })
      .catch(err => {
        setState(s => ({ ...s, loading: false, error: String(err) }));
      });
  }, []);

  return state;
}
