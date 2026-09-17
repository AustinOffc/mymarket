# Arsitektur baru: Frontend di Vercel + Backend di Pterodactyl (via Cloudflare Tunnel)

## Kenapa Cloudflare Tunnel?
Pterodactyl hanya expose backend lewat HTTP biasa (port lokal). Vercel (dan browser
modern) tidak akan mau memanggil endpoint campuran HTTPS→HTTP (mixed content
diblokir), dan cookie `SameSite=None` yang dibutuhkan untuk login cross-domain
juga mewajibkan `Secure` (HTTPS). Cloudflare Tunnel dipilih karena:
- Gratis, tidak perlu buka port apa pun di server Pterodactyl (koneksi keluar saja).
- Otomatis memberi HTTPS valid di domain sendiri (bukan IP:port).
- Bisa jalan sebagai proses tambahan di background tanpa ubah cara Pterodactyl
  menjalankan aplikasi Node-nya.

Alternatif lain (ngrok, localtunnel) juga bisa, tapi domainnya biasanya acak/berubah
tiap restart kecuali versi berbayar — Cloudflare Tunnel bisa pakai domain tetap
milik Anda sendiri secara gratis, jadi itu yang direkomendasikan di sini.

## Ringkasan perubahan
**Backend** (`config/settings.js`, `src/server.js`, `src/services/socket.service.js`,
`src/middleware/auth.middleware.js`, `src/controllers/auth.controller.js`, `start.sh`):
- Daftar origin yang diizinkan (CORS + Socket.IO) sekarang satu sumber di
  `settings.ALLOWED_ORIGINS`, otomatis mencakup domain Vercel (termasuk preview
  `*.vercel.app`) dan domain backend sendiri.
- Cookie sesi (`auth_token`) berubah dari `SameSite=Strict` menjadi
  `SameSite=None; Secure` di production, karena frontend & backend sekarang beda
  domain (cross-site). Ini **wajib** HTTPS di kedua sisi — makanya perlu tunnel.
- `start.sh` baru: menjalankan `cloudflared` di background lalu `node index.js`
  di foreground, supaya Pterodactyl tetap bisa mengelola proses seperti biasa.

**Frontend** (`public/js/app.js` dkk, `vercel.json`, `middleware.js`):
- `window.API_BASE_URL` (di `public/js/app.js`, baris paling atas) sekarang jadi
  **satu tempat** untuk set domain backend — semua pemanggilan `/api/...` dan
  koneksi Socket.IO otomatis dibuat absolut ke domain itu.
- `vercel.json` mem-plot ulang clean URL (`/dashboard`, `/login`, dst) ke file
  HTML yang sesuai (dulu ini dilakukan Express di `server.js`), dan mem-proxy
  `/uploads/*` ke backend supaya gambar upload lama (avatar, produk, dsb, yang
  disimpan sebagai path relatif di database) tetap tampil tanpa perlu ubah kode
  backend/DB.
- `middleware.js` (Vercel Edge Middleware) mereplikasi 2 hal yang dulu dilakukan
  Express: menyuntik nonce CSP ke `<script>` inline, dan menutup halaman
  `/austinganteng/*` & `/withdraw` dari role yang salah (cek JWT cookie).
  **Ini hanya gerbang tampilan/UX** — proteksi data sesungguhnya tetap 100% di
  setiap endpoint `/api/*` backend (tidak berubah sama sekali).

## Langkah setup

### 1. Cloudflare Tunnel (di server Pterodactyl)
1. Buat akun Cloudflare, lalu tambahkan `mymarket.web.id` sebagai domain di
   sana (Cloudflare akan minta Anda ganti nameserver domain ini ke
   nameserver Cloudflare — ini domain yang KHUSUS untuk backend/tunnel,
   terpisah dari `mymarket.id` yang nameserver-nya diarahkan ke Vercel).
2. Zero Trust dashboard → **Networks → Tunnels** → Create a tunnel (mode
   *Cloudflared*). Beri nama, misalnya `mymarket-backend`.
3. Tambahkan **Public Hostname**: `api.mymarket.web.id` → Service `HTTP://localhost:2005`
   (samakan port dengan `PORT`/`SERVER_PORT` backend). Karena domain ini
   sudah pakai nameserver Cloudflare, record-nya otomatis dibuat & di-proxy.
4. Salin **token** tunnel yang diberikan (bentuknya string panjang base64).
5. Di Pterodactyl, buka server backend → **Startup**:
   - Tambahkan environment variable `CLOUDFLARE_TUNNEL_TOKEN` = token tadi.
   - Tambahkan `FRONTEND_URL`, `BACKEND_PUBLIC_URL`, `BASE_URL`, `NODE_ENV=production`
     (lihat `.env.split-deploy.example`).
   - Ganti **Startup Command** jadi: `bash start.sh`
