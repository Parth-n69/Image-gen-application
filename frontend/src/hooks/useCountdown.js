import { useEffect, useState, useCallback, useRef } from 'react';

/**
 * Hook for managing countdown timers backed optionally by sessionStorage
 * @param {string|null} storageKey - Optional sessionStorage key to persist countdown across refreshes
 * @returns {{ secondsLeft: number, isRunning: boolean, start: (seconds: number) => void, stop: () => void }}
 */
export function useCountdown(storageKey = null) {
  const [secondsLeft, setSecondsLeft] = useState(() => {
    if (!storageKey || typeof window === 'undefined') return 0;
    try {
      const untilStr = sessionStorage.getItem(storageKey);
      if (!untilStr) return 0;
      const until = parseInt(untilStr, 10);
      const remaining = Math.ceil((until - Date.now()) / 1000);
      return remaining > 0 ? remaining : 0;
    } catch {
      return 0;
    }
  });

  const timerRef = useRef(null);

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (storageKey && typeof window !== 'undefined') {
      sessionStorage.removeItem(storageKey);
    }
    setSecondsLeft(0);
  }, [storageKey]);

  const start = useCallback(
    (seconds) => {
      if (timerRef.current) clearInterval(timerRef.current);

      const endTime = Date.now() + seconds * 1000;
      if (storageKey && typeof window !== 'undefined') {
        sessionStorage.setItem(storageKey, endTime.toString());
      }

      setSecondsLeft(seconds);

      timerRef.current = setInterval(() => {
        const remaining = Math.ceil((endTime - Date.now()) / 1000);
        if (remaining <= 0) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          if (storageKey && typeof window !== 'undefined') {
            sessionStorage.removeItem(storageKey);
          }
          setSecondsLeft(0);
        } else {
          setSecondsLeft(remaining);
        }
      }, 1000);
    },
    [storageKey]
  );

  useEffect(() => {
    // If mounted with an active countdown from storage, resume timer
    if (secondsLeft > 0 && !timerRef.current) {
      if (storageKey && typeof window !== 'undefined') {
        const untilStr = sessionStorage.getItem(storageKey);
        if (untilStr) {
          const endTime = parseInt(untilStr, 10);
          timerRef.current = setInterval(() => {
            const remaining = Math.ceil((endTime - Date.now()) / 1000);
            if (remaining <= 0) {
              if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
              }
              sessionStorage.removeItem(storageKey);
              setSecondsLeft(0);
            } else {
              setSecondsLeft(remaining);
            }
          }, 1000);
        }
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [secondsLeft, storageKey]);

  return {
    secondsLeft,
    isRunning: secondsLeft > 0,
    start,
    stop,
  };
}
