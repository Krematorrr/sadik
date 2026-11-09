// =========================================================================
// 1. КОНФИГУРАЦИЯ И ЖЕСТКО ЗАШИТЫЕ КЛЮЧИ (CLOUD + TELEGRAM)
// =========================================================================
const HARDCODED_CLOUD = {
  apiKey: '$2a$10$3lkyakUsPN81u2apeDoRQefljytEcqIsM2W8Q8.XB6XQ6AHzlmhO6',
  binId: '6ad15ca5ffd5d160536f384a'
};

const HARDCODED_TELEGRAM = {
  botToken: '8792131173:AAHdFMBq-qlh-uB6pbpGTMUC6HXmM-u04Bw',
  chatId: '340778976, 413769416'
};

let disableAlerts = true; // Блокируем отправку уведомлений до загрузки облака

const STORAGE_KEY = 'kg_tracker_state_v6';
const CLOUD_CONFIG_KEY = 'kg_tracker_cloud_cfg_v1';

// --- БАЗОВЫЕ УТИЛИТЫ ДАТ ---
function toISODate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatHumanDate(isoStr) {
  if (!isoStr) return '—';
  const [y, m, d] = isoStr.split('-');
  return `${d}.${m}.${y}`;
}

function formatShortDate(isoStr) {
  if (!isoStr) return '—';
  const [y, m, d] = isoStr.split('-');
  return `${d}.${m}`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// --- ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ АНАЛИТИКИ ---
let analYear = new Date().getFullYear(), analMonth = new Date().getMonth();
let analFilter = 'all', analPeriodType = 'sub', analSubIndex = null, analEngSubIndex = null;

function changeAnalyticMonth(offset) { const d = new Date(analYear, analMonth + offset, 1); analYear = d.getFullYear(); analMonth = d.getMonth(); render(); }
function changeAnalyticYear(offset) { analYear += offset; render(); }
function changeAnalyticPeriodType(type) { analPeriodType = type; render(); }
function changeAnalyticSub(idx) { analSubIndex = Number(idx); render(); }
function changeAnalyticEngSub(idx) { analEngSubIndex = Number(idx); render(); }
function changeAnalyticFilter(val) { analFilter = val; render(); }

function changeAnalyticMonth(offset) {
  const d = new Date(analYear, analMonth + offset, 1);
  analYear = d.getFullYear();
  analMonth = d.getMonth();
  render();
}

function changeAnalyticYear(offset) {
  analYear += offset;
  render();
}

function changeAnalyticPeriodType(type) {
  analPeriodType = type;
  render();
}

function changeAnalyticCustomDates(start, end) {
  if (start) analCustomStart = start;
  if (end) analCustomEnd = end;
  render();
}

function changeAnalyticFilter(val) {
  analFilter = val;
  render();
}

// =========================================================================
// ТЕМНАЯ ТЕМА (DARK MODE)
// =========================================================================
function toggleTheme() {
  const isDark = document.documentElement.classList.toggle('dark');
  localStorage.setItem('uley_theme', isDark ? 'dark' : 'light');
  updateThemeIcon();

  // Добавляем эту строку, чтобы график перекрасился под новую тему
  if (typeof render === 'function') render();
}

function updateThemeIcon() {
  const isDark = document.documentElement.classList.contains('dark');
  const btn = document.getElementById('themeToggleBtn');
  if (btn) btn.innerHTML = isDark ? '☀️' : '🌙';
  
  const metaTheme = document.getElementById('themeColorMeta');
  if (metaTheme) {
    metaTheme.setAttribute('content', isDark ? '#0f172a' : '#ffffff');
  }
}

document.addEventListener('DOMContentLoaded', updateThemeIcon);

// =========================================================================
// 2. PWA SERVICE WORKER И СИСТЕМНЫЕ PUSH-УВЕДОМЛЕНИЯ
// =========================================================================
let deferredInstallPrompt = null;
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  document.getElementById('pwaInstallBanner')?.classList.remove('hidden');
});

async function installPWA() {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  const { outcome } = await deferredInstallPrompt.userChoice;
  if (outcome === 'accepted') {
    document.getElementById('pwaInstallBanner')?.classList.add('hidden');
  }
  deferredInstallPrompt = null;
}

function updatePushBadge() {
  const badge = document.getElementById('pushPermissionBadge');
  if (!badge) return;
  if (!('Notification' in window)) {
    badge.textContent = 'Не поддерживается';
    badge.className = 'px-2 py-0.5 text-[10px] font-bold rounded bg-rose-100 text-rose-800';
    return;
  }
  if (Notification.permission === 'granted') {
    badge.textContent = '✓ Включены';
    badge.className = 'px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-100 text-emerald-800 border border-emerald-300';
  } else if (Notification.permission === 'denied') {
    badge.textContent = 'Заблокированы';
    badge.className = 'px-2 py-0.5 text-[10px] font-bold rounded bg-rose-100 text-rose-800';
  } else {
    badge.textContent = 'Не активированы';
    badge.className = 'px-2 py-0.5 text-[10px] font-bold rounded bg-amber-100 text-amber-800';
  }
}

async function requestSystemPushPermission() {
  if (!('Notification' in window)) {
    alert('Ваше устройство или браузер не поддерживает системные уведомления.');
    return;
  }
  const perm = await Notification.requestPermission();
  updatePushBadge();
  if (perm === 'granted') {
    triggerSystemPush('Детский клуб «Улей»', '✅ Системные Push-уведомления успешно активированы!');
  } else {
    alert('Разрешение не получено.');
  }
}

async function triggerSystemPush(title, body) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && reg.showNotification) {
        await reg.showNotification(title, {
          body,
          icon: './icon.jpg',
          badge: './icon.jpg',
          vibrate: [200, 100, 200],
          tag: 'uley-push-' + Date.now()
        });
        return;
      }
    }
    new Notification(title, { body, icon: './icon.jpg' });
  } catch (e) {}
}

function sendTestSystemPush() {
  if (Notification.permission !== 'granted') {
    requestSystemPushPermission();
    return;
  }
  const { subStats } = calculateSchedule();
  const engStats = enrichEnglishSubscriptions();
  const activeSub = subStats.find(s => !s.isPast) || subStats[0];
  const activeEng = engStats[engStats.length - 1];

  triggerSystemPush(
    '🐝 Детский клуб «Улей»',
    `Сад (Период #${activeSub?.index || 1}): отхожено ${activeSub?.completedCount || 0}/20 дн.\nАнглийский (#${activeEng?.index || 1}): посещено ${activeEng?.attendedCount || 0}/8, оплачено ${activeEng?.paidLessonsCount || 0}/8.`
  );
}

// =========================================================================
// 3. ИНИЦИАЛИЗАЦИЯ СОСТОЯНИЯ И ДАННЫХ
// =========================================================================
let activeMainTab = 'garden';
let highlightedSubIndex = null;
let expandedMonthsOverride = new Set();

const SUB_THEMES = [
  { name: 'Индиго', cardBorder: 'border-indigo-600', cardBg: 'bg-indigo-50/40 dark:bg-indigo-900/10', badge: 'bg-indigo-600 text-white', cellPlanned: 'bg-indigo-50/80 dark:bg-indigo-900/20 border-indigo-300 dark:border-indigo-700/50 text-indigo-950 dark:text-indigo-200 hover:bg-indigo-100 dark:hover:bg-indigo-900/40', cellBorderAccent: 'border-l-[3px] sm:border-l-4 border-l-indigo-600', dayPill: 'bg-indigo-200/80 dark:bg-indigo-800/80 text-indigo-900 dark:text-indigo-100' },
  { name: 'Океан', cardBorder: 'border-sky-600', cardBg: 'bg-sky-50/40 dark:bg-sky-900/10', badge: 'bg-sky-600 text-white', cellPlanned: 'bg-sky-50/80 dark:bg-sky-900/20 border-sky-300 dark:border-sky-700/50 text-sky-950 dark:text-sky-200 hover:bg-sky-100 dark:hover:bg-sky-900/40', cellBorderAccent: 'border-l-[3px] sm:border-l-4 border-l-sky-600', dayPill: 'bg-sky-200/80 dark:bg-sky-800/80 text-sky-900 dark:text-sky-100' },
  { name: 'Фуксия', cardBorder: 'border-fuchsia-600', cardBg: 'bg-fuchsia-50/40 dark:bg-fuchsia-900/10', badge: 'bg-fuchsia-600 text-white', cellPlanned: 'bg-fuchsia-50/80 dark:bg-fuchsia-900/20 border-fuchsia-300 dark:border-fuchsia-700/50 text-fuchsia-950 dark:text-fuchsia-200 hover:bg-fuchsia-100 dark:hover:bg-fuchsia-900/40', cellBorderAccent: 'border-l-[3px] sm:border-l-4 border-l-fuchsia-600', dayPill: 'bg-fuchsia-200/80 dark:bg-fuchsia-800/80 text-fuchsia-900 dark:text-fuchsia-100' },
  { name: 'Фиолет', cardBorder: 'border-violet-600', cardBg: 'bg-violet-50/40 dark:bg-violet-900/10', badge: 'bg-violet-600 text-white', cellPlanned: 'bg-violet-50/80 dark:bg-violet-900/20 border-violet-300 dark:border-violet-700/50 text-violet-950 dark:text-violet-200 hover:bg-violet-100 dark:hover:bg-violet-900/40', cellBorderAccent: 'border-l-[3px] sm:border-l-4 border-l-violet-600', dayPill: 'bg-violet-200/80 dark:bg-violet-800/80 text-violet-900 dark:text-violet-100' }
];

const defaultEnglishData = {
  defaultPrice: 5600,
  lessonsPerSub: 8,
  hidePastPeriods: false,
  subscriptions: [
    {
      id: 1,
      price: 5600,
      isPaid: false,
      hiddenManually: false,
      forceShow: false,
      lessons: [
        { id: 101, date: '2026-10-12', status: 'attended', isPaid: false, note: 'Проведено (Пн)' },
        { id: 102, date: '2026-10-15', status: 'attended', isPaid: false, note: 'Проведено' },
        { id: 103, date: '2026-10-20', status: 'planned', isPaid: false, note: '' },
        { id: 104, date: '2026-10-22', status: 'planned', isPaid: false, note: '' },
        { id: 105, date: '2026-10-27', status: 'planned', isPaid: false, note: '' },
        { id: 106, date: '2026-10-29', status: 'planned', isPaid: false, note: '' },
        { id: 107, date: '2026-11-03', status: 'planned', isPaid: false, note: '' },
        { id: 108, date: '2026-11-05', status: 'planned', isPaid: false, note: '' }
      ]
    }
  ]
};

const defaultState = {
  startDate: '2026-10-05',
  simulatedToday: toISODate(new Date()),
  hidePastPeriods: false,
  hideWeekends: false,
  pastAttendedStyle: 'green',
  defaultPrice: 28800,
  daysPerSub: 20,
  updatedAt: Date.now(),
  extraExpenses: [],
  subscriptions: [
    { id: 1, price: 28800, isPaid: true, hiddenManually: false, forceShow: false },
    { id: 2, price: 28800, isPaid: false, hiddenManually: false, forceShow: false },
    { id: 3, price: 28800, isPaid: false, hiddenManually: false, forceShow: false }
  ],
  exceptions: {
    '2026-10-06': 'missed',
    '2026-10-07': 'missed',
    '2026-10-08': 'missed',
    '2026-10-09': 'missed',
    '2026-11-04': 'holiday',
    '2026-12-31': 'holiday'
  },
  english: JSON.parse(JSON.stringify(defaultEnglishData)),
  telegram: {
    botToken: HARDCODED_TELEGRAM.botToken,
    chatId: HARDCODED_TELEGRAM.chatId,
    sentAlertsLog: {}
  }
};

function ensureDataIntegrity(targetState) {
  if (!targetState.telegram) targetState.telegram = { sentAlertsLog: {} };
  targetState.telegram.botToken = HARDCODED_TELEGRAM.botToken || targetState.telegram.botToken;
  targetState.telegram.chatId = HARDCODED_TELEGRAM.chatId || targetState.telegram.chatId;
  if (!targetState.telegram.sentAlertsLog) targetState.telegram.sentAlertsLog = {};

  if (!Array.isArray(targetState.extraExpenses)) targetState.extraExpenses = [];

  if (Array.isArray(targetState.subscriptions)) {
    const usedIds = new Set();
    targetState.subscriptions.forEach((sub, idx) => {
      const numId = Number(sub.id);
      if (!numId || numId > 100000 || usedIds.has(numId)) {
        sub.id = idx + 1;
        while (usedIds.has(sub.id)) sub.id++;
      }
      usedIds.add(sub.id);
    });
  }

  if (!targetState.english || !Array.isArray(targetState.english.subscriptions)) {
    targetState.english = JSON.parse(JSON.stringify(defaultEnglishData));
  } else {
    if (typeof targetState.english.hidePastPeriods !== 'boolean') {
      targetState.english.hidePastPeriods = false;
    }
    targetState.english.subscriptions.forEach(sub => {
      if (typeof sub.hiddenManually !== 'boolean') sub.hiddenManually = false;
      if (typeof sub.forceShow !== 'boolean') sub.forceShow = false;
      if (Array.isArray(sub.lessons)) {
        sub.lessons.forEach(l => {
          if (typeof l.isPaid !== 'boolean') {
            l.isPaid = Boolean(sub.isPaid && l.status !== 'canceled');
          }
        });
      }
    });
  }
  return targetState;
}

let state = loadState();
let cloudConfig = loadCloudConfig();
state.simulatedToday = toISODate(new Date());

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('kg_tracker_state_v5') || localStorage.getItem('kg_tracker_state_v4');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      return ensureDataIntegrity({ ...defaultState, ...parsed });
    } catch (e) {}
  }
  return ensureDataIntegrity(JSON.parse(JSON.stringify(defaultState)));
}

function loadCloudConfig() {
  const saved = localStorage.getItem(CLOUD_CONFIG_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed.apiKey && parsed.binId) return parsed;
    } catch (e) {}
  }
  return { ...HARDCODED_CLOUD };
}

let cloudPushTimeout = null;

async function saveState(skipCloudPush = false) {
  ensureDataIntegrity(state);
  state.updatedAt = Date.now();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  
  if (!skipCloudPush && cloudConfig.apiKey && cloudConfig.binId) {
    updateCloudBadge('☁️ Ожидание...', true);
    clearTimeout(cloudPushTimeout);
    cloudPushTimeout = setTimeout(() => {
      pushToCloud(true);
    }, 1500);
  }
  render();
}

function switchMainTab(tab) {
  activeMainTab = tab;
  const sections = ['garden', 'english', 'analytics', 'settings'];

  sections.forEach(s => {
    const el = document.getElementById(s + 'Section');
    if (el) el.classList.toggle('hidden', s !== tab);
  });

  const titles = { 
    garden: '🐝 Детский сад', 
    english: '🎓 Английский язык', 
    analytics: '📊 Аналитика и Финансы', 
    settings: '⚙️ Настройки' 
  };
  const headerTitle = document.getElementById('headerTitle');
  if (headerTitle) headerTitle.textContent = titles[tab] || 'Улей';

  sections.forEach(s => {
    const isAct = (s === tab);
    
    // Десктопное меню
    const deskBtn = document.getElementById('deskNav-' + s);
    if (deskBtn) {
      deskBtn.className = `flex items-center gap-3 w-full px-4 py-3 rounded-xl font-bold text-sm transition ${isAct ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'}`;
      if (s === 'english') { deskBtn.className = deskBtn.className.replace('gap-3', 'justify-between'); }
    }

    // Мобильное меню (Pill-дизайн)
    const mobBg = document.getElementById('mobNavBg-' + s);
    const mobText = document.getElementById('mobNavText-' + s);
    if (mobBg && mobText) {
      mobBg.className = `px-4 py-1 rounded-2xl transition-colors flex items-center justify-center relative ${isAct ? 'bg-indigo-100 dark:bg-indigo-900/40' : 'bg-transparent'}`;
      mobText.className = `text-[10px] font-bold transition-colors mt-1 ${isAct ? 'text-indigo-700 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'}`;
    }
  });

  // Мгновенно переключаем плашку под открытую вкладку
  updateMainBanner();
}

