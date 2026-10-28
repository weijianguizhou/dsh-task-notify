# dsh-task-notify

DSH（DeepSeek Harness）插件：任务/Agent 运行结束时，在桌面右下角弹出完成通知（和 opencode 一样）。

面向 **DSH 0.2.x 官方 Desktop**（客户端 `@deepseek-ai/dsh-client-runtime` / `dsh-client-locale` 体系）。

## 特性

- **完成检测**：订阅客户端运行时的会话列表 `ctx.sessions.list`，观察 `running` 由 `true` 变 `false` 的那一帧（与侧边栏绿点同一事实源），不再轮询。
- **结果判定**：读取该会话快照的 `lastAgentError`，有值判为失败，否则判为完成。
- **桌面通知**：优先使用 Electron 渲染进程的原生 `Notification`（Windows 右下角系统通知）；不可用时回退为页内右下角 toast。
- **不打扰**：仅当窗口不在前台时通知；3 秒最小通知间隔防轰炸；等待用户审批/回答（`pendingInteraction`）导致的停止不误报"完成"。
- **跟随 DSH 主题**：回退 toast 的颜色取自 DSH 主题变量（`--dsw-*`）。
- **零侵入**：纯客户端增强 bundle，不修改任何官方代码。

## 安装

Desktop 的 `desktop` profile 由 Electron 托管，npm 安装的 CLI 不接受该 profile 的插件操作；请使用 Desktop 自带的命令运行时安装：

```bash
dsh plugin --profile desktop add link:/path/to/dsh-task-notify
```

或在 Desktop 的 **设置 → 插件** 里以开发目标（`link:`）添加，并确保它出现在 profile 的 `dsh.profile.bundles` 列表中。装完重启 DSH Desktop 即生效。

## 开发构建

```bash
npm install          # 安装 esbuild
npm run build:client # 构建 client bundle 到 lib/client.js
npm run check        # 语法检查
```

## 工作原理

1. 客户端 bundle（`lib/client.js`）以 `dsh.client.platform: web` 声明，宿主端的 `ClientModuleRegistry` 扫描已启用的 Loader 条目，经 `/plugins/dsh-task-notify/client.js` 下发；bundle 采用惰性 CJS 工厂形式（`window.__ModuleLoader__.load({ id, factory })`），执行时只注册工厂。
2. 插件 `inject: ['sessions', 'locale']`，订阅 `ctx.sessions.list`（`ObservableSnapshot<SessionListState>`）。
3. 某行 `running` 由真变假时，读取 `ctx.sessions.binding(id).session.getSnapshot().lastAgentError` 判定失败与否，并用首次观测到运行的时间算时长。
4. 窗口未聚焦时用原生 `Notification` 弹通知；失败则渲染页内 `.ntf-toast`。

> 说明：0.2.x 起客户端不再暴露 `connection.api.sessions.history`，`turn/end` 的 `reason` 只在被打开的会话窗口内可见，因此后台会话的"取消/轮次内失败"无法区分，统一按"完成"处理，只有带 `lastAgentError` 的失败会被标记。

## 目录结构

```
src/client/       客户端逻辑（index.js）与回退 toast 样式（styles.js）
src/host/         host 侧占位入口
scripts/          esbuild 构建脚本
lib/              构建产物（client bundle）
cordis.patch.yml  bundle 补丁：插入插件行
```

## 兼容性

`package.json` 声明 `engines.dsh: ">=0.2.1-rc.1 <0.3.0"`，安装与 profile 启动时会按该范围校验；旧版（`connection.api.sessions` 时代）不兼容。

## License

MIT
