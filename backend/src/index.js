require('dotenv').config();

const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const { getDb } = require('./db/database');

// Routes
const authRoutes = require('./routes/auth');
const signalRoutes = require('./routes/signals');
const webhookRoutes = require('./routes/webhook');
const settingsRoutes = require('./routes/settings');

const app = express();
const server = http.createServer(app);

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Simpan io instance di app untuk diakses di routes
app.set('io', io);

// =========================================
// Middleware
// =========================================
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logger (development)
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} [${req.method}] ${req.path}`);
    next();
  });
}

// =========================================
// Init Database
// =========================================
getDb(); // Initialize DB on startup

// =========================================
// Routes
// =========================================
app.use('/api/auth', authRoutes);
app.use('/api/signals', signalRoutes);
app.use('/api/webhook', webhookRoutes);
app.use('/api/settings', settingsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.path} tidak ditemukan` });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

// =========================================
// Socket.IO Events
// =========================================
io.on('connection', (socket) => {
  console.log(`🔌 Client terhubung: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`🔌 Client terputus: ${socket.id}`);
  });
});

// =========================================
// Start Server
// =========================================
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log('');
  console.log('╔════════════════════════════════════════╗');
  console.log('║        TERMINAL BTC — BACKEND          ║');
  console.log('╚════════════════════════════════════════╝');
  console.log(`🚀 Server running at: http://localhost:${PORT}`);
  console.log(`📡 WebSocket (Socket.IO) active`);
  console.log(`🔗 Webhook endpoint: POST http://localhost:${PORT}/api/webhook`);
  console.log(`💊 Health check: GET http://localhost:${PORT}/api/health`);
  console.log('');
});
