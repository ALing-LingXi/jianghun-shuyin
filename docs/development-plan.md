# 匠魂书音开发计划

## 1. 项目目标

匠魂书音是一个将中文 TXT 小说转换成分段音频的本地工具。

```text
上传 TXT / 粘贴文本
-> 解码与清洗
-> 章节识别
-> part 规划
-> TTS 分块合成
-> FFmpeg 拼接
-> 查看任务进度
-> 播放音频
```

项目用于展示前端岗位能力，重点是：

- 复杂业务页面和状态设计。
- 长任务进度、失败和局部重试。
- 播放器和移动端体验。
- TypeScript 类型建模和 API 契约。
- 测试、错误处理和可维护的代码组织。

第一版只做本地单用户，不做登录、多用户、云同步和生产部署。

## 2. 技术选型

```text
框架：Next.js + App Router
语言：TypeScript
UI：React
样式：Tailwind CSS
API：Next.js Route Handlers
请求与缓存：TanStack Query
跨页面状态：Zustand
数据库：SQLite + Drizzle ORM
数据校验：Zod
任务执行：Node Worker + p-queue
文件与命令：node:fs/promises + execa
TTS：edge-tts，封装为 TTSProvider
音频：FFmpeg，封装为 AudioAssembler
测试：Vitest + React Testing Library + Playwright
质量：ESLint + Prettier
```

选型原则：

- 页面、API、worker 和共享数据都使用 TypeScript。
- Next.js 负责页面和轻量 BFF。
- Worker 负责 TTS、FFmpeg 和长任务状态更新。
- SQLite 只服务本地 MVP。
- 只抽象 TTS、存储、数据库、音频和任务执行器。
- 文本处理保持普通函数，不为了架构增加无意义的接口。

## 3. 运行边界

```text
Next.js 页面
  -> Route Handlers：上传、查询、重试
  -> SQLite：保存书籍、任务和音频状态

Node Worker
  -> 读取任务
  -> 文本处理
  -> TTS 分块
  -> FFmpeg 拼接
  -> 更新任务进度

浏览器
  -> TanStack Query 轮询任务
  -> Zustand 管理播放器
  -> 播放 part 音频
```

Route Handler 只创建任务、查询状态和触发重试，不同步执行完整 TTS 流程。

## 4. 文件结构

```text
src/
├─ app/
│  ├─ upload/page.tsx
│  ├─ jobs/[jobId]/page.tsx
│  ├─ books/page.tsx
│  ├─ books/[bookId]/player/page.tsx
│  └─ api/**/route.ts
├─ features/
│  ├─ upload/
│  ├─ job/
│  ├─ player/
│  ├─ library/
│  └─ ui/
├─ server/
│  ├─ domain/
│  ├─ application/
│  ├─ ports/
│  ├─ infrastructure/
│  ├─ pipeline/
│  ├─ tts/
│  └─ composition/container.ts
├─ shared/
│  ├─ schemas/
│  └─ types/
└─ worker/
   ├─ index.ts
   └─ handlers/

tests/
storage/
```

目录详细职责和调用方向见 `docs/module-dependencies.md`。

## 5. 核心数据

```text
Book
- id, title, author, sourcePath, status, createdAt

Job
- id, bookId, status, stage, progress
- errorMessage, createdAt, updatedAt

Part
- id, bookId, index, title
- audioPath, durationSeconds, status

Chunk
- id, partId, index, textHash, audioPath
- status, retryCount, errorMessage
```

任务状态：

```text
queued
processing
completed
failed
cancelled
```

任务阶段：

```text
decoding
cleaning
chapter_detection
planning
tts
assembling
completed
```

## 6. 前端页面

### 上传页

支持文件拖拽、文本粘贴、书名、作者、音色、语速和开始生成。

必须处理空文本、文件类型错误、loading、失败和禁用状态。

### 任务页

展示当前阶段、总进度、part/chunk 数量、失败 chunk、错误原因和重试按钮。

轮询由 TanStack Query 管理，任务进入 `completed`、`failed` 或 `cancelled` 后停止。

### 播放页

展示当前 part、播放列表、上一段/下一段、时长、下载和移动端 MiniPlayer。

播放器跨页面状态只放在 Zustand store。

### 书架页

展示书名、作者、状态、part 数量、总时长和创建时间，并提供继续播放和查看任务入口。

## 7. MVP 里程碑

详细功能、前置依赖和验收标准见 `docs/implementation-roadmap.md`。

### M1：工程骨架

- 初始化 Next.js + TypeScript。
- 配置 Tailwind、ESLint、Prettier、Vitest。
- 建立基础目录。
- 实现 `/api/health`。

验收：页面和 API 都能启动。

### M2：类型和数据库

- 定义 Zod schema、domain 类型和状态。
- 配置 Drizzle + SQLite。
- 实现最小 repository。

验收：能创建和查询 Book、Job。

### M3：上传闭环

- 实现文件/文本上传。
- 保存原始文本。
- 创建 Book 和 Job。
- 上传后跳转任务页。

验收：数据库和 `storage/sources` 都有记录。

### M4：文本解析

- 实现解码、清洗、章节识别和 part 规划。
- 生成清洗报告。

验收：一个 TXT 能得到稳定的结构化章节和 part 计划。

### M5：Worker、TTS 和 FFmpeg

- 实现 worker。
- 实现 chunk 切分、缓存、TTS 和音频拼接。

验收：多个 chunk 能生成一个可播放的 part。

### M6：任务状态和失败恢复

- 串起完整流水线。
- 更新 job、part、chunk 状态。
- 任务页轮询真实进度。
- 支持单个 chunk 重试。

验收：失败 chunk 可以展示原因并恢复，不重跑整本书。

### M7：播放器、书架和交付

- 完成播放器、MiniPlayer 和书架。
- 补齐响应式、loading、empty、error 状态。
- 增加组件测试、关键 E2E 和 README。

验收：上传、任务、播放三条主路径在桌面端和手机端可用。

## 8. 测试和质量

优先覆盖：

```text
Vitest：编码、清洗、章节、part/chunk、RunPipelineJob
React Testing Library：Upload、JobProgress、Retry、AudioPlayer
Playwright：上传 -> 任务页、任务完成 -> 播放页
```

修改任务状态、轮询、缓存、重试、API schema 或播放器行为时必须补测试。

README 必须包含依赖安装、FFmpeg 检查、启动命令和常见故障。

## 9. 面试表达

```text
我用 Next.js 和 TypeScript 做了一个长任务驱动的听书生成工具。
前端重点解决上传、任务进度、失败恢复、播放器和移动端适配。
Route Handlers 只负责 API 入口，TTS 和 FFmpeg 放到独立 worker 中执行。
前后端通过 Zod 共享数据契约，TanStack Query 管理任务轮询和缓存，Zustand 管理播放器状态。
第一版使用 SQLite、本地文件和本地 worker 控制复杂度。
```

## 10. 第一阶段完成定义

- 可以上传或粘贴 TXT。
- 可以解码、清洗、识别章节并规划 part。
- 可以通过 worker 生成和拼接音频。
- 前端可以看到真实任务进度。
- 失败 chunk 可以单独查看和重试。
- 前端可以播放多个 part。
- 桌面端和手机端主流程可用。
- 核心 pipeline、任务用例、关键组件和主流程有测试。
- README 可以让别人本地运行。