6. Restart server. Cek log: harus muncul "Menjalankan cloudflared tunnel di
   background..." lalu server Node jalan seperti biasa. Tes `https://api.mymarket.web.id`
   dari browser — harus dapat respons dari backend (mis. 404 JSON dari route yang
   tidak match, bukan error koneksi).

### 2. Backend — isi domain yang benar
Di `config/settings.js` (atau lewat environment variable, lebih aman):
- `FRONTEND_URL` = domain akhir yang dilihat user, `https://mymarket.id`
- `BACKEND_PUBLIC_URL` / `BASE_URL` = `https://api.mymarket.web.id`

### 3. Frontend — isi domain backend
Di `public/js/app.js`, baris:
```js
window.API_BASE_URL = 'https://api.mymarket.web.id';
```
Ganti dengan domain tunnel Anda. Ini satu-satunya tempat yang perlu diubah untuk
semua pemanggilan API & Socket.IO di seluruh halaman.

Di `vercel.json`, ganti juga domain di rule proxy `/uploads/*`:
```json
"destination": "https://api.mymarket.web.id/uploads/:path*"
```

### 4. Deploy frontend ke Vercel, pakai domain mymarket.id
1. `vercel` project baru, root direktori = folder `frontend/` ini (isinya
   `public/`, `vercel.json`, `middleware.js`, `package.json`).
2. Set environment variables di Vercel project settings:
   - `JWT_SECRET` = **harus identik persis** dengan `JWT_SECRET` di
     `config/settings.js` backend (dipakai middleware untuk verifikasi cookie).
   - `API_BASE_URL` = `https://api.mymarket.web.id` (dipakai untuk header CSP `connect-src`).
3. Deploy dulu ke domain bawaan (`namaproyek.vercel.app`) untuk memastikan semua
   jalan, baru lanjut ke langkah domain custom.
4. **Pasang domain `mymarket.id` di Vercel:** Project Settings → Domains →
   tambahkan `mymarket.id` (dan `www.mymarket.id` kalau perlu).
5. Karena Anda mengarahkan **nameserver** `mymarket.id` langsung ke Vercel
   (bukan cuma tambah 1-2 record DNS), Vercel akan otomatis mengurus semua
   record yang dibutuhkan — Anda tinggal ganti nameserver di tempat beli
   domain (registrar) ke nameserver yang ditampilkan Vercel saat menambah
   domain. Tidak ada konflik dengan Cloudflare di sini karena `mymarket.id`
   dan `mymarket.web.id` adalah **domain/zone yang terpisah** — `mymarket.id`
   sepenuhnya dikelola Vercel, `mymarket.web.id` sepenuhnya dikelola Cloudflare
   (untuk tunnel).
6. Tunggu propagasi nameserver (bisa beberapa jam), lalu tes `https://mymarket.id`
   langsung buka frontend, dan `https://api.mymarket.web.id` merespons dari backend.
7. Update `FRONTEND_URL` di environment Pterodactyl jadi `https://mymarket.id`,
   lalu restart backend supaya CORS/cookie mengizinkan domain final ini.

### 5. Uji menyeluruh
- Login/register dari domain Vercel → cek cookie `auth_token` ke-set dengan
  `SameSite=None; Secure` (lihat tab Application/Storage di DevTools).
- Buka halaman yang butuh Socket.IO (dashboard, chat, deposit) → pastikan status
  koneksi realtime aktif (indikator online CS/chat).
- Upload avatar/produk → gambar harus tetap tampil (lewat proxy `/uploads/*`).
- Coba akses `/austinganteng` tanpa login owner → harus redirect ke `/login`.
- Buka DevTools Console → pastikan tidak ada error CSP ("Refused to load/execute...").

## Hal yang sengaja TIDAK diubah
- Semua middleware `requireAuth/requireOwner/requireNotBuyer/dll` di `/api/*`
  backend tidak disentuh — itu tetap garda keamanan utama (dengan cek DB penuh,
  termasuk revocation token), tidak terpengaruh migrasi ini.
- `TRUSTED_PROXY_MODE: 'cloudflare'` di `config/settings.js` sudah otomatis
  mempercayai koneksi dari `127.0.0.1` (tempat `cloudflared` meneruskan request
  ke Node secara lokal) — tidak perlu diubah.
- Struktur database, kontroler, dan business logic (deposit, withdraw, escrow,
  dll) tidak disentuh sama sekali.

## Yang perlu Anda double-check sendiri
- API Edge Middleware Vercel berubah cukup sering — cocokkan import
  `@vercel/edge` di `middleware.js` dengan dokumentasi resmi Vercel saat Anda
  deploy, kalau ada API yang berbeda.
- Rewrite di `vercel.json` mengikuti persis peta halaman lama di `server.js`;
  kalau ada halaman yang Anda tambah/hapus setelah ini, update juga di sana.
- Kredensial di `config/settings.js` (JWT_SECRET, password DB, API key provider)
  masih hardcoded di source seperti aslinya — sebaiknya (di luar scope migrasi
  ini) dipindah ke environment variable murni supaya tidak ikut ter-commit ke Git.
