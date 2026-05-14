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
  path: '/'
};
