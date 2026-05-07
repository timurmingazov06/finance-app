'use strict';

const CATEGORIES = [
  { id:'food',      emoji:'🍕', name:'Еда' },
  { id:'transport', emoji:'🚗', name:'Транспорт' },
  { id:'shop',      emoji:'🛍️', name:'Покупки' },
  { id:'health',    emoji:'💊', name:'Здоровье' },
  { id:'home',      emoji:'🏠', name:'Дом' },
  { id:'fun',       emoji:'🎮', name:'Развлечения' },
  { id:'sport',     emoji:'💪', name:'Спорт' },
  { id:'cafe',      emoji:'☕', name:'Кафе' },
  { id:'travel',    emoji:'✈️', name:'Путешествия' },
  { id:'beauty',    emoji:'💄', name:'Красота' },
  { id:'edu',       emoji:'📚', name:'Учёба' },
  { id:'other',     emoji:'💸', name:'Другое' },
  { id:'salary',    emoji:'💰', name:'Зарплата' },
  { id:'gift',      emoji:'🎁', name:'Подарок' },
  { id:'freelance', emoji:'💻', name:'Фриланс' },
  { id:'invest',    emoji:'📈', name:'Инвестиции' },
];
const CAT_MAP = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));

// ── Storage ──────────────────────────────────────────────────────────────────
function loadTx()   { try { return JSON.parse(localStorage.getItem('finance_tx') || '[]'); } catch { return []; } }
function saveTx(l)  { localStorage.setItem('finance_tx', JSON.stringify(l)); }
function loadTheme(){ return localStorage.getItem('finance_theme') || 'dark'; }
function saveTheme(t){ localStorage.setItem('finance_theme', t); }

// ── State ────────────────────────────────────────────────────────────────────
let transactions  = loadTx();
let currentScreen = 'home';
let addType       = 'expense';
let selectedCat   = 'food';
let statsPeriod   = 'month';
let historyFilter = 'all';
let currentTheme  = loadTheme();

// Навигация по месяцам: offset = 0 → текущий, -1 → прошлый и т.д.
let monthOffset = 0;

// ── DOM ───────────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const screens = { home: $('screen-home'), add: $('screen-add'), history: $('screen-history'), stats: $('screen-stats') };

// ── Тема ─────────────────────────────────────────────────────────────────────
const THEMES = {
  dark:     { label: 'Dark',         desc: 'Тёмная с фиолетовым' },
  glass:    { label: 'Liquid Glass', desc: 'iOS 26 — светлое стекло' },
  midnight: { label: 'Midnight',     desc: 'Чёрный AMOLED' },
};

function applyTheme(t) {
  currentTheme = t;
  document.documentElement.setAttribute('data-theme', t === 'dark' ? '' : t);
  if (t === 'dark') document.documentElement.removeAttribute('data-theme');
  saveTheme(t);
  renderThemeCards();
}

function vibrate(ms = 8) {
  if (navigator.vibrate) navigator.vibrate(ms);
}

// ── Theme sheet ───────────────────────────────────────────────────────────────
const overlay    = $('sheet-overlay');
const themeSheet = $('theme-sheet');

$('theme-btn').addEventListener('click', () => {
  vibrate(6);
  overlay.classList.add('open');
  themeSheet.classList.add('open');
});
overlay.addEventListener('click', closeSheet);
$('sheet-close').addEventListener('click', closeSheet);
function closeSheet() {
  overlay.classList.remove('open');
  themeSheet.classList.remove('open');
}

function renderThemeCards() {
  const container = $('theme-cards');
  container.innerHTML = Object.entries(THEMES).map(([id, t]) => `
    <div class="theme-card ${currentTheme === id ? 'active' : ''}" data-theme-id="${id}">
      <div class="theme-preview theme-preview-${id}"></div>
      <div class="theme-card-info">
        <div class="theme-card-name">${t.label}</div>
        <div class="theme-card-desc">${t.desc}</div>
      </div>
      <div class="theme-card-check">✓</div>
    </div>
  `).join('');
  container.querySelectorAll('.theme-card').forEach(card => {
    card.addEventListener('click', () => {
      vibrate(10);
      applyTheme(card.dataset.themeId);
      setTimeout(closeSheet, 180);
    });
  });
}

