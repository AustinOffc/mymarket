
// ==== Konfigurasi backend (frontend Vercel <-> backend Pterodactyl+tunnel) ====
// Frontend & backend sekarang dua origin berbeda, jadi setiap panggilan
// '/api/...' harus jadi URL absolut ke domain backend (lewat tunnel HTTPS),
// bukan path relatif lagi. Ini SATU-SATUNYA tempat yang perlu diubah kalau
// domain tunnel/backend berganti.
window.API_BASE_URL = ''; // GANTI sesuai domain tunnel backend Anda
function apiUrl(path) {
  if (!path) return window.API_BASE_URL;
  if (/^https?:\/\//i.test(path)) return path; // sudah URL absolut, biarkan
  return window.API_BASE_URL.replace(/\/$/, '') + path;
}
window.apiUrl = apiUrl;

const API = {
  async request(method, url, data = null) {
    try {
      const opts = {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      };
      if (data) opts.body = JSON.stringify(data);
      const res = await fetch(apiUrl(url), opts);
      return await res.json();
    } catch (err) {
      return { success: false, message: 'Koneksi gagal. Periksa jaringan.' };
    }
  },
  get: (url) => API.request('GET', url),
  post: (url, data) => API.request('POST', url, data),
};

const Toast = {
  container: null,
  init() {
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.className = 'toast-container';
      document.body.appendChild(this.container);
    }
  },
  show(message, type = 'info', duration = 4000) {
    this.init();
    const icons = {
      success: '<i class="fas fa-check-circle"></i>',
      danger:  '<i class="fas fa-times-circle"></i>',
      warning: '<i class="fas fa-exclamation-triangle"></i>',
      info:    '<i class="fas fa-info-circle"></i>',
    };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${icons[type] || '<i class="fa-solid fa-bell"></i>'}</span><span>${message}</span>`;
    this.container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(20px)';
      toast.style.transition = 'all .3s';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },
  success: (msg) => Toast.show(msg, 'success'),
  error:   (msg) => Toast.show(msg, 'danger'),
  warning: (msg) => Toast.show(msg, 'warning'),
  info:    (msg) => Toast.show(msg, 'info'),
};

const ImagePicker = {
  async uploadFile(file) {
    if (!file) return null;
    const form = new FormData();
    form.append('image', file);
    try {
      const res = await fetch(apiUrl('/api/upload/image'), { method: 'POST', credentials: 'include', body: form });
      const data = await res.json();
      if (!data.success) { Toast.error(data.message || 'Gagal upload gambar'); return null; }
      return data.url;
    } catch (err) {
      Toast.error('Koneksi gagal. Periksa jaringan.');
      return null;
    }
  },
  attach(input) {
    if (!input || input._imagePickerAttached) return;
    input._imagePickerAttached = true;

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;gap:6px;align-items:stretch';
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);
    input.style.flex = '1';
    input.style.minWidth = '0';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-outline btn-sm';
    btn.style.cssText = 'flex-shrink:0;padding:8px 12px';
    btn.title = 'Upload dari galeri';
    btn.innerHTML = '<i class="fas fa-images"></i>';
    wrap.appendChild(btn);

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/jpeg,image/png,image/webp';
    fileInput.style.display = 'none';
    wrap.appendChild(fileInput);

    btn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files[0];
      fileInput.value = '';
      if (!file) return;
      const originalIcon = btn.innerHTML;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
      btn.disabled = true;
      const url = await ImagePicker.uploadFile(file);
      btn.innerHTML = originalIcon;
      btn.disabled = false;
      if (url) {
        input.value = url;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        Toast.success('Foto berhasil diupload dari galeri');
      }
    });
  },
  autoAttach(root = document) {
    root.querySelectorAll('input[data-image-upload]').forEach(ImagePicker.attach);
  },
  openModal({ title = 'Pilih Foto', currentUrl = '' } = {}) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay open';
      overlay.innerHTML = `
        <div class="modal" style="max-width:420px">
          <div class="modal-header">
            <div class="modal-title">${escapeHtml(title)}</div>
            <button class="modal-close" type="button" id="__img-picker-x">&times;</button>
          </div>
          <div class="modal-body">
            <div class="form-group" style="margin-bottom:0">
              <label>URL Gambar</label>
              <input type="text" class="form-control" id="__img-picker-url" placeholder="https://contoh.com/gambar.jpg">
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" type="button" id="__img-picker-cancel">Batal</button>
            <button class="btn btn-primary" type="button" id="__img-picker-save">Simpan</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
      const input = overlay.querySelector('#__img-picker-url');
      input.value = currentUrl || '';
      ImagePicker.attach(input);

      const close = (result) => { overlay.remove(); resolve(result); };
      overlay.querySelector('#__img-picker-x').addEventListener('click', () => close(null));
      overlay.querySelector('#__img-picker-cancel').addEventListener('click', () => close(null));
      overlay.querySelector('#__img-picker-save').addEventListener('click', () => {
        const url = input.value.trim();
        if (!url) { Toast.warning('Isi URL atau upload foto dulu'); return; }
        close(url);
      });
      overlay.addEventListener('click', (e) => { if (e.target === overlay) close(null); });
    });
  },
};
document.addEventListener('DOMContentLoaded', () => ImagePicker.autoAttach());

