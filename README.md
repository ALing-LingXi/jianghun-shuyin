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

## 测试

```powershell
pnpm run typecheck
pnpm run lint
pnpm test
pnpm exec playwright test tests/e2e/books-and-player.spec.ts
```

运行 Playwright 前，先启动 Next.js，并按需要设置：

```powershell
$env:PLAYWRIGHT_BASE_URL="http://127.0.0.1:3000"
```

## 常见问题

- 如果播放器报错 `Invalid book id`，先确认 URL 里的 `bookId` 是真实 UUID。
- 如果音频生成失败，先确认项目内 FFmpeg 二进制存在。
