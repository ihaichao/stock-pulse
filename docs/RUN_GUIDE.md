# Stock Pulse - Run Guide

This guide describes how to run the Stock Pulse project locally.

## 🚀 One-Command Start (Recommended)

Run the entire project (Backend, Frontend, Database, Redis) with a single command:

```bash
docker-compose up --build
```

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:9002
- **API Docs**: http://localhost:9002/docs

*Note: The first run might take a few minutes to build the images. The database tables are automatically created on startup.*

---

## Manual Setup (Alternative)

If you prefer to run services individually for development:

### 1. Infrastructure

Start only the database and redis:

```bash
docker-compose up -d postgres redis
```

### 2. Backend Setup

1.  **Navigate to backend directory**: `cd backend`
2.  **Create venv & Install dependencies**:
    ```bash
    python -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
    ```
3.  **Run Server**:
    ```bash
    # Ensure you are back in the root directory to run uvicorn with module path
    cd ..
    cp .env.example .env
    uvicorn backend.main:app --reload --port 9002
    ```

### 3. Frontend Setup

1.  **Navigate to frontend directory**: `cd frontend`
2.  **Install dependencies**:
    ```bash
    pnpm install
    ```
3.  **Run Server**:
    ```bash
    # Create .env.local if not exists
    echo "NEXT_PUBLIC_API_URL=http://localhost:9002" > .env.local
    pnpm dev
    ```
