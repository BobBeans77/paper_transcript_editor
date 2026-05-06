import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  uploadAudio,
  getTranscripts,
  getTranscript,
  getTranscriptStatus,
  updateSegment,
  getAudioUrl,
} from './client';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

describe('uploadAudio', () => {
  it('sends a POST request with the file as FormData', async () => {
    const file = new File(['audio content'], 'test.wav', { type: 'audio/wav' });
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ transcript_id: 'abc-123', status: 'pending' }),
    });

    const result = await uploadAudio(file);

    expect(mockFetch).toHaveBeenCalledWith('/api/upload', {
      method: 'POST',
      body: expect.any(FormData),
    });
    const formData = mockFetch.mock.calls[0][1].body as FormData;
    expect(formData.get('file')).toBe(file);
    expect(result).toEqual({ transcript_id: 'abc-123', status: 'pending' });
  });

  it('throws an error when the upload fails', async () => {
    const file = new File(['audio content'], 'test.txt', { type: 'text/plain' });
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ detail: 'Unsupported format. Supported: WAV, MP3, FLAC, M4A' }),
    });

    await expect(uploadAudio(file)).rejects.toThrow('Unsupported format. Supported: WAV, MP3, FLAC, M4A');
  });
});

describe('getTranscripts', () => {
  it('fetches the list of transcripts', async () => {
    const summaries = [
      {
        id: '1',
        audio_file_name: 'test.wav',
        transcription_date: '2024-01-15T10:30:00Z',
        status: 'completed',
        segment_count: 5,
        pii_flagged_count: 1,
        edited_count: 2,
      },
    ];
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(summaries),
    });

    const result = await getTranscripts();

    expect(mockFetch).toHaveBeenCalledWith('/api/transcripts');
    expect(result).toEqual(summaries);
  });

  it('throws on failure', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ detail: 'Server error' }),
    });

    await expect(getTranscripts()).rejects.toThrow('Server error');
  });
});

describe('getTranscript', () => {
  it('fetches a single transcript by ID', async () => {
    const transcript = {
      id: 'abc-123',
      metadata: {
        audio_file_name: 'test.wav',
        audio_file_path: 'audio_files/abc-123/test.wav',
        transcription_date: '2024-01-15T10:30:00Z',
        total_duration_seconds: 120.5,
        model_name: 'large-v2',
        device_used: 'cpu',
        status: 'completed',
      },
      segments: [],
    };
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(transcript),
    });

    const result = await getTranscript('abc-123');

    expect(mockFetch).toHaveBeenCalledWith('/api/transcripts/abc-123');
    expect(result).toEqual(transcript);
  });

  it('throws when transcript not found', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ detail: 'Transcript not-exist not found' }),
    });

    await expect(getTranscript('not-exist')).rejects.toThrow('Transcript not-exist not found');
  });
});

describe('getTranscriptStatus', () => {
  it('fetches the status of a transcript', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: 'completed' }),
    });

    const result = await getTranscriptStatus('abc-123');

    expect(mockFetch).toHaveBeenCalledWith('/api/transcripts/abc-123/status');
    expect(result).toEqual({ status: 'completed' });
  });

  it('throws when transcript not found', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ detail: 'Transcript xyz not found' }),
    });

    await expect(getTranscriptStatus('xyz')).rejects.toThrow('Transcript xyz not found');
  });
});

describe('updateSegment', () => {
  it('sends a PUT request with segment index and updates', async () => {
    const updatedTranscript = { id: 'abc-123', metadata: {}, segments: [] };
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(updatedTranscript),
    });

    const result = await updateSegment('abc-123', 2, { edited_text: 'corrected text' });

    expect(mockFetch).toHaveBeenCalledWith('/api/transcripts/abc-123', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ segment_index: 2, updates: { edited_text: 'corrected text' } }),
    });
    expect(result).toEqual(updatedTranscript);
  });

  it('sends PII flag update', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 'abc-123', metadata: {}, segments: [] }),
    });

    await updateSegment('abc-123', 0, { pii_flagged: true });

    expect(mockFetch).toHaveBeenCalledWith('/api/transcripts/abc-123', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ segment_index: 0, updates: { pii_flagged: true } }),
    });
  });

  it('throws on invalid segment index', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ detail: 'Segment index 99 out of range' }),
    });

    await expect(updateSegment('abc-123', 99, { pii_flagged: true })).rejects.toThrow(
      'Segment index 99 out of range'
    );
  });
});

describe('getAudioUrl', () => {
  it('constructs the correct audio streaming URL', () => {
    expect(getAudioUrl('abc-123')).toBe('/api/transcripts/abc-123/audio');
  });

  it('handles IDs with special characters', () => {
    expect(getAudioUrl('test-id-456')).toBe('/api/transcripts/test-id-456/audio');
  });
});
