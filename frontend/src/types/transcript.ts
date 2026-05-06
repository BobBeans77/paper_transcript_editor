export interface Segment {
  index: number;
  start: number;
  end: number;
  speaker: string;
  text: string;
  edited_text: string | null;
  pii_flagged: boolean;
  speaker_override: string | null;
  excluded: boolean;
}

export interface TranscriptMetadata {
  audio_file_name: string;
  audio_file_path: string;
  transcription_date: string;
  total_duration_seconds: number;
  model_name: string;
  device_used: string;
  status: "pending" | "processing" | "completed" | "failed";
}

export interface TranscriptData {
  id: string;
  metadata: TranscriptMetadata;
  segments: Segment[];
}

export interface SegmentUpdate {
  edited_text?: string | null;
  pii_flagged?: boolean;
  speaker_override?: string | null;
  excluded?: boolean;
}

export interface TranscriptSummary {
  id: string;
  audio_file_name: string;
  transcription_date: string;
  status: string;
  segment_count: number;
  pii_flagged_count: number;
  edited_count: number;
}
