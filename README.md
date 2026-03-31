# AI Workflow Builder

A No-Code/Low-Code platform for building intelligent AI workflows visually.


## Overview of this Project

This project is a full-stack platform that lets you visually design AI pipelines as directed node graphs and interact with them through a built-in chat interface. Each pipeline — called a **Stack** — is a sequence of typed nodes that you wire together on a drag-and-drop canvas:

- A **User Query** node captures the user's input
- A **Knowledge Base** node retrieves relevant context from your uploaded PDF documents using vector similarity search (RAG)
- A **Web Search** node fetches real-time information from Google via SerpAPI
- An **LLM Engine** node generates the final answer using Google Gemini
- An **Output** node returns the formatted response to the chat interface

Once built, every Stack becomes a persistent chatbot with full conversation history. You can build a document Q&A bot, a research assistant, a customer support agent, or any combination — without writing any pipeline code.

---

## Features

### Visual Workflow Builder
- Drag-and-drop canvas powered by React Flow
- Five node types connected by typed handles (Query, Context, Answer)
- Semantic edge labels auto-generated based on connection type
- Canvas lock mode for read-only workflow preview
- Inline stack renaming directly in the sidebar
- Real-time execution logs panel showing step-by-step progress

### Knowledge Base — RAG Pipeline
- Upload PDF documents directly from the canvas node card
- Automatic text extraction (PyMuPDF), chunking (1,000-char with 200-char overlap), and vectorization
- Three-level embedding fallback chain:
  - **Ensemble** — Gemini (384-dim) + Sentence Transformers (384-dim), averaged and L2-normalized
  - **Sentence Transformers only** — `all-MiniLM-L6-v2` local model
  - **Gemini only** — `gemini-embedding-001` at `output_dimensionality=384`
- Persistent ChromaDB vector store scoped per workflow
- Source citations with document name, page number, and excerpt returned alongside every answer

### LLM Integration
- Google Gemini 2.5 Flash as the primary model
- Automatic fallback chain: `gemini-2.5-flash` → `gemini-2.5-flash-preview-04-17` → `gemini-2.0-flash` → `gemini-1.5-flash` → **TinyLlama-1.1B** (local, offline)
- Configurable model, temperature, and custom system prompt per node
- Optional real-time web search grounding via SerpAPI (falls back to Wikipedia when no key is configured)

### Authentication
- Custom JWT-based auth — **zero third-party auth libraries**, Python stdlib only
- PBKDF2-HMAC-SHA256 with 260,000 iterations and a random 16-byte salt per user (NIST SP 800-132 compliant)
- Constant-time password comparison via `hmac.compare_digest` — prevents timing attacks
- 7-day token expiry with localStorage persistence on the client

### Security
- All user API keys (Gemini, SerpAPI) encrypted at rest with **Fernet** (AES-128-CBC + HMAC-SHA256) before being written to the database
- Per-user data isolation — every workflow endpoint verifies ownership against the authenticated JWT claim
- Ghost-edge filtering prevents execution crashes when workflows are modified after previous runs
- Cycle detection in the execution engine prevents infinite loops

### Chat Interface
- Persistent conversation history stored in SQLite, scoped per workflow
- Full history restored automatically when the chat dialog opens
- Last 10 messages sent as multi-turn context on each request
- Expandable source citation cards per assistant message

---

## Tech Stack

### Backend

| Layer | Technology |
|-------|-----------|
| Framework | FastAPI + Uvicorn |
| Database | SQLite (WAL mode, FK enforcement) |
| Vector Store | ChromaDB (persistent, embedded) |
| LLM | Google Gemini API (`google-genai`) |
| Embedding | Gemini `embedding-001` + `all-MiniLM-L6-v2` |
| LLM Fallback | TinyLlama-1.1B-Chat (HuggingFace `transformers`) |
| PDF Parsing | PyMuPDF (`fitz`) |
| Encryption | `cryptography` — Fernet |
| HTTP Client | `httpx` |
| Auth | Python stdlib only (`hashlib`, `hmac`, `base64`) |

### Frontend

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + TypeScript + Vite |
| Canvas | React Flow (`@xyflow/react`) |
| Global State | Zustand |
| Server State | TanStack React Query |
| Styling | Tailwind CSS + shadcn/ui (Radix UI) |
| Routing | React Router v6 |
| Theme | next-themes (dark / light / system) |
| Notifications | Sonner |

---

## Project Structure

