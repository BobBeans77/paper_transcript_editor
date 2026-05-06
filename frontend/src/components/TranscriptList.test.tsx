import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TranscriptList } from './TranscriptList';

vi.mock('../api/client', () => ({
  getTranscripts: vi.fn(),
}));

import { getTranscripts } from '../api/client';

const mockedGetTranscripts = vi.mocked(getTranscripts);

const mockTranscripts = [
  {
    id: 'transcript-1',
    audio_file_name: 'interview.wav',
    transcription_date: '2024-01-15T10:30:00Z',
    status: 'completed',
    segment_count: 12,
    pii_flagged_count: 2,
    edited_count: 3,
  },
  {
    id: 'transcript-2',
    audio_file_name: 'meeting-notes.mp3',
    transcription_date: '2024-02-20T14:00:00Z',
    status: 'processing',
    segment_count: 8,
    pii_flagged_count: 0,
    edited_count: 0,
  },
];

describe('TranscriptList component', () => {
  const onSelectTranscript = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    mockedGetTranscripts.mockReturnValue(new Promise(() => {})); // never resolves

    render(<TranscriptList onSelectTranscript={onSelectTranscript} />);

    expect(screen.getByRole('status', { name: /loading transcripts/i })).toBeInTheDocument();
    expect(screen.getByText(/loading transcripts/i)).toBeInTheDocument();
  });

  it('displays transcript summaries after fetch', async () => {
    mockedGetTranscripts.mockResolvedValue(mockTranscripts);

    render(<TranscriptList onSelectTranscript={onSelectTranscript} />);

    await waitFor(() => {
      expect(screen.getByText('interview.wav')).toBeInTheDocument();
    });

    expect(screen.getByText('meeting-notes.mp3')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: /transcript list/i })).toBeInTheDocument();
  });

  it('shows empty state when no transcripts', async () => {
    mockedGetTranscripts.mockResolvedValue([]);

    render(<TranscriptList onSelectTranscript={onSelectTranscript} />);

    await waitFor(() => {
      expect(screen.getByText(/no transcripts yet/i)).toBeInTheDocument();
    });
  });

  it('shows error state on fetch failure', async () => {
    mockedGetTranscripts.mockRejectedValue(new Error('Network error'));

    render(<TranscriptList onSelectTranscript={onSelectTranscript} />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });
  });

  it('calls onSelectTranscript when a transcript is clicked', async () => {
    mockedGetTranscripts.mockResolvedValue(mockTranscripts);

    render(<TranscriptList onSelectTranscript={onSelectTranscript} />);

    await waitFor(() => {
      expect(screen.getByText('interview.wav')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /open transcript interview\.wav/i }));

    expect(onSelectTranscript).toHaveBeenCalledWith('transcript-1');
  });

  it('displays file name, date, and status for each transcript', async () => {
    mockedGetTranscripts.mockResolvedValue(mockTranscripts);

    render(<TranscriptList onSelectTranscript={onSelectTranscript} />);

    await waitFor(() => {
      expect(screen.getByText('interview.wav')).toBeInTheDocument();
    });

    // Check first transcript
    const listItems = screen.getAllByRole('listitem');
    expect(listItems).toHaveLength(2);

    // File names
    expect(screen.getByText('interview.wav')).toBeInTheDocument();
    expect(screen.getByText('meeting-notes.mp3')).toBeInTheDocument();

    // Statuses
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('Processing')).toBeInTheDocument();

    // Dates are formatted
    expect(screen.getByText(/Jan 15, 2024/)).toBeInTheDocument();
    expect(screen.getByText(/Feb 20, 2024/)).toBeInTheDocument();
  });
});
