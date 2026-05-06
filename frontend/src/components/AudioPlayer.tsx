import React from "react";
import { formatTimestamp } from "./SegmentList";

export interface AudioPlayerProps {
  audioUrl: string;
  onTimeUpdate?: (currentTime: number) => void;
  seekTo?: number | null;
}

const PLAYBACK_SPEEDS = [1, 1.5, 2] as const;

export function AudioPlayer({ audioUrl, onTimeUpdate, seekTo }: AudioPlayerProps) {
  const audioRef = React.useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const [playbackRate, setPlaybackRate] = React.useState(1);

  // Handle seekTo prop changes
  React.useEffect(() => {
    if (seekTo != null && audioRef.current) {
      audioRef.current.currentTime = seekTo;
      setCurrentTime(seekTo);
    }
  }, [seekTo]);

  function handleTimeUpdate() {
    if (audioRef.current) {
      const time = audioRef.current.currentTime;
      setCurrentTime(time);
      onTimeUpdate?.(time);
    }
  }

  function handleLoadedMetadata() {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  }

  function handlePlayPause() {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  }

  function handleSpeedChange(speed: number) {
    setPlaybackRate(speed);
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  }

  function handleEnded() {
    setIsPlaying(false);
  }

  return (
    <div className="audio-player" data-testid="audio-player">
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        data-testid="audio-element"
      />

      <button
        className="audio-player-play-btn"
        onClick={handlePlayPause}
        aria-label={isPlaying ? "Pause" : "Play"}
        data-testid="play-pause-btn"
      >
        {isPlaying ? "Pause" : "Play"}
      </button>

      <span
        className="audio-player-time"
        data-testid="current-time"
        aria-label="Current playback position"
      >
        {formatTimestamp(currentTime)} / {formatTimestamp(duration)}
      </span>

      <div className="audio-player-speed" data-testid="speed-selector">
        {PLAYBACK_SPEEDS.map((speed) => (
          <button
            key={speed}
            className={`audio-player-speed-btn${playbackRate === speed ? " audio-player-speed-btn--active" : ""}`}
            onClick={() => handleSpeedChange(speed)}
            aria-label={`Set playback speed to ${speed}x`}
            aria-pressed={playbackRate === speed}
            data-testid={`speed-btn-${speed}`}
          >
            {speed}x
          </button>
        ))}
      </div>
    </div>
  );
}
