# 匠魂书音

匠魂书音是一个本地中文 TXT 听书工具。它把上传或粘贴的小说文本转换成可分章节播放的音频，并提供任务进度、失败重试、书架和播放器体验。

这个项目不是一个简单的上传页 demo，而是围绕“长文本转音频”这个真实工作流做的前端与全栈工程练习：文本解析、异步任务、TTS 调用、FFmpeg 拼接、状态轮询、局部失败恢复和播放器状态都被拆成可维护的模块。

## 为什么做这个项目

中文网文、资料和长篇 TXT 很适合听，但手动复制到 TTS 工具里通常会遇到几个问题：

- 文本太长，一次性合成容易失败，也不方便中途继续听。
- 章节标题、广告行、空行和编码问题会影响听感。
- TTS 网络调用不稳定，一个小片段失败不应该导致整本书重跑。
- 浏览器播放本地生成音频时，需要稳定的音频 URL、Range 响应和跨页面播放状态。
- 生成一本书可能耗时很久，用户需要看到任务处于哪个阶段，失败后也要能局部重试。

所以这个项目选择把 TXT 转音频拆成一条可观察、可恢复的流水线，而不是在页面请求里同步生成音频。

## 当前能力

- 上传 TXT 文件或粘贴文本，创建本地书籍与生成任务。
- 支持中文文本解码、清洗、章节识别和 part 规划。
- 支持 edge-tts 音色选择，默认音色为 `zh-CN-YunxiNeural`（云溪）。
- Worker 异步执行 TTS 和 FFmpeg，不在 Route Handler 中执行长任务。
- 支持多本书并发推进、单个 part 内 chunk 并发合成，并共享全局 TTS 并发限制。
- TTS chunk 支持有限次数重试，失败时保留真实错误信息。
- 单个章节失败后，任务可以进入 `completed_with_errors`，成功章节仍可播放。
- 支持暂停、恢复、失败 part 重试。
- FFmpeg 拼接成功后删除对应 chunk 小音频，并清空 `chunks.audioPath`，保留 chunk 数据库记录用于审计。
- 播放器 API 支持 `Accept-Ranges` 和 `206 Partial Content`，适配浏览器音频播放。
- 书架、任务页、播放器页使用 TanStack Query 轮询，跨页面播放状态使用 Zustand。
- 使用 Zod 约束 API DTO，前端、Route Handler 和测试复用共享 schema。
- 覆盖 Vitest 单元测试、应用层测试和 Playwright 主流程测试。

## 解决的痛点和难点

### 1. 长任务不能阻塞请求

TTS 和 FFmpeg 都属于慢操作。如果在上传接口中直接执行，会导致请求超时、页面无法响应，也很难展示进度。

项目把上传和生成拆开：

```text
上传 / 粘贴文本
-> 创建 Book + Job
-> 页面跳转任务页
-> Worker 后台推进流水线
-> 前端轮询任务状态
```

Route Handler 只负责参数校验、调用 application use case 和返回 DTO；真正的长任务由 `src/worker` 和 `LocalJobRunner` 推进。

### 2. TTS 不稳定，失败要局部恢复

edge-tts 可能因为网络、超时、连接断开或服务端限制失败。整本书重跑成本太高，因此项目把 part 再切成 chunk：

```text
Part
-> Chunk 0
-> Chunk 1
-> Chunk 2
-> ...
```

每个 chunk 独立记录：

- `index`
- `textHash`
- `status`
- `retryCount`
- `errorMessage`
- `audioPath`

这样可以做到一个 chunk 失败只标记当前 chunk，错误信息也能显示到任务和播放器界面。

### 3. 并发要快，但不能失控

单线程生成一本书会非常慢，但无限并发又容易触发 TTS 限流或把本地 FFmpeg/文件系统压垮。

当前默认并发策略：

```text
JOB_CONCURRENCY = 2
PER_PART_TTS_CONCURRENCY = 2
GLOBAL_TTS_CONCURRENCY = 3
ASSEMBLE_CONCURRENCY = 1
TTS_MAX_ATTEMPTS = 5
```

含义：

- 多本书可以同时推进。
- 单个章节内部可以并发合成多个 chunk。
- 所有 TTS 调用共享全局 limiter。
- FFmpeg 拼接默认串行，避免多个拼接任务同时抢资源。

### 4. 拼接后的 chunk 文件要清理，但记录不能丢

chunk 小音频只是 FFmpeg 拼接前的中间产物。拼接成功后继续保留会浪费磁盘空间。

当前行为：

- part 拼接成功后删除对应 chunk 小音频。
- 删除后把这些 chunk 的 `audioPath` 更新为 `null`。
- FFmpeg 拼接失败时不删除 chunk 音频，方便排查和重试。
- chunk 数据库记录仍保留，用于状态、错误、重试次数和 textHash 审计。

### 5. 浏览器音频播放需要 Range 支持

浏览器 `<audio>` 经常会请求部分字节，例如 `Range: bytes=0-`。如果接口只返回完整文件，可能出现后端已生成音频但前端无法播放的问题。

播放器音频接口支持：

- `Accept-Ranges: bytes`
- `Content-Length`
- `Content-Range`
- `206 Partial Content`
- 非法 Range 返回 `416`

## 架构概览

```text
浏览器页面
  -> src/features
  -> Route Handler
  -> application use case
  -> ports
  -> infrastructure

Worker
  -> application use case
  -> pipeline / tts
  -> ports
  -> infrastructure
```

核心原则：

- 页面不直接访问数据库、文件系统、FFmpeg 或 TTS。
- Route Handler 不执行完整 TTS/FFmpeg 流程。
- application 编排业务，但不依赖 Next.js、React、Drizzle 或具体 provider。
- pipeline 只做纯文本处理，不访问数据库和 storage。
- TTS 通过 `TTSProvider`，FFmpeg 通过 `AudioAssembler`。
- 具体实现集中在 infrastructure，依赖组装集中在 container。

