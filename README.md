# PromptPDF

> **Deterministic AI-Powered PDF Editing & Side-by-Side Verification Engine**  
> Built as a unified monorepo deploying seamlessly to **Vercel** with a **React (Vite) + Tailwind CSS** frontend and a **Python FastAPI** backend powered by **PyMuPDF**, **Pillow**, and **SQLAlchemy**.

---

## Architecture Overview

```
PromptPDF Monorepo
├── api/                             # Python FastAPI Serverless Backend
│   ├── routers/
│   │   ├── documents.py             # Uploads, streaming, metadata, search & image conversion
│   │   ├── edit_plans.py            # AI Edit Plan orchestration & PyMuPDF execution
│   │   └── cron.py                  # 1-Hour Auto-Destruct cleanup for Vercel Cron
│   ├── services/
│   │   ├── pdf_editor.py            # PyMuPDF redaction & coordinate text replacement
│   │   ├── image_converter.py       # Pillow EXIF auto-rotation & A4 PDF synthesis
│   │   └── llm_router.py            # OpenAI / Gemini JSON plan extractor with NLP fallback
│   ├── database.py                  # SQLAlchemy engine (Postgres/Neon/Supabase + SQLite dev)
│   ├── models.py                    # User, Document, EditJob, DocumentVersion models
│   ├── storage.py                   # Secure /tmp file handling & UUID naming
│   ├── requirements.txt             # Python dependencies
│   └── main.py                      # FastAPI application entrypoint & CORS config
├── src/                             # React (Vite) Frontend
│   ├── components/
│   │   ├── Header.jsx               # Security header with 1-hr countdown & purge trigger
│   │   ├── Workspace.jsx            # Dual-column editing workspace with approval checklist
│   │   ├── PdfViewer.jsx            # PDF.js dual-pane side-by-side diff comparison
│   │   └── ImageConverterModal.jsx  # Multi-image to A4 PDF conversion dialog
│   ├── services/api.js              # Axios client with dynamic Vercel / local URL handling
│   ├── App.jsx                      # Root container & upload state management
│   ├── index.css                    # Tailwind design system & glassmorphism tokens
│   └── main.jsx                     # Vite React entry point
├── build.sh                         # Vercel Linux build & PyMuPDF validation script
├── vercel.json                      # Vercel serverless routing & hourly cron schedule
├── package.json                     # Frontend dependencies & scripts
└── vite.config.js                   # Vite dev server with /api proxy to FastAPI
```

---

## Key Features

1. **Deterministic PyMuPDF Core**: Locates exact sub-pixel bounding boxes, applies clean redactions, and inserts replacement text matching original font size and color (with automatic Helvetica fallback warnings).
2. **Side-by-Side Diff Verification**: Never approve an edit blind. Side-by-side comparison pane synchronizes original v1 against edited vN.
3. **AI Edit Plan Checklist**: Converts natural language instructions (e.g. *"Replace agreement date with Oct 10, 2026 and redact SSN"*) into a structured JSON checklist for user confirmation before applying.
4. **Pillow Image-to-PDF Engine**: Automatically corrects EXIF mobile photo rotation, normalizes transparent PNGs to clean white background, and fits images to standard A4 pages with configurable margins.
5. **1-Hour Auto-Destruct Privacy**: Zero permanent retention. Scheduled hourly Vercel cron sweeps the `/tmp` storage directory and purges expired database records.

---

## Local Development Setup

### 1. Prerequisites
- **Node.js** (v18 or higher)
- **Python** (v3.10 or higher)

### 2. Frontend Setup
From the repository root:
```bash
# Install frontend dependencies
npm install

# Start Vite dev server on http://localhost:5173
npm run dev
```

### 3. Backend Setup
In a separate terminal window:
```bash
# Create and activate Python virtual environment
python -m venv .venv
# Windows:
.venv\Scripts\activate
# Linux/macOS:
source .venv/bin/activate

# Install backend dependencies
pip install -r api/requirements.txt

# Start FastAPI server on http://localhost:8000 with hot-reload
uvicorn api.main:app --reload --port 8000
```

> **Note:** The Vite development server is pre-configured in `vite.config.js` to proxy `/api/*` requests directly to `http://localhost:8000`, so no manual CORS proxying is required during local development.

---

## Environment Variables Configuration

Copy `.env.example` to `.env` to configure your credentials:

```bash
cp .env.example .env
```

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection string (Neon / Supabase). Falls back to local SQLite if omitted. | `postgresql://user:pass@host/db` |
| `OPENAI_API_KEY` | OpenAI API key for LLM plan generation. | `sk-proj-...` |
| `GEMINI_API_KEY` | Optional alternate Google Gemini key. | `AIza...` |
| `STORAGE_DIR` | Directory for uploaded PDFs. | `/tmp` |
| `CRON_SECRET` | Secret token required by Vercel Cron. | `your_secret_token` |
| `VITE_API_BASE_URL` | Optional base URL for API (leave empty for same-domain Vercel). | `""` or `http://localhost:8000` |

---

## Vercel Production Deployment

PromptPDF is structured for 1-click deployment on Vercel:

1. **Push repository** to GitHub/GitLab.
2. **Import into Vercel**:
   - Framework Preset: **Vite**
   - Build Command: `bash build.sh` (or `npm run build`)
   - Output Directory: `dist`
3. **Configure Environment Variables** in Vercel Project Settings:
   - `DATABASE_URL` (from Neon / Supabase)
   - `OPENAI_API_KEY`
   - `CRON_SECRET`
4. Deploy! Vercel will automatically route `/api/*` to the FastAPI serverless functions and schedule the hourly `/api/cron/cleanup` job.

---

## API Endpoints Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Health check & feature status |
| `POST` | `/api/documents` | Upload a PDF (multipart/form-data) |
| `GET` | `/api/documents/{id}` | Get document metadata & versions |
| `GET` | `/api/documents/{id}/file` | Stream PDF file (optional `?version=N`) |
| `GET` | `/api/documents/{id}/search` | Find text occurrences & bounding boxes |
| `POST` | `/api/documents/convert-images` | Convert images to unified A4 PDF |
| `POST` | `/api/edit-plans/{id}` | Generate AI edit plan from prompt |
| `POST` | `/api/edit-plans/{id}/apply` | Atomically apply approved edit plan |
| `DELETE` | `/api/cron/cleanup` | Hourly auto-destruct storage sweep |

---

## License
MIT
