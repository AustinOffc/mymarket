
const CustomerService = {
  panelEl: null,
  winEl: null,
  socket: null,
  room: null,
  isOpen: false,
  links: { whatsapp_link: null, telegram_link: null },

  async init() {
    const bell = document.getElementById('notif-bell');
    if (!bell) return; 
    if (document.getElementById('cs-bell')) return; 

    this._injectButton(bell);
    this._buildPanel();
    this._buildChatWindow();
    this._connectSocket();
    await this._loadSettings();

    const btn = document.getElementById('cs-bell');
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.togglePanel();
    });
    document.addEventListener('click', (e) => {
      if (this.panelEl && !this.panelEl.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
        this.panelEl.classList.remove('open');
      }
    });
  },

  _injectButton(bell) {
    const wrapper = bell.closest('.notif-bell-wrapper') || bell.parentElement;
    const btn = document.createElement('button');
    btn.className = 'btn-icon';
    btn.id = 'cs-bell';
    btn.type = 'button';
    btn.title = 'Customer Service';
    btn.innerHTML = '<i class="fas fa-headset"></i>';
    wrapper.insertAdjacentElement('afterend', btn);
  },

  _buildPanel() {
    const wrap = document.createElement('div');
    wrap.id = 'cs-panel';
    wrap.className = 'cs-panel';
    wrap.innerHTML = `
      <div class="cs-panel-header"><span><i class="fas fa-headset"></i> Customer Service</span></div>
      <div class="cs-panel-list">
        <div class="cs-panel-item" data-action="livechat">
          <div class="cs-panel-icon livechat"><i class="fas fa-comments"></i></div>
          <div class="cs-panel-body">
            <div class="cs-panel-title">Live Chat</div>
            <div class="cs-panel-sub">Chat langsung, dibalas AI &amp; Owner</div>
          </div>
          <i class="fas fa-chevron-right cs-panel-arrow"></i>
        </div>
        <div class="cs-panel-item" data-action="whatsapp">
          <div class="cs-panel-icon whatsapp"><i class="fab fa-whatsapp"></i></div>
          <div class="cs-panel-body">
            <div class="cs-panel-title">WhatsApp</div>
            <div class="cs-panel-sub">Hubungi kami via WhatsApp</div>
          </div>
          <i class="fas fa-chevron-right cs-panel-arrow"></i>
        </div>
        <div class="cs-panel-item" data-action="telegram">
          <div class="cs-panel-icon telegram"><i class="fab fa-telegram"></i></div>
          <div class="cs-panel-body">
            <div class="cs-panel-title">Telegram</div>
            <div class="cs-panel-sub">Hubungi kami via Telegram</div>
          </div>
          <i class="fas fa-chevron-right cs-panel-arrow"></i>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);
    this.panelEl = wrap;

    wrap.querySelectorAll('.cs-panel-item').forEach(item => {
      item.addEventListener('click', () => {
        const action = item.getAttribute('data-action');
        wrap.classList.remove('open');
        if (action === 'livechat') this.openChat();
        else if (action === 'whatsapp') this._openExternal(this.links.whatsapp_link, 'WhatsApp');
        else if (action === 'telegram') this._openExternal(this.links.telegram_link, 'Telegram');
      });
    });
  },

  _openExternal(link, label) {
    if (!link) {
      Toast.warning(`${label} belum dikonfigurasi oleh admin`);
      return;
    }
    window.open(link, '_blank', 'noopener');
  },

  togglePanel() {
    if (!this.panelEl) return;
    const btn = document.getElementById('cs-bell');
    const rect = btn.getBoundingClientRect();
    this.panelEl.style.top = `${rect.bottom + 8}px`;
    this.panelEl.style.right = `${Math.max(8, window.innerWidth - rect.right)}px`;
    this.panelEl.classList.toggle('open');
  },

  async _loadSettings() {
    const res = await API.get('/api/cs/settings');
    if (!res.success) return;
    this.links.whatsapp_link = res.whatsapp_link;
    this.links.telegram_link = res.telegram_link;
  },

  _buildChatWindow() {
    const win = document.createElement('div');
    win.className = 'chat-window';
    win.id = 'cs-chat-window';
    win.innerHTML = `
      <div class="chat-window-header">
        <div>
          <div class="chat-window-header-title"><i class="fas fa-headset"></i> Live Chat Customer Service</div>
          <div class="chat-window-header-sub"><span class="chat-online-dot"></span><span id="cs-chat-status">Menghubungkan...</span></div>
        </div>
        <button class="chat-window-close" id="cs-chat-close-btn"><i class="fas fa-times"></i></button>
      </div>
      <div class="chat-messages" id="cs-chat-messages"><div class="chat-empty">Memuat percakapan...</div></div>
      <div class="chat-input-row">
        <textarea id="cs-chat-input" placeholder="Tulis pesan..." rows="1" maxlength="1000"></textarea>
        <button class="chat-send-btn" id="cs-chat-send-btn"><i class="fas fa-paper-plane"></i></button>
      </div>
    `;
    document.body.appendChild(win);
    this.winEl = win;

    document.getElementById('cs-chat-close-btn').addEventListener('click', () => this.closeChat());

    const input = document.getElementById('cs-chat-input');
    const sendBtn = document.getElementById('cs-chat-send-btn');
    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 80) + 'px';
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this._send(); }
    });
    sendBtn.addEventListener('click', () => this._send());
  },

  async openChat() {
    this.winEl.classList.add('open');
    this.isOpen = true;
    await this._loadRoom();
    document.getElementById('cs-chat-input')?.focus();
  },

  closeChat() {
    this.winEl.classList.remove('open');
    this.isOpen = false;
  },

  async _loadRoom() {
    const list = document.getElementById('cs-chat-messages');
    list.innerHTML = `<div class="chat-empty">Memuat percakapan...</div>`;
    const res = await API.get('/api/cs/room');
    if (!res.success) {
      list.innerHTML = `<div class="chat-empty">Gagal memuat live chat. Coba lagi.</div>`;
      return;
    }
    this.room = res.room;
    this._updateStatus();
    list.innerHTML = '';
    if (!res.messages.length) {
      list.innerHTML = `<div class="chat-empty"><i class="fas fa-comments"></i><p>Belum ada percakapan</p></div>`;
    } else {
      res.messages.forEach(m => this._appendMessage(m));
    }
    list.scrollTop = list.scrollHeight;
  },

  _updateStatus() {
    const el = document.getElementById('cs-chat-status');
    if (!el || !this.room) return;
    if (this.room.status === 'closed') el.textContent = 'Sesi ditutup — kirim pesan untuk buka lagi';
    else if (this.room.assigned_admin) el.textContent = 'Sedang dibalas Owner';
    else el.textContent = 'Dibalas otomatis oleh AI Assistant';
  },

  _appendMessage(m) {
    const list = document.getElementById('cs-chat-messages');
    if (!list) return;
    const empty = list.querySelector('.chat-empty');
    if (empty) empty.remove();

    if (m.sender_type === 'system') {
      const div = document.createElement('div');
      div.className = 'chat-empty';
      div.style.padding = '6px 16px';
      div.textContent = m.message;
      list.appendChild(div);
      list.scrollTop = list.scrollHeight;
      return;
    }

    const mine = m.sender_type === 'user';
    const div = document.createElement('div');
    div.className = `chat-msg ${mine ? 'mine' : ''}`;
    div.dataset.id = m.id;
    const label = m.sender_type === 'ai'
      ? `<span class="admin-tag" style="background:var(--info)">AI</span> ${m.sender_name || 'AI Assistant'}`
      : m.sender_type === 'owner'
        ? `<span class="admin-tag">Owner</span> ${m.sender_name || 'Owner'}`
        : (m.sender_name || 'Kamu');
    div.innerHTML = `
      <div class="chat-msg-avatar">${mine ? '' : '<i class="fas fa-headset"></i>'}</div>
      <div class="chat-msg-body">
        <div class="chat-msg-name">${label}</div>
        <div class="chat-bubble">${this._esc(String(m.message || '').replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim())}${m.image_url ? `<br><a href="${this._esc(m.image_url)}" target="_blank" rel="noopener"><img src="${this._esc(m.image_url)}" alt="Lampiran" style="max-width:180px;border-radius:8px;margin-top:6px;display:block"></a>` : ''}</div>
        <div class="chat-msg-time">${formatDate(m.createdAt)}</div>
      </div>
    `;
    list.appendChild(div);
    list.scrollTop = list.scrollHeight;
  },

  _esc(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  },

  async _send() {
    const input = document.getElementById('cs-chat-input');
    const raw = input.value.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    if (!raw) return;
    input.value = '';
    input.style.height = 'auto';

    const res = await API.post('/api/cs/room/messages', { message: raw });
    if (!res.success) {
      Toast.error(res.message || 'Gagal mengirim pesan');
      return;
    }
    if (!document.querySelector(`#cs-chat-messages .chat-msg[data-id="${res.data.id}"]`)) {
      this._appendMessage(res.data);
    }
  },

  _connectSocket() {
    if (typeof io === 'undefined') return;
    this.socket = io(window.API_BASE_URL, { path: '/socket.io', withCredentials: true, reconnection: true });

    this.socket.on('cs:new_message', (msg) => {
      if (!this.room || msg.room_id !== this.room.id) return;
      if (document.querySelector(`#cs-chat-messages .chat-msg[data-id="${msg.id}"]`)) return;
      this._appendMessage(msg);
    });

    this.socket.on('cs:room_updated', (room) => {
      if (!this.room || room.id !== this.room.id) return;
      this.room = room;
      this._updateStatus();
    });

    this.socket.on('cs:room_closed', (room) => {
      if (!this.room || room.id !== this.room.id) return;
      this.room = room;
      this._updateStatus();
    });
  },
};

document.addEventListener('DOMContentLoaded', () => {
  CustomerService.init();
});
