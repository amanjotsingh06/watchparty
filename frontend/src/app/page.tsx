/**
 * Landing page — lets a user create a new room or join an existing one.
 *
 * Role is determined by action, NOT by user selection:
 *   • Create Room → Host  (backend assigns on room creation)
 *   • Join Room   → Participant (backend assigns on room join)
 *
 * Create: navigates to /room/new?username=NAME
 * Join  : navigates to /room/ROOMCODE?username=NAME
 *
 * Background: zinc-950 with decorative violet/indigo glow blobs that are
 * purely visual (pointer-events-none) and never block interaction.
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Tab = 'create' | 'join';

export default function LandingPage() {
  const router = useRouter();

  const [tab, setTab]           = useState<Tab>('create');
  const [username, setUsername] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [error, setError]       = useState<string | null>(null);

  /* ── Validation ────────────────────────────────────────────────────── */
  function validate(): boolean {
    if (!username.trim()) {
      setError('Please enter a username.');
      return false;
    }
    if (tab === 'join' && !roomCode.trim()) {
      setError('Please enter a room code.');
      return false;
    }
    setError(null);
    return true;
  }

  /* ── Submit ────────────────────────────────────────────────────────── */
  function handleSubmit() {
    if (!validate()) return;

    const name = encodeURIComponent(username.trim());
    if (tab === 'create') {
      router.push(`/room/new?username=${name}`);
    } else {
      router.push(`/room/${roomCode.trim().toUpperCase()}?username=${name}`);
    }
  }

  /* ── Enter key shortcut ────────────────────────────────────────────── */
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSubmit();
  }

  return (
    <>
      {/* ── Decorative background blobs ─────────────────────────────── */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0" aria-hidden="true">
        <div className="absolute -top-32 -left-28 w-[520px] h-[520px] rounded-full bg-[radial-gradient(circle,#7c3aed,#4f46e5)] blur-[90px] opacity-35 animate-[blob-float_14s_ease-in-out_infinite_alternate]" />
        <div className="absolute -bottom-20 -right-20 w-[400px] h-[400px] rounded-full bg-[radial-gradient(circle,#6d28d9,#3730a3)] blur-[90px] opacity-35 animate-[blob-float_18s_ease-in-out_infinite_alternate-reverse]" />
      </div>

      {/* ── Main layout ─────────────────────────────────────────────── */}
      <main className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6">

        {/* Brand */}
        <div className="flex items-center gap-3 mb-2">
          <span
            className="flex items-center justify-center w-10 h-10 rounded-lg bg-violet-600 text-white text-lg drop-shadow-[0_0_12px_rgba(124,58,237,0.8)]"
            aria-hidden="true"
          >
            ▶
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-br from-zinc-200 via-zinc-100 to-violet-400 bg-clip-text text-transparent">
            WatchParty
          </h1>
        </div>
        <p className="text-zinc-500 text-[15px] mb-9 text-center">
          Watch YouTube together, in real time.
        </p>

        {/* Card */}
        <div className="w-full max-w-[420px] bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-[0_24px_80px_rgba(0,0,0,0.6),0_0_0_1px_rgba(124,58,237,0.08)]">

          {/* Tab toggle */}
          <div className="flex bg-zinc-800 rounded-xl p-1 gap-1 mb-6" role="tablist">
            <button
              id="tab-create"
              role="tab"
              aria-selected={tab === 'create'}
              className={`flex-1 h-9 rounded-lg text-sm font-semibold transition-colors duration-150 cursor-pointer ${
                tab === 'create'
                  ? 'bg-violet-600 text-white'
                  : 'bg-transparent text-zinc-400 hover:text-zinc-300'
              }`}
              onClick={() => { setTab('create'); setError(null); }}
              type="button"
            >
              Create Room
            </button>
            <button
              id="tab-join"
              role="tab"
              aria-selected={tab === 'join'}
              className={`flex-1 h-9 rounded-lg text-sm font-semibold transition-colors duration-150 cursor-pointer ${
                tab === 'join'
                  ? 'bg-violet-600 text-white'
                  : 'bg-transparent text-zinc-400 hover:text-zinc-300'
              }`}
              onClick={() => { setTab('join'); setError(null); }}
              type="button"
            >
              Join Room
            </button>
          </div>

          {/* Fields */}
          <div className="flex flex-col gap-4">
            {/* Username */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-400 tracking-wide" htmlFor="lp-username">
                Username
              </label>
              <input
                id="lp-username"
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

            {/* Room code — only when joining */}
            {tab === 'join' && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-400 tracking-wide" htmlFor="lp-roomcode">
                  Room Code
                </label>
                <input
                  id="lp-roomcode"
                  type="text"
                  className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none font-mono tracking-widest uppercase transition-colors duration-150 focus:border-violet-500 focus:shadow-[0_0_0_2px_rgba(124,58,237,0.22)]"
                  placeholder="e.g. AB12CD"
                  value={roomCode}
                  onChange={(e) => { setRoomCode(e.target.value.toUpperCase()); setError(null); }}
                  onKeyDown={handleKeyDown}
                  autoComplete="off"
                  maxLength={6}
                />
              </div>
            )}

            {/* Inline error */}
            {error && (
              <p className="text-xs text-red-400 m-0" role="alert">{error}</p>
            )}

            {/* Submit */}
            <button
              id="lp-submit-btn"
              className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-[15px] tracking-wide border-none cursor-pointer transition-all duration-150 shadow-[0_4px_24px_rgba(124,58,237,0.35)] active:scale-[0.98] mt-1"
              onClick={handleSubmit}
              type="button"
            >
              {tab === 'create' ? '✦ Create Room' : '→ Join Room'}
            </button>
          </div>
        </div>
      </main>

      {/* ── Blob animation keyframes ────────────────────────────────── */}
      <style jsx>{`
        @keyframes blob-float {
          from { transform: translate(0, 0) scale(1); }
          to   { transform: translate(30px, 20px) scale(1.08); }
        }
      `}</style>
    </>
  );
}
