// script.js
// Fitur: waktu/tanggal, checklist sholat, progres harian, motivasi, jadwal sholat (opsional via Aladhan), Supabase fallback.

const PRAYERS = [
  { key: 'subuh', label: 'Subuh' },
  { key: 'dzuhur', label: 'Dzuhur' },
  { key: 'ashar', label: 'Ashar' },
  { key: 'maghrib', label: 'Maghrib' },
  { key: 'isya', label: 'Isya' },
];

const motivations = [
  'Sholat tepat waktu menenangkan hati dan pikiran.',
  'Jadikan sholat sebagai prioritas, bukan sisa waktu.',
  'Allah selalu dekat, sambut panggilan-Nya dengan sholat.',
  'Istirahatkan hatimu dalam sujud yang khusyuk.',
  'Kekuatan terbesar bermula dari sholat yang terjaga.',
  'Raih ketenangan dengan menjaga sholat 5 waktu.',
];

const today = new Date();
const todayKey = today.toISOString().slice(0, 10); // YYYY-MM-DD

// Device ID (anon) untuk grouping data Supabase & localStorage
const deviceId = (() => {
  const key = 'websolat_device_id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
})();

// Supabase client (opsional)
let supabase = null;
let supabaseEnabled = !!(window.SUPABASE_URL && window.SUPABASE_ANON_KEY);
async function ensureSupabase() {
  if (!supabaseEnabled) return null;
  if (supabase) return supabase;
  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    supabase = createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  } catch (err) {
    console.warn('Gagal memuat Supabase JS:', err);
    supabaseEnabled = false;
    return null;
  }
  return supabase;
}

// Elemen DOM
const elDate = document.getElementById('todayDate');
const elTime = document.getElementById('todayTime');
const elPrayerList = document.getElementById('prayerList');
const elProgressText = document.getElementById('progressText');
const elProgressFill = document.getElementById('progressFill');
const elLocationInfo = document.getElementById('locationInfo');
const elMotivation = document.getElementById('motivationText');
const elFocusToggle = document.getElementById('focusToggle');
const elLoginBtn = document.getElementById('loginBtn');
const elLogoutBtn = document.getElementById('logoutBtn');
const elUserInfo = document.getElementById('userInfo');
// Auth email modal
const elAuthModal = document.getElementById('authModal');
const elAuthUsername = document.getElementById('authUsername');
const elAuthDoLogin = document.getElementById('authDoLogin');
const elAuthClose = document.getElementById('authClose');
const elAuthMsg = document.getElementById('authMsg');
const elPrevMonth = document.getElementById('prevMonth');
const elNextMonth = document.getElementById('nextMonth');
const elCalendarStats = document.getElementById('calendarStats');

// State kalender (dideklarasikan sebelum fungsi render dipanggil)
let currentCalendarYear = null;
let currentCalendarMonth = null;
let monthServerMap = null;

// Waktu & tanggal
function formatDateID(d) {
  const opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  return d.toLocaleDateString('id-ID', opts);
}
function updateNow() {
  elDate.textContent = formatDateID(new Date());
  elTime.textContent = new Date().toLocaleTimeString('id-ID');
}
updateNow();
setInterval(updateNow, 1000);

// Motivasi harian (deterministik berdasarkan tanggal)
function dailyIndex(len) {
  const seed = parseInt(todayKey.replaceAll('-', ''), 10);
  return seed % len;
}
elMotivation.textContent = motivations[dailyIndex(motivations.length)];

// Load status sholat hari ini dari localStorage
function loadStatus() {
  const raw = localStorage.getItem(`status_${deviceId}_${todayKey}`);
  if (!raw) return {};
  try { return JSON.parse(raw) || {}; } catch { return {}; }
}
function saveStatus(status) {
  localStorage.setItem(`status_${deviceId}_${todayKey}`, JSON.stringify(status));
}

// Render daftar sholat
let status = loadStatus();

