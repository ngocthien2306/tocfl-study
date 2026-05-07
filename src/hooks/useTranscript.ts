import { useState, useEffect, useMemo } from 'react';
import type { ExamKey, ExamTranscripts, TranscriptItem } from '../types';

const cache = new Map<string, ExamTranscripts>();
const inflight = new Map<string, Promise<ExamTranscripts | null>>();

function fileKey(band: 'A' | 'B' | 'C', examKey: ExamKey): string {
  return `band${band}-${examKey}`;
}

function loadTranscripts(band: 'A' | 'B' | 'C', examKey: ExamKey): Promise<ExamTranscripts | null> {
  const key = fileKey(band, examKey);
  const cached = cache.get(key);
  if (cached) return Promise.resolve(cached);
  const ongoing = inflight.get(key);
  if (ongoing) return ongoing;

  const base = import.meta.env.BASE_URL;
  const promise = fetch(`${base}data/transcripts/${key}-transcripts.json`)
    .then(r => (r.ok ? (r.json() as Promise<ExamTranscripts>) : null))
    .then(json => {
      if (json) cache.set(key, json);
      inflight.delete(key);
      return json;
    })
    .catch(() => {
      inflight.delete(key);
      return null;
    });
  inflight.set(key, promise);
  return promise;
}

export function useExamTranscripts(band: 'A' | 'B' | 'C', examKey: ExamKey): ExamTranscripts | null {
  const [data, setData] = useState<ExamTranscripts | null>(() => cache.get(fileKey(band, examKey)) ?? null);
  useEffect(() => {
    let alive = true;
    loadTranscripts(band, examKey).then(json => {
      if (alive) setData(json);
    });
    return () => { alive = false; };
  }, [band, examKey]);
  return data;
}

/** Find the transcript item that contains a given question ID. */
export function useQuestionTranscript(
  band: 'A' | 'B' | 'C',
  examKey: ExamKey,
  questionId: number,
): TranscriptItem | null {
  const exam = useExamTranscripts(band, examKey);
  return useMemo(() => {
    if (!exam) return null;
    for (const part of Object.values(exam.parts)) {
      if (!part) continue;
      const found = part.find(it => it.ids.includes(questionId));
      if (found) return found;
    }
    return null;
  }, [exam, questionId]);
}
