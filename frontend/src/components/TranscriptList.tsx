import { useEffect, useState, useCallback } from 'react';
import { getTranscripts, deleteTranscript } from '../api/client';
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

  const handleDelete = useCallback(
    async (e: React.MouseEvent, transcriptId: string) => {
      e.stopPropagation();
      if (!window.confirm('Delete this transcript? This cannot be undone.')) return;

      try {
        await deleteTranscript(transcriptId);
        setTranscripts((prev) => prev.filter((t) => t.id !== transcriptId));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete transcript');
      }
    },
    []
  );

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
      <div className="transcript-list-empty" aria-label="No transcripts">
        <p>No transcripts yet. Upload an audio file to get started.</p>
      </div>
    );
  }

  // Group transcripts by accent
  const grouped = new Map<string, TranscriptSummary[]>();
  for (const transcript of transcripts) {
    const key = transcript.accent ?? 'Untagged';
    const group = grouped.get(key);
    if (group) {
      group.push(transcript);
    } else {
      grouped.set(key, [transcript]);
    }
  }

  // Sort groups alphabetically, with "Untagged" last
  const sortedGroups = [...grouped.entries()].sort(([a], [b]) => {
    if (a === 'Untagged') return 1;
    if (b === 'Untagged') return -1;
    return a.localeCompare(b);
  });

  return (
    <div className="transcript-list-grouped" aria-label="Transcript list grouped by accent">
      {sortedGroups.map(([accent, group]) => (
        <section key={accent} className="transcript-group" aria-label={`${accent} accent group`}>
          <h3 className="transcript-group-heading">
            {accent}
            <span className="transcript-group-count">({group.length})</span>
          </h3>
          <ul className="transcript-list" role="list">
            {group.map((transcript) => (
              <li
                key={transcript.id}
                className="transcript-list-item"
                role="listitem"
                aria-label={`Transcript: ${transcript.audio_file_name}`}
              >
                <button
                  type="button"
                  className="transcript-list-item-content"
                  onClick={() => onSelectTranscript(transcript.id)}
                  aria-label={`Open transcript ${transcript.audio_file_name}`}
                >
                  <span className="transcript-file-name" data-testid="file-name">
                    {transcript.audio_file_name}
                  </span>
                  <span className="transcript-date" data-testid="date">
                    {formatDate(transcript.transcription_date)}
                  </span>
                  <span
                    className={`transcript-status transcript-status--${transcript.status}`}
                    data-testid="status"
                  >
                    {getStatusLabel(transcript.status)}
                  </span>
                </button>
                <button
                  type="button"
                  className="transcript-delete-btn btn-danger"
                  onClick={(e) => handleDelete(e, transcript.id)}
                  aria-label={`Delete transcript ${transcript.audio_file_name}`}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
