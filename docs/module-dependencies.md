# 模块依赖关系

本文件只描述模块职责、依赖方向和关键调用链。总体方案见 `docs/development-plan.md`，功能顺序见 `docs/implementation-roadmap.md`。

## 1. 依赖总图

```text
页面
  -> features
  -> API client
  -> Route Handler
  -> application
  -> ports
  -> infrastructure

worker
  -> application
  -> ports
  -> infrastructure

pipeline
  -> domain / shared

domain
  -> 基础类型
```

核心原则：

```text
高层业务依赖低层抽象。
具体技术实现只在 infrastructure。
页面不依赖 server 实现。
pipeline 不依赖数据库和文件系统。
worker 不依赖 React 和页面。
```

## 2. 模块职责

| 模块 | 负责 | 不负责 |
| --- | --- | --- |
| `src/app` | 页面、布局、Route Handler | 核心业务、数据库细节、TTS |
| `src/features` | 前端组件、hooks、客户端状态 | 数据库、FFmpeg、文件系统 |
| `src/shared` | Zod schema、共享类型、常量 | 业务执行、数据库 |
| `server/domain` | 实体、状态、业务错误 | 框架、ORM、外部服务 |
| `server/application` | 编排业务用例 | HTTP、ORM、具体 provider |
| `server/ports` | 定义外部依赖接口 | 具体实现 |
| `server/infrastructure` | 数据库、存储、TTS、FFmpeg | 页面和业务流程 |
| `server/pipeline` | 解码、清洗、章节和分段规划 | 数据库、TTS、文件写入 |
| `server/tts` | chunk 切分、缓存和重试策略 | 具体 TTS 调用 |
| `server/composition` | 组装依赖 | 业务逻辑 |
| `worker` | 执行长任务 | 页面、HTTP 响应 |

## 3. 允许的依赖方向

### 前端

```text
app
  -> features
  -> shared
```

允许：

- 页面使用 feature 组件。
- feature hooks 使用 TanStack Query。
- player feature 使用 Zustand。
- API client 使用 shared schema 和类型。

禁止：

- 页面 import `src/server/**`。
- 页面访问 SQLite、文件系统、FFmpeg 或 TTS。
- 页面自己实现复杂轮询。
- 页面自己维护跨页面播放器状态。

### Route Handler

```text
Route Handler
  -> shared schema
  -> application use case
  -> 返回 DTO
```

只负责：

1. 读取 HTTP 入参。
2. 使用 Zod 校验。
3. 调用 application。
4. 返回状态码和 DTO。

禁止直接调用 pipeline、Drizzle、edge-tts 或 FFmpeg。

### Application

```text
application
  -> domain
  -> ports
  -> pipeline
  -> tts
```

禁止：

- import Next.js、React、Drizzle、edge-tts、execa。
- 拼接具体 storage 路径。
- 依赖 infrastructure 中的具体类。
- 判断 HTTP 请求或响应。

### Domain

只依赖 TypeScript 基础类型和必要的 shared 类型。

禁止依赖 Next.js、React、Drizzle、Node 文件系统、FFmpeg 和 edge-tts。

### Pipeline

pipeline 必须是可独立测试的普通函数：

- 输入普通数据，输出普通数据。
- 不读写数据库。
- 不读写 `storage`。
- 不调用 TTS。
- 不调用 FFmpeg。

### Ports

Ports 只定义接口和基础数据类型：

```text
BookRepository
JobRepository
PartRepository
ChunkRepository
FileStorage
TTSProvider
AudioAssembler
JobRunner
```

Ports 中不能出现 SQLite、Drizzle、edge-tts、FFmpeg、execa 或具体路径。

### Infrastructure

```text
infrastructure
  -> ports
  -> domain
  -> 第三方库
  -> Node.js API
```

具体实现：

```text
db/repositories.ts -> Repository
localStorage.ts -> FileStorage
edgeTtsProvider.ts -> TTSProvider
ffmpegAudio.ts -> AudioAssembler
localJobRunner.ts -> JobRunner
```

### Worker

```text
worker
  -> application
  -> composition/container
  -> infrastructure
```

Worker 负责读取任务、执行流水线、更新状态和记录错误，不负责页面渲染、浏览器事件或 HTTP 响应。

## 4. 关键调用链

### 创建任务

```text
UploadPage
  -> upload API
  -> Route Handler
  -> CreateBookJob
  -> FileStorage
  -> BookRepository + JobRepository
  -> 返回 bookId + jobId
```

### 执行任务

```text
Worker
  -> RunPipelineJob
  -> FileStorage
  -> pipeline
  -> buildChunks
  -> TTSProvider
  -> ChunkRepository
  -> AudioAssembler
  -> PartRepository
  -> JobRepository
```

### 查询进度

```text
JobPage
  -> TanStack Query
  -> GET /api/jobs/{jobId}
  -> QueryJob
  -> JobRepository
  -> Job DTO
```

### 播放音频

```text
PlayerPage
  -> GET /api/player/books/{bookId}
  -> QueryPlayer
  -> PartRepository
  -> part 列表和 audioUrl
  -> playerStore + HTMLAudioElement
```

## 5. 依赖注入

只在 `src/server/composition/container.ts` 组装具体实现：

```ts
const repositories = createRepositories(db);
const storage = createLocalStorage(config.storageRoot);
const tts = createEdgeTtsProvider(config.tts);
const audio = createFfmpegAudio(config.ffmpegPath);

return {
  createBookJob: createCreateBookJob({ repositories, storage }),
  runPipelineJob: createRunPipelineJob({
    repositories,
    storage,
    tts,
    audio,
  }),
};
```

不要在页面、Route Handler 或 application 中散落具体 provider 的实例化。

## 6. 依赖检查

跨模块任务完成后检查：

```text
Route Handler 是否直接调用 infrastructure？
application 是否 import 具体第三方实现？
pipeline 是否访问数据库或 storage？
页面是否 import server？
worker 是否依赖 React？
共享 schema 是否被调用方复用？
是否出现第二份服务端数据状态？
```
