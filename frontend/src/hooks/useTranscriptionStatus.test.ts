import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useTranscriptionStatus } from './useTranscriptionStatus';
import * as client from '../api/client';

vi.mock('../api/client', () => ({
  getTranscriptStatus: vi.fn(),
}));

const mockGetTranscriptStatus = vi.mocked(client.getTranscriptStatus);

beforeEach(() => {
  mockGetTranscriptStatus.mockReset();
});

describe('useTranscriptionStatus', () => {
  it('returns initial state when transcriptId is null', () => {
    const { result } = renderHook(() => useTranscriptionStatus(null));

    expect(result.current.status).toBeNull();
    expect(result.current.isPolling).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('starts polling when given a transcriptId', async () => {
    mockGetTranscriptStatus.mockResolvedValue({ status: 'processing' });

    const { result } = renderHook(() => useTranscriptionStatus('abc-123'));

    expect(result.current.isPolling).toBe(true);

    await waitFor(() => {
      expect(result.current.status).toBe('processing');
    });

    expect(mockGetTranscriptStatus).toHaveBeenCalledWith('abc-123');
  });

  it('stops polling when status is "completed"', async () => {
    mockGetTranscriptStatus.mockResolvedValue({ status: 'completed' });

    const { result } = renderHook(() => useTranscriptionStatus('abc-123'));

    await waitFor(() => {
      expect(result.current.status).toBe('completed');
      expect(result.current.isPolling).toBe(false);
    });

    expect(mockGetTranscriptStatus).toHaveBeenCalledTimes(1);
  });

  it('stops polling when status is "failed"', async () => {
    mockGetTranscriptStatus.mockResolvedValue({ status: 'failed' });

    const { result } = renderHook(() => useTranscriptionStatus('abc-123'));

    await waitFor(() => {
      expect(result.current.status).toBe('failed');
      expect(result.current.isPolling).toBe(false);
    });

    expect(mockGetTranscriptStatus).toHaveBeenCalledTimes(1);
  });

  it('continues polling when status is "processing" then stops on "completed"', async () => {
    let callCount = 0;
    mockGetTranscriptStatus.mockImplementation(async () => {
      callCount++;
      if (callCount < 3) {
        return { status: 'processing' };
      }
      return { status: 'completed' };
    });

    vi.useFakeTimers({ shouldAdvanceTime: true });

    const { result } = renderHook(() => useTranscriptionStatus('abc-123'));

    // First poll returns processing
    await waitFor(() => {
      expect(result.current.status).toBe('processing');
    });
    expect(result.current.isPolling).toBe(true);

    // Advance timer to trigger second poll
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    // Still processing after second poll
    await waitFor(() => {
      expect(callCount).toBeGreaterThanOrEqual(2);
    });

    // Advance timer to trigger third poll
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    await waitFor(() => {
      expect(result.current.status).toBe('completed');
      expect(result.current.isPolling).toBe(false);
    });

    vi.useRealTimers();
  });

  it('sets error and stops polling on fetch failure', async () => {
    mockGetTranscriptStatus.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useTranscriptionStatus('abc-123'));

    await waitFor(() => {
      expect(result.current.error).toBe('Network error');
      expect(result.current.isPolling).toBe(false);
    });

    expect(result.current.status).toBeNull();
  });

  it('stops polling on unmount', async () => {
    let resolvePromise: (value: { status: string }) => void;
    mockGetTranscriptStatus.mockImplementation(
      () => new Promise((resolve) => { resolvePromise = resolve; })
    );

    const { result, unmount } = renderHook(() => useTranscriptionStatus('abc-123'));

    expect(result.current.isPolling).toBe(true);

    // Resolve the first call
    await act(async () => {
      resolvePromise!({ status: 'processing' });
    });

    await waitFor(() => {
      expect(result.current.status).toBe('processing');
    });

    unmount();

    // After unmount, no more calls should be made
    const callCountAfterUnmount = mockGetTranscriptStatus.mock.calls.length;

    // Wait a bit to ensure no additional calls happen
    await new Promise((r) => setTimeout(r, 50));
    expect(mockGetTranscriptStatus.mock.calls.length).toBe(callCountAfterUnmount);
  });

  it('resets state when transcriptId changes to null', async () => {
    mockGetTranscriptStatus.mockResolvedValue({ status: 'processing' });

    const { result, rerender } = renderHook(
      ({ id }) => useTranscriptionStatus(id),
      { initialProps: { id: 'abc-123' as string | null } }
    );

    await waitFor(() => {
      expect(result.current.status).toBe('processing');
    });

    rerender({ id: null });

    expect(result.current.status).toBeNull();
    expect(result.current.isPolling).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('restarts polling when transcriptId changes', async () => {
    mockGetTranscriptStatus
      .mockResolvedValueOnce({ status: 'processing' })
      .mockResolvedValueOnce({ status: 'completed' });

    const { result, rerender } = renderHook(
      ({ id }) => useTranscriptionStatus(id),
      { initialProps: { id: 'abc-123' as string | null } }
    );

    await waitFor(() => {
      expect(result.current.status).toBe('processing');
    });

    rerender({ id: 'def-456' });

    await waitFor(() => {
      expect(result.current.status).toBe('completed');
    });

    expect(mockGetTranscriptStatus).toHaveBeenCalledWith('def-456');
  });

  it('handles non-Error thrown values gracefully', async () => {
    mockGetTranscriptStatus.mockRejectedValue('string error');

    const { result } = renderHook(() => useTranscriptionStatus('abc-123'));

    await waitFor(() => {
      expect(result.current.error).toBe('Failed to fetch status');
      expect(result.current.isPolling).toBe(false);
    });
  });
});
