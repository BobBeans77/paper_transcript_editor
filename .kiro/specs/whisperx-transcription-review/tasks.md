# Implementation Plan: WhisperX Transcription Review

## Overview

This plan implements a local audio transcription and review tool using a Python/FastAPI backend with WhisperX for transcription/diarization and a React/TypeScript frontend for segment-by-segment review. Tasks are ordered to build foundational components first (data models, storage, device detection), then the transcription pipeline, then the REST API, and finally the frontend UI. Each phase ends with a checkpoint.

## Tasks

- [x] 1. Set up project structure and dependencies
  - [x] 1.1 Create backend project structure with FastAPI
    - Create directory layout: `backend/api/`, `backend/services/`, `backend/models/`, `backend/tests/`
    - Create `pyproject.toml` or `requirements.txt` with dependencies: fastapi, uvicorn, pydantic, whisperx, torch, python-multipart, hypothesis, pytest
    - Create `backend/main.py` with FastAPI app initialization
    - _Requirements: 2.1_

  - [x] 1.2 Create frontend project structure with React and TypeScript
    - Initialize React project with TypeScript using Vite
    - Install dependencies: react, react-dom, typescript, vitest, fast-check, @testing-library/react
    - Create directory layout: `frontend/src/components/`, `frontend/src/api/`, `frontend/src/types/`, `frontend/src/tests/`
    - _Requirements: 3.1_

  - [x] 1.3 Define shared data models
    - Create `backend/models/transcript.py` with Pydantic models: `Segment`, `TranscriptMetadata`, `TranscriptData`, `SegmentUpdate`, `TranscriptSummary`, `TranscriptionStatus`
    - Create `frontend/src/types/transcript.ts` with TypeScript interfaces: `Segment`, `TranscriptMetadata`, `TranscriptData`, `SegmentUpdate`, `TranscriptSummary`
    - _Requirements: 6.2, 6.3_

  - [ ]* 1.4 Write property test for transcript JSON structural completeness
    - **Property 7: Transcript JSON structural completeness**
    - **Validates: Requirements 6.2, 6.3**
    - Use Hypothesis to generate arbitrary `TranscriptData` objects and verify serialized JSON contains all required metadata and segment fields

  - [ ]* 1.5 Write property test for transcript serialization round-trip
    - **Property 8: Transcript serialization round-trip**
    - **Validates: Requirements 6.5, 6.4, 8.1**
    - Use Hypothesis to generate arbitrary `TranscriptData` objects, serialize to JSON, deserialize, and verify equivalence

- [x] 2. Implement device detection and transcription service
  - [x] 2.1 Implement device detector
    - Create `backend/services/device.py` with `detect_compute_device()` function
    - Implement CUDA detection via `torch.cuda.is_available()`
    - Implement MPS detection via `torch.backends.mps.is_available()`
    - Implement CPU fallback with warning message
    - Return tuple of (device_name, description)
    - _Requirements: 2.6, 2.7, 2.8_

  - [ ]* 2.2 Write unit tests for device detection
    - Mock torch backends to test CUDA, MPS, and CPU fallback paths
    - Verify correct device string and description returned for each scenario
    - _Requirements: 2.6, 2.7, 2.8_

  - [x] 2.3 Implement transcription service
    - Create `backend/services/transcription.py` with `TranscriptionService` class
    - Implement `transcribe()` method: load WhisperX model, transcribe audio, align timestamps, run diarization
    - Assign unique speaker identifiers (SPEAKER_00, SPEAKER_01, etc.)
    - Associate start/end timestamps with each segment
    - Handle WhisperX failures with descriptive error messages
    - Use detected device for model loading
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ]* 2.4 Write property test for segment timestamp invariant
    - **Property 2: Segment timestamp invariant**
    - **Validates: Requirements 2.3, 2.4**
    - Use Hypothesis to generate segment lists and verify: start >= 0, end > start, unique speaker IDs are consistent

- [x] 3. Implement transcript store
  - [x] 3.1 Implement transcript store service
    - Create `backend/services/store.py` with `TranscriptStore` class
    - Implement `save()`: serialize TranscriptData to JSON file in storage directory
    - Implement `load()`: deserialize JSON file to TranscriptData
    - Implement `list_all()`: scan storage directory and return TranscriptSummary list
    - Implement `update_segment()`: load transcript, update specific segment fields, save back
    - Create storage directories on initialization if they don't exist
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 8.1, 8.3_

  - [ ]* 3.2 Write property test for PII and edit persistence round-trip
    - **Property 9: PII and edit persistence round-trip**
    - **Validates: Requirements 4.4, 4.5, 5.3**
    - Use Hypothesis to generate segments with arbitrary pii_flagged and edited_text values, save and reload, verify preservation

  - [ ]* 3.3 Write unit tests for transcript store
    - Test save and load with valid transcript data
    - Test list_all returns correct summaries
    - Test update_segment modifies only the targeted segment
    - Test error handling for missing files and corrupt JSON
    - _Requirements: 6.1, 6.4, 8.1, 8.3_

