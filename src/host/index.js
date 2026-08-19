/**
 * dsh-task-notify — Host half.
 *
 * A pure-UI notification bundle: the browser half watches session runs and
 * fires a desktop toast on completion. The host half has no behavior — it
 * exists so the plugin appears in the Loader and can be wired in a profile.
 */
export const name = 'dsh-task-notify';

/** @type {import('@deepseek-ai/cordis').Context} */
export function apply() {
  // No host-side behavior required for this UI-only bundle.
}