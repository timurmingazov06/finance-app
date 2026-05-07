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

// ── Storage ───────────────────────────────────────────────────────────────────
function loadTx()    { try { return JSON.parse(localStorage.getItem('finance_tx') || '[]'); } catch { return []; } }
function saveTx(l)   { localStorage.setItem('finance_tx', JSON.stringify(l)); }
function loadTheme() { return localStorage.getItem('finance_theme') || 'dark'; }
function saveTheme(t){ localStorage.setItem('finance_theme', t); }

// ── State ─────────────────────────────────────────────────────────────────────
let transactions  = loadTx();
let currentScreen = 'home';
let addType       = 'expense';
let selectedCat   = 'food';
let statsPeriod   = 'month';
let historyFilter = 'all';
let currentTheme  = loadTheme();
let monthOffset   = 0;

// Numpad state
let numpadValue   = '';        // строка цифр для основного экрана добавления
let editNumpadVal = '';        // для редактирования
let editingTxId   = null;
let editType      = 'expense';
let editCat       = 'food';

// ── DOM ───────────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const screens = { home:$('screen-home'), add:$('screen-add'), history:$('screen-history'), stats:$('screen-stats') };

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
function vibrate(pattern = 8) {
  if (navigator.vibrate) navigator.vibrate(pattern);
}

// ── Шторка: тема / настройки ──────────────────────────────────────────────────
const overlay    = $('sheet-overlay');
const themeSheet = $('theme-sheet');
$('theme-btn').addEventListener('click', () => { vibrate(6); overlay.classList.add('open'); themeSheet.classList.add('open'); });
overlay.addEventListener('click', closeSheet);
$('sheet-close').addEventListener('click', closeSheet);
function closeSheet() { overlay.classList.remove('open'); themeSheet.classList.remove('open'); }

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
    card.addEventListener('click', () => { vibrate(10); applyTheme(card.dataset.themeId); setTimeout(closeSheet, 180); });
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
      closeSheet();
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

// ── Навигация по месяцам ──────────────────────────────────────────────────────
function getViewDate() { const d=new Date(); d.setMonth(d.getMonth()+monthOffset); return d; }
function getViewMonthTx() {
  const d = getViewDate();
  return transactions.filter(t => { const td=new Date(t.date); return td.getMonth()===d.getMonth()&&td.getFullYear()===d.getFullYear(); });
}
function updateMonthLabel() {
  const d = getViewDate();
  $('month-label').textContent = d.toLocaleDateString('ru-RU',{month:'long',year:'numeric'}).replace(/^./,c=>c.toUpperCase());
  $('btn-next-month').style.opacity = monthOffset>=0 ? '0.3':'1';
  $('btn-next-month').style.pointerEvents = monthOffset>=0 ? 'none':'auto';
}
$('btn-prev-month').addEventListener('click', () => { vibrate(6); monthOffset--; renderHome(); });
$('btn-next-month').addEventListener('click', () => { vibrate(6); if(monthOffset<0){monthOffset++;renderHome();} });

// ── Главная ───────────────────────────────────────────────────────────────────
function renderHome() {
  updateMonthLabel();
  const monthTx = getViewMonthTx();
  const income  = monthTx.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  const expense = monthTx.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
  animateNumber($('balance-total'), income-expense);
  $('month-income').textContent  = '+'+fmt(income);
  $('month-expense').textContent = '−'+fmt(expense);
  renderTrend(expense);
  const recent = [...monthTx].sort((a,b)=>b.date-a.date).slice(0,30);
  const list = $('home-tx-list');
  if (!recent.length) {
    list.innerHTML = `<div class="empty-state"><div class="emoji">💳</div><p>В этом месяце пока нет записей.<br>Нажми «Расход» или «Доход».</p></div>`;
    return;
  }
  list.innerHTML = recent.map(txHtml).join('');
  attachSwipe(list);
  attachTxTap(list);
}

