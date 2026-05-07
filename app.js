'use strict';

// ── Данные ──────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: 'food',      emoji: '🍕', name: 'Еда' },
  { id: 'transport', emoji: '🚗', name: 'Транспорт' },
  { id: 'shop',      emoji: '🛍️', name: 'Покупки' },
  { id: 'health',    emoji: '💊', name: 'Здоровье' },
  { id: 'home',      emoji: '🏠', name: 'Дом' },
  { id: 'fun',       emoji: '🎮', name: 'Развлечения' },
  { id: 'sport',     emoji: '💪', name: 'Спорт' },
  { id: 'cafe',      emoji: '☕', name: 'Кафе' },
  { id: 'travel',    emoji: '✈️', name: 'Путешествия' },
  { id: 'beauty',    emoji: '💄', name: 'Красота' },
  { id: 'edu',       emoji: '📚', name: 'Учёба' },
  { id: 'other',     emoji: '💸', name: 'Другое' },
  { id: 'salary',    emoji: '💰', name: 'Зарплата' },
  { id: 'gift',      emoji: '🎁', name: 'Подарок' },
  { id: 'freelance', emoji: '💻', name: 'Фриланс' },
  { id: 'invest',    emoji: '📈', name: 'Инвестиции' },
];

const CAT_MAP = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));

function loadTx() {
  try { return JSON.parse(localStorage.getItem('finance_tx') || '[]'); }
  catch { return []; }
}
function saveTx(list) {
  localStorage.setItem('finance_tx', JSON.stringify(list));
}

let transactions = loadTx();
let currentScreen = 'home';
let addType = 'expense';
let selectedCat = 'food';
let statsPeriod = 'month';
let historyFilter = 'all';

// ── DOM ────────────────────────────────────────────────────────────────────

const $ = id => document.getElementById(id);
const screens = {
  home:    $('screen-home'),
  add:     $('screen-add'),
  history: $('screen-history'),
  stats:   $('screen-stats'),
};

// ── Навигация ───────────────────────────────────────────────────────────────

function showScreen(name) {
  Object.entries(screens).forEach(([k, el]) => {
    el.classList.toggle('active', k === name);
  });
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.screen === name);
  });
  currentScreen = name;
  if (name === 'home')    renderHome();
  if (name === 'history') renderHistory();
  if (name === 'stats')   renderStats();
}

document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => showScreen(btn.dataset.screen));
});

// ── Экран: Главная ──────────────────────────────────────────────────────────

function renderHome() {
  const now = new Date();
  const monthTx = transactions.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const income  = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const balance = income - expense;

  $('balance-total').textContent  = fmt(balance);
  $('month-income').textContent   = '+' + fmt(income);
  $('month-expense').textContent  = '−' + fmt(expense);

  const recent = [...transactions].sort((a,b) => b.date - a.date).slice(0, 20);
  const list = $('home-tx-list');

  if (!recent.length) {
    list.innerHTML = `<div class="empty-state"><div class="emoji">💳</div><p>Транзакций пока нет.<br>Добавь первую!</p></div>`;
    return;
  }
  list.innerHTML = recent.map(txHtml).join('');
  list.querySelectorAll('.tx-delete').forEach(btn => {
    btn.addEventListener('click', () => deleteTx(btn.dataset.id));
  });
}

// ── Экран: Добавление ───────────────────────────────────────────────────────

function openAdd(type = 'expense') {
  addType = type;
  selectedCat = type === 'income' ? 'salary' : 'food';
  $('amount-input').value = '';
  $('note-input').value = '';
  updateTypeToggle();
  renderCategories();
  showScreen('add');
  setTimeout(() => $('amount-input').focus(), 300);
}

$('btn-expense').addEventListener('click', () => openAdd('expense'));
$('btn-income').addEventListener('click',  () => openAdd('income'));

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
    btn.classList.toggle('active', btn.dataset.type === addType);
    btn.className = btn.dataset.type === addType
      ? `type-btn active ${addType}`
      : 'type-btn';
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
      selectedCat = btn.dataset.id;
      renderCategories();
    });
  });
}

$('save-btn').addEventListener('click', () => {
  const raw = $('amount-input').value.replace(',', '.');
  const amount = parseFloat(raw);
  if (!amount || amount <= 0) { toast('Введи сумму'); return; }

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

// ── Экран: История ──────────────────────────────────────────────────────────

function renderHistory() {
  let list = [...transactions].sort((a,b) => b.date - a.date);
  if (historyFilter !== 'all') list = list.filter(t => t.type === historyFilter);

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === historyFilter);
  });

  const el = $('history-tx-list');
  if (!list.length) {
    el.innerHTML = `<div class="empty-state"><div class="emoji">🔍</div><p>Ничего не найдено</p></div>`;
    return;
  }

  let html = '';
  let lastDate = '';
  list.forEach(tx => {
    const d = fmtDate(tx.date);
    if (d !== lastDate) {
      html += `<div class="section-title" style="padding-left:4px;margin-top:8px">${d}</div>`;
      lastDate = d;
    }
    html += txHtml(tx);
  });
  el.innerHTML = html;
  el.querySelectorAll('.tx-delete').forEach(btn => {
    btn.addEventListener('click', () => deleteTx(btn.dataset.id));
  });
}

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    historyFilter = btn.dataset.filter;
    renderHistory();
  });
});