// =========================================================================
// 4. ЛОГИКА РАЗДЕЛА «АНГЛИЙСКИЙ ЯЗЫК»
// =========================================================================
const WEEKDAY_NAMES_FULL = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
const WEEKDAY_NAMES_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

function getWeekdayName(isoStr, short = false) {
  if (!isoStr) return '—';
  const d = new Date(isoStr + 'T00:00:00');
  return short ? WEEKDAY_NAMES_SHORT[d.getDay()] : WEEKDAY_NAMES_FULL[d.getDay()];
}

function getNextTueThuDate(afterIsoStr) {
  let d = new Date(afterIsoStr + 'T00:00:00');
  let safety = 0;
  while (safety < 100) {
    safety++;
    d.setDate(d.getDate() + 1);
    const iso = toISODate(d);
    const day = d.getDay();
    const isHoliday = state.exceptions[iso] === 'holiday';
    if ((day === 2 || day === 4) && !isHoliday) {
      return iso;
    }
  }
  return afterIsoStr;
}

function enrichEnglishSubscriptions() {
  const targetCount = state.english.lessonsPerSub || 8;
  return state.english.subscriptions.map((sub, sIdx) => {
    sub.lessons.sort((a, b) => a.date.localeCompare(b.date));
    let activeNumber = 0;
    let attendedCount = 0;
    let paidLessonsCount = 0;
    let canceledCount = 0;
    let activeDates = [];

    const unitPrice = Math.round((sub.price || 5600) / targetCount);

    const enrichedLessons = sub.lessons.map(lesson => {
      const effectiveCompleted = (lesson.status === 'attended') || (lesson.status === 'planned' && lesson.date <= state.simulatedToday);

      if (lesson.status === 'canceled') {
        canceledCount++;
        return { ...lesson, lessonNumber: null, effectiveCompleted: false, unitPrice: 0 };
      } else {
        activeNumber++;
        activeDates.push(lesson.date);
        if (effectiveCompleted) attendedCount++;
        if (lesson.isPaid) paidLessonsCount++;
        return { ...lesson, lessonNumber: activeNumber, effectiveCompleted, unitPrice };
      }
    });

    const startDate = activeDates.length > 0 ? activeDates[0] : (sub.lessons[0]?.date || null);
    const endDate = activeDates.length > 0 ? activeDates[activeDates.length - 1] : null;
    const remainingCount = Math.max(0, targetCount - attendedCount);

    const totalSubPrice = sub.price || 5600;
    const isFullyPaid = paidLessonsCount >= activeNumber && activeNumber > 0;
    const paidAmount = isFullyPaid ? totalSubPrice : Math.min(totalSubPrice, paidLessonsCount * unitPrice);
    const remainingToPay = Math.max(0, totalSubPrice - paidAmount);

    const isPast = (remainingCount === 0) && endDate && (endDate < state.simulatedToday);

    return {
      ...sub, index: sIdx + 1, startDate, endDate, attendedCount, paidLessonsCount, paidAmount,
      remainingToPay, isFullyPaid, unitPrice, canceledCount, remainingCount, activeTotal: activeNumber,
      isPast, enrichedLessons
    };
  });
}

function isEngSubCurrentlyHidden(es) {
  if (es.hiddenManually) return true;
  if (state.english.hidePastPeriods && es.isPast && !es.forceShow) return true;
  return false;
}

function toggleEngHidePast(checked) {
  state.english.hidePastPeriods = checked;
  if (checked) state.english.subscriptions.forEach(s => s.forceShow = false);
  saveState();
}

function hideEngSubscription(subId, event) {
  if (event) event.stopPropagation();
  const sub = state.english.subscriptions.find(s => s.id === subId);
  if (sub) {
    sub.hiddenManually = true;
    sub.forceShow = false;
    saveState();
  }
}

function restoreSingleEngSubscription(subId) {
  const sub = state.english.subscriptions.find(s => s.id === subId);
  if (sub) {
    sub.hiddenManually = false;
    sub.forceShow = true;
    saveState();
    renderEngHiddenModalList();
  }
}

function openEngHiddenModal() {
  renderEngHiddenModalList();
  document.getElementById('engHiddenModal').classList.remove('hidden');
  document.getElementById('engHiddenModal').classList.add('flex');
}

function closeEngHiddenModal() {
  document.getElementById('engHiddenModal').classList.add('hidden');
  document.getElementById('engHiddenModal').classList.remove('flex');
}

function renderEngHiddenModalList() {
  const engStats = enrichEnglishSubscriptions();
  const hiddenSubs = engStats.filter(es => isEngSubCurrentlyHidden(es));
  const container = document.getElementById('engHiddenSubsList');

  if (hiddenSubs.length === 0) {
    container.innerHTML = `<div class="p-4 text-center text-xs text-slate-400 font-medium bg-slate-50 dark:bg-slate-800 rounded-xl">Нет скрытых абонементов английского.</div>`;
    return;
  }

  container.innerHTML = hiddenSubs.map(es => `
    <div class="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
      <div>
        <div class="flex flex-wrap items-center gap-2">
          <span class="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded bg-blue-600 text-white">Абонемент #${es.index}</span>
          <span class="text-xs font-extrabold text-slate-900 dark:text-white">${formatHumanDate(es.startDate)} — ${formatHumanDate(es.endDate)}</span>
        </div>
        <div class="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
          Посещено: <b>${es.attendedCount}/${es.activeTotal}</b> • Долг к доплате: <b>${es.remainingToPay.toLocaleString('ru-RU')} ₽</b>
        </div>
      </div>
      <div class="flex items-center gap-1.5 shrink-0 w-full sm:w-auto justify-end">
        <button onclick="restoreSingleEngSubscription(${es.id})" class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg shadow-sm transition">
          👁 Открыть
        </button>
        <button onclick="deleteEngSubscription(${es.id}, ${es.index})" class="px-2.5 py-1.5 bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50 text-xs font-bold rounded-lg">
          🗑
        </button>
      </div>
    </div>
  `).join('');
}

function showAllEngHiddenSubs() {
  state.english.hidePastPeriods = false;
  state.english.subscriptions.forEach(s => {
    s.hiddenManually = false;
    s.forceShow = false;
  });
  closeEngHiddenModal();
  saveState();
}

function toggleEngLessonPaid(subId, lessonId) {
  const sub = state.english.subscriptions.find(s => s.id === subId);
  if (!sub) return;
  const lesson = sub.lessons.find(l => l.id === lessonId);
  if (!lesson || lesson.status === 'canceled') return;

  lesson.isPaid = !lesson.isPaid;
  const activeLessons = sub.lessons.filter(l => l.status !== 'canceled');
  sub.isPaid = activeLessons.length > 0 && activeLessons.every(l => l.isPaid);
  saveState();
}

function toggleEngSubPaidAll(subId) {
  const sub = state.english.subscriptions.find(s => s.id === subId);
  if (!sub) return;
  const activeLessons = sub.lessons.filter(l => l.status !== 'canceled');
  const allPaid = activeLessons.length > 0 && activeLessons.every(l => l.isPaid);
  const nextState = !allPaid;

  sub.lessons.forEach(l => {
    if (l.status !== 'canceled') l.isPaid = nextState;
  });
  sub.isPaid = nextState;
  saveState();
}

function toggleEngLessonCancel(subId, lessonId) {
  const sub = state.english.subscriptions.find(s => s.id === subId);
  if (!sub) return;
  const lesson = sub.lessons.find(l => l.id === lessonId);
  if (!lesson) return;

  const targetCount = state.english.lessonsPerSub || 8;

  if (lesson.status !== 'canceled') {
    const wasPaid = Boolean(lesson.isPaid);
    lesson.status = 'canceled';
    lesson.isPaid = false;
    if (!lesson.note) lesson.note = 'Перенос (+1 занятие)';

    const activeCount = sub.lessons.filter(l => l.status !== 'canceled').length;
    if (activeCount < targetCount) {
      const lastDate = sub.lessons.reduce((max, l) => (l.date > max ? l.date : max), lesson.date);
      const nextDate = getNextTueThuDate(lastDate);
      sub.lessons.push({
        id: Date.now() + Math.floor(Math.random() * 1000),
        date: nextDate,
        status: 'planned',
        isPaid: wasPaid,
        note: wasPaid ? 'Добавлено взамен пропуска (оплата перенесена)' : 'Добавлено взамен пропуска'
      });
    }
  } else {
    lesson.status = (lesson.date <= state.simulatedToday) ? 'attended' : 'planned';
    if (lesson.note === 'Перенос (+1 занятие)') lesson.note = '';

    const activeLessons = sub.lessons.filter(l => l.status !== 'canceled');
    if (activeLessons.length > targetCount) {
      const lastAddedIdx = sub.lessons.map(l => (l.note || '').includes('Добавлено взамен')).lastIndexOf(true);
      if (lastAddedIdx !== -1) {
        const removed = sub.lessons.splice(lastAddedIdx, 1)[0];
        if (removed && removed.isPaid) lesson.isPaid = true;
      }
    }
  }
  saveState();
}

function toggleEngLessonAttended(subId, lessonId) {
  const sub = state.english.subscriptions.find(s => s.id === subId);
  if (!sub) return;
  const lesson = sub.lessons.find(l => l.id === lessonId);
  if (!lesson || lesson.status === 'canceled') return;

  const isCurrentlyDone = (lesson.status === 'attended') || (lesson.status === 'planned' && lesson.date <= state.simulatedToday);
  if (isCurrentlyDone) {
    lesson.status = 'unvisited_override';
  } else {
    lesson.status = 'attended';
  }
  saveState();
}

function changeEngLessonDate(subId, lessonId, newDate) {
  if (!newDate) return;
  const sub = state.english.subscriptions.find(s => s.id === subId);
  if (!sub) return;
  const lesson = sub.lessons.find(l => l.id === lessonId);
  if (lesson) {
    lesson.date = newDate;
    saveState();
  }
}

function changeEngLessonNote(subId, lessonId, newNote) {
  const sub = state.english.subscriptions.find(s => s.id === subId);
  if (!sub) return;
  const lesson = sub.lessons.find(l => l.id === lessonId);
  if (lesson) {
    lesson.note = newNote;
    saveState();
  }
}

function deleteEngLessonRow(subId, lessonId) {
  const sub = state.english.subscriptions.find(s => s.id === subId);
  if (!sub) return;
  if (sub.lessons.length <= 1) return;
  sub.lessons = sub.lessons.filter(l => l.id !== lessonId);
  saveState();
}

function addManualEngLessonRow(subId) {
  const sub = state.english.subscriptions.find(s => s.id === subId);
  if (!sub) return;
  const lastDate = sub.lessons.reduce((max, l) => (l.date > max ? l.date : max), state.simulatedToday);
  const nextDate = getNextTueThuDate(lastDate);
  sub.lessons.push({
    id: Date.now(),
    date: nextDate,
    status: 'planned',
    isPaid: false,
    note: ''
  });
  saveState();
}

function addEnglishSubscription() {
  const subs = state.english.subscriptions;
  const nextId = subs.length > 0 ? Math.max(...subs.map(s => s.id)) + 1 : 1;
  const targetCount = state.english.lessonsPerSub || 8;

  let lastDate = state.simulatedToday;
  if (subs.length > 0) {
    const lastSub = subs[subs.length - 1];
    lastDate = lastSub.lessons.reduce((max, l) => (l.date > max ? l.date : max), lastDate);
  }

  const newLessons = [];
  let curDate = lastDate;
  for (let i = 0; i < targetCount; i++) {
    curDate = getNextTueThuDate(curDate);
    newLessons.push({
      id: Date.now() + i,
      date: curDate,
      status: 'planned',
      isPaid: false,
      note: ''
    });
  }

  subs.push({
    id: nextId,
    price: state.english.defaultPrice || 5600,
    isPaid: false,
    hiddenManually: false,
    forceShow: false,
    lessons: newLessons
  });
  saveState();
}

function updateEngSubPrice(subId, val) {
  const sub = state.english.subscriptions.find(s => s.id === subId);
  if (sub) {
    sub.price = Number(val) || 0;
    saveState();
  }
}

function deleteEngSubscription(subId, idx) {
  if (state.english.subscriptions.length <= 1) {
    alert('Нельзя удалить единственный абонемент английского.');
    return;
  }
  if (confirm(`Удалить Абонемент английского #${idx}?`)) {
    state.english.subscriptions = state.english.subscriptions.filter(s => s.id !== subId);
    saveState();
    renderEngHiddenModalList();
  }
}

function updateEngBasePrice(val) {
  const price = Number(val) || 5600;
  state.english.defaultPrice = price;
  state.english.subscriptions.forEach(s => { if (!s.isPaid) s.price = price; });
  saveState();
}

// =========================================================================
// 5. ЛОГИКА ДОПОЛНИТЕЛЬНЫХ РАСХОДОВ (БАНКОВСКАЯ МОДЕЛЬ)
// =========================================================================
let editingExpenseId = null;

function openExtraExpensesModal() {
  document.getElementById('newExpDate').value = state.simulatedToday;
  document.getElementById('newExpNote').value = '';
  document.getElementById('newExpAmount').value = '';

  document.getElementById('extraExpensesModal').classList.remove('hidden');
  document.getElementById('extraExpensesModal').classList.add('flex');
}

function closeExtraExpensesModal() {
  document.getElementById('extraExpensesModal').classList.add('hidden');
  document.getElementById('extraExpensesModal').classList.remove('flex');
}

function addExtraExpense() {
  const date = document.getElementById('newExpDate').value || state.simulatedToday;
  const note = document.getElementById('newExpNote').value.trim();
  const amount = Number(document.getElementById('newExpAmount').value) || 0;

  if (amount <= 0) {
    alert('Пожалуйста, введите сумму больше нуля.');
    return;
  }

  state.extraExpenses.push({
    id: Date.now(),
    date: date,
    amount: amount,
    note: note
  });

  state.extraExpenses.sort((a, b) => b.date.localeCompare(a.date));
  saveState();
  closeExtraExpensesModal();
}

function openEditExpenseModal(id) {
  const exp = state.extraExpenses.find(e => e.id === id);
  if (!exp) return;

  editingExpenseId = id;
  document.getElementById('editExpDate').value = exp.date;
  document.getElementById('editExpNote').value = exp.note;
  document.getElementById('editExpAmount').value = exp.amount;

  document.getElementById('editExpenseModal').classList.remove('hidden');
  document.getElementById('editExpenseModal').classList.add('flex');
}

function closeEditExpenseModal() {
  editingExpenseId = null;
  document.getElementById('editExpenseModal').classList.add('hidden');
  document.getElementById('editExpenseModal').classList.remove('flex');
}

