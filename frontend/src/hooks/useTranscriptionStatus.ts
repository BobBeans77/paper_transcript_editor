import { useState, useEffect, useRef, useCallback } from 'react';
import { getTranscriptStatus } from '../api/client';

const POLL_INTERVAL_MS = 2000;

export interface TranscriptionStatusResult {
  status: string | null;
  isPolling: boolean;
  error: string | null;
}

/**
 * Hook that polls the transcription status endpoint until the status
 * is "completed" or "failed". Pass null as transcriptId to disable polling.
 */
export function useTranscriptionStatus(transcriptId: string | null): TranscriptionStatusResult {
  const [status, setStatus] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  const stopPolling = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsPolling(false);
  }, []);

  useEffect(() => {
    isMountedRef.current = true;

    if (!transcriptId) {
      setStatus(null);
      setIsPolling(false);
      setError(null);
      return;
    }

    let cancelled = false;

    const poll = async () => {
      if (cancelled) return;

      try {
        const result = await getTranscriptStatus(transcriptId);

        if (cancelled || !isMountedRef.current) return;

        setStatus(result.status);
        setError(null);

        if (result.status === 'completed' || result.status === 'failed') {
          setIsPolling(false);
        } else {
          timeoutRef.current = setTimeout(poll, POLL_INTERVAL_MS);
        }
      } catch (err) {
        if (cancelled || !isMountedRef.current) return;

        setError(err instanceof Error ? err.message : 'Failed to fetch status');
        setIsPolling(false);
      }
    };

    setIsPolling(true);
    setError(null);
    setStatus(null);
    poll();

    return () => {
      cancelled = true;
      isMountedRef.current = false;
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [transcriptId]);

  return { status, isPolling, error };
}
