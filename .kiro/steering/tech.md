# Tech Stack

## Backend

- **Language**: Python 3.10+
- **Framework**: FastAPI with Uvicorn
- **Data Validation**: Pydantic v2 (model_dump, model_validate)
- **ML Pipeline**: WhisperX (wraps faster-whisper / ctranslate2), PyTorch
- **Storage**: Filesystem-based JSON files (no database)
- **Async**: Background tasks via FastAPI's BackgroundTasks

## Frontend

- **Language**: TypeScript (strict mode)
- **Framework**: React 18 with functional components and hooks
- **Build Tool**: Vite 5
- **Module System**: ESM (`"type": "module"`)

## Testing

- **Backend**: pytest with pytest-asyncio, Hypothesis (property-based testing), httpx for async HTTP
- **Frontend**: Vitest with jsdom environment, @testing-library/react, fast-check (property-based testing)

## Common Commands

```bash
# Backend
cd backend
pip install -e ".[dev]"              # Install with dev dependencies
uvicorn main:app --reload --port 8000  # Run dev server
python -m pytest tests/ -v           # Run tests

# Frontend
cd frontend
npm install                          # Install dependencies
npm run dev                          # Run dev server (port 5173)
npm run build                        # Type-check and build for production
npm test                             # Run tests (vitest --run, single pass)
```

## Dev Environment

- Backend runs on port 8000, frontend on port 5173
- Vite proxies `/api` requests to the backend
- CORS configured for localhost:5173 and localhost:3000
- Environment variables: HF_TOKEN, MAX_UPLOAD_SIZE_MB, AUDIO_FILES_DIR, TRANSCRIPTS_DIR