function saveEditedExpense() {
  if (!editingExpenseId) return;
  const exp = state.extraExpenses.find(e => e.id === editingExpenseId);
  if (exp) {
    exp.date = document.getElementById('editExpDate').value || state.simulatedToday;
    exp.note = document.getElementById('editExpNote').value.trim();
    exp.amount = Number(document.getElementById('editExpAmount').value) || 0;

    state.extraExpenses.sort((a, b) => b.date.localeCompare(a.date));
    saveState();
  }
  closeEditExpenseModal();
}

function deleteExpenseFromEdit() {
  if (!editingExpenseId) return;
  if (confirm('Удалить эту запись расходов?')) {
    state.extraExpenses = state.extraExpenses.filter(e => e.id !== editingExpenseId);
    saveState();
    closeEditExpenseModal();
  }
}

// =========================================================================
// 6. АНАЛИТИКА И ФИНАНСЫ (КОНТЕКСТНЫЙ УЧЕТ + DUAL PROGRESS)
// =========================================================================
function renderAnalytics(subStats, engStats, dayMap) {
  const container = document.getElementById('analyticsContainer');
  if (!container) return;

  // Инициализация активных индексов по умолчанию
  if (analSubIndex === null && subStats.length > 0) {
    const activeSub = subStats.find(s => !s.isPast) || subStats[subStats.length - 1];
    analSubIndex = activeSub.index;
  }
  if (analEngSubIndex === null && engStats.length > 0) {
    const activeEng = engStats.find(s => s.remainingCount > 0) || engStats[engStats.length - 1];
    analEngSubIndex = activeEng.index;
  }

  let dateStart = '2000-01-01', dateEnd = '2100-12-31', periodLabel = '';
  const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

  // Определение временных границ
  let targetGardenSub = null;
  let targetEngSub = null;

  if (analPeriodType === 'sub') {
    if (analFilter === 'english') {
      targetEngSub = engStats.find(s => s.index === analEngSubIndex) || engStats[engStats.length - 1];
      if (targetEngSub) {
        dateStart = targetEngSub.startDate || '2000-01-01';
        dateEnd = targetEngSub.endDate || '2100-12-31';
        periodLabel = `Абонемент #${targetEngSub.index} EN`;
      }
    } else {
      targetGardenSub = subStats.find(s => s.index === analSubIndex) || subStats[subStats.length - 1];
      if (targetGardenSub) {
        dateStart = targetGardenSub.startDate || '2000-01-01';
        dateEnd = targetGardenSub.endDate || '2100-12-31';
        periodLabel = `Период #${targetGardenSub.index} Сада`;
      }
    }
  } else if (analPeriodType === 'month') { 
    const lastDay = new Date(analYear, analMonth + 1, 0).getDate(); 
    dateStart = `${analYear}-${String(analMonth + 1).padStart(2, '0')}-01`; 
    dateEnd = `${analYear}-${String(analMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`; 
    periodLabel = `${monthNames[analMonth]} ${analYear}`; 
  } else if (analPeriodType === 'year') { 
    dateStart = `${analYear}-01-01`; 
    dateEnd = `${analYear}-12-31`; 
    periodLabel = `${analYear} год`; 
  } else { 
    periodLabel = 'За всё время'; 
  }

  // Расчет данных Сада
  const gardenDayPrice = Math.round(state.defaultPrice / state.daysPerSub) || 0;
  let gardenPaid = 0, gardenDebt = 0, gAttended = 0, gMissed = 0, gHoliday = 0;

  if (analPeriodType === 'sub' && targetGardenSub && analFilter !== 'english') {
    gardenPaid = targetGardenSub.isPaid ? targetGardenSub.price : 0;
    gardenDebt = targetGardenSub.isPaid ? 0 : targetGardenSub.price;
    gAttended = targetGardenSub.completedCount;
    gMissed = targetGardenSub.missedCount;
    gHoliday = targetGardenSub.holidayDates ? targetGardenSub.holidayDates.length : 0;
  } else {
    const filteredSubs = subStats.filter(s => s.startDate >= dateStart && s.startDate <= dateEnd);
    gardenPaid = filteredSubs.filter(s => s.isPaid).reduce((sum, s) => sum + s.price, 0);
    gardenDebt = filteredSubs.filter(s => !s.isPaid).reduce((sum, s) => sum + s.price, 0);
    
    Object.keys(dayMap).sort().forEach(iso => {
      const item = dayMap[iso];
      if (iso > state.simulatedToday || iso < state.startDate) return;
      if (iso >= dateStart && iso <= dateEnd) {
        if (item.status === 'attended' && item.isCompletedVisit) gAttended++;
        else if (item.status === 'missed') gMissed++;
        else if (item.status === 'holiday') gHoliday++;
      }
    });
  }

  // Расчет данных Английского
  const engLessonPrice = engStats[0]?.unitPrice || 700;
  let engPaid = 0, engDebt = 0, eAttended = 0, eCanceled = 0, ePaidCount = 0, eTotalLessons = 8;

  if (analPeriodType === 'sub' && analFilter === 'english' && targetEngSub) {
    engPaid = targetEngSub.paidAmount;
    engDebt = targetEngSub.remainingToPay;
    eAttended = targetEngSub.attendedCount;
    eCanceled = targetEngSub.canceledCount;
    ePaidCount = targetEngSub.paidLessonsCount;
    eTotalLessons = targetEngSub.activeTotal || 8;
  } else {
    engStats.forEach(es => {
      es.enrichedLessons.forEach(l => {
        if (l.date >= dateStart && l.date <= dateEnd) {
          if (l.effectiveCompleted) eAttended++;
          if (l.status === 'canceled') eCanceled++;
          if (l.isPaid && l.status !== 'canceled') {
            engPaid += l.unitPrice;
            ePaidCount++;
          }
        }
      });
    });
    const filteredEng = engStats.filter(s => s.startDate >= dateStart && s.startDate <= dateEnd);
    engDebt = filteredEng.reduce((sum, s) => sum + s.remainingToPay, 0);
  }

  // Дополнительные расходы
  const filteredExtra = (state.extraExpenses || []).filter(e => e.date >= dateStart && e.date <= dateEnd);
  const extraTotal = filteredExtra.reduce((sum, e) => sum + e.amount, 0);

  // Стрик без пропусков (для сада)
  let currentStreak = 0, maxStreak = 0;
  Object.keys(dayMap).sort().forEach(iso => {
    const item = dayMap[iso];
    if (iso > state.simulatedToday || iso < state.startDate) return;
    if (item.status === 'attended' && item.isCompletedVisit) {
      currentStreak++;
      if (currentStreak > maxStreak) maxStreak = currentStreak;
    } else if (item.status === 'missed') {
      currentStreak = 0;
    }
  });

  // Эффективная стоимость визита (историческая)
  const totalGPaid = subStats.filter(s => s.isPaid).reduce((sum, s) => sum + s.price, 0);
  const totalGAttended = subStats.reduce((sum, s) => sum + s.completedCount, 0);
  const globalGardenEffCost = totalGAttended > 0 ? Math.round(totalGPaid / totalGAttended) : 0;
  
  const totalEPaid = engStats.reduce((sum, s) => sum + s.paidAmount, 0);
  const totalEAttended = engStats.reduce((sum, s) => sum + s.attendedCount, 0);
  const globalEngEffCost = totalEAttended > 0 ? Math.round(totalEPaid / totalEAttended) : 0;

  // Итоговые показатели в зависимости от фильтра
  let showPaid = 0, showDebt = 0, showSaved = 0, showEffCost = 0, effLabel = '';
  const gardenSaved = gMissed * gardenDayPrice;
  const engSaved = eCanceled * engLessonPrice;

  if (analFilter === 'garden') {
    showPaid = gardenPaid + extraTotal;
    showDebt = gardenDebt;
    showSaved = gardenSaved;
    showEffCost = globalGardenEffCost;
    effLabel = 'за 1 визит сада (ист.)';
  } else if (analFilter === 'english') {
    showPaid = engPaid;
    showDebt = engDebt;
    showSaved = engSaved;
    showEffCost = globalEngEffCost;
    effLabel = 'за 1 урок англ. (ист.)';
  } else {
    showPaid = gardenPaid + engPaid + extraTotal;
    showDebt = gardenDebt + engDebt;
    showSaved = gardenSaved + engSaved;
    const combinedVisits = totalGAttended + totalEAttended;
    showEffCost = combinedVisits > 0 ? Math.round((totalGPaid + totalEPaid) / combinedVisits) : 0;
    effLabel = 'средняя за любой визит';
  }

  // Расчет процентов прогресса
  const gTarget = state.daysPerSub || 20;
  const gRate = Math.min(100, Math.round((gAttended / gTarget) * 100));
  const eRate = Math.min(100, Math.round((eAttended / (eTotalLessons || 8)) * 100));

  // Кнопки управления периодом
  const btnBase = "flex-1 lg:flex-none px-2.5 sm:px-3 py-1.5 text-center transition-colors rounded-lg cursor-pointer font-bold";
  const btnAct = `${btnBase} bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-400 shadow-sm`;
  const btnInact = `${btnBase} text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white`;

  let dateControlsHtml = '';
  if (analPeriodType === 'sub') {
    if (analFilter === 'english') {
      const optionsHtml = engStats.map(s => `
        <option value="${s.index}" class="bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold" ${s.index === analEngSubIndex ? 'selected' : ''}>
          Абонемент #${s.index} (${formatShortDate(s.startDate)} - ${formatShortDate(s.endDate)})
        </option>
      `).reverse().join('');
      dateControlsHtml = `<select onchange="changeAnalyticEngSub(this.value)" class="bg-transparent text-[11px] sm:text-xs font-bold text-slate-700 dark:text-slate-200 outline-none w-full text-center cursor-pointer">${optionsHtml}</select>`;
    } else {
      const optionsHtml = subStats.map(s => `
        <option value="${s.index}" class="bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold" ${s.index === analSubIndex ? 'selected' : ''}>
          Период #${s.index} (${formatShortDate(s.startDate)} - ${formatShortDate(s.endDate)})
        </option>
      `).reverse().join('');
      dateControlsHtml = `<select onchange="changeAnalyticSub(this.value)" class="bg-transparent text-[11px] sm:text-xs font-bold text-slate-700 dark:text-slate-200 outline-none w-full text-center cursor-pointer">${optionsHtml}</select>`;
    }
  } else if (analPeriodType === 'month') { 
    dateControlsHtml = `
      <button onclick="changeAnalyticMonth(-1)" class="p-1 text-slate-400 hover:text-indigo-500"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"></path></svg></button>
      <span class="text-xs font-black text-slate-700 dark:text-slate-200 min-w-[105px] text-center">${periodLabel}</span>
      <button onclick="changeAnalyticMonth(1)" class="p-1 text-slate-400 hover:text-indigo-500"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7"></path></svg></button>
    `; 
  } else if (analPeriodType === 'year') { 
    dateControlsHtml = `
      <button onclick="changeAnalyticYear(-1)" class="p-1 text-slate-400 hover:text-indigo-500"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"></path></svg></button>
      <span class="text-xs font-black text-slate-700 dark:text-slate-200 min-w-[90px] text-center">${periodLabel}</span>
      <button onclick="changeAnalyticYear(1)" class="p-1 text-slate-400 hover:text-indigo-500"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7"></path></svg></button>
    `; 
  } else { 
    dateControlsHtml = `<span class="text-xs font-black text-slate-500 dark:text-slate-400 text-center w-full block px-2">За всё время</span>`; 
  }

  // Карточка 5: Рекорд серии (для Сада/Всех) или Поурочная оплата (для Английского)
  let card5Html = '';
  if (analFilter === 'english') {
    card5Html = `
      <div class="col-span-1 bg-white dark:bg-slate-900 p-4 rounded-3xl border border-blue-200/70 dark:border-blue-800/40 shadow-sm flex flex-col justify-between">
        <div>
          <span class="text-[10px] font-bold text-blue-500 uppercase tracking-wider block">Оплата уроков</span>
          <span class="text-lg sm:text-xl font-black text-slate-800 dark:text-white block mt-0.5">💳 ${ePaidCount} / ${eTotalLessons} ур.</span>
        </div>
        <span class="text-[10px] text-slate-400 font-medium pt-1">Внесено: ${engPaid.toLocaleString('ru-RU')} ₽</span>
      </div>
    `;
  } else {
    card5Html = `
      <div class="col-span-1 bg-white dark:bg-slate-900 p-4 rounded-3xl border border-amber-200/70 dark:border-amber-800/40 shadow-sm flex flex-col justify-between">
        <div>
          <span class="text-[10px] font-bold text-amber-500 uppercase tracking-wider block">Рекорд серии</span>
          <span class="text-lg sm:text-xl font-black text-slate-800 dark:text-white block mt-0.5">🔥 ${maxStreak} дн.</span>
        </div>
        <span class="text-[10px] text-slate-400 font-medium pt-1">В саду без пропусков</span>
      </div>
    `;
  }

  // Карточка 6: Посещаемость (Dual Progress для "Все направления", либо профильная)
  let attendanceCardHtml = '';
  if (analFilter === 'all') {
    attendanceCardHtml = `
      <div class="col-span-2 bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
        <h3 class="text-xs font-extrabold text-slate-800 dark:text-slate-200 mb-3 uppercase tracking-wide flex justify-between items-center">
          <span>Посещаемость: ${periodLabel}</span>
          <span class="text-[10px] text-slate-400 font-semibold lowercase">раздельный учет</span>
        </h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 dark:divide-slate-800">
          
          <div class="flex items-center gap-3.5 sm:pr-3">
            <div class="relative w-14 h-14 shrink-0">
              <svg class="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <path class="text-slate-100 dark:text-slate-800" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" stroke-width="4" stroke-dasharray="100, 100" />
                <path class="${gRate >= 75 ? 'text-emerald-500' : (gRate >= 50 ? 'text-amber-500' : 'text-rose-500')}" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" stroke-width="4" stroke-dasharray="${gRate}, 100" />
              </svg>
              <div class="absolute inset-0 flex items-center justify-center">
                <span class="text-[11px] font-black text-slate-700 dark:text-slate-200">${gRate}%</span>
              </div>
            </div>
            <div class="flex-1 space-y-1 text-xs">
              <div class="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">🐝 Детский сад</div>
              <div class="flex justify-between items-center">
                <span class="text-slate-500 dark:text-slate-400 text-[11px]">Отхожено</span>
                <span class="font-black text-slate-800 dark:text-white">${gAttended} / ${gTarget} дн.</span>
              </div>
              <div class="flex justify-between items-center">
                <span class="text-slate-500 dark:text-slate-400 text-[11px]">Пропусков</span>
                <span class="font-bold text-amber-600 dark:text-amber-400">+${gMissed} дн.</span>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-3.5 pt-3 sm:pt-0 sm:pl-3">
            <div class="relative w-14 h-14 shrink-0">
              <svg class="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <path class="text-slate-100 dark:text-slate-800" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" stroke-width="4" stroke-dasharray="100, 100" />
                <path class="text-blue-500" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" stroke-width="4" stroke-dasharray="${eRate}, 100" />
              </svg>
              <div class="absolute inset-0 flex items-center justify-center">
                <span class="text-[11px] font-black text-slate-700 dark:text-slate-200">${eRate}%</span>
              </div>
            </div>
            <div class="flex-1 space-y-1 text-xs">
              <div class="text-[11px] font-bold text-blue-600 dark:text-blue-400">🎓 Английский язык</div>
              <div class="flex justify-between items-center">
                <span class="text-slate-500 dark:text-slate-400 text-[11px]">Проведено</span>
                <span class="font-black text-slate-800 dark:text-white">${eAttended} / ${eTotalLessons} ур.</span>
              </div>
              <div class="flex justify-between items-center">
                <span class="text-slate-500 dark:text-slate-400 text-[11px]">Переносов</span>
                <span class="font-bold text-amber-600 dark:text-amber-400">+${eCanceled} ур.</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    `;
  } else if (analFilter === 'english') {
    attendanceCardHtml = `
      <div class="col-span-2 bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
        <h3 class="text-xs font-extrabold text-slate-800 dark:text-slate-200 mb-3 uppercase tracking-wide">Посещаемость: ${periodLabel}</h3>
        <div class="flex items-center gap-5">
          <div class="relative w-16 h-16 shrink-0">
            <svg class="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              <path class="text-slate-100 dark:text-slate-800" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" stroke-width="4" stroke-dasharray="100, 100" />
              <path class="text-blue-500" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" stroke-width="4" stroke-dasharray="${eRate}, 100" />
            </svg>
            <div class="absolute inset-0 flex items-center justify-center">
              <span class="text-xs font-black text-slate-700 dark:text-slate-200">${eRate}%</span>
            </div>
          </div>
          <div class="flex-1 space-y-1.5 text-xs">
            <div class="flex justify-between items-center">
              <span class="text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-blue-500"></span>Проведено уроков</span>
              <span class="font-black text-slate-800 dark:text-white">${eAttended} из ${eTotalLessons}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-amber-500"></span>Переносов (+1)</span>
              <span class="font-black text-slate-800 dark:text-white">${eCanceled}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-indigo-500"></span>Оплачено уроков</span>
              <span class="font-black text-slate-800 dark:text-white">${ePaidCount} из ${eTotalLessons}</span>
            </div>
          </div>
        </div>
      </div>
    `;
  } else {
    attendanceCardHtml = `
      <div class="col-span-2 bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
        <h3 class="text-xs font-extrabold text-slate-800 dark:text-slate-200 mb-3 uppercase tracking-wide">Посещаемость: ${periodLabel}</h3>
        <div class="flex items-center gap-5">
          <div class="relative w-16 h-16 shrink-0">
            <svg class="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              <path class="text-slate-100 dark:text-slate-800" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" stroke-width="4" stroke-dasharray="100, 100" />
              <path class="${gRate >= 75 ? 'text-emerald-500' : (gRate >= 50 ? 'text-amber-500' : 'text-rose-500')}" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" stroke-width="4" stroke-dasharray="${gRate}, 100" />
            </svg>
            <div class="absolute inset-0 flex items-center justify-center">
              <span class="text-xs font-black text-slate-700 dark:text-slate-200">${gRate}%</span>
            </div>
          </div>
          <div class="flex-1 space-y-1.5 text-xs">
            <div class="flex justify-between items-center">
              <span class="text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-emerald-500"></span>Отхожено в саду</span>
              <span class="font-black text-slate-800 dark:text-white">${gAttended} из ${gTarget}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-amber-500"></span>Пропусков</span>
              <span class="font-black text-slate-800 dark:text-white">${gMissed}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-purple-500"></span>Выходных</span>
              <span class="font-black text-slate-800 dark:text-white">${gHoliday}</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // HTML Графика
  const chartTitle = analFilter === 'english' ? 'Затраты по абонементам английского' : 'Затраты по периодам сада';
  const chartLegendHtml = analFilter === 'english' 
    ? `<span class="flex items-center gap-1 text-slate-600 dark:text-slate-300 font-bold"><span class="w-2 h-2 rounded-full bg-blue-500"></span>Английский</span>`
    : `
      <span class="flex items-center gap-1 text-slate-600 dark:text-slate-300"><span class="w-2 h-2 rounded-full bg-indigo-500"></span>Сад</span>
      <span class="flex items-center gap-1 text-slate-600 dark:text-slate-300"><span class="w-2 h-2 rounded-full bg-blue-500"></span>Англ</span>
      <span class="flex items-center gap-1 text-slate-600 dark:text-slate-300"><span class="w-2 h-2 rounded-full bg-amber-500"></span>Доп</span>
    `;

  const chartHtml = `
    <div class="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm mt-4">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">${chartTitle}</h3>
        <div class="flex gap-2 text-[9px] font-bold">${chartLegendHtml}</div>
      </div>
      <div class="relative w-full h-48 sm:h-56">
        <canvas id="expensesChart"></canvas>
      </div>
    </div>
  `;

  // История доп. расходов
  let historyHtml = '';
  if (filteredExtra.length === 0) { 
    historyHtml = `<div class="p-4 text-center text-xs text-slate-400 font-medium bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm mt-4">В выбранном окне нет разовых доп. расходов.</div>`; 
  } else {
    const listHtml = filteredExtra.map(exp => `
      <div class="flex items-center justify-between p-3.5 sm:p-4 border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition cursor-pointer" onclick="openEditExpenseModal(${exp.id})">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400 text-lg shrink-0 border border-amber-200/50 dark:border-amber-700/50">💸</div>
          <div>
            <div class="text-sm font-bold text-slate-900 dark:text-white">${escapeHtml(exp.note) || 'Доп. расход'}</div>
            <div class="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">${formatHumanDate(exp.date)}</div>
          </div>
        </div>
        <div class="text-sm sm:text-base font-black text-slate-900 dark:text-white">-${exp.amount.toLocaleString('ru-RU')} ₽</div>
      </div>
    `).join('');
    historyHtml = `
      <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden mt-4">
        <div class="flex justify-between items-center bg-slate-50 dark:bg-slate-800/60 px-4 py-3 border-b border-slate-200/60 dark:border-slate-800">
          <h3 class="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">История доп. расходов</h3>
          <button onclick="openExtraExpensesModal()" class="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline">+ Добавить</button>
        </div>
        <div>${listHtml}</div>
      </div>
    `;
  }

  // Сборка полного контейнера
  container.innerHTML = `
    <div class="flex flex-col lg:flex-row items-center justify-between gap-2.5 bg-white dark:bg-slate-900 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
      <select onchange="changeAnalyticFilter(this.value)" class="w-full lg:w-auto bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl px-3 py-2 outline-none cursor-pointer">
        <option value="all" ${analFilter === 'all' ? 'selected' : ''}>📊 Все направления</option>
        <option value="garden" ${analFilter === 'garden' ? 'selected' : ''}>🐝 Только Сад</option>
        <option value="english" ${analFilter === 'english' ? 'selected' : ''}>🎓 Только Английский</option>
      </select>
      <div class="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 w-full lg:w-auto justify-center min-h-[36px]">${dateControlsHtml}</div>
      <div class="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-[10px] sm:text-[11px] w-full lg:w-auto">
        <button onclick="changeAnalyticPeriodType('sub')" class="${analPeriodType === 'sub' ? btnAct : btnInact}">Абонемент</button>
        <button onclick="changeAnalyticPeriodType('month')" class="${analPeriodType === 'month' ? btnAct : btnInact}">Месяц</button>
        <button onclick="changeAnalyticPeriodType('year')" class="${analPeriodType === 'year' ? btnAct : btnInact}">Год</button>
        <button onclick="changeAnalyticPeriodType('all')" class="${analPeriodType === 'all' ? btnAct : btnInact}">Всё время</button>
      </div>
    </div>
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
      <div class="col-span-2 bg-gradient-to-br from-indigo-500 to-purple-600 p-5 rounded-3xl shadow-md text-white flex flex-col justify-between relative overflow-hidden">
        <div class="relative z-10">
          <span class="text-[10px] font-bold text-indigo-100 uppercase tracking-wider block mb-1">Оплачено в этом окне</span>
          <span class="text-3xl sm:text-4xl font-black block">${showPaid.toLocaleString('ru-RU')} ₽</span>
          ${(extraTotal > 0 && analFilter !== 'english') ? `<div class="mt-2 text-[11px] font-semibold text-indigo-100 bg-black/15 inline-block px-2.5 py-1 rounded-lg border border-white/10">В т.ч. доп. расходы: ${extraTotal.toLocaleString('ru-RU')} ₽</div>` : ''}
        </div>
      </div>
      <div class="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-center">
        <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Ожидает оплаты</span>
        <span class="text-2xl font-black ${showDebt > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-800 dark:text-white'} block">${showDebt.toLocaleString('ru-RU')} ₽</span>
        <span class="text-[9px] text-slate-400 mt-1">По всем начатым абонементам</span>
      </div>
      <div class="bg-emerald-50/70 dark:bg-emerald-900/20 p-4 rounded-3xl border border-emerald-200 dark:border-emerald-800/50 shadow-sm flex flex-col justify-center">
        <span class="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block mb-1">Сэкономлено в окне</span>
        <span class="text-2xl font-black text-emerald-700 dark:text-emerald-300 block">+${showSaved.toLocaleString('ru-RU')} ₽</span>
      </div>
      <div class="col-span-1 bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
        <div><span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Реальная цена</span><span class="text-lg sm:text-xl font-black text-slate-800 dark:text-white block mt-0.5">${showEffCost.toLocaleString('ru-RU')} ₽</span></div>
        <span class="text-[10px] text-slate-400 font-medium pt-1">${effLabel}</span>
      </div>
      ${card5Html}
      ${attendanceCardHtml}
    </div>
    ${chartHtml}
    ${historyHtml}
  `;

  drawExpensesChart(subStats, engStats);
}

// Отрисовка интерактивного графика (Chart.js)
function drawExpensesChart(subStats, engStats) {
  const ctx = document.getElementById('expensesChart');
  if (!ctx || typeof Chart === 'undefined') return;

  if (window.analyticsChartInstance) {
    window.analyticsChartInstance.destroy();
  }

  const isDark = document.documentElement.classList.contains('dark');
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';
  const textColor = isDark ? '#94a3b8' : '#64748b';

  let labels = [], datasets = [], currentEntities = [];

  if (analFilter === 'english') {
    // График по абонементам Английского
    const lastEng = engStats.slice(-6);
    currentEntities = lastEng;
    const paidData = [], debtData = [];

    lastEng.forEach(es => {
      const startStr = formatShortDate(es.startDate);
      const endStr = formatShortDate(es.endDate) || '...';
      labels.push([`Абон #${es.index}`, `${startStr} - ${endStr}`]);
      paidData.push(es.paidAmount);
      debtData.push(es.remainingToPay);
    });

    datasets = [
      { label: 'Оплачено', data: paidData, backgroundColor: '#3b82f6', borderRadius: 4, barPercentage: 0.45 },
      { label: 'Долг', data: debtData, backgroundColor: '#f43f5e', borderRadius: 4, barPercentage: 0.45 }
    ];
  } else {
    // График по периодам Сада (со сводным учетом)
    const lastSubs = subStats.filter(s => s.startDate).slice(-6);
    currentEntities = lastSubs;
    const gardenData = [], engData = [], extraData = [];

    lastSubs.forEach(sub => {
      const startStr = formatShortDate(sub.startDate);
      const endStr = formatShortDate(sub.endDate) || '...';
      labels.push([`Пер #${sub.index}`, `${startStr} - ${endStr}`]);
      
      gardenData.push(sub.isPaid ? sub.price : 0);
      
      const ePaid = engStats.filter(es => es.startDate >= sub.startDate && es.startDate <= (sub.endDate || state.simulatedToday)).reduce((sum, es) => sum + es.paidAmount, 0);
      engData.push(ePaid);
      
      const exPaid = state.extraExpenses.filter(e => e.date >= sub.startDate && e.date <= (sub.endDate || state.simulatedToday)).reduce((sum, e) => sum + e.amount, 0);
      extraData.push(exPaid);
    });

    datasets = [
      { label: 'Детский сад', data: gardenData, backgroundColor: '#6366f1', borderRadius: 4, barPercentage: 0.5 },
      { label: 'Английский', data: engData, backgroundColor: '#3b82f6', borderRadius: 4, barPercentage: 0.5 },
      { label: 'Доп. расходы', data: extraData, backgroundColor: '#f59e0b', borderRadius: 4, barPercentage: 0.5 }
    ];
  }

  window.analyticsChartInstance = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      onClick: (event, elements) => {
        if (elements.length > 0) {
          const index = elements[0].index;
          const entity = currentEntities[index];
          if (entity) {
            analPeriodType = 'sub';
            if (analFilter === 'english') {
              analEngSubIndex = entity.index;
            } else {
              analSubIndex = entity.index;
            }
            render();
            document.getElementById('analyticsContainer')?.scrollIntoView({ behavior: 'smooth' });
          }
        }
      },
      onHover: (event, chartElement) => {
        if (event.native && event.native.target) {
          event.native.target.style.cursor = chartElement[0] ? 'pointer' : 'default';
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: isDark ? '#1e293b' : '#ffffff',
          titleColor: isDark ? '#f8fafc' : '#0f172a',
          bodyColor: isDark ? '#cbd5e1' : '#334155',
          borderColor: isDark ? '#334155' : '#e2e8f0',
          borderWidth: 1,
          padding: 10,
          boxPadding: 4,
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString('ru-RU')} ₽`
          }
        }
      },
      scales: {
        x: { 
          stacked: true, 
          grid: { display: false }, 
          border: { display: false }, 
          ticks: { color: textColor, font: { family: 'sans-serif', weight: 'bold', size: 10 } } 
        },
        y: { 
          stacked: true, 
          grid: { color: gridColor }, 
          border: { display: false }, 
          ticks: { color: textColor, font: { family: 'sans-serif', size: 10 }, callback: (v) => v > 0 ? (v / 1000) + 'k' : 0 }, 
          beginAtZero: true 
        }
      }
    }
  });
}

// =========================================================================
// 7. ЛОГИКА ДЕТСКОГО САДА И КАЛЕНДАРЯ
// =========================================================================
function calculateSchedule() {
  const totalSubscriptions = state.subscriptions.length;
  let currentValDate = new Date(state.startDate + 'T00:00:00');
  let currentSubIndex = 0;
  let attendedInCurrentSub = 0;

  const subStats = state.subscriptions.map((sub, idx) => ({
    ...sub, index: idx + 1, startDate: null, endDate: null, attendedCount: 0, completedCount: 0,
    missedCount: 0, missedDates: [], holidayDates: [], attendedDates: [], remainingAfterToday: 0, isPast: false
  }));

  const dayMap = {};
  let safetyCounter = 0;

  while (currentSubIndex < totalSubscriptions && safetyCounter < 2000) {
    safetyCounter++;
    const iso = toISODate(currentValDate);
    const dayOfWeek = currentValDate.getDay();
    const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
    const exception = state.exceptions[iso];

    let status = 'attended';
    if (isWeekend) status = 'weekend';
    else if (exception === 'holiday') status = 'holiday';
    else if (exception === 'missed') status = 'missed';

    const activeSub = subStats[currentSubIndex];

    if (!isWeekend && status !== 'holiday' && !activeSub.startDate) {
      activeSub.startDate = iso;
    }

    dayMap[iso] = {
      date: iso, status, subIndex: (!isWeekend && status !== 'holiday') ? (currentSubIndex + 1) : null,
      dayNumberInSub: null, isSubStart: false, isSubEnd: false, isCompletedVisit: false
    };

    if (status === 'attended') {
      attendedInCurrentSub++;
      activeSub.attendedCount++;
      activeSub.attendedDates.push(iso);
      dayMap[iso].dayNumberInSub = attendedInCurrentSub;

      if (attendedInCurrentSub === 1) dayMap[iso].isSubStart = true;

      if (iso <= state.simulatedToday) {
        dayMap[iso].isCompletedVisit = true;
        activeSub.completedCount++;
      } else {
        activeSub.remainingAfterToday++;
      }

      activeSub.endDate = iso;

      if (attendedInCurrentSub === state.daysPerSub) {
        dayMap[iso].isSubEnd = true;
        currentSubIndex++;
        attendedInCurrentSub = 0;
      }
    } else if (status === 'missed') {
      if (!activeSub.startDate) activeSub.startDate = iso;
      activeSub.missedCount++;
      activeSub.missedDates.push(iso);
    } else if (status === 'holiday' && activeSub.startDate) {
      activeSub.holidayDates.push(iso);
    }

    currentValDate.setDate(currentValDate.getDate() + 1);
  }

  subStats.forEach(sub => {
    sub.isPast = (sub.endDate && sub.endDate < state.simulatedToday);
  });

  return { subStats, dayMap, lastCalculatedDate: toISODate(currentValDate) };
}

function isSubCurrentlyHidden(sub) {
  if (sub.hiddenManually) return true;
  if (state.hidePastPeriods && sub.isPast && !sub.forceShow) return true;
  return false;
}

function shiftWorkingDays(isoDate, offset) {
  let d = new Date(isoDate + 'T00:00:00');
  let steps = Math.abs(offset);
  const dir = offset > 0 ? 1 : -1;

  while (steps > 0) {
    d.setDate(d.getDate() + dir);
    const day = d.getDay();
    const iso = toISODate(d);
    const isWeekend = (day === 0 || day === 6);
    const isHoliday = state.exceptions[iso] === 'holiday';

    if (!isWeekend && !isHoliday) steps--;
  }
  return toISODate(d);
}

function toggleDayStatus(isoDate) {
  if (isoDate < state.startDate) return; // Запрещаем кликать по пустым дням до старта трекера
  const d = new Date(isoDate + 'T00:00:00');
  if (d.getDay() === 0 || d.getDay() === 6) return;

  const { subStats } = calculateSchedule();
  const activeSub = subStats.find(s => !s.isPast);

  let isArchiveToggle = false;
  if (!activeSub || isoDate < activeSub.startDate) {
    isArchiveToggle = true;
  }

  const current = state.exceptions[isoDate] || 'attended';
  let toStatus = 'attended';

  if (current === 'attended') toStatus = 'missed';
  else if (current === 'missed') toStatus = 'holiday';
  else delete state.exceptions[isoDate];

  if (toStatus !== 'attended') {
    state.exceptions[isoDate] = toStatus;
  }

  if (isArchiveToggle) {
    const wasConsuming = (current === 'missed' || current === 'holiday');
    const willConsume = (toStatus === 'missed' || toStatus === 'holiday');

    if (!wasConsuming && willConsume) {
      state.startDate = shiftWorkingDays(state.startDate, -1);
    } else if (wasConsuming && !willConsume) {
      state.startDate = shiftWorkingDays(state.startDate, 1);
    }
  }
  saveState();
}

function togglePaidStatus(subId, event) {
  if (event) event.stopPropagation();
  const sub = state.subscriptions.find(s => s.id === subId);
  if (sub) { sub.isPaid = !sub.isPaid; saveState(); }
}

function hideSubscription(subId, event) {
  if (event) event.stopPropagation();
  const sub = state.subscriptions.find(s => s.id === subId);
  if (sub) {
    sub.hiddenManually = true;
    sub.forceShow = false;
    if (highlightedSubIndex) highlightedSubIndex = null;
    expandedMonthsOverride.clear();
    saveState();
  }
}

function restoreSingleSubscription(subId) {
  const sub = state.subscriptions.find(s => s.id === subId);
  if (sub) {
    sub.hiddenManually = false;
    sub.forceShow = true;
    saveState();
    renderHiddenModalList();
  }
}

function addArchivePeriod(type) {
  if (type === 'garden') {
    if (!state.subscriptions) state.subscriptions = [];
    let curD = new Date(state.startDate + 'T00:00:00');
    let workdaysNeeded = state.daysPerSub || 20;

    while (workdaysNeeded > 0) {
      curD.setDate(curD.getDate() - 1);
      const day = curD.getDay();
      const iso = toISODate(curD);
      const isWeekend = (day === 0 || day === 6);
      const isHoliday = state.exceptions[iso] === 'holiday';

      if (!isWeekend && !isHoliday) {
        workdaysNeeded--;
      }
    }

    // Генерируем аккуратный порядковый ID (1, 2, 3...), игнорируя старые 13-значные таймстампы
    const validIds = state.subscriptions
      .map(s => Number(s.id) || 0)
      .filter(id => id > 0 && id < 100000);
    const nextId = validIds.length > 0 ? Math.max(...validIds) + 1 : 1;

    state.startDate = toISODate(curD);
    state.subscriptions.unshift({
      id: nextId,
      price: state.defaultPrice || 28800,
      isPaid: true,
      hiddenManually: false,
      forceShow: false
    });
  }
  saveState();
}

function deleteSubscription(subId, subIndex, event) {
  if (event) event.stopPropagation();
  if (state.subscriptions.length <= 1) {
    alert('Нельзя удалить единственный период в расписании.');
    return;
  }
  if (confirm(`Удалить Период #${subIndex} из расписания?`)) {
    state.subscriptions = state.subscriptions.filter(s => s.id !== subId);
    highlightedSubIndex = null;
    expandedMonthsOverride.clear();
    saveState();
    renderHiddenModalList();
  }
}

