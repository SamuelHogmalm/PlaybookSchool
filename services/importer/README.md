# PlayLab Importer Service

Standalone FastAPI service for the playbook import pipeline.

| Stage | Endpoint | What it does |
|-------|----------|--------------|
| 1 | `POST /parse` | FastDraw PDF → positions + frame crops (no AI) |
| 2 | `POST /interpret` | Frame crops → actions + beat notes (Claude vision) |

Deploy to **Railway** or **Render** (needs `poppler-utils`). Do not run on Vercel.

## Local setup

### 1. Install poppler (required for `/parse`)

**Windows:** install [poppler for Windows](https://github.com/osber/poppler-windows/releases) and add `pdftoppm` to your PATH.

**macOS:** `brew install poppler`

**Linux:** `sudo apt install poppler-utils`

### 2. Python env

```bash
cd services/importer
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS/Linux
pip install -r requirements.txt
cp .env.example .env
```

Add your Anthropic key to `.env`:

```
ANTHROPIC_API_KEY=sk-ant-...
```

### 3. Run

```bash
uvicorn main:app --reload --port 8000
```

Health check: http://localhost:8000/health

## API

### `GET /health`

Returns `{ status, anthropic_configured }`.

### `POST /parse`

Multipart upload: `file` = PDF (max 25MB, 100 pages).

```bash
curl -X POST http://localhost:8000/parse \
  -F "file=@your-playbook.pdf"
```

Response:

```json
{
  "plays": [ { "name": "Alabama", "beats": [...], "category": "Set", "counters": [] } ],
  "crops": { "Alabama_beat1": "<base64 png>", ... },
  "meta": { "play_count": 12, "beat_count": 36, "page_count": 4 }
}
```

Returns `422 unsupported_format` if no FastDraw courts are detected.

### `POST /interpret`

Send the `/parse` response (or equivalent):

```bash
curl -X POST http://localhost:8000/interpret \
  -H "Content-Type: application/json" \
  -d @parse-result.json
```

Body:

```json
{
  "plays": [ ... ],
  "crops": { "Alabama_beat1": "..." }
}
```

Response merges `actions` and `note` into each beat. Beats with low confidence or parse failures get `needs_review: true` and empty actions.

```json
{
  "plays": [ ... ],
  "usage": { "input_tokens": 12000, "output_tokens": 800 },
  "needs_review": [ { "play": "Alabama", "beat_id": "b2", "reason": "low_confidence" } ],
  "model": "claude-sonnet-4-20250514"
}
```

## Test interpret on one frame

With a PNG crop and beat positions from `plays.json`:

```bash
python test_interpret.py path/to/frame.png
```

## Docker

```bash
docker build -t playlab-importer .
docker run -p 8000:8000 -e ANTHROPIC_API_KEY=sk-ant-... playlab-importer
```

## Cost notes

- `/parse` is free (deterministic Python).
- `/interpret` calls Claude once per beat (~$0.01–0.03 per frame depending on model).
- Task 5 in the import spec adds a $2 hard cap before running stage 2 in production.
