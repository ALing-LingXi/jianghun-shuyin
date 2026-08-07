# 匠魂书音开发计划书

## 1. 项目定位

匠魂书音是一个面向个人使用的本地听书生成工具，核心目标是把中文 TXT 小说转换成可播放、可管理、可恢复的分段音频。

第一阶段不追求完整平台化，不做登录、多用户、云端同步和复杂部署。项目先围绕一条稳定闭环展开：

```text
上传 TXT 或粘贴文本
-> 自动识别编码
-> 文本清洗
-> 章节识别
-> 听书分段规划
-> TTS 分块合成
-> FFmpeg 拼接音频
-> 前端任务进度展示
-> 前端播放器播放
```

面试包装方向：这是一个以前端岗位为主线的 TypeScript 全栈项目。项目重点展示复杂业务 UI、长任务状态管理、播放器体验、移动端适配、API 契约建模、前后端类型一致性和工程化测试能力。后端与 worker 作为真实业务复杂度的支撑层，不抢前端主线。

## 2. 技术选型总览

### 2.1 推荐技术栈

```text
应用框架：Next.js + App Router
语言：TypeScript
UI：React
样式：Tailwind CSS + CSS variables
服务端 API：Next.js Route Handlers
长任务执行：独立 Node.js Worker + p-queue
数据库：SQLite
ORM / Query Builder：Drizzle ORM
运行时校验：Zod
客户端请求：TanStack Query
客户端状态：Zustand
文件与命令执行：Node fs/promises + execa
TTS：edge-tts CLI / 可替换 TTSProvider
音频处理：FFmpeg
单元测试：Vitest
组件测试：React Testing Library
接口 Mock：MSW
端到端测试：Playwright
代码质量：ESLint + Prettier
```

### 2.2 为什么用 Next.js + TypeScript

这个项目面向大厂前端岗位，技术栈应优先服务前端能力表达。Next.js + TypeScript 比“React 前端 + Python 后端”更适合作品集叙事：

- 前后端都在 TypeScript 体系内，能展示类型建模能力。
- Zod schema 可以同时承担运行时校验和类型推导。
- Route Handlers 适合做 BFF/API 层，和前端页面关系清楚。
- TanStack Query 可以消费强类型 API，展示缓存、轮询、错误恢复和请求状态设计。
- Zustand 只管理跨页面播放器状态，职责边界清晰。
- Next.js App Router 可以展示 Server Components、Client Components 和数据边界设计。
- 独立 worker 承担长任务，避免把 TTS/FFmpeg 这类慢任务塞进请求生命周期。

### 2.3 为什么不用 Python 后端

Python 做文本处理和音频 pipeline 很方便，但它会让面试叙事分叉。当前项目的目标不是证明后端算法脚本能力，而是证明前端工程能力和 TypeScript 全栈协作能力。

如果继续使用 Python，面试官容易追问：

```text
为什么前端岗项目不用 Node.js / TypeScript？
前后端类型契约如何保证？
Python 后端能力和前端岗位有什么直接关系？
```

因此第一版改为 TypeScript 全栈。文本清洗、章节识别、TTS 编排和 FFmpeg 调用都可以在 Node.js 中完成。真正的关键不是语言能不能做，而是技术栈是否服务面试主线。

### 2.4 Next.js 的边界

Next.js 负责页面、BFF 和轻量 API，不直接承担长时间音频生成任务。

推荐边界：

```text
Next.js Route Handler
-> 接收上传 / 创建任务 / 查询任务 / 触发重试

Node Worker
-> 解码 / 清洗 / 分章 / 分段 / TTS / FFmpeg / 状态落库

Frontend
-> 上传体验 / 任务进度 / 失败恢复 / 播放器 / 移动端布局
```

这样既能利用 Next.js 的前端工程优势，又不会把长任务放在不稳定的 HTTP 请求生命周期里。

## 3. 架构原则

第一版采用“Next.js BFF + 独立 Worker + 轻量端口适配器”，不做完整企业级 Clean Architecture。

目标是在个人开发和 Codex 协作可实现的前提下，降低核心业务与外部依赖之间的耦合，同时让前端主线足够突出。

核心原则：