function escapeHtml(str) { const d = document.createElement('div'); d.textContent = str == null ? '' : String(str); return d.innerHTML; }
function escapeAttr(str) { return escapeHtml(str).replace(/"/g, '&quot;'); }

function formatRupiah(amount, withPrefix = true) {
  const num = Number(amount) || 0;
  const formatted = num.toLocaleString('id-ID');
  return withPrefix ? `Rp ${formatted}` : formatted;
}

function formatDate(iso, withTime = true) {
  if (!iso) return '-';
  const d = new Date(iso);
  const opts = { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' };
  if (withTime) { opts.hour = '2-digit'; opts.minute = '2-digit'; }
  return d.toLocaleString('id-ID', opts);
}

function statusBadge(status) {
  const map = {
    pending:   ['badge-warning',   'Pending'],
    paid:      ['badge-success',   'Berhasil'],
    success:   ['badge-success',   'Berhasil'],
    failed:    ['badge-danger',    'Gagal'],
    rejected:  ['badge-danger',    'Ditolak'],
    expired:   ['badge-secondary', 'Expired'],
    cancel:    ['badge-secondary', 'Dibatalkan'],
    diproses:  ['badge-info',      'Diproses'],
    processing:['badge-info',      'Diproses'],
    waiting:   ['badge-info',      'Diproses'],
    completed: ['badge-success',   'Selesai'],
    refunded:  ['badge-secondary', 'Direfund'],
    active:    ['badge-success',   'Aktif'],
    suspended: ['badge-danger',    'Suspend'],
    approved:  ['badge-success',   'Disetujui'],
    open:      ['badge-warning',   'Sedang Dikomplain'],
    resolved:  ['badge-success',   'Ditindaklanjuti'],
    dismissed: ['badge-secondary', 'Diabaikan'],
    holding:   ['badge-info',      'Tertahan (Escrow)'],
    released:  ['badge-success',   'Sudah Cair'],
  };
  const [cls, label] = map[status] || ['badge-secondary', status];
  return `<span class="badge ${cls}">${label}</span>`;
}

const Theme = {
  init() {
    const saved = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
    this._updateIcon(saved);
  },
  toggle() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    this._updateIcon(next);
  },
  _updateIcon(theme) {
    const btn = document.getElementById('theme-toggle');
    if (btn) btn.innerHTML = theme === 'dark'
      ? '<i class="fas fa-sun"></i>'
      : '<i class="fas fa-moon"></i>';
  },
};

const Sidebar = {
  _setToggleIcon(isOpen) {
    const toggle = document.getElementById('sidebar-toggle');
    const icon = toggle && toggle.querySelector('i');
    if (!icon) return;
    icon.classList.remove('fa-bars', 'fa-xmark');
    icon.classList.add(isOpen ? 'fa-xmark' : 'fa-bars');
  },
  close() {
    const overlay = document.getElementById('sidebar-overlay');
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
    this._setToggleIcon(false);
  },
  init() {
    const toggle  = document.getElementById('sidebar-toggle');
    const overlay = document.getElementById('sidebar-overlay');
    const sidebar = document.querySelector('.sidebar');
    if (toggle && sidebar) {
      toggle.addEventListener('click', () => {
        const isOpen = sidebar.classList.toggle('open');
        if (overlay) overlay.classList.toggle('open', isOpen);
        this._setToggleIcon(isOpen);
      });
    }
    if (overlay) {
      overlay.addEventListener('click', () => this.close());
    }
    const path = window.location.pathname;
    document.querySelectorAll('.nav-item[data-href]').forEach(item => {
      const href = item.getAttribute('data-href');
      if (path === href || (href !== '/' && path.startsWith(href))) {
        item.classList.add('active');
      }
      item.addEventListener('click', () => { window.location.href = href; });
    });
  },
};

const Auth = {
  currentUser: null,
  async check(role = null) {
    const res = await API.get('/api/auth/me');
    if (!res.success) {
      window.location.href = '/login';
      return false;
    }
    this.currentUser = res.user;
    if (role && res.user.role !== role) {
      window.location.href = role === 'owner' ? '/dashboard' : '/login';
      return false;
    }
    return res;
  },
  async logout() {
    await API.post('/api/auth/logout');
    window.location.href = '/login';
  },
  async checkOptional() {
    const res = await API.get('/api/auth/me');
    if (!res.success) {
      this.currentUser = null;
      return null;
    }
    this.currentUser = res.user;
    return res;
  },
  getSafeRedirect() {
    const r = new URLSearchParams(location.search).get('redirect');
    if (r && r.startsWith('/') && !r.startsWith('//')) return r;
    return null;
  },
  goToLogin(message) {
    if (message) Toast.info(message);
    const current = location.pathname + location.search;
    window.location.href = `/login?redirect=${encodeURIComponent(current)}`;
  },
  requireLogin(message) {
    if (this.currentUser) return true;
    this.goToLogin(message || 'Silakan masuk untuk melanjutkan');
    return false;
  },
  renderGuestUI() {
    const topbarAvatar = document.querySelector('.topbar-actions [data-user-avatar]');
    if (topbarAvatar) {
      const btn = document.createElement('button');
      btn.className = 'btn btn-primary btn-login-topbar';
      btn.textContent = 'Masuk';
      btn.addEventListener('click', () => { window.location.href = '/login'; });
      topbarAvatar.replaceWith(btn);
    }
    document.querySelectorAll('[data-user-name]').forEach(el => el.textContent = 'Tamu');
    document.querySelectorAll('[data-user-role]').forEach(el => el.textContent = 'Belum masuk');
    const sidebarAvatar = document.querySelector('.sidebar-user [data-user-avatar]');
    if (sidebarAvatar) {
      sidebarAvatar.innerHTML = '<i class="fas fa-user"></i>';
      sidebarAvatar.style.cursor = 'pointer';
      sidebarAvatar.addEventListener('click', () => { window.location.href = '/login'; });
    }
    const logoutItem = document.querySelector('[data-logout]');
    if (logoutItem) {
      const replacement = logoutItem.cloneNode(true);
      replacement.innerHTML = '<span class="nav-icon"><i class="fas fa-right-to-bracket"></i></span> Masuk';
      replacement.style.color = '';
      replacement.removeAttribute('data-logout');
      replacement.addEventListener('click', () => { window.location.href = '/login'; });
      logoutItem.replaceWith(replacement);
    }
  },
  renderUserInfo(user, wallet) {
    document.querySelectorAll('[data-user-name]').forEach(el => el.textContent = user.full_name || user.username);
    document.querySelectorAll('[data-user-role]').forEach(el => el.textContent = user.role === 'owner' ? 'Owner' : (user.role === 'seller' ? 'Seller' : 'Buyer'));
    document.querySelectorAll('[data-user-avatar]').forEach(el => {
      if (user.avatar) {
        el.innerHTML = `<img src="${user.avatar}" alt="">`;
      } else {
        el.textContent = (user.full_name || user.username)[0].toUpperCase();
      }
    });
    if (wallet) {
      document.querySelectorAll('[data-balance]').forEach(el => el.textContent = formatRupiah(wallet.balance));
    }
  },
};

const Heartbeat = {
  KEY: 'apg_last_active_at',
  _started: false,

  checkOffline(thresholdMs = 10 * 60 * 1000) {
    let last = null;
    try { last = parseInt(localStorage.getItem(this.KEY), 10); } catch (e) {}
    const now = Date.now();
    const wasOffline = !last || isNaN(last) || (now - last) > thresholdMs;
    this.touch();
    return wasOffline;
  },

  touch() {
    try { localStorage.setItem(this.KEY, String(Date.now())); } catch (e) {}
  },

  start() {
    if (this._started) return;
    this._started = true;
    setInterval(() => this.touch(), 30000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.touch(); });
  },
};

function renderPagination(containerId, current, total, onPage) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (total <= 1) { container.innerHTML = ''; return; }
  let html = '';
  html += `<button class="page-btn" data-page="${current - 1}" ${current === 1 ? 'disabled' : ''}><i class="fas fa-chevron-left"></i></button>`;
  for (let i = 1; i <= total; i++) {
    if (total > 7 && Math.abs(i - current) > 2 && i !== 1 && i !== total) {
      if (i === current - 3 || i === current + 3) html += `<span style="padding:0 4px;color:var(--text-muted)">…</span>`;
      continue;
    }
    html += `<button class="page-btn ${i === current ? 'active' : ''}" data-page="${i}">${i}</button>`;
  }
  html += `<button class="page-btn" data-page="${current + 1}" ${current === total ? 'disabled' : ''}><i class="fas fa-chevron-right"></i></button>`;
  container.innerHTML = html;

  container._onPage = onPage;
  if (!container._paginationBound) {
    container.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-page]');
      if (!btn || btn.disabled) return;
      const page = Number(btn.getAttribute('data-page'));
      if (!Number.isNaN(page) && page >= 1 && typeof container._onPage === 'function') {
        container._onPage(page);
      }
    });
    container._paginationBound = true;
  }
}

