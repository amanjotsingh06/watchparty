/**
 * useRoom — Central hook that owns ALL socket logic.
 *
 * ARCHITECTURE RULE: No component imports socket.ts directly.
 * Every socket interaction flows through this hook so that connection
 * lifecycle, event listeners, and cleanup are managed in one place.
 *
 * WHY lastSyncEvent is separate from roomState:
 *   If we only updated roomState.syncState, a repeated event with the same
 *   values would NOT trigger a re-render (React shallow-compares state).
 *   lastSyncEvent is a brand-new object reference on every server sync
 *   event, so the player's useEffect fires without exception — even when
 *   the payload values haven't changed (e.g. two consecutive pauses at
 *   the same timestamp).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import socket from '@/lib/socket';
import type {
  Role,
  Participant,
  RoomState,
  SyncStatePayload,
  RoomCreatedPayload,
  RoomJoinedPayload,
  UserJoinedPayload,
} from '@/types';

// ─── Public interfaces ──────────────────────────────────────────────────────

export interface UseRoomOptions {
  roomId: string;
  username: string;
  /** true when the client is creating a new room (vs. joining an existing one) */
  isCreating: boolean;
}

export interface UseRoomReturn {
  roomState: RoomState | null;
  isConnected: boolean;
  error: string | null;
  /** Always a new reference — triggers the player on every server sync event */
  lastSyncEvent: SyncStatePayload | null;
  emitPlay: (currentTime: number) => void;
  emitPause: (currentTime: number) => void;
  emitSeek: (currentTime: number) => void;
  emitChangeVideo: (videoId: string) => void;
  emitAssignRole: (userId: string, role: Role) => void;
  emitRemoveParticipant: (userId: string) => void;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useRoom({ roomId, username, isCreating }: UseRoomOptions): UseRoomReturn {
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncEvent, setLastSyncEvent] = useState<SyncStatePayload | null>(null);

  // ── Ref to avoid stale closures in emit callbacks ────────────────────────
  // Emit functions use useCallback with an empty dep array for stable
  // references; they read roomIdRef.current instead of the roomId prop.
  const roomIdRef = useRef(roomId);
  // CRITICAL FIX: If we have a real roomId from the server, use it.
  // Otherwise, fallback to the prop. (Do not blindly overwrite with 'new' 
  // on every render because history.replaceState doesn't trigger a param update).
  if (roomState?.roomId) {
    roomIdRef.current = roomState.roomId;
  } else if (roomId !== 'new') {
    roomIdRef.current = roomId;
  }

  // ── ONE useEffect registers ALL listeners & cleans up on unmount ─────────
  useEffect(() => {
    // ----- connect --------------------------------------------------------
    function onConnect() {
      console.log('[useRoom] Connected! socket.id =', socket.id, 'isCreating =', isCreating, 'roomId =', roomId);
      setIsConnected(true);

      if (isCreating) {
        socket.emit('create_room', { username });
      } else {
        console.log('[useRoom] Emitting join_room', { roomId, username });
        socket.emit('join_room', { roomId, username });
      }
    }

    // ----- disconnect -----------------------------------------------------
    function onDisconnect() {
      setIsConnected(false);
    }

    // ----- connect_error --------------------------------------------------
    function onConnectError() {
      setError('Could not connect to server. Please try again.');
    }

    // ----- room_created / room_joined ------------------------------------
    function onRoomCreated(payload: RoomCreatedPayload) {
      setRoomState({
        roomId: payload.roomId,
        role: payload.role,
        participants: payload.participants,
        syncState: payload.syncState,
      });
      // Update the ref so emit functions target the server-assigned roomId
      // (relevant when isCreating — the client doesn't know the roomId yet).
      roomIdRef.current = payload.roomId;
      setLastSyncEvent(payload.syncState);
    }

    function onRoomJoined(payload: RoomJoinedPayload) {
      console.log('[useRoom] room_joined received:', JSON.stringify(payload));
      console.log('[useRoom] syncState.videoId =', payload.syncState?.videoId);
      setRoomState({
        roomId: payload.roomId,
        role: payload.role,
        participants: payload.participants,
        syncState: payload.syncState,
      });
      setLastSyncEvent(payload.syncState);
    }

    // ----- user_joined ---------------------------------------------------
    function onUserJoined(payload: UserJoinedPayload) {
      setRoomState((prev) => {
        if (!prev) return prev;
        return { ...prev, participants: payload.participants };
      });
    }

    // ----- user_left -----------------------------------------------------
    function onUserLeft(payload: { userId: string; participants: Participant[] }) {
      setRoomState((prev) => {
        if (!prev) return prev;
        return { ...prev, participants: payload.participants };
      });
    }

    // ----- participant_removed -------------------------------------------
    function onParticipantRemoved(payload: { userId: string; participants: Participant[] }) {
      setRoomState((prev) => {
        if (!prev) return prev;
        return { ...prev, participants: payload.participants };
      });
    }

    // ----- role_assigned -------------------------------------------------
    function onRoleAssigned(payload: { userId: string; role: Role; participants: Participant[] }) {
      setRoomState((prev) => {
        if (!prev) return prev;
        // If this client's own role changed, update it at the top level too
        const ownRole = payload.userId === socket.id ? payload.role : prev.role;
        return { ...prev, role: ownRole, participants: payload.participants };
      });
    }

    // ----- sync_state ----------------------------------------------------
    function onSyncState(payload: SyncStatePayload) {
      console.log('[useRoom] sync_state received:', JSON.stringify(payload));
      // 1. Merge into roomState.syncState so components can read current
      //    video / play-state from roomState without extra refs.
      setRoomState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          syncState: {
            ...prev.syncState,
            ...(payload.videoId !== undefined && { videoId: payload.videoId }),
            ...(payload.playState !== undefined && { playState: payload.playState }),
            ...(payload.currentTime !== undefined && { currentTime: payload.currentTime }),
          },
        };
      });

