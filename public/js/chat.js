
const LiveChat = {
  socket: null,
  panelEl: null,
  fabEl: null,
  currentUser: null,
  isOpen: false,
  unreadCount: 0,
  typingTimeout: null,

  async init() {
    const me = await API.get('/api/auth/me');
    if (!me.success) return;
    this.currentUser = me.user;

    this._buildUI();
    this._connectSocket();
    await this._loadHistory();
  },

  _buildUI() {
    const bell = document.getElementById('notif-bell');
    const anchor = bell ? (bell.closest('.notif-bell-wrapper') || bell.parentElement) : null;

    const wrapper = document.createElement('div');
    wrapper.className = 'notif-bell-wrapper';
    wrapper.id = 'chat-fab-wrapper';
    const fab = document.createElement('button');
    fab.className = 'btn-icon';
    fab.id = 'chat-fab';
    fab.type = 'button';
    fab.title = 'Live Chat';
    fab.innerHTML = `<i class="fas fa-comments"></i>`;
    const badge = document.createElement('span');
    badge.className = 'notif-badge';
    badge.id = 'chat-fab-badge';
    wrapper.appendChild(fab);
    wrapper.appendChild(badge);

    if (anchor) {
      anchor.insertAdjacentElement('afterend', wrapper);
    } else {
      const actions = document.querySelector('.topbar-actions');
      if (actions) actions.insertBefore(wrapper, actions.firstChild);
      else document.body.appendChild(wrapper); 
    }
    this.fabEl = fab;
    fab.addEventListener('click', () => this.toggle());

    const win = document.createElement('div');
    win.className = 'chat-window';
    win.id = 'chat-window';
    win.innerHTML = `
      <div class="chat-window-header">
        <div>
          <div class="chat-window-header-title"><i class="fas fa-comments"></i> Live Chat</div>
          <div class="chat-window-header-sub"><span class="chat-online-dot"></span><span id="chat-online-text">Menghubungkan...</span></div>
        </div>
        <button class="chat-window-close" id="chat-close-btn"><i class="fas fa-times"></i></button>
      </div>
      <div class="chat-connection-banner" id="chat-conn-banner">Koneksi realtime terputus, mencoba menyambung ulang...</div>
      <div class="chat-messages" id="chat-messages"><div class="chat-empty">Memuat percakapan...</div></div>
      <div class="chat-typing-indicator" id="chat-typing"></div>
      <div class="chat-input-row">
        <textarea id="chat-input" placeholder="Tulis pesan..." rows="1" maxlength="1000"></textarea>
        <button class="chat-send-btn" id="chat-send-btn"><i class="fas fa-paper-plane"></i></button>
      </div>
    `;
    document.body.appendChild(win);
    this.panelEl = win;

    document.getElementById('chat-close-btn').addEventListener('click', () => this.close());

    const input = document.getElementById('chat-input');
    const sendBtn = document.getElementById('chat-send-btn');
    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 80) + 'px';
      if (this.socket && this.socket.connected) this.socket.emit('chat:typing');
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });
    sendBtn.addEventListener('click', () => this.sendMessage());

    document.getElementById('chat-messages').addEventListener('click', (e) => {
      const btn = e.target.closest('.chat-del-btn');
      if (!btn) return;
      const msgEl = btn.closest('[data-id]');
      if (msgEl) this.deleteMessage(msgEl.getAttribute('data-id'));
    });
  },

  _connectSocket() {
    if (typeof io === 'undefined') {
      console.warn('Socket.IO client belum dimuat, chat akan pakai mode REST saja');
      this._setConnectionBanner(true);
      return;
    }
    this.socket = io(window.API_BASE_URL, { path: '/socket.io', withCredentials: true, reconnection: true });

    this.socket.on('connect', () => {
      this._setConnectionBanner(false);
    });
    this.socket.on('disconnect', () => {
      this._setConnectionBanner(true);
    });
    this.socket.on('connect_error', () => {
      this._setConnectionBanner(true);
    });

    this.socket.on('chat:new_message', (msg) => {
      this._appendMessage(msg, true);
      if (!this.isOpen) {
        this.unreadCount++;
        this._updateBadge();
      }
    });

    this.socket.on('chat:message_deleted', ({ id }) => {
      const el = document.querySelector(`.chat-msg[data-id="${id}"]`);
      if (el) el.remove();
    });

    this.socket.on('chat:online_count', ({ count }) => {
      const text = document.getElementById('chat-online-text');
      const dot = document.getElementById('chat-fab-online');
      if (text) text.textContent = `${count} member online`;
      if (dot) dot.style.display = count > 0 ? 'block' : 'none';
    });

    this.socket.on('chat:history_purged', () => {
      this._loadHistory();
    });

    let typingTimer = null;
    this.socket.on('chat:user_typing', ({ full_name }) => {
      const el = document.getElementById('chat-typing');
      if (!el) return;
      el.textContent = `${full_name} sedang mengetik...`;
      clearTimeout(typingTimer);
      typingTimer = setTimeout(() => { el.textContent = ''; }, 2500);
    });
  },

  _setConnectionBanner(show) {
    const banner = document.getElementById('chat-conn-banner');
    if (banner) banner.classList.toggle('show', show);
    const text = document.getElementById('chat-online-text');
    if (show && text) text.textContent = 'Terputus, mencoba lagi...';
  },

  async _loadHistory() {
    const res = await API.get('/api/chat/history?limit=50');
    const container = document.getElementById('chat-messages');
    if (!container) return;
    if (!res.success || !res.data.length) {
      container.innerHTML = `<div class="chat-empty"><i class="fas fa-comment-dots" style="font-size:26px;display:block;margin-bottom:8px;opacity:.5"></i>Belum ada pesan. Mulai obrolan pertama!</div>`;
      return;
    }
    container.innerHTML = '';
    res.data.forEach(msg => this._appendMessage(msg, false));
    this._scrollToBottom();
  },

  _appendMessage(msg, scroll) {
    const container = document.getElementById('chat-messages');
    if (!container) return;
    if (container.querySelector('.chat-empty')) container.innerHTML = '';

    const isMine = this.currentUser && msg.user_id === this.currentUser.id;
    const initial = (msg.full_name || msg.username || '?')[0].toUpperCase();
    const avatarHtml = msg.avatar ? `<img src="${msg.avatar}" alt="">` : initial;
    const canDelete = this.currentUser && this.currentUser.role === 'owner';
    const time = new Date(msg.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    const displayText = String(msg.message || '').replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

    const el = document.createElement('div');
    el.className = `chat-msg ${isMine ? 'mine' : ''}`;
    el.setAttribute('data-id', msg.id);
    el.innerHTML = `
      <div class="chat-msg-avatar">${avatarHtml}</div>
      <div class="chat-msg-body">
        <div class="chat-msg-name">${isMine ? 'Kamu' : msg.full_name}${msg.role === 'owner' ? '<span class="admin-tag">OWNER</span>' : ''}</div>
        <div class="chat-bubble">${escapeHtml(displayText)}${canDelete ? `<button class="chat-del-btn" type="button"><i class="fas fa-times"></i></button>` : ''}</div>
        <div class="chat-msg-time">${time}</div>
      </div>
    `;
    container.appendChild(el);
    if (scroll) this._scrollToBottom();
  },

  _scrollToBottom() {
    const container = document.getElementById('chat-messages');
    if (container) container.scrollTop = container.scrollHeight;
  },

  sendMessage() {
    const input = document.getElementById('chat-input');
    const text = input.value.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    if (!text) return;

    const btn = document.getElementById('chat-send-btn');
    btn.disabled = true;

    const finish = () => {
      input.value = '';
      input.style.height = 'auto';
      btn.disabled = false;
      input.focus();
    };

    if (this.socket && this.socket.connected) {
      this.socket.emit('chat:send_message', { message: text }, (res) => {
        if (!res.success) Toast.error(res.message);
        finish();
      });
    } else {
      API.post('/api/chat/send', { message: text }).then(res => {
        if (res.success) this._appendMessage(res.data, true);
        else Toast.error(res.message);
        finish();
      });
    }
  },

  async deleteMessage(id) {
    if (!await showConfirm('Hapus pesan ini?', { title: 'Hapus Pesan', okText: 'Hapus', danger: true })) return;
    const res = await API.request('DELETE', `/api/owner/chat/${id}`);
    if (res.success) {
      const el = document.querySelector(`.chat-msg[data-id="${id}"]`);
      if (el) el.remove();
    } else {
      Toast.error(res.message || 'Gagal menghapus pesan');
    }
  },

  toggle() {
    this.isOpen ? this.close() : this.open();
  },

  open() {
    this.panelEl?.classList.add('open');
    this.isOpen = true;
    this.unreadCount = 0;
    this._updateBadge();
    this._scrollToBottom();
    setTimeout(() => document.getElementById('chat-input')?.focus(), 150);
  },

  close() {
    this.panelEl?.classList.remove('open');
    this.isOpen = false;
  },

  _updateBadge() {
    const badge = document.getElementById('chat-fab-badge');
    if (!badge) return;
    if (this.unreadCount > 0) {
      badge.textContent = this.unreadCount > 9 ? '9+' : this.unreadCount;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  },
};

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', () => {
  LiveChat.init();
});
