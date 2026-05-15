/**
 * RoomHeader — displays the room code, the current user's role, a live
 * indicator, and a 'Copy Invite Link' button that copies the join link
 * to clipboard.
 */

'use client';

import { useState } from 'react';
import type { Role } from '@/types';

// ─── Props ───────────────────────────────────────────────────────────────────

interface RoomHeaderProps {
  roomId: string;
  myRole: Role;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ROLE_STYLE: Record<Role, string> = {
  host: 'role-host',
  moderator: 'role-mod',
  participant: 'role-participant',
};

const ROLE_LABEL: Record<Role, string> = {
  host: 'Host',
  moderator: 'Moderator',
  participant: 'Participant',
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function RoomHeader({ roomId, myRole }: RoomHeaderProps) {
  const [copied, setCopied] = useState(false);

  function handleInvite() {
    navigator.clipboard.writeText(roomId).then(() => {
      setCopied(true);
      // Reset 'Copied!' label after 2 s
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <header className="rh-root">
      {/* Left: room code + live indicator */}
      <div className="rh-left">
        <span className="rh-live-dot" aria-label="Live" />
        <span className="rh-label">Room</span>
        <code className="rh-code">{roomId}</code>
      </div>

      {/* Right: role badge + invite button */}
      <div className="rh-right">
        <span className={`rh-role ${ROLE_STYLE[myRole]}`}>
          {ROLE_LABEL[myRole]}
        </span>

        <button
          id="invite-btn"
          className="rh-invite-btn"
          onClick={handleInvite}
          type="button"
        >
          {copied ? (
            <>
              {/* Checkmark icon */}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>Copied!</span>
            </>
          ) : (
            <>
              {/* Copy / share icon */}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              <span>Copy Room Code</span>
            </>
          )}
        </button>
      </div>

      <style jsx>{`
        /* ── Root bar ──────────────────────────────────────────────────── */
        .rh-root {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 20px;
          height: 56px;
          background: #18181b; /* zinc-900 */
          border-bottom: 1px solid #27272a; /* zinc-800 */
          flex-shrink: 0;
        }

        /* ── Left side ─────────────────────────────────────────────────── */
        .rh-left {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        /* Pulsing green dot */
        .rh-live-dot {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          background: #22c55e; /* green-500 */
          box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.5);
          animation: pulse-dot 2s infinite;
          flex-shrink: 0;
        }

        @keyframes pulse-dot {
          0%   { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.5); }
          70%  { box-shadow: 0 0 0 6px rgba(34, 197, 94, 0);  }
          100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0);    }
        }

        .rh-label {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #71717a; /* zinc-500 */
        }

        /* Prominent monospace room code in a badge */
        .rh-code {
          font-family: 'Courier New', Courier, monospace;
          font-size: 20px;          /* text-xl */
          font-weight: 900;         /* font-black */
          letter-spacing: 0.15em;   /* tracking-widest */
          color: #f4f4f5;           /* zinc-100 */
          background: #27272a;      /* zinc-800 */
          border: 1px solid #52525b; /* zinc-600 */
          padding: 4px 16px;        /* px-4 py-1.5 */
          border-radius: 8px;       /* rounded-lg */
          user-select: all;
        }

        /* ── Right side ─────────────────────────────────────────────────── */
        .rh-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        /* Role pill */
        .rh-role {
          font-size: 11px;
          font-weight: 700;
          padding: 3px 10px;
          border-radius: 999px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .role-host {
          background: rgba(202, 138, 4, 0.15);
          color: #facc15; /* yellow-400 */
          border: 1px solid rgba(202, 138, 4, 0.3);
        }

        .role-mod {
          background: rgba(37, 99, 235, 0.15);
          color: #60a5fa; /* blue-400 */
          border: 1px solid rgba(37, 99, 235, 0.3);
        }

        .role-participant {
          background: rgba(63, 63, 70, 0.4);
          color: #a1a1aa; /* zinc-400 */
          border: 1px solid #3f3f46;
        }

        /* Invite button — prominent with icon */
        .rh-invite-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          height: 34px;
          padding: 0 14px;
          background: rgba(124, 58, 237, 0.2);  /* violet-600/20 */
          border: 1px solid rgba(124, 58, 237, 0.3);
          border-radius: 8px;
          color: #c4b5fd; /* violet-300 */
          font-size: 13px;
          font-weight: 600;
          font-family: Arial, sans-serif;
          cursor: pointer;
          white-space: nowrap;
          min-width: 88px;
          transition: background 0.15s, color 0.15s, border-color 0.15s, transform 0.1s;
        }

        .rh-invite-btn:hover {
          background: rgba(124, 58, 237, 0.5);  /* violet-600/50 */
          color: #ede9fe; /* violet-100 */
          border-color: rgba(124, 58, 237, 0.5);
        }

        .rh-invite-btn:active {
          transform: scale(0.97);
        }
      `}</style>
    </header>
  );
}
