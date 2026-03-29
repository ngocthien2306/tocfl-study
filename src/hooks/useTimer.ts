import { useState, useEffect, useRef, useCallback } from 'react';

export function useTimer(initialSeconds: number, onExpire?: () => void) {
  const [timeLeft, setTimeLeft] = useState(initialSeconds);
  const [running, setRunning] = useState(false);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  const setTo = useCallback((s: number) => {
    setTimeLeft(s);
  }, []);

  const start = useCallback(() => {
    setRunning(true);
  }, []);

  const stop = useCallback(() => {
    setRunning(false);
    if (ref.current) clearInterval(ref.current);
  }, []);

  const reset = useCallback(() => {
    setRunning(false);
    setTimeLeft(initialSeconds);
    if (ref.current) clearInterval(ref.current);
  }, [initialSeconds]);

  useEffect(() => {
    if (!running) return;
    ref.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(ref.current!);
          setRunning(false);
          onExpireRef.current?.();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(ref.current!);
  }, [running]);

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return { timeLeft, running, formatted: fmt(timeLeft), start, stop, reset, setTo };
}
