/**
 * YoutubePlayer — Embeds the YouTube IFrame API player and keeps it
 * synchronised with the server's authoritative playback state.
 *
 * KEY DESIGN DECISIONS:
 *  1. Player is created ONCE and never destroyed/recreated for video changes.
 *     Video changes use cueVideoById/loadVideoById on the existing player.
 *     This avoids all DOM-replacement issues with React refs.
 *  2. controls: 1 for ALL users. controls:0 causes YouTube to render no
 *     thumbnail — just black. Participant interaction is blocked by the
 *     onStateChange guard (canControlRef) — not by hiding controls.
 *  3. The participant overlay uses pointer-events:none so it doesn't
 *     interfere with the iframe's compositor layer.
 *  4. Anti-echo pattern prevents infinite sync loops.
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import type { SyncStatePayload } from '@/types';

declare global {
  interface Window {
    onYouTubeIframeAPIReady: (() => void) | undefined;
    _ytApiReadyCallbacks?: (() => void)[];
  }
}

interface YoutubePlayerProps {
  videoId: string;
  canControl: boolean;
  lastSyncEvent: SyncStatePayload | null;
  onPlay: (currentTime: number) => void;
  onPause: (currentTime: number) => void;
  onSeek: (currentTime: number) => void;
}

export default function YoutubePlayer({
  videoId,
  canControl,
  lastSyncEvent,
  onPlay,
  onPause,
  onSeek,
}: YoutubePlayerProps) {
  const playerRef = useRef<YT.Player | null>(null);
  const applyingServerSync = useRef(false);
  const currentLoadedVideoId = useRef('');
  const onPlayRef = useRef(onPlay);
  onPlayRef.current = onPlay;
  const onPauseRef = useRef(onPause);
  onPauseRef.current = onPause;
  const onSeekRef = useRef(onSeek);
  onSeekRef.current = onSeek;
  const canControlRef = useRef(canControl);
  canControlRef.current = canControl;

  const lastSyncEventRef = useRef(lastSyncEvent);
  lastSyncEventRef.current = lastSyncEvent;

  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [ytApiReady, setYtApiReady] = useState(false);

  // Stable unique ID for the player div — survives re-renders
  const [containerId] = useState(
    () => `yt-player-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  );

  // ── Load the YouTube IFrame API script ───────────────────────────────────
  useEffect(() => {
    if (window.YT?.Player) {
      setYtApiReady(true);
      return;
    }
    if (!window._ytApiReadyCallbacks) window._ytApiReadyCallbacks = [];
    const cb = () => setYtApiReady(true);
    window._ytApiReadyCallbacks.push(cb);

    if (!document.getElementById('yt-iframe-api')) {
      const script = document.createElement('script');
      script.id = 'yt-iframe-api';
      script.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(script);
      window.onYouTubeIframeAPIReady = () => {
        window._ytApiReadyCallbacks?.forEach((fn) => fn());
        window._ytApiReadyCallbacks = [];
      };
    } else if (window.YT?.Player) {
      setYtApiReady(true);
    }

    return () => {
      if (window._ytApiReadyCallbacks) {
        window._ytApiReadyCallbacks = window._ytApiReadyCallbacks.filter((fn) => fn !== cb);
      }
    };
  }, []);

  // Fallback poll
  useEffect(() => {
    if (ytApiReady) return;
    const interval = setInterval(() => {
      if (window.YT?.Player) { setYtApiReady(true); clearInterval(interval); }
    }, 200);
    return () => clearInterval(interval);
  }, [ytApiReady]);

  // ── Create the player ONCE ──────────────────────────────────────────────
  useEffect(() => {
    if (!ytApiReady) return;
    if (playerRef.current) return; // already created

    const el = document.getElementById(containerId);
    if (!el) return;

    console.log('[YT] Creating player, containerId:', containerId, 'videoId:', videoId);

    playerRef.current = new window.YT.Player(containerId, {
      width: '100%',
      height: '100%',
      ...(videoId ? { videoId } : {}),
      playerVars: {
        controls: 1,
        disablekb: canControlRef.current ? 0 : 1,
        rel: 0,
        modestbranding: 1,
        origin: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
        start: lastSyncEvent ? Math.floor(lastSyncEvent.currentTime ?? 0) : 0,
      },
      events: {
        onReady: (event: YT.PlayerEvent) => {
          console.log('[YT] Player ready');
          // Mute participants so browser autoplay policy doesn't block synchronized playback
          if (!canControlRef.current) {
            event.target.mute();
          }
          currentLoadedVideoId.current = videoId || '';
          setIsPlayerReady(true);
        },
        onStateChange: (event: YT.OnStateChangeEvent) => {
          if (applyingServerSync.current) return;
          
          if (!canControlRef.current) {
            // Participant rubber-banding:
            // If they manually click play/pause, immediately revert to server state
            const serverState = lastSyncEventRef.current;
            if (!serverState) return;
            
            if (event.data === window.YT.PlayerState.PLAYING && serverState.playState === 'paused') {
              event.target.pauseVideo();
              if (serverState.currentTime !== undefined) {
                event.target.seekTo(serverState.currentTime, true);
              }
            } else if (event.data === window.YT.PlayerState.PAUSED && serverState.playState === 'playing') {
              event.target.playVideo();
            }
            return;
          }

          const time = event.target.getCurrentTime();
          if (event.data === window.YT.PlayerState.PLAYING) onPlayRef.current(time);
          else if (event.data === window.YT.PlayerState.PAUSED) onPauseRef.current(time);
        },
      },
    });

    return () => {
      if (playerRef.current) {
        // Grab the parent before destroy removes the iframe from the DOM
        const iframe = document.getElementById(containerId);
        const parent = iframe?.parentElement;

        try { playerRef.current.destroy(); } catch { /* noop */ }
        playerRef.current = null;
        setIsPlayerReady(false);

        // After destroy(), the div/iframe with our ID is gone from the DOM.
        // React Strict Mode will re-run this effect — it needs a fresh div
        // with the same ID to attach the new player to.
        if (parent && !document.getElementById(containerId)) {
          const div = document.createElement('div');
          div.id = containerId;
          parent.appendChild(div);
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ytApiReady, containerId]);

  // ── Apply server sync events ────────────────────────────────────────────
  useEffect(() => {
    if (!lastSyncEvent || !isPlayerReady || !playerRef.current) return;

    const player = playerRef.current;
    const { videoId: syncVideoId, playState, currentTime } = lastSyncEvent;

    applyingServerSync.current = true;

    console.log('[YT] Sync Event:', {
      syncVideoId,
      playState,
      currentTime,
      currentLoadedVideoId: currentLoadedVideoId.current
    });

    // 1. Handle video changes
    if (syncVideoId && syncVideoId !== currentLoadedVideoId.current) {
      console.log(`[YT] Changing video to ${syncVideoId} (start: ${currentTime})`);
      applyingServerSync.current = true;
      
      // If the server expects the video to be paused (default for new videos),
      // we use cueVideoById to load the thumbnail/metadata safely without autoplaying.
      // If it expects it to be playing, we use loadVideoById.
      // Calling pauseVideo() right after loadVideoById causes the black screen hang.
      if (playState === 'paused') {
        player.cueVideoById({ videoId: syncVideoId, startSeconds: currentTime ?? 0 });
      } else {
        player.loadVideoById({ videoId: syncVideoId, startSeconds: currentTime ?? 0 });
      }
      
      currentLoadedVideoId.current = syncVideoId;
      
      // Clear anti-echo and return early.
      setTimeout(() => { applyingServerSync.current = false; }, 500);
      return;
    }

    // 2. Handle drift correction (only if we didn't just load the video)
    if (currentTime !== undefined) {
      const localTime = player.getCurrentTime?.() ?? 0;
      const state = player.getPlayerState?.();
      
      // Prevent seeking if the player hasn't loaded metadata yet.
      // Calling seekTo on an unstarted (-1) or cued (5) player causes "An error occurred".
      if (state !== -1 && state !== 5) {
        if (Math.abs(localTime - currentTime) > 2) {
          player.seekTo(currentTime, true);
        }
      }
    }

    // 3. Handle play/pause state
    if (playState === 'playing') {
      player.playVideo();
    } else if (playState === 'paused') {
      player.pauseVideo();
    }

    setTimeout(() => { applyingServerSync.current = false; }, 300);
  }, [lastSyncEvent, isPlayerReady]);

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden">
      <div id={containerId} />
      {!canControl && (
        <div
          className="absolute inset-0 z-10"
          style={{ pointerEvents: 'none' }}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
