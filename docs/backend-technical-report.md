# 匠魂书音后端技术报告

这份报告用于快速理解项目的后端部分：后端做了什么、各模块怎么拆、任务流水线怎么跑、TTS/FFmpeg 如何封装、并发和失败恢复如何实现，以及这些设计体现了哪些工程能力。

## 1. 后端目标

匠魂书音后端的核心目标是把“上传 TXT -> 生成分章节音频 -> 前端播放”做成一条可靠、可观察、可恢复的本地流水线。

它需要解决的问题不是简单 CRUD，而是：

- 上传后不能让 HTTP 请求一直等待 TTS 和 FFmpeg。
- 文本需要经过解码、清洗、章节识别和 part 规划。
- TTS 调用慢且不稳定，需要 chunk 级重试和错误记录。
- 单本书内部要能并发，多个书籍任务也要能并发。
- FFmpeg 拼接必须保持 chunk 顺序稳定。
- 拼接成功后要清理中间 chunk 音频，但保留数据库记录用于审计。
- 生成完的音频需要能被浏览器 `<audio>` 稳定播放。
- 本地 MVP 要控制复杂度，不引入 Redis、BullMQ、对象存储和生产级基础设施。

## 2. 后端技术栈

```text
Next.js Route Handlers
TypeScript
SQLite
Drizzle ORM
Zod
Node Worker
edge-tts-universal
FFmpeg / ffprobe
node:fs/promises
Vitest
Playwright
```

职责划分：

- Route Handler：HTTP 入参校验、调用 application use case、返回 DTO。
- Application：业务用例编排，不依赖具体 provider。
- Ports：定义数据库、文件、TTS、音频拼接等抽象接口。
- Infrastructure：具体实现 SQLite、LocalStorage、edge-tts、FFmpeg、JobRunner。
- Pipeline：纯文本处理，负责解码、清洗、章节识别和 part 规划。
- Worker：循环读取 job，推进长任务。

## 3. 后端分层结构

后端主要位于：

```text
src/server
src/worker
src/app/api
```

目录职责：

```text
src/app/api
  Route Handlers，负责 HTTP 边界

src/server/domain
  实体类型、状态类型、业务概念

src/server/application
  use case 编排，例如创建任务、查询任务、运行流水线、重试、暂停恢复

src/server/ports
  抽象接口，例如 Repository、FileStorage、TTSProvider、AudioAssembler

src/server/infrastructure
  具体实现，例如 Drizzle repository、LocalStorage、EdgeTtsProvider、FfmpegAudio、LocalJobRunner

src/server/pipeline
  文本解码、清洗、章节识别、part 规划

src/server/tts
  chunk 切分、cache key、TTS 重试、并发工具

src/server/composition
  依赖组装

src/worker
  后台 worker 入口
```

核心依赖方向：

```text
Route Handler
-> application
-> ports
-> infrastructure

worker
-> application
-> ports
-> infrastructure

pipeline
-> domain / shared
```

重要边界：

- Route Handler 不直接执行完整 TTS/FFmpeg。
- Application 不 import Next.js、Drizzle、edge-tts 或 FFmpeg 具体实现。
- Pipeline 不访问数据库、不读写 storage、不调用 TTS。
- Worker 不依赖 React、页面或浏览器 API。

## 4. 核心数据模型

音频生成主库使用 SQLite，核心表是：

```text
books
jobs
parts
chunks
```

### Book

```text
id
title
author
sourcePath
status
createdAt
```

Book 表示一本上传的书，保存源文本路径和书籍整体状态。

### Job

```text
id
bookId
voice
rate
pitch
status
stage
progress
errorMessage
createdAt
updatedAt
```

Job 表示一次音频生成任务。它保存 TTS 参数、任务状态、当前阶段和进度。

### Part

```text
id
bookId
index
title
audioPath
durationSeconds
status
```

Part 表示最终播放器中的一个章节音频。

