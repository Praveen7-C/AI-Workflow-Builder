# AI Workflow Builder
 
A no-code/low-code platform for building intelligent AI workflows visually — powered by FastAPI, React, Google Gemini, ChromaDB, and Supabase (PostgreSQL).
 
---
 
## Overview
 
AI Workflow Builder lets you design AI pipelines as directed node graphs and interact with them through a built-in chat interface. Each pipeline — called a **Stack** — is a sequence of typed nodes you wire together on a drag-and-drop canvas:
 
- A **User Query** node captures the user's input
- A **Knowledge Base** node retrieves relevant context from uploaded PDF documents using vector similarity search (RAG)
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
- Custom JWT-based auth built on Python stdlib only — zero third-party auth libraries
- PBKDF2-HMAC-SHA256 with 260,000 iterations and a random 16-byte salt per user (NIST SP 800-132 compliant)
- Constant-time password comparison via `hmac.compare_digest` — prevents timing attacks
- 7-day token expiry with localStorage persistence on the client
- Google OAuth 2.0 sign-in with avatar and display name sync
 
### Security
- All user API keys (Gemini, SerpAPI) encrypted at rest with Fernet (AES-128-CBC + HMAC-SHA256) before being written to Supabase
- Per-user data isolation — every workflow endpoint verifies ownership against the authenticated JWT claim
- Ghost-edge filtering prevents execution crashes when workflows are modified after previous runs
- Cycle detection in the execution engine prevents infinite loops
- Supabase Row Level Security (RLS) enforced on all tables — service-role key used exclusively by the backend
 
### Chat Interface
- Persistent conversation history stored in Supabase (`chat_logs` table), scoped per workflow
- Full history restored automatically when the chat dialog opens
- Last 10 messages sent as multi-turn context on each request
- Expandable source citation cards per assistant message
 
### Profile and Avatar
- Edit display name and upload a custom avatar from the profile page
- Avatar images stored in a public Supabase Storage bucket (`avatars`)
- Custom avatar builder with configuration persisted in the `custom_avatars` table
 
---
 
## Tech Stack
 
### Backend
 
| Layer | Technology |
|-------|------------|
| Framework | FastAPI + Uvicorn |
| Database | Supabase (PostgreSQL) via direct async REST API (`httpx`) |
| Vector Store | ChromaDB (persistent, embedded) |
| LLM | Google Gemini API (`google-genai`) |
| Embedding | Gemini `embedding-001` + `all-MiniLM-L6-v2` |
| LLM Fallback | TinyLlama-1.1B-Chat (HuggingFace `transformers`) |
| PDF Parsing | PyMuPDF (`fitz`) |
| Encryption | `cryptography` — Fernet (AES-128-CBC + HMAC-SHA256) |
| HTTP Client | `httpx` (async) |
| Auth | Python stdlib only (`hashlib`, `hmac`, `base64`) — no third-party auth library |
 
### Frontend
 
| Layer | Technology |
|-------|------------|
| Framework | React 18 + TypeScript + Vite |
| Canvas | React Flow (`@xyflow/react`) |
| Global State | Zustand |
| Server State | TanStack React Query |
| Styling | Tailwind CSS + shadcn/ui (Radix UI) |
| Routing | React Router v6 |
| Theme | next-themes (dark / light / system) |
| Notifications | Sonner |
 
---
 
## Database Schema
 
All relational data is stored in **Supabase (PostgreSQL)**. The schema is defined in `Backend/supabase_migration.sql` and must be applied to your Supabase project before running the app. Vector embeddings are stored separately in a local **ChromaDB** instance.
 
| Table | Purpose |
|-------|---------|
| `users` | Email/password and Google OAuth accounts. Stores hashed passwords, display name, avatar URL, and auth provider. |
| `workflows` | Workflow definitions — node graph (`nodes` JSONB), edge connections (`edges` JSONB), and encrypted API config (`config` JSONB). Foreign key to `users`. |
| `chat_logs` | Every user/bot message per workflow, ordered by timestamp. Cascade-deletes when a workflow is deleted. |
| `custom_avatars` | Per-user custom avatar builder configuration and rendered avatar URL. |
| `storage.objects` | Avatar image files in the `avatars` Supabase Storage bucket (publicly readable). |
 
