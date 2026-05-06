import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SegmentList, formatTimestamp } from "./SegmentList";
import type { Segment } from "../types/transcript";

function makeSegment(overrides: Partial<Segment> = {}): Segment {
  return {
    index: 0,
    start: 0,
    end: 5.0,
    speaker: "SPEAKER_00",
    text: "Hello world",
    edited_text: null,
    pii_flagged: false,
    speaker_override: null,
    excluded: false,
    ...overrides,
  };
}

describe("formatTimestamp", () => {
  it("formats seconds as M:SS for short durations", () => {
    expect(formatTimestamp(0)).toBe("0:00");
    expect(formatTimestamp(5)).toBe("0:05");
    expect(formatTimestamp(65)).toBe("1:05");
    expect(formatTimestamp(600)).toBe("10:00");
  });

  it("formats as H:MM:SS for durations >= 1 hour", () => {
    expect(formatTimestamp(3600)).toBe("1:00:00");
    expect(formatTimestamp(3661)).toBe("1:01:01");
    expect(formatTimestamp(7200)).toBe("2:00:00");
  });

  it("handles fractional seconds by flooring", () => {
    expect(formatTimestamp(1.9)).toBe("0:01");
    expect(formatTimestamp(59.99)).toBe("0:59");
  });
});

describe("SegmentList", () => {
  it("renders segments in chronological order by start timestamp", () => {
    const segments: Segment[] = [
      makeSegment({ index: 2, start: 10, end: 15, text: "Third" }),
      makeSegment({ index: 0, start: 0, end: 5, text: "First" }),
      makeSegment({ index: 1, start: 5, end: 10, text: "Second" }),
    ];

    render(<SegmentList segments={segments} />);

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("First");
    expect(items[1]).toHaveTextContent("Second");
    expect(items[2]).toHaveTextContent("Third");
  });

  it("displays speaker identifier for each segment", () => {
    const segments: Segment[] = [
      makeSegment({ index: 0, speaker: "SPEAKER_00" }),
      makeSegment({ index: 1, start: 5, end: 10, speaker: "SPEAKER_01" }),
    ];

    render(<SegmentList segments={segments} speakers={["SPEAKER_00", "SPEAKER_01"]} />);

    expect(screen.getByTestId("segment-speaker-select-0")).toHaveTextContent("SPEAKER_00");
    expect(screen.getByTestId("segment-speaker-select-1")).toHaveTextContent("SPEAKER_01");
  });

  it("displays start and end timestamps for each segment", () => {
    const segments: Segment[] = [
      makeSegment({ index: 0, start: 65, end: 130 }),
    ];

    render(<SegmentList segments={segments} />);

    expect(screen.getByTestId("segment-timestamps-0")).toHaveTextContent("1:05 – 2:10");
  });

  it("displays text for each segment", () => {
    const segments: Segment[] = [
      makeSegment({ index: 0, text: "Hello world" }),
    ];

    render(<SegmentList segments={segments} />);

    expect(screen.getByTestId("segment-text-0")).toHaveTextContent("Hello world");
  });

  it("displays edited_text when present instead of original text", () => {
    const segments: Segment[] = [
      makeSegment({ index: 0, text: "Original text", edited_text: "Corrected text" }),
    ];

    render(<SegmentList segments={segments} />);

    expect(screen.getByTestId("segment-text-0")).toHaveTextContent("Corrected text");
    expect(screen.getByTestId("segment-text-0")).not.toHaveTextContent("Original text");
  });

  it("shows edited badge for segments with edited_text", () => {
    const segments: Segment[] = [
      makeSegment({ index: 0, edited_text: "Edited" }),
      makeSegment({ index: 1, start: 5, end: 10, edited_text: null }),
    ];

    render(<SegmentList segments={segments} />);

    expect(screen.getByTestId("segment-edited-badge-0")).toBeInTheDocument();
    expect(screen.queryByTestId("segment-edited-badge-1")).not.toBeInTheDocument();
  });

  it("applies color coding per speaker with consistent colors", () => {
    const segments: Segment[] = [
      makeSegment({ index: 0, speaker: "SPEAKER_00" }),
      makeSegment({ index: 1, start: 5, end: 10, speaker: "SPEAKER_01" }),
      makeSegment({ index: 2, start: 10, end: 15, speaker: "SPEAKER_00" }),
    ];

    render(<SegmentList segments={segments} />);

    const speaker0First = screen.getByTestId("segment-speaker-select-0");
    const speaker1 = screen.getByTestId("segment-speaker-select-1");
    const speaker0Second = screen.getByTestId("segment-speaker-select-2");

    // Same speaker gets same color
    expect(speaker0First.style.color).toBe(speaker0Second.style.color);
    // Different speakers get different colors
    expect(speaker0First.style.color).not.toBe(speaker1.style.color);
  });

  it("highlights the active segment", () => {
    const segments: Segment[] = [
      makeSegment({ index: 0 }),
      makeSegment({ index: 1, start: 5, end: 10 }),
    ];

    render(<SegmentList segments={segments} activeSegmentIndex={1} />);

    const activeItem = screen.getByTestId("segment-1");
    expect(activeItem.className).toContain("segment-item--active");

    const inactiveItem = screen.getByTestId("segment-0");
    expect(inactiveItem.className).not.toContain("segment-item--active");
  });

  it("calls onSegmentClick when a segment is clicked", () => {
    const segments: Segment[] = [makeSegment({ index: 0 })];
    const handleClick = vi.fn();

    render(<SegmentList segments={segments} onSegmentClick={handleClick} />);

    fireEvent.click(screen.getByTestId("segment-0"));
    expect(handleClick).toHaveBeenCalledWith(segments[0]);
  });

  it("renders empty list when no segments provided", () => {
    render(<SegmentList segments={[]} />);

    const list = screen.getByRole("list");
    expect(list).toBeInTheDocument();
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });

  describe("PII flagging", () => {
    it("shows PII indicator when pii_flagged is true", () => {
      const segments: Segment[] = [
        makeSegment({ index: 0, pii_flagged: true }),
      ];

      render(<SegmentList segments={segments} />);

      expect(screen.getByTestId("segment-pii-badge-0")).toBeInTheDocument();
      expect(screen.getByTestId("segment-pii-badge-0")).toHaveTextContent("PII");
    });

    it("does not show PII indicator when pii_flagged is false", () => {
      const segments: Segment[] = [
        makeSegment({ index: 0, pii_flagged: false }),
      ];

      render(<SegmentList segments={segments} />);

      expect(screen.queryByTestId("segment-pii-badge-0")).not.toBeInTheDocument();
    });

    it("calls onSegmentUpdate with correct args when PII toggle is clicked", () => {
      const segments: Segment[] = [
        makeSegment({ index: 0, pii_flagged: false }),
      ];
      const handleUpdate = vi.fn();

      render(<SegmentList segments={segments} onSegmentUpdate={handleUpdate} />);

      fireEvent.click(screen.getByTestId("segment-pii-toggle-0"));
      expect(handleUpdate).toHaveBeenCalledWith(0, { pii_flagged: true });
    });

    it("calls onSegmentUpdate to unflag when PII toggle is clicked on flagged segment", () => {
      const segments: Segment[] = [
        makeSegment({ index: 0, pii_flagged: true }),
      ];
      const handleUpdate = vi.fn();

      render(<SegmentList segments={segments} onSegmentUpdate={handleUpdate} />);

      fireEvent.click(screen.getByTestId("segment-pii-toggle-0"));
      expect(handleUpdate).toHaveBeenCalledWith(0, { pii_flagged: false });
    });

    it("PII toggle has accessible aria-pressed attribute", () => {
      const segments: Segment[] = [
        makeSegment({ index: 0, pii_flagged: true }),
        makeSegment({ index: 1, start: 5, end: 10, pii_flagged: false }),
      ];

      render(<SegmentList segments={segments} />);

      const toggle0 = screen.getByTestId("segment-pii-toggle-0");
      const toggle1 = screen.getByTestId("segment-pii-toggle-1");

      expect(toggle0).toHaveAttribute("aria-pressed", "true");
      expect(toggle1).toHaveAttribute("aria-pressed", "false");
    });

    it("PII toggle click does not trigger segment click", () => {
      const segments: Segment[] = [makeSegment({ index: 0 })];
      const handleClick = vi.fn();
      const handleUpdate = vi.fn();

      render(
        <SegmentList
          segments={segments}
          onSegmentClick={handleClick}
          onSegmentUpdate={handleUpdate}
        />
      );

      fireEvent.click(screen.getByTestId("segment-pii-toggle-0"));
      expect(handleUpdate).toHaveBeenCalled();
      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe("Segment text editing", () => {
    it("shows an Edit button on each segment", () => {
      const segments: Segment[] = [
        makeSegment({ index: 0 }),
        makeSegment({ index: 1, start: 5, end: 10 }),
      ];

      render(<SegmentList segments={segments} />);

      expect(screen.getByTestId("segment-edit-btn-0")).toBeInTheDocument();
      expect(screen.getByTestId("segment-edit-btn-1")).toBeInTheDocument();
    });

    it("Edit button enters inline editing mode with textarea", () => {
      const segments: Segment[] = [
        makeSegment({ index: 0, text: "Hello world" }),
      ];

      render(<SegmentList segments={segments} />);

      fireEvent.click(screen.getByTestId("segment-edit-btn-0"));

      expect(screen.getByTestId("segment-edit-input-0")).toBeInTheDocument();
      expect(screen.getByTestId("segment-edit-input-0")).toHaveValue("Hello world");
      // Text display should be replaced by edit area
      expect(screen.queryByTestId("segment-text-0")).not.toBeInTheDocument();
    });

    it("Edit mode pre-fills with edited_text when present", () => {
      const segments: Segment[] = [
        makeSegment({ index: 0, text: "Original", edited_text: "Already edited" }),
      ];

      render(<SegmentList segments={segments} />);

      fireEvent.click(screen.getByTestId("segment-edit-btn-0"));

      expect(screen.getByTestId("segment-edit-input-0")).toHaveValue("Already edited");
    });

    it("Save button calls onSegmentUpdate with edited text", () => {
      const segments: Segment[] = [
        makeSegment({ index: 0, text: "Hello world" }),
      ];
      const handleUpdate = vi.fn();

      render(<SegmentList segments={segments} onSegmentUpdate={handleUpdate} />);

      fireEvent.click(screen.getByTestId("segment-edit-btn-0"));
      fireEvent.change(screen.getByTestId("segment-edit-input-0"), {
        target: { value: "Hello updated world" },
      });
      fireEvent.click(screen.getByTestId("segment-save-btn-0"));

      expect(handleUpdate).toHaveBeenCalledWith(0, { edited_text: "Hello updated world" });
    });

    it("Save button exits edit mode", () => {
      const segments: Segment[] = [
        makeSegment({ index: 0, text: "Hello world" }),
      ];

      render(<SegmentList segments={segments} onSegmentUpdate={vi.fn()} />);

      fireEvent.click(screen.getByTestId("segment-edit-btn-0"));
      fireEvent.click(screen.getByTestId("segment-save-btn-0"));

      expect(screen.queryByTestId("segment-edit-input-0")).not.toBeInTheDocument();
      expect(screen.getByTestId("segment-text-0")).toBeInTheDocument();
    });

    it("Cancel button exits edit mode without saving", () => {
      const segments: Segment[] = [
        makeSegment({ index: 0, text: "Hello world" }),
      ];
      const handleUpdate = vi.fn();

      render(<SegmentList segments={segments} onSegmentUpdate={handleUpdate} />);

      fireEvent.click(screen.getByTestId("segment-edit-btn-0"));
      fireEvent.change(screen.getByTestId("segment-edit-input-0"), {
        target: { value: "Changed text" },
      });
      fireEvent.click(screen.getByTestId("segment-cancel-btn-0"));

      expect(handleUpdate).not.toHaveBeenCalled();
      expect(screen.queryByTestId("segment-edit-input-0")).not.toBeInTheDocument();
      expect(screen.getByTestId("segment-text-0")).toHaveTextContent("Hello world");
    });

    it("Revert button calls onSegmentUpdate with null edited_text", () => {
      const segments: Segment[] = [
        makeSegment({ index: 0, text: "Original", edited_text: "Edited version" }),
      ];
      const handleUpdate = vi.fn();

      render(<SegmentList segments={segments} onSegmentUpdate={handleUpdate} />);

      expect(screen.getByTestId("segment-revert-btn-0")).toBeInTheDocument();
      fireEvent.click(screen.getByTestId("segment-revert-btn-0"));

      expect(handleUpdate).toHaveBeenCalledWith(0, { edited_text: null });
    });

    it("Revert button is not shown when segment has no edited_text", () => {
      const segments: Segment[] = [
        makeSegment({ index: 0, edited_text: null }),
      ];

      render(<SegmentList segments={segments} />);

      expect(screen.queryByTestId("segment-revert-btn-0")).not.toBeInTheDocument();
    });

    it("Edit button click does not trigger segment click handler", () => {
      const segments: Segment[] = [makeSegment({ index: 0 })];
      const handleClick = vi.fn();
      const handleUpdate = vi.fn();

      render(
        <SegmentList
          segments={segments}
          onSegmentClick={handleClick}
          onSegmentUpdate={handleUpdate}
        />
      );

      fireEvent.click(screen.getByTestId("segment-edit-btn-0"));
      expect(handleClick).not.toHaveBeenCalled();
    });

    it("Save button click does not trigger segment click handler", () => {
      const segments: Segment[] = [makeSegment({ index: 0 })];
      const handleClick = vi.fn();
      const handleUpdate = vi.fn();

      render(
        <SegmentList
          segments={segments}
          onSegmentClick={handleClick}
          onSegmentUpdate={handleUpdate}
        />
      );

      fireEvent.click(screen.getByTestId("segment-edit-btn-0"));
      fireEvent.click(screen.getByTestId("segment-save-btn-0"));
      expect(handleClick).not.toHaveBeenCalled();
    });

    it("Cancel button click does not trigger segment click handler", () => {
      const segments: Segment[] = [makeSegment({ index: 0 })];
      const handleClick = vi.fn();

      render(
        <SegmentList
          segments={segments}
          onSegmentClick={handleClick}
        />
      );

      fireEvent.click(screen.getByTestId("segment-edit-btn-0"));
      fireEvent.click(screen.getByTestId("segment-cancel-btn-0"));
      expect(handleClick).not.toHaveBeenCalled();
    });

    it("Revert button click does not trigger segment click handler", () => {
      const segments: Segment[] = [
        makeSegment({ index: 0, edited_text: "Edited" }),
      ];
      const handleClick = vi.fn();
      const handleUpdate = vi.fn();

      render(
        <SegmentList
          segments={segments}
          onSegmentClick={handleClick}
          onSegmentUpdate={handleUpdate}
        />
      );

      fireEvent.click(screen.getByTestId("segment-revert-btn-0"));
      expect(handleClick).not.toHaveBeenCalled();
    });
  });
});