// ── Тренд ─────────────────────────────────────────────────────────────────────
function renderTrend(curExpense) {
  const el = $('trend-badge');
  if (!el) return;
  const ref = new Date(); ref.setMonth(ref.getMonth()+monthOffset-1);
  const prevExpense = transactions.filter(t=>{
    const d=new Date(t.date);
    return t.type==='expense'&&d.getMonth()===ref.getMonth()&&d.getFullYear()===ref.getFullYear();
  }).reduce((s,t)=>s+t.amount,0);
  if (!prevExpense||monthOffset!==0){el.innerHTML='';return;}
  const diff=curExpense-prevExpense, pct=Math.round(Math.abs(diff)/prevExpense*100);
  const name=ref.toLocaleDateString('ru-RU',{month:'long'});
  el.innerHTML = Math.abs(pct)<2
    ? `<span class="trend-badge flat">≈ как в ${name}</span>`
    : diff>0
      ? `<span class="trend-badge down">↑ +${pct}% расходов vs ${name}</span>`
      : `<span class="trend-badge up">↓ −${pct}% расходов vs ${name}</span>`;
}

// ── Анимация числа ────────────────────────────────────────────────────────────
function animateNumber(el, target) {
  const from=parseFloat(el.dataset.value||'0')||0;
  el.dataset.value=target;
  const start=Date.now(), dur=450;
  (function tick(){
    const p=Math.min((Date.now()-start)/dur,1), e=1-Math.pow(1-p,3);
    el.textContent=fmt(from+(target-from)*e);
    if(p<1) requestAnimationFrame(tick); else el.textContent=fmt(target);
  })();
}

// ── Кастомный Numpad ──────────────────────────────────────────────────────────
function numpadPush(str, key) {
  if (key==='back') return str.length>0 ? str.slice(0,-1) : '';
  if (key==='.') return str.includes('.') ? str : (str||'0')+'.';
  if (str==='0'&&key!=='.') return key;
  if (str.includes('.')&&str.split('.')[1].length>=2) return str;
  return (str+key).slice(0,12);
}
function numpadDisplay(str) {
  if (!str||str==='') return { text:'0', placeholder:true };
  const n=parseFloat(str);
  return { text: isNaN(n)?str:str, placeholder:false };
}
function updateDisplay(elId, str) {
  const el=$(elId);
  const {text,placeholder}=numpadDisplay(str);
  el.textContent=text;
  el.classList.toggle('placeholder', placeholder);
}

// Основной numpad (экран добавления)
document.querySelectorAll('#numpad .numpad-key').forEach(key => {
  key.addEventListener('click', () => {
    vibrate(4);
    numpadValue = numpadPush(numpadValue, key.dataset.key);
    updateDisplay('numpad-display', numpadValue);
  });
});
document.querySelectorAll('#quick-chips .quick-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    vibrate(6);
    const cur=parseFloat(numpadValue)||0;
    numpadValue=String(cur+parseInt(chip.dataset.val));
    updateDisplay('numpad-display', numpadValue);
  });
});

// ── Добавление ────────────────────────────────────────────────────────────────
function openAdd(type='expense') {
  addType=type; selectedCat=type==='income'?'salary':'food';
  numpadValue='';
  $('note-input').value='';
  $('add-title').textContent='Новая запись';
  updateDisplay('numpad-display','');
  updateTypeToggle();
  renderCategories();
  showScreen('add');
}
$('btn-expense').addEventListener('click', ()=>{vibrate(8);openAdd('expense');});
$('btn-income').addEventListener('click',  ()=>{vibrate(8);openAdd('income');});

document.querySelectorAll('.type-btn[data-type]').forEach(btn => {
  btn.addEventListener('click', ()=>{
    addType=btn.dataset.type; selectedCat=addType==='income'?'salary':'food';
    updateTypeToggle(); renderCategories();
  });
});
function updateTypeToggle() {
  document.querySelectorAll('.type-btn[data-type]').forEach(btn=>{
    btn.className=btn.dataset.type===addType?`type-btn active ${addType}`:'type-btn';
  });
}
function renderCategories() {
  $('categories-grid').innerHTML=CATEGORIES.map(c=>`
    <button class="cat-btn ${c.id===selectedCat?'selected':''}" data-id="${c.id}">
      <span class="cat-emoji">${c.emoji}</span>
      <span class="cat-name">${c.name}</span>
    </button>
  `).join('');
  $('categories-grid').querySelectorAll('.cat-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{ vibrate(4); selectedCat=btn.dataset.id; renderCategories(); });
  });
}

