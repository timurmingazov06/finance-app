'use strict';

// ── Категории расходов ────────────────────────────────────────────────────────
const DEFAULT_EXPENSE_CATS = [
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
];

// ── Категории доходов ─────────────────────────────────────────────────────────
const DEFAULT_INCOME_CATS = [
  { id:'salary',       emoji:'💰', name:'Зарплата' },
  { id:'freelance',    emoji:'💻', name:'Фриланс' },
  { id:'invest',       emoji:'📈', name:'Инвестиции' },
  { id:'gift',         emoji:'🎁', name:'Подарок' },
  { id:'cashback',     emoji:'💳', name:'Кэшбэк' },
  { id:'rental',       emoji:'🏘️', name:'Аренда' },
  { id:'income_other', emoji:'💸', name:'Другое' },
];

// ── Storage ───────────────────────────────────────────────────────────────────
function loadTx()    { try { return JSON.parse(localStorage.getItem('finance_tx') || '[]'); } catch { return []; } }
function saveTx(l)   { localStorage.setItem('finance_tx', JSON.stringify(l)); }
function loadTheme() { return localStorage.getItem('finance_theme') || 'dark'; }
function saveTheme(t){ localStorage.setItem('finance_theme', t); }

function loadExpenseCats() {
  try {
    const s = localStorage.getItem('finance_cats_expense');
    if (s) return JSON.parse(s);
    // Миграция из старого формата
    const old = localStorage.getItem('finance_cats');
    if (old) {
      const all = JSON.parse(old);
      const incomeIds = new Set(['salary','gift','freelance','invest']);
      return all.filter(c => !incomeIds.has(c.id));
    }
    return DEFAULT_EXPENSE_CATS;
  } catch { return DEFAULT_EXPENSE_CATS; }
}
function loadIncomeCats() {
  try {
    const s = localStorage.getItem('finance_cats_income');
    return s ? JSON.parse(s) : DEFAULT_INCOME_CATS;
  } catch { return DEFAULT_INCOME_CATS; }
}
function saveExpenseCats() { localStorage.setItem('finance_cats_expense', JSON.stringify(EXPENSE_CATS)); }
function saveIncomeCats()  { localStorage.setItem('finance_cats_income',  JSON.stringify(INCOME_CATS)); }

// ── State ─────────────────────────────────────────────────────────────────────
let transactions  = loadTx();
let EXPENSE_CATS  = loadExpenseCats();
let INCOME_CATS   = loadIncomeCats();
let currentScreen = 'home';
let addType       = 'expense';
let selectedCat   = 'food';
let statsPeriod   = 'month';
let statsOffset   = 0;
let historyFilter = 'all';
let currentTheme  = loadTheme();
let catsMgrType   = 'expense';

// Период на главной
let homePeriod  = 'day';
let homeOffset  = 0;
let customStart = null;
let customEnd   = null;

let editingTxId   = null;
let editType      = 'expense';
let editCat       = 'food';
let selectedDate  = null;

// ── DOM ───────────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const screens = { home:$('screen-home'), add:$('screen-add'), history:$('screen-history'), stats:$('screen-stats') };

// ── CAT utils ─────────────────────────────────────────────────────────────────
function getCats(type) { return type === 'income' ? INCOME_CATS : EXPENSE_CATS; }
function catFor(id) {
  return [...EXPENSE_CATS, ...INCOME_CATS].find(c => c.id === id) || { emoji:'💸', name:'Другое' };
}

// ── Темы ──────────────────────────────────────────────────────────────────────
const THEMES = {
  dark:     { label:'Dark',         desc:'Тёмная с фиолетовым' },
  glass:    { label:'Liquid Glass', desc:'iOS 26 — фон сквозь стекло' },
  midnight: { label:'Midnight',     desc:'Чёрный AMOLED' },
};
function applyTheme(t) {
  currentTheme = t;
  if (t === 'dark') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
  saveTheme(t);
  renderThemeCards();
}
function vibrate(pattern = 8) { if (navigator.vibrate) navigator.vibrate(pattern); }

// ── Overlay / Шторки ─────────────────────────────────────────────────────────
const overlay     = $('sheet-overlay');
const themeSheet  = $('theme-sheet');
const editSheet   = $('edit-sheet');
const catsSheet   = $('cats-sheet');
const newcatSheet = $('newcat-sheet');

function openOverlay()  { overlay.classList.add('open'); }
function closeAllSheets() {
  overlay.classList.remove('open');
  themeSheet.classList.remove('open');
  editSheet.classList.remove('open');
  catsSheet.classList.remove('open');
  newcatSheet.classList.remove('open');
  editingTxId = null;
}