- [x] 4. Checkpoint - Backend services
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement REST API layer
  - [x] 5.1 Implement upload endpoint
    - Create `backend/api/routes.py` with FastAPI router
    - Implement `POST /api/upload`: validate file format and size, save audio file, generate transcript_id, start async transcription, return 202 with transcript_id
    - Validate file extensions against {wav, mp3, flac, m4a}
    - Enforce maximum file size limit with configurable threshold
    - Return appropriate error responses for invalid format (400) and oversized files (413)
    - _Requirements: 1.2, 1.3, 1.4_

  - [ ]* 5.2 Write property test for unsupported format rejection
    - **Property 1: Unsupported format rejection**
    - **Validates: Requirements 1.3**
    - Use Hypothesis to generate file names with extensions not in {wav, mp3, flac, m4a} and verify rejection with correct error message

  - [x] 5.3 Implement transcript CRUD endpoints
    - Implement `GET /api/transcripts`: return list of all transcript summaries
    - Implement `GET /api/transcripts/{id}`: return full transcript with segments
    - Implement `GET /api/transcripts/{id}/status`: return transcription status
    - Implement `PUT /api/transcripts/{id}`: update segment edits and PII flags
    - Handle not-found (404) and invalid segment index (400) errors
    - _Requirements: 6.4, 8.1, 8.2, 8.3, 8.4_

  - [x] 5.4 Implement audio streaming endpoint
    - Implement `GET /api/transcripts/{id}/audio`: stream audio file with proper content-type headers
    - Support range requests for seeking
    - Handle missing audio file (404)
    - _Requirements: 7.1_

  - [ ]* 5.5 Write integration tests for API endpoints
    - Test upload with valid and invalid files
    - Test transcript retrieval and update flow
    - Test audio streaming with range requests
    - Test error responses for all error scenarios
    - _Requirements: 1.2, 1.3, 1.4, 6.4, 8.1_

- [x] 6. Checkpoint - Backend API complete
  - Ensure all tests pass, ask the user if questions arise.

- [-] 7. Implement frontend API client and state management
  - [x] 7.1 Create API client module
    - Create `frontend/src/api/client.ts` with functions for all backend endpoints
    - Implement `uploadAudio(file: File)`: POST to /api/upload
    - Implement `getTranscripts()`: GET /api/transcripts
    - Implement `getTranscript(id: string)`: GET /api/transcripts/{id}
    - Implement `getTranscriptStatus(id: string)`: GET /api/transcripts/{id}/status
    - Implement `updateSegment(id: string, index: number, update: SegmentUpdate)`: PUT /api/transcripts/{id}
    - Implement `getAudioUrl(id: string)`: construct audio streaming URL
    - _Requirements: 1.2, 6.4, 8.1_

  - [x] 7.2 Implement polling logic for transcription status
    - Create a hook or utility that polls `/api/transcripts/{id}/status` until status is "completed" or "failed"
    - Handle transition from progress indicator to segment display
    - _Requirements: 1.5, 2.5_

- [x] 8. Implement Upload component
  - [x] 8.1 Create Upload component with file picker
    - Create `frontend/src/components/Upload.tsx`
    - Implement file picker with drag-and-drop support
    - Display file name and size before submission
    - Validate file format client-side (WAV, MP3, FLAC, M4A)
    - Show progress indicator during upload and transcription
    - Display error messages from backend on failure
    - _Requirements: 1.1, 1.2, 1.3, 1.5_

  - [ ]* 8.2 Write unit tests for Upload component
    - Test file name and size display
    - Test format validation feedback
    - Test progress indicator visibility
    - Test error message display
    - _Requirements: 1.1, 1.3, 1.5_

