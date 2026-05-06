import { useEffect, useState } from 'react';
import { getTranscripts } from '../api/client';
import type { TranscriptSummary } from '../types/transcript';

export interface TranscriptListProps {
  onSelectTranscript: (transcriptId: string) => void;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'completed':
      return 'Completed';
    case 'processing':
      return 'Processing';
    case 'pending':
      return 'Pending';
    case 'failed':
      return 'Failed';
    default:
      return status;
  }
}

export function TranscriptList({ onSelectTranscript }: TranscriptListProps) {
  const [transcripts, setTranscripts] = useState<TranscriptSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchTranscripts() {
      try {
        setLoading(true);
        setError(null);
        const data = await getTranscripts();
        if (!cancelled) {
          setTranscripts(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load transcripts');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchTranscripts();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div role="status" aria-label="Loading transcripts">
        Loading transcripts…
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" aria-label="Error loading transcripts">
        <p>Error: {error}</p>
      </div>
    );
  }

  if (transcripts.length === 0) {
    return (
      <div aria-label="No transcripts">
        <p>No transcripts yet. Upload an audio file to get started.</p>
      </div>
    );
  }

  return (
    <ul role="list" aria-label="Transcript list">
      {transcripts.map((transcript) => (
        <li
          key={transcript.id}
          role="listitem"
          aria-label={`Transcript: ${transcript.audio_file_name}`}
        >
          <button
            type="button"
            onClick={() => onSelectTranscript(transcript.id)}
            aria-label={`Open transcript ${transcript.audio_file_name}`}
          >
            <span data-testid="file-name">{transcript.audio_file_name}</span>
            <span data-testid="date">{formatDate(transcript.transcription_date)}</span>
            <span data-testid="status">{getStatusLabel(transcript.status)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
