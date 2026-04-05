import { useState, useEffect, useCallback } from 'react';
import type { Word, ExamData, ListeningData } from '../types';

const EXTRA_KEY = 'tocfl_vocab_extra_meanings';

interface ExtraData { meaning: string; example?: string; }

function mergeExtra(words: Word[]): Word[] {
  try {
    const extra: Record<string, ExtraData> = JSON.parse(localStorage.getItem(EXTRA_KEY) ?? '{}');
    if (Object.keys(extra).length === 0) return words;
    return words.map(w => {
      if (!w.meaning && extra[w.hanzi]) {
        return { ...w, meaning: extra[w.hanzi].meaning, example: extra[w.hanzi].example ?? '' };
      }
      return w;
    });
  } catch { return words; }
}

interface DataState {
  vocabulary: Word[];
  examData: ExamData | null;
  listeningData: ListeningData | null;
  loading: boolean;
  error: string | null;
  refreshVocab: () => void;
}

export function useData(): DataState {
  const [state, setState] = useState<DataState>({
    vocabulary: [],
    examData: null,
    listeningData: null,
    loading: true,
    error: null,
    refreshVocab: () => {},
  });

  const [vocabBase, setVocabBase] = useState<Word[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const refreshVocab = useCallback(() => setRefreshKey(k => k + 1), []);

  useEffect(() => {
    const base = import.meta.env.BASE_URL;
    Promise.all([
      fetch(`${base}data/vocabulary.json`).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() as Promise<Word[]>; }),
      fetch(`${base}data/exam_data.json`).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() as Promise<ExamData>; }),
      fetch(`${base}data/listening_data.json`).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() as Promise<ListeningData>; }),
    ])
      .then(([vocabulary, examData, listeningData]) => {
        setVocabBase(vocabulary);
        setState({ vocabulary: mergeExtra(vocabulary), examData, listeningData, loading: false, error: null, refreshVocab });
      })
      .catch(err => {
        setState(s => ({ ...s, loading: false, error: String(err) }));
      });
  }, [refreshVocab]);

  // Re-merge when refreshKey changes (after VocabAdminTool saves new translations)
  useEffect(() => {
    if (vocabBase.length > 0 && refreshKey > 0) {
      setState(s => ({ ...s, vocabulary: mergeExtra(vocabBase) }));
    }
  }, [refreshKey, vocabBase]);

  return state;
}
