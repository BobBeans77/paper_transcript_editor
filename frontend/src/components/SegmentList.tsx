import React from "react";
import type { Segment, SegmentUpdate } from "../types/transcript";

export interface SegmentListProps {
  segments: Segment[];
  speakers?: string[];
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
  speakers = [],
  activeSegmentIndex,
  onSegmentClick,
  onSegmentUpdate,
}: SegmentListProps) {
  const [editingIndex, setEditingIndex] = React.useState<number | null>(null);
  const [editText, setEditText] = React.useState("");

  const speakerColorMap = React.useMemo(() => {
    const map = new Map<string, number>();
    const sorted = [...segments].sort((a, b) => a.start - b.start);
    for (const seg of sorted) {
      const spk = seg.speaker_override ?? seg.speaker;
      if (!map.has(spk)) {
        map.set(spk, map.size);
      }
    }
    return map;
  }, [segments]);

  const sortedSegments = React.useMemo(
    () => [...segments].sort((a, b) => a.start - b.start),
    [segments]
  );

  // Speaker options: existing speakers + "MULTIPLE"
  const speakerOptions = React.useMemo(() => {
    const opts = [...speakers];
    if (!opts.includes("MULTIPLE")) {
      opts.push("MULTIPLE");
    }
    return opts;
  }, [speakers]);

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

  function handleSpeakerChange(e: React.ChangeEvent<HTMLSelectElement>, segment: Segment) {
    e.stopPropagation();
    const value = e.target.value;
    // If selecting the original speaker, clear the override
    const override = value === segment.speaker ? null : value;
    onSegmentUpdate?.(segment.index, { speaker_override: override ?? segment.speaker });
  }

  function handleExcludedToggle(e: React.MouseEvent, segment: Segment) {
    e.stopPropagation();
    onSegmentUpdate?.(segment.index, { excluded: !segment.excluded });
  }

  return (
    <div className="segment-list" role="list">
      {sortedSegments.map((segment) => {
        const isActive = activeSegmentIndex === segment.index;
        const isEdited = segment.edited_text !== null;
        const isEditing = editingIndex === segment.index;
        const displayText = segment.edited_text ?? segment.text;
        const effectiveSpeaker = segment.speaker_override ?? segment.speaker;
        const speakerColor = getSpeakerColor(effectiveSpeaker, speakerColorMap);
        const isExcluded = segment.excluded;

        return (
          <div
            key={segment.index}
            className={[
              "segment-item",
              isActive && "segment-item--active",
              isEdited && "segment-item--edited",
              segment.pii_flagged && "segment-item--pii",
              isExcluded && "segment-item--excluded",
            ].filter(Boolean).join(" ")}
            role="listitem"
            data-testid={`segment-${segment.index}`}
            onClick={() => onSegmentClick?.(segment)}
          >
            <div className="segment-header">
              <select
                className="segment-speaker-select"
                value={effectiveSpeaker}
                onChange={(e) => handleSpeakerChange(e, segment)}
                onClick={(e) => e.stopPropagation()}
                aria-label={`Change speaker for segment ${segment.index}`}
                data-testid={`segment-speaker-select-${segment.index}`}
                style={{ color: speakerColor }}
              >
                {speakerOptions.map((spk) => (
                  <option key={spk} value={spk}>
                    {spk}
                  </option>
                ))}
              </select>
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
              {isExcluded && (
                <span
                  className="segment-excluded-badge"
                  data-testid={`segment-excluded-badge-${segment.index}`}
                >
                  excluded
                </span>
              )}
              <div className="segment-actions">
                <button
                  className={`segment-exclude-btn${isExcluded ? " segment-exclude-btn--active" : ""}`}
                  data-testid={`segment-exclude-btn-${segment.index}`}
                  aria-label={`${isExcluded ? "Include" : "Exclude"} segment ${segment.index}`}
                  aria-pressed={isExcluded}
                  onClick={(e) => handleExcludedToggle(e, segment)}
                >
                  {isExcluded ? "Include" : "Don't use"}
                </button>
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
                className={`segment-text${isExcluded ? " segment-text--excluded" : ""}`}
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
