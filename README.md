# WhisperX Transcription Review

A local audio transcription and review tool using WhisperX for transcription/diarization and a React/TypeScript frontend for segment-by-segment review.

## Prerequisites

- Python 3.10+
- Node.js 18+
- ffmpeg (`brew install ffmpeg` on macOS, `choco install ffmpeg` on Windows)
- (Optional) Hugging Face token for speaker diarization

## Setup

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows
pip install -e ".[dev]"
```

### Frontend

```bash
cd frontend
npm install
```

## Running

### Start the backend

```bash
cd backend
uvicorn main:app --reload --port 8000
```

### Start the frontend (separate terminal)

```bash
cd frontend
npm run dev
```

Open http://localhost:5173 in your browser.

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `HF_TOKEN` | (none) | Hugging Face token for speaker diarization |
| `MAX_UPLOAD_SIZE_MB` | 500 | Maximum upload file size in MB |
| `AUDIO_FILES_DIR` | `audio_files` | Directory for uploaded audio files |
| `TRANSCRIPTS_DIR` | `transcripts` | Directory for transcript JSON files |

## Speaker Diarization

To enable speaker diarization (identifying who said what):

1. Create a Hugging Face account at https://huggingface.co
2. Accept the terms for [pyannote/speaker-diarization-3.1](https://huggingface.co/pyannote/speaker-diarization-3.1)
3. Create a token at https://huggingface.co/settings/tokens
4. Set it before running: `export HF_TOKEN="your_token_here"`

Without the token, transcription still works but all segments will be attributed to a single speaker.

## Hardware Notes

- **CUDA GPU (recommended)**: Auto-detected, uses float16 for fast inference
- **Apple Silicon (MPS)**: Falls back to CPU for whisper model (ctranslate2 doesn't support MPS)
- **CPU only**: Works but significantly slower, especially for large-v2 model

The `large-v2` model requires ~10GB RAM. On machines with 16GB or less, consider using a smaller model by editing `backend/services/transcription.py` and changing `model_name` to `"base"` or `"small"`.

## Running Tests

```bash
# Backend
cd backend
python -m pytest tests/ -v

# Frontend
cd frontend
npm test
```
