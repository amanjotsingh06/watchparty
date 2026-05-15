/**
 * Join Page — /join?room=ROOMCODE
 *
 * Handles invite links. Reads the room code from the URL, shows it
 * prominently, asks for a username, and navigates to the room.
 * No role selection — the backend assigns "participant" on join.
 */

'use client';

import { Suspense } from 'react';
import { useState, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

/* ── Inner component (needs useSearchParams → must be inside Suspense) ── */
function JoinForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const initialCode  = (searchParams.get('room') ?? '').toUpperCase();

  const [username, setUsername] = useState('');
  const [roomCode]             = useState(initialCode);
  const [error, setError]      = useState<string | null>(null);

  const usernameRef = useRef<HTMLInputElement>(null);

  // Autofocus the username input on mount
  useEffect(() => {
    usernameRef.current?.focus();
  }, []);

  function handleSubmit() {
    if (!username.trim()) {
      setError('Please enter a username.');
      return;
    }
    if (!roomCode.trim()) {
      setError('Room code is missing.');
      return;
    }
    setError(null);
    router.push(
      `/room/${roomCode.trim().toUpperCase()}?username=${encodeURIComponent(username.trim())}`,
    );
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSubmit();
  }

  return (
    <>
      {/* ── Decorative background blobs ─────────────────────────────── */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0" aria-hidden="true">
        <div className="absolute -top-20 -right-16 w-[450px] h-[450px] rounded-full bg-[radial-gradient(circle,#7c3aed,#4f46e5)] blur-[90px] opacity-30" />
        <div className="absolute -bottom-16 -left-16 w-[350px] h-[350px] rounded-full bg-[radial-gradient(circle,#6d28d9,#3730a3)] blur-[90px] opacity-30" />
      </div>

      {/* ── Main layout ─────────────────────────────────────────────── */}
      <main className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6">

        {/* Brand */}
        <div className="flex items-center gap-2.5 mb-2">
          <span
            className="flex items-center justify-center w-9 h-9 rounded-lg bg-violet-600 text-white text-base drop-shadow-[0_0_12px_rgba(124,58,237,0.8)]"
            aria-hidden="true"
          >
            ▶
          </span>
          <span className="text-[28px] font-extrabold bg-gradient-to-br from-zinc-200 via-zinc-100 to-violet-400 bg-clip-text text-transparent">
            WatchParty
          </span>
        </div>
        <p className="text-sm text-zinc-500 mb-7">You&apos;ve been invited to a watch party!</p>

        {/* Card */}
        <div className="w-full max-w-[400px] bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-[0_24px_80px_rgba(0,0,0,0.6),0_0_0_1px_rgba(124,58,237,0.08)]">

          {/* Room code display */}
          <div className="text-center mb-6">
            <p className="text-sm text-zinc-400 mb-2">You&apos;re joining room</p>
            <span className="inline-block text-3xl font-black tracking-widest font-mono text-zinc-100 bg-zinc-800 px-5 py-2 rounded-xl select-all">
              {roomCode || '------'}
            </span>
          </div>

          {/* Fields */}
          <div className="flex flex-col gap-4">
            {/* Username */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-400 tracking-wide" htmlFor="jp-username">
                Your Name
              </label>
              <input
                ref={usernameRef}
                id="jp-username"
                type="text"
                className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition-colors duration-150 focus:border-violet-500 focus:shadow-[0_0_0_2px_rgba(124,58,237,0.22)]"
                placeholder="Enter your name"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setError(null); }}
                onKeyDown={handleKeyDown}
                autoComplete="off"
                maxLength={24}
              />
            </div>

            {/* Inline error */}
            {error && (
              <p className="text-xs text-red-400 m-0" role="alert">{error}</p>
            )}

            {/* Join button */}
            <button
              id="jp-join-btn"
              className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-[15px] tracking-wide border-none cursor-pointer transition-all duration-150 shadow-[0_4px_24px_rgba(124,58,237,0.35)] active:scale-[0.98] mt-1"
              onClick={handleSubmit}
              type="button"
            >
              → Join Party
            </button>

            {/* Back to home link */}
            <button
              id="jp-back-btn"
              className="mt-1 text-sm text-zinc-500 hover:text-zinc-300 transition-colors duration-150 cursor-pointer bg-transparent border-none text-center"
              onClick={() => router.push('/')}
              type="button"
            >
              ← Back to Home
            </button>
          </div>
        </div>
      </main>
    </>
  );
}

/* ── Page export — wraps in Suspense for useSearchParams SSR ─────────── */
export default function JoinPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
          <p className="text-zinc-500 text-sm">Loading…</p>
        </div>
      }
    >
      <JoinForm />
    </Suspense>
  );
}
