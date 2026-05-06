import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import App from './App';

// Mock the API client
vi.mock('./api/client', () => ({
  getTranscripts: vi.fn().mockResolvedValue([]),
  getTranscript: vi.fn(),
  updateSegment: vi.fn(),
  getAudioUrl: vi.fn((id: string) => `/api/transcripts/${id}/audio`),
  uploadAudio: vi.fn(),
}));

// Mock the transcription status hook
vi.mock('./hooks/useTranscriptionStatus', () => ({
  useTranscriptionStatus: vi.fn().mockReturnValue({ status: null, error: null }),
}));

describe('App', () => {
  it('renders the transcript list view by default', async () => {
    render(<App />);

    expect(screen.getByText('WhisperX Transcription Review')).toBeInTheDocument();
    // TranscriptList shows loading state initially, then the empty message
    expect(await screen.findByText('No transcripts yet. Upload an audio file to get started.')).toBeInTheDocument();
  });

  it('shows the Upload component in list view', () => {
    render(<App />);

    expect(screen.getByRole('region', { name: 'Audio file upload' })).toBeInTheDocument();
  });
});