$('save-btn').addEventListener('click', ()=>{
  const amount=parseFloat(numpadValue);
  if (!amount||amount<=0){toast('Введи сумму');return;}
  vibrate([8,40,12]);
  transactions.push({id:Date.now().toString(),type:addType,amount,cat:selectedCat,note:$('note-input').value.trim(),date:Date.now()});
  saveTx(transactions);
  toast(addType==='expense'?'✅ Расход добавлен':'✅ Доход добавлен');
  showScreen('home');
});

// ── История ───────────────────────────────────────────────────────────────────
function renderHistory() {
  let list=[...transactions].sort((a,b)=>b.date-a.date);
  if(historyFilter!=='all') list=list.filter(t=>t.type===historyFilter);
  document.querySelectorAll('.filter-btn').forEach(btn=>btn.classList.toggle('active',btn.dataset.filter===historyFilter));
  const el=$('history-tx-list');
  if(!list.length){el.innerHTML=`<div class="empty-state"><div class="emoji">🔍</div><p>Ничего не найдено</p></div>`;return;}
  let html='',lastDate='';
  list.forEach(tx=>{
    const d=fmtDate(tx.date);
    if(d!==lastDate){html+=`<div class="section-title" style="padding:10px 4px 6px">${d}</div>`;lastDate=d;}
    html+=txHtml(tx);
  });
  el.innerHTML=html;
  attachSwipe(el);
  attachTxTap(el);
}
document.querySelectorAll('.filter-btn').forEach(btn=>btn.addEventListener('click',()=>{historyFilter=btn.dataset.filter;renderHistory();}));

// ── Статистика ────────────────────────────────────────────────────────────────
let chart=null;
function renderStats() {
  const now=new Date();
  let filtered=transactions;
  if(statsPeriod==='month') filtered=transactions.filter(t=>{const d=new Date(t.date);return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();});
  else if(statsPeriod==='week') filtered=transactions.filter(t=>t.date>=Date.now()-7*86400000);
  const ti=filtered.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  const te=filtered.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
  $('stat-income').textContent=fmt(ti);
  $('stat-expense').textContent=fmt(te);
  $('stat-balance').textContent=fmt(ti-te);
  const byCat={};
  filtered.filter(t=>t.type==='expense').forEach(t=>{byCat[t.cat]=(byCat[t.cat]||0)+t.amount;});
  const sorted=Object.entries(byCat).sort((a,b)=>b[1]-a[1]);
  const maxAmt=sorted[0]?.[1]||1;
  $('cat-stats').innerHTML=!sorted.length
    ?'<div style="color:var(--text2);font-size:14px;padding:6px 0">Расходов пока нет</div>'
    :sorted.map(([id,amt])=>{
        const c=CAT_MAP[id]||{emoji:'💸',name:id};
        return `<div class="cat-stat-item"><span class="cat-stat-emoji">${c.emoji}</span><div class="cat-stat-info"><div class="cat-stat-name">${c.name}</div><div class="cat-stat-bar-wrap"><div class="cat-stat-bar" style="width:${Math.round(amt/maxAmt*100)}%"></div></div></div><div class="cat-stat-amount">−${fmt(amt)}</div></div>`;
      }).join('');
  const days=statsPeriod==='week'?7:30;
  const labels=[],incomes=[],expenses=[];
  for(let i=days-1;i>=0;i--){
    const d=new Date();d.setDate(d.getDate()-i);
    labels.push(`${d.getDate()}/${d.getMonth()+1}`);
    const dayTx=filtered.filter(t=>{const td=new Date(t.date);return td.getDate()===d.getDate()&&td.getMonth()===d.getMonth();});
    incomes.push(dayTx.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0));
    expenses.push(dayTx.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0));
  }
  if(chart) chart.destroy();
  chart=new Chart($('chart').getContext('2d'),{
    type:'bar',
    data:{labels,datasets:[{label:'Доходы',data:incomes,backgroundColor:'rgba(48,215,128,0.7)',borderRadius:4},{label:'Расходы',data:expenses,backgroundColor:'rgba(255,77,106,0.7)',borderRadius:4}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'rgba(255,255,255,0.4)',font:{size:11}}}},scales:{x:{ticks:{color:'rgba(255,255,255,0.35)',font:{size:10}},grid:{color:'rgba(255,255,255,0.06)'}},y:{ticks:{color:'rgba(255,255,255,0.35)',font:{size:10}},grid:{color:'rgba(255,255,255,0.06)'}}}},
  });
}
document.querySelectorAll('.period-btn').forEach(btn=>btn.addEventListener('click',()=>{statsPeriod=btn.dataset.period;document.querySelectorAll('.period-btn').forEach(b=>b.classList.toggle('active',b===btn));renderStats();}));