Row Level Security is enabled on all tables. The backend accesses Supabase exclusively through the **service-role key** via async `httpx` calls to the Supabase REST API — no ORM is used.
 
---
 
## Project Structure
 
```
.
├── Backend/
│   ├── main.py                        # FastAPI app, CORS config, router registration
│   ├── requirements.txt
│   ├── schema.sql                     # Reference schema (Supabase PostgreSQL)
│   ├── supabase_migration.sql         # Complete migration — run this in Supabase SQL Editor
│   ├── .env                           # Environment variables (see Setup below)
│   │
│   ├── api/
│   │   ├── models/
│   │   │   └── workflow.py            # Pydantic request/response models
│   │   └── routers/
│   │       ├── user.py                # Signup, signin, Google OAuth, profile, avatar
│   │       ├── workflow.py            # Full workflow CRUD + PDF upload
│   │       ├── run.py                 # POST /execute  GET /chat-history/:id
│   │       └── kb.py                  # POST /kb/upload  GET /kb/documents
│   │
│   ├── db/
│   │   ├── database.py                # All Supabase REST API calls via async httpx
│   │   └── supabase.py                # supabase-py client — used for Storage uploads
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
        │   ├── api.ts                 # HTTP client functions for all backend endpoints
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
        │   ├── BuilderPage.tsx        # Canvas host page
        │   ├── ProfilePage.tsx        # Edit display name and avatar
        │   ├── AvatarGeneratorPage.tsx# Custom avatar builder
        │   ├── ForgotPassword.tsx
        │   └── ResetPassword.tsx
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
 
| Requirement | Version / Notes |
|-------------|-----------------|
| Python | 3.10+ |
| Node.js | 18+ |
| npm | 9+ |
| Supabase project | [supabase.com](https://supabase.com) — free tier works |
| Google Gemini API Key | [aistudio.google.com](https://aistudio.google.com/app/apikey) |
| SerpAPI Key | [serpapi.com](https://serpapi.com) — optional, falls back to Wikipedia |
| Google Cloud project | Required only if enabling Google OAuth sign-in |
 
---
 
### Backend Setup
 
```bash
cd Backend
 
# Create and activate a virtual environment
python -m venv venv
source venv/bin/activate        # macOS/Linux
venv\Scripts\activate           # Windows
 
# Install dependencies
pip install -r requirements.txt
 
# Create your environment file and fill in values (see Environment Variables below)
cp .env.example .env
 
# Start the server
uvicorn main:app --reload
```
 
API available at `http://localhost:8000`. Interactive docs at `http://localhost:8000/docs`.
 
---
 
### Frontend Setup
 
```bash
cd Frontend
npm install
cp .env.example .env
# Set VITE_BACKEND_URL=http://localhost:8000
npm run dev
```
 
Frontend available at `http://localhost:5173`.
 
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
 
# REQUIRED — Supabase project credentials
# Get from: Supabase Dashboard > Settings > API
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_KEY=eyJhbGci...          # anon/public key
SUPABASE_SERVICE_KEY=eyJhbGci... # service_role key (used by backend for all DB operations)
 
# OPTIONAL — ChromaDB vector store path (default: ./chroma_db)
CHROMA_PERSIST_DIR=./chroma_db
 
# OPTIONAL — Required only for Google OAuth sign-in
GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxx
 
# OPTIONAL — Used for OAuth redirect URLs and CORS
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:8000
```
 
> **Note:** Gemini and SerpAPI keys are entered per-workflow inside the node configuration UI and are encrypted with Fernet before being stored in Supabase. You do not need to set them globally here.
 
### Frontend — `Frontend/.env`
 
```env
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
| `POST` | `/api/user/signup` | No | Register with email and password |
| `POST` | `/api/user/signin` | No | Sign in and receive a JWT |
| `GET` | `/api/user/google` | No | Initiate Google OAuth flow |
| `GET` | `/api/user/google/callback` | No | Google OAuth redirect callback |
| `GET` | `/api/user/profile` | Yes | Get the authenticated user's profile |
| `PATCH` | `/api/user/profile` | Yes | Update display name or avatar URL |
| `POST` | `/api/user/avatar/upload` | Yes | Upload avatar image to Supabase Storage |
 