function updateSubPrice(subId, newPrice) {
  const sub = state.subscriptions.find(s => s.id === subId);
  if (sub) { sub.price = Number(newPrice) || 0; saveState(); }
}

function updateBasePrice(val) {
  const price = Number(val) || 0;
  state.defaultPrice = price;
  state.subscriptions.forEach(s => { if (!s.isPaid) s.price = price; });
  saveState();
}

function updateSimulatedToday(val) {
  if (!val) return;
  state.simulatedToday = val;
  expandedMonthsOverride.clear();
  saveState();
}

function resetSimulatedToday() {
  state.simulatedToday = toISODate(new Date());
  expandedMonthsOverride.clear();
  saveState();
}

function updatePastStyle(val) {
  state.pastAttendedStyle = val;
  saveState();
}

function toggleHidePast(checked) {
  state.hidePastPeriods = checked;
  if (checked) state.subscriptions.forEach(s => s.forceShow = false);
  expandedMonthsOverride.clear();
  saveState();
}

function toggleHideWeekends(checked) {
  state.hideWeekends = checked;
  saveState();
}

function toggleHidePastWeeks(checked) {
  state.hidePastWeeks = checked;
  saveState();
}

function toggleMonthHiddenWeeks(monthKey) {
  if (expandedMonthsOverride.has(monthKey)) expandedMonthsOverride.delete(monthKey);
  else expandedMonthsOverride.add(monthKey);
  render();
}

