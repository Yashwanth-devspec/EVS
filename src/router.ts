/**
 * src/router.ts — A tiny path router (history API). Old hash links (#pool, #inbox, #group, #checkin)
 * all land on /trip, because those screens are now one Trip screen.
 */
import { useEffect, useState } from 'react';

const LEGACY_HASHES: Record<string, string> = {
  pool: '/trip',
  inbox: '/trip',
  group: '/trip',
  checkin: '/trip',
  impact: '/impact',
  methodology: '/methodology',
  admin: '/admin',
};

export function currentPath(): string {
  const hash = window.location.hash.replace('#', '');
  if (hash && LEGACY_HASHES[hash]) return LEGACY_HASHES[hash];
  return window.location.pathname || '/';
}

export function navigate(path: string, opts: { replace?: boolean; keepScroll?: boolean } = {}): void {
  const search = window.location.search;
  // Keep ?sid / ?embed for demo frames; drop everything else
  const keep = new URLSearchParams(search);
  const kept = new URLSearchParams();
  for (const k of ['sid', 'embed']) {
    const v = keep.get(k);
    if (v) kept.set(k, v);
  }
  const url = path + (kept.toString() ? `?${kept.toString()}` : '');
  if (opts.replace) window.history.replaceState(null, '', url);
  else window.history.pushState(null, '', url);
  window.dispatchEvent(new PopStateEvent('popstate'));
  if (!opts.keepScroll) window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
}

export function usePath(): string {
  const [path, setPath] = useState(currentPath);
  useEffect(() => {
    const onChange = () => setPath(currentPath());
    window.addEventListener('popstate', onChange);
    window.addEventListener('hashchange', onChange);
    return () => {
      window.removeEventListener('popstate', onChange);
      window.removeEventListener('hashchange', onChange);
    };
  }, []);
  return path;
}

export function searchParam(name: string): string | null {
  return new URLSearchParams(window.location.search).get(name);
}
