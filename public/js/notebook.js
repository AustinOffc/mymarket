/* Notebook theme helper — dekorasi paku/selotip, tanpa mengubah logika halaman. */
(function () {
  function decorate(root) {
    (root || document).querySelectorAll('.wallet-hero:not([data-nb]), .auth-card:not([data-nb])').forEach(function (el) {
      el.setAttribute('data-nb', '1');
      el.classList.add(el.classList.contains('auth-card') ? 'nb-tape' : 'nb-pin');
    });
    (root || document).querySelectorAll('[data-nb-decor]:not([data-nb])').forEach(function (el) {
      el.setAttribute('data-nb', '1');
      el.classList.add(el.getAttribute('data-nb-decor') === 'pin' ? 'nb-pin' : 'nb-tape');
    });
  }
  function init() {
    decorate();
    var t;
    new MutationObserver(function () { clearTimeout(t); t = setTimeout(decorate, 120); })
      .observe(document.body, { childList: true, subtree: true });
    var m = document.querySelector('meta[name="theme-color"]');
    if (!m) { m = document.createElement('meta'); m.name = 'theme-color'; document.head.appendChild(m); }
    function sync() { m.content = document.documentElement.getAttribute('data-theme') === 'dark' ? '#15130F' : '#F1EDE3'; }
    sync();
    new MutationObserver(sync).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
