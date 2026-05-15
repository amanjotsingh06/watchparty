/**
 * ParticipantList — Renders every participant with their role badge.
 *
 * Host-only controls (assign/remove) appear on hover for eligible rows:
 *   - Never on your own row (compare participant.socketId with socket.id)
 *   - Never on the host row (hosts cannot be removed or re-assigned)
 * These constraints mirror the server-side guard clauses, so the UI never
 * presents affordances that the server would reject anyway.
 */

'use client';

import { useState } from 'react';
import socket from '@/lib/socket';
import type { Participant, Role } from '@/types';

// ─── Props ───────────────────────────────────────────────────────────────────

interface ParticipantListProps {
  participants: Participant[];
  /** The current client's role — controls which host actions are rendered */
  currentRole: Role;
  /** Emits assign_role to the server */
  onAssignRole: (userId: string, role: Role) => void;
  /** Emits remove_participant to the server */
  onRemoveParticipant: (userId: string) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Returns the first character of a username, uppercased, for the avatar. */
function avatarInitial(username: string): string {
  return (username?.[0] ?? '?').toUpperCase();
}

/** Deterministic background color per initial so every user looks distinct. */
const AVATAR_COLORS = [
  '#7c3aed', '#6d28d9', '#4f46e5', '#0891b2',
  '#059669', '#d97706', '#dc2626', '#9333ea',
];
function avatarBg(username: string): string {
  let hash = 0;
  for (let i = 0; i < username.length; i++) hash = username.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

/** Badge styling per role. */
const BADGE: Record<Role, { label: string; className: string }> = {
  host:        { label: 'Host',        className: 'badge badge-host'        },
  moderator:   { label: 'Mod',         className: 'badge badge-mod'         },
  participant: { label: 'Participant', className: 'badge badge-participant' },
};

// ─── Row ─────────────────────────────────────────────────────────────────────

interface RowProps {
  participant: Participant;
  isSelf: boolean;
  isCurrentUserHost: boolean;
  onAssignRole: (userId: string, role: Role) => void;
  onRemoveParticipant: (userId: string) => void;
}

function ParticipantRow({
  participant,
  isSelf,
  isCurrentUserHost,
  onAssignRole,
  onRemoveParticipant,
}: RowProps) {
  const [hovered, setHovered] = useState(false);

  // Host controls are shown only when: viewer is host AND this isn't themselves
  // AND this row is not the host entry (can't act on the host).
  const showControls =
    isCurrentUserHost && !isSelf && participant.role !== 'host';

  const badge = BADGE[participant.role];

  return (
    <li
      className={`participant-row${hovered && showControls ? ' participant-row--hovered' : ''}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Avatar */}
      <div
        className="participant-avatar"
        style={{ background: avatarBg(participant.username) }}
        aria-hidden="true"
      >
        {avatarInitial(participant.username)}
      </div>

      {/* Name + badge */}
      <div className="participant-info">
        <span className="participant-name">
          {participant.username}
          {isSelf && <span className="participant-you"> (you)</span>}
        </span>
        <span className={badge.className}>{badge.label}</span>
      </div>

      {/* Host controls — visible on hover */}
      {showControls && hovered && (
        <div className="participant-actions">
          {participant.role === 'participant' ? (
            <button
              className="action-btn action-btn--promote"
              title="Promote to Moderator"
              onClick={() => onAssignRole(participant.socketId, 'moderator')}
            >
              +Mod
            </button>
          ) : (
            <button
              className="action-btn action-btn--demote"
              title="Remove Moderator"
              onClick={() => onAssignRole(participant.socketId, 'participant')}
            >
              −Mod
            </button>
          )}
          <button
            className="action-btn action-btn--remove"
            title="Remove participant"
            onClick={() => onRemoveParticipant(participant.socketId)}
          >
            ✕
          </button>
        </div>
      )}
    </li>
  );
}

// ─── List ─────────────────────────────────────────────────────────────────────

export default function ParticipantList({
  participants,
  currentRole,
  onAssignRole,
  onRemoveParticipant,
}: ParticipantListProps) {
  const isCurrentUserHost = currentRole === 'host';

  return (
    <div className="pl-root">
      <header className="pl-header">
        <span className="pl-title">Participants</span>
        <span className="pl-count">{participants.length}</span>
      </header>

      <ul className="pl-list">
        {participants.map((p) => (
          <ParticipantRow
            key={p.socketId}
            participant={p}
            isSelf={p.socketId === socket.id}
            isCurrentUserHost={isCurrentUserHost}
            onAssignRole={onAssignRole}
            onRemoveParticipant={onRemoveParticipant}
          />
        ))}
      </ul>

      <style jsx>{`
        /* ── Container ─────────────────────────────────────────────────── */
        .pl-root {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #18181b; /* zinc-900 */
          border-left: 1px solid #27272a; /* zinc-800 */
        }

        /* ── Header ────────────────────────────────────────────────────── */
        .pl-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 16px 12px;
          border-bottom: 1px solid #27272a;
        }

        .pl-title {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #a1a1aa; /* zinc-400 */
        }

        .pl-count {
          font-size: 11px;
          font-weight: 600;
          background: #27272a;
          color: #a1a1aa;
          border-radius: 999px;
          padding: 1px 8px;
        }

        /* ── List ──────────────────────────────────────────────────────── */
        .pl-list {
          list-style: none;
          margin: 0;
          padding: 8px 0;
          overflow-y: auto;
          flex: 1;
        }

        /* ── Row ───────────────────────────────────────────────────────── */
        .participant-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 16px;
          border-radius: 8px;
          margin: 2px 8px;
          transition: background 0.12s;
          position: relative;
        }

        .participant-row--hovered,
        .participant-row:hover {
          background: #27272a; /* zinc-800 */
        }

        /* ── Avatar ────────────────────────────────────────────────────── */
        .participant-avatar {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 15px;
          font-weight: 700;
          color: #fff;
          flex-shrink: 0;
        }

        /* ── Info block ────────────────────────────────────────────────── */
        .participant-info {
          display: flex;
          flex-direction: column;
          gap: 3px;
          min-width: 0;
          flex: 1;
        }

        .participant-name {
          font-size: 13px;
          font-weight: 500;
          color: #e4e4e7; /* zinc-200 */
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .participant-you {
          color: #71717a; /* zinc-500 */
          font-size: 11px;
        }

        /* ── Role badges ───────────────────────────────────────────────── */
        .badge {
          display: inline-block;
          font-size: 10px;
          font-weight: 600;
          padding: 1px 7px;
          border-radius: 999px;
          width: fit-content;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .badge-host {
          background: rgba(202, 138, 4, 0.15); /* yellow tint */
          color: #facc15; /* yellow-400 */
          border: 1px solid rgba(202, 138, 4, 0.3);
        }

        .badge-mod {
          background: rgba(37, 99, 235, 0.15); /* blue tint */
          color: #60a5fa; /* blue-400 */
          border: 1px solid rgba(37, 99, 235, 0.3);
        }

        .badge-participant {
          background: rgba(63, 63, 70, 0.4); /* zinc tint */
          color: #71717a; /* zinc-500 */
          border: 1px solid #3f3f46;
        }

        /* ── Action buttons ────────────────────────────────────────────── */
        .participant-actions {
          display: flex;
          gap: 4px;
          flex-shrink: 0;
        }

        .action-btn {
          height: 24px;
          padding: 0 8px;
          border: none;
          border-radius: 5px;
          font-size: 11px;
          font-weight: 600;
          font-family: Arial, sans-serif;
          cursor: pointer;
          transition: background 0.12s;
        }

        .action-btn--promote {
          background: rgba(37, 99, 235, 0.2);
          color: #60a5fa;
        }
        .action-btn--promote:hover {
          background: rgba(37, 99, 235, 0.4);
        }

        .action-btn--demote {
          background: rgba(202, 138, 4, 0.15);
          color: #facc15;
        }
        .action-btn--demote:hover {
          background: rgba(202, 138, 4, 0.3);
        }

        .action-btn--remove {
          background: rgba(220, 38, 38, 0.15);
          color: #f87171;
        }
        .action-btn--remove:hover {
          background: rgba(220, 38, 38, 0.3);
        }
      `}</style>
    </div>
  );
}