```
.
├── Backend/
│   ├── main.py                        # FastAPI app, router registration, DB init on startup
│   ├── app.db                         # SQLite database — auto-created on first run
│   ├── requirements.txt
│   ├── schema.sql                     # Reference schema (Postgres/Supabase variant)
│   ├── .env                           # Environment variables (see setup below)
│   │
│   ├── api/
│   │   ├── models/
│   │   │   └── workflow.py            # Pydantic request/response models
│   │   └── routers/
│   │       ├── user.py                # POST /signup  POST /signin  GET /profile
│   │       ├── workflow.py            # Full workflow CRUD + PDF upload
│   │       ├── run.py                 # POST /execute  GET /chat-history/:id
│   │       └── kb.py                  # POST /kb/upload  GET /kb/documents
│   │
│   ├── db/
│   │   └── database.py                # SQLite connection manager + all CRUD helpers
│   │
│   ├── services/
│   │   ├── workflow_orchestrator.py   # Graph traversal execution engine
│   │   └── nodes/
│   │       ├── user_query_node.py
│   │       ├── knowledge_base_node.py
│   │       ├── llm_engine_node.py
│   │       ├── web_search_node.py
│   │       └── output_node.py
│   │
│   └── utils/
│       ├── auth_utils.py              # PBKDF2 hashing + HS256 JWT (stdlib only)
│       ├── encryption.py              # Fernet encrypt/decrypt for API keys at rest
│       ├── gemini_client.py           # Gemini generation + embedding + local fallbacks
│       ├── chroma_client.py           # Persistent ChromaDB singleton
│       ├── pdf_parser.py              # PyMuPDF text extraction
│       └── text_splitter.py           # Overlapping chunk splitter
│
└── Frontend/
    ├── index.html
    ├── vite.config.ts
    └── src/
        ├── App.tsx                    # Provider hierarchy + route definitions
        ├── main.tsx                   # React DOM entry point
        │
        ├── lib/
        │   ├── auth.tsx               # AuthContext, AuthProvider, useAuth hook
        │   ├── api.ts                 # Auth HTTP client functions
        │   └── knowledgeBase.ts       # KB upload/list HTTP client functions
        │
        ├── stores/
        │   └── workflowStore.ts       # Zustand — canvas state, save/load/execute
        │
        ├── hooks/
        │   └── useWorkflow.ts         # Workflow list CRUD hook used by StacksPage
        │
        ├── pages/
        │   ├── Auth.tsx               # Sign-in / sign-up page
        │   ├── Homepage.tsx           # Animated landing page
        │   ├── StacksPage.tsx         # Workflow grid with CRUD actions
        │   └── BuilderPage.tsx        # Canvas host page
        │
        └── components/
            ├── Header.tsx             # Nav bar — save, theme toggle, user menu
            ├── ChatDialog.tsx         # Chat interface with history + citations
            ├── CreateStackDialog.tsx  # New workflow modal
            └── workflow/
                ├── WorkflowCanvas.tsx       # React Flow canvas + execution handler
                ├── WorkflowSidebar.tsx      # Draggable node palette + stack rename
                ├── ExecutionLogsPanel.tsx   # Real-time execution log panel
                └── nodes/
                    ├── UserQueryNode.tsx
                    ├── LLMNode.tsx
                    ├── KnowledgeBaseNode.tsx
                    ├── WebSearchNode.tsx
                    └── OutputNode.tsx
```

---

## Getting Started

### Prerequisites

