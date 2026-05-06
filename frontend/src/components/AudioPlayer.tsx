import React from "react";
import { formatTimestamp } from "./SegmentList";

export interface AudioPlayerHandle {
  togglePlayPause: () => void;
  cycleSpeed: (direction: 'up' | 'down') => void;
}

export interface AudioPlayerProps {
  audioUrl: string;
  onTimeUpdate?: (currentTime: number) => void;
  seekTo?: number | null;
}

const PLAYBACK_SPEEDS = [0.75, 1, 1.25, 1.5, 2] as const;

export const AudioPlayer = React.forwardRef<AudioPlayerHandle, AudioPlayerProps>(
  function AudioPlayer({ audioUrl, onTimeUpdate, seekTo }, ref) {
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

    function togglePlayPause() {
      if (!audioRef.current) return;

      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play();
        setIsPlaying(true);
      }
    }

    function cycleSpeed(direction: 'up' | 'down') {
      const currentIndex = PLAYBACK_SPEEDS.indexOf(playbackRate as typeof PLAYBACK_SPEEDS[number]);
      const idx = currentIndex === -1 ? 1 : currentIndex; // default to 1x
      let newIndex: number;
      if (direction === 'up') {
        newIndex = Math.min(idx + 1, PLAYBACK_SPEEDS.length - 1);
      } else {
        newIndex = Math.max(idx - 1, 0);
      }
      const newSpeed = PLAYBACK_SPEEDS[newIndex];
      setPlaybackRate(newSpeed);
      if (audioRef.current) {
        audioRef.current.playbackRate = newSpeed;
      }
    }

    React.useImperativeHandle(ref, () => ({
      togglePlayPause,
      cycleSpeed,
    }));

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
          onClick={togglePlayPause}
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

        <span className="audio-player-shortcuts-hint">
          Space: play/pause · ←→: speed
        </span>
      </div>
    );
  }
);
