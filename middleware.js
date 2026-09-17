// Vercel Edge Middleware
//
// Backend lama (src/server.js) melakukan 2 hal saat mengirim HTML:
//   1. Menyisipkan nonce unik ke setiap <script> inline lalu memasang
//      Content-Security-Policy berbasis nonce itu.
//   2. Menutup halaman /austinganteng/* dan /withdraw dari role yang salah
//      (requireOwner / requireNotBuyer) sebelum HTML dikirim.
// File ini mereplikasi kedua perilaku itu di edge, karena sekarang HTML
// disajikan sebagai file statis oleh Vercel, bukan di-render Express lagi.
//
// PENTING - baca sebelum deploy:
// - Set env var JWT_SECRET di project Vercel dengan NILAI YANG SAMA PERSIS
//   dengan JWT_SECRET backend (config/settings.js), supaya cookie auth_token
//   bisa diverifikasi di sini.
// - Set env var API_BASE_URL ke domain tunnel backend (dipakai untuk
//   connect-src di CSP).
// - Cek "matcher" di bawah cocok dengan struktur folder public/ Anda.
// - Ini HANYA gerbang tampilan (UX), sama seperti desain asli: tidak
//   memeriksa revocation token ke database (edge tidak connect ke Postgres).
//   Proteksi data sesungguhnya tetap 100% di setiap endpoint /api/* backend
//   (requireOwner/requireNotBuyer versi penuh, dengan cek DB) yang TIDAK
//   berubah sama sekali oleh migrasi ini.
// - API middleware Vercel berkembang cukup cepat; cocokkan detail import
//   `@vercel/edge` di bawah dengan dokumentasi resmi Vercel saat deploy.

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

function cspHeader(nonce) {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' cdn.jsdelivr.net cdnjs.cloudflare.com static.cloudflareinsights.com challenges.cloudflare.com accounts.google.com`,
    "style-src 'self' 'unsafe-inline' fonts.googleapis.com cdn.jsdelivr.net",
    "font-src 'self' fonts.gstatic.com cdn.jsdelivr.net data:",
    "img-src 'self' data: https:",
    `connect-src 'self' ${API_BASE_URL} wss: challenges.cloudflare.com accounts.google.com`,
    "frame-src 'self' challenges.cloudflare.com accounts.google.com",
  ].join('; ');
}

function randomNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export default async function middleware(req) {
  const url = new URL(req.url);
  const pathname = url.pathname;

  // Sama seperti backend lama: tolak akses langsung ke *.html mentah
  // supaya orang cuma bisa lewat clean URL (/dashboard, bukan /dashboard.html).
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
  }

  const res = await next();
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return res;

  const nonce = randomNonce();
  const html = await res.text();
  const withNonce = html.split('<script>').join(`<script nonce="${nonce}">`);

  const headers = new Headers(res.headers);
  headers.set('Content-Security-Policy', cspHeader(nonce));
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  return new Response(withNonce, { status: res.status, headers });
}

export const config = {
  // Jalan di semua path KECUALI aset statis (yang sudah dilayani langsung
  // dari filesystem oleh Vercel dan tidak butuh nonce/role-check).
  matcher: ['/((?!css/|js/|img/|uploads/|favicon|sw\\.js|manifest\\.json).*)'],
};
