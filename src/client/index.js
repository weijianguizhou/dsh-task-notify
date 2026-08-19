/**
 * dsh-task-notify — Client (browser) half.
 *
 * Shows a desktop notification (bottom-right, like opencode) when a task /
 * agent run completes. Detection mirrors the task-board runner: poll
 * `sessions.list`, watch for a session that was running and stops, then read
 * `sessions.history` for the final `turn/end` reason to decide success/failure.
 *
 * Notifications: native `new Notification()` in the Electron renderer (already
 * granted), with an in-page bottom-right toast as fallback. Only fires while
 * the window is not focused (you are away from the app), matching opencode.
 */
import { CSS } from './styles.js';

export const name = 'dsh-task-notify';

/** Inject the connection (session wire) and locale services. */
export const inject = ['connection', 'locale'];

const NS = 'taskNotify';

const zh = {
  doneTitle: '任务完成',
  failTitle: '任务失败',
  cancelTitle: '任务已取消',
  doneBody: '已完成',
  failBody: '执行失败',
  cancelBody: '已取消',
  unknown: '未命名任务',
  duration: '{min}分{sec}秒',
};
const en = {
  doneTitle: 'Task complete',
  failTitle: 'Task failed',
  cancelTitle: 'Task cancelled',
  doneBody: 'Finished',
  failBody: 'Failed',
  cancelBody: 'Cancelled',
  unknown: 'Untitled task',
  duration: '{min}m {sec}s',
};
const LOCALES = { zh, en };

/** Poll cadence (ms) for the session list. */
const POLL_MS = 4000;
/** Minimum gap between notifications (ms). */
const MIN_INTERVAL_MS = 3000;
/** Only notify while the window is not focused (like opencode). */
const NOTIFY_WHEN_UNFOCUSED = true;

// ---- fallback in-page toast -------------------------------------------------

let styleEl = null;

function ensureStyle() {
  if (styleEl !== null) return;
  styleEl = document.createElement('style');
  styleEl.dataset.plugin = 'dsh-task-notify';
  styleEl.dataset.pluginCss = 'dsh-task-notify/toast';
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

  ctx.effect(() => ctx.locale.register(NS, LOCALES), 'ntf: dictionary');
  const t = ctx.locale.bind(NS);

  const connection = ctx.get('connection');
  if (connection === void 0 || connection.api?.sessions === void 0) {
    return;
  }
  const sessions = connection.api.sessions;

  /** sessionId -> { title, startedAt } for sessions observed running. */
  const running = new Map();
  let baseline = false;
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

  const settle = async (sessionId, title, startedAt) => {
    let outcome = 'done';
    try {
      const r = await sessions.history({ sessionId });
      if (r.result.ok) {
        const events = r.result.value.events ?? [];
        const turnEnd = [...events].reverse().find((entry) => entry?.event?.type === 'turn/end');
        const reason = turnEnd?.event?.data?.reason;
        if (reason?.kind === 'error') outcome = 'failed';
        else if (reason?.kind === 'cancelled' || reason?.kind === 'aborted') outcome = 'cancelled';
      }
    } catch {
      // outcome stays 'done'; the session simply stopped
    }
    const name = title || t('unknown');
    const dur = formatDuration(t, Date.now() - startedAt);
    if (outcome === 'failed') notify(t('failTitle'), `${t('failBody')} · ${name} · ${dur}`);
    else if (outcome === 'cancelled') notify(t('cancelTitle'), `${t('cancelBody')} · ${name}`);
    else notify(t('doneTitle'), `${t('doneBody')} · ${name} · ${dur}`);
  };

  const poll = async () => {
    try {
      const r = await sessions.list({});
      if (!r.result.ok) return;
      const items = r.result.value.items ?? [];
      for (const item of items) {
        if (item.running) {
          const rec = running.get(item.sessionId);
          if (rec === undefined) {
            running.set(item.sessionId, { title: item.title, startedAt: Date.now() });
          } else if (item.title !== undefined) {
            rec.title = item.title;
          }
        } else if (running.has(item.sessionId)) {
          const rec = running.get(item.sessionId);
          running.delete(item.sessionId);
          if (baseline) settle(item.sessionId, rec.title, rec.startedAt);
        }
      }
      baseline = true;
    } catch {
      // transient network error; try again on the next tick
    }
  };

  ctx.effect(() => {
    poll();
    const timer = setInterval(poll, POLL_MS);
    return () => clearInterval(timer);
  }, 'ntf: session watcher');
};