/**
 * dsh-desktop-task-notify — Client (browser) half.
 *
 * Shows a desktop notification (bottom-right, like opencode) when a task /
 * agent run completes. Detection subscribes to the client runtime's session
 * list: a row whose `running` bit falls true → false has just settled, and its
 * session face carries `lastAgentError` when the failure had no turn position.
 *
 * Notifications: native `new Notification()` in the Electron renderer (already
 * granted), with an in-page bottom-right toast as fallback. Only fires while
 * the window is not focused (you are away from the app), matching opencode.
 */
import { CSS } from './styles.js';

export const name = 'dsh-desktop-task-notify';

/** Inject the client session list and locale services. */
export const inject = ['sessions', 'locale'];

const NS = 'taskNotify';

const zh = {
  doneTitle: '任务完成',
  failTitle: '任务失败',
  doneBody: '已完成',
  failBody: '执行失败',
  unknown: '未命名任务',
  duration: '{min}分{sec}秒',
};
const en = {
  doneTitle: 'Task complete',
  failTitle: 'Task failed',
  doneBody: 'Finished',
  failBody: 'Failed',
  unknown: 'Untitled task',
  duration: '{min}m {sec}s',
};

/** Minimum gap between notifications (ms). */
const MIN_INTERVAL_MS = 3000;
/** Only notify while the window is not focused (like opencode). */
const NOTIFY_WHEN_UNFOCUSED = true;

// ---- fallback in-page toast -------------------------------------------------

let styleEl = null;

function ensureStyle() {
  if (styleEl !== null) return;
  styleEl = document.createElement('style');
  styleEl.dataset.plugin = 'dsh-desktop-task-notify';
  styleEl.dataset.pluginCss = 'dsh-desktop-task-notify/toast';
  styleEl.textContent = CSS;
  document.head.appendChild(styleEl);
}

function showToast(title, body) {
  const el = document.createElement('div');
  el.className = 'ntf-toast';
  const titleEl = document.createElement('div');
  titleEl.className = 'ntf-title';
  titleEl.textContent = title;
  const bodyEl = document.createElement('div');
  bodyEl.className = 'ntf-body';
  bodyEl.textContent = body;
  el.append(titleEl, bodyEl);
  el.addEventListener('click', () => el.remove());
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 6000);
}

function formatDuration(t, ms) {
  const total = Math.max(0, Math.round(ms / 1000));
  return t('duration', { min: String(Math.floor(total / 60)), sec: String(total % 60) });
}

/** @param {import('@deepseek-ai/dsh-client-runtime/client').ClientContext} ctx */
export const apply = (ctx) => {
  ctx.effect(() => {
    ensureStyle();
    return () => {
      if (styleEl !== null) { styleEl.remove(); styleEl = null; }
    };
  }, 'ntf: styles');

  ctx.effect(() => {
    const offZh = ctx.locale.register(NS, 'zh', zh);
    const offEn = ctx.locale.register(NS, 'en', en);
    return () => { offZh(); offEn(); };
  }, 'ntf: dictionary');
  const t = ctx.locale.bind(NS);

  const sessions = ctx.get('sessions');
  if (sessions === void 0 || sessions.list === void 0) {
    return;
  }

  /** sessionId -> epoch ms when the run was first observed. */
  const startedAt = new Map();
  /** sessionId -> last observed `running` bit. */
  const running = new Map();
  let lastNotifyAt = 0;

  const notify = (title, body) => {
    if (NOTIFY_WHEN_UNFOCUSED && typeof document.hasFocus === 'function' && document.hasFocus()) {
      return; // the user is watching; skip the toast
    }
    const now = Date.now();
    if (now - lastNotifyAt < MIN_INTERVAL_MS) return;
    lastNotifyAt = now;
    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification(title, { body });
        return;
      }
    } catch {
      // fall through to the in-page toast
    }
    showToast(title, body);
  };

  /** A live failure outside a turn position is the only outcome the list mirror keeps. */
  const failed = (sessionId) => {
    try {
      const snapshot = sessions.binding(sessionId)?.session.getSnapshot();
      return snapshot?.lastAgentError !== undefined && snapshot?.lastAgentError !== null;
    } catch {
      return false;
    }
  };

  const settle = (row) => {
    const name = row.displayTitle || row.title || t('unknown');
    const start = startedAt.get(row.id);
    const dur = start === undefined ? null : formatDuration(t, Date.now() - start);
    const tail = dur === null ? name : `${name} · ${dur}`;
    if (failed(row.id)) notify(t('failTitle'), `${t('failBody')} · ${tail}`);
    else notify(t('doneTitle'), `${t('doneBody')} · ${tail}`);
  };

  const onChange = () => {
    const { ids, byId } = sessions.list.getSnapshot();
    const seen = new Set();
    for (const id of ids) {
      const row = byId[id];
      if (row === void 0) continue;
      seen.add(id);
      const wasRunning = running.get(id);
      if (row.running) {
        if (!startedAt.has(id)) startedAt.set(id, Date.now());
        running.set(id, true);
        continue;
      }
      // A pending interaction stops the run but still needs the user; it is
      // not a completion, so the sidebar badge (not a toast) owns that case.
      if (wasRunning === true && row.pendingInteraction === void 0) settle(row);
      running.set(id, false);
      startedAt.delete(id);
    }
    // Forget rows that left the list (removed sessions) so the maps stay bounded.
    for (const id of [...running.keys()]) {
      if (!seen.has(id)) {
        running.delete(id);
        startedAt.delete(id);
      }
    }
  };

  ctx.effect(() => {
    const off = sessions.list.subscribe(onChange);
    onChange(); // seed the running baseline; rows already stopped stay quiet
    return off;
  }, 'ntf: session watcher');
};