function renderPrayerList(times = {}) {
  elPrayerList.innerHTML = '';
  PRAYERS.forEach(p => {
    const li = document.createElement('li');
    li.className = 'prayer-item';

    const name = document.createElement('div');
    name.className = 'prayer-name';
    name.textContent = p.label;

    const time = document.createElement('div');
    time.className = 'prayer-time';
    time.textContent = times[p.key] || '—:—';

    const btn = document.createElement('button');
    btn.className = 'check-btn';
    btn.textContent = status[p.key] ? 'Selesai' : 'Tandai Selesai';
    if (status[p.key]) btn.classList.add('done');

    btn.addEventListener('click', async () => {
      status[p.key] = !status[p.key];
      saveStatus(status);
      btn.textContent = status[p.key] ? 'Selesai' : 'Tandai Selesai';
      btn.classList.toggle('done', !!status[p.key]);
      updateProgress();
      await syncSupabase(status).catch(() => {});
      renderCalendarMonth();
    });

    li.appendChild(name);
    li.appendChild(time);
    li.appendChild(btn);
    elPrayerList.appendChild(li);
  });
  updateProgress();
}

function updateProgress() {
  const doneCount = PRAYERS.reduce((acc, p) => acc + (status[p.key] ? 1 : 0), 0);
  const pct = Math.round((doneCount / PRAYERS.length) * 100);
  elProgressText.textContent = `Progres: ${doneCount}/${PRAYERS.length}`;
  elProgressFill.style.width = `${pct}%`;
}

// Supabase sync (opsional)
async function syncSupabase(currentStatus) {
  await ensureSupabase();
  if (!supabaseEnabled || !supabase) return;
  const selector = getIdSelector();
  const payload = {
    // Selalu sertakan username dan device_id agar baris mudah ditemukan lintas perangkat
    username: savedUsername || null,
    device_id: deviceId,
    // Jika ada user_id (nantinya), boleh ikut
    user_id: currentUser?.id || null,
    date: todayKey,
    subuh: !!currentStatus.subuh,
    dzuhur: !!currentStatus.dzuhur,
    ashar: !!currentStatus.ashar,
    maghrib: !!currentStatus.maghrib,
    isya: !!currentStatus.isya,
  };
  try {
    const { error } = await supabase
      .from('prayers')
      .upsert(payload, { onConflict: selector.conflict });
    if (error) throw error;
  } catch (err) {
    // Fallback ke device_id jika kolom user_id belum ada atau constraint belum dibuat
    if (selector.field !== 'device_id') {
      const { error: fbErr } = await supabase
        .from('prayers')
        .upsert({
          device_id: deviceId,
          date: todayKey,
          subuh: !!currentStatus.subuh,
          dzuhur: !!currentStatus.dzuhur,
          ashar: !!currentStatus.ashar,
          maghrib: !!currentStatus.maghrib,
          isya: !!currentStatus.isya,
        }, { onConflict: 'device_id,date' });
      if (fbErr) console.warn('Supabase upsert fallback error:', fbErr.message);
    } else {
      console.warn('Supabase upsert error:', err.message);
    }
  }
}

// Supabase: pembacaan status
async function fetchTodayFromSupabase() {
  await ensureSupabase();
  if (!supabaseEnabled || !supabase) return null;
  const sel = getIdSelector();
  try {
    const { data, error } = await supabase
      .from('prayers')
      .select('subuh,dzuhur,ashar,maghrib,isya')
      .eq(sel.field, sel.value)
      .eq('date', todayKey)
      .maybeSingle();
    if (error) throw error;
    if (data) return data;
    // Fallback jika tidak ada data untuk username: coba device_id
    const { data: devData, error: devErr } = await supabase
      .from('prayers')
      .select('subuh,dzuhur,ashar,maghrib,isya')
      .eq('device_id', deviceId)
      .eq('date', todayKey)
      .maybeSingle();
    if (devErr) { console.warn('Supabase read today fallback error:', devErr.message); return null; }
    return devData || null;
  } catch (err) {
    if (sel.field !== 'device_id') {
      const { data, error } = await supabase
        .from('prayers')
        .select('subuh,dzuhur,ashar,maghrib,isya')
        .eq('device_id', deviceId)
        .eq('date', todayKey)
        .maybeSingle();
      if (error) { console.warn('Supabase read today fallback error:', error.message); return null; }
      return data || null;
    }
    console.warn('Supabase read today error:', err.message);
    return null;
  }
}

