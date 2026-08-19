/**
 * dsh-task-notify — component stylesheet (fallback in-page toast).
 *
 * The primary path is the native desktop Notification (Electron renderer),
 * which Windows shows bottom-right like opencode. This CSS styles the in-page
 * toast used when the native API is unavailable or a notification is clicked.
 * Colors follow the active DSH skin via --dsw-* variables.
 */
export const CSS = `
.ntf-toast{position:fixed;right:16px;bottom:16px;z-index:2147483000;min-width:240px;max-width:360px;padding:12px 14px;border-radius:10px;background:var(--dsw-specific-menu,#fff);border:1px solid var(--dsw-alias-border-l3,rgba(0,0,0,.1));box-shadow:var(--dsw-shadow-lv3,0 12px 32px rgba(0,0,0,.14));color:var(--dsw-alias-label-primary,inherit);font-family:ui-monospace,SFMono-Regular,"Cascadia Mono",Menlo,Consolas,monospace;cursor:pointer;animation:ntf-in .2s ease}
.ntf-title{font-size:13px;font-weight:600;line-height:18px}
.ntf-body{font-size:12px;color:var(--dsw-alias-label-secondary,rgba(0,0,0,.6));margin-top:4px;line-height:16px;word-break:break-all}
@keyframes ntf-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
`;