function selectSubHighlight(subIndex) {
  highlightedSubIndex = (highlightedSubIndex === subIndex) ? null : subIndex;
  render();
}

function addSubscription() {
  if (!state.subscriptions) state.subscriptions = [];

  // Генерируем аккуратный порядковый ID (1, 2, 3...), игнорируя старые 13-значные таймстампы
  const validIds = state.subscriptions
    .map(s => Number(s.id) || 0)
    .filter(id => id > 0 && id < 100000);
  const nextId = validIds.length > 0 ? Math.max(...validIds) + 1 : 1;

  state.subscriptions.push({
    id: nextId,
    price: state.defaultPrice,
    isPaid: false,
    hiddenManually: false,
    forceShow: false
  });
  saveState();
}

function resetViewFilters() {
  highlightedSubIndex = null;
  state.hideWeekends = false;
  expandedMonthsOverride.clear();
  saveState();
}

function openHiddenModal() {
  renderHiddenModalList();
  document.getElementById('hiddenModal').classList.remove('hidden');
  document.getElementById('hiddenModal').classList.add('flex');
}

function closeHiddenModal() {
  document.getElementById('hiddenModal').classList.add('hidden');
  document.getElementById('hiddenModal').classList.remove('flex');
}

function renderHiddenModalList() {
  const { subStats } = calculateSchedule();
  const hiddenSubs = subStats.filter(s => isSubCurrentlyHidden(s));
  const container = document.getElementById('hiddenSubsList');

  if (hiddenSubs.length === 0) {
    container.innerHTML = `<div class="p-4 text-center text-xs text-slate-400 font-medium bg-slate-50 dark:bg-slate-800 rounded-xl">Нет скрытых периодов.</div>`;
    return;
  }

  container.innerHTML = hiddenSubs.map(sub => `
    <div class="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
      <div>
        <div class="flex items-center gap-2">
          <span class="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded bg-slate-800 text-white">Период #${sub.index}</span>
          <span class="text-xs font-extrabold text-slate-900 dark:text-white">${formatHumanDate(sub.startDate)} — ${formatHumanDate(sub.endDate)}</span>
        </div>
        <div class="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
          Отхожено: <b>${sub.completedCount}/${state.daysPerSub}</b> • Пропусков: <b>+${sub.missedCount} дн.</b>
        </div>
      </div>
      <div class="flex items-center gap-1.5">
        <button onclick="restoreSingleSubscription(${sub.id})" class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg">👁 Раскрыть</button>
        <button onclick="deleteSubscription(${sub.id}, ${sub.index})" class="px-2.5 py-1.5 bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50 text-xs font-bold rounded-lg">🗑</button>
      </div>
    </div>
  `).join('');
}

function showAllHiddenSubs() {
  state.hidePastPeriods = false;
  state.subscriptions.forEach(s => { s.hiddenManually = false; s.forceShow = false; });
  expandedMonthsOverride.clear();
  closeHiddenModal();
  saveState();
}

// =========================================================================
// 8. УВЕДОМЛЕНИЯ И КОНТЕКСТНЫЕ ПЛАШКИ
// =========================================================================

// Кэш данных для мгновенного переключения между вкладками
window._cachedGardenBannerHtml = '';
window._cachedEnglishBannerHtml = '';

// Функция переключения плашки в зависимости от активной вкладки
function updateMainBanner() {
  const container = document.getElementById('paymentAlertContainer') || document.getElementById('notificationBanner');
  if (!container) return;

  const currentTab = typeof activeMainTab !== 'undefined' ? activeMainTab : 'garden';

  // На вкладках Аналитика и Настройки плашка всегда скрыта
  if (currentTab !== 'garden' && currentTab !== 'english') {
    container.innerHTML = '';
    container.classList.add('hidden');
    return;
  }

  // Вкладка Сад
  if (currentTab === 'garden') {
    if (window._cachedGardenBannerHtml) {
      container.innerHTML = window._cachedGardenBannerHtml;
      container.classList.remove('hidden');
    } else {
      container.innerHTML = '';
      container.classList.add('hidden');
    }
    return;
  }

  // Вкладка Английский
  if (currentTab === 'english') {
    if (window._cachedEnglishBannerHtml) {
      container.innerHTML = window._cachedEnglishBannerHtml;
      container.classList.remove('hidden');
    } else {
      container.innerHTML = '';
      container.classList.add('hidden');
    }
    return;
  }
}

// Генерация баннера Сада (вызывается из render)
function checkPaymentNotifications(subStats, currentSub) {
  window._cachedGardenBannerHtml = '';
  if (!currentSub || !Array.isArray(subStats)) return;

  const daysLeft = currentSub.remainingWorkDays ?? currentSub.remainingDays ?? 0;
  const targetIndex = currentSub.isPaid ? currentSub.index + 1 : currentSub.index;
  const targetSub = subStats.find(s => s.index === targetIndex) || { 
    index: targetIndex, 
    price: state.defaultPrice || 28800, 
    startDate: currentSub.endDate, 
    isPaid: false 
  };

  if (daysLeft <= 5 && !targetSub.isPaid) {
    window._cachedGardenBannerHtml = `
      <div class="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-3xl border border-slate-200 dark:border-slate-800 border-l-4 border-indigo-500 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <div>
          <div class="text-[11px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">🐝 Детский сад: напоминание</div>
          <div class="text-sm font-bold text-slate-800 dark:text-white mt-1">Конец периода #${currentSub.index}: ${formatHumanDate(currentSub.endDate)}</div>
          <div class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">К оплате Период сада #${targetSub.index} с ${formatHumanDate(targetSub.startDate)}: ${targetSub.price.toLocaleString('ru-RU')} ₽.</div>
        </div>
        <button onclick="if(typeof toggleSubPaid==='function')toggleSubPaid(${targetSub.index});else{state.paidSubscriptions[${targetSub.index}]=true;saveState();render();}" class="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition shadow-sm shrink-0 cursor-pointer">
          ✓ Отметить #${targetSub.index} оплаченным
        </button>
      </div>
    `;
  }
}

// Генерация баннера Английского (вызывается из render)
function checkEnglishNotifications(engStats) {
  window._cachedEnglishBannerHtml = '';
  if (!Array.isArray(engStats) || engStats.length === 0) return;

  const activeEngSub = engStats.find(s => s.remainingCount > 0) || engStats[engStats.length - 1];
  if (!activeEngSub) return;

  // 1. Неоплаченные уроки в текущем абонементе
  if (activeEngSub.remainingToPay > 0) {
    const unpaidCount = (activeEngSub.activeTotal || 8) - (activeEngSub.paidLessonsCount || 0);
    window._cachedEnglishBannerHtml = `
      <div class="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-3xl border border-slate-200 dark:border-slate-800 border-l-4 border-blue-500 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <div>
          <div class="text-[11px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">🎓 Английский язык: напоминание</div>
          <div class="text-sm font-bold text-slate-800 dark:text-white mt-1">В Абонементе #${activeEngSub.index} не оплачено ${unpaidCount} ур.</div>
          <div class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">К доплате: ${activeEngSub.remainingToPay.toLocaleString('ru-RU')} ₽ (${activeEngSub.unitPrice || 700} ₽/ур.).</div>
        </div>
        <button onclick="quickPayEnglishDebt(${activeEngSub.index})" class="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition shadow-sm shrink-0 cursor-pointer">
          ✓ Оплатить долг (${activeEngSub.remainingToPay.toLocaleString('ru-RU')} ₽)
        </button>
      </div>
    `;
    return;
  }

  // 2. Осталось 1-2 занятия — напоминание о следующем абонементе
  if (activeEngSub.remainingCount <= 2) {
    const nextIndex = activeEngSub.index + 1;
    const nextSub = engStats.find(s => s.index === nextIndex);
    const nextIsPaid = nextSub && nextSub.remainingToPay === 0 && nextSub.paidLessonsCount >= nextSub.activeTotal;

    if (!nextIsPaid) {
      const defaultPrice = (activeEngSub.unitPrice || 700) * 8;
      window._cachedEnglishBannerHtml = `
        <div class="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-3xl border border-slate-200 dark:border-slate-800 border-l-4 border-blue-500 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <div>
            <div class="text-[11px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">🎓 Английский язык: напоминание</div>
            <div class="text-sm font-bold text-slate-800 dark:text-white mt-1">В Абонементе #${activeEngSub.index} осталось ${activeEngSub.remainingCount} ${activeEngSub.remainingCount === 1 ? 'занятие' : 'занятия'}</div>
            <div class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Подготовьте оплату за Абонемент #${nextIndex}: ${defaultPrice.toLocaleString('ru-RU')} ₽ (8 ур.).</div>
          </div>
          <button onclick="quickPayNextEnglishSub(${nextIndex})" class="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition shadow-sm shrink-0 cursor-pointer">
            ✓ Отметить #${nextIndex} оплаченным
          </button>
        </div>
      `;
    }
  }
}