## 目录结构

```text
src/
├─ app/                         页面、布局、Route Handlers
├─ features/                    上传、任务、书架、播放器等前端功能
├─ shared/                      Zod schema、共享类型、常量
├─ server/
│  ├─ domain/                   实体、状态、业务错误
│  ├─ application/              业务用例编排
│  ├─ ports/                    Repository、Storage、TTS、Audio 等接口
│  ├─ infrastructure/           SQLite、LocalStorage、edge-tts、FFmpeg、JobRunner
│  ├─ pipeline/                 解码、清洗、章节识别、part 规划
│  ├─ tts/                      chunk 切分、缓存 key、重试和并发控制
│  └─ composition/container.ts  依赖组装
└─ worker/                      长任务入口

tests/                          Vitest、React Testing Library、Playwright 测试
storage/                        本地运行数据：数据库、源文本、音频和报告
tools/ffmpeg/bin/               项目级 FFmpeg 二进制
```

## 核心数据模型

```text
Book
- id
- title
- author
- sourcePath
- status
- createdAt

Job
- id
- bookId
- status
- stage
- progress
- voice / rate / pitch
- errorMessage
- createdAt / updatedAt

Part
- id
- bookId
- index
- title
- audioPath
- durationSeconds
- status

Chunk
- id
- partId
- index
- textHash
- audioPath
- status
- retryCount
- errorMessage
```

常见状态：

```text
Job: queued / processing / paused / completed / completed_with_errors / failed / cancelled
Stage: decoding / cleaning / chapter_detection / planning / tts / assembling / completed
Part: pending / processing / tts / assembling / completed / failed / cancelled
Chunk: pending / processing / completed / failed
```

## 生成流水线

```text
1. 上传 TXT 或粘贴文本
2. 保存源文本到 storage/sources
3. 创建 Book 和 Job
4. Worker 读取 queued / processing job
5. 解码源文本
6. 清洗空白、广告行和异常格式
7. 识别章节
8. 规划 part
9. 按 part 切分 TTS chunk
10. 并发合成 chunk 音频
11. 按 chunk.index 排序后交给 FFmpeg 拼接
12. 写入 part 音频路径和时长
13. 清理中间 chunk 音频
14. 更新 job 为 completed 或 completed_with_errors
15. 播放器读取 part 列表并播放
```

## 技术栈

```text
Next.js + App Router
TypeScript
React
Tailwind CSS
TanStack Query
Zustand
SQLite + Drizzle ORM
Zod
Node Worker
edge-tts
FFmpeg
Vitest
React Testing Library
Playwright
ESLint
Prettier
```

## 本地准备

需要安装：

- Node.js
- pnpm
- Playwright 浏览器
- 项目级 FFmpeg

FFmpeg 文件位置：

```text
tools/ffmpeg/bin/ffmpeg.exe
tools/ffmpeg/bin/ffprobe.exe
```

安装依赖和 Playwright 浏览器：

```powershell
pnpm install
pnpm exec playwright install
```

## 启动开发环境

开发时建议打开两个终端。

终端一启动 Next.js：

```powershell
pnpm run dev
```

终端二启动 worker：

```powershell
pnpm exec tsx src/worker/index.ts
```

默认访问：

```text
http://127.0.0.1:3000
```

## 测试

常用验证命令：

```powershell
pnpm run typecheck
pnpm run lint
pnpm test
pnpm exec playwright test tests/e2e/books-and-player.spec.ts
```

Playwright 配置包含 `webServer`。直接运行 e2e 测试时会自动启动 Next.js 开发服务器；如果本地已有服务，则会复用已有服务。

默认测试地址：

```text
http://127.0.0.1:3000
```

如果需要指定其他地址：

```powershell
$env:PLAYWRIGHT_BASE_URL="http://127.0.0.1:3001"
pnpm exec playwright test tests/e2e/books-and-player.spec.ts
```

修改 `next.config.ts` 后，需要重启已经运行的 Next.js 开发服务器。当前配置允许 `127.0.0.1` 访问 Next.js 开发资源。

## 当前边界

这是本地单用户 MVP，不包含：

- 登录和多用户权限。
- 云同步。
- 对象存储。
- Redis / BullMQ / 分布式 worker。
- SSE / WebSocket 实时推送。
- 生产部署方案。

这些能力不是技术上不能做，而是当前版本刻意收敛范围，把重点放在本地完整闭环、任务可观察性、错误恢复和前端体验上。

## 后续计划

- 增加更完整的书籍封面和图片资源管理。
- 优化任务页的 chunk 级错误展示和重试交互。
- 增加音频下载、播放进度记忆和更细的移动端播放体验。
- 为长文本解析增加更多样本和边界测试。
- 提供历史残留中间音频的安全清理工具。
- 在不改变 MVP 边界的前提下继续优化 UI 视觉层次。

## 常见问题

- 如果播放器报错 `Invalid book id`，先确认 URL 里的 `bookId` 是真实 UUID。
- 如果音频生成失败，先确认项目内 FFmpeg 二进制存在。
- 如果 worker 报 `ENOENT` 且指向 `storage/sources`，说明数据库里还有旧任务，但源文本文件已被删除。可以停止 dev server 和 worker 后清理数据库，再重新上传。
- 如果删除 `storage/jianghun-shuyin.db` 失败，先停止占用数据库的 Next.js 或 worker 进程。
- 如果 e2e 测试报 `ECONNREFUSED`，先确认测试使用的端口没有被其他进程占用。
- 如果出现 Next.js `Blocked cross-origin request`，停止旧的 dev server 后重新运行测试。