// ── Редактирование транзакции ─────────────────────────────────────────────────
const editSheet = $('edit-sheet');

function openEditSheet(tx) {
  vibrate(8);
  editingTxId  = tx.id;
  editType     = tx.type;
  editCat      = tx.cat;
  editNumpadVal= String(tx.amount);

  // Тип
  document.querySelectorAll('.type-btn[data-etype]').forEach(btn=>{
    btn.className=btn.dataset.etype===editType?`type-btn active ${editType}`:'type-btn';
  });
  updateDisplay('edit-numpad-display', editNumpadVal);
  renderEditCategories();
  $('edit-note-input').value = tx.note||'';

  overlay.classList.add('open');
  editSheet.classList.add('open');
}
function closeEditSheet() {
  overlay.classList.remove('open');
  editSheet.classList.remove('open');
  editingTxId=null;
}
overlay.addEventListener('click', closeEditSheet);

document.querySelectorAll('.type-btn[data-etype]').forEach(btn=>{
  btn.addEventListener('click',()=>{
    editType=btn.dataset.etype;
    document.querySelectorAll('.type-btn[data-etype]').forEach(b=>{b.className=b.dataset.etype===editType?`type-btn active ${editType}`:'type-btn';});
    renderEditCategories();
  });
});

document.querySelectorAll('#edit-numpad .numpad-key').forEach(key=>{
  key.addEventListener('click',()=>{
    vibrate(4);
    editNumpadVal=numpadPush(editNumpadVal,key.dataset.ekey);
    updateDisplay('edit-numpad-display',editNumpadVal);
  });
});
document.querySelectorAll('#edit-sheet .quick-chips .quick-chip').forEach(chip=>{
  chip.addEventListener('click',()=>{
    vibrate(6);
    const cur=parseFloat(editNumpadVal)||0;
    editNumpadVal=String(cur+parseInt(chip.dataset.eval));
    updateDisplay('edit-numpad-display',editNumpadVal);
  });
});

function renderEditCategories() {
  $('edit-categories-grid').innerHTML=CATEGORIES.map(c=>`
    <button class="cat-btn ${c.id===editCat?'selected':''}" data-eid="${c.id}">
      <span class="cat-emoji">${c.emoji}</span><span class="cat-name">${c.name}</span>
    </button>
  `).join('');
  $('edit-categories-grid').querySelectorAll('.cat-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{ vibrate(4); editCat=btn.dataset.eid; renderEditCategories(); });
  });
}

$('edit-save-btn').addEventListener('click',()=>{
  if(!editingTxId) return;
  const amount=parseFloat(editNumpadVal);
  if(!amount||amount<=0){toast('Введи сумму');return;}
  vibrate([8,40,12]);
  transactions=transactions.map(t=>t.id===editingTxId
    ?{...t,type:editType,amount,cat:editCat,note:$('edit-note-input').value.trim()}
    :t);
  saveTx(transactions);
  closeEditSheet();
  toast('✅ Изменено');
  if(currentScreen==='home')    renderHome();
  if(currentScreen==='history') renderHistory();
  if(currentScreen==='stats')   renderStats();
});

$('edit-del-btn').addEventListener('click',()=>{
  if(!editingTxId) return;
  vibrate(12);
  transactions=transactions.filter(t=>t.id!==editingTxId);
  saveTx(transactions);
  closeEditSheet();
  toast('Удалено');
  if(currentScreen==='home')    renderHome();
  if(currentScreen==='history') renderHistory();
  if(currentScreen==='stats')   renderStats();
});