overlay.addEventListener('click', () => {
  themeSheet.classList.remove('open');
  editSheet.classList.remove('open');
  catsSheet.classList.remove('open');
  overlay.classList.remove('open');
  editingTxId = null;
});

$('theme-btn').addEventListener('click', () => { vibrate(6); openOverlay(); themeSheet.classList.add('open'); });
$('sheet-close').addEventListener('click', closeAllSheets);

function renderThemeCards() {
  $('theme-cards').innerHTML = Object.entries(THEMES).map(([id,t]) => `
    <div class="theme-card ${currentTheme===id?'active':''}" data-theme-id="${id}">
      <div class="theme-preview theme-preview-${id}"></div>
      <div class="theme-card-info">
        <div class="theme-card-name">${t.label}</div>
        <div class="theme-card-desc">${t.desc}</div>
      </div>
      <div class="theme-card-check">✓</div>
    </div>
  `).join('');
  $('theme-cards').querySelectorAll('.theme-card').forEach(card => {
    card.addEventListener('click', () => { vibrate(10); applyTheme(card.dataset.themeId); setTimeout(closeAllSheets, 180); });
  });
}

// ── Экспорт / Импорт ─────────────────────────────────────────────────────────
$('btn-export').addEventListener('click', () => {
  vibrate(8);
  const data = { version: 1, exported: new Date().toISOString(), transactions };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `finance-backup-${new Date().toLocaleDateString('ru-RU').replace(/\./g,'-')}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('✅ Данные экспортированы');
});
$('btn-import').addEventListener('click', () => $('import-file').click());
$('import-file').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const data = JSON.parse(ev.target.result);
      const imported = data.transactions || data;
      if (!Array.isArray(imported)) throw new Error('bad format');
      transactions = imported;
      saveTx(transactions);
      closeAllSheets();
      renderHome();
      toast(`✅ Импортировано ${imported.length} записей`);
    } catch { toast('❌ Ошибка формата файла'); }
  };
  reader.readAsText(file);
  e.target.value = '';
});

// ── Навигация по экранам ──────────────────────────────────────────────────────
function showScreen(name) {
  Object.entries(screens).forEach(([k,el]) => el.classList.toggle('active', k===name));
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.screen===name));
  currentScreen = name;
  if (name === 'home')    renderHome();
  if (name === 'history') renderHistory();
  if (name === 'stats')   renderStats();
}
document.querySelectorAll('.nav-btn').forEach(btn => btn.addEventListener('click', () => showScreen(btn.dataset.screen)));

// ── Период главной ─────────────────────────────────────────────────────────────
function getPeriodDates(period, offset) {
  const now = new Date();
  let start, end;
  switch (period) {
    case 'day':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
      end   = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset + 1);
      break;
    case 'week': {
      const dow  = now.getDay();
      const diff = dow === 0 ? -6 : 1 - dow;
      const mon  = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff + offset * 7);
      start = mon;
      end   = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 7);
      break;
    }
    case 'month':
      start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      end   = new Date(now.getFullYear(), now.getMonth() + offset + 1, 1);
      break;
    case 'year':
      start = new Date(now.getFullYear() + offset, 0, 1);
      end   = new Date(now.getFullYear() + offset + 1, 0, 1);
      break;
    case 'custom':
      start = customStart != null ? new Date(customStart) : new Date(now.getFullYear(), now.getMonth(), 1);
      end   = customEnd   != null ? new Date(customEnd + 86400000) : new Date(now.getFullYear(), now.getMonth() + 1, 1);
      break;
  }
  return { start: start.getTime(), end: end.getTime() };
}

function getPeriodLabel(period, offset) {
  const { start, end } = getPeriodDates(period, offset);
  const s = new Date(start);
  const now = new Date();
  switch (period) {
    case 'day': {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yest  = new Date(today); yest.setDate(yest.getDate() - 1);
      if (s.getTime() === today.getTime()) return 'Сегодня';
      if (s.getTime() === yest.getTime())  return 'Вчера';
      return s.toLocaleDateString('ru-RU', {day:'numeric', month:'long'});
    }
    case 'week': {
      const e = new Date(end - 1);
      return `${s.toLocaleDateString('ru-RU',{day:'numeric',month:'short'})} – ${e.toLocaleDateString('ru-RU',{day:'numeric',month:'short'})}`;
    }
    case 'month':
      return s.toLocaleDateString('ru-RU', {month:'long', year:'numeric'}).replace(/^./, c=>c.toUpperCase());
    case 'year':
      return String(s.getFullYear());
    case 'custom':
      if (customStart != null && customEnd != null) {
        return `${new Date(customStart).toLocaleDateString('ru-RU',{day:'numeric',month:'short'})} – ${new Date(customEnd).toLocaleDateString('ru-RU',{day:'numeric',month:'short'})}`;
      }
      return 'Выберите период';
  }
}

// Табы периода
document.querySelectorAll('.home-period-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    vibrate(6);
    homePeriod = btn.dataset.hperiod;
    homeOffset = 0;
    document.querySelectorAll('.home-period-btn').forEach(b => b.classList.toggle('active', b === btn));
    const customRow = $('custom-period-row');
    const periodNav = $('period-nav');
    if (homePeriod === 'custom') {
      customRow.style.display = 'flex';
      periodNav.style.display = 'none';
    } else {
      customRow.style.display = 'none';
      periodNav.style.display = '';
      renderHome();
    }
  });
});

$('btn-prev-period').addEventListener('click', () => {
  vibrate(6);
  if (homePeriod !== 'custom') { homeOffset--; renderHome(); }
});
$('btn-next-period').addEventListener('click', () => {
  vibrate(6);
  if (homePeriod !== 'custom' && homeOffset < 0) { homeOffset++; renderHome(); }
});

$('custom-start-date').addEventListener('change', e => {
  customStart = e.target.value ? new Date(e.target.value).getTime() : null;
  if (customStart != null && customEnd != null) renderHome();
});
$('custom-end-date').addEventListener('change', e => {
  customEnd = e.target.value ? new Date(e.target.value).getTime() : null;
  if (customStart != null && customEnd != null) renderHome();
});

// ── Свайп по карточке баланса (смена периода) ─────────────────────────────────
(function() {
  const card = document.querySelector('.balance-card');
  let sx = 0, sy = 0;
  card.addEventListener('touchstart', e => {
    sx = e.touches[0].clientX;
    sy = e.touches[0].clientY;
  }, {passive:true});
  card.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - sx;
    const dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) < 44 || Math.abs(dy) > Math.abs(dx) * 0.75) return;
    if (homePeriod === 'custom') return;
    if (dx < 0) {
      // влево — вперёд во времени
      if (homeOffset < 0) { homeOffset++; vibrate(6); renderHome(); }
    } else {
      // вправо — назад во времени
      homeOffset--; vibrate(6); renderHome();
    }
  }, {passive:true});
})();

// ── Главная ───────────────────────────────────────────────────────────────────
function renderHome() {
  const { start, end } = getPeriodDates(homePeriod, homeOffset);
  const periodTx = transactions.filter(t => t.date >= start && t.date < end);
  const income   = periodTx.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  const expense  = periodTx.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);

  animateNumber($('balance-total'), income - expense);
  $('month-income').textContent  = '+' + fmt(income);
  $('month-expense').textContent = '−' + fmt(expense);

  const lbl = $('period-label');
  if (lbl) lbl.textContent = getPeriodLabel(homePeriod, homeOffset);

  const nextBtn = $('btn-next-period');
  if (nextBtn) {
    const canFwd = homeOffset < 0 && homePeriod !== 'custom';
    nextBtn.style.opacity      = canFwd ? '1' : '0.3';
    nextBtn.style.pointerEvents = canFwd ? 'auto' : 'none';
  }

  renderTrend(expense);

  const sorted = [...periodTx].sort((a,b)=>b.date-a.date);
  const list = $('home-tx-list');
  if (!sorted.length) {
    list.innerHTML = `<div class="empty-state"><div class="emoji">💳</div><p>За этот период пока нет записей.<br>Нажми «Расход» или «Доход».</p></div>`;
    return;
  }
  list.innerHTML = sorted.map(txHtml).join('');
  attachSwipe(list);
  attachTxTap(list);
}

// ── Тренд ─────────────────────────────────────────────────────────────────────
function renderTrend(curExpense) {
  const el = $('trend-badge');
  if (!el) return;
  if (homePeriod !== 'month' || homeOffset !== 0) { el.innerHTML = ''; return; }
  const ref = new Date(); ref.setMonth(ref.getMonth() - 1);
  const prevExpense = transactions.filter(t => {
    const d = new Date(t.date);
    return t.type==='expense' && d.getMonth()===ref.getMonth() && d.getFullYear()===ref.getFullYear();
  }).reduce((s,t)=>s+t.amount, 0);
  if (!prevExpense) { el.innerHTML = ''; return; }
  const diff = curExpense - prevExpense, pct = Math.round(Math.abs(diff)/prevExpense*100);
  const name = ref.toLocaleDateString('ru-RU', {month:'long'});
  el.innerHTML = Math.abs(pct) < 2
    ? `<span class="trend-badge flat">≈ как в ${name}</span>`
    : diff > 0
      ? `<span class="trend-badge down">↑ +${pct}% расходов vs ${name}</span>`
      : `<span class="trend-badge up">↓ −${pct}% расходов vs ${name}</span>`;
}

// ── Анимация числа ────────────────────────────────────────────────────────────
function animateNumber(el, target) {
  const from = parseFloat(el.dataset.value || '0') || 0;
  el.dataset.value = target;
  const start = Date.now(), dur = 450;
  (function tick() {
    const p = Math.min((Date.now()-start)/dur, 1), e = 1-Math.pow(1-p,3);
    el.textContent = fmt(from + (target-from)*e);
    if (p < 1) requestAnimationFrame(tick); else el.textContent = fmt(target);
  })();
}

// ── Добавление ────────────────────────────────────────────────────────────────
function setAddDate(ts) {
  selectedDate = ts;
  document.querySelectorAll('.date-btn').forEach(btn => btn.classList.remove('active'));
  const now    = new Date(); now.setHours(0,0,0,0);
  const picked = new Date(ts); picked.setHours(0,0,0,0);
  const diff   = Math.round((picked - now) / 86400000);
  const match  = document.querySelector(`.date-btn[data-days="${diff}"]`);
  if (match) {
    match.classList.add('active');
  } else {
    const last = $('date-btn-last');
    if (last._ts && last._ts === ts) {
      last.classList.add('active');
    } else {
      const cal = $('date-btn-cal');
      cal.querySelector('.date-btn-date').textContent  = dateFmt(picked);
      cal.querySelector('.date-btn-label').textContent = new Date(ts).toLocaleDateString('ru',{month:'short'});
      cal.classList.add('active');
    }
  }
}

function openAdd(type = 'expense') {
  addType = type;
  selectedDate = null;
  selectedCat = getCats(type)[0]?.id || (type === 'income' ? 'salary' : 'food');
  $('note-input').value = '';
  $('amount-input').value = '';
  $('date-picker-input').value = '';
  $('date-btn-cal').querySelector('.date-btn-label').textContent = 'дата';
  $('date-btn-cal').querySelector('.date-btn-date').textContent = '📅';
  document.querySelectorAll('.date-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.date-btn[data-days="0"]').classList.add('active');
  renderDateRow();
  $('add-title').textContent = 'Новая запись';
  updateTypeToggle();
  renderCategories();
  showScreen('add');
  setTimeout(() => $('amount-input').focus(), 300);
}
$('btn-expense').addEventListener('click', () => { vibrate(8); openAdd('expense'); });
$('btn-income').addEventListener('click',  () => { vibrate(8); openAdd('income'); });

document.querySelectorAll('.type-btn[data-type]').forEach(btn => {
  btn.addEventListener('click', () => {
    addType = btn.dataset.type;
    const cats = getCats(addType);
    selectedCat = cats[0]?.id || 'food';
    updateTypeToggle();
    renderCategories();
  });
});

// ── Строка выбора даты ────────────────────────────────────────────────────────
function dateFmt(d) {
  return String(d.getDate()).padStart(2,'0') + '.' + String(d.getMonth()+1).padStart(2,'0');
}
function renderDateRow() {
  const today = new Date(); today.setHours(0,0,0,0);
  const yest  = new Date(today); yest.setDate(yest.getDate()-1);

  $('date-btn-today').querySelector('.date-btn-date').textContent    = dateFmt(today);
  $('date-btn-yesterday').querySelector('.date-btn-date').textContent = dateFmt(yest);

  const lastBtn = $('date-btn-last');
  const lastTx  = [...transactions].sort((a,b) => b.date - a.date)[0];
  if (lastTx) {
    const ld = new Date(lastTx.date); ld.setHours(0,0,0,0);
    const diff = Math.round((ld - today) / 86400000);
    if (diff < -1) {
      lastBtn.querySelector('.date-btn-date').textContent = dateFmt(ld);
      lastBtn._ts = new Date(ld.getFullYear(), ld.getMonth(), ld.getDate(), 12).getTime();
      lastBtn.style.display = '';
    } else {
      lastBtn.style.display = 'none';
    }
  } else {
    lastBtn.style.display = 'none';
  }
}

document.querySelectorAll('.date-btn[data-days]').forEach(btn => {
  btn.addEventListener('click', () => {
    vibrate(4);
    const d = new Date(); d.setHours(12,0,0,0);
    d.setDate(d.getDate() + parseInt(btn.dataset.days));
    setAddDate(d.getTime());
  });
});
$('date-btn-last').addEventListener('click', () => {
  vibrate(4);
  if ($('date-btn-last')._ts) setAddDate($('date-btn-last')._ts);
});
$('date-picker-input').addEventListener('change', e => {
  if (!e.target.value) return;
  const [y,m,d] = e.target.value.split('-').map(Number);
  setAddDate(new Date(y, m-1, d, 12, 0, 0).getTime());
});

function updateTypeToggle() {
  document.querySelectorAll('.type-btn[data-type]').forEach(btn => {
    btn.className = btn.dataset.type===addType ? `type-btn active ${addType}` : 'type-btn';
  });
}
function renderCategories() {
  const cats = getCats(addType);
  $('categories-grid').innerHTML = cats.map(c => `
    <button class="cat-btn ${c.id===selectedCat?'selected':''}" data-id="${c.id}">
      <span class="cat-emoji">${c.emoji}</span>
      <span class="cat-name">${c.name}</span>
    </button>
  `).join('');
  $('categories-grid').querySelectorAll('.cat-btn').forEach(btn => {
    btn.addEventListener('click', () => { vibrate(4); selectedCat = btn.dataset.id; renderCategories(); });
  });
}

$('save-btn').addEventListener('click', () => {
  const amount = parseFloat($('amount-input').value.replace(',', '.'));
  if (!amount || amount <= 0) { toast('Введи сумму'); return; }
  vibrate([8,40,12]);
  const txDate = selectedDate !== null ? selectedDate : (() => { const d=new Date(); d.setHours(12,0,0,0); return d.getTime(); })();
  transactions.push({ id:Date.now().toString(), type:addType, amount, cat:selectedCat, note:$('note-input').value.trim(), date:txDate });
  saveTx(transactions);
  toast(addType==='expense' ? '✅ Расход добавлен' : '✅ Доход добавлен');
  homeOffset = 0;
  showScreen('home');
});

// ── История ───────────────────────────────────────────────────────────────────
function renderHistory() {
  let list = [...transactions].sort((a,b) => b.date-a.date);
  if (historyFilter !== 'all') list = list.filter(t => t.type === historyFilter);
  document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.filter===historyFilter));
  const el = $('history-tx-list');
  if (!list.length) { el.innerHTML = `<div class="empty-state"><div class="emoji">🔍</div><p>Ничего не найдено</p></div>`; return; }
  let html = '', lastDate = '';
  list.forEach(tx => {
    const d = fmtDate(tx.date);
    if (d !== lastDate) { html += `<div class="section-title" style="padding:10px 4px 6px">${d}</div>`; lastDate = d; }
    html += txHtml(tx);
  });
  el.innerHTML = html;
  attachSwipe(el);
  attachTxTap(el);
}
document.querySelectorAll('.filter-btn').forEach(btn => btn.addEventListener('click', () => { historyFilter = btn.dataset.filter; renderHistory(); }));

// ── Статистика ────────────────────────────────────────────────────────────────
let chart = null;

function getStatsDates() {
  const now = new Date();
  if (statsPeriod === 'all') return null;
  if (statsPeriod === 'week') {
    const dow  = now.getDay();
    const diff = dow === 0 ? -6 : 1 - dow;
    const mon  = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff + statsOffset * 7);
    return { start: mon.getTime(), end: new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 7).getTime() };
  }
  if (statsPeriod === 'month') {
    const s = new Date(now.getFullYear(), now.getMonth() + statsOffset, 1);
    return { start: s.getTime(), end: new Date(now.getFullYear(), now.getMonth() + statsOffset + 1, 1).getTime() };
  }
  return null;
}

function getStatsLabel() {
  if (statsPeriod === 'all') return 'Всё время';
  const dates = getStatsDates();
  if (!dates) return '';
  const s = new Date(dates.start);
  if (statsPeriod === 'month') {
    return s.toLocaleDateString('ru-RU', {month:'long', year:'numeric'}).replace(/^./, c=>c.toUpperCase());
  }
  const e = new Date(dates.end - 1);
  return `${s.toLocaleDateString('ru-RU',{day:'numeric',month:'short'})} – ${e.toLocaleDateString('ru-RU',{day:'numeric',month:'short'})}`;
}

function renderStats() {
  const now = new Date();
  const dates = getStatsDates();
  const filtered = dates
    ? transactions.filter(t => t.date >= dates.start && t.date < dates.end)
    : transactions;

  const ti = filtered.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  const te = filtered.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
  $('stat-income').textContent  = fmt(ti);
  $('stat-expense').textContent = fmt(te);
  $('stat-balance').textContent = fmt(ti-te);

  const byCat = {};
  filtered.filter(t=>t.type==='expense').forEach(t => { byCat[t.cat] = (byCat[t.cat]||0) + t.amount; });
  const sorted = Object.entries(byCat).sort((a,b)=>b[1]-a[1]);
  const maxAmt = sorted[0]?.[1] || 1;
  $('cat-stats').innerHTML = !sorted.length
    ? '<div style="color:var(--text2);font-size:14px;padding:6px 0">Расходов пока нет</div>'
    : sorted.map(([id,amt]) => {
        const c = catFor(id);
        return `<div class="cat-stat-item"><span class="cat-stat-emoji">${c.emoji}</span><div class="cat-stat-info"><div class="cat-stat-name">${c.name}</div><div class="cat-stat-bar-wrap"><div class="cat-stat-bar" style="width:${Math.round(amt/maxAmt*100)}%"></div></div></div><div class="cat-stat-amount">−${fmt(amt)}</div></div>`;
      }).join('');

  // Навигация по периоду
  const statsNav = $('stats-period-nav');
  if (statsNav) statsNav.style.display = statsPeriod === 'all' ? 'none' : 'flex';
  const lbl = $('stats-period-label');
  if (lbl) lbl.textContent = getStatsLabel();
  const nextBtn = $('stats-next');
  if (nextBtn) {
    const canFwd = statsOffset < 0;
    nextBtn.style.opacity      = canFwd ? '1' : '0.3';
    nextBtn.style.pointerEvents = canFwd ? 'auto' : 'none';
  }

  // Данные графика
  let labels=[], incomes=[], expenses=[];
  if (statsPeriod === 'week' && dates) {
    for (let i = 0; i < 7; i++) {
      const d = new Date(dates.start + i * 86400000);
      labels.push(`${d.getDate()}/${d.getMonth()+1}`);
      const dayTx = filtered.filter(t => {
        const td = new Date(t.date);
        return td.getFullYear()===d.getFullYear() && td.getMonth()===d.getMonth() && td.getDate()===d.getDate();
      });
      incomes.push(dayTx.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0));
      expenses.push(dayTx.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0));
    }
  } else if (statsPeriod === 'month' && dates) {
    const s = new Date(dates.start);
    const daysInMonth = new Date(s.getFullYear(), s.getMonth()+1, 0).getDate();
    for (let i = 1; i <= daysInMonth; i++) {
      labels.push(String(i));
      const dayTx = filtered.filter(t => {
        const td = new Date(t.date);
        return td.getFullYear()===s.getFullYear() && td.getMonth()===s.getMonth() && td.getDate()===i;
      });
      incomes.push(dayTx.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0));
      expenses.push(dayTx.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0));
    }
  } else {
    // Всё время: последние 12 месяцев
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      labels.push(d.toLocaleDateString('ru-RU', {month:'short'}));
      const monthTx = transactions.filter(t => {
        const td = new Date(t.date);
        return td.getMonth()===d.getMonth() && td.getFullYear()===d.getFullYear();
      });
      incomes.push(monthTx.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0));
      expenses.push(monthTx.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0));
    }
  }

  if (chart) chart.destroy();
  chart = new Chart($('chart').getContext('2d'), {
    type: 'bar',
    data: { labels, datasets: [
      { label:'Доходы',  data:incomes,  backgroundColor:'rgba(48,215,128,0.7)', borderRadius:4 },
      { label:'Расходы', data:expenses, backgroundColor:'rgba(255,77,106,0.7)', borderRadius:4 },
    ]},
    options: { responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ labels:{ color:'rgba(255,255,255,0.4)', font:{size:11} }}},
      scales:{ x:{ ticks:{color:'rgba(255,255,255,0.35)',font:{size:10}}, grid:{color:'rgba(255,255,255,0.06)'} },
               y:{ ticks:{color:'rgba(255,255,255,0.35)',font:{size:10}}, grid:{color:'rgba(255,255,255,0.06)'} }},
    },
  });
}

document.querySelectorAll('.period-btn').forEach(btn => btn.addEventListener('click', () => {
  statsPeriod = btn.dataset.period;
  statsOffset = 0;
  document.querySelectorAll('.period-btn').forEach(b => b.classList.toggle('active', b===btn));
  renderStats();
}));

$('stats-prev').addEventListener('click', () => {
  if (statsPeriod === 'all') return;
  statsOffset--; vibrate(6); renderStats();
});
$('stats-next').addEventListener('click', () => {
  if (statsPeriod === 'all' || statsOffset >= 0) return;
  statsOffset++; vibrate(6); renderStats();
});

// ── Редактирование транзакции ─────────────────────────────────────────────────
function openEditSheet(tx) {
  vibrate(8);
  editingTxId = tx.id;
  editType    = tx.type;
  editCat     = tx.cat;
  document.querySelectorAll('.type-btn[data-etype]').forEach(btn => {
    btn.className = btn.dataset.etype===editType ? `type-btn active ${editType}` : 'type-btn';
  });
  $('edit-amount-input').value = String(tx.amount);
  renderEditCategories();
  $('edit-note-input').value = tx.note || '';
  openOverlay();
  editSheet.classList.add('open');
}
function closeEditSheet() {
  overlay.classList.remove('open');
  editSheet.classList.remove('open');
  editingTxId = null;
}

document.querySelectorAll('.type-btn[data-etype]').forEach(btn => {
  btn.addEventListener('click', () => {
    editType = btn.dataset.etype;
    const cats = getCats(editType);
    if (!cats.find(c => c.id === editCat)) editCat = cats[0]?.id || '';
    document.querySelectorAll('.type-btn[data-etype]').forEach(b => {
      b.className = b.dataset.etype===editType ? `type-btn active ${editType}` : 'type-btn';
    });
    renderEditCategories();
  });
});

function renderEditCategories() {
  const cats = getCats(editType);
  if (!cats.find(c => c.id === editCat)) editCat = cats[0]?.id || '';
  $('edit-categories-grid').innerHTML = cats.map(c => `
    <button class="cat-btn ${c.id===editCat?'selected':''}" data-eid="${c.id}">
      <span class="cat-emoji">${c.emoji}</span><span class="cat-name">${c.name}</span>
    </button>
  `).join('');
  $('edit-categories-grid').querySelectorAll('.cat-btn').forEach(btn => {
    btn.addEventListener('click', () => { vibrate(4); editCat = btn.dataset.eid; renderEditCategories(); });
  });
}

$('edit-save-btn').addEventListener('click', () => {
  if (!editingTxId) return;
  const amount = parseFloat($('edit-amount-input').value.replace(',', '.'));
  if (!amount || amount <= 0) { toast('Введи сумму'); return; }
  vibrate([8,40,12]);
  transactions = transactions.map(t => t.id===editingTxId ? {...t, type:editType, amount, cat:editCat, note:$('edit-note-input').value.trim()} : t);
  saveTx(transactions);
  closeEditSheet();
  toast('✅ Изменено');
  if (currentScreen==='home')    renderHome();
  if (currentScreen==='history') renderHistory();
  if (currentScreen==='stats')   renderStats();
});
$('edit-del-btn').addEventListener('click', () => {
  if (!editingTxId) return;
  vibrate(12);
  transactions = transactions.filter(t => t.id !== editingTxId);
  saveTx(transactions);
  closeEditSheet();
  toast('Удалено');
  if (currentScreen==='home')    renderHome();
  if (currentScreen==='history') renderHistory();
  if (currentScreen==='stats')   renderStats();
});

function attachTxTap(container) {
  container.querySelectorAll('.tx-item').forEach(item => {
    item.addEventListener('click', e => {
      if (e.target.closest('.tx-delete-bg')) return;
      const tx = transactions.find(t => t.id === item.dataset.id);
      if (tx) openEditSheet(tx);
    });
  });
}

// ── Свайп для удаления ────────────────────────────────────────────────────────
function attachSwipe(container) {
  container.querySelectorAll('.tx-item').forEach(item => {
    const inner = item.querySelector('.tx-item-inner');
    const bg    = item.querySelector('.tx-delete-bg');
    let startX=0, currentX=0, dragging=false;
    item.addEventListener('touchstart', e => { startX=e.touches[0].clientX; dragging=true; }, {passive:true});
    item.addEventListener('touchmove', e => {
      if (!dragging) return;
      currentX = e.touches[0].clientX - startX;
      if (currentX > 0) currentX = 0;
      const c = Math.max(currentX, -80);
      inner.style.transform = `translateX(${c}px)`;
      bg.style.opacity = String(Math.min(-c/72, 1));
    }, {passive:true});
    item.addEventListener('touchend', () => {
      if (!dragging) return; dragging = false;
      if (currentX < -72) {
        inner.style.transform = 'translateX(-80px)'; bg.style.opacity = '1'; vibrate(12);
        setTimeout(() => {
          item.style.transition = 'all 0.22s ease';
          item.style.opacity = '0'; item.style.transform = 'scaleY(0.8)'; item.style.marginBottom = '-62px';
          setTimeout(() => { transactions=transactions.filter(t=>t.id!==item.dataset.id); saveTx(transactions); renderHome(); if(currentScreen==='history')renderHistory(); }, 220);
        }, 180);
      } else { inner.style.transform = ''; bg.style.opacity = '0'; }
      currentX = 0;
    });
  });
}

// ── Вёрстка транзакции ────────────────────────────────────────────────────────
function txHtml(tx) {
  const c    = catFor(tx.cat);
  const sign = tx.type==='income' ? '+' : '−';
  const bg   = tx.type==='income' ? 'rgba(48,215,128,0.12)' : 'rgba(255,77,106,0.12)';
  const noteText = tx.note && tx.note.toLowerCase() !== c.name.toLowerCase() ? tx.note : '';
  return `
    <div class="tx-item" data-id="${tx.id}">
      <div class="tx-delete-bg">🗑️</div>
      <div class="tx-item-inner">
        <div class="tx-icon" style="background:${bg}">${c.emoji}</div>
        <div class="tx-info">
          <div class="tx-category">${c.name}</div>
          <div class="tx-meta">
            ${noteText ? `<span class="tx-note">${noteText}</span>` : ''}
            <span class="tx-date">${fmtTime(tx.date)}</span>
          </div>
        </div>
        <div class="tx-amount ${tx.type}">${sign}${fmt(tx.amount)}</div>
      </div>
    </div>`;
}

// ── Форматирование ────────────────────────────────────────────────────────────
function fmt(n) { return new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:0}).format(n); }
function fmtDate(ts) {
  const d=new Date(ts), today=new Date(), yesterday=new Date();
  yesterday.setDate(yesterday.getDate()-1);
  if (d.toDateString()===today.toDateString()) return 'Сегодня';
  if (d.toDateString()===yesterday.toDateString()) return 'Вчера';
  return d.toLocaleDateString('ru-RU',{day:'numeric',month:'long'});
}
function fmtTime(ts) { return new Date(ts).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'}); }

// ── Toast ──────────────────────────────────────────────────────────────────────
let toastTimer;
function toast(msg) {
  const el = $('toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

// ── Управление категориями ────────────────────────────────────────────────────
$('btn-manage-cats').addEventListener('click', () => {
  catsMgrType = 'expense';
  renderCatsList();
  catsSheet.classList.add('open');
});
$('cats-close').addEventListener('click', () => { catsSheet.classList.remove('open'); });

$('cats-add-btn').addEventListener('click', () => {
  $('newcat-emoji').value = '';
  $('newcat-name').value  = '';
  newcatSheet.classList.add('open');
});
$('newcat-close').addEventListener('click', () => { newcatSheet.classList.remove('open'); });
$('newcat-save-btn').addEventListener('click', () => {
  const emoji = $('newcat-emoji').value.trim() || '📌';
  const name  = $('newcat-name').value.trim();
  if (!name) { toast('Введи название'); return; }
  const newCat = { id: 'custom_' + Date.now(), emoji, name };
  if (catsMgrType === 'expense') {
    EXPENSE_CATS.push(newCat);
    saveExpenseCats();
  } else {
    INCOME_CATS.push(newCat);
    saveIncomeCats();
  }
  newcatSheet.classList.remove('open');
  renderCatsList();
  renderCategories();
  toast('✅ Категория добавлена');
});

function renderCatsList() {
  const cats = catsMgrType === 'expense' ? EXPENSE_CATS : INCOME_CATS;
  const toggleHtml = `
    <div class="type-toggle" style="margin:0 0 14px">
      <button class="type-btn ${catsMgrType==='expense'?'active expense':''}" id="cats-type-expense">Расходы</button>
      <button class="type-btn ${catsMgrType==='income'?'active income':''}" id="cats-type-income">Доходы</button>
    </div>`;
  $('cats-list').innerHTML = toggleHtml + cats.map(c => `
    <div class="cat-manage-item">
      <span class="cat-manage-emoji">${c.emoji}</span>
      <span class="cat-manage-name">${c.name}</span>
      <button class="cat-delete-btn" data-catid="${c.id}">×</button>
    </div>
  `).join('');
  $('cats-type-expense').addEventListener('click', () => { catsMgrType = 'expense'; renderCatsList(); });
  $('cats-type-income').addEventListener('click',  () => { catsMgrType = 'income';  renderCatsList(); });
  $('cats-list').querySelectorAll('.cat-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.catid;
      if (catsMgrType === 'expense') {
        EXPENSE_CATS = EXPENSE_CATS.filter(c => c.id !== id);
        saveExpenseCats();
      } else {
        INCOME_CATS = INCOME_CATS.filter(c => c.id !== id);
        saveIncomeCats();
      }
      renderCatsList();
      renderCategories();
      toast('Категория удалена');
    });
  });
}

// ── Deep links / Запуск ───────────────────────────────────────────────────────
function handleDeepLink() {
  const action = new URLSearchParams(location.search).get('action');
  if (action === 'income') openAdd('income');
  else openAdd('expense');
}

// ── Service Worker ────────────────────────────────────────────────────────────
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/finance-app/sw.js').catch(() => {});

// ── Запуск ────────────────────────────────────────────────────────────────────
applyTheme(currentTheme);
renderThemeCards();
renderCategories();
handleDeepLink();
