# Frontend — Austin Store

Frontend statis (HTML/CSS/JS) untuk marketplace Austin Store. Tema visual: **"Neon Arena"**
(dark, glassmorphism, aksen cyan neon `--primary`). Semua variabel warna/spacing ada di
`public/css/style.css` (`:root`).

## ⚠️ Aturan wajib: JANGAN pakai UI bawaan browser

Situs ini sudah punya komponen tema sendiri untuk elemen form yang biasanya di-render
browser dengan gaya native (dan otomatis "pecah tema" karena warnanya ikut OS/browser,
bukan ikut `style.css`). **Jangan pernah** biarkan elemen-elemen berikut tampil dengan
tampilan bawaan browser:

### 1. `<select>` / dropdown pilihan
- Tulis `<select>` biasa di HTML/JS seperti biasa (value, options, dll — semua tetap
  jalan normal).
- **WAJIB** include `public/js/custom-select.js` di halaman tersebut (setelah `app.js`):
  ```html
  <script src="/js/app.js"></script>
  <script src="/js/custom-select.js"></script>
  ```
  Script ini otomatis mendeteksi semua `<select>` di halaman (termasuk yang dirender
  belakangan lewat `innerHTML`/JS, lewat `MutationObserver`) dan menggantinya secara
  visual dengan dropdown bertema (`.csel`, `.csel-trigger`, `.csel-panel`, dst — sudah
  ada di `style.css`). `<select>` aslinya tetap ada di DOM (disembunyikan) supaya kode
  lain yang pakai `select.value`/`onchange`/dll tidak perlu diubah.
- **Sebelum menambah halaman baru yang punya `<select>`, cek dulu apakah
  `custom-select.js` sudah di-include.** Ini penyebab paling umum dropdown tiba-tiba
  tampil "polos" ala browser (lihat riwayat bug di `appprem.html` — halaman itu sempat
  lupa include script ini).
- Kalau butuh dropdown custom yang bentuknya beda dari `<select>` standar (misal radio-list
  seperti di `subdomain.html`), tetap pakai variabel warna yang sama
  (`var(--bg-card)`, `var(--border)`, `var(--primary)`, `var(--glass-blur)`) supaya
  temanya nyambung dengan `.csel`, meski implementasinya terpisah.

### 2. Tombol +/- jumlah (qty stepper)
- Pakai komponen bersama `.qty-stepper` yang sudah ada di `style.css` (jangan bikin CSS
  lokal per halaman lagi — ini penyebab bug tombol +/- appprem jadi tidak terlihat,
  karena versi lokalnya lupa set `color` tombol sehingga teks "+"/"−" senada dengan
  background):
  ```html
  <div class="qty-stepper">
    <button type="button" id="qty-minus">−</button>
    <input type="text" id="qty-input" value="1" readonly>
    <button type="button" id="qty-plus">+</button>
  </div>
  ```

### 3. Checkbox / radio native
- Saat ini beberapa halaman (`cart.html`, `owner.html`, `seller/stock.html`) masih pakai
  `<input type="checkbox">` / `type="radio"` tampilan bawaan browser (belum ada komponen
  tema khusus untuk ini). Kalau mau dibuat konsisten juga, perlu komponen checkbox/radio
  bertema baru — belum dibuat, jangan asal styling sepihak per halaman.

## Checklist sebelum selesai kerjakan halaman baru / edit halaman lama
- [ ] Semua `<select>` di halaman ini sudah otomatis jadi dropdown bertema (cek visual,
      bukan cuma cek script ada) — buka halaman, klik dropdown, pastikan panelnya
      pakai gaya glass/cyan, bukan popup putih polos ala browser.
- [ ] Tombol +/- jumlah (kalau ada) pakai class `.qty-stepper` bersama, bukan CSS lokal
      baru.
- [ ] Tidak ada CSS baru yang duplikat komponen yang sudah ada di `style.css` — cek dulu
      apakah komponennya sudah ada sebelum bikin versi lokal per halaman.