| Requirement | Version |
|-------------|---------|
| Python | 3.10+ |
| Node.js | 18+ |
| npm | 9+ |
| Google Gemini API Key | [Get one here](https://aistudio.google.com/app/apikey) |
| SerpAPI Key | [Get one here](https://serpapi.com) — falls back to Wikipedia if absent |

---

### Backend Setup

```bash
# 1. Navigate to the backend directory
cd Backend

# 2. Create and activate a virtual environment
python -m venv venv

# On Windows
venv\Scripts\activate

# On macOS / Linux
source venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Create your environment file and fill in the required values
cp .env.example .env

# 5. Start the development server
uvicorn main:app --reload
```

The API will be available at `http://localhost:8000`

Interactive Swagger UI docs at `http://localhost:8000/docs`

> The SQLite database (`app.db`) and ChromaDB directory (`chroma_db/`) are created automatically on first run — no migration step needed.

---

### Frontend Setup

```bash
# 1. Navigate to the frontend directory
cd Frontend

# 2. Install dependencies
npm install

# 3. Create your environment file
cp .env.example .env

# 4. Start the development server
npm run dev
```

The frontend will be available at `http://localhost:5173`

---

## Environment Variables

### Backend — `Backend/.env`

```env
# REQUIRED — Generate with:
# python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
ENCRYPTION_KEY=your_44_character_fernet_key_here

# REQUIRED — Any long random string. Generate with:
# python -c "import uuid; print(str(uuid.uuid4()))"
JWT_SECRET=your_jwt_secret_here

# OPTIONAL — ChromaDB storage path. Default: ./chroma_db
CHROMA_PERSIST_DIR=./chroma_db
```

> **Note:** Gemini and SerpAPI keys are entered per-workflow inside the node configuration UI. They are encrypted with Fernet before being stored in the database — you do not need to set them globally here.

---

### Frontend — `Frontend/.env`

```env
# REQUIRED — URL of the running backend server
VITE_BACKEND_URL=http://localhost:8000
```

---

## API Reference

All endpoints are served from `http://localhost:8000`. Protected endpoints require:

```
Authorization: Bearer <access_token>
```

### Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|:----:|-------------|
| `POST` | `/api/user/signup` | No | Register a new account |
| `POST` | `/api/user/signin` | No | Sign in and receive a JWT |
| `GET` | `/api/user/profile` | Yes | Get the authenticated user's profile |

**Request body (signup / signin):**
```json
{
  "email": "user@example.com",
  "password": "yourpassword",
  "displayName": "Your Name"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "display_name": "Your Name"
  }
}
```

---

### Workflows

| Method | Endpoint | Auth | Description |
|--------|----------|:----:|-------------|
| `POST` | `/api/workflow/create` | Yes | Create a new workflow |
| `GET` | `/api/workflow/list` | Yes | List all workflows owned by the user |
| `GET` | `/api/workflow/{id}` | Yes | Get a workflow with decrypted API keys |
| `PATCH` | `/api/workflow/update/{id}` | Yes | Update workflow graph + optional PDF upload |
| `DELETE` | `/api/workflow/{id}` | Yes | Delete workflow and all its chat history |

The update endpoint accepts `multipart/form-data` with fields: `name`, `description`, `nodes` (JSON string), `edges` (JSON string), `config` (JSON string), and optionally `document_file` (PDF) and `document_name`.

---

### Execution and Chat

| Method | Endpoint | Auth | Description |
|--------|----------|:----:|-------------|
| `POST` | `/api/execute` | No | Execute a workflow with a user query |
| `GET` | `/api/chat-history/{id}` | No | Retrieve full chat history for a workflow |

**Execute request body:**
```json
{
  "workflow_id": "550e8400-e29b-41d4-a716-446655440000",
  "user_query": "What does the document say about pricing?",
  "conversation_history": [
    { "role": "user", "content": "Tell me about the product." },
    { "role": "assistant", "content": "The product is..." }
  ]
}
```

**Execute response:**
```json
{
  "workflow_response": {
    "final_response": "According to section 3 of the document, pricing starts at..."
  },
  "chat_history": [
    { "role": "user", "message": "What does the document say about pricing?", "timestamp": "2024-01-01T12:00:00" },
    { "role": "bot", "message": "According to section 3...", "timestamp": "2024-01-01T12:00:01" }
  ]
}
```

---

### Knowledge Base

| Method | Endpoint | Auth | Description |
|--------|----------|:----:|-------------|
| `POST` | `/api/kb/upload` | Yes | Upload and index a PDF document |
| `GET` | `/api/kb/documents` | Yes | List all indexed documents for the user |

---

## How It Works

### Workflow Execution Engine

When a chat message is sent, the `WorkflowOrchestrator` on the backend:

1. **Loads** the workflow graph from SQLite and decrypts API keys in memory only — keys are never logged or persisted in plaintext
2. **Filters ghost edges** — edges pointing to nodes that no longer exist are silently skipped to prevent runtime crashes
3. **Traverses** the directed graph starting from `UserQueryNode`, executing each node in sequence
4. **Propagates** data between nodes based on the `targetHandle` of each connecting edge (`query`, `context`, `target`)
5. **Detects cycles** — a visited set prevents infinite loops
6. **Returns** the `OutputNode`'s `final_response` to the caller

```
UserQueryNode ──(query)──► KnowledgeBaseNode ──(context)──► LLMNode ──(answer)──► OutputNode
                                                                ▲
                                            WebSearchNode ──(results)──┘
```

---

### RAG Pipeline (Knowledge Base Node)

**At upload time:**

```
PDF File
  └─► PyMuPDF text extraction
        └─► Split into 1,000-char chunks (200-char overlap)
              └─► For each chunk:
                    ├─► [Level 1] Ensemble — average(Gemini 384-dim, ST 384-dim), L2-normalized
                    ├─► [Level 2] Sentence Transformers only — all-MiniLM-L6-v2
                    └─► [Level 3] Gemini only — gemini-embedding-001, dim=384
                          └─► ChromaDB — store vector + metadata (workflow_id, doc_name, chunk_index)
```

**At query time:**

```
User query
  └─► Embed with same strategy used at upload (read from chunk metadata)
        └─► ChromaDB cosine similarity search — top 5 chunks, filtered by workflow_id
              └─► Return as numbered context blocks → fed into LLM node
```

---

### Authentication Flow

```
Sign Up ──► PBKDF2-HMAC-SHA256 (260,000 iterations, random 16-byte salt)
              └─► Store salted hash in SQLite users table

Sign In ──► Re-derive hash with stored salt
              └─► hmac.compare_digest (constant-time, prevents timing attacks)
                    └─► Issue HS256 JWT { sub, email, iat, exp = 7 days }

API Request ──► Authorization: Bearer <token>
                  └─► Verify HMAC-SHA256 signature
                        └─► Check exp timestamp
                              └─► Extract user_id from sub claim
```

---

## Node Types

| Node | Role | Inputs | Outputs |
|------|------|--------|---------|
| **User Query** | Pipeline entry point | User's chat message | `query` string |
| **Knowledge Base** | RAG retrieval | `query` | `context` (top-5 similar chunks) |
| **LLM Engine** | Text generation | `query`, `context` (optional) | `response` |
| **Web Search** | Real-time search | `query` | `formatted_results` |
| **Output** | Pipeline terminal | Any upstream value | `final_response` to chat |

The Output node selects the best available upstream value in priority order:
`llm_response` > `web_search_results` > `context` > `query`

---

## Deployment

The current setup is designed for single-server deployment — SQLite and ChromaDB are embedded and co-located with the backend process.

To scale for production:

| Component | Current | Production Recommendation |
|-----------|---------|--------------------------|
| Relational DB | SQLite (`app.db`) | PostgreSQL |
| Vector DB | ChromaDB (embedded) | Pinecone, Weaviate, or hosted ChromaDB |
| Auth | Custom PBKDF2 + JWT | Keep as-is — add refresh token rotation |
| LLM | Google Gemini | Add OpenAI / Anthropic as additional providers |
| Serving | Single process | Docker + Nginx reverse proxy; frontend via CDN |

> **Before going to production:** Replace `allow_origins=["*"]` in `main.py` with your specific frontend domain.

---

## Known Limitations

- **Gemini client singleton:** The Gemini client caches the first API key used per process lifetime. In a multi-user production environment, instantiate the client per-request rather than per-process inside `utils/gemini_client.py`.
- **SQLite concurrency:** WAL mode allows concurrent reads but serializes writes. For more than a handful of simultaneous users, migrate to PostgreSQL.
- **TinyLlama speed:** The local TinyLlama fallback runs on CPU and is significantly slower than the Gemini API. It is a last-resort safety net, not a primary inference path.
- **Public execute endpoint:** `POST /api/execute` does not require authentication by design, to support embedding Stacks as public chatbots. To restrict it, add `_require_user(authorization)` at the top of the execute endpoint in `api/routers/run.py`.

---

## Contributing

Contributions are welcome and greatly appreciated.

1. Fork the repository
2. Create a feature branch

```bash
git checkout -b feature/your-feature-name
```

3. Commit your changes with a descriptive message

```bash
git commit -m "feat: add streaming response support"
```

4. Push your branch and open a Pull Request

```bash
git push origin feature/your-feature-name
```

Please open an issue first for major changes so the approach can be discussed before work begins.

---

## License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for full details.

---

## Acknowledgements

- [FastAPI](https://fastapi.tiangolo.com) — backend framework
- [React Flow](https://reactflow.dev) — workflow canvas
- [ChromaDB](https://trychroma.com) — vector store
- [Google Gemini API](https://ai.google.dev/docs) — LLM and embedding provider
- [Sentence Transformers](https://sbert.net) — local embedding model (`all-MiniLM-L6-v2`)
- [shadcn/ui](https://ui.shadcn.com) — component library
- [Lucide React](https://lucide.dev) — icon library
- [SerpAPI](https://serpapi.com/documentation) — web search integration

---

For questions or issues, open a [GitHub Issue](../../issues) or reach out at [gmail](praveen.chinna0765@gmail.com).