function renderStars(avg) {
  const rounded = Math.round(Number(avg) || 0);
  let html = '';
  for (let i = 1; i <= 5; i++) {
    html += `<i class="fa-star ${i <= rounded ? 'fas' : 'far'}"></i>`;
  }
  return html;
}

const Modal = {
  open(id) { document.getElementById(id)?.classList.add('open'); },
  close(id) { document.getElementById(id)?.classList.remove('open'); },
};
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay') && !e.target.classList.contains('gdlg-overlay')) e.target.classList.remove('open');
});

// Modals, the sidebar, dropdowns and side panels are all shown/hidden with a shared
// '.open' class. When a page is restored from the browser back/forward cache (e.g.
// swiping/tapping back), the DOM comes back exactly as it was left — so any overlay
// that was open right before navigating away flashes back on top of the page. Since
// the underlying page state (cart contents, auth, etc.) may also be stale on a bfcache
// restore, force a fresh load instead of silently reusing the cached snapshot.
window.addEventListener('pageshow', (e) => {
  if (!e.persisted) return;
  document.querySelectorAll('.open').forEach(el => el.classList.remove('open'));
  window.location.reload();
});

// Glass-themed replacement for native confirm()/alert() so popups match the app theme
// instead of the browser's default (unstyled) dialog.
const Dialog = {
  _build(opts) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay gdlg-overlay';
    const msgHtml = escapeHtml(opts.message).replace(/\n/g, '<br>');
    overlay.innerHTML = `
      <div class="modal gdlg">
        <div class="modal-header">
          <span class="modal-title">${escapeHtml(opts.title)}</span>
        </div>
        <div class="modal-body"><p class="gdlg-msg">${msgHtml}</p></div>
        <div class="modal-footer">
          ${opts.cancelText ? `<button type="button" class="btn btn-outline btn-sm gdlg-cancel">${escapeHtml(opts.cancelText)}</button>` : ''}
          <button type="button" class="btn ${opts.danger ? 'btn-danger' : 'btn-primary'} btn-sm gdlg-ok">${escapeHtml(opts.okText)}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('open'));
    return overlay;
  },
  confirm(message, options = {}) {
    return new Promise(resolve => {
      const overlay = this._build({
        title: options.title || 'Konfirmasi',
        message,
        okText: options.okText || 'Ya, Lanjutkan',
        cancelText: options.cancelText === null ? null : (options.cancelText || 'Batal'),
        danger: options.danger,
      });
      let done = false;
      const cleanup = (result) => {
        if (done) return; done = true;
        overlay.classList.remove('open');
        setTimeout(() => overlay.remove(), 250);
        resolve(result);
      };
      overlay.querySelector('.gdlg-ok').addEventListener('click', () => cleanup(true));
      overlay.querySelector('.gdlg-cancel')?.addEventListener('click', () => cleanup(false));
      overlay.addEventListener('click', e => { if (e.target === overlay) cleanup(false); });
    });
  },
  alert(message, options = {}) {
    return new Promise(resolve => {
      const overlay = this._build({
        title: options.title || 'Informasi',
        message,
        okText: options.okText || 'Oke',
        cancelText: null,
        danger: options.danger,
      });
      let done = false;
      const cleanup = () => {
        if (done) return; done = true;
        overlay.classList.remove('open');
        setTimeout(() => overlay.remove(), 250);
        resolve();
      };
      overlay.querySelector('.gdlg-ok').addEventListener('click', cleanup);
      overlay.addEventListener('click', e => { if (e.target === overlay) cleanup(); });
    });
  },
  prompt(message, options = {}) {
    return new Promise(resolve => {
      const overlay = this._build({
        title: options.title || 'Masukkan Nilai',
        message,
        okText: options.okText || 'Oke',
        cancelText: options.cancelText === null ? null : (options.cancelText || 'Batal'),
        danger: options.danger,
      });
      const input = document.createElement('input');
      input.type = options.type || 'text';
      input.className = 'form-control';
      input.style.marginTop = '10px';
      input.placeholder = options.placeholder || '';
      input.value = options.defaultValue || '';
      overlay.querySelector('.modal-body').appendChild(input);
      let done = false;
      const cleanup = (result) => {
        if (done) return; done = true;
        overlay.classList.remove('open');
        setTimeout(() => overlay.remove(), 250);
        resolve(result);
      };
      overlay.querySelector('.gdlg-ok').addEventListener('click', () => cleanup(input.value));
      overlay.querySelector('.gdlg-cancel')?.addEventListener('click', () => cleanup(null));
      overlay.addEventListener('click', e => { if (e.target === overlay) cleanup(null); });
      input.addEventListener('keydown', e => { if (e.key === 'Enter') cleanup(input.value); });
      setTimeout(() => input.focus(), 100);
    });
  },
};
window.showConfirm = (message, options) => Dialog.confirm(message, options);
window.showAlert = (message, options) => Dialog.alert(message, options);
window.showPrompt = (message, options) => Dialog.prompt(message, options);

function btnLoading(btn, loading) {
  if (loading) { btn.classList.add('btn-loading'); btn.disabled = true; }
  else         { btn.classList.remove('btn-loading'); btn.disabled = false; }
}

function copyText(text, label = 'Teks') {
  if (!text) return;
  navigator.clipboard?.writeText(text).then(() => Toast.success(`${label} disalin`)).catch(() => Toast.error('Gagal menyalin'));
}

const AppLogo = {
  async init() {
    try {
      const res = await fetch(apiUrl('/api/public/branding'), { credentials: 'include' });
      const data = await res.json();
      if (!data.success) return;
      if (data.app_logo) {
        document.querySelectorAll('.logo-icon, .brand-icon').forEach(el => {
          el.innerHTML = `<img src="${data.app_logo}" alt="logo" style="width:100%;height:100%;object-fit:cover;border-radius:inherit">`;
        });
      }
      if (data.app_name) {
        document.title = document.title.replace(/Austin Payment Gateway|Austin Pay/i, data.app_name);
        document.querySelectorAll('.sidebar-logo span').forEach(el => { el.textContent = data.app_name; });
        document.querySelectorAll('[data-brand-title]').forEach(el => { el.textContent = data.app_name; });
      }
    } catch {}
  },
};

const ScrollFX = {
  init() {
    // Topbar gains elevation/depth once the page scrolls — no particles, just a subtle glass effect.
    const topbar = document.querySelector('.topbar');
    if (topbar) {
      const onScroll = () => topbar.classList.toggle('is-scrolled', window.scrollY > 8);
      onScroll();
      window.addEventListener('scroll', onScroll, { passive: true });
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!('IntersectionObserver' in window)) return;

    // Reveal-on-scroll: only for elements that start off-screen, so above-the-fold
    // content keeps using its existing load-in animation untouched.
    const selector = '.card, .stat-card, .game-tile, .cat-icon-tile, .seller-tile, .ticket-card, ' +
      '.order-card, .notif-item, .cs-panel-item, .trust-item, .info-banner-item, .wallet-hero';
    const vh = window.innerHeight;
    const targets = Array.from(document.querySelectorAll(selector)).filter(el => {
      const rect = el.getBoundingClientRect();
      return rect.top > vh || rect.bottom < 0;
    });
    if (!targets.length) return;

    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-revealed');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });

    targets.forEach(el => {
      el.classList.add('scroll-hidden');
      io.observe(el);
    });
  },
};

const PushNotifications = {
  registration: null,
  supported: 'serviceWorker' in navigator && 'PushManager' in window,

  async init() {
    if (!this.supported) return;
    try {
      this.registration = await navigator.serviceWorker.register('/sw.js');
    } catch (err) {
      console.error('[Push] Gagal register service worker:', err);
      this.supported = false;
    }
    this._updateButton();
  },

  async isSubscribed() {
    if (!this.registration) return false;
    const sub = await this.registration.pushManager.getSubscription();
    return !!sub;
  },

  _urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
    return outputArray;
  },

  async subscribe() {
    if (!this.supported || !this.registration) {
      Toast.show('Browser ini tidak mendukung push notification', 'warning');
      return false;
    }
    if (Notification.permission === 'denied') {
      Toast.show('Izin notifikasi diblokir. Aktifkan lewat pengaturan browser.', 'warning');
      return false;
    }
    try {
      const keyRes = await API.get('/api/push/public-key');
      if (!keyRes.success) {
        Toast.show(keyRes.message || 'Push notification belum tersedia', 'warning');
        return false;
      }
      const subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this._urlBase64ToUint8Array(keyRes.key),
      });
      const json = subscription.toJSON();
      const res = await API.post('/api/push/subscribe', { endpoint: json.endpoint, keys: json.keys });
      if (res.success) Toast.show('Notifikasi push diaktifkan', 'success');
      await this._updateButton();
      return res.success;
    } catch (err) {
      console.error('[Push] Subscribe gagal:', err);
      Toast.error('Gagal mengaktifkan notifikasi push');
      return false;
    }
  },

  async unsubscribe() {
    if (!this.registration) return;
    try {
      const sub = await this.registration.pushManager.getSubscription();
      if (sub) {
        await API.post('/api/push/unsubscribe', { endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      Toast.show('Notifikasi push dinonaktifkan', 'info');
    } catch (err) {
      console.error('[Push] Unsubscribe gagal:', err);
    }
    await this._updateButton();
  },

  async toggle() {
    if (await this.isSubscribed()) await this.unsubscribe();
    else await this.subscribe();
  },

  async _updateButton() {
    const btn = document.getElementById('notif-push-toggle');
    if (!btn) return;
    if (!this.supported) { btn.style.display = 'none'; return; }
    const active = await this.isSubscribed();
    btn.classList.toggle('active', active);
    btn.title = active ? 'Notifikasi push aktif — klik untuk matikan' : 'Aktifkan notifikasi push';
    btn.innerHTML = active ? '<i class="fas fa-bell"></i>' : '<i class="fas fa-bell-slash"></i>';
  },
};

const Notifications = {
  panelEl: null,
  async init() {
    const bell = document.getElementById('notif-bell');
    if (!bell) return; 
    this._buildPanel();
    bell.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggle();
    });
    document.addEventListener('click', (e) => {
      if (this.panelEl && !this.panelEl.contains(e.target) && e.target !== bell && !bell.contains(e.target)) {
        this.panelEl.classList.remove('open');
      }
    });
    await this.refresh();
    setInterval(() => this.refresh(), 30000);
    PushNotifications.init();
  },
  _buildPanel() {
    const wrap = document.createElement('div');
    wrap.id = 'notif-panel';
    wrap.className = 'notif-panel';
    wrap.innerHTML = `
      <div class="notif-panel-header">
        <span>Notifikasi</span>
        <div class="notif-panel-header-actions">
          <button type="button" id="notif-push-toggle" class="notif-push-toggle"><i class="fas fa-bell-slash"></i></button>
          <button type="button" class="notif-mark-all">Tandai semua dibaca</button>
        </div>
      </div>
      <div class="notif-panel-list" id="notif-panel-list"><div class="notif-empty">Memuat...</div></div>
    `;
    document.body.appendChild(wrap);
    this.panelEl = wrap;
    wrap.querySelector('.notif-mark-all').addEventListener('click', async (e) => {
      e.stopPropagation();
      await API.post('/api/user/notifications/read-all');
      this.refresh();
    });
    wrap.querySelector('#notif-push-toggle').addEventListener('click', (e) => {
      e.stopPropagation();
      PushNotifications.toggle();
    });
  },
  toggle() {
    if (!this.panelEl) return;
    const bell = document.getElementById('notif-bell');
    const rect = bell.getBoundingClientRect();
    const panelWidth = Math.min(340, window.innerWidth - 16);
    const maxRight = window.innerWidth - panelWidth - 8;
    const desiredRight = window.innerWidth - rect.right;
    const right = Math.min(Math.max(desiredRight, 8), Math.max(maxRight, 8));
    this.panelEl.style.top = `${rect.bottom + 8}px`;
    this.panelEl.style.right = `${right}px`;
    this.panelEl.classList.toggle('open');
  },
  async refresh() {
    const res = await API.get('/api/user/notifications');
    if (!res.success) return;
    const badge = document.getElementById('notif-badge');
    if (badge) {
      if (res.unread_count > 0) { badge.textContent = res.unread_count > 9 ? '9+' : res.unread_count; badge.style.display = 'flex'; }
      else badge.style.display = 'none';
    }
    const list = document.getElementById('notif-panel-list');
    if (!list) return;
    if (!res.data.length) {
      list.innerHTML = `<div class="notif-empty"><i class="fas fa-bell-slash"></i><p>Belum ada notifikasi</p></div>`;
      return;
    }
    const typeIcon = { info: 'fa-circle-info', success: 'fa-circle-check', warning: 'fa-triangle-exclamation', danger: 'fa-circle-exclamation' };
    list.innerHTML = res.data.map(n => `
      <div class="notif-item ${n.is_read ? '' : 'unread'}" data-id="${n.id}">
        <div class="notif-item-icon ${n.type}"><i class="fas ${typeIcon[n.type] || 'fa-bell'}"></i></div>
        <div class="notif-item-body">
          <div class="notif-item-title">${n.title}</div>
          <div class="notif-item-msg">${n.message}</div>
          <div class="notif-item-time">${formatDate(n.createdAt)}</div>
        </div>
      </div>
    `).join('');
    list.querySelectorAll('.notif-item').forEach(item => {
      item.addEventListener('click', async () => {
        const id = item.getAttribute('data-id');
        if (item.classList.contains('unread')) {
          await API.post(`/api/user/notifications/${id}/read`);
          item.classList.remove('unread');
          this.refresh();
        }
      });
    });
  },
};

const BottomNav = {
  items: [
    { href: '/dashboard', icon: 'fa-house',       label: 'Dashboard' },
    { href: '/history',   icon: 'fa-receipt',     label: 'Riwayat' },
    { href: '/deposit',   icon: 'fa-wallet',      label: 'Deposit' },
    { href: '/mutasi',    icon: 'fa-right-left',  label: 'Mutasi' },
    { href: '/profile',   icon: 'fa-user',        label: 'Profil' },
  ],
  init() {
    if (!document.querySelector('.app-layout')) return; 
    if (document.getElementById('bottom-nav')) return;
    const path = window.location.pathname.replace(/\/$/, '') || '/dashboard';
    const nav = document.createElement('nav');
    nav.className = 'bottom-nav';
    nav.id = 'bottom-nav';
    nav.innerHTML = this.items.map(it => {
      const active = path === it.href;
      return `<button type="button" class="bottom-nav-item${active ? ' active' : ''}" data-href="${it.href}">
        <span class="bn-icon"><i class="fas ${it.icon}"></i></span>
        <span class="bn-label">${it.label}</span>
      </button>`;
    }).join('');
    document.body.appendChild(nav);
    nav.querySelectorAll('[data-href]').forEach(el => {
      el.addEventListener('click', () => { window.location.href = el.getAttribute('data-href'); });
    });
  },
};

const CartWidget = {
  async init() {
    const badge = document.getElementById('cart-badge');
    if (!badge) return;
    await this.refresh();
    setInterval(() => this.refresh(), 30000);
  },
  async refresh() {
    const badge = document.getElementById('cart-badge');
    if (!badge) return;
    const res = await API.get('/api/cart');
    if (!res.success || !Array.isArray(res.data)) { badge.style.display = 'none'; return; }
    const count = res.data.reduce((sum, i) => sum + (i.unavailable ? 0 : i.quantity), 0);
    if (count > 0) { badge.textContent = count > 9 ? '9+' : count; badge.style.display = 'flex'; }
    else badge.style.display = 'none';
  },
};

const TopbarChat = {
  async init() {
    const btn = document.getElementById('topbar-chat-btn');
    if (!btn) return;
    await this.refresh();
    setInterval(() => this.refresh(), 30000);
  },
  async refresh() {
    const badge = document.getElementById('chat-unread-badge');
    if (!badge) return;
    const res = await API.get('/api/seller-chat/rooms');
    if (!res.success || !Array.isArray(res.data)) { badge.style.display = 'none'; return; }
    const unread = res.data.filter(r => r.unread).length;
    if (unread > 0) { badge.textContent = unread > 9 ? '9+' : unread; badge.style.display = 'flex'; }
    else badge.style.display = 'none';
  },
};

const MarketplaceNav = {
  init() {
    const marketplaceItem = document.querySelector('.nav-item[data-href="/order"]');
    if (!marketplaceItem) return;
    if (document.querySelector('.nav-item[data-href="/cart"]')) return; 
    const path = window.location.pathname;
    const items = [
      { href: '/cart', icon: 'fa-basket-shopping', label: 'Keranjang' },
      { href: '/wishlist', icon: 'fa-heart', label: 'Wishlist' },
    ];
    items.reverse().forEach(it => {
      const el = document.createElement('div');
      el.className = 'nav-item' + (path === it.href ? ' active' : '');
      el.setAttribute('data-href', it.href);
      el.innerHTML = `<span class="nav-icon"><i class="fas ${it.icon}"></i></span> ${it.label}`;
      marketplaceItem.insertAdjacentElement('afterend', el);
    });
  },
};

const Footer = {
  init() {
    if (document.getElementById('app-credit-footer')) return;
    const year = new Date().getFullYear();
    const footer = document.createElement('div');
    footer.id = 'app-credit-footer';
    footer.className = 'app-credit-footer';
    footer.innerHTML = `
      <div class="acf-brand"><i class="fas fa-store"></i> MyMarket</div>
      <div class="acf-line">&copy; ${year} MyMarket &mdash; dibangun dengan <i class="fas fa-heart"></i> oleh <strong>Austin Official</strong></div>
      <div class="acf-sub">Digital Marketplace &middot; Payment Gateway &middot; VPS Hosting &middot; austinstore.id</div>
    `;
    const target = document.querySelector('.page-content') || document.querySelector('.auth-page') || document.body;
    target.appendChild(footer);
  },
};

document.addEventListener('DOMContentLoaded', () => {
  Theme.init();
  MarketplaceNav.init();
  Sidebar.init();
  AppLogo.init();
  ScrollFX.init();
  Notifications.init();
  CartWidget.init();
  BottomNav.init();
  Footer.init();
  TopbarChat.init();
  const themeBtn = document.getElementById('theme-toggle');
  if (themeBtn) themeBtn.addEventListener('click', () => Theme.toggle());
  document.querySelectorAll('[data-logout]').forEach(btn => {
    btn.addEventListener('click', () => Auth.logout());
  });
});
