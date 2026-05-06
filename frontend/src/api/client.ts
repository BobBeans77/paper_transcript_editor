import type { SegmentUpdate, TranscriptData, TranscriptSummary } from '../types/transcript';

const API_BASE = '/api';

/**
 * Upload an audio file for transcription.
 * Returns the transcript_id and initial status.
 */
export async function uploadAudio(file: File): Promise<{ transcript_id: string; status: string }> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Upload failed');
  }

  return response.json();
}

/**
 * Get a list of all transcript summaries.
 */
export async function getTranscripts(): Promise<TranscriptSummary[]> {
  const response = await fetch(`${API_BASE}/transcripts`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to fetch transcripts');
  }

  return response.json();
}

/**
 * Get a full transcript by ID, including all segments.
 */
export async function getTranscript(id: string): Promise<TranscriptData> {
  const response = await fetch(`${API_BASE}/transcripts/${id}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to fetch transcript');
  }

  return response.json();
}

/**
 * Get the current transcription status for a transcript.
 */
export async function getTranscriptStatus(id: string): Promise<{ status: string }> {
  const response = await fetch(`${API_BASE}/transcripts/${id}/status`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to fetch transcript status');
  }

  return response.json();
}

/**
 * Update a segment's edited text or PII flag.
 */
export async function updateSegment(
  id: string,
  index: number,
  update: SegmentUpdate
): Promise<TranscriptData> {
  const response = await fetch(`${API_BASE}/transcripts/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ segment_index: index, updates: update }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to update segment');
  }

  return response.json();
}

/**
 * Construct the audio streaming URL for a transcript.
 */
export function getAudioUrl(id: string): string {
  return `${API_BASE}/transcripts/${id}/audio`;
}
