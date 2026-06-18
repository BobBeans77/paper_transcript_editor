# Transcript JSON Schema

Each transcript is stored as a single JSON file at `transcripts/{transcript_id}.json`.

## Top-level structure

```json
{
  "id": "uuid-string",
  "metadata": { ... },
  "segments": [ ... ]
}
```

## Metadata

| Field | Type | Description |
|-------|------|-------------|
| `audio_file_name` | string | Original uploaded filename (e.g. `"interview.wav"`) |
| `audio_file_path` | string | Path to the audio file on disk |
| `transcription_date` | string (ISO 8601) | When the transcription was created |
| `total_duration_seconds` | float | Total audio duration in seconds |
| `model_name` | string | WhisperX model used (e.g. `"large-v2"`) |
| `device_used` | string | Compute device (`"cuda"`, `"mps"`, or `"cpu"`) |
| `status` | string | One of: `"pending"`, `"processing"`, `"completed"`, `"failed"` |
| `accent` | string \| null | Regional accent tag, or null if not set. One of: `"Birmingham"`, `"Northern"`, `"Yorkshire"`, `"Wales"`, `"Southern"` |

## Segment

| Field | Type | Description |
|-------|------|-------------|
| `index` | int | Zero-based position in the segment list |
| `start` | float | Start time in seconds |
| `end` | float | End time in seconds |
| `speaker` | string | Original diarized speaker ID (e.g. `"SPEAKER_00"`) |
| `text` | string | Original transcribed text |
| `edited_text` | string \| null | User-corrected text, or null if unedited |
| `pii_flagged` | bool | Whether the segment contains PII |
| `speaker_override` | string \| null | Manually reassigned speaker (e.g. `"SPEAKER_01"`, `"MULTIPLE"`), or null if unchanged |
| `excluded` | bool | Whether the segment is marked as "don't use" |

## Full example

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "metadata": {
    "audio_file_name": "interview.wav",
    "audio_file_path": "audio_files/a1b2c3d4-e5f6-7890-abcd-ef1234567890/interview.wav",
    "transcription_date": "2025-03-15T14:30:00.000000",
    "total_duration_seconds": 342.5,
    "model_name": "large-v2",
    "device_used": "cuda",
    "status": "completed",
    "accent": "Yorkshire"
  },
  "segments": [
    {
      "index": 0,
      "start": 0.0,
      "end": 4.5,
      "speaker": "SPEAKER_00",
      "text": "Hello, my name is John Smith.",
      "edited_text": "Hello, my name is [REDACTED].",
      "pii_flagged": true,
      "speaker_override": null,
      "excluded": false
    },
    {
      "index": 1,
      "start": 4.5,
      "end": 9.2,
      "speaker": "SPEAKER_01",
      "text": "Nice to meet you.",
      "edited_text": null,
      "pii_flagged": false,
      "speaker_override": null,
      "excluded": false
    },
    {
      "index": 2,
      "start": 9.2,
      "end": 12.8,
      "speaker": "SPEAKER_00",
      "text": "[crosstalk]",
      "edited_text": null,
      "pii_flagged": false,
      "speaker_override": "MULTIPLE",
      "excluded": true
    }
  ]
}
```

## Notes

- `speaker_override` of `"MULTIPLE"` indicates both/all speakers are talking in that segment.
- When `excluded` is `true`, the segment should be ignored by downstream processing.
- The effective speaker for display is `speaker_override ?? speaker`.
- The effective text for display is `edited_text ?? text`.
