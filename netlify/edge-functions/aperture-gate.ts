import type { Context, Config } from 'https://edge.netlify.com';

const REALM = 'ARIA Aperture Admin';

export default async (request: Request, _context: Context) => {
  if (request.method === 'OPTIONS') return;

  const adminEmail = (Deno.env.get('APERTURE_ADMIN_EMAIL') || 'integrateditsupp@iisupp.net').toLowerCase().trim();
  const adminPassword = Deno.env.get('APERTURE_ADMIN_PASSWORD') || '';

  if (!adminPassword) {
    return new Response('Aperture authentication is not configured.', {
      status: 503,
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'text/plain; charset=utf-8',
        'WWW-Authenticate': `Basic realm="${REALM}", charset="UTF-8"`
      }
    });
  }

  const auth = request.headers.get('authorization') || '';
  const credentials = parseBasicAuth(auth);
  const ok = credentials
    && timingSafeEqual(credentials.username.toLowerCase().trim(), adminEmail)
    && timingSafeEqual(credentials.password, adminPassword);

  if (ok) return;

  return new Response('Authentication required.', {
    status: 401,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'text/plain; charset=utf-8',
      'WWW-Authenticate': `Basic realm="${REALM}", charset="UTF-8"`
    }
  });
};

function parseBasicAuth(header: string): null | { username: string; password: string } {
  if (!/^Basic\s+/i.test(header)) return null;
  try {
    const raw = atob(header.replace(/^Basic\s+/i, '').trim());
    const split = raw.indexOf(':');
    if (split < 0) return null;
    return {
      username: raw.slice(0, split),
      password: raw.slice(split + 1)
    };
  } catch {
    return null;
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const aa = enc.encode(a);
  const bb = enc.encode(b);
  const len = Math.max(aa.length, bb.length);
  let diff = aa.length ^ bb.length;
  for (let i = 0; i < len; i += 1) {
    diff |= (aa[i] || 0) ^ (bb[i] || 0);
  }
  return diff === 0;
}

export const config: Config = {
  path: [
    '/aperture',
    '/aperture/',
    '/aperture.html',
    '/aperture-learning',
    '/aperture-learning/',
    '/aperture-learning.html',
    '/command-center',
    '/command-center/',
    '/agents',
    '/agents/',
    '/agent-command-center.html'
  ]
};
