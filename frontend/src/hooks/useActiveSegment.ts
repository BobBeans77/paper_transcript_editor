import { useMemo } from 'react';
import type { Segment } from '../types/transcript';

/**
 * Returns the index of the segment whose time range contains the current playback time.
 * A segment is active when: segment.start <= currentTime < segment.end
 * Returns null if no segment contains the current time.
 */
export function useActiveSegment(segments: Segment[], currentTime: number): number | null {
  return useMemo(() => {
    for (const segment of segments) {
      if (currentTime >= segment.start && currentTime < segment.end) {
        return segment.index;
      }
    }
    return null;
  }, [segments, currentTime]);
}