// ── Навигация по экранам ──────────────────────────────────────────────────────
function showScreen(name) {
  Object.entries(screens).forEach(([k, el]) => el.classList.toggle('active', k === name));
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.screen === name));
  currentScreen = name;
  if (name === 'home')    renderHome();
  if (name === 'history') renderHistory();
  if (name === 'stats')   renderStats();
}
document.querySelectorAll('.nav-btn').forEach(btn => btn.addEventListener('click', () => showScreen(btn.dataset.screen)));

// ── Навигация по месяцам ──────────────────────────────────────────────────────
function getViewDate() {
  const d = new Date();
  d.setMonth(d.getMonth() + monthOffset);
  return d;
}
function getViewMonthTx() {
  const d = getViewDate();
  return transactions.filter(t => {
    const td = new Date(t.date);
    return td.getMonth() === d.getMonth() && td.getFullYear() === d.getFullYear();
  });
}
function updateMonthLabel() {
  const d = getViewDate();
  const label = d.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
  $('month-label').textContent = label.charAt(0).toUpperCase() + label.slice(1);
  $('btn-prev-month').style.opacity = '1';
  $('btn-next-month').style.opacity = monthOffset >= 0 ? '0.3' : '1';
  $('btn-next-month').style.pointerEvents = monthOffset >= 0 ? 'none' : 'auto';
}

$('btn-prev-month').addEventListener('click', () => { vibrate(6); monthOffset--; renderHome(); });
$('btn-next-month').addEventListener('click', () => { vibrate(6); if (monthOffset < 0) { monthOffset++; renderHome(); } });

// ── Главная ───────────────────────────────────────────────────────────────────
function renderHome() {
  updateMonthLabel();
  const monthTx  = getViewMonthTx();
  const income   = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense  = monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const balance  = income - expense;

  animateNumber($('balance-total'), balance, true);
  $('month-income').textContent  = '+' + fmt(income);
  $('month-expense').textContent = '−' + fmt(expense);

  const recent = [...monthTx].sort((a, b) => b.date - a.date).slice(0, 30);
  const list = $('home-tx-list');
  if (!recent.length) {
    list.innerHTML = `<div class="empty-state"><div class="emoji">💳</div><p>В этом месяце пока нет записей.<br>Нажми «Расход» или «Доход».</p></div>`;
    return;
  }
  list.innerHTML = recent.map(txHtml).join('');
  attachSwipe(list);
}

// Анимация числа баланса
function animateNumber(el, target, currency = false) {
  const duration = 500;
  const start = Date.now();
  const from = parseFloat(el.dataset.value || '0') || 0;
  el.dataset.value = target;

  function tick() {
    const elapsed = Date.now() - start;
    const progress = Math.min(elapsed / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    const current = from + (target - from) * ease;
    el.textContent = fmt(current);
    if (progress < 1) requestAnimationFrame(tick);
    else el.textContent = fmt(target);
  }
  requestAnimationFrame(tick);
}

// ── Свайп для удаления ────────────────────────────────────────────────────────
function attachSwipe(container) {
  container.querySelectorAll('.tx-item').forEach(item => {
    const inner = item.querySelector('.tx-item-inner');
    const bg    = item.querySelector('.tx-delete-bg');
    let startX = 0, currentX = 0, dragging = false;
    const THRESHOLD = 72;

    item.addEventListener('touchstart', e => {
      startX = e.touches[0].clientX;
      dragging = true;
    }, { passive: true });

    item.addEventListener('touchmove', e => {
      if (!dragging) return;
      currentX = e.touches[0].clientX - startX;
      if (currentX > 0) currentX = 0;
      const clamped = Math.max(currentX, -80);
      inner.style.transform = `translateX(${clamped}px)`;
      bg.style.opacity = Math.min(-clamped / THRESHOLD, 1).toString();
    }, { passive: true });

    item.addEventListener('touchend', () => {
      if (!dragging) return;
      dragging = false;
      if (currentX < -THRESHOLD) {
        inner.style.transform = 'translateX(-80px)';
        bg.style.opacity = '1';
        vibrate(12);
        setTimeout(() => {
          item.style.transition = 'all 0.25s ease';
          item.style.opacity = '0';
          item.style.transform = 'scaleY(0.8)';
          item.style.marginBottom = '-62px';
          setTimeout(() => deleteTx(item.dataset.id), 240);
        }, 180);
      } else {
        inner.style.transform = '';
        bg.style.opacity = '0';
      }
      currentX = 0;
    });
  });
}

// ── Добавление ────────────────────────────────────────────────────────────────
function openAdd(type = 'expense') {
  addType    = type;
  selectedCat = type === 'income' ? 'salary' : 'food';
  $('amount-input').value = '';
  $('note-input').value = '';
  updateTypeToggle();
  renderCategories();
  showScreen('add');
  setTimeout(() => $('amount-input').focus(), 300);
}

$('btn-expense').addEventListener('click', () => { vibrate(8); openAdd('expense'); });
$('btn-income').addEventListener('click',  () => { vibrate(8); openAdd('income'); });

document.querySelectorAll('.type-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    addType = btn.dataset.type;
    selectedCat = addType === 'income' ? 'salary' : 'food';
    updateTypeToggle();
    renderCategories();
  });
});

