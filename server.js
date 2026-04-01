/**
 * Custom Next.js server with Socket.io support
 * Run with: node server.js
 */

// Load environment variables first
require("dotenv").config({ path: ".env.local" });
require("dotenv").config({ path: ".env" });

// Register tsconfig-paths first for alias resolution
const tsConfigPaths = require("tsconfig-paths");
tsConfigPaths.register({
  baseUrl: ".",
  paths: {
    "@/*": ["./src/*"],
  },
});

// Register ts-node for TypeScript support
require("ts-node").register({
  project: "./tsconfig.json",
  transpileOnly: true,
});

const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { initializeSocket } = require("./src/lib/socket/init.ts");
const { initializeDatabase } = require("./src/lib/db/init.ts");

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

// Create Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  // Initialize database first
  initializeDatabase();

  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error handling request:", err);
      res.statusCode = 500;
      res.end("internal server error");
    }
  });

  // Initialize Socket.io
  const io = initializeSocket(httpServer);
  console.log("✅ Socket.io initialized");

  httpServer
    .listen(port, (err) => {
      if (err) throw err;
      console.log(`> Ready on http://${hostname}:${port}`);
      console.log(`> API routes available at /api/*`);
      console.log(`> WebSocket available via Socket.io`);
    })
    .on("error", (err) => {
      console.error("Server error:", err);
      process.exit(1);
    });
});
