# 📈 Trading Agent - Next.js Edition

A modern NIFTY 50 Swing Trading Scanner built with Next.js, React, TypeScript, and real-time WebSocket support.

## 🚀 Features

- **Real-time Stock Scanning** - Automated technical analysis for NIFTY 50 stocks
- **Live Portfolio Tracking** - Real-time P&L with WebSocket updates
- **NIFTY50 Index Monitor** - Live index price and percentage changes
- **Advanced Indicators** - EMA, RSI, DMA, and trend analysis
- **One-Click Trading Signals** - Swing trading strategy implementation
- **Responsive UI** - Modern, developer-friendly dashboard

## 📁 Project Structure

```
trading-agent-nextjs/
├── src/
│   ├── app/                    # Next.js app directory
│   │   ├── api/               # API routes (backend endpoints)
│   │   ├── components/        # React components
│   │   ├── layout.tsx         # Root layout
│   │   └── page.tsx           # Home page
│   ├── config/                # Configuration files
│   │   └── kite.ts            # KiteConnect setup
│   └── lib/                   # Utility functions and business logic
│       ├── data/              # Data fetching
│       ├── indicators/        # Technical indicators
│       ├── strategies/        # Trading strategies
│       ├── scanner/           # Stock scanning logic
│       └── types.ts           # TypeScript definitions
├── public/                    # Static assets
├── .env.example              # Environment variables template
├── package.json              # Dependencies
├── tsconfig.json             # TypeScript config
├── next.config.js            # Next.js config
├── MIGRATION.md              # Migration guide from Express version
└── README.md                 # This file
```

## 🛠️ Tech Stack

- **Framework**: Next.js 14+ with App Router
- **Language**: TypeScript
- **Frontend**: React 18+
- **Styling**: Tailwind CSS
- **API Client**: KiteConnect SDK
- **Real-time**: Socket.io or WebSocket
- **Data**: Kite API (live market data)

## 📋 Prerequisites

- Node.js 18+ (or 20+)
- npm or yarn
- Active Kite Trading Account
- API credentials from Kite (api_key, access_token)

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
# Copy the example file
cp .env.example .env.local

# Edit .env.local and add your credentials:
# KITE_API_KEY=your_api_key
# KITE_ACCESS_TOKEN=your_access_token
# KITE_USER_ID=your_user_id
```

### 3. Generate Access Token
If you need to generate a new access token:
```bash
npm run generate-token
# Follow the interactive prompts
# Copy the access token to .env.local
```

### 4. Run Development Server

**Full Development (Recommended):**
```bash
npm run dev
```

**UI-Only Development (Components only):**
```bash
npm run dev:ui
```

For detailed info on development modes, see [DEVELOPMENT.md](./DEVELOPMENT.md).

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📚 Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server with Socket.io (Full features) |
| `npm run dev:next` | Start Next.js dev server only (UI only) |
| `npm run dev:ui` | Alias for `npm run dev:next` |
| `npm run build` | Build for production |
| `npm run start` | Run production server |
| `npm run lint` | Run ESLint |
| `npm run generate-token` | Generate Kite API access token |

## 🎯 Development Guide

For detailed information on running the app in different modes, see [DEVELOPMENT.md](./DEVELOPMENT.md).

Key points:
- **`npm run dev`** - Use this for full development (includes WebSocket, database, scanning)
- **`npm run dev:next`** - Use this for UI/component development only

## 🔄 Migration from Express Version

If you're coming from the original `trading-agent` (Express + Vanilla JS):

1. Read [MIGRATION.md](./MIGRATION.md) for detailed steps
2. Copy core utilities from original project
3. Create API routes (already have templates)
4. Build React components
5. Set up WebSocket/Socket.io
6. Test and validate

## 📊 API Endpoints

All endpoints are in `src/app/api/`:

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/scan` | Run stock scanner, returns BUY signals |
| `GET` | `/api/holdings` | Get current portfolio holdings |
| `GET` | `/api/positions` | Get open positions (same-day trades) |
| `WS` | `/api/ws` | WebSocket for real-time updates |

## 🎯 Key Features

### Real-Time Portfolio Updates
- WebSocket connection for instant P&L updates
- Tick-by-tick price updates
- Live NIFTY50 index tracking

### Smart Stock Scanning
- Technical analysis for 50 NIFTY stocks
- EMA, RSI, and pullback detection
- AI-powered swing trading signals
- Caching to prevent API rate limits

### Portfolio Management
- Track holdings and T1 positions
- Calculate daily and overall P&L
- Real-time portfolio summary
- Sortable holdings table

## ⚙️ Configuration

### Environment Variables
```env
# Required: Kite API credentials
KITE_API_KEY=api_key_here
KITE_ACCESS_TOKEN=access_token_here
KITE_USER_ID=user_id_here

# Optional: Server configuration
NEXT_PUBLIC_API_URL=http://localhost:3000
```

### Scan Configuration
Edit the strategy config in `src/lib/scanner/scan.ts`:
```typescript
const strategyConfig: StrategyConfig = {
  riskPercentage: 0.01,
  capitalPerTrade: 100000,
  targetMultiplier: 2,
  trendFilterPeriod: 50,
  momentumThreshold: 55,
  trailingStopPeriod: 10,
  lookbackCandles: 5,
};
```

## 🔧 Development Guidelines

### Adding New API Endpoint
1. Create file in `src/app/api/[name]/route.ts`
2. Implement `GET`, `POST`, etc. handlers
3. Add TypeScript types in `src/lib/types.ts`

### Creating New Component
1. Create file in `src/app/components/[name].tsx`
2. Use Tailwind CSS for styling
3. Add props interface for TypeScript

### Adding New Indicator
1. Create function in `src/lib/indicators/indicators.ts`
2. Add to indicators object
3. Use in strategy `src/lib/strategies/swing.ts`

## 📈 Trading Strategy

The app uses a **Swing Trading Strategy** that identifies:

1. **Trend** - 50-period EMA direction
2. **Momentum** - RSI above 55
3. **Pullback** - 10-period DMA pullback
4. **Signal** - Combination of above factors

## 🐛 Troubleshooting

### "API Rate Limit" Error
- Scan results are cached for 30 seconds
- Portfolio updates are cached for 60 seconds
- Historical data has concurrent limiting (3 at a time)

### WebSocket Connection Fails
- Ensure environment variables are set
- Check browser console for errors
- Verify Kite credentials are valid

### No Holdings Appear
- Make sure you have open positions on Kite
- Check Kite account has trading enabled
- Verify access token is valid

## 🚀 Deployment

### Vercel (Recommended for Next.js)
```bash
npm install -g vercel
vercel
```

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## 📝 License

MIT License - Feel free to use for personal or commercial projects

## 🤝 Contributing

Found a bug or have a feature request? Open an issue on GitHub!

## 📞 Support

For issues with Kite API:
- [Kite Documentation](https://kite.trade/docs/connect/v1)
- [Kite Support](https://support.zerodha.com)

For Next.js issues:
- [Next.js Documentation](https://nextjs.org/docs)
- [Next.js GitHub Discussions](https://github.com/vercel/next.js/discussions)

---

**Built with ❤️ using Next.js**