// Быстрая оплата долга текущего абонемента английского
function quickPayEnglishDebt(subIndex) {
  const sub = (state.englishSubscriptions || []).find(s => s.index === subIndex);
  if (sub && Array.isArray(sub.lessons)) {
    sub.lessons.forEach(l => { if (l.status !== 'canceled') l.isPaid = true; });
    saveState();
    render();
  }
}

// Оплата следующего абонемента английского
function quickPayNextEnglishSub(nextIndex) {
  let sub = (state.englishSubscriptions || []).find(s => s.index === nextIndex);
  if (!sub && typeof addEnglishSubscription === 'function') {
    addEnglishSubscription();
    sub = (state.englishSubscriptions || []).find(s => s.index === nextIndex);
  }
  if (sub && Array.isArray(sub.lessons)) {
    sub.lessons.forEach(l => { if (l.status !== 'canceled') l.isPaid = true; });
  }
  saveState();
  render();
}

function getAlertDatesForSub(sub) {
  const dates = sub.attendedDates;
  if (!dates || dates.length < 20) return [];
  return [
    { daysLeft: 5, date: dates[dates.length - 5] },
    { daysLeft: 3, date: dates[dates.length - 3] },
    { daysLeft: 1, date: dates[dates.length - 1] }
  ];
}

function updateCloudBadge(statusText, isOk = true) {
  const badge = document.getElementById('cloudSyncBadge');
  if (!badge) return;
  if (!cloudConfig.apiKey || !cloudConfig.binId) {
    badge.textContent = '☁️ Не подкл.';
    badge.className = 'cursor-pointer px-2.5 py-1 text-[10px] sm:text-xs font-bold rounded-full bg-slate-100 text-slate-600 border border-slate-300';
    return;
  }
  badge.textContent = statusText || '☁️ Синхр.';
  badge.className = isOk
    ? 'cursor-pointer px-2.5 py-1 text-[10px] sm:text-xs font-bold rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800/50 hover:opacity-80 transition'
    : 'cursor-pointer px-2.5 py-1 text-[10px] sm:text-xs font-bold rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-800 dark:text-rose-400 border border-rose-300 dark:border-rose-800/50 hover:opacity-80 transition';
}

function openCloudModal() {
  document.getElementById('cloudApiKeyInput').value = cloudConfig.apiKey || '';
  document.getElementById('cloudBinIdInput').value = cloudConfig.binId || '';
  document.getElementById('cloudModal').classList.remove('hidden');
  document.getElementById('cloudModal').classList.add('flex');
}

function closeCloudModal() {
  document.getElementById('cloudModal').classList.add('hidden');
  document.getElementById('cloudModal').classList.remove('flex');
}

function showCloudMessage(msg, isError = false) {
  const el = document.getElementById('cloudStatusMsg');
  el.textContent = msg;
  el.className = `text-xs font-bold p-2.5 rounded-xl ${isError ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`;
  el.classList.remove('hidden');
}

function saveCloudConfig() {
  cloudConfig.apiKey = document.getElementById('cloudApiKeyInput').value.trim() || HARDCODED_CLOUD.apiKey;
  cloudConfig.binId = document.getElementById('cloudBinIdInput').value.trim() || HARDCODED_CLOUD.binId;
  localStorage.setItem(CLOUD_CONFIG_KEY, JSON.stringify(cloudConfig));
  updateCloudBadge('☁️ Активно', true);
  showCloudMessage('✓ Настройки сохранены!');
  if (cloudConfig.apiKey && cloudConfig.binId) pushToCloud(true);
}

async function pushToCloud(silent = false) {
  const apiKey = document.getElementById('cloudApiKeyInput')?.value.trim() || cloudConfig.apiKey;
  const binId = document.getElementById('cloudBinIdInput')?.value.trim() || cloudConfig.binId;
  if (!apiKey || !binId) return;
  updateCloudBadge('☁️ Сохр...', true);
  try {
    const res = await fetch(`https://api.jsonbin.io/v3/b/${binId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Master-Key': apiKey },
      body: JSON.stringify(state)
    });
    if (res.ok) {
      updateCloudBadge('☁️ Синхр.', true);
      if (!silent) showCloudMessage('✅ Отправлено в облако!');
    } else {
      updateCloudBadge('☁️ Ошибка', false);
    }
  } catch (e) {
    updateCloudBadge('☁️ Офлайн', false);
  }
}

async function pullFromCloud(silent = false) {
  const apiKey = document.getElementById('cloudApiKeyInput')?.value.trim() || cloudConfig.apiKey;
  const binId = document.getElementById('cloudBinIdInput')?.value.trim() || cloudConfig.binId;
  if (!apiKey || !binId) return;
  updateCloudBadge('☁️ Загр...', true);
  try {
    const res = await fetch(`https://api.jsonbin.io/v3/b/${binId}/latest`, {
      headers: { 'X-Master-Key': apiKey }
    });
    if (res.ok) {
      const data = await res.json();
      if (data.record && data.record.subscriptions) {
        const currentSimDate = state.simulatedToday; // Сохраняем текущую дату пользователя
        state = ensureDataIntegrity({ ...defaultState, ...data.record });
        state.simulatedToday = currentSimDate || toISODate(new Date());
        await saveState(true);
        updateCloudBadge('☁️ Синхр.', true);
        if (!silent) showCloudMessage('✅ Данные загружены из облака!');
      }
    }
  } catch (e) {
    updateCloudBadge('☁️ Офлайн', false);
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && cloudConfig.apiKey && cloudConfig.binId) {
    pullFromCloud(true);
  }
});

function exportJsonFile() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `uley-data-${state.simulatedToday}.json`;
  a.click();
}

function importJsonFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      state = ensureDataIntegrity({ ...defaultState, ...JSON.parse(e.target.result) });
      saveState();
    } catch (err) {
      alert('Ошибка чтения файла.');
    }
  };
  reader.readAsText(file);
}

function openReportModal() {
  generateReportText();
  document.getElementById('reportModal').classList.remove('hidden');
  document.getElementById('reportModal').classList.add('flex');
}

function closeReportModal() {
  document.getElementById('reportModal').classList.add('hidden');
  document.getElementById('reportModal').classList.remove('flex');
}

function generateReportText() {
  const { subStats } = calculateSchedule();
  const engStats = enrichEnglishSubscriptions();
  const scope = document.getElementById('reportScopeSelect').value;

  let lines = [`📊 СВЕРКА ПОСЕЩЕНИЙ «УЛЕЙ» (на ${formatHumanDate(state.simulatedToday)})`, ''];

  if (scope === 'all' || scope === 'garden') {
    lines.push(`=== 🐝 ОСНОВНОЙ ДЕТСКИЙ САД ===`);
    subStats.forEach(sub => {
      lines.push(`🔹 Абонемент #${sub.index}: ${formatHumanDate(sub.startDate)} — ${formatHumanDate(sub.endDate)}`);
      lines.push(`• Отхожено: ${sub.completedCount}/20 дн. | Пропусков: +${sub.missedCount} дн.`);
      lines.push(`• Оплата: ${sub.isPaid ? '✅ ОПЛАЧЕН' : '⏳ НЕ ОПЛАЧЕН'} (${sub.price.toLocaleString('ru-RU')} ₽)`);
      lines.push('');
    });

    if (state.extraExpenses && state.extraExpenses.length > 0) {
      lines.push(`🔸 Разовые доп. расходы (Сад):`);
      state.extraExpenses.forEach(e => {
        lines.push(`  • ${formatHumanDate(e.date)}: ${e.note ? e.note + ' — ' : ''}${e.amount.toLocaleString('ru-RU')} ₽`);
      });
      lines.push('');
    }
  }

  if (scope === 'all' || scope === 'english') {
    lines.push(`=== 🎓 АНГЛИЙСКИЙ ЯЗЫК ===`);
    engStats.forEach(es => {
      lines.push(`🔸 Абонемент #${es.index} (${es.startDate ? formatHumanDate(es.startDate) : ''} — ${es.endDate ? formatHumanDate(es.endDate) : ''})`);
      lines.push(`• Посещено: ${es.attendedCount} из ${es.activeTotal} | Оплачено: ${es.paidLessonsCount} из ${es.activeTotal} (${es.paidAmount.toLocaleString('ru-RU')} ₽)`);
      lines.push(`• Остаток к доплате: ${es.remainingToPay.toLocaleString('ru-RU')} ₽`);
      es.enrichedLessons.forEach(l => {
        const st = l.status === 'canceled' ? '❌ Отмена/Перенос' : (l.effectiveCompleted ? '✅ Проведено' : '⏳ План');
        const paySt = l.status === 'canceled' ? '' : (l.isPaid ? ' [💳 Оплачен]' : ' [Не оплачен]');
        lines.push(`  ${l.lessonNumber ? `Урок ${l.lessonNumber}` : '—'}: ${formatHumanDate(l.date)} (${getWeekdayName(l.date, true)}) — ${st}${paySt} ${l.note ? `(${l.note})` : ''}`);
      });
      lines.push('');
    });
  }

  document.getElementById('reportTextarea').value = lines.join('\n');
}

function copyReportToClipboard() {
  const textarea = document.getElementById('reportTextarea');
  textarea.select();
  navigator.clipboard.writeText(textarea.value);
  const btn = document.getElementById('copyReportBtn');
  btn.textContent = '✓ Скопировано!';
  setTimeout(() => btn.textContent = 'Скопировать текст', 2000);
}

function openNotificationsModal() {
  ensureDataIntegrity(state);
  updatePushBadge();
  document.getElementById('tgBotTokenInput').value = state.telegram.botToken || '';
  document.getElementById('tgChatIdInput').value = state.telegram.chatId || '';

  const { subStats } = calculateSchedule();
  const engStats = enrichEnglishSubscriptions();

  let html = subStats.filter(s => !s.isPast).map(sub => `
    <div class="py-1 border-b border-amber-200/60 dark:border-amber-800/40">
      <div class="font-bold">🐝 Сад — Период #${sub.index} (${formatShortDate(sub.startDate)}–${formatShortDate(sub.endDate)}):</div>
      <div class="grid grid-cols-3 gap-1 mt-1">
        ${getAlertDatesForSub(sub).map(m => `
          <div class="bg-white dark:bg-slate-800 px-1.5 py-1 rounded border border-amber-300 dark:border-amber-700 text-center">
            <span class="font-extrabold text-indigo-700 dark:text-indigo-400 block">${formatShortDate(m.date)}</span>
            <span class="text-[9px] text-slate-500 dark:text-slate-400">За ${m.daysLeft} дн.</span>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');

  engStats.forEach(es => {
    if (es.endDate) {
      html += `
        <div class="py-1">
          <div class="font-bold text-sky-900 dark:text-sky-300">🎓 Английский — Абонемент #${es.index}:</div>
          <div class="text-[11px]">Последнее занятие и уведомление: <b class="text-indigo-700 dark:text-indigo-400">${formatHumanDate(es.endDate)}</b></div>
        </div>
      `;
    }
  });

  document.getElementById('upcomingAlertsList').innerHTML = html;
  document.getElementById('notificationsModal').classList.remove('hidden');
  document.getElementById('notificationsModal').classList.add('flex');
}

function closeNotificationsModal() {
  document.getElementById('notificationsModal').classList.add('hidden');
  document.getElementById('notificationsModal').classList.remove('flex');
}

function saveTelegramConfig() {
  state.telegram.botToken = document.getElementById('tgBotTokenInput').value.trim() || HARDCODED_TELEGRAM.botToken;
  state.telegram.chatId = document.getElementById('tgChatIdInput').value.trim() || HARDCODED_TELEGRAM.chatId;
  saveState();
  const el = document.getElementById('tgStatusMsg');
  el.textContent = '✓ Сохранено!';
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 3000);
}

async function sendTelegramText(text, silent = false) {
  const botToken = (state.telegram?.botToken || HARDCODED_TELEGRAM.botToken || '').trim();
  const rawChatIds = (state.telegram?.chatId || HARDCODED_TELEGRAM.chatId || '').trim();
  const chatIdList = rawChatIds.split(/[\s,;]+/).map(id => id.trim()).filter(Boolean);

  if (!botToken || chatIdList.length === 0) return;

  let successCount = 0;
  for (const chatId of chatIdList) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text })
      });
      const data = await res.json();
      if (data.ok) successCount++;
    } catch (e) {}
  }
  if (!silent) alert(`✅ Сообщение отправлено получателям (${successCount} из ${chatIdList.length})!`);
}

function sendTestTelegramMessage() {
  saveTelegramConfig();
  const { subStats } = calculateSchedule();
  const engStats = enrichEnglishSubscriptions();
  const activeSub = subStats.find(s => !s.isPast) || subStats[0];
  const activeEng = engStats[engStats.length - 1];

  const msg = `🐝 Детский клуб «Улей» (Сводка)\n\n` +
    `1️⃣ Основной сад (Период #${activeSub?.index || 1}):\n` +
    `• Даты: ${formatHumanDate(activeSub?.startDate)} — ${formatHumanDate(activeSub?.endDate)}\n` +
    `• Отхожено: ${activeSub?.completedCount || 0}/20 (пропусков: ${activeSub?.missedCount || 0})\n\n` +
    `2️⃣ 🎓 Английский язык (Абонемент #${activeEng?.index || 1}):\n` +
    `• Посещено: ${activeEng?.attendedCount || 0}/${activeEng?.activeTotal || 8} зан.\n` +
    `• Оплачено: ${activeEng?.paidLessonsCount || 0}/${activeEng?.activeTotal || 8} (${(activeEng?.paidAmount || 0).toLocaleString('ru-RU')} ₽)`;

  sendTelegramText(msg, false);
}

