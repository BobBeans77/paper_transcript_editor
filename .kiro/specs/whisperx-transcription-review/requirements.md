# Requirements Document

## Introduction

This feature enables a user to upload audio files, transcribe and diarize them using a local WhisperX model, and review the output segment-by-segment in a dedicated UI. The reviewer can flag segments containing Personally Identifiable Information (PII) and edit transcription errors. The final transcript is stored as a JSON file that includes timestamps, speaker identification, PII flags, and any edits made by the reviewer. This is a single-user local tool with no authentication requirements. The review UI includes audio playback with segment-level seeking and variable speed controls to facilitate efficient review.

## Glossary

- **Transcription_Service**: The backend component that receives audio files and invokes the local WhisperX model to produce transcriptions with diarization.
- **Review_UI**: The frontend interface that displays transcription segments and provides editing and flagging controls.
- **Segment**: A contiguous portion of the transcription associated with a single speaker, bounded by start and end timestamps.
- **PII_Flag**: A boolean marker on a segment indicating that the reviewer has identified it as containing Personally Identifiable Information.
- **Transcript_Store**: The backend component responsible for persisting and retrieving transcript JSON files.
- **WhisperX**: A local speech recognition model that performs transcription and speaker diarization.
- **Diarization**: The process of identifying and labeling distinct speakers within an audio recording.

## Requirements

### Requirement 1: Audio File Upload

**User Story:** As a reviewer, I want to upload an audio file, so that it can be transcribed and diarized for review.

#### Acceptance Criteria

1. WHEN a user selects an audio file for upload, THE Review_UI SHALL display the file name and size before submission.
2. WHEN a user submits an audio file, THE Transcription_Service SHALL accept files in WAV, MP3, FLAC, and M4A formats.
3. IF a user submits a file in an unsupported format, THEN THE Transcription_Service SHALL return an error message specifying the supported formats.
4. IF a user submits a file that exceeds the maximum allowed size, THEN THE Transcription_Service SHALL return an error message specifying the maximum file size.
5. WHEN an audio file is successfully uploaded, THE Review_UI SHALL display a progress indicator until transcription is complete.

### Requirement 2: Transcription and Diarization

**User Story:** As a reviewer, I want the uploaded audio to be transcribed and diarized by WhisperX, so that I receive speaker-labeled text segments with timestamps.

#### Acceptance Criteria

1. WHEN an audio file is uploaded, THE Transcription_Service SHALL invoke the local WhisperX model to produce a transcription.
2. WHEN an audio file is uploaded, THE Transcription_Service SHALL invoke the local WhisperX model to produce speaker diarization.
3. THE Transcription_Service SHALL assign a unique speaker identifier to each distinct speaker detected in the audio.
4. THE Transcription_Service SHALL associate a start timestamp and an end timestamp with each segment.
5. IF the WhisperX model fails to process the audio file, THEN THE Transcription_Service SHALL return an error message describing the failure reason.
6. THE Transcription_Service SHALL support execution on macOS with Apple Silicon (M4) using MPS acceleration.
7. THE Transcription_Service SHALL support execution on Windows with NVIDIA GPUs using CUDA acceleration.
8. IF no GPU is available, THEN THE Transcription_Service SHALL fall back to CPU-based processing and inform the user that processing may be slower.

### Requirement 3: Segment-by-Segment Display

**User Story:** As a reviewer, I want to see the transcription displayed segment-by-segment, so that I can efficiently review each portion of the transcript.

#### Acceptance Criteria

1. WHEN transcription is complete, THE Review_UI SHALL display each segment in chronological order.
2. THE Review_UI SHALL display the speaker identifier for each segment.
3. THE Review_UI SHALL display the start timestamp and end timestamp for each segment.
4. THE Review_UI SHALL display the transcribed text for each segment.
5. THE Review_UI SHALL visually distinguish segments from different speakers using color coding or labels.

### Requirement 4: PII Flagging

**User Story:** As a reviewer, I want to flag segments that contain PII, so that sensitive information can be identified and handled appropriately.

#### Acceptance Criteria

1. THE Review_UI SHALL provide a toggle control on each segment to mark it as containing PII.
2. WHEN a reviewer activates the PII toggle on a segment, THE Review_UI SHALL visually indicate that the segment is flagged.
3. WHEN a reviewer deactivates the PII toggle on a segment, THE Review_UI SHALL remove the visual PII indicator.
4. WHEN a reviewer flags a segment as containing PII, THE Transcript_Store SHALL persist the PII flag value as true for that segment.
5. WHEN a reviewer removes a PII flag from a segment, THE Transcript_Store SHALL persist the PII flag value as false for that segment.

### Requirement 5: Segment Text Editing

**User Story:** As a reviewer, I want to edit the text of a segment, so that I can correct transcription errors.

#### Acceptance Criteria

1. THE Review_UI SHALL provide an edit control on each segment to enable text modification.
2. WHEN a reviewer modifies the text of a segment, THE Review_UI SHALL display the updated text in place of the original.
3. WHEN a reviewer saves an edited segment, THE Transcript_Store SHALL persist both the original text and the edited text for that segment.
4. THE Review_UI SHALL visually indicate which segments have been edited.
5. WHEN a reviewer edits a segment, THE Review_UI SHALL allow the reviewer to revert to the original text.

### Requirement 6: JSON Transcript Storage

**User Story:** As a system operator, I want the transcript stored as a structured JSON file, so that downstream processes can consume the transcript data programmatically.

#### Acceptance Criteria

1. WHEN a transcription is complete, THE Transcript_Store SHALL persist the transcript as a JSON file.
2. THE Transcript_Store SHALL include the following fields for each segment in the JSON: start timestamp, end timestamp, speaker identifier, transcribed text, PII flag, and edited text.
3. THE Transcript_Store SHALL include metadata in the JSON file containing the original audio file name, transcription date, and total duration.
4. WHEN a reviewer saves changes, THE Transcript_Store SHALL update the JSON file to reflect the current state of all segments.
5. FOR ALL valid Transcript JSON files, parsing then serializing then parsing SHALL produce an equivalent object (round-trip property).

### Requirement 7: Audio Playback

**User Story:** As a reviewer, I want to play back the audio while reviewing the transcript, so that I can verify transcription accuracy by listening to the original recording.

#### Acceptance Criteria

1. WHEN a transcript is loaded, THE Review_UI SHALL display an audio player control for the uploaded audio file.
2. WHEN a reviewer clicks on a segment, THE Review_UI SHALL seek the audio playback to the start timestamp of that segment.
3. THE Review_UI SHALL provide playback speed controls supporting 1x, 1.5x, and 2x speeds.
4. WHEN a reviewer selects a playback speed, THE Review_UI SHALL adjust audio playback to the selected speed without altering pitch.
5. THE Review_UI SHALL display the current playback position relative to the transcript segments.
6. WHILE audio is playing, THE Review_UI SHALL visually highlight the segment corresponding to the current playback position.

### Requirement 8: Transcript Persistence and Retrieval

**User Story:** As a reviewer, I want to save my progress and return to a transcript later, so that I can complete reviews across multiple sessions.

#### Acceptance Criteria

1. WHEN a reviewer saves changes, THE Transcript_Store SHALL persist all segment edits and PII flags immediately.
2. WHEN a reviewer opens a previously saved transcript, THE Review_UI SHALL display all segments with their current edits and PII flags.
3. THE Transcript_Store SHALL maintain a list of all stored transcripts accessible to the reviewer.
4. THE Review_UI SHALL provide a transcript list view showing file name, transcription date, and review status.