### Chunk

```text
id
partId
index
textHash
audioPath
status
retryCount
errorMessage
```

Chunk 表示 TTS 的最小合成单元。chunk 音频是中间产物，拼接成功后会删除音频文件，但保留数据库记录用于状态、错误和审计。

## 5. Route Handler 做了什么

Route Handler 位于 `src/app/api/**/route.ts`。

它们的职责很克制：

1. 读取 URL 参数、query 或 body。
2. 使用 Zod 校验。
3. 调用 container 暴露的 application use case。
4. 返回 JSON DTO 或音频响应。
5. 把业务错误转换成稳定 HTTP 状态码。

典型接口：

```text
POST /api/uploads/text
POST /api/uploads/file
GET  /api/books
DELETE /api/books/[bookId]
GET  /api/jobs/[jobId]
POST /api/jobs/[jobId]/pause
POST /api/jobs/[jobId]/resume
GET  /api/player/books/[bookId]
GET  /api/tts/voices
POST /api/parts/[partId]/retry
POST /api/chunks/[chunkId]/retry
```

设计重点：

- 上传接口只创建 Book 和 Job，不直接跑生成流程。
- 查询接口只返回 DTO，不暴露数据库行结构。
- 播放器音频接口支持 Range 请求，浏览器可以稳定加载音频。

## 6. Application 层做了什么

Application 层位于 `src/server/application`。

它负责业务流程，但不依赖具体技术实现。所有外部能力都通过 ports 注入。

主要 use case：

```text
createBookJob
runPipelineJob
queryJob
queryLibrary
queryPlayer
pauseJobGeneration
resumeJobGeneration
retryPart
retryChunk
deleteBook
listTtsVoices
```

### createBookJob

创建上传任务：

```text
保存源文本
-> 创建 Book
-> 创建 queued Job
-> 返回 bookId / jobId
```

它把“上传完成”和“开始生成”解耦。上传接口返回后，worker 再异步消费 job。

### queryJob / queryLibrary / queryPlayer

这些 use case 负责把数据库实体转换成前端需要的 DTO：

- job 页需要阶段、进度、parts。
- 书架需要每本书的可播放章节数、总时长、最新 job。
- 播放器需要 parts 列表、audioUrl、失败信息和最新 job。

这样前端不用理解数据库表结构。

### pause / resume

暂停不是强杀当前 async 操作，而是软暂停：

- job 状态改为 `paused`。
- worker 在阶段边界或 chunk 合成前后检查 `shouldStopJob`。
- 正在执行的小步骤完成后，不再进入下一步。

恢复时把 paused job 改回可推进状态。

### retryPart / retryChunk

重试能力分两层：

- `retryPart`：把失败章节重新置为待处理，清理旧 part/chunk 输出。
- `retryChunk`：对单个 chunk 重新调用 TTS，并增加 retryCount。

这样不是整本书重跑，而是局部恢复。

## 7. 完整生成流水线

核心在 `src/server/application/runPipelineJob.ts`。

流水线按 job 的 `stage` 分阶段推进：

```text
queued
-> processing / decoding
-> cleaning
-> chapter_detection
-> planning
-> tts
-> assembling
-> completed
```

每次 worker tick 调用 `runPipelineJob(jobId)`，只推进当前 job 的一个或一段阶段，然后写回数据库状态。

详细流程：

```text
1. 读取 job
2. 如果 paused / terminal，直接返回
3. queued -> processing + decoding
4. decoding：读取 sourcePath，验证文本可解码
5. cleaning：清洗文本并保存 cleaned 文件
6. chapter_detection：识别章节
7. planning：生成 part 计划、保存 report、创建 parts
8. tts：选择下一个 pending/processing/tts/assembling part
9. 清理当前 part 旧输出
10. 调用 synthesizePartChunks 合成 chunk
11. chunk 全部成功后进入 assembling
12. FFmpeg 按 chunk.index 拼接 part 音频
13. 写入 parts.audioPath 和 durationSeconds
14. 删除该 part 的 chunk 小音频，清空 chunks.audioPath
15. 更新 job 进度
16. 所有 part 完成或失败后进入 assembling/finalize
17. 根据失败 part 数量标记 completed 或 completed_with_errors
```

