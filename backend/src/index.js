const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

// Import socket handlers and room manager (stubs initially)
const { registerHandlers } = require('./socket/socketHandlers');
const { getRoom } = require('./rooms/roomManager');

const PORT = process.env.PORT || 4000;
const FRONTEND_URL = process.env.FRONTEND_URL || '*';

const app = express();

// Set up Express CORS
app.use(cors({
  origin: FRONTEND_URL
}));

// Create HTTP server
const server = http.createServer(app);

// Attach Socket.IO to the HTTP server
const io = new Server(server, {
  cors: {
    origin: FRONTEND_URL,
    methods: ["GET", "POST"]
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Room existence check endpoint
app.get('/room/:roomId/exists', (req, res) => {
  const { roomId } = req.params;
  const room = getRoom(roomId);
  res.json({ exists: !!room });
});

// Socket connection event
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Register socket handlers
  if (typeof registerHandlers === 'function') {
    registerHandlers(socket, io);
  }

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

// Start the server
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
