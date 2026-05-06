import { useState, useCallback } from 'react';
import { Upload } from './components/Upload';
import { TranscriptList } from './components/TranscriptList';
import { SegmentList } from './components/SegmentList';
import { AudioPlayer } from './components/AudioPlayer';
import { useActiveSegment } from './hooks/useActiveSegment';
import { getTranscript, updateSegment, getAudioUrl } from './api/client';
import type { TranscriptData, Segment, SegmentUpdate } from './types/transcript';

type AppView = 'list' | 'review';

function App() {
  const [view, setView] = useState<AppView>('list');
  const [currentTranscriptId, setCurrentTranscriptId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptData | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [seekTime, setSeekTime] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const activeSegmentIndex = useActiveSegment(transcript?.segments ?? [], currentTime);

  const loadTranscript = useCallback(async (transcriptId: string) => {
    try {
      setLoadError(null);
      const data = await getTranscript(transcriptId);
      setTranscript(data);
      setCurrentTranscriptId(transcriptId);
      setCurrentTime(0);
      setSeekTime(null);
      setView('review');
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load transcript');
    }
  }, []);

  const handleTranscriptionComplete = useCallback(
    (transcriptId: string) => {
      loadTranscript(transcriptId);
    },
    [loadTranscript]
  );

  const handleSelectTranscript = useCallback(
    (transcriptId: string) => {
      loadTranscript(transcriptId);
    },
    [loadTranscript]
  );

  const handleBackToList = useCallback(() => {
    setView('list');
    setTranscript(null);
    setCurrentTranscriptId(null);
    setCurrentTime(0);
    setSeekTime(null);
    setLoadError(null);
  }, []);

  const handleSegmentClick = useCallback((segment: Segment) => {
    setSeekTime(segment.start);
  }, []);

  const handleTimeUpdate = useCallback((time: number) => {
    setCurrentTime(time);
  }, []);

  const handleSegmentUpdate = useCallback(
    async (index: number, update: SegmentUpdate) => {
      if (!currentTranscriptId) return;

      try {
        const updatedTranscript = await updateSegment(currentTranscriptId, index, update);
        setTranscript(updatedTranscript);
      } catch (err) {
        console.error('Failed to update segment:', err);
      }
    },
    [currentTranscriptId]
  );

  return (
    <div className="app">
      <header className="app-header">
        <h1>WhisperX Transcription Review</h1>
      </header>

      {loadError && (
        <div className="app-error" role="alert">
          <p>{loadError}</p>
        </div>
      )}

      {view === 'list' && (
        <main className="app-list-view">
          <Upload onTranscriptionComplete={handleTranscriptionComplete} />
          <TranscriptList onSelectTranscript={handleSelectTranscript} />
        </main>
      )}

      {view === 'review' && transcript && currentTranscriptId && (
        <main className="app-review-view">
          <button
            type="button"
            className="app-back-btn"
            onClick={handleBackToList}
            aria-label="Back to transcript list"
          >
            ← Back to list
          </button>

          <h2>{transcript.metadata.audio_file_name}</h2>

          <AudioPlayer
            audioUrl={getAudioUrl(currentTranscriptId)}
            onTimeUpdate={handleTimeUpdate}
            seekTo={seekTime}
          />

          <SegmentList
            segments={transcript.segments}
            activeSegmentIndex={activeSegmentIndex}
            onSegmentClick={handleSegmentClick}
            onSegmentUpdate={handleSegmentUpdate}
          />
        </main>
      )}
    </div>
  );
}

export default App;