async function fetchMonthStatuses(startDate, endDate) {
  await ensureSupabase();
  if (!supabaseEnabled || !supabase) return null;
  const sel = getIdSelector();
  try {
    const { data, error } = await supabase
      .from('prayers')
      .select('date,subuh,dzuhur,ashar,maghrib,isya')
      .eq(sel.field, sel.value)
      .gte('date', startDate.toISOString().slice(0,10))
      .lte('date', endDate.toISOString().slice(0,10));
    if (error) throw error;
    if (data && data.length > 0) {
      const map = {};
      for (const row of data) {
        map[row.date] = {
          subuh: !!row.subuh,
          dzuhur: !!row.dzuhur,
          ashar: !!row.ashar,
          maghrib: !!row.maghrib,
          isya: !!row.isya,
        };
      }
      return map;
    }
    // Fallback jika kosong: coba berdasarkan device_id
    const { data: devRows, error: devErr } = await supabase
      .from('prayers')
      .select('date,subuh,dzuhur,ashar,maghrib,isya')
      .eq('device_id', deviceId)
      .gte('date', startDate.toISOString().slice(0,10))
      .lte('date', endDate.toISOString().slice(0,10));
    if (devErr) { console.warn('Supabase read month fallback error:', devErr.message); return null; }
    const devMap = {};
    for (const row of (devRows || [])) {
      devMap[row.date] = {
        subuh: !!row.subuh,
        dzuhur: !!row.dzuhur,
        ashar: !!row.ashar,
        maghrib: !!row.maghrib,
        isya: !!row.isya,
      };
    }
    return devMap;
  } catch (err) {
    if (sel.field !== 'device_id') {
      const { data, error } = await supabase
        .from('prayers')
        .select('date,subuh,dzuhur,ashar,maghrib,isya')
        .eq('device_id', deviceId)
        .gte('date', startDate.toISOString().slice(0,10))
        .lte('date', endDate.toISOString().slice(0,10));
      if (error) { console.warn('Supabase read month fallback error:', error.message); return null; }
      const map = {};
      for (const row of (data || [])) {
        map[row.date] = {
          subuh: !!row.subuh,
          dzuhur: !!row.dzuhur,
          ashar: !!row.ashar,
          maghrib: !!row.maghrib,
          isya: !!row.isya,
        };
      }
      return map;
    }
    console.warn('Supabase read month error:', err.message);
    return null;
  }
}

// Jadwal sholat via Aladhan (opsional, fallback statis)
async function getPrayerTimes() {
  // Mode cepat: tanpa lokasi & tanpa API eksternal
  elLocationInfo.textContent = 'Lokasi: — (tanpa lokasi)';
  return { subuh: '04:45', dzuhur: '12:00', ashar: '15:15', maghrib: '18:00', isya: '19:15' };
}

// Mode fokus ibadah
elFocusToggle.addEventListener('click', () => {
  document.body.classList.toggle('focus');
});

// Auth: login via Google & logout
let currentUser = null;
const usernameKey = 'websolat_username';
let savedUsername = localStorage.getItem(usernameKey) || null;
function updateAuthUI() {
  if (!elLoginBtn || !elLogoutBtn || !elUserInfo) return;
  const loggedIn = !!currentUser;
  elLoginBtn.hidden = loggedIn;
  elLogoutBtn.hidden = !loggedIn;
  elUserInfo.hidden = !loggedIn;
  elUserInfo.textContent = loggedIn ? (savedUsername || 'Pengguna') : 'Pengguna';
}