function attachTxTap(container) {
  container.querySelectorAll('.tx-item').forEach(item=>{
    item.addEventListener('click', e=>{
      if(e.target.closest('.tx-delete-bg')) return;
      const tx=transactions.find(t=>t.id===item.dataset.id);
      if(tx) openEditSheet(tx);
    });
  });
}

// ── Свайп для удаления ────────────────────────────────────────────────────────
function attachSwipe(container) {
  container.querySelectorAll('.tx-item').forEach(item=>{
    const inner=item.querySelector('.tx-item-inner');
    const bg   =item.querySelector('.tx-delete-bg');
    let startX=0,currentX=0,dragging=false;
    item.addEventListener('touchstart',e=>{startX=e.touches[0].clientX;dragging=true;},{passive:true});
    item.addEventListener('touchmove',e=>{
      if(!dragging) return;
      currentX=e.touches[0].clientX-startX;
      if(currentX>0) currentX=0;
      const c=Math.max(currentX,-80);
      inner.style.transform=`translateX(${c}px)`;
      bg.style.opacity=String(Math.min(-c/72,1));
    },{passive:true});
    item.addEventListener('touchend',()=>{
      if(!dragging) return; dragging=false;
      if(currentX<-72){
        inner.style.transform='translateX(-80px)';
        bg.style.opacity='1'; vibrate(12);
        setTimeout(()=>{
          item.style.transition='all 0.22s ease';
          item.style.opacity='0'; item.style.transform='scaleY(0.8)'; item.style.marginBottom='-62px';
          setTimeout(()=>{transactions=transactions.filter(t=>t.id!==item.dataset.id);saveTx(transactions);renderHome();if(currentScreen==='history')renderHistory();},220);
        },180);
      } else { inner.style.transform=''; bg.style.opacity='0'; }
      currentX=0;
    });
  });
}

// ── Вёрстка транзакции ────────────────────────────────────────────────────────
function txHtml(tx) {
  const c=CAT_MAP[tx.cat]||{emoji:'💸',name:tx.cat};
  const sign=tx.type==='income'?'+':'−';
  const bg=tx.type==='income'?'rgba(48,215,128,0.12)':'rgba(255,77,106,0.12)';
  const noteText=tx.note&&tx.note.toLowerCase()!==c.name.toLowerCase()?tx.note:'';
  return `
    <div class="tx-item" data-id="${tx.id}">
      <div class="tx-delete-bg">🗑️</div>
      <div class="tx-item-inner">
        <div class="tx-icon" style="background:${bg}">${c.emoji}</div>
        <div class="tx-info">
          <div class="tx-category">${c.name}${noteText?` · ${noteText}`:''}</div>
          <div class="tx-meta"><span class="tx-date">${fmtTime(tx.date)}</span></div>
        </div>
        <div class="tx-amount ${tx.type}">${sign}${fmt(tx.amount)}</div>
      </div>
    </div>`;
}

// ── Форматирование ────────────────────────────────────────────────────────────
function fmt(n) { return new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:0}).format(n); }
function fmtDate(ts) {
  const d=new Date(ts),today=new Date(),yesterday=new Date();
  yesterday.setDate(yesterday.getDate()-1);
  if(d.toDateString()===today.toDateString()) return 'Сегодня';
  if(d.toDateString()===yesterday.toDateString()) return 'Вчера';
  return d.toLocaleDateString('ru-RU',{day:'numeric',month:'long'});
}
function fmtTime(ts) { return new Date(ts).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'}); }

// ── Toast ──────────────────────────────────────────────────────────────────────
let toastTimer;
function toast(msg) {
  const el=$('toast');
  el.textContent=msg; el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>el.classList.remove('show'),2200);
}

// ── Deep links ────────────────────────────────────────────────────────────────
function handleDeepLink() {
  const action=new URLSearchParams(location.search).get('action');
  if(action==='expense') openAdd('expense');
  else if(action==='income') openAdd('income');
  else showScreen('home');
}

// ── Service Worker ────────────────────────────────────────────────────────────
if('serviceWorker' in navigator) navigator.serviceWorker.register('/finance-app/sw.js').catch(()=>{});

// ── Запуск ────────────────────────────────────────────────────────────────────
applyTheme(currentTheme);
renderThemeCards();
renderCategories();
handleDeepLink();
