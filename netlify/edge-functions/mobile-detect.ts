// Edge function: route mobile devices to /m.html, leave desktop on /
// Per Ahmad 2026-05-14 PM: "do not touch desktop". This sits in front of /
// and rewrites to m.html for mobile UAs. Desktop file is unmodified.
//
// Bypass: ?desktop=1 or cookie view=desktop forces desktop view
//
// Auto-discovered by Netlify Edge Functions runtime via the config below.

import type { Context, Config } from 'https://edge.netlify.com';

const MOBILE_UA = /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|webOS/i;

export default async (request: Request, context: Context) => {
  // RUN-CU 2026-10-08: only rewrite page loads. The contact forms on index.html and m.html POST
  // urlencoded Netlify Forms submissions to "/"; rewriting that POST to /m.html for a phone would
  // hand the form body to a static file instead of Netlify Forms. GET/HEAD are the only methods
  // that fetch a page, so they are the only ones this function touches.
  if (request.method !== 'GET' && request.method !== 'HEAD') return;

  const url = new URL(request.url);

  // Only intercept the bare root
  if (url.pathname !== '/' && url.pathname !== '/index.html') return;

  // Manual override — user wants desktop
  if (url.searchParams.get('desktop') === '1') return;
  const cookie = request.headers.get('cookie') || '';
  if (/(?:^|;\s*)view=desktop/.test(cookie)) return;

  // Mobile UA detection
  const ua = request.headers.get('user-agent') || '';
  if (MOBILE_UA.test(ua)) {
    return context.rewrite('/m.html');
  }
  // Desktop: pass through (return undefined)
};

export const config: Config = {
  // The handler tests for '/index.html' too, but with path: '/' it is never invoked for that URL,
  // so a mobile visitor landing on /index.html got the desktop page. Match what the handler claims.
  path: ['/', '/index.html']
};
