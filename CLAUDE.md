# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Деплой и превью

**Локальный превью** (через `.claude/launch.json`, порт 3333):
```bash
python3 -m http.server 3333 --directory /Users/timur/finance-app
```

**Деплой на GitHub Pages** (основной):
```bash
git add . && git commit -m "..." && git push origin main
# → https://timurmingazov06.github.io/finance-app/
```

**Деплой на Vercel** (альтернативный):
```bash
vercel deploy --scope timurmingazov06s-projects
```

No build step — static vanilla JS PWA. После изменений нужно:
1. Инкрементировать `styles.css?v=N` и `app.js?v=N` в `index.html`
2. Инкрементировать `const CACHE = 'finance-vN'` в `sw.js` — иначе PWA на устройствах отдаёт закешированные старые файлы

## Архитектура

Три главных файла, никакого фреймворка:

- **`app.js`** — вся логика: state, render, event handlers
- **`index.html`** — разметка всех экранов сразу. Видимый экран управляется через `showScreen(name)`
- **`styles.css`** — CSS-переменные для тем; тема переключается через `data-theme` на `<html>`
- **`sw.js`** — Service Worker, cache-first стратегия

Экраны: `#screen-home`, `#screen-add`, `#screen-history`, `#screen-stats`.
Все bottom sheets (`theme-sheet`, `edit-sheet`, `cats-sheet`, `newcat-sheet`) объявлены в конце `index.html` и управляются через shared `#sheet-overlay`.

## State (app.js)

Глобальные переменные, сохраняемые в `localStorage`:
- `transactions` — `{ id, type, amount, cat, note, date }`
- `CATEGORIES` — `{ id, emoji, name }`; дефолт `DEFAULT_CATS`
- `currentTheme` — `'dark' | 'glass' | 'midnight'`
- `homePeriod`, `homeOffset`, `customStart`, `customEnd` — фильтр на главном экране
- `addType`, `selectedCat`, `selectedDate` — экран добавления
- `editingTxId`, `editType`, `editCat` — редактирование транзакции

## Ключевые паттерны

- `$(id)` → `document.getElementById(id)`
- `showScreen(name)` — переключает экран + nav highlight + вызывает нужный render
- `openAdd(type)` → заполняет форму, фокусирует `#amount-input`, вызывает `showScreen('add')`
- `saveTx` / `loadTx`, `saveCats` / `loadCats` — сериализация в localStorage
- `fmt(n)` — рубли через `Intl.NumberFormat`
- `toast(msg)` — всплывающее уведомление (2.2 с)
- `vibrate(pattern)` — тактильный отклик

## Ввод суммы

Используется нативный `<input type="text" inputmode="decimal">` (id: `amount-input` на экране добавления, `edit-amount-input` в edit sheet). Кастомный нумпад удалён. При открытии add-экрана инпут получает `.focus()` через `setTimeout(..., 300)` после анимации перехода.

## Темы

Три темы переключаются через `data-theme` на `<html>`:
- `dark` (default) — тёмная, атрибут не выставляется
- `glass` — Liquid Glass, яркий градиентный фон + blur
- `midnight` — AMOLED чёрный

CSS-переменные темы переопределяются в `styles.css` через `[data-theme="glass"]` и `[data-theme="midnight"]`.

## Bottom Sheets

Все листы используют класс `theme-sheet` + `.open`. Z-index: overlay=200, theme-sheet=201, cats-sheet=202 (inline), newcat-sheet=203 (inline). `closeAllSheets()` сбрасывает все сразу.

## Период на главной

`getPeriodDates(period, offset)` → `{ start, end }` timestamps.  
`getPeriodLabel(period, offset)` → строка для отображения.  
При `homePeriod === 'custom'` скрывается `#period-nav`, показывается `#custom-period-row` с двумя `<input type="date">`.
