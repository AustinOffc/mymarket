/* Vertex shell + mode desktop otomatis (Market Austin) */
(function () {
  var d = document, root = d.documentElement;

  /* 1) MODE DESKTOP OTOMATIS: paksa viewport 1280 di perangkat kecil (setara "Situs desktop") */
  var mobile = (window.screen && screen.width ? screen.width : 1920) < 1100;
  var meta = d.querySelector('meta[name="viewport"]');
  if (!meta) { meta = d.createElement('meta'); meta.name = 'viewport'; d.head.appendChild(meta); }
  meta.setAttribute('content', 'width=1280');
  if (mobile) root.setAttribute('data-vx-mobile', '1');

  function ready(fn) { d.readyState === 'loading' ? d.addEventListener('DOMContentLoaded', fn) : fn(); }
  function ua() {
    var u = navigator.userAgent || '';
    if (/iPhone|iPad|iPod/i.test(u)) return ['Ketuk ikon <b>aA</b> di address bar Safari', 'Pilih <b>Minta Situs Web Desktop</b>'];
    if (/SamsungBrowser/i.test(u)) return ['Ketuk menu <b>☰</b> di bawah', 'Pilih <b>Situs desktop</b>'];
    return ['Ketuk menu <b>⋮</b> di pojok browser', 'Centang <b>Situs desktop</b> / <i>Desktop site</i>'];
  }
  function steps(list) { return '<ol><li>' + list.join('</li><li>') + '</li></ol>'; }

  function notice() {
    if (!mobile) return;
    var stuck = window.innerWidth < 1100; /* viewport override diabaikan browser */
    var seen = ''; try { seen = sessionStorage.getItem('vx_note'); } catch (e) {}
    if (!stuck && seen) return;
    var wrap = d.createElement('div');
    var box = '<div class="vx-note"><b>Situs ini khusus tampilan desktop</b><br>' +
      (stuck
        ? 'Browser kamu belum masuk mode desktop. Aktifkan manual:' + steps(ua())
        : 'Mode desktop sudah diaktifkan otomatis. Kalau tampilan belum pas, aktifkan <b>Situs desktop</b> di menu browser:' + steps(ua())) +
      '<div class="vx-note-actions">' + (stuck ? '<button class="go" data-a="reload">Muat ulang</button>' : '') +
      '<button data-a="close">' + (stuck ? 'Tetap lanjutkan' : 'Mengerti') + '</button></div></div>';
    if (stuck) { wrap.className = 'vx-block'; wrap.innerHTML = box; } else { wrap.innerHTML = box; wrap = wrap.firstChild; }
    wrap.addEventListener('click', function (e) {
      var a = e.target.getAttribute && e.target.getAttribute('data-a');
      if (a === 'reload') location.reload();
      if (a === 'close') { wrap.remove(); try { sessionStorage.setItem('vx_note', '1'); } catch (x) {} }
    });
    d.body.appendChild(wrap);
  }

  /* 2) BINTANG LATAR */
  function stars(n, blur, a0, a1) {
    var el = d.createElement('div'), s = [];
    el.className = 'vx-stars';
    for (var i = 0; i < n; i++) s.push((Math.random() * 100).toFixed(1) + 'vw ' + (Math.random() * 100).toFixed(1) + 'vh ' + blur + 'px 0 rgba(255,255,255,' + (a0 + Math.random() * (a1 - a0)).toFixed(2) + ')');
    el.style.boxShadow = s.join(',');
    d.body.insertBefore(el, d.body.firstChild);
  }

  var ORBIT = '<svg viewBox="0 0 48 48" fill="none"><defs><linearGradient id="vxa" x1="8" y1="8" x2="40" y2="40" gradientUnits="userSpaceOnUse"><stop stop-color="#8ef4ff"/><stop offset=".5" stop-color="#35d8ff"/><stop offset="1" stop-color="#0a86d8"/></linearGradient><linearGradient id="vxb" x1="40" y1="10" x2="10" y2="40" gradientUnits="userSpaceOnUse"><stop stop-color="#a6f7ff"/><stop offset="1" stop-color="#0f9ae0" stop-opacity=".25"/></linearGradient></defs><g transform="rotate(-32 24 24)"><ellipse cx="24" cy="24" rx="18.5" ry="9.6" stroke="url(#vxb)" stroke-width="3.1" stroke-linecap="round" stroke-dasharray="58 30" stroke-dashoffset="14"/><circle cx="41.4" cy="20.6" r="3.1" fill="#bff6ff"/></g><circle cx="24" cy="24" r="6.6" fill="url(#vxa)"/><circle cx="24" cy="24" r="2.6" fill="#fff"/></svg>';

  /* 3) SHELL: sidebar+topbar -> satu nav pill. Node dipindah (bukan dikloning)
        supaya semua handler & selector di app.js tetap jalan. */
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

    var kids = Array.prototype.slice.call(nav.children);
    var items = kids.filter(function (n) { return n.classList.contains('nav-item'); });
    var MAIN = 5, main = items.slice(0, MAIN);
    var more = d.createElement('div'), panel = d.createElement('div'), btn = d.createElement('button');
    more.className = 'vx-more'; panel.className = 'vx-panel';
    btn.type = 'button'; btn.className = 'vx-more-btn'; btn.innerHTML = 'Lainnya <i class="fas fa-chevron-down"></i>';
    var cut = main.length ? kids.indexOf(main[main.length - 1]) : -1;
    kids.forEach(function (n, i) {
      if (i <= cut && n.classList.contains('nav-item')) return;       /* tetap di bar */
      if (i <= cut) { n.style.display = 'none'; return; }             /* label sebelum item utama */
      panel.appendChild(n);
    });
    var foot = sidebar.querySelector('[data-logout]'); if (foot) panel.appendChild(foot);
    more.appendChild(btn); more.appendChild(panel); nav.appendChild(more);
    pill.appendChild(nav);
    if (!panel.querySelector('.nav-item')) more.style.display = 'none';
    btn.addEventListener('click', function (e) { e.stopPropagation(); more.classList.toggle('open'); });
    d.addEventListener('click', function (e) { if (!more.contains(e.target)) more.classList.remove('open'); });
    d.addEventListener('keydown', function (e) { if (e.key === 'Escape') more.classList.remove('open'); });
    panel.addEventListener('click', function () { more.classList.remove('open'); });

    /* app.js menyisipkan item lain (Keranjang, Wishlist, dll) setelah shell jadi: sisanya dilempar ke "Lainnya" */
    function rebalance() {
      var its = Array.prototype.filter.call(nav.children, function (n) { return n.classList.contains('nav-item'); });
      its.slice(MAIN).forEach(function (n) { panel.appendChild(n); });
      more.style.display = panel.querySelector('.nav-item') ? '' : 'none';
    }
    if (window.MutationObserver) new MutationObserver(rebalance).observe(nav, { childList: true });
    setTimeout(rebalance, 300); setTimeout(rebalance, 1500);

    var right = d.createElement('div'); right.className = 'vx-right';
    var acts = d.querySelector('.topbar-actions'); if (acts) right.appendChild(acts);
    var user = sidebar.querySelector('.sidebar-user'); if (user) right.appendChild(user);
    var cta = d.createElement('a'); cta.className = 'vx-cta'; cta.href = '/deposit'; cta.textContent = 'Deposit';
    right.appendChild(cta); pill.appendChild(right);

    var app = d.querySelector('.app-layout') || d.body;
    d.body.insertBefore(pill, d.body.firstChild);
    d.body.classList.add('vx-pill');
    if (!app) return;
  }

  ready(function () {
    if (d.querySelector('link[href*="style.css"]')) { stars(150, 0, .05, .30); stars(18, 1.2, .35, .70); }
    shell();
    /* logo di halaman login/daftar */
    var al = d.querySelector('.auth-logo .logo-icon'); if (al) al.innerHTML = ORBIT.replace(/vxa/g, 'vxc').replace(/vxb/g, 'vxd');
    setTimeout(notice, 500);
  });
})();