```text
app/ 负责页面路由、布局和前端交互入口
features/ 按业务功能组织前端组件、hooks、store
server/api 负责 Route Handler 和 DTO
server/application 负责编排业务用例
server/domain 保存核心实体、状态和错误
server/ports 定义可替换外部依赖
server/infrastructure 实现具体技术方案
server/pipeline 保持纯函数/纯模块，便于测试
worker 负责长任务执行，不依赖 React 页面
shared 保存前后端共享 schema、类型和常量
```

推荐依赖方向：

```text
app -> features -> shared
features -> server/client-api-types 或 shared
server/api -> server/application -> server/ports -> server/domain
server/infrastructure -> server/ports
server/pipeline -> server/domain 或 shared
worker -> server/application
```

第一版必须抽象的外部依赖：

```text
TTSProvider          # edge-tts 未来可能替换成 Azure/OpenAI/本地 TTS
FileStorage          # 本地文件未来可能替换成对象存储
JobRepository        # SQLite 未来可能替换成 PostgreSQL
AudioAssembler       # FFmpeg 调用需要隔离
ProgressPublisher    # 轮询未来可能替换成 SSE/WebSocket
JobRunner            # 本地 worker 未来可能替换成队列系统
```

第一版不抽象的核心算法：

```text
decodeText
cleanText
detectChapters
splitChapter
planParts
buildChunks
estimateDuration
```

这些模块是项目的核心能力，优先保持简单、可测试、可读。后续只有在出现多个实现或明显变化点时再抽象。

## 4. 项目文件架构