function updateTypeToggle() {
  document.querySelectorAll('.type-btn').forEach(btn => {
    const isActive = btn.dataset.type === addType;
    btn.className = isActive ? `type-btn active ${addType}` : 'type-btn';
  });
}

function renderCategories() {
  const grid = $('categories-grid');
  grid.innerHTML = CATEGORIES.map(c => `
    <button class="cat-btn ${c.id === selectedCat ? 'selected' : ''}" data-id="${c.id}">
      <span class="cat-emoji">${c.emoji}</span>
      <span class="cat-name">${c.name}</span>
    </button>
  `).join('');
  grid.querySelectorAll('.cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      vibrate(6);
      selectedCat = btn.dataset.id;
      renderCategories();
    });
  });
}

$('save-btn').addEventListener('click', () => {
  const raw    = $('amount-input').value.replace(',', '.');
  const amount = parseFloat(raw);
  if (!amount || amount <= 0) { toast('Введи сумму'); return; }

  vibrate([8, 40, 12]);
  const tx = {
    id:     Date.now().toString(),
    type:   addType,
    amount,
    cat:    selectedCat,
    note:   $('note-input').value.trim(),
    date:   Date.now(),
  };
  transactions.push(tx);
  saveTx(transactions);
  toast(addType === 'expense' ? '✅ Расход добавлен' : '✅ Доход добавлен');
  showScreen('home');
});

// ── История ───────────────────────────────────────────────────────────────────
function renderHistory() {
  let list = [...transactions].sort((a, b) => b.date - a.date);
  if (historyFilter !== 'all') list = list.filter(t => t.type === historyFilter);

  document.querySelectorAll('.filter-btn').forEach(btn =>
    btn.classList.toggle('active', btn.dataset.filter === historyFilter));

  const el = $('history-tx-list');
  if (!list.length) {
    el.innerHTML = `<div class="empty-state"><div class="emoji">🔍</div><p>Ничего не найдено</p></div>`;
    return;
  }

  let html = ''; let lastDate = '';
  list.forEach(tx => {
    const d = fmtDate(tx.date);
    if (d !== lastDate) {
      html += `<div class="section-title" style="padding:10px 4px 6px">${d}</div>`;
      lastDate = d;
    }
    html += txHtml(tx);
  });
  el.innerHTML = html;
  attachSwipe(el);
}

document.querySelectorAll('.filter-btn').forEach(btn =>
  btn.addEventListener('click', () => { historyFilter = btn.dataset.filter; renderHistory(); }));

// ── Статистика ────────────────────────────────────────────────────────────────
let chart = null;