为什么这样设计：

- 每个阶段都能写入进度，前端可观察。
- 失败时能知道失败阶段和真实错误。
- 单个 part 失败不会阻塞后续 part。
- 成功章节可以先播放，失败章节可以后续重试。

## 8. 文本 pipeline

文本处理在 `src/server/pipeline/text.ts`，保持纯函数。

主要函数：

```text
decodeText
cleanText
detectChapters
planParts
buildReport
```

职责：

- `decodeText`：处理 TXT 编码。
- `cleanText`：清理空白、异常行、广告噪声。
- `detectChapters`：识别章节标题。
- `planParts`：把章节规划成适合生成和播放的 part。
- `buildReport`：生成解析报告，方便排查和审计。

这个模块不访问数据库和文件系统，所以可以独立单测。

## 9. TTS 层

TTS 相关逻辑位于：

```text
src/server/tts
src/server/infrastructure/edgeTtsProvider.ts
```

### chunk 切分

`buildChunks` 把一个 part 的文本切成多个 chunk。默认 chunk 不宜过长，避免 TTS 单次请求过大。

### cache key

`createChunkCacheKey` 使用：

```text
text
voice
rate
pitch
```

生成 textHash。这样同一文本但不同音色/语速/音调不会误用缓存。

### synthesizePartChunks

`synthesizePartChunks` 负责：

- 创建 chunk 记录。
- 按 chunk.index 记录顺序。
- 调用 TTSProvider。
- 每个 chunk 独立 retry。
- 记录 retryCount 和 errorMessage。
- 支持 per-part concurrency。
- 支持全局 ttsLimiter。
- 支持 shouldContinue，用于暂停/终止时停止继续生成。

默认参数：

```text
PER_PART_TTS_CONCURRENCY = 2
GLOBAL_TTS_CONCURRENCY = 3
TTS_MAX_ATTEMPTS = 5
RETRY_DELAYS_MS = [1000, 3000, 8000, 15000, 30000]
```

### EdgeTtsProvider

`EdgeTtsProvider` 实现 `TTSProvider` 接口。

它负责：

- 校验 text 不为空。
- 使用默认 voice/rate/pitch。
- 动态加载 `edge-tts-universal`。
- 给单次尝试加 timeout。
- 把返回结果统一 normalize 成 `Uint8Array`。
- 保存音频到 `storage/chunks`。
- 打印包含 voice、rate、pitch、textPreview 的诊断日志。

Application 层并不关心 edge-tts 的具体 API，只依赖 `TTSProvider`。

## 10. FFmpeg 音频拼接

FFmpeg 逻辑位于 `src/server/infrastructure/ffmpegAudio.ts`。

`FfmpegAudio` 实现 `AudioAssembler` 接口。

它负责：

- 检查项目级 `ffmpeg.exe` 和 `ffprobe.exe` 是否存在。
- 检查所有 chunk 文件是否存在。
- 生成 concat list。
- 调用 FFmpeg 拼接 mp3。
- 调用 ffprobe 获取时长。
- 拼接失败时抛出清晰错误。
- finally 删除 concat 临时文件。

拼接前会按 `chunk.index` 排序：

```text
chunks.sort((left, right) => left.index - right.index)
```

这样即使 chunk 并发完成顺序不同，最终音频顺序也稳定。

## 11. Worker 和两级并发

Worker 入口在 `src/worker/index.ts`：

```text
createLocalJobRunner()
runner.start()
```

核心实现是 `LocalJobRunner`。

它做了几件关键事：