```text
jianghun-audio-book/
├─ README.md
├─ package.json
├─ pnpm-workspace.yaml
├─ next.config.ts
├─ tsconfig.json
├─ eslint.config.mjs
├─ prettier.config.mjs
├─ .env.example
├─ drizzle.config.ts
│
├─ docs/
│  ├─ development-plan.md
│  ├─ architecture.md
│  ├─ api-contract.md
│  ├─ pipeline.md
│  └─ interview-notes.md
│
├─ src/
│  ├─ app/
│  │  ├─ layout.tsx
│  │  ├─ page.tsx                         # 上传页或书架页入口
│  │  ├─ globals.css
│  │  ├─ upload/
│  │  │  └─ page.tsx
│  │  ├─ jobs/
│  │  │  └─ [jobId]/
│  │  │     └─ page.tsx
│  │  ├─ books/
│  │  │  ├─ page.tsx
│  │  │  └─ [bookId]/
│  │  │     └─ player/
│  │  │        └─ page.tsx
│  │  └─ api/
│  │     ├─ health/
│  │     │  └─ route.ts
│  │     ├─ uploads/
│  │     │  ├─ file/
│  │     │  │  └─ route.ts
│  │     │  └─ text/
│  │     │     └─ route.ts
│  │     ├─ jobs/
│  │     │  ├─ [jobId]/
│  │     │  │  └─ route.ts
│  │     │  └─ [jobId]/
│  │     │     └─ retry/
│  │     │        └─ route.ts
│  │     ├─ chunks/
│  │     │  └─ [chunkId]/
│  │     │     └─ retry/
│  │     │        └─ route.ts
│  │     ├─ books/
│  │     │  ├─ route.ts
│  │     │  └─ [bookId]/
│  │     │     └─ route.ts
│  │     └─ player/
│  │        └─ books/
│  │           └─ [bookId]/
│  │              └─ route.ts
│  │
│  ├─ features/
│  │  ├─ upload/
│  │  │  ├─ components/
│  │  │  │  ├─ FileDropzone.tsx
│  │  │  │  ├─ PasteTextBox.tsx
│  │  │  │  └─ TtsSettings.tsx
│  │  │  ├─ hooks/
│  │  │  │  └─ useUpload.ts
│  │  │  └─ api.ts
│  │  ├─ job/
│  │  │  ├─ components/
│  │  │  │  ├─ PipelineSteps.tsx
│  │  │  │  ├─ JobProgress.tsx
│  │  │  │  ├─ ChunkStatusList.tsx
│  │  │  │  └─ RetryPanel.tsx
│  │  │  ├─ hooks/
│  │  │  │  └─ useJobPolling.ts
│  │  │  └─ api.ts
│  │  ├─ player/
│  │  │  ├─ components/
│  │  │  │  ├─ AudioPlayer.tsx
│  │  │  │  ├─ PlaybackControls.tsx
│  │  │  │  ├─ PartList.tsx
│  │  │  │  └─ MiniPlayer.tsx
│  │  │  ├─ hooks/
│  │  │  │  └─ usePlayer.ts
│  │  │  ├─ stores/
│  │  │  │  └─ playerStore.ts
│  │  │  └─ api.ts
│  │  ├─ library/
│  │  │  ├─ components/
│  │  │  │  ├─ BookCard.tsx
│  │  │  │  └─ BookMetaPanel.tsx
│  │  │  ├─ hooks/
│  │  │  │  └─ useBooks.ts
│  │  │  └─ api.ts
│  │  └─ ui/
│  │     ├─ Button.tsx
│  │     ├─ Dialog.tsx
│  │     ├─ Progress.tsx
│  │     └─ Toast.tsx
│  │
│  ├─ server/
│  │  ├─ application/
│  │  │  ├─ createBookJob.ts
│  │  │  ├─ runPipelineJob.ts
│  │  │  ├─ retryChunk.ts
│  │  │  ├─ queryJob.ts
│  │  │  └─ queryPlayer.ts
│  │  ├─ domain/
│  │  │  ├─ entities.ts
│  │  │  ├─ states.ts
│  │  │  └─ errors.ts
│  │  ├─ ports/
│  │  │  ├─ repositories.ts
│  │  │  ├─ storage.ts
│  │  │  ├─ tts.ts
│  │  │  ├─ audio.ts
│  │  │  ├─ progress.ts
│  │  │  └─ jobRunner.ts
│  │  ├─ infrastructure/
│  │  │  ├─ db/
│  │  │  │  ├─ client.ts
│  │  │  │  ├─ schema.ts
│  │  │  │  ├─ migrations/
│  │  │  │  └─ repositories.ts
│  │  │  ├─ localStorage.ts
│  │  │  ├─ edgeTtsProvider.ts
│  │  │  ├─ ffmpegAudio.ts
│  │  │  ├─ pollingProgress.ts
│  │  │  └─ localJobRunner.ts
│  │  ├─ pipeline/
│  │  │  ├─ decodeText.ts
│  │  │  ├─ cleanText.ts
│  │  │  ├─ detectChapters.ts
│  │  │  ├─ splitChapter.ts
│  │  │  ├─ planParts.ts
│  │  │  ├─ estimateDuration.ts
│  │  │  └─ buildReport.ts
│  │  ├─ tts/
│  │  │  ├─ voiceCatalog.ts
│  │  │  ├─ buildChunks.ts
│  │  │  ├─ chunkCache.ts
│  │  │  └─ retryPolicy.ts
│  │  ├─ composition/
│  │  │  └─ container.ts
│  │  └─ utils/
│  │     ├─ hashing.ts
│  │     └─ time.ts
│  │
│  ├─ shared/
│  │  ├─ schemas/
│  │  │  ├─ book.schema.ts
│  │  │  ├─ job.schema.ts
│  │  │  ├─ player.schema.ts
│  │  │  └─ upload.schema.ts
│  │  ├─ types/
│  │  │  ├─ book.ts
│  │  │  ├─ job.ts
│  │  │  ├─ player.ts
│  │  │  └─ tts.ts
│  │  └─ constants.ts
│  │
│  └─ worker/
│     ├─ index.ts
│     ├─ queue.ts
│     └─ handlers/
│        ├─ runPipelineJob.handler.ts
│        └─ retryChunk.handler.ts
│
├─ tests/
│  ├─ pipeline/
│  │  ├─ decodeText.test.ts
│  │  ├─ cleanText.test.ts
│  │  ├─ detectChapters.test.ts
│  │  ├─ planParts.test.ts
│  │  └─ buildChunks.test.ts
│  ├─ application/
│  │  ├─ createBookJob.test.ts
│  │  └─ runPipelineJob.test.ts
│  ├─ components/
│  │  ├─ JobProgress.test.tsx
│  │  └─ AudioPlayer.test.tsx
│  ├─ e2e/
│  │  ├─ upload-to-job.spec.ts
│  │  └─ player.spec.ts
│  └─ mocks/
│     ├─ server.ts
│     └─ handlers.ts
│
├─ storage/
│  ├─ sources/
│  ├─ cleaned/
│  ├─ reports/
│  ├─ chunks/
│  └─ parts/
│
└─ scripts/
   ├─ dev.ps1
   ├─ worker.ps1
   ├─ init-db.ps1
   ├─ check-ffmpeg.ps1
   └─ seed-sample.ps1
```

