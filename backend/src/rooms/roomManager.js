/**
 * roomManager.js — Pure in-memory room state management
 *
 * ARCHITECTURE RULE: This module has ZERO socket.io imports.
 * It is independently testable pure state management only.
 * All socket.io communication happens in socketHandlers.js.
 */

// ---------------------------------------------------------------------------
// In-memory store
// ---------------------------------------------------------------------------

/** @type {Object.<string, Room>} */
const rooms = {};

// ---------------------------------------------------------------------------
// Room code generator
// ---------------------------------------------------------------------------

// Exclude visually ambiguous characters: 0, O, I, 1
const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * Generates a unique 6-character room code.
 * Recursively retries on collision (extremely rare in practice).
 * @returns {string} Unique room code
 */
function generateRoomCode() {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += CHARSET[Math.floor(Math.random() * CHARSET.length)];
  }
  // Retry on collision — guards against the near-impossible duplicate
  return rooms[code] ? generateRoomCode() : code;
}

// ---------------------------------------------------------------------------
// Exported functions
// ---------------------------------------------------------------------------

/**
 * Creates a new room with the caller as host.
 * @param {string} socketId - The creator's socket ID
 * @param {string} username - The creator's display name
 * @returns {{ roomId: string, room: Room }}
 */
function createRoom(socketId, username) {
  const roomId = generateRoomCode();

  const participant = { socketId, username, role: 'host' };

  rooms[roomId] = {
    hostId: socketId,
    videoId: null,          // no video selected yet
    playState: 'paused',
    currentTime: 0,
    lastUpdatedAt: Date.now(),
    participants: [participant],
  };

  return { roomId, room: rooms[roomId] };
}

/**
 * Adds a participant to an existing room.
 * @param {string} roomId
 * @param {string} socketId
 * @param {string} username
 * @returns {{ room: Room, participant: Participant } | null} null if room not found
 */
function joinRoom(roomId, socketId, username) {
  const room = rooms[roomId];
  if (!room) return null;

  const participant = { socketId, username, role: 'participant' };
  room.participants.push(participant);

  return { room, participant };
}

/**
 * Removes a participant from a room.
 * - If the leaving socket is the host, auto-promotes participants[0] to host.
 * - If the room becomes empty, deletes it and returns { room: null }.
 * @param {string} roomId
 * @param {string} socketId
 * @returns {{ room: Room|null, wasHost: boolean } | null} null if room not found
 */
function leaveRoom(roomId, socketId) {
  const room = rooms[roomId];
  if (!room) return null;

  const wasHost = room.hostId === socketId;

  // Remove the departing participant
  room.participants = room.participants.filter((p) => p.socketId !== socketId);

  // Room is now empty — clean up
  if (room.participants.length === 0) {
    delete rooms[roomId];
    return { room: null, wasHost };
  }

  // Auto-promote the next participant to host if host left
  if (wasHost) {
    const newHost = room.participants[0];
    newHost.role = 'host';
    room.hostId = newHost.socketId;
  }

  return { room, wasHost };
}

/**
 * Finds the room a socket currently belongs to.
 * Useful for handling disconnects where the client cannot emit leave_room.
 * @param {string} socketId
 * @returns {string|null} roomId or null
 */
function findRoomBySocket(socketId) {
  for (const roomId of Object.keys(rooms)) {
    const room = rooms[roomId];
    if (room.participants.some((p) => p.socketId === socketId)) {
      return roomId;
    }
  }
  return null;
}

/**
 * Returns the role of a socket within a room.
 * Role is always resolved server-side — never trusted from the client payload.
 * @param {string} roomId
 * @param {string} socketId
 * @returns {'host'|'moderator'|'participant'|null}
 */
function getRole(roomId, socketId) {
  const room = rooms[roomId];
  if (!room) return null;

  const participant = room.participants.find((p) => p.socketId === socketId);
  return participant ? participant.role : null;
}

/**
 * Assigns a new role to a target participant.
 * - If newRole === 'host': demotes the old host to 'participant' and updates hostId.
 * - Cannot demote the current host via this function (use leaveRoom for that).
 * @param {string} roomId
 * @param {string} targetSocketId
 * @param {'host'|'moderator'|'participant'} role
 * @returns {boolean} true on success, false if room/target not found
 */
function assignRole(roomId, targetSocketId, role) {
  const room = rooms[roomId];
  if (!room) return false;

  const target = room.participants.find((p) => p.socketId === targetSocketId);
  if (!target) return false;

  // Promoting someone to host — demote the current host first
  if (role === 'host') {
    const currentHost = room.participants.find(
      (p) => p.socketId === room.hostId
    );
    if (currentHost) {
      currentHost.role = 'participant';
    }
    room.hostId = targetSocketId;
  }

  target.role = role;
  return true;
}

/**
 * Forcibly removes a participant from a room (kicked by host).
 * The host themselves cannot be removed via this function.
 * @param {string} roomId
 * @param {string} targetSocketId
 * @returns {boolean} true on success, false if not found or target is host
 */
function removeParticipant(roomId, targetSocketId) {
  const room = rooms[roomId];
  if (!room) return false;

  // Guard: host cannot be removed
  if (room.hostId === targetSocketId) return false;

  const before = room.participants.length;
  room.participants = room.participants.filter(
    (p) => p.socketId !== targetSocketId
  );

  return room.participants.length < before;
}

/**
 * Applies a partial state update to a room.
 * Accepted keys: playState, currentTime, videoId.
 * Always stamps lastUpdatedAt to reflect the authoritative update time.
 * @param {string} roomId
 * @param {{ playState?: string, currentTime?: number, videoId?: string }} updates
 * @returns {void}
 */
function updateRoomState(roomId, updates) {
  const room = rooms[roomId];
  if (!room) return;

  // Only apply known, safe keys — never blindly spread the full update object
  if (updates.playState !== undefined) room.playState = updates.playState;
  if (updates.currentTime !== undefined) room.currentTime = updates.currentTime;
  if (updates.videoId !== undefined) room.videoId = updates.videoId;

  room.lastUpdatedAt = Date.now();
}

/**
 * Returns the current room state or null if not found.
 * @param {string} roomId
 * @returns {Room|null}
 */
function getRoom(roomId) {
  return rooms[roomId] || null;
}

/**
 * Guard helper used in socketHandlers before any playback mutation.
 * Host and Moderator may control playback; Participants may not.
 * @param {'host'|'moderator'|'participant'|null} role
 * @returns {boolean}
 */
function canControlPlayback(role) {
  return role === 'host' || role === 'moderator';
}

// ---------------------------------------------------------------------------
// Module exports (CommonJS — no ESM)
// ---------------------------------------------------------------------------

module.exports = {
  createRoom,
  joinRoom,
  leaveRoom,
  findRoomBySocket,
  getRole,
  assignRole,
  removeParticipant,
  updateRoomState,
  getRoom,
  canControlPlayback,
};
