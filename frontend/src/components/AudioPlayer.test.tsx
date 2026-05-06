import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AudioPlayer } from "./AudioPlayer";

// Mock HTMLMediaElement methods not implemented in jsdom
const mockPlay = vi.fn().mockResolvedValue(undefined);
const mockPause = vi.fn();

beforeEach(() => {
  mockPlay.mockClear();
  mockPause.mockClear();
  window.HTMLMediaElement.prototype.play = mockPlay;
  window.HTMLMediaElement.prototype.pause = mockPause;
});

describe("AudioPlayer", () => {
  const defaultProps = {
    audioUrl: "/api/transcripts/test-id/audio",
  };

  it("renders audio element with correct src", () => {
    render(<AudioPlayer {...defaultProps} />);
    const audio = screen.getByTestId("audio-element") as HTMLAudioElement;
    expect(audio.tagName).toBe("AUDIO");
    expect(audio.src).toContain("/api/transcripts/test-id/audio");
  });

  it("renders play button initially", () => {
    render(<AudioPlayer {...defaultProps} />);
    const btn = screen.getByTestId("play-pause-btn");
    expect(btn).toHaveTextContent("Play");
    expect(btn).toHaveAttribute("aria-label", "Play");
  });

  it("play/pause button toggles playback", async () => {
    render(<AudioPlayer {...defaultProps} />);
    const btn = screen.getByTestId("play-pause-btn");

    // Click play
    await act(async () => {
      fireEvent.click(btn);
    });
    expect(mockPlay).toHaveBeenCalled();
    expect(btn).toHaveTextContent("Pause");
    expect(btn).toHaveAttribute("aria-label", "Pause");

    // Click pause
    await act(async () => {
      fireEvent.click(btn);
    });
    expect(mockPause).toHaveBeenCalled();
    expect(btn).toHaveTextContent("Play");
    expect(btn).toHaveAttribute("aria-label", "Play");
  });

  it("speed selector changes playback rate", () => {
    render(<AudioPlayer {...defaultProps} />);
    const audio = screen.getByTestId("audio-element") as HTMLAudioElement;

    // Default speed is 1x
    const btn1x = screen.getByTestId("speed-btn-1");
    expect(btn1x).toHaveAttribute("aria-pressed", "true");

    // Change to 1.5x
    const btn15x = screen.getByTestId("speed-btn-1.5");
    fireEvent.click(btn15x);
    expect(audio.playbackRate).toBe(1.5);
    expect(btn15x).toHaveAttribute("aria-pressed", "true");
    expect(btn1x).toHaveAttribute("aria-pressed", "false");

    // Change to 2x
    const btn2x = screen.getByTestId("speed-btn-2");
    fireEvent.click(btn2x);
    expect(audio.playbackRate).toBe(2);
    expect(btn2x).toHaveAttribute("aria-pressed", "true");
    expect(btn15x).toHaveAttribute("aria-pressed", "false");
  });

  it("displays current time and duration", () => {
    render(<AudioPlayer {...defaultProps} />);
    const timeDisplay = screen.getByTestId("current-time");
    // Initially 0:00 / 0:00
    expect(timeDisplay).toHaveTextContent("0:00 / 0:00");
  });

  it("current time display updates on timeupdate event", () => {
    const onTimeUpdate = vi.fn();
    render(<AudioPlayer {...defaultProps} onTimeUpdate={onTimeUpdate} />);
    const audio = screen.getByTestId("audio-element") as HTMLAudioElement;

    // Simulate time update
    Object.defineProperty(audio, "currentTime", {
      writable: true,
      value: 65,
    });
    fireEvent.timeUpdate(audio);

    const timeDisplay = screen.getByTestId("current-time");
    expect(timeDisplay).toHaveTextContent("1:05");
    expect(onTimeUpdate).toHaveBeenCalledWith(65);
  });

  it("seekTo prop seeks audio to correct position", () => {
    const { rerender } = render(<AudioPlayer {...defaultProps} seekTo={null} />);
    const audio = screen.getByTestId("audio-element") as HTMLAudioElement;

    // Set seekTo to 30 seconds
    rerender(<AudioPlayer {...defaultProps} seekTo={30} />);
    expect(audio.currentTime).toBe(30);

    const timeDisplay = screen.getByTestId("current-time");
    expect(timeDisplay).toHaveTextContent("0:30");
  });

  it("calls onTimeUpdate callback during playback", () => {
    const onTimeUpdate = vi.fn();
    render(<AudioPlayer {...defaultProps} onTimeUpdate={onTimeUpdate} />);
    const audio = screen.getByTestId("audio-element") as HTMLAudioElement;

    Object.defineProperty(audio, "currentTime", {
      writable: true,
      value: 10.5,
    });
    fireEvent.timeUpdate(audio);

    expect(onTimeUpdate).toHaveBeenCalledWith(10.5);
  });

  it("updates duration on loadedmetadata event", () => {
    render(<AudioPlayer {...defaultProps} />);
    const audio = screen.getByTestId("audio-element") as HTMLAudioElement;

    Object.defineProperty(audio, "duration", {
      writable: true,
      value: 120,
    });
    fireEvent.loadedMetadata(audio);

    const timeDisplay = screen.getByTestId("current-time");
    expect(timeDisplay).toHaveTextContent("0:00 / 2:00");
  });

  it("resets to play state when audio ends", async () => {
    render(<AudioPlayer {...defaultProps} />);
    const btn = screen.getByTestId("play-pause-btn");
    const audio = screen.getByTestId("audio-element") as HTMLAudioElement;

    // Start playing
    await act(async () => {
      fireEvent.click(btn);
    });
    expect(btn).toHaveTextContent("Pause");

    // Audio ends
    fireEvent.ended(audio);
    expect(btn).toHaveTextContent("Play");
  });

  it("has accessible speed buttons with aria-labels", () => {
    render(<AudioPlayer {...defaultProps} />);
    expect(screen.getByLabelText("Set playback speed to 1x")).toBeInTheDocument();
    expect(screen.getByLabelText("Set playback speed to 1.5x")).toBeInTheDocument();
    expect(screen.getByLabelText("Set playback speed to 2x")).toBeInTheDocument();
  });
});