function renderStats() {
  const now = new Date();
  let filtered = transactions;

  if (statsPeriod === 'month') {
    filtered = transactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
  } else if (statsPeriod === 'week') {
    filtered = transactions.filter(t => t.date >= Date.now() - 7 * 86400000);
  }

  const totalIncome  = filtered.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  $('stat-income').textContent  = fmt(totalIncome);
  $('stat-expense').textContent = fmt(totalExpense);
  $('stat-balance').textContent = fmt(totalIncome - totalExpense);

  const byCat = {};
  filtered.filter(t => t.type === 'expense').forEach(t => {
    byCat[t.cat] = (byCat[t.cat] || 0) + t.amount;
  });
  const sorted = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const maxAmt = sorted[0]?.[1] || 1;

  const catEl = $('cat-stats');
  catEl.innerHTML = !sorted.length
    ? '<div style="color:var(--text2);font-size:14px;padding:6px 0">Расходов пока нет</div>'
    : sorted.map(([id, amt]) => {
        const c = CAT_MAP[id] || { emoji:'💸', name: id };
        return `
          <div class="cat-stat-item">
            <span class="cat-stat-emoji">${c.emoji}</span>
            <div class="cat-stat-info">
              <div class="cat-stat-name">${c.name}</div>
              <div class="cat-stat-bar-wrap">
                <div class="cat-stat-bar" style="width:${Math.round(amt/maxAmt*100)}%"></div>
              </div>
            </div>
            <div class="cat-stat-amount">−${fmt(amt)}</div>
          </div>
        `;
      }).join('');

  const days = statsPeriod === 'week' ? 7 : 30;
  const labels = [], incomes = [], expenses = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    labels.push(`${d.getDate()}/${d.getMonth()+1}`);
    const dayTx = filtered.filter(t => {
      const td = new Date(t.date);
      return td.getDate() === d.getDate() && td.getMonth() === d.getMonth();
    });
    incomes.push(dayTx.filter(t => t.type === 'income').reduce((s,t) => s+t.amount, 0));
    expenses.push(dayTx.filter(t => t.type === 'expense').reduce((s,t) => s+t.amount, 0));
  }

  if (chart) chart.destroy();
  chart = new Chart($('chart').getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label:'Доходы',  data:incomes,  backgroundColor:'rgba(48,215,128,0.7)', borderRadius:4 },
        { label:'Расходы', data:expenses, backgroundColor:'rgba(255,77,106,0.7)', borderRadius:4 },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: 'rgba(255,255,255,0.4)', font:{ size:11 } } } },
      scales: {
        x: { ticks:{ color:'rgba(255,255,255,0.35)', font:{size:10} }, grid:{ color:'rgba(255,255,255,0.06)' } },
        y: { ticks:{ color:'rgba(255,255,255,0.35)', font:{size:10} }, grid:{ color:'rgba(255,255,255,0.06)' } },
      }
    }
  });
}

document.querySelectorAll('.period-btn').forEach(btn => btn.addEventListener('click', () => {
  statsPeriod = btn.dataset.period;
  document.querySelectorAll('.period-btn').forEach(b => b.classList.toggle('active', b === btn));
  renderStats();
}));

// ── Удаление ──────────────────────────────────────────────────────────────────
function deleteTx(id) {
  transactions = transactions.filter(t => t.id !== id);
  saveTx(transactions);
  if (currentScreen === 'home')    renderHome();
  if (currentScreen === 'history') renderHistory();
  if (currentScreen === 'stats')   renderStats();
}

// ── Вёрстка транзакции ────────────────────────────────────────────────────────
function txHtml(tx) {
  const c    = CAT_MAP[tx.cat] || { emoji:'💸', name: tx.cat };
  const sign = tx.type === 'income' ? '+' : '−';
  const bg   = tx.type === 'income' ? 'rgba(48,215,128,0.12)' : 'rgba(255,77,106,0.12)';
  // Не дублируем название категории в note
  const noteText = tx.note && tx.note.toLowerCase() !== c.name.toLowerCase() ? tx.note : '';

  return `
    <div class="tx-item" data-id="${tx.id}">
      <div class="tx-delete-bg">🗑️</div>
      <div class="tx-item-inner">
        <div class="tx-icon" style="background:${bg}">${c.emoji}</div>
        <div class="tx-info">
          <div class="tx-category">${c.name}${noteText ? ` · ${noteText}` : ''}</div>
          <div class="tx-meta">
            <span class="tx-date">${fmtTime(tx.date)}</span>
          </div>
        </div>
        <div class="tx-amount ${tx.type}">${sign}${fmt(tx.amount)}</div>
      </div>
    </div>
  `;
}

// ── Форматирование ────────────────────────────────────────────────────────────
function fmt(n) {
  return new Intl.NumberFormat('ru-RU', {
    style:'currency', currency:'RUB', maximumFractionDigits:0
  }).format(n);
}
function fmtDate(ts) {
  const d = new Date(ts), today = new Date(), yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Сегодня';
  if (d.toDateString() === yesterday.toDateString()) return 'Вчера';
  return d.toLocaleDateString('ru-RU', { day:'numeric', month:'long' });
}
function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString('ru-RU', { hour:'2-digit', minute:'2-digit' });
}

// ── Toast ──────────────────────────────────────────────────────────────────────
let toastTimer;
function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

// ── Deep links ────────────────────────────────────────────────────────────────
function handleDeepLink() {
  const action = new URLSearchParams(location.search).get('action');
  if (action === 'expense') openAdd('expense');
  else if (action === 'income') openAdd('income');
  else showScreen('home');
}

// ── Service Worker ────────────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/finance-app/sw.js').catch(() => {});
}

// ── Запуск ────────────────────────────────────────────────────────────────────
applyTheme(currentTheme);
renderThemeCards();
renderCategories();
handleDeepLink();
