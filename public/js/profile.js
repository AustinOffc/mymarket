let userData = null;

async function init() {
  const res = await Auth.check();
  if (!res) return;
  userData = res.user;
  Auth.renderUserInfo(res.user, res.wallet);
  populateForm(res.user, res.wallet);
  loadLoginHistory();
  loadSellerApplyCard();
  loadResellerCard();
  loadGoogleLinkCard(res.user);
}

// Fix temuan #8 (laporan audit keamanan): dulu akun Google auto-tertaut ke akun lokal
// manapun yang emailnya sama, tanpa konfirmasi apapun. Sekarang penautan cuma bisa
// lewat sini (butuh sesi login yang sudah terbukti pakai password) lewat endpoint baru
// /api/auth/link-google.
async function loadGoogleLinkCard(user) {
  const statusEl = document.getElementById('google-link-status');
  const boxEl = document.getElementById('google-link-box');
  if (!statusEl || !boxEl) return;

  if (user.google_id) {
    statusEl.innerHTML = '<i class="fas fa-check-circle" style="color:var(--success)"></i> Akun Google sudah tertaut ke akun ini.';
    boxEl.style.display = 'none';
    return;
  }
  statusEl.textContent = 'Tautkan akun Google supaya kamu juga bisa login pakai tombol "Lanjutkan dengan Google".';

  const branding = await API.get('/api/public/branding');
  if (!branding.success || !branding.google_client_id) {
    boxEl.innerHTML = '<p class="text-sm text-muted">Login Google belum diaktifkan di server ini.</p>';
    return;
  }

  function initGoogleLinkButton() {
    if (!window.google || !window.google.accounts) {
      boxEl.innerHTML = '<p class="text-sm text-muted">Google Sign-In tidak tersedia — kemungkinan diblokir ad-blocker/VPN filter di perangkat kamu.</p>';
      return;
    }
    google.accounts.id.initialize({
      client_id: branding.google_client_id,
      callback: onGoogleLinkCredential,
      itp_support: true,
      use_fedcm_for_button: true,
    });
    google.accounts.id.renderButton(boxEl, { theme: 'outline', size: 'large', width: 320, text: 'continue_with' });
  }

  if (window.google && window.google.accounts) {
    initGoogleLinkButton();
  } else {
    const gsiScript = document.createElement('script');
    gsiScript.src = 'https://accounts.google.com/gsi/client';
    gsiScript.async = true;
    gsiScript.onload = initGoogleLinkButton;
    gsiScript.onerror = () => {
      boxEl.innerHTML = '<p class="text-sm text-muted">Gagal memuat tombol Google — coba nonaktifkan sementara ad-blocker/VPN filter atau pakai browser lain.</p>';
    };
    document.head.appendChild(gsiScript);
  }
}

async function onGoogleLinkCredential(response) {
  const alertBox = document.getElementById('google-link-alert');
  alertBox.innerHTML = '';
  const res = await API.post('/api/auth/link-google', { credential: response.credential });
  if (res.success) {
    Toast.success(res.message);
    loadGoogleLinkCard({ ...userData, google_id: 'linked' });
  } else {
    alertBox.innerHTML = `<div class="alert alert-danger"><i class="fas fa-exclamation-circle"></i> ${res.message}</div>`;
  }
}

async function loadResellerCard() {
  const card = document.getElementById('reseller-card');
  const body = document.getElementById('reseller-card-body');
  const res = await API.get('/api/reseller/me');
  if (!res.success) return;
  const data = res.data;
  card.style.display = 'block';

  if (!data.role) {
    document.getElementById('reseller-card-title').textContent = 'Reseller/Partner';
    body.innerHTML = `
      <p class="text-xs text-muted" style="margin-bottom:10px">Jadi Reseller (Rp${data.pricing.reseller.toLocaleString('id-ID')}) atau Partner (Rp${data.pricing.partner.toLocaleString('id-ID')}) — buat panel pribadi tanpa expired &amp; jual panel ke buyer kamu sendiri.</p>
      <a href="/panel" class="btn btn-outline btn-sm" style="width:100%;justify-content:center">Lihat Detail</a>`;
    return;
  }

  document.getElementById('reseller-card-title').textContent = data.role === 'partner' ? 'Partner' : 'Reseller';
  body.innerHTML = `
    <p class="text-xs text-muted" style="margin-bottom:10px">Status: <b>${data.status === 'suspended' ? 'Disuspend' : 'Aktif'}</b> &middot; PTPT bulan ${data.ptpt.current_month}: <b>${data.ptpt.ok ? 'Lunas' : 'Belum Bayar'}</b></p>
    <a href="/reseller" class="btn btn-primary btn-sm" style="width:100%;justify-content:center"><i class="fas fa-gauge"></i> Buka Dashboard</a>`;
}

