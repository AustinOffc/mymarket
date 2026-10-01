/* Vertex shell (Market Austin) — responsif.
   Desktop  : nav pill melayang, menu utama di bar, sisanya di dropdown "Lainnya".
   Tablet/HP: bar ringkas (logo, saldo, aksi, tombol menu); semua menu ada di panel. */
(function () {
  var d = document;
  function ready(fn) { d.readyState === 'loading' ? d.addEventListener('DOMContentLoaded', fn) : fn(); }

  function stars(n, blur, a0, a1) {
    var el = d.createElement('div'), s = [];
    el.className = 'vx-stars';
    for (var i = 0; i < n; i++) s.push((Math.random() * 100).toFixed(1) + 'vw ' + (Math.random() * 100).toFixed(1) + 'vh ' + blur + 'px 0 rgba(255,255,255,' + (a0 + Math.random() * (a1 - a0)).toFixed(2) + ')');
    el.style.boxShadow = s.join(',');
    d.body.insertBefore(el, d.body.firstChild);
  }

  var ORBIT = '<svg viewBox="0 0 48 48" fill="none"><defs><linearGradient id="vxa" x1="8" y1="8" x2="40" y2="40" gradientUnits="userSpaceOnUse"><stop stop-color="#8ef4ff"/><stop offset=".5" stop-color="#35d8ff"/><stop offset="1" stop-color="#0a86d8"/></linearGradient><linearGradient id="vxb" x1="40" y1="10" x2="10" y2="40" gradientUnits="userSpaceOnUse"><stop stop-color="#a6f7ff"/><stop offset="1" stop-color="#0f9ae0" stop-opacity=".25"/></linearGradient></defs><g transform="rotate(-32 24 24)"><ellipse cx="24" cy="24" rx="18.5" ry="9.6" stroke="url(#vxb)" stroke-width="3.1" stroke-linecap="round" stroke-dasharray="58 30" stroke-dashoffset="14"/><circle cx="41.4" cy="20.6" r="3.1" fill="#bff6ff"/></g><circle cx="24" cy="24" r="6.6" fill="url(#vxa)"/><circle cx="24" cy="24" r="2.6" fill="#fff"/></svg>';

  /* jumlah menu yang tampil langsung di bar, sesuai lebar layar */
  function mainCount() {
    var w = window.innerWidth;
    return w >= 1280 ? 5 : w >= 1060 ? 4 : w >= 900 ? 3 : 0;
  }

  function shell() {
    var sidebar = d.querySelector('.sidebar'), nav = d.querySelector('.sidebar-nav');
    if (!sidebar || !nav || d.getElementById('admin-nav')) return; /* owner panel: tetap rail */
    var pill = d.createElement('header'); pill.className = 'vx-nav'; pill.id = 'vx-nav';

    var logo = sidebar.querySelector('.sidebar-logo');
    if (logo) {
      var li = logo.querySelector('.logo-icon'); if (li) li.innerHTML = ORBIT;
      logo.addEventListener('click', function () { location.href = '/'; });
      pill.appendChild(logo);
    }

    var more = d.createElement('div'), panel = d.createElement('div'), btn = d.createElement('button');
    more.className = 'vx-more'; panel.className = 'vx-panel';
    btn.type = 'button'; btn.className = 'vx-more-btn'; btn.setAttribute('aria-label', 'Menu'); btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '<span class="vx-more-label">Lainnya</span><i class="fas fa-chevron-down vx-chev"></i><i class="fas fa-bars vx-burger"></i>';

    /* label seksi tidak dipakai di nav pill */
    Array.prototype.slice.call(nav.children).forEach(function (n) {
      if (n.classList.contains('nav-section-label')) n.remove();
    });
    var foot = sidebar.querySelector('[data-logout]'); if (foot) panel.appendChild(foot);
    more.appendChild(btn); more.appendChild(panel); nav.appendChild(more);
    pill.appendChild(nav);

    function isItem(n) { return n.classList && n.classList.contains('nav-item') && !n.hasAttribute('data-logout'); }
    var busy = false;
    function layout() {
      if (busy) return; busy = true;
      var count = mainCount();
      var its = Array.prototype.filter.call(nav.children, isItem).concat(Array.prototype.filter.call(panel.children, isItem));
      var logout = panel.querySelector('[data-logout]');
      its.forEach(function (it, i) {
        if (i < count) { if (it.parentNode !== nav) nav.insertBefore(it, more); }
        else if (it.parentNode !== panel) panel.insertBefore(it, logout || null);
      });
      /* urutan di dalam bar harus ikut urutan asli */
      its.slice(0, count).forEach(function (it) { nav.insertBefore(it, more); });
      its.slice(count).forEach(function (it) { panel.insertBefore(it, logout || null); });
      more.style.display = panel.querySelector('.nav-item') ? '' : 'none';
      busy = false;
    }
    function close() { more.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); }
    btn.addEventListener('click', function (e) {
      e.stopPropagation(); var o = more.classList.toggle('open'); btn.setAttribute('aria-expanded', o ? 'true' : 'false');
    });
    d.addEventListener('click', function (e) { if (!more.contains(e.target)) close(); });
    d.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    panel.addEventListener('click', close);

    /* app.js menyisipkan Keranjang & Wishlist setelah shell jadi */
    if (window.MutationObserver) {
      var mo = new MutationObserver(function () { layout(); });
      mo.observe(nav, { childList: true }); mo.observe(panel, { childList: true });
    }
    var t; window.addEventListener('resize', function () { clearTimeout(t); t = setTimeout(layout, 120); });
    layout();

    var right = d.createElement('div'); right.className = 'vx-right';
    var acts = d.querySelector('.topbar-actions'); if (acts) right.appendChild(acts);
    var user = sidebar.querySelector('.sidebar-user'); if (user) right.appendChild(user);
    var cta = d.createElement('a'); cta.className = 'vx-cta'; cta.href = '/deposit';
    cta.innerHTML = '<i class="fas fa-plus"></i><span>Deposit</span>';
    right.appendChild(cta); pill.appendChild(right);

    d.body.insertBefore(pill, d.body.firstChild);
    d.body.classList.add('vx-pill');
  }

  ready(function () {
    if (d.querySelector('link[href*="style.css"]')) { stars(window.innerWidth < 700 ? 70 : 150, 0, .05, .30); stars(12, 1.2, .35, .70); }
    shell();
    var al = d.querySelector('.auth-logo .logo-icon'); if (al) al.innerHTML = ORBIT.replace(/vxa/g, 'vxc').replace(/vxb/g, 'vxd');
  });
})();