### Workflows
 
| Method | Endpoint | Auth | Description |
|--------|----------|:----:|-------------|
| `POST` | `/api/workflow/create` | Yes | Create a new workflow |
| `GET` | `/api/workflow/list` | Yes | List all workflows owned by the user |
| `GET` | `/api/workflow/{id}` | Yes | Get a workflow with decrypted API keys |
| `PATCH` | `/api/workflow/update/{id}` | Yes | Update workflow graph + optional PDF upload |
| `DELETE` | `/api/workflow/{id}` | Yes | Delete workflow and all chat history |
 
### Execution and Chat
 
| Method | Endpoint | Auth | Description |
|--------|----------|:----:|-------------|
| `POST` | `/api/execute` | No | Execute a workflow with a user query |
| `GET` | `/api/chat-history/{id}` | No | Retrieve full chat history for a workflow |
 
### Knowledge Base
 
| Method | Endpoint | Auth | Description |
|--------|----------|:----:|-------------|
| `POST` | `/api/kb/upload` | Yes | Upload and index a PDF document |
| `GET` | `/api/kb/documents` | Yes | List all indexed documents for the user |
 
---
 
## How It Works
 
### Workflow Execution Engine
 
When a chat message is sent, the `WorkflowOrchestrator` on the backend:
 
1. Loads the workflow graph from Supabase and decrypts API keys in memory only — keys are never logged or persisted in plaintext
2. Filters ghost edges — edges pointing to nodes that no longer exist are silently skipped
3. Traverses the directed graph starting from `UserQueryNode`, executing each node in sequence
4. Propagates data between nodes based on the `targetHandle` of each connecting edge (`query`, `context`, `target`)
5. Detects cycles using a visited set to prevent infinite loops
6. Returns the `OutputNode`'s `final_response` and saves the exchange to the `chat_logs` table in Supabase
 
```
UserQueryNode --(query)--> KnowledgeBaseNode --(context)--> LLMNode --(answer)--> OutputNode
                                                                ^
                                            WebSearchNode --(results)--+
```
 
### Database Layer
 
The backend communicates with Supabase through the **Supabase REST API** using async `httpx` — no ORM is used. The service-role key is passed in the `Authorization` header, granting full access and bypassing RLS. This approach avoids the event-loop blocking that the synchronous `supabase-py` client causes on Windows.
 
```
FastAPI endpoint
    --> db/database.py (async httpx)
          --> Supabase REST API (https://xxxx.supabase.co/rest/v1/<table>)
                --> PostgreSQL (managed by Supabase)
```
 
`supabase-py` is used only for Supabase Storage operations (avatar image uploads), where its async support is sufficient.
 
### RAG Pipeline (Knowledge Base Node)
 
**At upload time:**
```
PDF File
  --> PyMuPDF text extraction
        --> Split into 1,000-char chunks (200-char overlap)
              --> For each chunk:
                    [Level 1] Ensemble: average(Gemini 384-dim, ST 384-dim), L2-normalized
                    [Level 2] Sentence Transformers only: all-MiniLM-L6-v2
                    [Level 3] Gemini only: gemini-embedding-001, dim=384
                          --> ChromaDB: store vector + metadata (workflow_id, doc_name, chunk_index)
```
 
**At query time:**
```
User query
  --> Embed with same strategy used at upload
        --> ChromaDB cosine similarity: top 5 chunks, filtered by workflow_id
              --> Return as numbered context blocks fed into LLM node
```
 
### Authentication Flow
 