function openAuthModal() {
  if (!elAuthModal) return;
  elAuthModal.hidden = false;
  elAuthModal.setAttribute('aria-hidden', 'false');
  elAuthModal.style.display = '';
}
function closeAuthModal() {
  if (!elAuthModal) return;
  elAuthModal.hidden = true;
  elAuthModal.setAttribute('aria-hidden', 'true');
  elAuthModal.style.display = 'none';
}
function getIdSelector() {
  if (savedUsername) {
    return { field: 'username', value: savedUsername, conflict: 'username,date' };
  }
  if (currentUser?.id) {
    return { field: 'user_id', value: currentUser.id, conflict: 'user_id,date' };
  }
  return { field: 'device_id', value: deviceId, conflict: 'device_id,date' };
}
// Tidak menggunakan sesi auth Supabase untuk mengurangi waktu loading
// Login via Username (anonymous Supabase)
// Pulihkan sesi dari savedUsername saat init
if (savedUsername) {
  currentUser = { id: `username:${savedUsername}` };
  updateAuthUI();
  closeAuthModal();
  // Migrasi/penyelarasan: dorong status lokal ke server di bawah username
  syncSupabase(status).catch(() => {});
}
if (elLoginBtn) {
  elLoginBtn.addEventListener('click', () => {
    openAuthModal();
    if (elAuthMsg) elAuthMsg.textContent = '';
  });
}
if (elAuthClose) {
  elAuthClose.addEventListener('click', () => {
    closeAuthModal();
  });
}
// Submit dengan tombol Enter di input username
if (elAuthUsername) {
  elAuthUsername.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      elAuthDoLogin?.click();
    }
  });
}
if (elAuthDoLogin) {
  elAuthDoLogin.addEventListener('click', async () => {
    const username = (elAuthUsername?.value || '').trim();
    if (!username) { elAuthMsg.textContent = 'Masukkan username terlebih dahulu.'; return; }
    // Tutup modal segera agar tidak terasa macet (paksa tutup)
    closeAuthModal();
    elAuthMsg.textContent = '';
    try {
      savedUsername = username;
      localStorage.setItem(usernameKey, username);
      currentUser = { id: `username:${username}` }; // penanda lokal agar UI menganggap login
      updateAuthUI();
      // Segera sinkronkan status lokal ke server dengan kunci username
      syncSupabase(status).catch(() => {});
      // Tarik ulang status dari server untuk username ini (non-blocking)
      fetchTodayFromSupabase().then(todayData => {
        if (todayData) {
          status = {
            subuh: !!todayData.subuh,
            dzuhur: !!todayData.dzuhur,
            ashar: !!todayData.ashar,
            maghrib: !!todayData.maghrib,
            isya: !!todayData.isya,
          };
          saveStatus(status);
          renderPrayerList();
        }
      }).catch(() => {});
    } catch (e) {
      // Jika gagal, buka kembali modal dengan pesan
      openAuthModal();
      elAuthMsg.textContent = 'Gagal masuk: ' + (e?.message || e);
    }
  });
}
if (elLogoutBtn) {
  elLogoutBtn.addEventListener('click', async () => {
    // Tidak perlu signOut Supabase ketika memakai mode username publik
    localStorage.removeItem(usernameKey);
    savedUsername = null;
    currentUser = null;
    updateAuthUI();
  });
}

(async function init() {
  // Render awal secepat mungkin tanpa menunggu network
  const base = new Date();
  renderPrayerList();
  renderCalendarMonth(base);
  renderMonthStats(base);
  // Update waktu sholat secara async
  getPrayerTimes().then(times => {
    renderPrayerList(times);
  }).catch(() => {});
  // Sync ke Supabase akan dilakukan setelah user mengatur username atau pada interaksi
})();

// Kalender Bulan Ini
function formatDateKey(d) {
  return d.toISOString().slice(0, 10);
}
function getStatusForDate(dateKey) {
  const raw = localStorage.getItem(`status_${deviceId}_${dateKey}`);
  if (!raw) return {};
  try { return JSON.parse(raw) || {}; } catch { return {}; }
}
function calcDoneCount(st) {
  return PRAYERS.reduce((acc, p) => acc + (st[p.key] ? 1 : 0), 0);
}
function renderCalendarMonth(base = new Date(), serverMap = null) {
  const grid = document.getElementById('calendarGrid');
  const header = document.getElementById('calendarHeader');
  if (!grid || !header) return;
  grid.innerHTML = '';

  const year = base.getFullYear();
  const month = base.getMonth();
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const daysInMonth = last.getDate();
  // Pekan dimulai Senin (getDay(): Minggu=0)
  const offset = (first.getDay() + 6) % 7;

  header.textContent = first.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  currentCalendarYear = year;
  currentCalendarMonth = month;
  monthServerMap = serverMap;

  for (let i = 0; i < offset; i++) {
    const empty = document.createElement('div');
    empty.className = 'day-cell empty';
    grid.appendChild(empty);
  }

  const todayKeyNow = formatDateKey(new Date());
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month, day);
    const key = formatDateKey(d);
    const st = (monthServerMap && monthServerMap[key]) ? monthServerMap[key] : getStatusForDate(key);
    const done = calcDoneCount(st);

    const cell = document.createElement('div');
    cell.className = 'day-cell';
    cell.dataset.p = String(done);
    cell.title = `${d.toLocaleDateString('id-ID')} • ${done}/5 sholat`;
    if (key === todayKeyNow) cell.classList.add('today');

    const number = document.createElement('div');
    number.className = 'day-number';
    number.textContent = String(day).padStart(2, '0');

    const bar = document.createElement('div');
    bar.className = 'day-progress';
    const fill = document.createElement('div');
    fill.className = 'day-fill';
    fill.style.width = `${Math.round((done / PRAYERS.length) * 100)}%`;
    bar.appendChild(fill);

    cell.appendChild(number);
    cell.appendChild(bar);
    grid.appendChild(cell);
  }
}

