/**
 * Extracts a YouTube video ID from a variety of input formats.
 *
 * Supported formats:
 *   - https://www.youtube.com/watch?v=VIDEO_ID
 *   - https://youtu.be/VIDEO_ID
 *   - https://www.youtube.com/embed/VIDEO_ID
 *   - Bare 11-character ID  (alphanumeric, underscore, hyphen)
 *
 * Returns null for any input that cannot be resolved to a valid ID.
 */
export function extractVideoId(input: string): string | null {
  if (!input || typeof input !== 'string') return null;

  const trimmed = input.trim();

  // ── 1. URL Parsing ──────────────────────────────────────────────
  try {
    let urlToParse = trimmed;
    // Forgive missing protocols (e.g., "youtube.com/watch?v=...")
    if (!/^https?:\/\//i.test(trimmed) && (trimmed.includes('youtube.com') || trimmed.includes('youtu.be'))) {
      urlToParse = 'https://' + trimmed;
    }

    const url = new URL(urlToParse);
    const host = url.hostname.replace(/^www\./, '');

    // ── youtube.com/watch?v=ID
    if (host === 'youtube.com' && url.pathname === '/watch') {
      const v = url.searchParams.get('v');
      if (v && isValidId(v)) return v;
    }

    // ── 2. youtu.be/ID ──────────────────────────────────────────────────────
    if (host === 'youtu.be') {
      const id = url.pathname.slice(1); // strip leading "/"
      if (isValidId(id)) return id;
    }

    // ── 3. youtube.com/embed/ID ─────────────────────────────────────────────
    if (host === 'youtube.com' && url.pathname.startsWith('/embed/')) {
      const id = url.pathname.split('/embed/')[1]?.split('/')[0] ?? '';
      if (isValidId(id)) return id;
    }

    // ── 4. youtube.com/shorts/ID ────────────────────────────────────────────
    if (host === 'youtube.com' && url.pathname.startsWith('/shorts/')) {
      const id = url.pathname.split('/shorts/')[1]?.split('/')[0] ?? '';
      if (isValidId(id)) return id;
    }
  } catch {
    // Not a valid URL — fall through to bare-ID check
  }

  // ── 5. Bare 11-character ID ─────────────────────────────────────────────────
  if (isValidId(trimmed)) return trimmed;

  return null;
}

/** A valid YouTube video ID is exactly 11 chars: [A-Za-z0-9_-] */
function isValidId(id: string): boolean {
  return /^[A-Za-z0-9_-]{11}$/.test(id);
}
