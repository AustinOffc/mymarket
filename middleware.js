
import { next } from '@vercel/edge';
import { jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || '';
const API_BASE_URL = process.env.API_BASE_URL || 'https://api.mymarket.web.id';
const encodedSecret = JWT_SECRET ? new TextEncoder().encode(JWT_SECRET) : null;

const OWNER_PAGE_ROUTES = new Set([
  '/austinganteng',
  '/austinganteng/users',
  '/austinganteng/sellers',
  '/austinganteng/categories',
  '/austinganteng/stock',
  '/austinganteng/orders',
  '/austinganteng/history',
  '/austinganteng/complaints',
  '/austinganteng/reports',
  '/austinganteng/vouchers',
  '/austinganteng/flashsale',
  '/austinganteng/deposits',
  '/austinganteng/withdraws',
  '/austinganteng/transactions',
  '/austinganteng/settings',
  '/austinganteng/logs',
  '/austinganteng/notifications',
  '/austinganteng/ptero',
  '/austinganteng/resellers',
]);

const NOT_BUYER_ROUTES = new Set(['/withdraw', '/seller/withdraw']);

const AUTH_REQUIRED_ROUTES = new Set(['/tools', '/tools/installpterodactyl', '/tools/startwings', '/tools/cekvps', '/tools/installtema', '/tools/uninstalltema', '/tools/installprotect', '/tools/uninstallprotect', '/tools/github', '/tools/downloader', '/tools/downloader/tiktok', '/tools/downloader/instagram', '/tools/downloader/facebook', '/tools/downloader/capcut']);

function getCookie(req, name) {
  const header = req.headers.get('cookie') || '';
  const parts = header.split(';');
  for (const part of parts) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    if (key === name) return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return null;
}

async function getRole(req) {
  if (!encodedSecret) return null;
  const token = getCookie(req, 'auth_token');
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, encodedSecret);
    return payload.role || null;
  } catch {
    return null;
  }
}

function apiOrigins() {
  try {
    const u = new URL(API_BASE_URL);
    return `${u.origin} wss://${u.host}`;
  } catch {
    return "'self'";
  }
}

function cspHeader(nonce) {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' https://cdn.jsdelivr.net/npm/socket.io-client@4.7.5/ https://cdn.jsdelivr.net/npm/chart.js@4/ https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/ https://static.cloudflareinsights.com https://challenges.cloudflare.com https://accounts.google.com`,
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net/npm/@fortawesome/",
    "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net/npm/@fortawesome/ data:",
    "img-src 'self' data: https:",
    `connect-src 'self' ${apiOrigins()} https://challenges.cloudflare.com https://accounts.google.com`,
    "frame-src 'self' https://challenges.cloudflare.com https://accounts.google.com",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join('; ');
}

const BRAND_TTL_MS = 60 * 1000;
const BRAND_TIMEOUT_MS = 1500;
let brandCache = { data: null, at: 0 };

async function loadBrand() {
  const now = Date.now();
  if (brandCache.data && now - brandCache.at < BRAND_TTL_MS) return brandCache.data;
  try {
    const res = await fetch(`${API_BASE_URL.replace(/\/+$/, '')}/api/public/branding`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(BRAND_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error('branding ' + res.status);
    const json = await res.json();
    if (json && json.brand) {
      brandCache = { data: json.brand, at: now };
      return json.brand;
    }
  } catch {}
  return brandCache.data;
}

function applyBrand(html, brand, nonce) {
  if (!brand) return html;
  const replaced = html.replace(/\{\{brand\.([A-Za-z0-9]+)\}\}/g, (match, key) => (
    brand[key] != null ? String(brand[key]) : match
  ));
  const payload = JSON.stringify(brand).replace(/</g, '\\u003c');
  return replaced.replace('<head>', () => `<head><script nonce="${nonce}">window.BRAND=${payload};</script>`);
}

function randomNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export default async function middleware(req) {
  const url = new URL(req.url);
  const pathname = url.pathname;

  if (pathname.toLowerCase().endsWith('.html')) {
    return new Response('Not Found', { status: 404 });
  }

  if (OWNER_PAGE_ROUTES.has(pathname)) {
    const role = await getRole(req);
    if (role !== 'owner') {
      return Response.redirect(new URL('/login', req.url), 302);
    }
  } else if (NOT_BUYER_ROUTES.has(pathname)) {
    const role = await getRole(req);
    if (!role) return Response.redirect(new URL('/login', req.url), 302);
    if (role === 'buyer') return Response.redirect(new URL('/dashboard', req.url), 302);
  } else if (AUTH_REQUIRED_ROUTES.has(pathname)) {
    const role = await getRole(req);
    if (!role) return Response.redirect(new URL('/login', req.url), 302);
  }

  const res = await next();
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return res;

  const nonce = randomNonce();
  const html = await res.text();
  const withNonce = html.split('<script>').join(`<script nonce="${nonce}">`);
  const brand = await loadBrand();
  const branded = applyBrand(withNonce, brand, nonce);

  const headers = new Headers(res.headers);
  headers.set('Content-Security-Policy', cspHeader(nonce));
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  return new Response(branded, { status: res.status, headers });
}

export const config = {
  matcher: ['/((?!css/|js/|img/|uploads/|favicon|sw\\.js|manifest\\.json).*)'],
};
