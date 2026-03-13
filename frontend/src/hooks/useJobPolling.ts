import { useState, useEffect, useRef } from 'react';
import type { JobStatus } from '../types';
import type { StatusResponse } from './useApi';

interface UseJobPollingResult<T> {
  status: JobStatus;
  progress: number;
  result: T | null;
  error: string | null;
}

export function useJobPolling<T>(
  jobId: string | null,
  statusFn: (id: string) => Promise<StatusResponse>,
  resultFn: (id: string) => Promise<T>,
  onComplete?: (result: T) => void
): UseJobPollingResult<T> {
  const [status, setStatus] = useState<JobStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const statusFnRef = useRef(statusFn);
  const resultFnRef = useRef(resultFn);
  const onCompleteRef = useRef(onComplete);
  statusFnRef.current = statusFn;
  resultFnRef.current = resultFn;
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (!jobId) {
      setStatus('idle');
      setProgress(0);
      setResult(null);
      setError(null);
      return;
    }

    setStatus('processing');

    const poll = async () => {
      try {
        const statusData = await statusFnRef.current(jobId);
        setProgress(statusData.progress ?? 0);

        if (statusData.status === 'done') {
          if (intervalRef.current) clearInterval(intervalRef.current);
          const data = await resultFnRef.current(jobId);
          setResult(data);
          setStatus('done');
          onCompleteRef.current?.(data);
        } else if (statusData.status === 'error') {
          if (intervalRef.current) clearInterval(intervalRef.current);
          setError(statusData.message ?? '처리 중 오류가 발생했습니다.');
          setStatus('error');
        }
      } catch (err) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setError('서버 연결에 실패했습니다.');
        setStatus('error');
      }
    };

    poll();
    intervalRef.current = setInterval(poll, 2000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [jobId]);

  return { status, progress, result, error };
}
