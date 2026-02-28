# Deployment Guide

## Option A (Recommended): Split Deployments

### Frontend (Vercel)
1. Build the client:
   ```bash
   npm --workspace client run build
   ```
2. Deploy `client/dist/` to Vercel.
3. Set environment variable:
   - `VITE_WS_URL=wss://<your-railway-app>.up.railway.app`

### Backend (Railway)
1. Deploy the `server/` workspace to Railway.
2. Set environment variables:
   - `MISTRAL_API_KEY`
   - `ELEVENLABS_API_KEY`
   - `ELEVENLABS_VOICE_ID` (optional)
   - `DEMO_MODE` (`true` to force `mistral-large-latest`)
   - `PORT` (Railway provides this automatically)
3. Start command:
   ```bash
   npm --workspace server run start
   ```

## Option B: Single Railway Deployment

1. Build everything:
   ```bash
   npm run build
   ```
2. Start the server:
   ```bash
   npm --workspace server run start
   ```
3. Configure Railway to serve the built client from `client/dist/`.
   - If you choose this route, ensure the server serves static files for the client build.

## Checklist

- Client loads at public URL
- WebSocket connects to backend
- Phase transition completes within timeout
- ElevenLabs audio plays (or fallback taunt appears)
