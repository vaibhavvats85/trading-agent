# Development Guide

## Running the Application

### Option 1: Full Development Mode (Recommended) ⭐
```bash
npm run dev
```
- Runs: Custom Node.js server with Socket.io
- Features: ✅ WebSocket real-time updates, ✅ Database, ✅ Background scanning tasks
- Use this for: Full application development with all features

### Option 2: Next.js Development Mode (UI Only)
```bash
npm run dev:next
# or
npm run dev:ui
```
- Runs: Next.js built-in dev server only
- Features: ✅ Fast HMR (hot module reload), ⚠️ No WebSocket, ⚠️ No real-time updates
- Use this for: Frontend/component development only
- **Note:** Backend features won't work

### Option 3: Production Build
```bash
npm run build
npm run start:prod
```
- Runs: Optimized production build with custom server
- Features: ✅ All features enabled
- Use this for: Testing production setup locally

---

## What Each Command Does

| Command | What Runs | Socket.io | Database | Scanning | Best For |
|---------|-----------|-----------|----------|----------|----------|
| `npm run dev` | Custom server | ✅ Yes | ✅ Yes | ✅ Yes | Full development |
| `npm run dev:next` | Next.js dev server | ❌ No | ⚠️ Limited | ❌ No | Component dev |
| `npm run build` | Builds static assets | — | — | — | Build phase |
| `npm run start` | Custom server | ✅ Yes | ✅ Yes | ✅ Yes | Production |

---

## How It Works

### Custom Server (`npm run dev`)
The `server.js` file:
1. Starts a custom HTTP server
2. Wraps Next.js request handler
3. Initializes Socket.io for WebSocket connections
4. Initializes SQLite database
5. Runs background scanning tasks

### Next.js Dev Server (`npm run dev:next`)
The `next dev` command:
1. Starts Next.js development server
2. Provides hot module reloading
3. Does NOT provide Socket.io support
4. Does NOT run background tasks

---

## Ports and URLs

- **Application:** http://localhost:3000
- **WebSocket (Socket.io):** ws://localhost:3000 (only with `npm run dev`)

---

## Troubleshooting

### WebSocket Connection Errors
- ❌ Using `npm run dev:next`?
- ✅ Switch to `npm run dev`

### Database File Not Found
- Make sure you've run `npm run generate-token` first
- Check `.env` and `.env.local` files exist

### Port Already in Use
```bash
# Kill process on port 3000
lsof -ti :3000 | xargs kill -9

# Or use a different port
PORT=3001 npm run dev
```

---

## Environment Variables

Create `.env.local`:
```env
KITE_API_KEY=your_api_key
KITE_API_SECRET=your_api_secret
KITE_USER_ID=your_user_id
KITE_PASSWORD=your_password
KITE_TOTP_SECRET=your_totp_secret
```

See `.env.example` for all available variables.

---

## Architecture

```
npm run dev
    ↓
server.js (Custom Node.js Server)
    ├── HTTP Server
    ├── Socket.io (WebSocket)
    ├── Database (SQLite)
    ├── Next.js Handler
    │   ├── API Routes (/api/*)
    │   ├── Pages (UI)
    │   └── Components
    └── Background Tasks
        ├── Stock Scanner (every 1 min)
        └── Portfolio Updates (streaming)
```

---

## Next Steps

- For full feature development: Use `npm run dev`
- For UI-only work: Use `npm run dev:ui`
- Read the main [README.md](./README.md) for project overview
