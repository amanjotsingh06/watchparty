/**
 * Room Page — /room/[roomId]
 *
 * Orchestrates all room-level concerns:
 *   1. Reads roomId from URL params, username from search params.
 *   2. Determines isCreating (roomId === 'new').
 *   3. Delegates ALL socket logic to useRoom hook.
 *   4. Once the server assigns a real roomId (room_created), updates the
 *      browser URL via history.replaceState without a navigation.
 *   5. For the HOST only: shows a lobby screen where they can share the
 *      room code and pick a video before going live.
 *   6. Renders RoomHeader, YoutubePlayer, VideoControls, and ParticipantList
 *      in a full-height flex layout.
 *
 * Loading state : spinner while connecting and no room yet.
 * Error state   : full-screen message with 'Back to Home' when error occurs.
 * Lobby state   : host picks a video & waits for friends (before live room).
 */

'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';

import { useRoom } from '@/hooks/useRoom';
import { extractVideoId } from '@/lib/youtube';
import YoutubePlayer from '@/components/player/YoutubePlayer';
import VideoControls from '@/components/player/VideoControls';
import RoomHeader from '@/components/room/RoomHeader';
import ParticipantList from '@/components/room/ParticipantList';

function RoomContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  // roomId from dynamic segment; username from query string
  const routeRoomId = (params.roomId as string) ?? '';
  const username = searchParams.get('username') ?? 'Guest';

  // 'new' means this client is creating the room
  const isCreating = routeRoomId === 'new';

  const {
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
  } = useRoom({ roomId: routeRoomId, username, isCreating });

  // Once the server assigns the real roomId (important for 'new' rooms),
  // silently update the URL so a refresh lands on the correct room.
  useEffect(() => {
    if (roomState?.roomId && roomState.roomId !== routeRoomId) {
      const search = searchParams.toString() ? `?${searchParams.toString()}` : '';
      window.history.replaceState(null, '', `/room/${roomState.roomId}${search}`);
    }
  }, [roomState?.roomId, routeRoomId, searchParams]);

  const canControl =
    roomState?.role === 'host' || roomState?.role === 'moderator';

  // ── Lobby state (host only) ────────────────────────────────────────────────
  const [videoConfirmed, setVideoConfirmed] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [parsedVideoId, setParsedVideoId] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  /** Parse the YouTube URL whenever it changes */
  useEffect(() => {
    if (!videoUrl.trim()) {
      setParsedVideoId(null);
      setVideoError(null);
      return;
    }
    const id = extractVideoId(videoUrl);
    if (id) {
      setParsedVideoId(id);
      setVideoError(null);
    } else {
      setParsedVideoId(null);
      setVideoError('Invalid YouTube URL');
    }
  }, [videoUrl]);

  function handleCopyInvite() {
    const code = roomState?.roomId ?? '';
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleStartParty() {
    if (!parsedVideoId) return;
    emitChangeVideo(parsedVideoId);
    setVideoConfirmed(true);
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  // Show spinner while: (a) not connected yet, OR (b) connected but waiting
  // for room_created / room_joined event (roomState still null).
  if (!roomState && !error) {
    return (
      <div className="state-screen">
        <div className="spinner" aria-label="Connecting…" />
        <p className="state-text">Connecting to room…</p>
        <style jsx>{`
          .state-screen {
            min-height: 100vh;
            background: #09090b;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 16px;
            font-family: Arial, sans-serif;
          }
          .spinner {
            width: 40px;
            height: 40px;
            border: 3px solid #27272a;
            border-top-color: #7c3aed;
            border-radius: 50%;
            animation: spin 0.7s linear infinite;
          }
          @keyframes spin { to { transform: rotate(360deg); } }
          .state-text { color: #71717a; font-size: 14px; }
        `}</style>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (error && !roomState) {
    return (
      <div className="state-screen">
        <span className="error-icon" aria-hidden="true">⚠</span>
        <h2 className="error-heading">Something went wrong</h2>
        <p className="error-msg">{error}</p>
        <button
          id="error-back-btn"
          className="error-back-btn"
          onClick={() => router.push('/')}
          type="button"
        >
          ← Back to Home
        </button>
        <style jsx>{`
          .state-screen {
            min-height: 100vh;
            background: #09090b;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 12px;
            font-family: Arial, sans-serif;
            padding: 24px;
          }
          .error-icon { font-size: 40px; color: #f87171; }
          .error-heading { font-size: 22px; font-weight: 700; color: #f4f4f5; margin: 0; }
          .error-msg { font-size: 14px; color: #a1a1aa; margin: 0; text-align: center; max-width: 360px; }
          .error-back-btn {
            margin-top: 8px;
            height: 40px;
            padding: 0 20px;
            border: 1px solid #3f3f46;
            border-radius: 8px;
            background: transparent;
            color: #a1a1aa;
            font-size: 13px;
            font-family: Arial, sans-serif;
            cursor: pointer;
            transition: color .12s, border-color .12s;
          }
          .error-back-btn:hover { color: #f4f4f5; border-color: #71717a; }
        `}</style>
      </div>
    );
  }

  // ── Lobby (host only, before video is confirmed) ─────────────────────────
  if (roomState && roomState.role === 'host' && !videoConfirmed) {
    const resolvedRoomId = roomState.roomId;
    const participantCount = roomState.participants.length;

    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-6 py-12">
        {/* Decorative background blobs */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0" aria-hidden="true">
          <div className="absolute -top-32 -left-28 w-[420px] h-[420px] rounded-full bg-[radial-gradient(circle,#7c3aed,#4f46e5)] blur-[90px] opacity-25" />
          <div className="absolute -bottom-20 -right-20 w-[340px] h-[340px] rounded-full bg-[radial-gradient(circle,#6d28d9,#3730a3)] blur-[90px] opacity-25" />
        </div>

        <div className="relative z-10 w-full max-w-lg flex flex-col items-center gap-8">

          {/* ── Room Created heading ──────────────────────────────────── */}
          <div className="text-center">
            <h1 className="text-3xl font-extrabold text-zinc-100 mb-1">🎉 Room Created!</h1>
            <p className="text-sm text-zinc-500">Share the code below with your friends</p>
          </div>

          {/* ── Room code + copy button ──────────────────────────────── */}
          <div className="flex flex-col items-center gap-3">
            <div className="bg-zinc-800 px-6 py-3 rounded-xl">
              <span className="text-5xl font-black tracking-widest font-mono text-zinc-100 select-all">
                {resolvedRoomId}
              </span>
            </div>
            <button
              id="lobby-copy-btn"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-300 hover:text-white hover:border-zinc-500 transition-colors duration-150 cursor-pointer"
              onClick={handleCopyInvite}
              type="button"
            >
              {copied ? (
                <>
                  <span className="text-green-400">✓</span>
                  <span className="text-green-400">Copied!</span>
                </>
              ) : (
                <>
                  <span>📋</span>
                  <span>Copy room code</span>
                </>
              )}
            </button>
          </div>

          {/* ── Divider ──────────────────────────────────────────────── */}
          <div className="w-full h-px bg-zinc-800" />

          {/* ── Video picker ─────────────────────────────────────────── */}
          <div className="w-full flex flex-col gap-4">
            <h2 className="text-lg font-bold text-zinc-200 text-center">Pick a video to watch</h2>

            <div className="flex flex-col gap-1.5">
              <input
                id="lobby-video-input"
                type="text"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition-colors duration-150 focus:border-violet-500 focus:shadow-[0_0_0_2px_rgba(124,58,237,0.22)]"
                placeholder="Paste a YouTube URL or video ID…"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleStartParty(); }}
                autoComplete="off"
              />
              {videoError && (
                <p className="text-xs text-red-400" role="alert">{videoError}</p>
              )}
            </div>

            {/* Thumbnail preview */}
            {parsedVideoId && (
              <div className="rounded-xl overflow-hidden border border-zinc-800">
                <img
                  src={`https://img.youtube.com/vi/${parsedVideoId}/hqdefault.jpg`}
                  alt="Video thumbnail preview"
                  className="w-full aspect-video object-cover"
                />
              </div>
            )}

            {/* Start Party button */}
            <button
              id="lobby-start-btn"
              className={`w-full py-3 rounded-xl font-bold text-[15px] tracking-wide border-none transition-all duration-150 shadow-[0_4px_24px_rgba(124,58,237,0.35)] ${parsedVideoId
                ? 'bg-violet-600 hover:bg-violet-500 text-white cursor-pointer active:scale-[0.98]'
                : 'bg-violet-600/50 text-white/50 opacity-50 cursor-not-allowed'
                }`}
              onClick={handleStartParty}
              disabled={!parsedVideoId}
              type="button"
            >
              🚀 Start Party
            </button>
          </div>

          {/* ── Participant counter ──────────────────────────────────── */}
          <p className="text-sm text-zinc-500">
            <span className="text-zinc-300 font-semibold">{participantCount}</span>
            {participantCount === 1 ? ' person' : ' people'} in the room
          </p>
        </div>
      </div>
    );
  }

  // ── Main room layout ─────────────────────────────────────────────────────
  return (
    <div className="room-root">
      {/* Top bar */}
      {roomState && (
        <RoomHeader roomId={roomState.roomId} myRole={roomState.role} />
      )}

      {/* Body: player column + sidebar */}
      <div className="room-body">
        {/* ── Left: video + controls + role hint ── */}
        <div className="room-player-col">
          <YoutubePlayer
            videoId={roomState?.syncState?.videoId || parsedVideoId || ''}
            canControl={canControl}
            lastSyncEvent={lastSyncEvent}
            onPlay={emitPlay}
            onPause={emitPause}
            onSeek={emitSeek}
          />

          {/* VideoControls renders null for participants */}
          <VideoControls canControl={canControl} onChangeVideo={emitChangeVideo} />

          {/* Role hint for participants */}
          {roomState?.role === 'participant' && (
            <p className="role-hint">
              👀 You&apos;re watching as a participant. Only the host and moderators
              can control playback.
            </p>
          )}
        </div>

        {/* ── Right: participant sidebar ── */}
        <div className="room-sidebar">
          {roomState && (
            <ParticipantList
              participants={roomState.participants}
              currentRole={roomState.role}
              onAssignRole={emitAssignRole}
              onRemoveParticipant={emitRemoveParticipant}
            />
          )}
        </div>
      </div>

      <style jsx>{`
        /* ── Root ───────────────────────────────────────────────── */
        .room-root {
          display: flex;
          flex-direction: column;
          height: 100vh;
          overflow: hidden;
          background: #09090b; /* zinc-950 */
          font-family: Arial, sans-serif;
        }

        /* ── Body ───────────────────────────────────────────────── */
        .room-body {
          display: flex;
          flex: 1;
          overflow: hidden;
        }

        /* ── Player column ──────────────────────────────────────── */
        .room-player-col {
          flex: 1;
          display: flex;
          flex-direction: column;
          padding: 20px;
          gap: 0;
          overflow-y: auto;
          min-width: 0;
        }

        /* ── Role hint ──────────────────────────────────────────── */
        .role-hint {
          font-size: 13px;
          color: #71717a; /* zinc-500 */
          margin: 14px 0 0;
          padding: 10px 14px;
          background: #18181b; /* zinc-900 */
          border: 1px solid #27272a;
          border-radius: 8px;
          line-height: 1.5;
        }

        /* ── Sidebar ────────────────────────────────────────────── */
        .room-sidebar {
          width: 288px;
          flex-shrink: 0;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
        }

        /* Responsive: on narrow viewports stack vertically */
        @media (max-width: 720px) {
          .room-body { flex-direction: column; overflow-y: auto; }
          .room-sidebar { width: 100%; height: 220px; flex-shrink: 0; }
        }
      `}</style>
    </div>
  );
}

/* ── Page export — wraps in Suspense for useSearchParams SSR ─────────── */
export default function RoomPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-4">
          <div className="w-10 h-10 border-[3px] border-zinc-800 border-t-violet-600 rounded-full animate-spin" />
          <p className="text-zinc-500 text-sm">Entering the party…</p>
        </div>
      }
    >
      <RoomContent />
    </Suspense>
  );
}