function populateForm(user, wallet) {
  document.getElementById('full_name').value = user.full_name || '';
  document.getElementById('username').value = user.username || '';
  document.getElementById('email').value = user.email || '';
  document.getElementById('phone').value = user.phone || '';
  document.getElementById('profile-name').textContent = user.full_name || user.username;
  document.getElementById('profile-username').textContent = `@${user.username}`;
  document.getElementById('profile-joined').textContent = formatDate(user.createdAt, false);
  document.getElementById('profile-role').innerHTML = `<span class="badge ${user.role==='owner'?'badge-primary':(user.role==='seller'?'badge-warning':'badge-success')}">${user.role==='owner'?'Owner':(user.role==='seller'?'Seller':'Buyer')}</span>`;

  const avatarEl = document.getElementById('profile-avatar');
  if (user.avatar) {
    avatarEl.innerHTML = `<img src="${user.avatar}" alt="">`;
  } else {
    avatarEl.textContent = (user.full_name || user.username)[0].toUpperCase();
  }

  if (wallet) {
    document.querySelectorAll('[data-balance]').forEach(el => el.textContent = formatRupiah(wallet.balance));
  }

  const withdrawBtn = document.getElementById('withdraw-btn');
  if (withdrawBtn) withdrawBtn.style.display = user.role === 'buyer' ? 'none' : '';
}

async function saveProfile() {
  const btn = document.getElementById('save-profile-btn');
  const alertBox = document.getElementById('profile-alert');
  btnLoading(btn, true);
  alertBox.innerHTML = '';

  const res = await API.post('/api/user/profile', {
    full_name: document.getElementById('full_name').value,
    email: document.getElementById('email').value,
    phone: document.getElementById('phone').value,
  });

  btnLoading(btn, false);
  if (res.success) {
    alertBox.innerHTML = `<div class="alert alert-success"><i class="fas fa-check-circle"></i> ${res.message}</div>`;
    Toast.success(res.message);
  } else {
    alertBox.innerHTML = `<div class="alert alert-danger"><i class="fas fa-times-circle"></i> ${res.message}</div>`;
  }
}

async function changePassword() {
  const old_password = document.getElementById('old_password').value;
  const new_password = document.getElementById('new_password').value;
  const confirm = document.getElementById('confirm_password').value;
  const alertBox = document.getElementById('pass-alert');
  const btn = document.getElementById('change-pass-btn');
  alertBox.innerHTML = '';

  if (new_password !== confirm) {
    alertBox.innerHTML = `<div class="alert alert-danger"><i class="fas fa-times-circle"></i> Konfirmasi password tidak cocok</div>`;
    return;
  }

  btnLoading(btn, true);
  const res = await API.post('/api/user/change-password', { old_password, new_password });
  btnLoading(btn, false);

  if (res.success) {
    alertBox.innerHTML = `<div class="alert alert-success"><i class="fas fa-check-circle"></i> ${res.message}</div>`;
    document.getElementById('old_password').value = '';
    document.getElementById('new_password').value = '';
    document.getElementById('confirm_password').value = '';
    Toast.success(res.message);
  } else {
    alertBox.innerHTML = `<div class="alert alert-danger"><i class="fas fa-times-circle"></i> ${res.message}</div>`;
  }
}