// ── Экран: Статистика ───────────────────────────────────────────────────────

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
    const week = Date.now() - 7 * 86400000;
    filtered = transactions.filter(t => t.date >= week);
  }

  const totalIncome  = filtered.filter(t => t.type === 'income').reduce((s,t) => s + t.amount, 0);
  const totalExpense = filtered.filter(t => t.type === 'expense').reduce((s,t) => s + t.amount, 0);

  $('stat-income').textContent  = fmt(totalIncome);
  $('stat-expense').textContent = fmt(totalExpense);
  $('stat-balance').textContent = fmt(totalIncome - totalExpense);

  // Расходы по категориям
  const byCat = {};
  filtered.filter(t => t.type === 'expense').forEach(t => {
    byCat[t.cat] = (byCat[t.cat] || 0) + t.amount;
  });
  const sorted = Object.entries(byCat).sort((a,b) => b[1] - a[1]);
  const maxAmt = sorted[0]?.[1] || 1;

  const catEl = $('cat-stats');
  if (!sorted.length) {
    catEl.innerHTML = '<div style="color:var(--text2);font-size:14px;padding:8px 0">Расходов пока нет</div>';
  } else {
    catEl.innerHTML = sorted.map(([id, amt]) => {
      const c = CAT_MAP[id] || { emoji: '💸', name: id };
      const pct = Math.round(amt / maxAmt * 100);
      return `
        <div class="cat-stat-item">
          <span class="cat-stat-emoji">${c.emoji}</span>
          <div class="cat-stat-info">
            <div class="cat-stat-name">${c.name}</div>
            <div class="cat-stat-bar-wrap"><div class="cat-stat-bar" style="width:${pct}%"></div></div>
          </div>
          <div class="cat-stat-amount">−${fmt(amt)}</div>
        </div>
      `;
    }).join('');
  }

  // График доходы/расходы по дням (последние 7 или 30 дней)
  const days = statsPeriod === 'week' ? 7 : 30;
  const labels = [], incomes = [], expenses = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = `${d.getDate()}/${d.getMonth()+1}`;
    labels.push(key);
    const dayTx = filtered.filter(t => {
      const td = new Date(t.date);
      return td.getDate() === d.getDate() && td.getMonth() === d.getMonth();
    });
    incomes.push(dayTx.filter(t => t.type === 'income').reduce((s,t) => s + t.amount, 0));
    expenses.push(dayTx.filter(t => t.type === 'expense').reduce((s,t) => s + t.amount, 0));
  }

  if (chart) chart.destroy();
  const ctx = $('chart').getContext('2d');
  chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Доходы',  data: incomes,  backgroundColor: 'rgba(48,215,128,0.7)', borderRadius: 4 },
        { label: 'Расходы', data: expenses, backgroundColor: 'rgba(255,90,90,0.7)',  borderRadius: 4 },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#8888a8', font: { size: 11 } } } },
      scales: {
        x: { ticks: { color: '#8888a8', font: { size: 10 } }, grid: { color: '#2e2e3e' } },
        y: { ticks: { color: '#8888a8', font: { size: 10 } }, grid: { color: '#2e2e3e' } },
      }
    }
  });
}

document.querySelectorAll('.period-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    statsPeriod = btn.dataset.period;
    document.querySelectorAll('.period-btn').forEach(b => b.classList.toggle('active', b === btn));
    renderStats();
  });
});

// ── Удаление ────────────────────────────────────────────────────────────────

function deleteTx(id) {
  transactions = transactions.filter(t => t.id !== id);
  saveTx(transactions);
  if (currentScreen === 'home')    renderHome();
  if (currentScreen === 'history') renderHistory();
  if (currentScreen === 'stats')   renderStats();
  toast('Удалено');
}

// ── Утилиты ─────────────────────────────────────────────────────────────────

function fmt(n) {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(n);
}

function fmtDate(ts) {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Сегодня';
  if (d.toDateString() === yesterday.toDateString()) return 'Вчера';
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function txHtml(tx) {
  const c = CAT_MAP[tx.cat] || { emoji: '💸', name: tx.cat };
  const sign = tx.type === 'income' ? '+' : '−';
  const cls  = tx.type;
  const bg   = tx.type === 'income' ? 'rgba(48,215,128,0.12)' : 'rgba(255,90,90,0.12)';
  return `
    <div class="tx-item">
      <div class="tx-icon" style="background:${bg}">${c.emoji}</div>
      <div class="tx-info">
        <div class="tx-category">${c.name}${tx.note ? ` · ${tx.note}` : ''}</div>
        <div class="tx-date">${fmtTime(tx.date)}</div>
      </div>
      <div class="tx-amount ${cls}">${sign}${fmt(tx.amount)}</div>
      <button class="tx-delete" data-id="${tx.id}" title="Удалить">×</button>
    </div>
  `;
}

let toastTimer;
function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

// ── Deep links (для Shortcuts) ───────────────────────────────────────────────

function handleDeepLink() {
  const p = new URLSearchParams(location.search);
  const action = p.get('action');
  if (action === 'expense') openAdd('expense');
  else if (action === 'income') openAdd('income');
  else showScreen('home');
}

// ── Числовая клавиатура: запятая ─────────────────────────────────────────────

$('amount-input').addEventListener('keydown', e => {
  if (e.key === ',') { e.preventDefault(); $('amount-input').value += '.'; }
});

// ── Service Worker ───────────────────────────────────────────────────────────

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/finance-app/sw.js').catch(() => {});
}

// ── Старт ────────────────────────────────────────────────────────────────────

renderCategories();
handleDeepLink();
