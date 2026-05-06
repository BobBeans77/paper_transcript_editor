# Product Overview

WhisperX Transcription Review is a local audio transcription and review tool. Users upload audio files, which are transcribed using the WhisperX ML pipeline (with optional speaker diarization), then review transcripts segment-by-segment in a browser UI.

## Core Capabilities

- Audio file upload (WAV, MP3, FLAC, M4A) with async background transcription
- Segment-level transcript review with synchronized audio playback and seeking
- Inline segment editing (correcting transcription text)
- PII flagging on individual segments
- Speaker diarization (when HF_TOKEN is configured)
- Transcript listing with summary stats (segment count, PII flags, edit count)

## Key Concepts

- **Transcript**: A complete transcription result containing metadata and an ordered list of segments
- **Segment**: A time-bounded piece of speech attributed to a speaker, with start/end timestamps
- **PII Flag**: A boolean marker indicating a segment contains personally identifiable information
- **Edited Text**: An optional corrected version of the original transcription text