- 定时 tick，默认每秒扫描一次任务。
- 读取 `queued` 和 `processing` job。
- 使用 `jobConcurrency` 控制同时推进多少本书。
- 使用 `inFlightJobIds` 避免同一个 job 被重复推进。
- 使用 `isTicking` 防止 tick 重入。
- 单个 job 失败只记录错误，不阻塞其他 job。
- queued job 优先于旧 processing job，避免新书长时间饿死。

默认并发：

```text
JOB_CONCURRENCY = 2
PER_PART_TTS_CONCURRENCY = 2
GLOBAL_TTS_CONCURRENCY = 3
ASSEMBLE_CONCURRENCY = 1
```

并发结构：

```text
LocalJobRunner
  -> 多个 job 并发推进
      -> 每个 part 内多个 chunk 并发 TTS
          -> 所有 TTS 请求共享全局 limiter
      -> FFmpeg 拼接共享 assemble limiter
```

这个设计既提升速度，又避免 TTS 服务和本机资源被打爆。

## 12. Storage 设计

文件存储通过 `FileStorage` 抽象。

接口包括：

```text
saveTextSource
saveBinarySource
readTextSource
saveChunkAudio
deleteFile
exists
```

本地实现是 `LocalStorage`：

- 源文本保存到 `storage/sources`。
- cleaned 文本保存到 `storage/cleaned`。
- report 保存到 `storage/reports`。
- chunk 音频保存到 `storage/chunks`。
- part 音频由 FFmpeg 保存到 `storage/parts`。

安全点：

- `deleteFile` 会检查目标路径必须在 storage root 内。
- 删除使用 `force: true`，文件不存在不会直接炸掉。
- application 不手写具体 storage 路径，只拿 port 返回的路径。

## 13. 数据库和 Repository

数据库实现位于：

```text
src/server/infrastructure/db
```

包括：

```text
client.ts
schema.ts
initialize.ts
repositories.ts
```

设计：

- `schema.ts` 定义 Drizzle 表结构。
- `initialize.ts` 用 SQL 创建表，并做轻量 schema 补丁。
- `repositories.ts` 实现 Book/Job/Part/Chunk repository。
- Application 只依赖 repository interface。

为什么用 repository：

- application 不需要知道 Drizzle 查询细节。
- 测试可以用 fake repository 或内存 SQLite。
- 数据库结构变化不会直接扩散到业务流程。

## 14. 依赖组装 container

`src/server/composition/container.ts` 是依赖注入入口。

它负责实例化具体实现：

```text
SQLite client
Drizzle repositories
LocalStorage
EdgeTtsProvider
EdgeTtsVoiceCatalog
FfmpegAudio
Limiter
```

然后暴露 application 能力：

```text
createBookJob
deleteBook
queryJob
queryLibrary
queryPlayer
pauseJobGeneration
resumeJobGeneration
retryChunk
retryPart
```

好处：

- 具体 provider 只在 composition/infrastructure 出现。
- Route Handler 不需要自己 new repository/provider。
- application 保持可测试。

## 15. 播放器音频 API

播放器数据接口：

```text
GET /api/player/books/[bookId]
```

不带 `partId` 时返回 player DTO：

```text
bookId
latestJob
parts[]
```

带 `partId` 时返回音频文件：

```text
GET /api/player/books/[bookId]?partId=...
```

音频接口做了几件重要事：

- 校验 bookId 和 partId。
- 确认 part 属于该 book。
- 只允许 completed 且有 audioPath 的 part 返回音频。
- 文件不存在返回 `PART_AUDIO_MISSING`。
- 支持 `Range` 请求。
- 返回 `Accept-Ranges`、`Content-Length`、`Content-Range`。
- 合法 Range 返回 `206`。
- 非法 Range 返回 `416`。

这是前端 `<audio>` 能稳定播放本地生成 mp3 的关键。

## 16. 错误处理和状态恢复

