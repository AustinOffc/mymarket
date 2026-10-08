/*
 * Custom Picker — pengganti popup bawaan browser agar ikut tema situs:
 *   1) <input type="date"> / <input type="datetime-local">  -> kalender tema
 *   2) <input list="..."> (datalist)                          -> daftar saran tema
 * Input asli TETAP ada di DOM (disembunyikan visual) dengan format value yang sama
 * (YYYY-MM-DD / YYYY-MM-DDTHH:mm), jadi script halaman yang membaca/menulis .value,
 * atau memasang listener 'input'/'change', tetap jalan tanpa perubahan.
 */
(function () {
  var MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  var MON_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  var DAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  var inputValueDesc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function parseVal(v) {
    var m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(String(v || ''));
    if (!m) return null;
    return { y: +m[1], m: +m[2] - 1, d: +m[3], h: m[4] ? +m[4] : 0, mi: m[5] ? +m[5] : 0 };
  }
  function fmtDisplay(p, withTime) {
    if (!p) return '';
    var s = pad(p.d) + ' ' + MON_SHORT[p.m] + ' ' + p.y;
    return withTime ? s + ', ' + pad(p.h) + ':' + pad(p.mi) : s;
  }
  function fmtValue(p, withTime) {
    var s = p.y + '-' + pad(p.m + 1) + '-' + pad(p.d);
    return withTime ? s + 'T' + pad(p.h) + ':' + pad(p.mi) : s;
  }

  /* ================= Date / datetime-local ================= */
  var openDt = null;

  function closeDt() {
    if (!openDt) return;
    openDt.wrap.classList.remove('open');
    openDt.panel.classList.remove('open');
    document.removeEventListener('mousedown', openDt.outside, true);
    document.removeEventListener('keydown', openDt.keys, true);
    window.removeEventListener('scroll', openDt.onScroll, true);
    window.removeEventListener('resize', openDt.onScroll, true);
    openDt = null;
  }

  function syncDt(c) {
    var p = parseVal(inputValueDesc.get.call(c.native));
    var el = c.trigger.querySelector('.cdt-value');
    el.textContent = p ? fmtDisplay(p, c.withTime) : (c.native.placeholder || (c.withTime ? 'Pilih tanggal & jam' : 'Pilih tanggal'));
    el.classList.toggle('is-placeholder', !p);
    c.trigger.classList.toggle('is-disabled', !!c.native.disabled);
  }

  function commitDt(c, p, close) {
    var v = p ? fmtValue(p, c.withTime) : '';
    inputValueDesc.set.call(c.native, v);
    c.native.dispatchEvent(new Event('input', { bubbles: true }));
    c.native.dispatchEvent(new Event('change', { bubbles: true }));
    syncDt(c);
    if (close) closeDt();
  }

  function renderDt(c) {
    var cur = parseVal(inputValueDesc.get.call(c.native));
    var today = new Date();
    var first = new Date(c.viewY, c.viewM, 1).getDay();
    var days = new Date(c.viewY, c.viewM + 1, 0).getDate();
    var html = '<div class="cdt-head">' +
      '<button type="button" class="cdt-nav" data-act="prev" aria-label="Bulan sebelumnya"><i class="fas fa-chevron-left"></i></button>' +
      '<div class="cdt-title">' + MONTHS[c.viewM] + ' ' + c.viewY + '</div>' +
      '<button type="button" class="cdt-nav" data-act="next" aria-label="Bulan berikutnya"><i class="fas fa-chevron-right"></i></button></div>';
    html += '<div class="cdt-grid cdt-dow">' + DAYS.map(function (d) { return '<span>' + d + '</span>'; }).join('') + '</div><div class="cdt-grid">';
    for (var i = 0; i < first; i++) html += '<span class="cdt-empty"></span>';
    for (var d = 1; d <= days; d++) {
      var cls = 'cdt-day';
      if (cur && cur.y === c.viewY && cur.m === c.viewM && cur.d === d) cls += ' is-selected';
      if (today.getFullYear() === c.viewY && today.getMonth() === c.viewM && today.getDate() === d) cls += ' is-today';
      html += '<button type="button" class="' + cls + '" data-day="' + d + '">' + d + '</button>';
    }
    html += '</div>';
    if (c.withTime) {
      var h = cur ? cur.h : c.timeH, mi = cur ? cur.mi : c.timeM;
      html += '<div class="cdt-time"><i class="fas fa-clock"></i>' +
        '<div class="cdt-spin"><button type="button" data-act="h+">+</button><input type="text" inputmode="numeric" maxlength="2" class="cdt-h" value="' + pad(h) + '"><button type="button" data-act="h-">−</button></div>' +
        '<span class="cdt-colon">:</span>' +
        '<div class="cdt-spin"><button type="button" data-act="m+">+</button><input type="text" inputmode="numeric" maxlength="2" class="cdt-m" value="' + pad(mi) + '"><button type="button" data-act="m-">−</button></div></div>';
    }
    html += '<div class="cdt-foot"><button type="button" class="cdt-link" data-act="clear">Hapus</button>' +
      '<button type="button" class="cdt-link" data-act="today">' + (c.withTime ? 'Sekarang' : 'Hari ini') + '</button>' +
      (c.withTime ? '<button type="button" class="cdt-ok" data-act="ok">Oke</button>' : '') + '</div>';
    c.panel.innerHTML = html;
  }

  function positionDt(c) {
    var r = c.trigger.getBoundingClientRect();
    var panel = c.panel;
    var w = Math.min(Math.max(r.width, 290), window.innerWidth - 16);
    var left = Math.min(Math.max(8, r.left), window.innerWidth - w - 8);
    panel.style.width = w + 'px';
    panel.style.left = left + 'px';
    var below = window.innerHeight - r.bottom;
    var h = panel.offsetHeight || 340;
    if (below < h + 12 && r.top > below) {
      panel.style.top = 'auto';
      panel.style.bottom = (window.innerHeight - r.top + 6) + 'px';
      panel.classList.add('drop-up');
    } else {
      panel.style.bottom = 'auto';
      panel.style.top = (r.bottom + 6) + 'px';
      panel.classList.remove('drop-up');
    }
  }

  function currentFromPanel(c, day) {
    var cur = parseVal(inputValueDesc.get.call(c.native));
    var hEl = c.panel.querySelector('.cdt-h'), mEl = c.panel.querySelector('.cdt-m');
    var h = hEl ? Math.min(23, Math.max(0, parseInt(hEl.value, 10) || 0)) : (cur ? cur.h : 0);
    var mi = mEl ? Math.min(59, Math.max(0, parseInt(mEl.value, 10) || 0)) : (cur ? cur.mi : 0);
    return { y: c.viewY, m: c.viewM, d: day, h: h, mi: mi };
  }

  function openDtPanel(c) {
    if (c.native.disabled) return;
    if (openDt && openDt !== c) closeDt();
    var cur = parseVal(inputValueDesc.get.call(c.native));
    var now = new Date();
    c.viewY = cur ? cur.y : now.getFullYear();
    c.viewM = cur ? cur.m : now.getMonth();
    c.timeH = now.getHours(); c.timeM = now.getMinutes();
    renderDt(c);
    c.wrap.classList.add('open');
    c.panel.classList.add('open');
    positionDt(c);
    openDt = c;
    document.addEventListener('mousedown', c.outside, true);
    document.addEventListener('keydown', c.keys, true);
    window.addEventListener('scroll', c.onScroll, true);
    window.addEventListener('resize', c.onScroll, true);
  }

  function enhanceDt(native) {
    if (native.dataset.cdtDone === '1') return;
    native.dataset.cdtDone = '1';
    var withTime = native.type === 'datetime-local';
    native.dataset.ctype = native.type;
    native.type = 'text'; // cegah popup bawaan; format value tetap sama (kita yang menulisnya)

    var wrap = document.createElement('div');
    wrap.className = 'cdt';
    var inlineStyle = native.getAttribute('style');
    if (inlineStyle) wrap.setAttribute('style', inlineStyle);
    native.parentNode.insertBefore(wrap, native);
    native.classList.add('cdt-native');
    wrap.appendChild(native);

    var trigger = document.createElement('div');
    trigger.className = 'cdt-trigger';
    trigger.tabIndex = 0;
    trigger.setAttribute('role', 'button');
    trigger.innerHTML = '<span class="cdt-value"></span><i class="far fa-calendar cdt-icon"></i>';
    wrap.appendChild(trigger);

    var panel = document.createElement('div');
    panel.className = 'cdt-panel';
    document.body.appendChild(panel);

    var c = { native: native, wrap: wrap, trigger: trigger, panel: panel, withTime: withTime, viewY: 0, viewM: 0, timeH: 0, timeM: 0 };
    wrap._cdt = c;
    c.outside = function (e) { if (!wrap.contains(e.target) && !panel.contains(e.target)) closeDt(); };
    c.keys = function (e) { if (e.key === 'Escape') { closeDt(); trigger.focus(); } };
    c.onScroll = function (e) { if (e.target && panel.contains(e.target)) return; closeDt(); };

    trigger.addEventListener('click', function () { openDt === c ? closeDt() : openDtPanel(c); });
    trigger.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDt === c ? closeDt() : openDtPanel(c); }
    });

    panel.addEventListener('click', function (e) {
      var dayBtn = e.target.closest('[data-day]');
      var actBtn = e.target.closest('[data-act]');
      if (dayBtn) {
        var p = currentFromPanel(c, +dayBtn.dataset.day);
        commitDt(c, p, !c.withTime);
        if (c.withTime) renderDt(c);
        return;
      }
      if (!actBtn) return;
      var act = actBtn.dataset.act;
      if (act === 'prev' || act === 'next') {
        c.viewM += act === 'next' ? 1 : -1;
        if (c.viewM < 0) { c.viewM = 11; c.viewY--; }
        if (c.viewM > 11) { c.viewM = 0; c.viewY++; }
        renderDt(c);
      } else if (act === 'clear') {
        commitDt(c, null, true);
      } else if (act === 'today') {
        var n = new Date();
        commitDt(c, { y: n.getFullYear(), m: n.getMonth(), d: n.getDate(), h: n.getHours(), mi: n.getMinutes() }, true);
      } else if (act === 'ok') {
        var cur = parseVal(inputValueDesc.get.call(c.native));
        if (cur) commitDt(c, currentFromPanel(c, cur.d), true);
        else closeDt();
      } else if (/^[hm][+-]$/.test(act)) {
        var cur2 = parseVal(inputValueDesc.get.call(c.native));
        var hEl = panel.querySelector('.cdt-h'), mEl = panel.querySelector('.cdt-m');
        var h = Math.min(23, Math.max(0, parseInt(hEl.value, 10) || 0));
        var mi = Math.min(59, Math.max(0, parseInt(mEl.value, 10) || 0));
        var dlt = act[1] === '+' ? 1 : -1;
        if (act[0] === 'h') h = (h + dlt + 24) % 24; else mi = (mi + dlt * 5 + 60) % 60;
        hEl.value = pad(h); mEl.value = pad(mi);
        if (cur2) commitDt(c, { y: cur2.y, m: cur2.m, d: cur2.d, h: h, mi: mi }, false);
      }
    });
    panel.addEventListener('change', function (e) {
      if (!e.target.matches('.cdt-h, .cdt-m')) return;
      var cur = parseVal(inputValueDesc.get.call(c.native));
      if (cur) commitDt(c, currentFromPanel(c, cur.d), false);
    });

    // script halaman yang set `input.value = ...` langsung harus ikut menyegarkan tampilan
    Object.defineProperty(native, 'value', {
      configurable: true,
      get: function () { return inputValueDesc.get.call(native); },
      set: function (v) { inputValueDesc.set.call(native, v); syncDt(c); },
    });
    new MutationObserver(function () { syncDt(c); }).observe(native, { attributes: true, attributeFilter: ['disabled', 'placeholder'] });
    syncDt(c);
  }

  /* ================= Datalist suggestions ================= */
  var openDl = null;

  function closeDl() {
    if (!openDl) return;
    openDl.panel.classList.remove('open');
    openDl = null;
  }

  function buildDl(c) {
    var list = document.getElementById(c.listId);
    var q = c.input.value.trim().toLowerCase();
    var opts = list ? Array.prototype.slice.call(list.options) : [];
    var items = opts.filter(function (o) {
      if (!q) return true;
      return (o.value + ' ' + (o.label || o.textContent || '')).toLowerCase().indexOf(q) !== -1;
    }).slice(0, 60);
    c.panel.innerHTML = '';
    if (!items.length) { closeDl(); return false; }
    items.forEach(function (o) {
      var row = document.createElement('div');
      row.className = 'csel-option cdl-option';
      var label = o.label || o.textContent || '';
      row.innerHTML = '<span></span>';
      row.firstChild.textContent = o.value + (label && label !== o.value ? ' — ' + label : '');
      row.addEventListener('mousedown', function (e) {
        e.preventDefault(); // jangan blur dulu
        c.input.value = o.value;
        c.input.dispatchEvent(new Event('input', { bubbles: true }));
        c.input.dispatchEvent(new Event('change', { bubbles: true }));
        closeDl();
      });
      c.panel.appendChild(row);
    });
    return true;
  }

  function showDl(c) {
    if (openDl && openDl !== c) closeDl();
    if (!buildDl(c)) return;
    var r = c.input.getBoundingClientRect();
    c.panel.style.left = r.left + 'px';
    c.panel.style.width = r.width + 'px';
    var below = window.innerHeight - r.bottom;
    if (below < 220 && r.top > below) { c.panel.style.top = 'auto'; c.panel.style.bottom = (window.innerHeight - r.top + 6) + 'px'; }
    else { c.panel.style.bottom = 'auto'; c.panel.style.top = (r.bottom + 6) + 'px'; }
    c.panel.classList.add('open');
    openDl = c;
  }

  function enhanceDl(input) {
    if (input.dataset.cdlDone === '1') return;
    var id = input.getAttribute('list');
    if (!id) return;
    input.dataset.cdlDone = '1';
    input.dataset.cdlList = id;
    input.removeAttribute('list'); // matikan dropdown datalist bawaan browser
    input.setAttribute('autocomplete', 'off');
    var panel = document.createElement('div');
    panel.className = 'csel-panel cdl-panel';
    document.body.appendChild(panel);
    var c = { input: input, panel: panel, listId: id };
    input._cdl = c;
    input.addEventListener('focus', function () { showDl(c); });
    input.addEventListener('click', function () { showDl(c); });
    input.addEventListener('input', function () { showDl(c); });
    input.addEventListener('blur', function () { setTimeout(function () { if (openDl === c) closeDl(); }, 120); });
    input.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDl(); });
    window.addEventListener('scroll', function (e) { if (openDl === c && !(e.target && panel.contains(e.target))) closeDl(); }, true);
  }

  /* ================= Bootstrap ================= */
  var SEL = 'input[type="date"], input[type="datetime-local"]';
  function enhanceAll(root) {
    (root || document).querySelectorAll(SEL).forEach(enhanceDt);
    (root || document).querySelectorAll('input[list]').forEach(enhanceDl);
  }
  function cleanup(node) {
    if (node.nodeType !== 1) return;
    var wraps = node.classList && node.classList.contains('cdt') ? [node] : Array.prototype.slice.call(node.querySelectorAll ? node.querySelectorAll('.cdt') : []);
    wraps.forEach(function (w) {
      if (w._cdt && w._cdt.panel.parentNode) {
        if (openDt === w._cdt) closeDt();
        w._cdt.panel.parentNode.removeChild(w._cdt.panel);
      }
    });
    var inputs = node.matches && node.matches('input[data-cdl-done]') ? [node] : Array.prototype.slice.call(node.querySelectorAll ? node.querySelectorAll('input[data-cdl-done]') : []);
    inputs.forEach(function (i) {
      if (i._cdl && i._cdl.panel.parentNode) {
        if (openDl === i._cdl) closeDl();
        i._cdl.panel.parentNode.removeChild(i._cdl.panel);
      }
    });
  }
  function init() {
    enhanceAll(document);
    new MutationObserver(function (muts) {
      muts.forEach(function (m) {
        m.addedNodes.forEach(function (n) {
          if (n.nodeType !== 1) return;
          if (n.matches && n.matches(SEL)) enhanceDt(n);
          if (n.matches && n.matches('input[list]')) enhanceDl(n);
          if (n.querySelectorAll) enhanceAll(n);
        });
        m.removedNodes.forEach(cleanup);
      });
    }).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
