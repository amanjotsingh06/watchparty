/**
 * VideoControls — Renders a YouTube URL / video-ID input for hosts and
 * moderators.  Returns null for participants (no control permission).
 *
 * The component intentionally owns no socket logic; the parent passes
 * onChangeVideo (wired to emitChangeVideo from useRoom) so this component
 * stays pure and easily testable.
 */

'use client';

import { useState, type KeyboardEvent } from 'react';
import { extractVideoId } from '@/lib/youtube';

// ─── Props ───────────────────────────────────────────────────────────────────

interface VideoControlsProps {
  /** True for host or moderator — participants receive false and see nothing */
  canControl: boolean;
  /** Called with the extracted video ID on a valid submit */
  onChangeVideo: (videoId: string) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function VideoControls({ canControl, onChangeVideo }: VideoControlsProps) {
  // Guard: participants see no controls at all
  if (!canControl) return null;

  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  /** Parse input and call onChangeVideo, or display an error message. */
  function handleSubmit() {
    const videoId = extractVideoId(input.trim());
    if (!videoId) {
      setError('Invalid YouTube URL or video ID. Please try again.');
      return;
    }
    onChangeVideo(videoId);
    setInput('');
    setError(null);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleSubmit();
  }

  return (
    <div className="video-controls-root">
      <label className="video-controls-label" htmlFor="video-url-input">
        Change Video
      </label>

      <div className="video-controls-row">
        <input
          id="video-url-input"
          type="text"
          className="video-controls-input"
          placeholder="YouTube URL or video ID"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            if (error) setError(null); // clear error on new typing
          }}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          spellCheck={false}
        />

        <button
          id="video-load-btn"
          className="video-controls-btn"
          onClick={handleSubmit}
          type="button"
        >
          Load
        </button>
      </div>

      {error && (
        <p className="video-controls-error" role="alert">
          {error}
        </p>
      )}

      <style jsx>{`
        .video-controls-root {
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding: 12px 16px;
          background: #18181b; /* zinc-900 */
          border: 1px solid #3f3f46; /* zinc-700 */
          border-radius: 10px;
          margin-top: 12px;
        }

        .video-controls-label {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #a1a1aa; /* zinc-400 */
          user-select: none;
        }

        .video-controls-row {
          display: flex;
          gap: 8px;
        }

        .video-controls-input {
          flex: 1;
          min-width: 0;
          height: 38px;
          padding: 0 12px;
          background: #27272a; /* zinc-800 */
          border: 1px solid #3f3f46; /* zinc-700 */
          border-radius: 7px;
          color: #f4f4f5; /* zinc-100 */
          font-size: 14px;
          font-family: Arial, sans-serif;
          outline: none;
          transition: border-color 0.15s;
        }

        .video-controls-input::placeholder {
          color: #52525b; /* zinc-600 */
        }

        .video-controls-input:focus {
          border-color: #7c3aed; /* violet-700 */
          box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.2);
        }

        .video-controls-btn {
          height: 38px;
          padding: 0 18px;
          background: #7c3aed; /* violet-700 */
          border: none;
          border-radius: 7px;
          color: #fff;
          font-size: 14px;
          font-weight: 600;
          font-family: Arial, sans-serif;
          cursor: pointer;
          white-space: nowrap;
          transition: background 0.15s, transform 0.1s;
        }

        .video-controls-btn:hover {
          background: #6d28d9; /* violet-800 */
        }

        .video-controls-btn:active {
          transform: scale(0.97);
        }

        .video-controls-error {
          font-size: 12px;
          color: #f87171; /* red-400 */
          margin: 0;
        }
      `}</style>
    </div>
  );
}
