import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Upload } from './Upload';

// Mock the API client
vi.mock('../api/client', () => ({
  uploadAudio: vi.fn(),
}));

// Mock the transcription status hook
vi.mock('../hooks/useTranscriptionStatus', () => ({
  useTranscriptionStatus: vi.fn(() => ({
    status: null,
    isPolling: false,
    error: null,
  })),
}));

import { uploadAudio } from '../api/client';
import { useTranscriptionStatus } from '../hooks/useTranscriptionStatus';

const mockedUploadAudio = vi.mocked(uploadAudio);
const mockedUseTranscriptionStatus = vi.mocked(useTranscriptionStatus);

function createFile(name: string, size: number = 1024, type: string = 'audio/wav'): File {
  const content = new Uint8Array(size);
  return new File([content], name, { type });
}

describe('Upload component', () => {
  const onTranscriptionComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseTranscriptionStatus.mockReturnValue({
      status: null,
      isPolling: false,
      error: null,
    });
  });

  it('renders the drop zone in idle state', () => {
    render(<Upload onTranscriptionComplete={onTranscriptionComplete} />);

    expect(screen.getByText(/drag and drop an audio file/i)).toBeInTheDocument();
    expect(screen.getByText(/supported formats/i)).toBeInTheDocument();
  });

  it('displays file name and size after selecting a valid file', () => {
    render(<Upload onTranscriptionComplete={onTranscriptionComplete} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = createFile('test-audio.wav', 2048);

    fireEvent.change(input, { target: { files: [file] } });

    expect(screen.getByText('test-audio.wav')).toBeInTheDocument();
    expect(screen.getByText('2.0 KB')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /upload/i })).toBeInTheDocument();
  });

  it('shows error for unsupported file format', () => {
    render(<Upload onTranscriptionComplete={onTranscriptionComplete} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = createFile('document.pdf', 1024, 'application/pdf');

    fireEvent.change(input, { target: { files: [file] } });

    expect(screen.getByText(/unsupported format\. supported formats: WAV, MP3, FLAC, M4A/i)).toBeInTheDocument();
  });

  it('accepts WAV files', () => {
    render(<Upload onTranscriptionComplete={onTranscriptionComplete} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = createFile('audio.wav', 1024, 'audio/wav');

    fireEvent.change(input, { target: { files: [file] } });

    expect(screen.getByText('audio.wav')).toBeInTheDocument();
    expect(screen.queryByText(/unsupported format/i)).not.toBeInTheDocument();
  });

  it('accepts MP3 files', () => {
    render(<Upload onTranscriptionComplete={onTranscriptionComplete} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = createFile('audio.mp3', 1024, 'audio/mpeg');

    fireEvent.change(input, { target: { files: [file] } });

    expect(screen.getByText('audio.mp3')).toBeInTheDocument();
  });

  it('accepts FLAC files', () => {
    render(<Upload onTranscriptionComplete={onTranscriptionComplete} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = createFile('audio.flac', 1024, 'audio/flac');

    fireEvent.change(input, { target: { files: [file] } });

    expect(screen.getByText('audio.flac')).toBeInTheDocument();
  });

  it('accepts M4A files', () => {
    render(<Upload onTranscriptionComplete={onTranscriptionComplete} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = createFile('audio.m4a', 1024, 'audio/mp4');

    fireEvent.change(input, { target: { files: [file] } });

    expect(screen.getByText('audio.m4a')).toBeInTheDocument();
  });

  it('shows uploading progress indicator when upload starts', async () => {
    mockedUploadAudio.mockReturnValue(new Promise(() => {})); // never resolves

    render(<Upload onTranscriptionComplete={onTranscriptionComplete} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = createFile('audio.wav', 1024);

    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: /upload/i }));

    expect(screen.getByText(/uploading file/i)).toBeInTheDocument();
  });

  it('shows transcribing indicator after successful upload', async () => {
    mockedUploadAudio.mockResolvedValue({ transcript_id: 'abc-123', status: 'pending' });

    render(<Upload onTranscriptionComplete={onTranscriptionComplete} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = createFile('audio.wav', 1024);

    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: /upload/i }));

    await waitFor(() => {
      expect(screen.getByText(/transcribing audio/i)).toBeInTheDocument();
    });
  });

  it('displays error message on upload failure', async () => {
    mockedUploadAudio.mockRejectedValue(new Error('File exceeds maximum size'));

    render(<Upload onTranscriptionComplete={onTranscriptionComplete} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = createFile('audio.wav', 1024);

    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: /upload/i }));

    await waitFor(() => {
      expect(screen.getByText('File exceeds maximum size')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('calls onTranscriptionComplete when transcription finishes', async () => {
    mockedUploadAudio.mockResolvedValue({ transcript_id: 'abc-123', status: 'pending' });
    mockedUseTranscriptionStatus.mockReturnValue({
      status: 'completed',
      isPolling: false,
      error: null,
    });

    render(<Upload onTranscriptionComplete={onTranscriptionComplete} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = createFile('audio.wav', 1024);

    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: /upload/i }));

    await waitFor(() => {
      expect(onTranscriptionComplete).toHaveBeenCalledWith('abc-123');
    });
  });

  it('shows error when transcription fails', async () => {
    mockedUploadAudio.mockResolvedValue({ transcript_id: 'abc-123', status: 'pending' });
    mockedUseTranscriptionStatus.mockReturnValue({
      status: 'failed',
      isPolling: false,
      error: null,
    });

    render(<Upload onTranscriptionComplete={onTranscriptionComplete} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = createFile('audio.wav', 1024);

    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: /upload/i }));

    await waitFor(() => {
      expect(screen.getByText(/transcription failed/i)).toBeInTheDocument();
    });
  });

  it('resets state when retry button is clicked', async () => {
    mockedUploadAudio.mockRejectedValue(new Error('Network error'));

    render(<Upload onTranscriptionComplete={onTranscriptionComplete} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = createFile('audio.wav', 1024);

    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: /upload/i }));

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /try again/i }));

    expect(screen.getByText(/drag and drop an audio file/i)).toBeInTheDocument();
    expect(screen.queryByText('Network error')).not.toBeInTheDocument();
  });

  it('handles drag and drop of a valid file', () => {
    render(<Upload onTranscriptionComplete={onTranscriptionComplete} />);

    const dropzone = screen.getByRole('button', { name: /drop audio file/i });
    const file = createFile('dropped.wav', 4096);

    fireEvent.dragOver(dropzone);
    fireEvent.drop(dropzone, {
      dataTransfer: { files: [file] },
    });

    expect(screen.getByText('dropped.wav')).toBeInTheDocument();
    expect(screen.getByText('4.0 KB')).toBeInTheDocument();
  });

  it('shows error when dropping an unsupported file', () => {
    render(<Upload onTranscriptionComplete={onTranscriptionComplete} />);

    const dropzone = screen.getByRole('button', { name: /drop audio file/i });
    const file = createFile('video.mp4', 1024, 'video/mp4');

    fireEvent.drop(dropzone, {
      dataTransfer: { files: [file] },
    });

    expect(screen.getByText(/unsupported format/i)).toBeInTheDocument();
  });

  it('has proper ARIA attributes for accessibility', () => {
    render(<Upload onTranscriptionComplete={onTranscriptionComplete} />);

    expect(screen.getByRole('region', { name: /audio file upload/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /drop audio file/i })).toBeInTheDocument();
  });
});
