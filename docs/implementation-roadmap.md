# 功能开发顺序

本文件只描述要做哪些功能、每一步的依赖和验收标准。总体架构以 `docs/development-plan.md` 为准，模块调用方向以 `docs/module-dependencies.md` 为准。

## 1. 开发原则

- 先打通最小闭环，再补复杂状态。
- 每个阶段完成后项目都能启动和验证。
- 先做真实业务，再做视觉打磨。
- 前端主流程优先于后端扩展能力。
- 没有前置依赖的功能不要提前实现。
- 不在 MVP 阶段加入登录、队列集群、云存储或复杂实时通信。

## 2. 功能依赖总图

```text
工程骨架
  |
  +--> 类型契约
  |      |
  |      +--> 数据库
  |      +--> API
  |             |
  |             v
  |         上传闭环
  |             |
  |             v
  |         文本解析
  |             |
  |             v
  |         Worker
  |             |
  |             v
  |         TTS + FFmpeg
  |             |
  |             v
  |         任务进度
  |             |
  |             +--> 失败重试
  |             |
  |             v
  |         播放器
  |             |
  |             v
  |         书架 + 移动端 + 测试
```

## 3. 阶段一：工程骨架

### 功能

- 初始化 Next.js + TypeScript。
- 配置 App Router。
- 配置 Tailwind、ESLint、Prettier、严格 TypeScript。
- 建立 `app`、`features`、`server`、`shared`、`worker`、`tests`。
- 创建根布局和基础页面。
- 创建 `GET /api/health`。

### 依赖

无。

### 验收

- `next dev` 可以启动。
- 首页可以访问。
- 页面可以请求 `/api/health`。
- lint 和 TypeScript 检查可以运行。

### 暂时不要做

- 不接数据库。
- 不接 TTS。
- 不创建完整页面目录。
- 不提前写空的 domain、ports 和 infrastructure 文件。

## 4. 阶段二：类型契约和数据库

### 功能

- 定义 `Book`、`Job`、`Part`、`Chunk`。
- 定义任务状态和任务阶段。
- 使用 Zod 定义 upload、job、book、player schema。
- 配置 Drizzle + SQLite。
- 创建最小数据库 schema。
- 实现 Book、Job、Part、Chunk repository。

### 依赖

- 阶段一工程骨架。

### 验收

- 可以初始化 SQLite。
- 可以创建和读取 Book。
- 可以创建和读取 Job。
- API DTO 能从 shared schema 推导。
- domain 不依赖 Drizzle。

### 测试

- repository 基础读写测试。
- schema 合法和非法输入测试。

## 5. 阶段三：上传闭环

### 功能

- 实现文件上传。
- 实现文本粘贴。
- 保存原始文本到 `storage/sources`。
- 创建 Book 和 Job。
- 返回 `bookId`、`jobId`。
- 创建 UploadPage。
- 支持 loading、error、disabled。

### 依赖

- 阶段二类型和数据库。
- Local Storage 实现。
- CreateBookJob。

### 验收

- 选择 TXT 后可以提交。
- 粘贴文本后可以提交。
- 空文本不能提交。
- 文件类型错误有明确提示。
- 数据库出现 Book 和 Job。
- 上传成功后跳转 `/jobs/[jobId]`。

### 测试

- 上传 schema 测试。
- CreateBookJob application 测试。
- UploadForm 组件测试。

## 6. 阶段四：文本解析

### 功能

- UTF-8、UTF-8 BOM、GBK、Big5 解码。
- 合并空行和去除首尾空白。
- 识别常见广告行。
- 识别中文章节标题。
- 无章节文本回退为单章。
- 超长章节切分。
- 按目标听书时长规划 part。
- 生成清洗和解析报告。

### 依赖

- 阶段二 domain 和 shared 类型。
- 阶段三原始文本保存。

### 验收

- 给定样本文本可以得到稳定的结构化结果。
- 清洗不会删除普通正文。
- 无法识别章节时仍然可以继续生成。
- pipeline 不访问数据库和 storage。

### 测试

- 每个纯函数至少覆盖正常输入、空输入和异常边界。
- 重点测试编码、章节标题、超长章节和 part 边界。

## 7. 阶段五：Worker 基础设施

### 功能

- 创建 worker 进程入口。
- 创建 JobRunner。
- worker 可以读取 queued job。
- worker 可以更新 processing、completed、failed 状态。
- 记录错误消息和更新时间。
- 加入基础并发限制。

### 依赖

- 阶段二数据库。
- 阶段四 pipeline。
- RunPipelineJob application。

### 验收

- 手动创建一个 job 后，worker 可以消费它。
- worker 崩溃或任务失败时，job 不会永久停留在 processing。
- worker 不依赖 React、页面和 Route Handler。

### 暂时不要做

- 不接 Redis。
- 不接 BullMQ。
- 不做分布式 worker。
- 不做暂停和恢复。

## 8. 阶段六：TTS 分块和缓存

### 功能

- 配置默认中文音色。
- 按段落和句号切分 chunk。
- 限制 chunk 长度在合理范围。
- 创建包含 voice、rate、pitch、textHash 的缓存 key。
- 命中缓存时跳过 TTS。
- TTS 失败时支持有限次数重试。

### 依赖

- 阶段五 worker。
- TTSProvider。
- FileStorage。

### 验收

- 一段短文本能生成音频文件。
- 相同文本和参数不会重复合成。
- 修改音色或语速不会复用错误缓存。
- TTS 失败能记录到 chunk。

