import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useActiveSegment } from './useActiveSegment';
import type { Segment } from '../types/transcript';

function makeSegment(overrides: Partial<Segment> & { index: number; start: number; end: number }): Segment {
  return {
    speaker: 'SPEAKER_00',
    text: 'Hello world',
    edited_text: null,
    pii_flagged: false,
    ...overrides,
  };
}

const segments: Segment[] = [
  makeSegment({ index: 0, start: 0.0, end: 3.5, speaker: 'SPEAKER_00' }),
  makeSegment({ index: 1, start: 3.5, end: 7.2, speaker: 'SPEAKER_01' }),
  makeSegment({ index: 2, start: 8.0, end: 12.0, speaker: 'SPEAKER_00' }),
  makeSegment({ index: 3, start: 12.0, end: 15.5, speaker: 'SPEAKER_01' }),
];

describe('useActiveSegment', () => {
  it('returns correct segment index when time is within a segment range', () => {
    const { result } = renderHook(() => useActiveSegment(segments, 1.5));
    expect(result.current).toBe(0);
  });

  it('returns correct segment index for second segment', () => {
    const { result } = renderHook(() => useActiveSegment(segments, 5.0));
    expect(result.current).toBe(1);
  });

  it('returns correct segment index for last segment', () => {
    const { result } = renderHook(() => useActiveSegment(segments, 13.0));
    expect(result.current).toBe(3);
  });

  it('returns null when time is in a gap between segments', () => {
    // Gap between segment 1 (end: 7.2) and segment 2 (start: 8.0)
    const { result } = renderHook(() => useActiveSegment(segments, 7.5));
    expect(result.current).toBeNull();
  });

  it('returns null when time is before all segments', () => {
    const laterSegments: Segment[] = [
      makeSegment({ index: 0, start: 5.0, end: 10.0 }),
      makeSegment({ index: 1, start: 10.0, end: 15.0 }),
    ];
    const { result } = renderHook(() => useActiveSegment(laterSegments, 2.0));
    expect(result.current).toBeNull();
  });

  it('returns null when time is after all segments', () => {
    const { result } = renderHook(() => useActiveSegment(segments, 20.0));
    expect(result.current).toBeNull();
  });

  it('returns segment index when time is exactly at segment start', () => {
    const { result } = renderHook(() => useActiveSegment(segments, 3.5));
    // 3.5 is the start of segment 1 (start <= time < end)
    expect(result.current).toBe(1);
  });

  it('returns null when time is exactly at segment end (exclusive boundary)', () => {
    // 7.2 is the end of segment 1, and segment 2 starts at 8.0
    // So 7.2 should not match segment 1 (end is exclusive) and is in the gap
    const { result } = renderHook(() => useActiveSegment(segments, 7.2));
    expect(result.current).toBeNull();
  });

  it('handles contiguous segments correctly at boundary', () => {
    // Segment 2 ends at 12.0 and segment 3 starts at 12.0
    // Time 12.0 should match segment 3 (start <= time < end)
    const { result } = renderHook(() => useActiveSegment(segments, 12.0));
    expect(result.current).toBe(3);
  });

  it('returns null for empty segments array', () => {
    const { result } = renderHook(() => useActiveSegment([], 5.0));
    expect(result.current).toBeNull();
  });

  it('updates when currentTime changes', () => {
    const { result, rerender } = renderHook(
      ({ time }) => useActiveSegment(segments, time),
      { initialProps: { time: 1.0 } }
    );

    expect(result.current).toBe(0);

    rerender({ time: 5.0 });
    expect(result.current).toBe(1);

    rerender({ time: 7.5 });
    expect(result.current).toBeNull();

    rerender({ time: 9.0 });
    expect(result.current).toBe(2);
  });
});