      // 2. Always set a *new* object so the player useEffect fires on
      //    every event — even when the values are identical (see docblock).
      setLastSyncEvent({ ...payload });
    }

    // ----- you_were_removed ----------------------------------------------
    function onYouWereRemoved(payload: { message: string }) {
      setError(payload.message);
      setRoomState(null);
    }

    // ----- error ---------------------------------------------------------
    function onError(payload: { message: string }) {
      setError(payload.message);
    }

    // ── Register all listeners ──────────────────────────────────────────
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('room_created', onRoomCreated);
    socket.on('room_joined', onRoomJoined);
    socket.on('user_joined', onUserJoined);
    socket.on('user_left', onUserLeft);
    socket.on('participant_removed', onParticipantRemoved);
    socket.on('role_assigned', onRoleAssigned);
    socket.on('sync_state', onSyncState);
    socket.on('you_were_removed', onYouWereRemoved);
    socket.on('error', onError);

    // ── Open the connection (autoConnect is disabled in socket.ts) ───────
    console.log('[useRoom] Calling socket.connect(). Current connected:', socket.connected);
    // If already connected, the 'connect' event won't fire again.
    // We must emit join_room immediately in that case.
    if (socket.connected) {
      console.log('[useRoom] Socket already connected, emitting join immediately');
      if (isCreating) {
        socket.emit('create_room', { username });
      } else {
        socket.emit('join_room', { roomId, username });
      }
    }
    socket.connect();

    // ── Cleanup on unmount ──────────────────────────────────────────────
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('room_created', onRoomCreated);
      socket.off('room_joined', onRoomJoined);
      socket.off('user_joined', onUserJoined);
      socket.off('user_left', onUserLeft);
      socket.off('participant_removed', onParticipantRemoved);
      socket.off('role_assigned', onRoleAssigned);
      socket.off('sync_state', onSyncState);
      socket.off('you_were_removed', onYouWereRemoved);
      socket.off('error', onError);

      socket.emit('leave_room', { roomId: roomIdRef.current });
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Empty dep array: we register once on mount, clean up on unmount.
  // roomId, username, and isCreating are captured by closure at mount time,
  // which is correct — they never change for a given room session.

  // ── Emit functions — stable references via useCallback([]) ─────────────
  // All read roomIdRef.current to avoid stale closure over the roomId prop.

  const emitPlay = useCallback((currentTime: number) => {
    socket.emit('play', { roomId: roomIdRef.current, currentTime });
  }, []);

  const emitPause = useCallback((currentTime: number) => {
    socket.emit('pause', { roomId: roomIdRef.current, currentTime });
  }, []);

  const emitSeek = useCallback((currentTime: number) => {
    socket.emit('seek', { roomId: roomIdRef.current, currentTime });
  }, []);

  const emitChangeVideo = useCallback((videoId: string) => {
    socket.emit('change_video', { roomId: roomIdRef.current, videoId });
  }, []);

  const emitAssignRole = useCallback((userId: string, role: Role) => {
    socket.emit('assign_role', { roomId: roomIdRef.current, userId, role });
  }, []);

  const emitRemoveParticipant = useCallback((userId: string) => {
    socket.emit('remove_participant', { roomId: roomIdRef.current, userId });
  }, []);

  return {
    roomState,
    isConnected,
    error,
    lastSyncEvent,
    emitPlay,
    emitPause,
    emitSeek,
    emitChangeVideo,
    emitAssignRole,
    emitRemoveParticipant,
  };
}