## 5. 后端与 Worker 模块拆分

### 5.1 domain：核心数据和状态

目标：定义业务语言，不依赖 Next.js、React、Drizzle、edge-tts、FFmpeg。

文件：

```text
src/server/domain/entities.ts
src/server/domain/states.ts
src/server/domain/errors.ts
```

小任务：

- 定义 Book、Job、Part、Chunk 数据结构。
- 定义 JobStatus、JobStage、PartStatus、ChunkStatus。
- 定义业务错误类型。
- 所有实体只保存业务字段，不携带数据库 ORM 行为。

验收标准：

- domain 文件不导入 Next.js、React、Drizzle、edge-tts、execa。
- 业务状态命名统一，前端和后端可以稳定映射。

### 5.2 shared：类型契约和校验

目标：把前后端共同依赖的 DTO、schema 和常量集中管理。

文件：

```text
src/shared/schemas/*.schema.ts
src/shared/types/*.ts
src/shared/constants.ts
```

小任务：

- 用 Zod 定义上传、任务、书籍、播放器 DTO。
- 从 Zod schema 推导 TypeScript 类型。
- 前端 api、Route Handlers、测试 mock 都复用同一套契约。

验收标准：

- API 响应结构变化时，前端类型能同步暴露错误。
- Route Handlers 必须对入参做 Zod 校验。
- MSW mock 使用 shared schema 对齐数据形状。

### 5.3 ports：外部依赖抽象

目标：把未来可能替换的技术实现隔离出去。

文件：

```text
src/server/ports/repositories.ts
src/server/ports/storage.ts
src/server/ports/tts.ts
src/server/ports/audio.ts
src/server/ports/progress.ts
src/server/ports/jobRunner.ts
```

接口：

```text
BookRepository
JobRepository
PartRepository
ChunkRepository
FileStorage
TTSProvider
AudioAssembler
ProgressPublisher
JobRunner
```

验收标准：

- application 只依赖 ports，不依赖 infrastructure。
- 替换 SQLite、edge-tts、FFmpeg、本地 worker 时，不需要修改 pipeline 算法。

### 5.4 infrastructure：具体实现

目标：实现第一版实际运行需要的外部能力。

文件：

```text
src/server/infrastructure/db/client.ts
src/server/infrastructure/db/schema.ts
src/server/infrastructure/db/repositories.ts
src/server/infrastructure/localStorage.ts
src/server/infrastructure/edgeTtsProvider.ts
src/server/infrastructure/ffmpegAudio.ts
src/server/infrastructure/pollingProgress.ts
src/server/infrastructure/localJobRunner.ts
```

小任务：

- Drizzle + SQLite 实现 repository 端口。
- localStorage 实现 FileStorage。
- edgeTtsProvider 实现 TTSProvider。
- ffmpegAudio 通过 execa 调用 FFmpeg，实现 AudioAssembler。
- pollingProgress 将进度写入数据库，供前端轮询。
- localJobRunner 将 jobId 投递给本地 worker。

验收标准：

- infrastructure 可以导入第三方库和系统工具。
- application 不直接 import infrastructure 的具体类，统一在 composition/container.ts 组装。
- 后续替换 PostgreSQL、对象存储、SSE、队列系统时主要改 infrastructure。

### 5.5 pipeline：文本处理核心

目标：保持纯业务模块，便于测试和复用。

文件：

```text
src/server/pipeline/decodeText.ts
src/server/pipeline/cleanText.ts
src/server/pipeline/detectChapters.ts
src/server/pipeline/splitChapter.ts
src/server/pipeline/planParts.ts
src/server/pipeline/estimateDuration.ts
src/server/pipeline/buildReport.ts
```

小任务：

- decodeText 支持 UTF-8、UTF-8 BOM、GBK、Big5。
- cleanText 合并空行、去广告行、生成清洗报告。
- detectChapters 识别常见中文章节标题。
- splitChapter 处理超长章节。
- planParts 规划 20 到 40 分钟 part。
- buildReport 输出清洗、分章、分段结果。

验收标准：

- pipeline 不写数据库。
- pipeline 不直接读写项目 storage。
- pipeline 输入文本，输出结构化结果。
- 单元测试覆盖核心边界。

### 5.6 tts：chunk 构建与缓存

