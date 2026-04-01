# Next.js Migration Guide - Trading Agent

## 📋 Status: 40% Complete

The foundation for the Next.js migration has been created. Here's what's been set up and what remains.

## ✅ Completed

- [x] Project structure and directories created
- [x] `package.json` - Dependencies configured
- [x] `tsconfig.json` - TypeScript configuration
- [x] `next.config.js` - Next.js configuration
- [x] `.env.example` - Environment variables template
- [x] `src/config/kite.ts` - KiteConnect configuration
- [x] `src/lib/scanner/scan.ts` - Stock scanning logic (main business logic)

## 🚀 Next Steps (In Order)

### Step 1: Copy Core Libraries
Copy these files from the original `trading-agent` to `trading-agent-nextjs`:

```bash
# Copy data fetching utilities
cp src/data/historical.ts → src/lib/data/historical.ts
cp src/data/realtime.ts → src/lib/data/realtime.ts

# Copy indicators and strategies
cp src/indicators/indicators.ts → src/lib/indicators/indicators.ts
cp src/strategies/swing.ts → src/lib/strategies/swing.ts

# Copy type definitions
cp src/types.ts → src/lib/types.ts
```

### Step 2: Create API Routes
Create these Next.js API routes in `src/app/api/`:

```
src/app/api/
├── scan/
│   └── route.ts          (GET /api/scan)
├── holdings/
│   └── route.ts          (GET /api/holdings)
├── positions/
│   └── route.ts          (GET /api/positions)
└── ws/
    └── route.ts          (WebSocket endpoint for portfolio updates)
```

**Key endpoints to implement:**
- `GET /api/scan` - Returns scan results with caching
- `GET /api/holdings` - Returns portfolio holdings
- `POST /api/holdings` - Add/remove holdings
- WebSocket route for real-time portfolio and NIFTY50 data

### Step 3: Set Up WebSocket Server
Create a dedicated WebSocket server file:

```bash
# Create src/lib/websocket-server.ts
# - Initialize KiteTicker
# - Handle client connections
# - Manage NIFTY50 token subscription (256265099)
# - Broadcast tick updates to connected clients
```

### Step 4: Create React Components
Create these React components in `src/app/components/`:

```
src/app/components/
├── Dashboard.tsx           (Main layout)
├── ScanResults.tsx         (Scan table with sorting)
├── Portfolio.tsx           (Holdings table)
├── PortfolioSummary.tsx    (Summary cards + NIFTY50 display)
├── Nifty50Display.tsx      (Real-time NIFTY50 ticker)
├── ControlBar.tsx          (Stats and controls)
└── WebSocketProvider.tsx   (WebSocket connection hook)
```

### Step 5: Create Pages
Create these pages in `src/app/`:

```
src/app/
├── layout.tsx             (Root layout)
├── page.tsx               (Main dashboard page)
└── globals.css            (Global styles)
```

### Step 6: Create Custom Hooks
Create utility hooks in `src/lib/hooks/`:

```
├── usePortfolioWebSocket.ts    (Real-time portfolio updates)
├── useScan.ts                  (Fetch and cache scan results)
└── useNifty50.ts               (Track NIFTY50 data)
```

### Step 7: Configure Environment
```bash
# Copy .env from trading-agent to trading-agent-nextjs/.env.local
cp ../ trading-agent/.env trading-agent-nextjs/.env.local
```

## 🏗️ Architecture Overview

```
Next.js App (Port 3000)
│
├── Frontend (React + TypeScript)
│   ├── Dashboard page
│   ├── Real-time WebSocket connection
│   └── Component library (buttons, tables, cards)
│
├── API Routes (Express-like endpoints)
│   ├── /api/scan
│   ├── /api/holdings
│   ├── /api/positions
│   └── /api/ws (WebSocket)
│
└── Backend Services (TypeScript)
    ├── KiteConnect integration
    ├── Stock scanner
    ├── Technical indicators
    ├── Trading strategies
    └── WebSocket server
```

## 📦 Installation & Running

```bash
# Navigate to new project
cd trading-agent-nextjs

# Install dependencies
npm install

# Create environment file
cp .env.example .env.local
# Add your KITE credentials

# Development
npm run dev

# Build
npm run build

# Production
npm start
```

## 🔄 WebSocket Flow

1. **Client Connect** → Browser establishes WebSocket to Next.js
2. **Server Initialize** → Initialize KiteTicker if not already done
3. **NIFTY50 Subscribe** → Auto-subscribe to NIFTY50 token on connect
4. **Portfolio Fetch** → Get holdings + positions from Kite API
5. **Tick Updates** → Real-time price updates via ticker
6. **Broadcast** → Send updates to all connected clients

## ⚠️ Important Considerations

### WebSocket in Next.js
- Can't use standard WS in Next.js App Router directly
- Options:
  1. **Socket.io** - Easy to use, good for Next.js
  2. **Native WS + Custom server hook** - More control
  3. **API routes polling** - Simple alternative to WebSocket

### Recommended Approach
Use Socket.io for WebSocket support:
```bash
npm install socket.io socket.io-client
```

Then update `src/lib/websocket-server.ts` to use Socket.io instead of raw WS library.

## 🔐 API Key Management
- Create `.env.local` file (never commit to git)
- Use `process.env.KITE_API_KEY` in API routes
- Client-side uses `NEXT_PUBLIC_` prefix only for public variables

## 📊 Migration Checklist

- [ ] Copy all utility files (data, indicators, strategies, types)
- [ ] Create all API routes
- [ ] Set up WebSocket server (Socket.io recommended)
- [ ] Create React components
- [ ] Create pages and layout
- [ ] Create custom hooks
- [ ] Add Tailwind CSS styling
- [ ] Test API endpoints with Postman/curl
- [ ] Test WebSocket connections
- [ ] Test full portfolio flow
- [ ] Deploy to production

## 🎨 UI/Styling Notes
- Already using Tailwind CSS in package.json
- Can copy CSS from original `public/index.html` as reference
- Components should follow Tailwind best practices
- Responsive design for mobile compatibility

## 📚 Resources
- [Next.js Docs](https://nextjs.org/docs)
- [Socket.io for Next.js](https://socket.io/docs/v4/socket-io-and-express/)
- [React Hooks](https://react.dev/reference/react)
- [TypeScript with React](https://www.typescriptlang.org/docs/handbook/react.html)

---

Would you like me to proceed with Step 1 (copying core libraries) or focus on a different step?