// Ringkasan statistik bulanan
function renderMonthStats(base = new Date(), serverMap = null) {
  if (!elCalendarStats) return;
  const y = base.getFullYear();
  const m = base.getMonth();
  const first = new Date(y, m, 1);
  const last = new Date(y, m + 1, 0);
  const daysInMonth = last.getDate();

  let total = 0; // total sholat selesai bulan ini
  let fullDays = 0; // jumlah hari 5/5

  const todayNow = new Date();
  let denomDays = daysInMonth;
  if (todayNow.getFullYear() === y && todayNow.getMonth() === m) {
    denomDays = Math.min(todayNow.getDate(), daysInMonth);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(y, m, day);
    const key = formatDateKey(d);
    const st = (serverMap && serverMap[key]) ? serverMap[key] : getStatusForDate(key);
    const done = calcDoneCount(st);
    total += done;
    if (done === PRAYERS.length) fullDays++;
  }

  const avg = denomDays > 0 ? (total / denomDays) : 0; // rata-rata selesai per hari

  elCalendarStats.innerHTML = '';
  const items = [
    { title: 'Hari 5/5', value: String(fullDays) },
    { title: 'Rata-rata harian', value: `${avg.toFixed(1)}/5` },
    { title: 'Total selesai', value: String(total) },
  ];
  for (const it of items) {
    const card = document.createElement('div');
    card.className = 'stat-card';
    const t = document.createElement('div');
    t.className = 'stat-title';
    t.textContent = it.title;
    const v = document.createElement('div');
    v.className = 'stat-value';
    v.textContent = it.value;
    card.appendChild(t);
    card.appendChild(v);
    elCalendarStats.appendChild(card);
  }
}

// Navigasi bulan
function getMonthRange(base) {
  const start = new Date(base.getFullYear(), base.getMonth(), 1);
  const end = new Date(base.getFullYear(), base.getMonth() + 1, 0);
  return { start, end };
}
if (elPrevMonth) {
  elPrevMonth.addEventListener('click', async () => {
    const base = new Date(
      (currentCalendarYear ?? new Date().getFullYear()),
      (currentCalendarMonth ?? new Date().getMonth()) - 1,
      1
    );
    const { start, end } = getMonthRange(base);
    let map = null;
    try { map = await fetchMonthStatuses(start, end); } catch {}
    renderCalendarMonth(base, map);
    renderMonthStats(base, map);
  });
}
if (elNextMonth) {
  elNextMonth.addEventListener('click', async () => {
    const base = new Date(
      (currentCalendarYear ?? new Date().getFullYear()),
      (currentCalendarMonth ?? new Date().getMonth()) + 1,
      1
    );
    const { start, end } = getMonthRange(base);
    let map = null;
    try { map = await fetchMonthStatuses(start, end); } catch {}
    renderCalendarMonth(base, map);
    renderMonthStats(base, map);
  });
}

// Auto-refresh kalender saat bulan berganti (cek tiap 60 detik)
setInterval(() => {
  const now = new Date();
  if (currentCalendarYear !== now.getFullYear() || currentCalendarMonth !== now.getMonth()) {
    // saat berganti bulan, coba ambil map bulan baru dari Supabase jika tersedia
    let startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    let endMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    fetchMonthStatuses(startMonth, endMonth)
      .then(map => { renderCalendarMonth(now, map); renderMonthStats(now, map); })
      .catch(() => { renderCalendarMonth(now); renderMonthStats(now); });
  }
}, 60000);