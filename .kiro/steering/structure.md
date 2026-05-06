# Project Structure

```
├── backend/                  # Python FastAPI backend
│   ├── main.py              # App entry point, middleware, health check
│   ├── api/
│   │   └── routes.py        # All REST endpoints (upload, transcripts CRUD, audio streaming)
│   ├── models/
│   │   └── transcript.py    # Pydantic models (TranscriptData, Segment, enums)
│   ├── services/
│   │   ├── transcription.py # WhisperX pipeline orchestration
│   │   ├── store.py         # Filesystem JSON persistence layer
│   │   └── device.py        # GPU/CPU detection utility
│   ├── tests/               # pytest test suite
│   └── pyproject.toml       # Python project config and dependencies
│
├── frontend/                 # React TypeScript frontend
│   ├── src/
│   │   ├── App.tsx          # Root component, view routing (list vs review)
│   │   ├── main.tsx         # React DOM entry point
│   │   ├── api/
│   │   │   └── client.ts   # API client functions (fetch-based, no external HTTP lib)
│   │   ├── components/
│   │   │   ├── Upload.tsx        # File upload with status polling
│   │   │   ├── TranscriptList.tsx # Transcript listing view
│   │   │   ├── SegmentList.tsx    # Segment-by-segment review
│   │   │   └── AudioPlayer.tsx    # Audio playback with seeking
│   │   ├── hooks/
│   │   │   ├── useActiveSegment.ts      # Tracks which segment matches current playback time
│   │   │   └── useTranscriptionStatus.ts # Polls transcription status
│   │   └── types/
│   │       └── transcript.ts # TypeScript interfaces mirroring backend models
│   ├── package.json
│   ├── vite.config.ts
│   └── vitest.config.ts
│
└── README.md
```

## Architecture Patterns

- **Backend**: Layered architecture — routes → services → models. Routes handle HTTP concerns, services contain business logic, models define data shapes.
- **Frontend**: Component-based with custom hooks for stateful logic. State lives in App.tsx and flows down via props. No state management library.
- **API Communication**: Frontend uses a thin `client.ts` wrapper around fetch. All endpoints are under `/api`. Vite proxies to backend in dev.
- **Data Flow**: Upload → background transcription → poll status → load transcript → review segments.
- **Persistence**: JSON files on disk, one per transcript. No database. TranscriptStore handles all read/write.
- **Testing**: Co-located test files (backend: `tests/` directory, frontend: `.test.ts` / `.test.tsx` next to source). Both use property-based testing libraries.