- [x] 9. Implement Segment List component
  - [x] 9.1 Create Segment List component
    - Create `frontend/src/components/SegmentList.tsx`
    - Render segments in chronological order by start timestamp
    - Display speaker identifier, start/end timestamps, and text for each segment
    - Apply color coding per speaker (assign consistent colors to speaker IDs)
    - Display edited_text when present, otherwise display original text
    - Show visual indicator for edited segments
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 5.2, 5.4_

  - [x] 9.2 Implement PII flagging controls
    - Add toggle control on each segment for PII flagging
    - Show visual PII indicator when segment is flagged
    - Remove visual indicator when PII flag is deactivated
    - Persist PII flag changes via API
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 9.3 Implement segment text editing
    - Add edit button/control on each segment
    - Enable inline text editing mode
    - Display updated text in place of original after save
    - Persist edited text via API (store both original and edited)
    - Implement "revert to original" action
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ]* 9.4 Write property tests for segment display
    - **Property 3: Segment display completeness**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
    - Use fast-check to generate arbitrary segment arrays and verify rendering order, presence of all fields, and speaker distinction

  - [ ]* 9.5 Write property test for PII flag visual-state consistency
    - **Property 4: PII flag visual-state consistency**
    - **Validates: Requirements 4.2, 4.3**
    - Use fast-check to generate segments with arbitrary pii_flagged values and verify visual indicator matches state

  - [ ]* 9.6 Write property test for segment edit display and indicator
    - **Property 5: Segment edit display and indicator**
    - **Validates: Requirements 5.2, 5.4**
    - Use fast-check to generate segments with arbitrary edited_text values and verify correct text display and edit indicator

  - [ ]* 9.7 Write property test for edit revert
    - **Property 6: Edit revert restores original**
    - **Validates: Requirements 5.5**
    - Use fast-check to generate segments with non-null edited_text, simulate revert, verify original text restored and edited_text set to null

- [x] 10. Checkpoint - Segment list and editing
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Implement Audio Player component
  - [x] 11.1 Create Audio Player component
    - Create `frontend/src/components/AudioPlayer.tsx`
    - Render HTML5 audio element with custom controls
    - Implement playback speed selector (1x, 1.5x, 2x) without pitch alteration
    - Display current playback position
    - _Requirements: 7.1, 7.3, 7.4, 7.5_

  - [x] 11.2 Implement segment-click seeking and active highlighting
    - When a segment is clicked, seek audio to segment's start timestamp
    - Track current playback position and determine active segment
    - Highlight the segment whose time range contains the current playback position
    - _Requirements: 7.2, 7.6_

  - [ ]* 11.3 Write property test for segment click seeking
    - **Property 10: Segment click seeks to correct time**
    - **Validates: Requirements 7.2**
    - Use fast-check to generate segments with arbitrary timestamps, simulate click, verify audio position set to segment start

  - [ ]* 11.4 Write property test for active segment highlighting
    - **Property 11: Active segment highlighting matches playback position**
    - **Validates: Requirements 7.6**
    - Use fast-check to generate segments and arbitrary playback positions, verify exactly one segment highlighted whose range contains the position

- [-] 12. Implement Transcript List component
  - [x] 12.1 Create Transcript List component
    - Create `frontend/src/components/TranscriptList.tsx`
    - Fetch and display all stored transcripts
    - Show file name, transcription date, and review status for each
    - Implement click-to-load for opening a transcript in review mode
    - _Requirements: 8.2, 8.3, 8.4_

  - [ ]* 12.2 Write property test for transcript list display
    - **Property 12: Transcript list displays required fields**
    - **Validates: Requirements 8.4**
    - Use fast-check to generate arbitrary transcript summaries and verify rendered output includes file name, date, and status

- [x] 13. Wire components together and implement main app layout
  - [x] 13.1 Create main App component and routing
    - Create `frontend/src/App.tsx` with main layout
    - Implement view routing: transcript list view vs. review view
    - Wire Upload component to trigger transcription flow
    - Wire Transcript List to load selected transcript into review view
    - Wire Segment List with Audio Player (segment click → seek, playback → highlight)
    - Ensure save operations persist all edits and PII flags
    - _Requirements: 1.1, 1.5, 3.1, 7.2, 7.6, 8.2_

  - [ ]* 13.2 Write integration tests for main app flows
    - Test upload → transcription → review flow (with mocked backend)
    - Test load existing transcript → edit → save flow
    - Test audio playback interaction with segment highlighting
    - _Requirements: 1.1, 1.5, 5.2, 7.2, 8.2_

- [x] 14. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Python property tests use Hypothesis; TypeScript property tests use fast-check
- The backend uses Python/FastAPI; the frontend uses React/TypeScript with Vite
- WhisperX model loading and inference should be mocked in integration tests for speed
