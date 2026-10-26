(function () {
  var SELECTOR = 'select';

  function buildPanel(csel) {
    var native = csel._native;
    var panel = csel._panel;
    panel.innerHTML = '';

    if (!native.options.length) {
      var empty = document.createElement('div');
      empty.className = 'csel-panel-empty';
      empty.textContent = 'Tidak ada opsi';
      panel.appendChild(empty);
      return;
    }

    for (var i = 0; i < native.options.length; i++) {
      (function (opt, index) {
        var row = document.createElement('div');
        row.className = 'csel-option';
        row.setAttribute('role', 'option');
        row.dataset.index = index;
        row.textContent = opt.textContent;
        if (opt.disabled) row.classList.add('is-disabled-opt');
        if (index === native.selectedIndex) row.classList.add('is-selected');
        row.addEventListener('click', function () {
          if (opt.disabled) return;
          selectIndex(csel, index);
          closePanel(csel);
        });
        panel.appendChild(row);
      })(native.options[i], i);
    }
  }

  function syncTrigger(csel) {
    var native = csel._native;
    var valueEl = csel._trigger.querySelector('.csel-value');
    var opt = native.options[native.selectedIndex];
    var text = opt ? opt.textContent : '';
    valueEl.textContent = text || '\u00A0';
    valueEl.classList.toggle('is-placeholder', !!opt && (opt.value === '' || opt.disabled));
    var disabled = native.disabled;
    csel._trigger.classList.toggle('is-disabled', disabled);
    csel._trigger.tabIndex = disabled ? -1 : 0;
  }

  function selectIndex(csel, index) {
    var native = csel._native;
    if (native.selectedIndex === index) return;
    native.selectedIndex = index;
    native.dispatchEvent(new Event('input', { bubbles: true }));
    native.dispatchEvent(new Event('change', { bubbles: true }));
    syncTrigger(csel);
    buildPanel(csel);
  }

  function closeAllExcept(exceptCsel) {
    document.querySelectorAll('.csel.open').forEach(function (el) {
      if (el !== exceptCsel) closePanel(el._cselInstance || el);
    });
  }

  function positionPanel(csel) {
    var rect = csel._trigger.getBoundingClientRect();
    var panel = csel._panel;
    var spaceBelow = window.innerHeight - rect.bottom;
    var dropUp = spaceBelow < 260 && rect.top > spaceBelow;
    panel.classList.toggle('drop-up', dropUp);
    panel.style.left = rect.left + 'px';
    panel.style.width = rect.width + 'px';
    if (dropUp) {
      panel.style.top = 'auto';
      panel.style.bottom = (window.innerHeight - rect.top + 6) + 'px';
    } else {
      panel.style.bottom = 'auto';
      panel.style.top = (rect.bottom + 6) + 'px';
    }
  }

  function openPanel(csel) {
    if (csel._native.disabled) return;
    closeAllExcept(csel);
    buildPanel(csel);
    positionPanel(csel);
    csel.el.classList.add('open');
    csel._panel.classList.add('open');
    document.addEventListener('mousedown', csel._outsideHandler, true);
    document.addEventListener('keydown', csel._keyHandler, true);
    window.addEventListener('scroll', csel._scrollHandler, true);
    window.addEventListener('resize', csel._scrollHandler, true);
  }

  function closePanel(csel) {
    csel.el.classList.remove('open');
    csel._panel.classList.remove('open');
    document.removeEventListener('mousedown', csel._outsideHandler, true);
    document.removeEventListener('keydown', csel._keyHandler, true);
    window.removeEventListener('scroll', csel._scrollHandler, true);
    window.removeEventListener('resize', csel._scrollHandler, true);
  }

  function enhance(native) {
    if (native.dataset.cselDone === '1' || native.multiple) return;
    native.dataset.cselDone = '1';

    var wrap = document.createElement('div');
    wrap.className = 'csel';
    var inlineStyle = native.getAttribute('style');
    if (inlineStyle) wrap.setAttribute('style', inlineStyle);
    native.parentNode.insertBefore(wrap, native);
    native.classList.add('csel-native');
    wrap.appendChild(native);

    var trigger = document.createElement('div');
    trigger.className = 'csel-trigger';
    trigger.setAttribute('tabindex', '0');
    trigger.setAttribute('role', 'combobox');
    trigger.innerHTML = '<span class="csel-value"></span><i class="fas fa-chevron-down csel-chevron"></i>';
    wrap.appendChild(trigger);

    var panel = document.createElement('div');
    panel.className = 'csel-panel';
    panel.setAttribute('role', 'listbox');
    document.body.appendChild(panel);

    var csel = { el: wrap, _native: native, _trigger: trigger, _panel: panel };
    wrap._cselInstance = csel;

    csel._outsideHandler = function (e) {
      if (!wrap.contains(e.target) && !panel.contains(e.target)) closePanel(csel);
    };
    csel._keyHandler = function (e) {
      if (e.key === 'Escape') { closePanel(csel); trigger.focus(); }
    };
    csel._scrollHandler = function (e) {
      if (e.target && panel.contains(e.target)) return;
      closePanel(csel);
    };

    trigger.addEventListener('click', function () {
      if (wrap.classList.contains('open')) closePanel(csel);
      else openPanel(csel);
    });
    trigger.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (wrap.classList.contains('open')) closePanel(csel);
        else openPanel(csel);
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        var dir = e.key === 'ArrowDown' ? 1 : -1;
        var next = native.selectedIndex + dir;
        if (next >= 0 && next < native.options.length && !native.options[next].disabled) {
          selectIndex(csel, next);
        }
      }
    });

    var mo = new MutationObserver(function () {
      syncTrigger(csel);
      if (wrap.classList.contains('open')) buildPanel(csel);
    });
    mo.observe(native, { attributes: true, attributeFilter: ['disabled'], childList: true, subtree: true });

    var proto = Object.getPrototypeOf(native);
    var valueDesc = Object.getOwnPropertyDescriptor(proto, 'value')
      || (window.HTMLSelectElement && Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value'));
    if (valueDesc && valueDesc.configurable && valueDesc.set) {
      Object.defineProperty(native, 'value', {
        configurable: true,
        get: function () { return valueDesc.get.call(native); },
        set: function (v) {
          valueDesc.set.call(native, v);
          syncTrigger(csel);
          if (wrap.classList.contains('open')) buildPanel(csel);
        },
      });
    }
    var indexDesc = Object.getOwnPropertyDescriptor(proto, 'selectedIndex')
      || (window.HTMLSelectElement && Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'selectedIndex'));
    if (indexDesc && indexDesc.configurable && indexDesc.set) {
      Object.defineProperty(native, 'selectedIndex', {
        configurable: true,
        get: function () { return indexDesc.get.call(native); },
        set: function (v) {
          indexDesc.set.call(native, v);
          syncTrigger(csel);
          if (wrap.classList.contains('open')) buildPanel(csel);
        },
      });
    }

    syncTrigger(csel);
  }

  function enhanceAll(root) {
    (root || document).querySelectorAll(SELECTOR).forEach(enhance);
  }

  function cleanupRemoved(node) {
    if (node.nodeType !== 1) return;
    var wraps = node.classList && node.classList.contains('csel') ? [node] : (node.querySelectorAll ? Array.prototype.slice.call(node.querySelectorAll('.csel')) : []);
    wraps.forEach(function (wrap) {
      var csel = wrap._cselInstance;
      if (csel && csel._panel && csel._panel.parentNode) {
        closePanel(csel);
        csel._panel.parentNode.removeChild(csel._panel);
      }
    });
  }

  function init() {
    enhanceAll(document);
    var bodyObserver = new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        m.addedNodes.forEach(function (node) {
          if (node.nodeType !== 1) return;
          if (node.matches && node.matches(SELECTOR)) enhance(node);
          if (node.querySelectorAll) enhanceAll(node);
        });
        m.removedNodes.forEach(cleanupRemoved);
      });
    });
    bodyObserver.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
