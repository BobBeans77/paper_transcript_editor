import { useState, useRef, useCallback, useEffect } from 'react';
import { uploadAudio } from '../api/client';
import { useTranscriptionStatus } from '../hooks/useTranscriptionStatus';

const SUPPORTED_FORMATS = ['wav', 'mp3', 'flac', 'm4a'];
const SUPPORTED_MIME_TYPES = [
  'audio/wav',
  'audio/x-wav',
  'audio/mpeg',
  'audio/mp3',
  'audio/flac',
  'audio/x-flac',
  'audio/mp4',
  'audio/x-m4a',
];

type UploadState = 'idle' | 'selected' | 'uploading' | 'transcribing' | 'completed' | 'error';

export interface UploadProps {
  onTranscriptionComplete: (transcriptId: string) => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileExtension(fileName: string): string {
  const parts = fileName.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

function isFormatSupported(fileName: string): boolean {
  const ext = getFileExtension(fileName);
  return SUPPORTED_FORMATS.includes(ext);
}

export function Upload({ onTranscriptionComplete }: UploadProps) {
  const [state, setState] = useState<UploadState>('idle');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [transcriptId, setTranscriptId] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { status: transcriptionStatus, error: pollingError } = useTranscriptionStatus(
    state === 'transcribing' ? transcriptId : null
  );

  // React to transcription status changes
  useEffect(() => {
    if (state !== 'transcribing') return;

    if (transcriptionStatus === 'completed' && transcriptId) {
      setState('completed');
      onTranscriptionComplete(transcriptId);
    } else if (transcriptionStatus === 'failed') {
      setState('error');
      setErrorMessage('Transcription failed. Please try again.');
    }
  }, [transcriptionStatus, transcriptId, state, onTranscriptionComplete]);

  // React to polling errors
  useEffect(() => {
    if (pollingError && state === 'transcribing') {
      setState('error');
      setErrorMessage(pollingError);
    }
  }, [pollingError, state]);

  const handleFileSelect = useCallback((file: File) => {
    setErrorMessage(null);

    if (!isFormatSupported(file.name)) {
      setState('error');
      setErrorMessage(
        `Unsupported format. Supported formats: ${SUPPORTED_FORMATS.map((f) => f.toUpperCase()).join(', ')}`
      );
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
    setState('selected');
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const file = e.dataTransfer.files?.[0];
      if (file) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect]
  );

  const handleUpload = useCallback(async () => {
    if (!selectedFile) return;

    setState('uploading');
    setErrorMessage(null);

    try {
      const result = await uploadAudio(selectedFile);
      setTranscriptId(result.transcript_id);
      setState('transcribing');
    } catch (err) {
      setState('error');
      setErrorMessage(err instanceof Error ? err.message : 'Upload failed');
    }
  }, [selectedFile]);

  const handleRetry = useCallback(() => {
    setState('idle');
    setSelectedFile(null);
    setErrorMessage(null);
    setTranscriptId(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleBrowseClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const acceptFormats = SUPPORTED_MIME_TYPES.join(',');

  return (
    <div className="upload-container" role="region" aria-label="Audio file upload">
      {(state === 'idle' || state === 'selected' || state === 'error') && (
        <>
          <div
            className={`upload-dropzone ${isDragOver ? 'upload-dropzone--drag-over' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            role="button"
            tabIndex={0}
            aria-label="Drop audio file here or click to browse"
            onClick={handleBrowseClick}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleBrowseClick();
              }
            }}
          >
            <p>Drag and drop an audio file here, or click to browse</p>
            <p className="upload-dropzone__formats">
              Supported formats: {SUPPORTED_FORMATS.map((f) => f.toUpperCase()).join(', ')}
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept={acceptFormats}
            onChange={handleInputChange}
            aria-hidden="true"
            tabIndex={-1}
            style={{ display: 'none' }}
          />
        </>
      )}

      {state === 'selected' && selectedFile && (
        <div className="upload-file-info" aria-live="polite">
          <p>
            <strong>File:</strong> {selectedFile.name}
          </p>
          <p>
            <strong>Size:</strong> {formatFileSize(selectedFile.size)}
          </p>
          <button
            type="button"
            onClick={handleUpload}
            aria-label={`Upload ${selectedFile.name}`}
          >
            Upload
          </button>
        </div>
      )}

      {state === 'uploading' && (
        <div className="upload-progress" role="status" aria-live="polite">
          <p>Uploading file...</p>
          <div className="upload-progress__indicator" aria-label="Upload in progress" />
        </div>
      )}

      {state === 'transcribing' && (
        <div className="upload-progress" role="status" aria-live="polite">
          <p>Transcribing audio... This may take a few minutes.</p>
          <div className="upload-progress__indicator" aria-label="Transcription in progress" />
        </div>
      )}

      {state === 'error' && errorMessage && (
        <div className="upload-error" role="alert" aria-live="assertive">
          <p className="upload-error__message">{errorMessage}</p>
          <button type="button" onClick={handleRetry}>
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