目标：长文本稳定合成，失败时只重试小块。

文件：

```text
src/server/tts/voiceCatalog.ts
src/server/tts/buildChunks.ts
src/server/tts/chunkCache.ts
src/server/tts/retryPolicy.ts
src/server/utils/hashing.ts
```

小任务：

- 提供中文默认音色。
- 将 part 文本切成 800 到 1500 字左右的 chunk。
- 优先按段落和句号切分。
- 缓存 key 包含 voice、rate、pitch、textHash。
- 命中缓存时复用已有音频。
- 失败时支持指数退避。

验收标准：

- 相同文本和参数不会重复合成。
- 修改 voice 或 rate 后不会误用旧缓存。
- buildChunks 不依赖 edge-tts 具体实现。

### 5.7 application：用例编排

目标：串起业务流程，但不绑定具体外部实现。

文件：

```text
src/server/application/createBookJob.ts
src/server/application/runPipelineJob.ts
src/server/application/retryChunk.ts
src/server/application/queryJob.ts
src/server/application/queryPlayer.ts
```

用例：

```text
CreateBookJob
RunPipelineJob
RetryChunk
QueryJob
QueryPlayer
```

验收标准：

- application 可以用 fake repository、fake TTS、fake storage 做测试。
- runPipelineJob 不直接调用 Drizzle。
- runPipelineJob 不直接使用 edge-tts。
- runPipelineJob 不直接拼接文件系统路径。

### 5.8 app/api：Route Handlers

目标：对前端暴露稳定 API，不承载业务细节。

接口：

```text
GET /api/health
POST /api/uploads/file
POST /api/uploads/text
GET /api/jobs/{jobId}
POST /api/jobs/{jobId}/retry
POST /api/chunks/{chunkId}/retry
GET /api/books
GET /api/books/{bookId}
GET /api/player/books/{bookId}
```

验收标准：

- Route Handler 只做参数校验、调用 use case、返回 DTO。
- Route Handler 不直接调用 cleanText、edge-tts、FFmpeg。
- API 响应结构和 shared schema 对齐。

## 6. 前端开发计划

### 6.1 前端架构原则

前端按功能域组织，不让页面组件承担复杂业务逻辑。

```text
app 页面负责路由、布局和服务端入口
features/*/components 负责业务组件
features/*/hooks 负责请求、轮询和交互状态
features/*/api 负责 HTTP 调用
features/player/stores 负责跨页面播放器状态
shared/schemas 负责数据契约
```

页面组件不要直接写复杂请求、轮询、播放器状态和错误恢复逻辑。

### 6.2 上传页

文件：

```text
src/app/upload/page.tsx
src/features/upload/components/FileDropzone.tsx
src/features/upload/components/PasteTextBox.tsx
src/features/upload/components/TtsSettings.tsx
src/features/upload/hooks/useUpload.ts
```

展示：

```text
TXT 文件拖拽上传
粘贴文本输入框
书名
作者
音色选择
语速选择
目标分段时长
开始生成按钮
```

验收标准：

- 能上传文件。
- 能粘贴文本。
- 提交后跳转任务页。
- loading、error、disabled 状态完整。

### 6.3 任务进度页

文件：

```text
src/app/jobs/[jobId]/page.tsx
src/features/job/components/PipelineSteps.tsx
src/features/job/components/JobProgress.tsx
src/features/job/components/ChunkStatusList.tsx
src/features/job/components/RetryPanel.tsx
src/features/job/hooks/useJobPolling.ts
```

展示：

```text
当前阶段
总进度
阶段进度
part 完成数
chunk 完成数
失败 chunk 数
流水线步骤
失败详情
重试按钮
完成后进入播放器按钮
```

验收标准：

- 任务状态每 1 到 3 秒刷新。
- 任务失败原因清楚。
- 失败 chunk 可见。
- 完成后可以跳转播放页。
- 轮询停止条件明确，不在完成后继续请求。

### 6.4 播放页

文件：

```text
src/app/books/[bookId]/player/page.tsx
src/features/player/components/AudioPlayer.tsx
src/features/player/components/MiniPlayer.tsx
src/features/player/components/PartList.tsx
src/features/player/components/PlaybackControls.tsx
src/features/player/stores/playerStore.ts
src/features/player/hooks/usePlayer.ts
```

展示：

