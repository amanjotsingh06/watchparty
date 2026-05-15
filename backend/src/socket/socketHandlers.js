/**
 * socketHandlers.js — Socket.IO event handlers
 *
 * ARCHITECTURE RULES:
 * - Role is ALWAYS resolved from getRole(roomId, socket.id) — NEVER from client payload.
 * - Guard clause pattern: validate → reject early → proceed.
 * - Calls roomManager for all state mutations, then broadcasts via io.to(roomId).
 * - roomManager.js has ZERO socket.io imports; all io/socket usage stays here.
 */

const {
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
} = require('../rooms/roomManager');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Builds a sync-state snapshot from the current room state.
 * Used for room_created, room_joined, and request_sync responses.
 * @param {object} room - The room state object
 * @returns {{ videoId: string|null, playState: string, currentTime: number }}
 */
function buildSyncState(room) {
  let computedTime = room.currentTime;

  // If the video is actively playing, extrapolate the true current time 
  // by adding the elapsed seconds since the last state update.
  if (room.playState === 'playing' && room.lastUpdatedAt) {
    const elapsedSeconds = (Date.now() - room.lastUpdatedAt) / 1000;
    computedTime += elapsedSeconds;
  }

  return {
    videoId: room.videoId,
    playState: room.playState,
    currentTime: computedTime,
  };
}

/**
 * Shared leave handler — used by both leave_room and disconnect events.
 * Removes the socket from the room, broadcasts user_left, and handles
 * host auto-transfer (performed internally by roomManager.leaveRoom).
 * @param {import('socket.io').Socket} socket
 * @param {import('socket.io').Server} io
 * @param {string} roomId
 */
