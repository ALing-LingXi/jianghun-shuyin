# 匠魂书音

本地中文 TXT 听书工具。

## 准备

- Node.js
- pnpm
- 项目级 FFmpeg
  - `tools/ffmpeg/bin/ffmpeg.exe`
  - `tools/ffmpeg/bin/ffprobe.exe`
- Playwright
  - `pnpm exec playwright install`

## 启动

```powershell
pnpm install
pnpm exec playwright install
pnpm run dev
```

如果要运行 worker：

```powershell
pnpm exec tsx src/worker/index.ts
```

开发时建议分别打开两个终端：

- 终端一运行 `pnpm run dev`
- 终端二运行 worker

## 测试

```powershell
pnpm run typecheck
pnpm run lint
pnpm test
pnpm exec playwright test tests/e2e/books-and-player.spec.ts
```

Playwright 配置已经包含 `webServer`。直接运行 e2e 测试时，会自动启动
Next.js 开发服务器；如果检测到本地已有服务，则会复用已有服务。

默认测试地址为：

```powershell
http://127.0.0.1:3000
```

如果需要使用其他地址，可以在 PowerShell 中设置：

```powershell
$env:PLAYWRIGHT_BASE_URL="http://127.0.0.1:3001"
pnpm exec playwright test tests/e2e/books-and-player.spec.ts
```

修改 `next.config.ts` 后，需要重启已经运行的 Next.js 开发服务器。
当前配置允许 `127.0.0.1` 访问 Next.js 开发资源。

## 常见问题

- 如果播放器报错 `Invalid book id`，先确认 URL 里的 `bookId` 是真实 UUID。
- 如果音频生成失败，先确认项目内 FFmpeg 二进制存在。
- 如果 e2e 测试报 `ECONNREFUSED`，先确认测试使用的端口没有被其他进程占用。
- 如果出现 Next.js `Blocked cross-origin request`，停止旧的 dev server 后重新运行测试。