```text
当前播放 part
音频播放器
上一段
下一段
播放列表
每段标题范围
每段时长
下载音频
移动端底部 MiniPlayer
```

验收标准：

- 可以播放生成的 mp3。
- 可以切换 part。
- 刷新页面后能重新加载播放列表。
- 手机宽度下播放器可用。
- 播放器状态不散落在多个页面组件里。

### 6.5 本地书架页

文件：

```text
src/app/books/page.tsx
src/features/library/components/BookCard.tsx
src/features/library/components/BookMetaPanel.tsx
src/features/library/hooks/useBooks.ts
```

展示：

```text
书名
作者
生成状态
part 数量
总时长
创建时间
继续播放
查看任务
```

验收标准：

- 能看到历史书籍。
- 可以进入播放页。
- 可以进入任务页。
- 空状态和错误状态可用。

## 7. MVP 实现顺序

### Milestone 1：Next.js 工程骨架

- 创建 Next.js + TypeScript 项目。
- 配置 Tailwind、ESLint、Prettier。
- 创建 app、features、server、shared、worker 基础目录。
- 实现 `GET /api/health`。
- 前端展示服务健康状态。

完成标志：

- Next.js 能启动。
- 前端能调用 `/api/health`。

### Milestone 2：类型契约和数据库

- 定义 shared Zod schemas。
- 定义 domain entities/states。
- 定义 Drizzle schema。
- 初始化 SQLite。
- 实现基础 repository。

完成标志：

- API DTO 和前端类型来自同一套 schema。
- 数据库能创建 Book 和 Job。

### Milestone 3：上传闭环

- 实现 CreateBookJob。
- 实现上传文件和粘贴文本 Route Handler。
- 前端 UploadPage 调用接口。
- 上传后跳转 JobPage。

完成标志：

- storage/sources 里出现文件。
- 数据库里出现 Book 和 Job。

### Milestone 4：文本解析闭环

- 实现 decodeText。
- 实现 cleanText。
- 实现 detectChapters。
- 实现 splitChapter / planParts。
- 生成 reports。

完成标志：

- 一个 TXT 能生成章节列表和 part 计划。
- pipeline 单元测试通过。

### Milestone 5：Worker 和短音频

- 实现本地 worker 启动脚本。
- 实现 JobRunner。
- 实现 TTSProvider 和 edgeTtsProvider。
- 实现 buildChunks 和 chunkCache。
- 生成一个短 mp3。

完成标志：

- 浏览器能播放一段生成音频。
- application 只依赖 TTSProvider 抽象。

### Milestone 6：音频拼接

- 实现 AudioAssembler port。
- 实现 ffmpegAudio。
- 生成 concat list。
- 拼接 part mp3。
- probe 音频时长。

完成标志：

- 多个 chunk 能拼成 part。
- part 能被浏览器播放。

### Milestone 7：完整任务流水线

- 实现 RunPipelineJob。
- 实现 ProgressPublisher。
- 每个阶段更新 job.stage 和 progress。
- chunk/part 状态落库。
- JobPage 轮询展示进度。

完成标志：

- 一本小 TXT 能完整生成多个 part。
- JobPage 展示真实进度。
- PlayerPage 可以播放所有 part。

### Milestone 8：失败恢复

- 实现 RetryChunk。
- 记录 chunk 错误。
- 前端展示失败 chunk。
- RetryPanel 调用重试接口。

完成标志：

- 人为制造 TTS 失败后，前端能看到失败原因。
- 点击重试后可以恢复。

### Milestone 9：前端展示打磨

- 打磨 JobPage 为流程工作台。
- 打磨 PlayerPage 的桌面和移动端布局。
- 增加 MiniPlayer。
- 增加 LibraryPage。
- 增加空状态、错误状态、加载状态。
- 增加组件测试和 1 到 2 条 Playwright E2E。

完成标志：

- 项目可以录屏展示。
- 手机视口下上传、任务、播放三个页面可用。
- 核心组件有测试，关键闭环有 E2E。

## 8. 解耦验收清单

每完成一个里程碑，都检查以下规则：

```text
Route Handler 不能 import pipeline 内部模块
Route Handler 不能 import infrastructure/db/schema.ts
application 不能 import Next.js
application 不能 import React
application 不能 import edge-tts
application 不能 import execa
application 不能手写 storage 目录路径
pipeline 不能写数据库
pipeline 不能读写项目 storage
domain 不能依赖任何第三方框架
frontend page 不能直接写复杂轮询逻辑
frontend page 不能直接管理全局播放器状态
worker 不能依赖 React 组件或 app 页面
```

