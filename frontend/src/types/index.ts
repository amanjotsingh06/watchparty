// ─── Role ───────────────────────────────────────────────────────────────────
export type Role = 'host' | 'moderator' | 'participant';

// ─── Core entities ──────────────────────────────────────────────────────────
export interface Participant {
  socketId: string;
  username: string;
  role: Role;
}

export interface SyncState {
  videoId: string;
  playState: 'playing' | 'paused';
  currentTime: number;
}

export interface RoomState {
  roomId: string;
  role: Role;
  participants: Participant[];
  syncState: SyncState;
}

// ─── Socket payload types (S→Client) ────────────────────────────────────────

/** Broadcast whenever the server's authoritative playback state changes. */
export interface SyncStatePayload {
  videoId?: string;
  playState?: 'playing' | 'paused';
  currentTime?: number;
  /** socketId of the client that triggered the event */
  triggeredBy?: string;
}

/** Sent only to the socket that just created a room. */
export interface RoomCreatedPayload {
  roomId: string;
  role: Role;
  participants: Participant[];
  syncState: SyncState;
}

/** Sent only to the socket that just joined an existing room. */
export interface RoomJoinedPayload {
  roomId: string;
  role: Role;
  participants: Participant[];
  syncState: SyncState;
}

/** Broadcast to all existing members when a new participant joins. */
export interface UserJoinedPayload {
  username: string;
  userId: string;   // socketId of the new participant
  role: Role;
  participants: Participant[];
}
