/**
 * Singleton Socket.IO client.
 *
 * WHY SINGLETON: React strict-mode and hot-module-reloads can re-execute
 * module-level code, but ES-module caching guarantees this file is evaluated
 * exactly once per page load — so `socket` is created only once.  Importing
 * this file from multiple components therefore shares the same connection
 * rather than opening a new WebSocket per import.
 *
 * NOTE: autoConnect is disabled so the caller (useRoom hook) decides when to
 * connect, preventing stale connections from components that mount before a
 * room is chosen.
 */

import { io, Socket } from 'socket.io-client';

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

const socket: Socket = io(BACKEND_URL, {
  autoConnect: false,          // caller connects explicitly via socket.connect()
  reconnection: true,
  reconnectionAttempts: 5,     // NFR: up to 5 attempts (PRD §6)
  reconnectionDelay: 1000,     // 1 s between retries
});

export default socket;