后端错误处理分几层：

### 任务级错误

`runPipelineJob` 外层 catch 会：

- 打印 worker 日志。
- 把 job 标记为 failed。
- 保留失败 stage/progress/errorMessage。

### part 级错误

某个 part TTS 或 assembling 失败时：

- 标记 part failed。
- 记录真实错误。
- 后续 part 继续推进。
- 最终 job 可进入 `completed_with_errors`。

### chunk 级错误

TTS chunk 失败时：

- 标记 chunk failed。
- 写入 retryCount。
- 写入真实 errorMessage。

### 清理策略

- part 拼接成功后删除 chunk 小音频。
- 删除后清空 chunks.audioPath。
- FFmpeg 拼接失败时不删除 chunk 音频。
- 如果清理文件失败，会 warn，但不把成功 part 反向改失败。

## 17. 阅读模块后端

项目还有一条阅读业务线，后端位于：

```text
src/server/application/createReadingBook.ts
src/server/application/queryReadingLibrary.ts
src/server/infrastructure/readingDb
src/server/composition/readingContainer.ts
src/app/api/reading/**
```

它解决的是“本地阅读书籍管理”，和音频生成任务分开。

能力：

- 上传阅读书籍。
- 保存源文件和可选封面。
- 复用文本 pipeline 解码、清洗、章节识别和 part/章节规划。
- 创建 reading books 和 chapters。
- 查询阅读书架。
- 查询书籍详情和目录。
- 查询章节内容。
- 保存阅读进度。
- 删除阅读书籍和关联文件。

阅读模块使用独立 reading database，避免和音频生成主库混在一起。

## 18. 测试覆盖

后端相关测试覆盖了几类：

- Repository 基础读写。
- Zod schema。
- 文本 pipeline。
- TTS chunk 切分、重试、并发限制。
- RunPipelineJob 完整任务推进。
- LocalJobRunner 多 job 并发。
- retryPart / retryChunk。
- Route Handler 错误码和 DTO。
- player audio Range 响应。
- Playwright 主流程。

这类测试的价值是保证：

- 状态机不会乱跳。
- 失败不会吞掉真实错误。
- 并发不会破坏顺序。
- 拼接成功/失败时文件清理行为正确。

## 19. 后端可以怎么面试表达

可以这样概括：

> 我把 TXT 转音频拆成了一个本地长任务流水线。HTTP 层只负责创建任务和查询状态，真正的 TTS 和 FFmpeg 放到 worker 中执行。业务层通过 ports 依赖 Repository、Storage、TTSProvider 和 AudioAssembler，所以 application 不依赖具体数据库或 provider。为了提高生成速度，我做了两级并发：多本书 job 并发推进，单个 part 内 chunk 并发合成，同时所有 TTS 请求共享全局 limiter。失败恢复上，chunk 记录 retryCount 和真实错误，part 失败不阻塞其他 part，最终任务可以 completed_with_errors，成功章节仍然可播放。拼接成功后会删除 chunk 小音频但保留数据库审计记录。

## 20. 可以继续优化的点

- 给缺失 source 文件增加更明确的业务错误码，例如 `SOURCE_FILE_MISSING`。
- 为历史残留 chunk 音频提供安全清理 use case。
- 把当前本地 worker 的配置参数暴露成环境变量。
- 给 Route Handler 统一错误响应 helper，减少重复 catch 分支。
- 增加更完整的数据库迁移管理，而不是轻量 `ALTER TABLE` 补丁。
- 后续如果进入生产部署，再考虑 Redis/BullMQ、对象存储和多 worker 协调。

## 21. 一句话总结

后端部分的核心价值是：把一个慢、不稳定、强依赖外部 TTS 和本地 FFmpeg 的文本转音频流程，拆成可观察、可暂停、可重试、可并发控制的本地任务系统，并通过 ports/application/infrastructure 分层保持业务逻辑清晰可测试。