function downloadICSReminders() {
  const { subStats } = calculateSchedule();
  const engStats = enrichEnglishSubscriptions();
  let icsLines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Uley Tracker PRO//RU', 'CALSCALE:GREGORIAN'];
  subStats.filter(s => !s.isPast).forEach(sub => {
    getAlertDatesForSub(sub).forEach(m => {
      const cleanDate = m.date.replace(/-/g, '');
      icsLines.push(
        'BEGIN:VEVENT', `UID:kg-${sub.index}-${m.daysLeft}-${cleanDate}@local`,
        `DTSTAMP:${cleanDate}T060000Z`, `DTSTART;VALUE=DATE:${cleanDate}`,
        `SUMMARY:🐝 Детский сад «Улей»: осталось ${m.daysLeft} раб. дн. (Период #${sub.index})`,
        'BEGIN:VALARM', 'TRIGGER:PT9H', 'ACTION:DISPLAY', 'DESCRIPTION:Оплата сада', 'END:VALARM', 'END:VEVENT'
      );
    });
  });
  engStats.forEach(es => {
    if (es.endDate) {
      const cleanDate = es.endDate.replace(/-/g, '');
      icsLines.push(
        'BEGIN:VEVENT', `UID:eng-${es.index}-${cleanDate}@local`,
        `DTSTAMP:${cleanDate}T060000Z`, `DTSTART;VALUE=DATE:${cleanDate}`,
        `SUMMARY:🎓 Английский «Улей»: сегодня 8-е заключительное занятие (Абонемент #${es.index})`,
        'BEGIN:VALARM', 'TRIGGER:PT9H', 'ACTION:DISPLAY', 'DESCRIPTION:Оплата английского', 'END:VALARM', 'END:VEVENT'
      );
    }
  });
  icsLines.push('END:VCALENDAR');
  const blob = new Blob([icsLines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'uley-reminders.ics';
  a.click();
}

// =========================================================================
// 9. ГЛАВНЫЙ РЕНДЕР ИНТЕРФЕЙСА
// =========================================================================
function render() {
  document.getElementById('basePriceInput').value = state.defaultPrice;
  document.getElementById('simulatedTodayInput').value = state.simulatedToday;
  document.getElementById('hidePastCheckbox').checked = state.hidePastPeriods;
  document.getElementById('hideWeekendsCheckbox').checked = !!state.hideWeekends;
  document.getElementById('hidePastWeeksCheckbox').checked = !!state.hidePastWeeks; // <-- ДОБАВИТЬ ЭТУ СТРОКУ
  document.getElementById('pastStyleSelect').value = state.pastAttendedStyle || 'green';
  document.getElementById('engHidePastCheckbox').checked = !!state.english.hidePastPeriods;

  const perDay = Math.round(state.defaultPrice / state.daysPerSub);
  document.getElementById('pricePerDayDisplay').textContent = perDay.toLocaleString('ru-RU') + ' ₽';

  const { subStats, dayMap, lastCalculatedDate } = calculateSchedule();
  const engStats = enrichEnglishSubscriptions();

  cachedSubStats = subStats;
  cachedEngStats = engStats;
  cachedCurrentSub = currentSub;

  // Счетчики английского
  const currentEngSub = engStats.find(s => s.remainingCount > 0) || engStats[engStats.length - 1];
  if (currentEngSub) {
    const engCountText = `${currentEngSub.attendedCount}`;
    const deskCounter = document.getElementById('engTabCounter');
    if (deskCounter) deskCounter.textContent = `${engCountText}/8`;
    const mobCounter = document.getElementById('engTabCounterMob');
    if (mobCounter) mobCounter.textContent = `${engCountText}/8`;
  }

  const engPrice = state.english.defaultPrice || 5600;
  document.getElementById('engBasePriceInput').value = engPrice;
  document.getElementById('engLessonPriceDisplay').textContent = Math.round(engPrice / 8).toLocaleString('ru-RU') + ' ₽';

  renderTabBanners();

  // Отрисовка Английского языка
  const visibleEngSubs = engStats.filter(es => !isEngSubCurrentlyHidden(es));
  const hiddenEngSubs = engStats.filter(es => isEngSubCurrentlyHidden(es));
  const engArchiveBtn = document.getElementById('engHiddenArchiveBtn');
  if (hiddenEngSubs.length > 0) {
    engArchiveBtn.textContent = `📦 Скрытые (${hiddenEngSubs.length})`;
    engArchiveBtn.classList.remove('hidden');
  } else {
    engArchiveBtn.classList.add('hidden');
  }

  const engContainer = document.getElementById('englishSubscriptionsContainer');
  engContainer.innerHTML = visibleEngSubs.map(es => {
    const paySummaryBadge = es.isFullyPaid
      ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700/50'
      : (es.paidLessonsCount > 0 ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-900 dark:text-amber-400 border-amber-300 dark:border-amber-700/50' : 'bg-rose-100 dark:bg-rose-900/30 text-rose-800 dark:text-rose-400 border-rose-300 dark:border-rose-700/50');

    const paySummaryText = es.isFullyPaid
      ? `✓ Оплачен полностью (${es.activeTotal}/${es.activeTotal})`
      : (es.paidLessonsCount > 0 ? `Частично оплачен (${es.paidLessonsCount}/${es.activeTotal})` : `Не оплачен (0/${es.activeTotal})`);

    const desktopRowsHtml = es.enrichedLessons.map(l => {
      const isCanceled = l.status === 'canceled';
      const isDone = l.effectiveCompleted;
      const rowBg = isCanceled ? 'bg-amber-50/60 dark:bg-amber-900/10 text-slate-400 dark:text-slate-500' : (isDone ? 'bg-emerald-50/60 dark:bg-emerald-900/10' : 'bg-white dark:bg-slate-900');

      return `
        <tr class="border-b border-slate-100 dark:border-slate-800 last:border-none ${rowBg}">
          <td class="py-2.5 px-3 font-extrabold text-xs text-center">
            ${isCanceled ? '<span class="px-1.5 py-0.5 rounded bg-amber-200 dark:bg-amber-800/50 text-amber-900 dark:text-amber-200 text-[10px]">Отмена</span>' : `<span class="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">${l.lessonNumber}</span>`}
          </td>
          <td class="py-2.5 px-3">
            <input type="date" value="${l.date}" onchange="changeEngLessonDate(${es.id}, ${l.id}, this.value)"
                   class="text-xs font-bold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 focus:outline-none ${isCanceled ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-slate-200'}">
          </td>
          <td class="py-2.5 px-3 text-xs font-semibold ${isCanceled ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-600 dark:text-slate-300'}">
            ${getWeekdayName(l.date, false)}
          </td>
          <td class="py-2.5 px-3 text-center">
            ${isCanceled ? '—' : `<button onclick="toggleEngLessonAttended(${es.id}, ${l.id})" class="px-2.5 py-1 rounded-lg text-xs font-extrabold border transition ${isDone ? 'bg-emerald-500 text-white border-emerald-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700'}">${isDone ? '✓ Проведено' : '⏳ План'}</button>`}
          </td>
          <td class="py-2.5 px-3 text-center">
            ${isCanceled ? '—' : `<button onclick="toggleEngLessonPaid(${es.id}, ${l.id})" class="px-2.5 py-1 rounded-lg text-xs font-extrabold border transition ${l.isPaid ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm' : 'bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-700/50'}">${l.isPaid ? `💳 Оплачен (${l.unitPrice} ₽)` : `Не оплачен`}</button>`}
          </td>
          <td class="py-2.5 px-3">
            <input type="text" value="${escapeHtml(l.note)}" placeholder="Примечание..." onchange="changeEngLessonNote(${es.id}, ${l.id}, this.value)"
                   class="w-full text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-200 rounded-lg px-2.5 py-1 focus:outline-none">
          </td>
          <td class="py-2.5 px-3 text-right whitespace-nowrap">
            <button onclick="toggleEngLessonCancel(${es.id}, ${l.id})" class="px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${isCanceled ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-700/50' : 'bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400 border-amber-300 dark:border-amber-700/50'}">${isCanceled ? '↩ Вернуть' : 'Перенос (+1)'}</button>
            <button onclick="deleteEngLessonRow(${es.id}, ${l.id})" class="ml-1.5 p-1 text-slate-300 dark:text-slate-500 hover:text-rose-600 text-sm font-bold">&times;</button>
          </td>
        </tr>
      `;
    }).join('');

    const mobileCardsHtml = es.enrichedLessons.map(l => {
      const isCanceled = l.status === 'canceled';
      const isDone = l.effectiveCompleted;
      const cardBg = isCanceled
        ? 'bg-amber-50/70 dark:bg-amber-900/10 border-amber-300 dark:border-amber-700/50 border-l-4 border-l-amber-500'
        : (isDone ? 'bg-emerald-50/70 dark:bg-emerald-900/10 border-emerald-300 dark:border-emerald-700/50 border-l-4 border-l-emerald-500' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 border-l-4 border-l-indigo-500');

      return `
        <div class="p-3 rounded-xl border ${cardBg} space-y-2 shadow-sm">
          <div class="flex flex-wrap items-center justify-between gap-1.5">
            <div class="flex items-center gap-1.5">
              ${isCanceled ? `<span class="px-1.5 py-0.5 rounded bg-amber-200 dark:bg-amber-800/50 text-amber-900 dark:text-amber-200 text-[10px] font-extrabold">Отмена</span>` : `<span class="px-2 py-0.5 rounded-lg bg-slate-800 dark:bg-slate-700 text-white text-xs font-extrabold">#${l.lessonNumber}</span>`}
              <input type="date" value="${l.date}" onchange="changeEngLessonDate(${es.id}, ${l.id}, this.value)" class="text-xs font-extrabold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-200 rounded-lg px-2 py-1 focus:outline-none ${isCanceled ? 'line-through text-slate-400' : ''}">
              <span class="px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-bold">${getWeekdayName(l.date, true)}</span>
            </div>
            ${isCanceled ? '' : `
              <div class="flex items-center gap-1">
                <button onclick="toggleEngLessonAttended(${es.id}, ${l.id})" class="px-2 py-1 rounded-lg text-[11px] font-extrabold border transition ${isDone ? 'bg-emerald-500 text-white border-emerald-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'}">${isDone ? '✓ Был' : '⏳ План'}</button>
                <button onclick="toggleEngLessonPaid(${es.id}, ${l.id})" class="px-2 py-1 rounded-lg text-[11px] font-extrabold border transition ${l.isPaid ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-700/50'}">${l.isPaid ? `💳 ${l.unitPrice}₽` : 'Не опл.'}</button>
              </div>
            `}
          </div>
          <div class="flex items-center gap-1.5">
            <input type="text" value="${escapeHtml(l.note)}" placeholder="Примечание к уроку..." onchange="changeEngLessonNote(${es.id}, ${l.id}, this.value)" class="flex-1 min-w-0 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none">
            <button onclick="toggleEngLessonCancel(${es.id}, ${l.id})" class="shrink-0 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition ${isCanceled ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border-indigo-200' : 'bg-amber-100/80 dark:bg-amber-900/30 text-amber-900 dark:text-amber-400 border-amber-300'}">${isCanceled ? '↩ Вернуть' : 'Перенос (+1)'}</button>
            <button onclick="deleteEngLessonRow(${es.id}, ${l.id})" class="shrink-0 px-2 py-1 text-slate-400 hover:text-rose-600 text-sm font-bold">&times;</button>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div class="p-4 sm:p-5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <span class="px-2.5 py-0.5 text-xs font-extrabold uppercase rounded bg-blue-600 text-white">Абонемент #${es.index}</span>
              ${es.isPast ? `<span class="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-400">Завершен ✓</span>` : ''}
              <h3 class="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">${formatHumanDate(es.startDate)} — ${formatHumanDate(es.endDate)}</h3>
              <button onclick="toggleEngSubPaidAll(${es.id})" class="px-3 py-0.5 rounded-full text-xs font-bold border ${paySummaryBadge} hover:opacity-80 transition">${paySummaryText}</button>
              <button onclick="hideEngSubscription(${es.id}, event)" class="px-2 py-0.5 text-slate-500 dark:text-slate-400 hover:text-indigo-600 rounded text-xs font-bold transition">👁‍🗨 Скрыть</button>
              <button onclick="deleteEngSubscription(${es.id}, ${es.index})" class="text-slate-400 hover:text-rose-600 text-xs font-bold ml-1">🗑</button>
            </div>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full lg:w-auto text-xs">
            <div class="bg-white dark:bg-slate-900 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700"><span class="text-[10px] text-slate-400 block">Посещено</span><span class="font-extrabold text-emerald-700 dark:text-emerald-400 text-sm">${es.attendedCount} из ${es.activeTotal}</span></div>
            <div class="bg-white dark:bg-slate-900 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700"><span class="text-[10px] text-slate-400 block">Оплачено</span><span class="font-extrabold text-indigo-700 dark:text-indigo-400 text-sm">${es.paidLessonsCount} из ${es.activeTotal}</span></div>
            <div class="bg-white dark:bg-slate-900 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700"><span class="text-[10px] text-slate-400 block">Цена</span><div class="flex items-center gap-1"><input type="number" value="${es.price}" step="100" onchange="updateEngSubPrice(${es.id}, this.value)" class="w-16 font-extrabold text-sm text-slate-900 dark:text-white bg-transparent border-b border-slate-300 dark:border-slate-600 focus:outline-none"><span class="font-bold dark:text-white">₽</span></div></div>
            <div class="bg-white dark:bg-slate-900 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700"><span class="text-[10px] text-slate-400 block">Долг</span><span class="font-extrabold ${es.remainingToPay === 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'} text-sm">${es.remainingToPay.toLocaleString('ru-RU')} ₽</span></div>
          </div>
        </div>
        <div class="md:hidden p-3 space-y-2.5 bg-slate-50/50 dark:bg-slate-950/40">${mobileCardsHtml}</div>
        <div class="hidden md:block overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-slate-100/70 dark:bg-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase border-b border-slate-200 dark:border-slate-700">
                <th class="py-2 px-3 text-center w-12">№</th><th class="py-2 px-3">Дата урока</th><th class="py-2 px-3">День недели</th><th class="py-2 px-3 text-center">Посещение</th><th class="py-2 px-3 text-center">Оплата</th><th class="py-2 px-3">Примечание</th><th class="py-2 px-3 text-right">Корректировка</th>
              </tr>
            </thead>
            <tbody>${desktopRowsHtml}</tbody>
          </table>
        </div>
        <div class="p-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs">
          <span class="text-slate-500 dark:text-slate-400 text-[11px]">Оплачивайте по одному уроку кнопкой «💳» или сразу весь период в шапке.</span>
          <button onclick="addManualEngLessonRow(${es.id})" class="w-full sm:w-auto px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 text-indigo-700 dark:text-indigo-400 font-bold rounded-lg border border-slate-300 dark:border-slate-700 shrink-0 text-center transition">+ Добавить дату вручную</button>
        </div>
      </div>
    `;
  }).join('');

  if (hiddenEngSubs.length > 0) {
    engContainer.innerHTML += `
      <div onclick="openEngHiddenModal()" class="bg-slate-200/70 dark:bg-slate-900/60 hover:bg-slate-200 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-5 flex flex-col items-center justify-center text-center gap-1.5 cursor-pointer transition">
        <span class="text-xs font-extrabold text-slate-700 dark:text-slate-300">📦 В архиве скрыто абонементов английского: ${hiddenEngSubs.length}</span>
        <span class="text-[11px] text-slate-500 dark:text-slate-400">Нажмите, чтобы посмотреть сводку или открыть нужный период</span>
      </div>
    `;
  }

  // Отрисовка Основного Сада
  const hiddenSubs = subStats.filter(s => isSubCurrentlyHidden(s));
  const hiddenSubIndices = new Set(hiddenSubs.map(s => s.index));
  const visibleSubs = subStats.filter(s => !hiddenSubIndices.has(s.index));
  const firstVisibleStartDate = visibleSubs.length > 0 ? visibleSubs[0].startDate : state.startDate;

  const archiveBtn = document.getElementById('hiddenArchiveBtn');
  if (hiddenSubs.length > 0) {
    archiveBtn.textContent = `📦 Скрытые (${hiddenSubs.length})`;
    archiveBtn.classList.remove('hidden');
  } else {
    archiveBtn.classList.add('hidden');
  }

  document.getElementById('resetFiltersBtn').classList.toggle('hidden', !(highlightedSubIndex || state.hideWeekends || expandedMonthsOverride.size > 0));

  const subContainer = document.getElementById('subscriptionsContainer');
  subContainer.innerHTML = visibleSubs.map(sub => {
    const theme = SUB_THEMES[(sub.index - 1) % SUB_THEMES.length];
    const isSelected = highlightedSubIndex === sub.index;
    const paidBadge = sub.isPaid
      ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700/50'
      : 'bg-rose-100 dark:bg-rose-900/30 text-rose-800 dark:text-rose-400 border-rose-300 dark:border-rose-700/50';

    return `
      <div onclick="selectSubHighlight(${sub.index})" class="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border-l-8 ${theme.cardBorder} ${theme.cardBg} dark:!bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between cursor-pointer transition ${isSelected ? 'ring-2 ring-indigo-600 dark:ring-indigo-400 shadow-md' : 'hover:shadow-md'}">
        <div>
          <div class="flex justify-between items-start gap-1.5">
            <div>
              <div class="flex items-center gap-1.5">
                <span class="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded ${theme.badge}">Период #${sub.index}</span>
                ${sub.isPast ? `<span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-400">Завершен ✓</span>` : ''}
              </div>
              <h3 class="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white mt-1">${formatHumanDate(sub.startDate)} — ${formatHumanDate(sub.endDate)}</h3>
            </div>
            <div class="flex items-center gap-1">
              <button onclick="togglePaidStatus(${sub.id}, event)" class="px-2 py-0.5 rounded-full text-[11px] font-bold border ${paidBadge}">${sub.isPaid ? '✓ Оплачен' : 'Не оплачен'}</button>
              <button onclick="hideSubscription(${sub.id}, event)" class="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded text-xs font-bold">👁‍🗨</button>
              <button onclick="deleteSubscription(${sub.id}, ${sub.index}, event)" class="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded text-xs font-bold">🗑</button>
            </div>
          </div>
          <div class="mt-3 grid grid-cols-3 gap-1.5 text-xs bg-slate-50 dark:bg-slate-800/70 p-2 rounded-xl border border-slate-200/80 dark:border-slate-700 text-center">
            <div><span class="text-slate-400 block text-[10px]">Отхожено</span><span class="font-extrabold text-emerald-700 dark:text-emerald-400">✓ ${sub.completedCount}/${state.daysPerSub}</span></div>
            <div><span class="text-slate-400 block text-[10px]">Пропусков</span><span class="font-extrabold ${sub.missedCount > 0 ? 'text-amber-600 dark:text-amber-500' : 'text-slate-700 dark:text-slate-300'}">+${sub.missedCount}</span></div>
            <div><span class="text-slate-400 block text-[10px]">Осталось</span><span class="font-extrabold text-indigo-600 dark:text-indigo-400">${sub.remainingAfterToday} дн.</span></div>
          </div>
        </div>
        <div class="mt-3 pt-2 border-t border-slate-200/60 dark:border-slate-800 flex justify-between items-center text-xs" onclick="event.stopPropagation()">
          <span class="text-slate-500 dark:text-slate-400 font-medium">Стоимость:</span>
          <div class="flex items-center gap-1">
            <input type="number" value="${sub.price}" step="100" onchange="updateSubPrice(${sub.id}, this.value)" class="w-20 text-right font-extrabold bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-700 focus:outline-none">
            <span class="font-bold dark:text-white">₽</span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  if (hiddenSubs.length > 0) {
    subContainer.innerHTML += `
      <div onclick="openHiddenModal()" class="bg-slate-200/70 dark:bg-slate-900/60 hover:bg-slate-200 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-4 flex flex-col items-center justify-center text-center gap-1.5 cursor-pointer transition">
        <span class="text-xs font-extrabold text-slate-700 dark:text-slate-300">📦 В архиве скрыто периодов: ${hiddenSubs.length}</span>
        <span class="text-[11px] text-slate-500 dark:text-slate-400">Нажмите, чтобы раскрыть нужный период</span>
      </div>
    `;
  }

  // Отрисовка Календаря
  const englishDateMap = {};
  engStats.forEach(es => {
    es.enrichedLessons.forEach(l => {
      if (l.status !== 'canceled') {
        englishDateMap[l.date] = { subIndex: es.index, lessonNumber: l.lessonNumber, completed: l.effectiveCompleted, isPaid: l.isPaid };
      }
    });
  });

  const calContainer = document.getElementById('calendarContainer');
  calContainer.innerHTML = '';

  const trackerStartD = new Date(state.startDate + 'T00:00:00');
  const startYear = trackerStartD.getFullYear(), startMonth = trackerStartD.getMonth();
  const endD = new Date(lastCalculatedDate + 'T00:00:00');
  const finalYear = Math.max(startYear, endD.getFullYear());
  const finalMonth = (finalYear === startYear) ? Math.max(startMonth, endD.getMonth()) : endD.getMonth();

  let curY = startYear, curM = startMonth;
  const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
  const weekDays = state.hideWeekends ? ['Пн', 'Вт', 'Ср', 'Чт', 'Пт'] : ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  const gridColsClass = state.hideWeekends ? 'grid-cols-5' : 'grid-cols-7';

  while (curY < finalYear || (curY === finalYear && curM <= finalMonth)) {
    const monthKey = `${curY}-${String(curM + 1).padStart(2, '0')}`;
    const firstDayOfMonth = new Date(curY, curM, 1);
    const daysInMonth = new Date(curY, curM + 1, 0).getDate();
    let startOffset = firstDayOfMonth.getDay() - 1;
    if (startOffset === -1) startOffset = 6;

    let weeks = [], currentWeekCells = [];
    for (let i = 0; i < startOffset; i++) currentWeekCells.push({ type: 'empty', colIndex: i });

    for (let day = 1; day <= daysInMonth; day++) {
      const iso = `${curY}-${String(curM + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      currentWeekCells.push({ type: 'day', day, iso, info: dayMap[iso], colIndex: currentWeekCells.length });
      if (currentWeekCells.length === 7) { weeks.push(currentWeekCells); currentWeekCells = []; }
    }
    if (currentWeekCells.length > 0) {
      while (currentWeekCells.length < 7) currentWeekCells.push({ type: 'empty', colIndex: currentWeekCells.length });
      weeks.push(currentWeekCells);
    }

    let visibleWeeksCount = 0, hiddenWeeksCount = 0;
    const processedWeeks = weeks.map(week => {
      const dayCells = week.filter(c => c.type === 'day');
      if (dayCells.length === 0) return { cells: week, isWeekHidden: true };

      const allBeforeVisible = hiddenSubIndices.size > 0 && dayCells.every(c => c.iso < firstVisibleStartDate);
      const workDaysWithSub = dayCells.filter(c => c.info && c.info.subIndex);
      const allSubsInWeekHidden = workDaysWithSub.length > 0 && workDaysWithSub.every(c => hiddenSubIndices.has(c.info.subIndex));
      
      // Скрывать текущий период ТОЛЬКО если включена галочка в фильтрах
      const isWeekCompletelyInPast = state.hidePastWeeks && dayCells.every(c => c.iso < state.simulatedToday);

      const isWeekHidden = (allBeforeVisible || allSubsInWeekHidden || isWeekCompletelyInPast);
      if (isWeekHidden) hiddenWeeksCount++; else visibleWeeksCount++;
      
      return { cells: week, isWeekHidden };
    });

    const isMonthForceExpanded = expandedMonthsOverride.has(monthKey);
    if (visibleWeeksCount === 0 && hiddenSubIndices.size > 0) { curM++; if (curM > 11) { curM = 0; curY++; } continue; }
    
    let weeksHtml = '';

    processedWeeks.forEach(w => {
      if (w.isWeekHidden) return; // Просто пропускаем скрытые недели без всяких кнопок
      w.cells.forEach(cell => {
        if (state.hideWeekends && (cell.colIndex === 5 || cell.colIndex === 6)) return;
        if (cell.type === 'empty') { weeksHtml += `<div class="p-1"></div>`; return; }

        const { day, iso, info } = cell;
        const dObj = new Date(iso + 'T00:00:00');
        const isWeekend = (dObj.getDay() === 0 || dObj.getDay() === 6);
        const isToday = (iso === state.simulatedToday);
        const engInfo = englishDateMap[iso];
        const isSubHidden = info && info.subIndex && hiddenSubIndices.has(info.subIndex);
        const isDimmedByFilter = highlightedSubIndex && (!info || info.subIndex !== highlightedSubIndex);

        let cellClasses = 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500';
        let topRightHtml = '', bottomBadgeHtml = '', englishPillHtml = '';

        if (engInfo) {
          englishPillHtml = `<div class="w-full text-center px-1 py-0.5 rounded bg-blue-600 text-white text-[8px] sm:text-[10px] font-black tracking-tight shadow-sm truncate leading-none">🎓 EN <span class="hidden sm:inline">(${engInfo.lessonNumber}/8)</span></div>`;
        }

        if (isWeekend) {
          cellClasses = 'bg-slate-100/80 dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed';
        } else if (iso < state.startDate || isSubHidden) {
          cellClasses = 'bg-slate-50 dark:bg-slate-900/40 border-dashed border-slate-200 dark:border-slate-800 text-slate-300 opacity-45';
        } else if (info) {
          const theme = info.subIndex ? SUB_THEMES[(info.subIndex - 1) % SUB_THEMES.length] : SUB_THEMES[0];

          if (info.status === 'attended') {
            if (info.isCompletedVisit) {
              if (state.pastAttendedStyle === 'gray') {
                cellClasses = `bg-slate-200/90 dark:bg-slate-800 border-slate-300 dark:border-slate-700 ${theme.cellBorderAccent} text-slate-600 dark:text-slate-300 cursor-pointer`;
                bottomBadgeHtml = `<span class="w-full text-center text-[9px] sm:text-[11px] font-bold px-0.5 py-0.5 rounded bg-slate-300 dark:bg-slate-700 text-slate-700 dark:text-slate-200 truncate leading-none">✓ ${info.dayNumberInSub}/20</span>`;
              } else {
                cellClasses = `bg-emerald-50 dark:bg-emerald-950/30 border-emerald-400 dark:border-emerald-700/60 ${theme.cellBorderAccent} text-emerald-950 dark:text-emerald-100 cursor-pointer`;
                bottomBadgeHtml = `<span class="w-full text-center text-[9px] sm:text-[11px] font-extrabold px-0.5 py-0.5 rounded bg-emerald-200/90 dark:bg-emerald-800 text-emerald-900 dark:text-emerald-50 truncate leading-none">✓ ${info.dayNumberInSub}/20</span>`;
              }
            } else {
              cellClasses = `${theme.cellPlanned} ${theme.cellBorderAccent} cursor-pointer`;
              bottomBadgeHtml = `<span class="w-full text-center text-[9px] sm:text-[11px] font-extrabold px-0.5 py-0.5 rounded ${theme.dayPill} truncate leading-none"><span class="hidden sm:inline">План </span>${info.dayNumberInSub}/20</span>`;
            }

            if (info.isSubStart) {
              cellClasses += ' ring-1 sm:ring-2 ring-slate-900 dark:ring-white/60';
              topRightHtml = `<span class="px-1 py-0.2 text-[8px] sm:text-[10px] font-black rounded bg-slate-900 text-white leading-tight">🚀#${info.subIndex}</span>`;
            } else if (info.isSubEnd) {
              cellClasses += ' ring-1 sm:ring-2 ring-rose-600 dark:ring-rose-500';
              topRightHtml = `<span class="px-1 py-0.2 text-[8px] sm:text-[10px] font-black rounded bg-rose-600 text-white leading-tight">🏁#${info.subIndex}</span>`;
            } else {
              topRightHtml = `<span class="px-1 py-0.2 text-[8px] sm:text-[10px] font-extrabold rounded ${theme.badge} leading-tight">#${info.subIndex}</span>`;
            }
          } else if (info.status === 'missed') {
            cellClasses = `bg-amber-50 dark:bg-amber-950/30 border-amber-400 dark:border-amber-700/60 border-l-[3px] sm:border-l-4 border-l-amber-500 text-amber-950 dark:text-amber-100 cursor-pointer`;
            topRightHtml = `<span class="px-1 py-0.2 text-[8px] sm:text-[10px] font-bold rounded bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100 leading-tight">#${info.subIndex}</span>`;
            bottomBadgeHtml = `<span class="w-full text-center text-[9px] sm:text-[10px] font-extrabold px-0.5 py-0.5 rounded bg-amber-500 dark:bg-amber-600 text-white truncate leading-none"><span class="sm:hidden">Проп.+1</span><span class="hidden sm:inline">Пропуск (+1)</span></span>`;
          } else if (info.status === 'holiday') {
            cellClasses = `bg-purple-50 dark:bg-purple-950/30 border-purple-300 dark:border-purple-700/60 border-l-[3px] sm:border-l-4 border-l-purple-500 text-purple-950 dark:text-purple-100 cursor-pointer`;
            bottomBadgeHtml = `<span class="w-full text-center text-[9px] sm:text-[10px] font-bold px-0.5 py-0.5 rounded bg-purple-200 dark:bg-purple-800 text-purple-900 dark:text-purple-100 truncate leading-none">Выходной</span>`;
          }
        }
        if (isDimmedByFilter) cellClasses += ' opacity-25 scale-95';
        if (isToday) cellClasses += ' ring-2 ring-amber-500';

        weeksHtml += `
          <div onclick="toggleDayStatus('${iso}')" class="day-card border rounded-lg sm:rounded-xl p-1 sm:p-2 min-h-[64px] sm:min-h-[88px] flex flex-col justify-between select-none overflow-hidden ${cellClasses}">
            <div class="flex justify-between items-start gap-0.5"><span class="font-extrabold text-xs sm:text-sm leading-none ${isToday ? 'bg-amber-500 text-white px-1 py-0.5 rounded' : ''}">${day}</span>${topRightHtml}</div>
            <div class="mt-1 flex flex-col gap-0.5 w-full">${englishPillHtml}${bottomBadgeHtml}</div>
          </div>
        `;
      });
    });

    const hiddenWeeksNoticeHtml = hiddenWeeksCount > 0 ? `<button onclick="toggleMonthHiddenWeeks('${monthKey}')" class="text-[11px] font-bold px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400">${isMonthForceExpanded ? '▲ Свернуть прошедшие' : `▼ Скрыто недель: ${hiddenWeeksCount} (показать)`}</button>` : '';

    calContainer.innerHTML += `
      <div class="bg-white dark:bg-slate-900 p-3 sm:p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors duration-300">
        <div class="flex flex-wrap justify-between items-center gap-2 mb-2.5">
          <h2 class="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">${monthNames[curM]} ${curY}</h2>
        </div>
        <div class="grid ${gridColsClass} gap-1 sm:gap-2 text-center text-[11px] sm:text-xs font-bold text-slate-400 mb-1.5">${weekDays.map(w => `<div>${w}</div>`).join('')}</div>
        <div class="grid ${gridColsClass} gap-1 sm:gap-2">${weeksHtml}</div>
      </div>
    `;
    curM++; if (curM > 11) { curM = 0; curY++; }
  }

  renderAnalytics(subStats, engStats, dayMap);

  checkPaymentNotifications(subStats, currentSub);
  checkEnglishNotifications(engStats);
  updateMainBanner();
}

// ПРАВИЛЬНЫЙ СТАРТ ПРИЛОЖЕНИЯ
async function bootApp() {
  updateCloudBadge();
  updatePushBadge();
  render(); // Быстрая отрисовка без отправки уведомлений
  
  if (cloudConfig.apiKey && cloudConfig.binId) {
    await pullFromCloud(true); // Ждем, пока прилетят ваши Периоды #9 и #10
  }
  
  disableAlerts = false; // Снимаем замок
  render(); // Финальная отрисовка — теперь уведомления сработают только по реальным датам
}

bootApp();