```
Sign Up --> PBKDF2-HMAC-SHA256 (260,000 iterations, random 16-byte salt)
              --> Store salted hash in Supabase users table
 
Sign In --> Re-derive hash with stored salt
              --> hmac.compare_digest (constant-time, prevents timing attacks)
                    --> Issue HS256 JWT { sub, email, iat, exp = 7 days }
 
Google OAuth --> Redirect to Google consent screen
                  --> Callback to /api/user/google/callback
                        --> Fetch profile from Google userinfo endpoint
                              --> Upsert user in Supabase, issue JWT
 
API Request --> Authorization: Bearer <token>
                  --> Verify HMAC-SHA256 signature + check exp
                        --> Extract user_id from sub claim
```
 
---
 
## Node Types
 
| Node | Role | Inputs | Outputs |
|------|------|--------|---------|
| User Query | Pipeline entry point | User's chat message | `query` string |
| Knowledge Base | RAG retrieval | `query` | `context` (top-5 similar chunks) |
| LLM Engine | Text generation | `query`, `context` (optional) | `response` |
| Web Search | Real-time search | `query` | `formatted_results` |
| Output | Pipeline terminal | Any upstream value | `final_response` to chat |
 
The Output node selects the best available upstream value in priority order:
`llm_response` > `web_search_results` > `context` > `query`
 
---
 
## Deployment
 
See [SETUP.md](SETUP.md) for complete instructions covering Docker, Kubernetes (Minikube, AWS EKS, Google GKE), Prometheus + Grafana monitoring, and ELK Stack log aggregation.
 
For production scaling:
 
| Component | Current | Production Recommendation |
|-----------|---------|--------------------------|
| Relational DB | Supabase free tier | Supabase Pro or dedicated PostgreSQL |
| Vector DB | ChromaDB (embedded, local) | Pinecone, Weaviate, or hosted ChromaDB |
| Auth | Custom PBKDF2 + JWT | Keep as-is — add refresh token rotation |
| LLM | Google Gemini | Add OpenAI / Anthropic as additional providers |
| Serving | Single process | Docker + Nginx reverse proxy; frontend via CDN |
| File Storage | Supabase Storage (avatars) | Keep as-is or migrate to AWS S3 / GCS |
 
> **Before going to production:** Replace `allow_origins=["*"]` in `main.py` with your specific frontend domain, and rotate all keys in `.env`.
 
---
 
## Known Limitations
 
- **Gemini client singleton:** The Gemini client caches the first API key used per process lifetime. In a multi-user production environment, instantiate the client per-request rather than per-process inside `utils/gemini_client.py`.
- **ChromaDB is local:** ChromaDB runs embedded and stores vectors on the local filesystem. In a horizontally scaled deployment, all backend replicas must share the same persistent volume, or ChromaDB must be replaced with a hosted vector database.
- **TinyLlama speed:** The local TinyLlama fallback runs on CPU and is significantly slower than the Gemini API. It is a last-resort safety net, not a primary inference path.
- **Public execute endpoint:** `POST /api/execute` does not require authentication by design, to allow embedding Stacks as public chatbots. To restrict it, add `get_current_user_id(authorization)` validation at the top of the execute endpoint in `api/routers/run.py`.
 
---
 
## Contributing
 
Contributions are welcome.
 
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Commit your changes: `git commit -m "feat: add streaming response support"`
4. Push and open a Pull Request: `git push origin feature/your-feature-name`
 
Please open an issue first for major changes so the approach can be discussed before work begins.
 
---
 
## License
 
This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for full details.
 
---
 
## Acknowledgements
 
- [FastAPI](https://fastapi.tiangolo.com) — backend framework
- [Supabase](https://supabase.com) — PostgreSQL database and file storage
- [React Flow](https://reactflow.dev) — workflow canvas
- [ChromaDB](https://trychroma.com) — local vector store
- [Google Gemini API](https://ai.google.dev/docs) — LLM and embedding provider
- [Sentence Transformers](https://sbert.net) — local embedding model (`all-MiniLM-L6-v2`)
- [shadcn/ui](https://ui.shadcn.com) — component library
- [SerpAPI](https://serpapi.com/documentation) — web search integration
 
---

For questions or issues, open a [GitHub Issue](../../issues) or reach out at [gmail](praveen.chinna0765@gmail.com).
