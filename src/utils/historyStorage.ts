/**
 * localStorage helpers for storing and retrieving exam attempt history.
 *
 * Each module ('exam' | 'listening') has its own key.
 * Up to MAX_ATTEMPTS per module are kept (oldest dropped first).
 */

import type { ExamAttempt } from '../types';

const KEYS = {
  exam:      'tocfl_exam_attempts',
  listening: 'tocfl_listening_attempts',
} as const;

const MAX_ATTEMPTS = 50;

/** Load all saved attempts for a module, newest first. */
export function loadAttempts(module: 'exam' | 'listening'): ExamAttempt[] {
  try {
    const raw = localStorage.getItem(KEYS[module]);
    const list = raw ? (JSON.parse(raw) as ExamAttempt[]) : [];
    return list.slice().reverse(); // newest first
  } catch {
    return [];
  }
}

/** Persist a new attempt (oldest entries trimmed if over limit). */
export function saveAttempt(attempt: ExamAttempt): void {
  try {
    const key = KEYS[attempt.module];
    const raw = localStorage.getItem(key);
    const list: ExamAttempt[] = raw ? JSON.parse(raw) : [];
    list.push(attempt);
    if (list.length > MAX_ATTEMPTS) list.splice(0, list.length - MAX_ATTEMPTS);
    localStorage.setItem(key, JSON.stringify(list));
  } catch { /* quota / private browsing — silent */ }
}

/** Delete a single attempt by id. */
export function deleteAttempt(module: 'exam' | 'listening', id: string): void {
  try {
    const key = KEYS[module];
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const list = (JSON.parse(raw) as ExamAttempt[]).filter(a => a.id !== id);
    localStorage.setItem(key, JSON.stringify(list));
  } catch { /* silent */ }
}

/** Human-readable elapsed time string. */
export function fmtDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Short date string from ISO timestamp. */
export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}