允许的例外：

- `server/composition/container.ts` 可以组装具体 infrastructure 实现。
- infrastructure 可以依赖第三方库和系统工具。
- tests 可以使用 fake 实现验证 application。

## 9. 面试亮点设计

### 9.1 前端亮点

- Next.js App Router 下的页面组织和业务 feature 拆分。
- 长任务进度可视化。
- PipelineSteps 展示复杂任务阶段。
- ChunkStatusList 展示细粒度状态。
- RetryPanel 展示失败恢复能力。
- AudioPlayer + MiniPlayer 展示复杂播放器状态。
- TanStack Query 管理轮询、缓存、错误和停止条件。
- Zustand 管理跨页面播放器状态。
- 响应式布局支持桌面端和手机端。
- React Testing Library + Playwright 覆盖核心用户路径。

### 9.2 TypeScript 工程亮点

- 前后端共享 Zod schema 和 TypeScript 类型。
- Route Handlers 入参出参都有 schema 约束。
- API 数据、组件 props、任务状态和播放器状态都有明确类型建模。
- 使用 Drizzle 建模数据库，避免手写散乱 SQL。
- MSW mock 和真实 API 复用同一套 DTO 结构。

### 9.3 后端/Worker 工程亮点

- Next.js 只做 BFF/API，不把长任务塞进请求生命周期。
- 独立 worker 处理 TTS 和 FFmpeg 长任务。
- 轻量端口适配器隔离高变化外部依赖。
- TTSProvider 抽象，edge-tts 可替换。
- FileStorage 抽象，本地存储可替换对象存储。
- JobRepository 抽象，SQLite 可替换 PostgreSQL。
- ProgressPublisher 抽象，轮询可替换 SSE/WebSocket。
- chunk 级缓存，避免重复合成。
- chunk 级失败重试，不重跑整本书。
- part 规划按听书时长规划，不是粗暴按章节切割。

### 9.4 推荐面试说法

```text
这个项目我没有把重点放在登录、多用户或者后台管理上，而是先聚焦长文本转音频的核心闭环。
技术栈选择 Next.js + TypeScript，是为了让前端页面、BFF、DTO、测试 mock 和 worker 编排都在同一套类型体系里。
Next.js Route Handlers 只负责上传、查询、重试等 API 入口，真正耗时的 TTS 和 FFmpeg 任务放到独立 Node worker 中执行。
前端重点解决长任务状态可视化、失败恢复、播放器体验和移动端适配。
工程上用 Zod 维护 API 契约，用 TanStack Query 管理轮询和缓存，用 Zustand 管理跨页面播放器状态。
第一版用 SQLite、本地文件和本地 worker 控制复杂度，但通过端口适配器保留替换 PostgreSQL、对象存储、队列系统和 SSE 的空间。
```

## 10. 风险清单

### 10.1 Next.js 承担长任务的风险

风险：

- Route Handler 不适合执行长时间 TTS/FFmpeg 任务。
- 部署环境可能存在请求超时、文件系统限制或进程生命周期限制。
- 本地 demo 能跑，不代表生产环境可靠。

应对：

- Route Handler 只创建 job 和查询状态。
- 长任务放到独立 worker。
- 第一版使用本地 worker，后续可替换成队列系统。

### 10.2 edge-tts 稳定性风险

风险：

- edge-tts 不是正式收费云 API。
- 接口可能变化。
- 可能遇到限流或网络失败。

应对：

- 用 TTSProvider 抽象隔离。
- 做 chunk 重试。
- 做 chunk 缓存。
- 保留替换 Azure TTS、OpenAI TTS、本地 TTS 的接口。

### 10.3 抽象过度风险

风险：

- 文件数量过多。
- 真实逻辑很少，接口很多。
- 实现时容易漏依赖。

应对：

- 只抽象外部依赖。
- 不抽象 decodeText、cleanText、planParts 等核心算法。
- 每个里程碑都保持可运行。
- 每次只实现一个 use case 或一个 port。

### 10.4 长文本处理风险

风险：

- TXT 编码混乱。
- 小说广告和异常格式很多。
- 章节识别不可能覆盖全部格式。