### 测试

- chunk 切分测试。
- cache key 测试。
- retry policy 测试。
- 使用 fake TTS 测试 application。

## 9. 阶段七：FFmpeg 拼接

### 功能

- 检查 FFmpeg 是否安装。
- 检查 chunk 文件是否存在。
- 生成 concat list。
- 拼接多个 chunk 为一个 part。
- 获取 part 时长。
- 拼接失败时记录可展示错误。

### 依赖

- 阶段六 chunk 音频。
- AudioAssembler。
- execa。

### 验收

- 多个 chunk 可以拼成可播放的 mp3。
- part 音频 URL 可被浏览器访问。
- FFmpeg 不可用时有明确错误。
- 损坏或缺失 chunk 不会静默生成错误音频。

## 10. 阶段八：完整任务流水线

### 功能

按以下顺序串起 `RunPipelineJob`：

```text
读取原文
-> 解码
-> 清洗
-> 章节识别
-> part 规划
-> 创建 Part / Chunk
-> TTS 合成 chunk
-> FFmpeg 拼接 part
-> 写入最终状态
```

每一步更新：

```text
job.status
job.stage
job.progress
part.status
chunk.status
errorMessage
```

### 依赖

- 阶段四 pipeline。
- 阶段五 worker。
- 阶段六 TTS。
- 阶段七 FFmpeg。

### 验收

- 一个小 TXT 可以生成多个 part。
- job 进度会随着阶段变化。
- part 和 chunk 状态与真实结果一致。
- 任务成功和失败都能结束，不会无限 processing。

### 测试

- 使用 fake provider 的 RunPipelineJob 测试。
- 至少覆盖 TTS 失败、FFmpeg 失败和成功路径。

## 11. 阶段九：任务页和失败恢复

### 功能

- 创建 JobPage。
- TanStack Query 每 1 到 3 秒轮询。
- 展示阶段、总进度、part/chunk 数量。
- 展示失败 chunk 和错误原因。
- 支持单个 chunk 重试。
- 任务完成后进入播放器。

### 依赖

- 阶段八真实任务状态。
- QueryJob。
- RetryChunk。

### 验收

- queued、processing、completed、failed、cancelled 都有对应 UI。
- 任务结束后停止轮询。
- 离开页面时取消请求。
- 单个 chunk 重试不会重跑整本书。
- 页面刷新后可以恢复查看任务。

### 测试

- `useJobPolling` 测试停止条件。
- JobProgress、ChunkStatusList、RetryPanel 组件测试。
- mock API 错误和失败状态。

## 12. 阶段十：播放器

### 功能

- 获取书籍 part 列表。
- 播放、暂停、上一段、下一段。
- 切换 part。
- 展示当前 part 和播放进度。
- 支持音频下载。
- 使用 Zustand 保存跨页面播放器状态。
- 增加移动端 MiniPlayer。

### 依赖

- 阶段八生成的 part 音频。
- QueryPlayer。
- JobPage 完成跳转。

### 验收

- 可以连续播放多个 part。
- 切换 part 不会播放错误音频。
- 刷新页面后可以重新加载播放列表。
- 手机宽度下播放器可用。
- 播放器状态没有散落在页面组件中。

### 测试

- AudioPlayer 组件测试。
- 播放列表切换测试。
- 至少一条 Playwright 播放页流程。

## 13. 阶段十一：书架和前端打磨

### 功能

- 创建 LibraryPage。
- 展示书名、作者、状态、part 数量、总时长、创建时间。
- 提供继续播放和查看任务。
- 完善空状态、错误状态、加载状态。
- 完善桌面端和移动端布局。
- 统一按钮、表单、进度、弹窗和提示组件。

### 依赖

- 阶段九任务查询。
- 阶段十播放器。

### 验收

- 可以从书架进入任务页和播放页。
- 没有书籍时有空状态。
- 加载和错误不会导致页面布局跳动。
- 上传、任务、播放三个页面在手机视口下可用。

## 14. 阶段十二：质量和交付

### 功能

- 补齐核心 pipeline 和 application 测试。
- 补齐 Upload、Job、Player 组件测试。
- 增加两条关键 Playwright E2E：
  - 上传到任务页。
  - 任务完成到播放页。
- 增加 FFmpeg 检查脚本。
- 增加数据库初始化脚本。
- 完善 README。
- 录制完整流程演示。

### 验收

- `lint` 通过。
- TypeScript 检查通过。
- 单元测试通过。
- 关键 E2E 通过。
- 新环境可以按照 README 启动。
- 面试官可以在本地跑通主流程。

## 15. 推荐开发粒度

每次只实现一个可验证的小任务：

```text
创建一个 schema
实现一个 repository 方法
实现一个 pipeline 函数
实现一个 application use case
实现一个 Route Handler
实现一个页面状态
实现一个组件
补一个测试场景
```

每个任务必须写清楚：

- 目标。
- 涉及文件。
- 前置依赖。
- 验收标准。
- 测试要求。
- 手动验证方式。

## 16. 不应提前实现

在 MVP 完成前，不做：

- 登录和权限。
- PostgreSQL。
- Redis、BullMQ。
- SSE、WebSocket。
- 对象存储。
- 播放进度云同步。
- 字幕、波形图和文本跟读。
- 多 TTS Provider 的完整配置页面。
- 复杂管理后台。
