import React from "react";
import type { Segment, SegmentUpdate } from "../types/transcript";

export interface SegmentListProps {
  segments: Segment[];
  activeSegmentIndex?: number | null;
  onSegmentClick?: (segment: Segment) => void;
  onSegmentUpdate?: (index: number, update: SegmentUpdate) => void;
}

const SPEAKER_COLORS = [
  "#2563eb", // blue
  "#dc2626", // red
  "#16a34a", // green
  "#9333ea", // purple
  "#ea580c", // orange
  "#0891b2", // cyan
  "#be185d", // pink
  "#4f46e5", // indigo
];

function getSpeakerColor(speaker: string, speakerMap: Map<string, number>): string {
  if (!speakerMap.has(speaker)) {
    speakerMap.set(speaker, speakerMap.size);
  }
  const index = speakerMap.get(speaker)!;
  return SPEAKER_COLORS[index % SPEAKER_COLORS.length];
}

export function formatTimestamp(seconds: number): string {
  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

export function SegmentList({
  segments,
  activeSegmentIndex,
  onSegmentClick,
  onSegmentUpdate,
}: SegmentListProps) {
  const [editingIndex, setEditingIndex] = React.useState<number | null>(null);
  const [editText, setEditText] = React.useState("");

  const speakerColorMap = React.useMemo(() => {
    const map = new Map<string, number>();
    // Assign colors in order of first appearance
    const sorted = [...segments].sort((a, b) => a.start - b.start);
    for (const seg of sorted) {
      if (!map.has(seg.speaker)) {
        map.set(seg.speaker, map.size);
      }
    }
    return map;
  }, [segments]);

  const sortedSegments = React.useMemo(
    () => [...segments].sort((a, b) => a.start - b.start),
    [segments]
  );

  function handleEditClick(e: React.MouseEvent, segment: Segment) {
    e.stopPropagation();
    setEditingIndex(segment.index);
    setEditText(segment.edited_text ?? segment.text);
  }

  function handleSaveClick(e: React.MouseEvent, segment: Segment) {
    e.stopPropagation();
    onSegmentUpdate?.(segment.index, { edited_text: editText });
    setEditingIndex(null);
    setEditText("");
  }

  function handleCancelClick(e: React.MouseEvent) {
    e.stopPropagation();
    setEditingIndex(null);
    setEditText("");
  }

  function handleRevertClick(e: React.MouseEvent, segment: Segment) {
    e.stopPropagation();
    onSegmentUpdate?.(segment.index, { edited_text: null });
  }

  return (
    <div className="segment-list" role="list">
      {sortedSegments.map((segment) => {
        const isActive = activeSegmentIndex === segment.index;
        const isEdited = segment.edited_text !== null;
        const isEditing = editingIndex === segment.index;
        const displayText = segment.edited_text ?? segment.text;
        const speakerColor = getSpeakerColor(segment.speaker, speakerColorMap);

        return (
          <div
            key={segment.index}
            className={`segment-item${isActive ? " segment-item--active" : ""}${isEdited ? " segment-item--edited" : ""}${segment.pii_flagged ? " segment-item--pii" : ""}`}
            role="listitem"
            data-testid={`segment-${segment.index}`}
            onClick={() => onSegmentClick?.(segment)}
          >
            <div className="segment-header">
              <span
                className="segment-speaker"
                style={{ color: speakerColor }}
                data-testid={`segment-speaker-${segment.index}`}
              >
                {segment.speaker}
              </span>
              <span
                className="segment-timestamps"
                data-testid={`segment-timestamps-${segment.index}`}
              >
                {formatTimestamp(segment.start)} – {formatTimestamp(segment.end)}
              </span>
              {segment.pii_flagged && (
                <span
                  className="segment-pii-badge"
                  data-testid={`segment-pii-badge-${segment.index}`}
                >
                  PII
                </span>
              )}
              {isEdited && (
                <span
                  className="segment-edited-badge"
                  data-testid={`segment-edited-badge-${segment.index}`}
                >
                  edited
                </span>
              )}
              <button
                className="segment-pii-toggle"
                data-testid={`segment-pii-toggle-${segment.index}`}
                aria-label={`Flag segment ${segment.index} as PII`}
                aria-pressed={segment.pii_flagged}
                onClick={(e) => {
                  e.stopPropagation();
                  onSegmentUpdate?.(segment.index, { pii_flagged: !segment.pii_flagged });
                }}
              >
                {segment.pii_flagged ? "Unflag PII" : "Flag PII"}
              </button>
              {!isEditing && (
                <button
                  className="segment-edit-btn"
                  data-testid={`segment-edit-btn-${segment.index}`}
                  aria-label={`Edit segment ${segment.index}`}
                  onClick={(e) => handleEditClick(e, segment)}
                >
                  Edit
                </button>
              )}
              {isEdited && !isEditing && (
                <button
                  className="segment-revert-btn"
                  data-testid={`segment-revert-btn-${segment.index}`}
                  aria-label={`Revert segment ${segment.index} to original`}
                  onClick={(e) => handleRevertClick(e, segment)}
                >
                  Revert
                </button>
              )}
            </div>
            {isEditing ? (
              <div className="segment-edit-area" data-testid={`segment-edit-area-${segment.index}`}>
                <textarea
                  className="segment-edit-input"
                  data-testid={`segment-edit-input-${segment.index}`}
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="segment-edit-actions">
                  <button
                    className="segment-save-btn"
                    data-testid={`segment-save-btn-${segment.index}`}
                    onClick={(e) => handleSaveClick(e, segment)}
                  >
                    Save
                  </button>
                  <button
                    className="segment-cancel-btn"
                    data-testid={`segment-cancel-btn-${segment.index}`}
                    onClick={(e) => handleCancelClick(e)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div
                className="segment-text"
                data-testid={`segment-text-${segment.index}`}
              >
                {displayText}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
