# dsh-task-notify

DSH（DeepSeek Harness）插件：任务/Agent 运行结束时，在桌面右下角弹出完成通知（和 opencode 一样）。

## 特性

- **任务完成检测**：轮询 `sessions.list`，检测"正在运行 → 停止"的会话（与任务看板同一机制）。
- **结果判定**：读取 `sessions.history` 的 `turn/end` 事件，区分成功 / 失败 / 取消。
- **桌面通知**：优先使用 Electron 渲染进程的原生 `Notification`（Windows 右下角系统通知）；不可用时回退为页内右下角 toast。
- **不打扰**：仅当窗口不在前台时通知；4 秒轮询 + 3 秒最小通知间隔防轰炸。
- **跟随 DSH 主题**：回退 toast 的颜色取自 DSH 主题变量（`--dsw-*`）。
- **零侵入**：纯客户端增强 bundle，不修改任何官方代码。

## 安装

在目标 profile 中作为 link 依赖安装并加入 bundle 层：

```bash
dsh plugin --profile desktop add link:/path/to/dsh-task-notify
```

或在 `profiles/<name>/package.json` 手动加入依赖，并确保它出现在 `dsh.profile.bundles` 列表中。装完重启 DSH Desktop 即生效。

## 开发构建

```bash
npm install          # 安装 esbuild
npm run build:client # 构建 client bundle 到 lib/client.js
npm run check        # 语法检查
```

## 工作原理

1. 客户端 bundle（`lib/client.js`）以 `dsh.client.platform: web` 注册，由 harness 的 `ClientModuleRegistry` 扫描进 manifest，经 `/plugins/dsh-task-notify/client.js` 下发到浏览器。
2. 插件每 4s 调用 `connection.api.sessions.list({})`，维护"运行中会话"集合。
3. 会话从运行中变为停止时，调用 `connection.api.sessions.history({ sessionId })` 取 `turn/end` 事件：`reason.kind === 'error'` 判为失败，`cancelled/aborted` 判为取消，否则成功。
4. 窗口未聚焦时用原生 `Notification` 弹通知；失败则渲染页内 `.ntf-toast`。

## 目录结构

```
src/client/       客户端逻辑（index.js）与回退 toast 样式（styles.js）
src/host/         host 侧占位入口
scripts/          esbuild 构建脚本
lib/              构建产物（client bundle）
cordis.patch.yml  bundle 补丁：插入插件行
```

## License

MIT