function handleLeave(socket, io, roomId) {
  const result = leaveRoom(roomId, socket.id);
  if (!result) return; // room didn't exist — nothing to do

  socket.leave(roomId);

  // Room was deleted (last participant left) — no one to notify
  if (!result.room) return;

  // Broadcast departure + updated participant list to remaining members
  io.to(roomId).emit('user_left', {
    userId: socket.id,
    participants: result.room.participants,
  });

  // If the departing socket was the host, notify about the auto-promoted new host
  if (result.wasHost) {
    const newHost = result.room.participants.find(
      (p) => p.socketId === result.room.hostId
    );
    if (newHost) {
      io.to(roomId).emit('role_assigned', {
        userId: newHost.socketId,
        role: 'host',
        participants: result.room.participants,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Main registration
// ---------------------------------------------------------------------------

/**
 * Registers all socket event handlers for a newly connected socket.
 * @param {import('socket.io').Socket} socket  - The individual client connection
 * @param {import('socket.io').Server} io      - The Socket.IO server instance
 */
function registerHandlers(socket, io) {

  // -------------------------------------------------------------------------
  // Room lifecycle
  // -------------------------------------------------------------------------

  /**
   * create_room — Client wants to create a new room.
   * Creator is automatically assigned the 'host' role.
   */
  socket.on('create_room', ({ username }) => {
    const { roomId, room } = createRoom(socket.id, username);

    socket.join(roomId);

    socket.emit('room_created', {
      roomId,
      role: 'host',
      participants: room.participants,
      syncState: buildSyncState(room),
    });
  });

  /**
   * join_room — Client wants to join an existing room.
   * If the room doesn't exist, auto-creates it (client becomes host).
   */
  socket.on('join_room', ({ roomId, username }) => {
    const existingRoom = getRoom(roomId);

    if (!existingRoom) {
      // Room doesn't exist — create it, making the joiner the host
      const { roomId: newRoomId, room } = createRoom(socket.id, username);

      socket.join(newRoomId);

      socket.emit('room_created', {
        roomId: newRoomId,
        role: 'host',
        participants: room.participants,
        syncState: buildSyncState(room),
      });
      return;
    }

    // Room exists — add as participant
    const result = joinRoom(roomId, socket.id, username);
    if (!result) return; // defensive — should not happen if getRoom succeeded

    socket.join(roomId);

    socket.emit('room_joined', {
      roomId,
      role: result.participant.role,
      participants: result.room.participants,
      syncState: buildSyncState(result.room),
    });

    // Notify everyone else in the room about the new joiner
    socket.to(roomId).emit('user_joined', {
      username,
      userId: socket.id,
      role: result.participant.role,
      participants: result.room.participants,
    });
  });

  // -------------------------------------------------------------------------
  // Leave & disconnect
  // -------------------------------------------------------------------------

  socket.on('leave_room', ({ roomId }) => {
    handleLeave(socket, io, roomId);
  });

  /**
   * disconnect — Socket dropped (tab close, network loss, etc.).
   * We must find which room this socket was in, then clean up.
   */
  socket.on('disconnect', () => {
    const roomId = findRoomBySocket(socket.id);
    if (roomId) {
      handleLeave(socket, io, roomId);
    }
  });

  // -------------------------------------------------------------------------
  // Playback controls — all four follow the same guard-clause pattern
  // 1. Server-side role lookup (NEVER trust client payload)
  // 2. Permission check via canControlPlayback
  // 3. State mutation via updateRoomState
  // 4. Broadcast sync_state to ALL in room (including sender)
  // -------------------------------------------------------------------------

  socket.on('play', ({ roomId, currentTime }) => {
    const role = getRole(roomId, socket.id);
    if (!canControlPlayback(role)) {
      socket.emit('error', { message: 'You do not have permission to control playback.' });
      return;
    }

    updateRoomState(roomId, { playState: 'playing', currentTime });

    io.to(roomId).emit('sync_state', {
      playState: 'playing',
      currentTime,
      triggeredBy: socket.id,
    });
  });

  socket.on('pause', ({ roomId, currentTime }) => {
    const role = getRole(roomId, socket.id);
    if (!canControlPlayback(role)) {
      socket.emit('error', { message: 'You do not have permission to control playback.' });
      return;
    }

    updateRoomState(roomId, { playState: 'paused', currentTime });

    io.to(roomId).emit('sync_state', {
      playState: 'paused',
      currentTime,
      triggeredBy: socket.id,
    });
  });

  socket.on('seek', ({ roomId, currentTime }) => {
    const role = getRole(roomId, socket.id);
    if (!canControlPlayback(role)) {
      socket.emit('error', { message: 'You do not have permission to control playback.' });
      return;
    }

    const room = getRoom(roomId);
    updateRoomState(roomId, { currentTime });

    io.to(roomId).emit('sync_state', {
      playState: room ? room.playState : 'paused',
      currentTime,
      triggeredBy: socket.id,
    });
  });

  /**
   * change_video — Resets currentTime to 0 and playState to 'paused'.
   */
  socket.on('change_video', ({ roomId, videoId }) => {
    const role = getRole(roomId, socket.id);
    if (!canControlPlayback(role)) {
      socket.emit('error', { message: 'You do not have permission to change the video.' });
      return;
    }

    updateRoomState(roomId, { videoId, currentTime: 0, playState: 'paused' });

    io.to(roomId).emit('sync_state', {
      videoId,
      playState: 'paused',
      currentTime: 0,
      triggeredBy: socket.id,
    });
  });

  // -------------------------------------------------------------------------
  // Role management (host only)
  // -------------------------------------------------------------------------

  /**
   * assign_role — Host assigns a new role to a target participant.
   * ONLY the host can assign roles. Moderators cannot.
   */
  socket.on('assign_role', ({ roomId, userId, role }) => {
    // Guard: caller must be the host
    const callerRole = getRole(roomId, socket.id);
    if (callerRole !== 'host') {
      socket.emit('error', { message: 'Only the host can assign roles.' });
      return;
    }

    // Guard: requested role must be valid
    const validRoles = ['participant', 'moderator', 'host'];
    if (!validRoles.includes(role)) {
      socket.emit('error', { message: `Invalid role: ${role}` });
      return;
    }

    const success = assignRole(roomId, userId, role);
    if (!success) {
      socket.emit('error', { message: 'Failed to assign role. User not found in room.' });
      return;
    }

    const room = getRoom(roomId);
    io.to(roomId).emit('role_assigned', {
      userId,
      role,
      participants: room.participants,
    });
  });

  // -------------------------------------------------------------------------
  // Participant removal (host only)
  // -------------------------------------------------------------------------

  /**
   * remove_participant — Host kicks a participant from the room.
   * Host cannot remove themselves.
   */
  socket.on('remove_participant', ({ roomId, userId }) => {
    // Guard: caller must be the host
    const callerRole = getRole(roomId, socket.id);
    if (callerRole !== 'host') {
      socket.emit('error', { message: 'Only the host can remove participants.' });
      return;
    }

    // Guard: host cannot remove themselves
    if (userId === socket.id) {
      socket.emit('error', { message: 'You cannot remove yourself from the room.' });
      return;
    }

    const success = removeParticipant(roomId, userId);
    if (!success) {
      socket.emit('error', { message: 'Failed to remove participant.' });
      return;
    }

    // Notify the removed user BEFORE removing them from the room
    io.to(userId).emit('you_were_removed', {
      message: 'You have been removed from the room by the host.',
    });

    // Force the removed socket to leave the Socket.IO room
    const removedSocket = io.sockets.sockets.get(userId);
    if (removedSocket) {
      removedSocket.leave(roomId);
    }

    const room = getRoom(roomId);
    io.to(roomId).emit('participant_removed', {
      userId,
      participants: room.participants,
    });
  });

  // -------------------------------------------------------------------------
  // Sync request (anyone)
  // -------------------------------------------------------------------------

  /**
   * request_sync — Late joiner or out-of-sync client requests current state.
   * Emits sync_state only to the requesting socket.
   */
  socket.on('request_sync', ({ roomId }) => {
    const room = getRoom(roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found.' });
      return;
    }

    socket.emit('sync_state', buildSyncState(room));
  });
}

// ---------------------------------------------------------------------------
// Module exports (CommonJS — no ESM)
// ---------------------------------------------------------------------------

module.exports = { registerHandlers };