应对：

- 支持常见编码。
- 清洗报告可视化。
- 无法识别章节时 fallback 成单章。
- 单元测试覆盖常见格式。

### 10.5 音频拼接风险

风险：

- FFmpeg 未安装。
- chunk 损坏。
- 拼接后浏览器无法播放。

应对：

- 启动时检查 FFmpeg。
- 拼接前检查 chunk 是否存在。
- 拼接后 probe 音频时长。
- 前端展示错误原因。

### 10.6 项目范围风险

风险：

- 过早做登录、收藏、云同步、复杂播放器。
- 后端基础设施占用太多时间。

应对：

- 第一版只做本地单用户。
- 先用轮询，不上 SSE。
- 先用 SQLite，不上 PostgreSQL。
- 先用本地 worker，不上 Redis / BullMQ。

## 11. 第一版不做清单

- 登录注册。
- 多用户。
- 云端部署。
- 收藏系统。
- 睡眠定时。
- 波形图。
- 字幕同步。
- 章节内文本高亮跟读。
- 复杂管理后台。
- 付费 TTS 接入。
- Redis 队列。
- 对象存储。

这些功能可以作为二期或面试时的扩展方案，不进入第一版。

## 12. 二期优化方向

### 12.1 前端体验优化

- PWA 安装到手机桌面。
- 移动端底部 MiniPlayer。
- 播放进度本地保存。
- 深色模式。
- 任务完成浏览器通知。
- 更细腻的空状态和错误状态。

### 12.2 前端工程优化

- 任务进度从轮询替换为 SSE。
- 使用状态机管理 JobPage 状态。
- 增加更多组件测试。
- 增加更多 Playwright 端到端测试。
- 增加前端性能优化和列表虚拟化。

### 12.3 服务端工程优化

- SQLite repository 替换为 PostgreSQL repository。
- 本地 worker 替换为 Redis + BullMQ。
- PollingProgressPublisher 替换为 SSEProgressPublisher。
- LocalFileStorage 替换为对象存储。
- 增加任务暂停和恢复。
- 增加并发控制和速率限制。

### 12.4 产品能力扩展

- 书架管理。
- 播放进度同步。
- 字幕和文本同步。
- 自定义清洗规则。
- 多 TTS Provider。

## 13. 推荐开发节奏

建议按 Codex 小任务推进，每次只做一个明确模块。

```text
第 1 次：创建 Next.js + TypeScript 骨架
第 2 次：配置 Tailwind、ESLint、Prettier、Vitest
第 3 次：创建 app、features、server、shared、worker 目录
第 4 次：定义 Zod schema、domain entities 和状态类型
第 5 次：实现 Drizzle schema、SQLite 初始化和 repository
第 6 次：实现上传 Route Handler 和 CreateBookJob
第 7 次：实现 UploadPage
第 8 次：实现 decodeText 并写测试
第 9 次：实现 cleanText 并写测试
第 10 次：实现 detectChapters 并写测试
第 11 次：实现 splitChapter / planParts 并写测试
第 12 次：实现 worker、JobRunner 和 JobPage 轮询
第 13 次：实现 TTSProvider、edgeTtsProvider、buildChunks、chunkCache
第 14 次：实现 AudioAssembler 和 ffmpegAudio
第 15 次：实现 RunPipelineJob
第 16 次：实现 PlayerPage 和播放器 store
第 17 次：补失败重试和 RetryPanel
第 18 次：补组件测试、Playwright E2E、移动端布局和 README
```

每次任务都要包含：

- 目标。
- 涉及文件。
- 验收标准。
- 是否需要测试。
- 完成后如何手动验证。

## 14. 第一阶段完成定义

当以下条件满足时，第一阶段可以认为完成：

- 能上传或粘贴 TXT。
- 能自动解码和清洗文本。
- 能识别章节。
- 能规划听书 part。
- 能用 edge-tts 生成音频。
- 能用 FFmpeg 拼接音频。
- 能在前端看到任务进度。
- 能在前端播放生成音频。
- 失败 chunk 能看到错误并重试。
- 手机视口下上传、任务、播放三个页面可用。
- API DTO、前端类型、测试 mock 由 shared schema 对齐。
- README 能让面试官或自己在本地跑起来。
- 通过解耦验收清单，没有明显跨层直接依赖。