async function uploadAvatar(input) {
  if (!input.files[0]) return;
  const formData = new FormData();
  formData.append('avatar', input.files[0]);

  const res = await fetch(apiUrl('/api/user/avatar'), {
    method: 'POST', credentials: 'include', body: formData,
  }).then(r => r.json());

  if (res.success) {
    const avatarEl = document.getElementById('profile-avatar');
    avatarEl.innerHTML = `<img src="${res.avatar}" alt="">`;
    document.querySelectorAll('[data-user-avatar]').forEach(el => {
      el.innerHTML = `<img src="${res.avatar}" alt="">`;
    });
    Toast.success('Foto profil diperbarui!');
  } else {
    Toast.error(res.message);
  }
}

async function loadLoginHistory() {
  const res = await API.get('/api/user/login-history');
  const tbody = document.getElementById('login-history');
  if (!res.success || !res.data || !res.data.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="table-empty">Tidak ada riwayat</td></tr>`;
    return;
  }
  tbody.innerHTML = res.data.map(l => {
    const statusMap = {
      success: '<span class="badge badge-success">Berhasil</span>',
      failed_password: '<span class="badge badge-danger">Password Salah</span>',
      failed_notfound: '<span class="badge badge-danger">Tidak Ditemukan</span>',
      failed_suspended: '<span class="badge badge-danger">Disuspend</span>',
      register: '<span class="badge badge-info">Registrasi</span>',
    };
    const ua = l.user_agent || '';
    const device = ua.includes('Mobile')
      ? '<i class="fas fa-mobile-alt"></i> Mobile'
      : '<i class="fas fa-desktop"></i> Desktop';
    return `<tr>
      <td class="text-xs">${formatDate(l.createdAt)}</td>
      <td><code style="font-size:11px">${l.ip || '-'}</code></td>
      <td>${statusMap[l.status] || statusBadge(l.status)}</td>
      <td class="text-xs text-muted">${device}</td>
    </tr>`;
  }).join('');
}


async function loadSellerApplyCard() {
  const card = document.getElementById('seller-apply-card');
  const box = document.getElementById('seller-apply-status');
  const title = document.getElementById('seller-card-title');

  if (userData && userData.role === 'seller') {
    if (title) title.innerHTML = `<i class="fas fa-store" style="color:var(--primary)"></i> Toko Saya`;
    card.style.display = 'block';
    box.innerHTML = `<span class="badge badge-success"><i class="fas fa-check-circle"></i> Seller Aktif</span>
      <div class="text-xs text-muted mt-8">Kelola produk, stok, dan pesanan tokomu di sini.</div>
      <button class="btn btn-primary btn-sm mt-8" data-action="seller-goto-dashboard"><i class="fas fa-gauge"></i> Kelola Toko</button>`;
    return;
  }

  if (title) title.innerHTML = `<i class="fas fa-store" style="color:var(--primary)"></i> Jadi Seller`;

  if (!userData || userData.role !== 'buyer') {
    card.style.display = 'none';
    return;
  }

  const res = await API.get('/api/seller/apply/status');
  const application = res.success ? res.data : null;
  card.style.display = 'block';

  if (!application) {
    box.innerHTML = `
      <div class="text-xs text-muted mb-8">Punya produk untuk dijual? Daftar jadi seller di Austin Store.</div>
      <button class="btn btn-primary btn-sm" data-action="seller-apply-open"><i class="fas fa-store"></i> Daftar Jadi Seller</button>`;
  } else if (application.status === 'pending') {
    box.innerHTML = `<span class="badge badge-warning"><i class="fas fa-clock"></i> Menunggu Persetujuan Owner</span>
      <div class="text-xs text-muted mt-8">Pendaftaran kamu sedang diproses. Kami akan mengabari lewat halaman ini.</div>`;
  } else if (application.status === 'rejected') {
    box.innerHTML = `<span class="badge badge-danger"><i class="fas fa-times-circle"></i> Pendaftaran Ditolak</span>
      <div class="alert alert-danger mt-8" style="margin-bottom:0"><i class="fas fa-info-circle"></i> ${escapeHtml(application.reject_reason || 'Tidak ada keterangan')}</div>
      <button class="btn btn-primary btn-sm mt-8" data-action="seller-apply-open"><i class="fas fa-rotate"></i> Perbarui Pendaftaran</button>`;
  } else if (application.status === 'approved') {
    box.innerHTML = `<span class="badge badge-success"><i class="fas fa-check-circle"></i> Disetujui</span>`;
  }
}

document.getElementById('seller-apply-status')?.addEventListener('click', (e) => {
  if (e.target.closest('[data-action="seller-apply-open"]')) openSellerApplyModal();
  if (e.target.closest('[data-action="seller-goto-dashboard"]')) location.href = '/seller';
});

function openSellerApplyModal() {
  document.getElementById('sa-full-name').value = '';
  document.getElementById('sa-address').value = '';
  document.getElementById('sa-whatsapp').value = '';
  document.getElementById('sa-selfie').value = '';
  document.getElementById('sa-idcard').value = '';
  document.getElementById('seller-apply-alert').innerHTML = '';
  sellerApplyGoToStep(1);
  Modal.open('seller-apply-modal');
}

function closeSellerApplyModal() {
  Modal.close('seller-apply-modal');
}

function sellerApplyGoToStep(step) {
  document.getElementById('sa-step-1').style.display = step === 1 ? 'block' : 'none';
  document.getElementById('sa-step-2').style.display = step === 2 ? 'block' : 'none';
  document.getElementById('sa-step-label').textContent = step;
  document.getElementById('sa-back-btn').style.display = step === 2 ? 'inline-flex' : 'none';
  document.getElementById('sa-next-btn').style.display = step === 1 ? 'inline-flex' : 'none';
  document.getElementById('sa-submit-btn').style.display = step === 2 ? 'inline-flex' : 'none';
}

function sellerApplyNext() {
  const alertBox = document.getElementById('seller-apply-alert');
  const full_name = document.getElementById('sa-full-name').value.trim();
  const address = document.getElementById('sa-address').value.trim();
  const whatsapp = document.getElementById('sa-whatsapp').value.trim();

  if (full_name.length < 3 || !address || address.length < 10 || !whatsapp) {
    alertBox.innerHTML = `<div class="alert alert-danger"><i class="fas fa-times-circle"></i> Lengkapi nama, alamat, dan nomor WhatsApp terlebih dahulu</div>`;
    return;
  }
  alertBox.innerHTML = '';
  sellerApplyGoToStep(2);
}

function sellerApplyBack() {
  sellerApplyGoToStep(1);
}

async function submitSellerApply() {
  const alertBox = document.getElementById('seller-apply-alert');
  const btn = document.getElementById('sa-submit-btn');
  const selfie = document.getElementById('sa-selfie').files[0];
  const idcard = document.getElementById('sa-idcard').files[0];

  if (!selfie || !idcard) {
    alertBox.innerHTML = `<div class="alert alert-danger"><i class="fas fa-times-circle"></i> Foto selfie dan foto kartu identitas wajib diunggah</div>`;
    return;
  }

  const formData = new FormData();
  formData.append('full_name', document.getElementById('sa-full-name').value.trim());
  formData.append('address', document.getElementById('sa-address').value.trim());
  formData.append('whatsapp', document.getElementById('sa-whatsapp').value.trim());
  formData.append('selfie_photo', selfie);
  formData.append('id_card_photo', idcard);

  btnLoading(btn, true);
  const res = await fetch(apiUrl('/api/seller/apply'), {
    method: 'POST', credentials: 'include', body: formData,
  }).then(r => r.json()).catch(() => ({ success: false, message: 'Koneksi gagal. Periksa jaringan.' }));
  btnLoading(btn, false);

  if (res.success) {
    Toast.success(res.message);
    closeSellerApplyModal();
    loadSellerApplyCard();
  } else {
    alertBox.innerHTML = `<div class="alert alert-danger"><i class="fas fa-times-circle"></i> ${res.message}</div>`;
  }
}

init();
