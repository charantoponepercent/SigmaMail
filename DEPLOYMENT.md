# SigmaMail Deployment (Render + Vercel)

This project is a monorepo:
- Backend: `backend/` (Express + Mongo + Redis)
- Frontend: `frontend/` (Next.js)

## 1) Prerequisites

1. MongoDB connection string (`MONGO_URI`).
2. Redis connection string (`REDIS_URL`).
3. Google OAuth credentials for Gmail integration.
4. Google Pub/Sub topic for Gmail push (`GOOGLE_PUBSUB_TOPIC`).
5. Gemini API key for AI features.
6. (Optional but recommended for full features) Embedding model name (`EMBED_MODEL`), e.g. `sentence-transformers/all-MiniLM-L6-v2`.

## 2) Deploy Backend on Render

1. Push this repo to GitHub.
2. In Render, deploy from `render.yaml` as a **Blueprint**.
   - This blueprint is configured with **Docker runtime** for API + workers.
3. This creates:
   - `sigmamail-embedding` (embedding API)
   - `sigmamail-backend` (web API)
   - `sigmamail-worker-gmail-push` (Pub/Sub job consumer)
   - `sigmamail-worker-gmail-message-sync` (message sync worker)
   - `sigmamail-worker-gmail-initial-sync` (initial sync worker)
   - `EMBEDDING_URL` and `CLASSIFIER_EMBED_URL` are auto-wired from the embedding service host/port in `render.yaml`.
4. Set environment variables (from `backend/.env.example`) on all backend services:
   - `NODE_ENV=production`
   - `MONGO_URI`
   - `REDIS_URL`
   - `JWT_SECRET`
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_REDIRECT_URI`
   - `GOOGLE_PUBSUB_TOPIC` (format: `projects/<project-id>/topics/<topic-name>`)
   - `GEMINI_API_KEY`
   - `CORS_ORIGINS`
   - `EMBED_MODEL` (only on `sigmamail-embedding`, optional; default model is used if omitted)
5. Deploy and verify:
   - `GET https://<render-embedding-domain>/health` returns `200`.
   - `GET https://<render-backend-domain>/health` returns `200`.
   - `GET https://<render-backend-domain>/ready` returns `200` when Mongo + Redis are ready.
   - Worker service logs show active BullMQ workers without crash loops.
   - Gmail webhook endpoint is reachable: `POST https://<render-backend-domain>/api-push/webhooks/gmail`.

## 3) Configure Google OAuth

In Google Cloud Console, add:
- Authorized redirect URI: `https://<render-backend-domain>/auth/google/callback`

Then set the same URL in Render env:
- `GOOGLE_REDIRECT_URI=https://<render-backend-domain>/auth/google/callback`

## 4) Deploy Frontend on Vercel

1. In Vercel, import the same GitHub repo.
2. Set **Root Directory** = `frontend`.
3. Add environment variable:
   - `NEXT_PUBLIC_API_URL=https://<render-backend-domain>`
4. Deploy.

## 5) CORS Setup (Required)

Set backend `CORS_ORIGINS` in Render to the frontend domains (comma-separated), for example:

`https://your-app.vercel.app,https://your-custom-domain.com`

If you use Vercel preview deployments and want them to work, update `CORS_ORIGINS` to include preview domain(s) too.

## 6) Post-Deploy Verification Checklist

1. Open frontend URL and sign in.
2. Connect Gmail account via OAuth.
3. Confirm inbox loads (`/api/inbox/today` behind UI).
4. Confirm AI endpoints from UI (digest/orchestrator/search where used).
5. Confirm backend health:
   - `/health` is `ok`
   - `/ready` is `ready`

## 7) Recommended Production Practices

1. Rotate `JWT_SECRET` and API keys before go-live.
2. Use separate dev/staging/prod projects and env vars.
3. Restrict CORS to exact frontend domains.
4. Monitor Render logs for Redis/Mongo connectivity and Gmail webhook errors.
5. Add custom domain + HTTPS for both frontend and backend.
6. Ensure all worker services are running; otherwise webhook and initial sync queues will grow unprocessed.
