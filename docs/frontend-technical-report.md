# 匠魂书音前端技术报告

这份报告用于快速理解项目的前端部分：做了哪些页面、为什么这样拆、数据怎么流动、播放器怎么实现，以及这些设计能体现哪些前端工程能力。

## 1. 前端目标

匠魂书音的前端不是单纯展示静态页面，而是围绕“本地 TXT 转有声书”和“本地阅读”两个真实工作流设计：

- 用户可以上传或粘贴文本，创建音频生成任务。
- 用户能在任务页看到长任务进度、当前阶段、章节队列和失败原因。
- 用户能在书架查看生成结果，进入播放器播放已完成章节。
- 播放器支持跨页面状态、移动端 MiniPlayer、进度条、连续播放、睡眠定时和失败章节重试。
- 阅读模块支持本地书籍上传、书架、目录、章节阅读和阅读进度保存。

前端重点解决的是“长任务 + 局部失败 + 可播放内容逐步出现”的交互复杂度。

## 2. 前端技术栈

```text
Next.js App Router
React
TypeScript
Tailwind CSS
TanStack Query
Zustand
Zod
lucide-react
Playwright
React Testing Library
```

各技术的职责：

- Next.js App Router：负责页面路由和 API Route Handler 入口。
- React：负责页面和组件渲染。
- TypeScript：约束组件 props、DTO、状态枚举和业务分支。
- Tailwind CSS：构建响应式布局和视觉系统。
- TanStack Query：管理服务端数据请求、缓存、轮询和 mutation 后失效刷新。
- Zustand：管理跨页面播放器状态。
- Zod：校验 API 返回数据和表单输入，避免前后端 DTO 漂移。
- Playwright：验证书架、上传、播放器等主流程。

## 3. 前端目录分层

前端主要分布在三个目录：

```text
src/app
src/features
src/shared
```

### 3.1 src/app

`src/app` 负责路由和页面入口，尽量保持轻薄。

典型页面：

```text
src/app/upload/page.tsx
src/app/jobs/[jobId]/page.tsx
src/app/books/page.tsx
src/app/books/[bookId]/player/page.tsx
src/app/reading/page.tsx
src/app/reading/upload/page.tsx
src/app/reading/[bookId]/chapters/[chapterIndex]/page.tsx
```

这些 page 文件主要做两件事：

- 读取路由参数。
- 渲染对应 feature 组件。

例如任务页最终渲染 `JobPage`，播放器页最终渲染 `PlayerPage`。这样可以避免把页面逻辑、请求逻辑和 UI 细节堆在 App Router 文件里。

### 3.2 src/features

`src/features` 是前端业务模块，每个模块包含自己的页面组件、子组件、hooks 或 store。

```text
src/features/upload
src/features/job
src/features/library
src/features/player
src/features/reading
src/features/ui
```

模块职责：

- `upload`：上传表单、文本/文件模式、TTS 参数选择。
- `job`：任务状态页、进度面板、暂停/恢复控制。
- `library`：有声书书架、删除、播放入口、任务入口。
- `player`：播放器页面、播放器状态、全局音频引擎、MiniPlayer。
- `reading`：阅读书架、阅读上传、章节阅读器。
- `ui`：全局外壳、导航、页面头部等复用 UI。

### 3.3 src/shared

`src/shared` 放前后端共享的 schema 和类型。

前端请求拿到响应后会用 Zod parse：

```text
playerSchema.parse(body)
jobSchema.parse(body)
librarySchema.parse(body)
readingLibrarySchema.parse(body)
```

这样做的好处是：

- API 字段变更时能尽早暴露问题。
- 组件拿到的数据已经是经过校验的 DTO。
- 前端、Route Handler、测试可以复用同一份契约。

## 4. 页面与功能实现

## 4.1 首页和应用外壳

根布局在 `src/app/layout.tsx` 中完成三个关键工作：

```tsx
<DemonAppFrame>
  {children}
</DemonAppFrame>
<PlayerAudioEngine />
<MiniPlayer />
```

含义：

- `DemonAppFrame` 提供全局背景、侧边导航、移动端导航和页面容器。
- `PlayerAudioEngine` 是全局隐藏 audio 元素，负责真正播放音频。
- `MiniPlayer` 挂在全局布局，用户离开播放器页面后仍能看到播放控制。

这是播放器能跨页面工作的关键：播放能力不绑定在某一个播放器页面组件上，而是放在全局 layout。

## 4.2 上传页

上传页由 `src/features/upload/upload-form.tsx` 实现。

它支持两种上传模式：

```text
粘贴文本
选择 TXT 文件
```

前端状态包括：

- 上传模式：`text` / `file`
- 提交状态：`idle` / `submitting` / `error`
- 书名、作者、正文、文件
- TTS 音色、语速、音调
- 音色下拉框打开状态和搜索关键词

实现细节：

- 使用 `uploadTextSchema` 和 `uploadFileSchema` 在提交前校验表单。
- 文件上传使用 `FormData`。
- 文本上传使用 JSON。
- 上传成功后读取返回的 `jobId`，跳转到 `/jobs/[jobId]`。
- 音色列表从 `/api/tts/voices` 获取，失败时回退到默认云溪音色。
- 音色选择框显示中文短名，例如“云溪”“晓晓”，避免显示过长的 Edge TTS id。
- 下拉框内部带搜索，并用 `max-h-64 overflow-y-auto` 控制高度，避免过长列表撑开页面。

这个模块体现了表单状态、异步提交、前端校验、错误回显和复杂选择控件的处理能力。

## 4.3 任务页

任务页由 `src/features/job/job-page.tsx` 和 `src/features/job/components/job-status-panel.tsx` 实现。

核心职责：

- 展示任务状态。
- 展示当前阶段。
- 展示进度条。
- 展示已完成/失败章节数量。
- 展示章节队列。
- 支持暂停和恢复。
- 在失败时给出诊断信息。

数据获取由 `useJobPolling` 负责：

```text
GET /api/jobs/[jobId]
-> jobSchema.parse
-> TanStack Query 缓存
-> 根据 job.status 控制轮询
```

轮询策略：

- `queued` / `processing` 继续轮询。
- `completed` / `completed_with_errors` / `failed` / `cancelled` / `paused` 停止轮询。

任务页有一个很重要的交互设计：章节标题在规划完成后就能看到，不需要等音频全部生成完成。这样用户能确认“文本切割结果是否合理”，也能看到长任务正在推进。

暂停/恢复由 `JobGenerationControls` 和 `useJobControls` 实现：

- `canPauseJob` 判断 queued/processing 可暂停。
- `canResumeJob` 判断 paused 可恢复。
- mutation 成功后 invalidate job/player/library 相关 query。

## 4.4 有声书书架

书架由 `src/features/library/library-page.tsx` 实现。

它解决的问题是：用户需要从多个已上传书籍中快速判断哪些可播放、哪些还在生成、哪些失败。

每个书籍卡片展示：

- 书名、作者、创建时间。
- 书籍状态。
- 最新 job 状态。
- 可播放章节数 / 总章节数。
- 总时长。
- 生成进度。
- 播放入口。
- 任务详情入口。
- 删除操作。

数据获取由 `useLibraryQuery` 负责：

```text
GET /api/books
-> librarySchema.parse
-> useQuery
```

删除使用 `useDeleteLibraryBook`：

```text
DELETE /api/books/[bookId]
-> mutation 成功后 invalidate ["library"]
```

删除交互采用二次确认：第一次点击进入确认态，第二次才真正删除，减少误删风险。

## 4.5 播放器页面

播放器由三部分组成：

```text
AudioPlayer          可见播放器 UI
PlayerAudioEngine   全局隐藏 audio 引擎
player-store        Zustand 播放状态
```

### AudioPlayer

`src/features/player/components/audio-player.tsx` 负责播放器 UI。

主要能力：

- 显示当前章节标题。
- 显示可播放数量、生成中数量、失败数量。
- 显示章节列表。
- 支持上一章、下一章、播放/暂停。
- 支持进度条拖动 seek。
- 支持连续播放和单章播放切换。
- 支持“播完当前章节后停止”。
- 支持睡眠定时。
- 支持失败章节重试。
- 支持长标题省略，并保留 `title` 属性方便查看完整标题。

播放器 UI 不直接操作 DOM audio，而是把用户操作写入 Zustand：

```text
点击播放 -> setPlaying(true)
点击下一章 -> goToNext()
拖动进度条 -> requestSeek(seconds)
选择章节 -> setPartId(part.id)
```

### PlayerAudioEngine

`src/features/player/components/player-audio-engine.tsx` 是真正驱动音频播放的组件。

它渲染一个隐藏的 `<audio>`：

```tsx
<audio data-testid="player-audio-engine" preload="metadata" />
```

它监听 Zustand 状态：

- 当前 partId
- parts
- isPlaying
- seekTargetSeconds
- continuousPlayback
- stopAfterCurrent
- sleepTimerEndsAt

然后同步到 HTMLAudioElement：

- 当前章节变化时更新 `audio.src`。
- `isPlaying` 为 true 时调用 `audio.play()`。
- `isPlaying` 为 false 时调用 `audio.pause()`。
- `seekTargetSeconds` 有值时设置 `audio.currentTime`。
- `timeupdate` 时把播放进度写回 Zustand。
- `ended` 时根据连续播放、停止设置和睡眠定时决定是否进入下一章。

这样拆分的好处：

- UI 组件不用直接关心 audio API。
- MiniPlayer 和播放器主页面共享同一套播放状态。
- 离开播放器页面后音频引擎仍然存在。
- 页面上只保留一个真实 audio 元素，避免多个播放器抢状态。

### Zustand store

`src/features/player/player-store.ts` 管理播放器状态：

```text
bookId
partId
parts
isPlaying
currentTimeSeconds
durationSeconds
seekTargetSeconds
continuousPlayback
stopAfterCurrent
sleepTimerEndsAt
```

它还提供播放器动作：

```text
setParts
setPartId
setPlaying
setPlaybackTime
requestSeek
goToPrevious
goToNext
handlePartEnded
```

关键设计点：

- `setParts` 会自动选择第一个可播放章节。
- 切换章节时会重置播放时间和 seek 状态。
- `handlePartEnded` 集中处理连续播放、睡眠定时和停止条件。
- 只把跨页面、即时交互状态放进 Zustand，不把服务端查询数据完整复制成第二份业务数据源。

## 4.6 MiniPlayer

`src/features/player/components/mini-player.tsx` 是移动端/跨页面播放器入口。

它从同一个 Zustand store 读取：

- 当前章节。
- 是否播放中。
- 是否连续播放。
- 上一章/下一章可用状态。

因此 MiniPlayer 不需要重新请求播放器数据，也不会和主播放器出现两个独立状态。

## 4.7 阅读模块

阅读模块位于 `src/features/reading`。

它和有声书生成是两条不同的业务线，但复用了相同的前端组织方式：

```text
reading-library-page.tsx
reading-upload-page.tsx
reading-page.tsx
hooks/useReadingLibraryQuery.ts
components/reading-shell.tsx
```

实现能力：

- 上传阅读书籍。
- 可选上传封面。
- 阅读书架展示。
- 阅读书籍详情与章节目录。
- 章节内容阅读。
- 上一章/下一章导航。
- 阅读进度保存。

数据管理：

- `useReadingLibraryQuery` 获取阅读书架。
- `useReadingBookQuery` 获取书籍详情和目录。
- `useReadingChapterQuery` 获取章节内容。
- `useCreateReadingBook` 创建阅读书籍。
- `useDeleteReadingBook` 删除阅读书籍。
- `useUpdateReadingProgress` 保存阅读进度。

这些 hooks 都使用 Zod 校验响应，mutation 成功后通过 `invalidateQueries` 刷新相关缓存。

## 5. 服务端数据和客户端状态怎么划分

项目里有两类状态：

### 服务端状态

服务端状态来自 API，需要缓存、轮询、重新请求。

例如：

- 书架列表。
- job 进度。
- player parts。
- 阅读书架。
- 阅读章节内容。

这类状态使用 TanStack Query。

### 客户端交互状态

客户端状态只存在浏览器里，和当前用户操作有关。

例如：

- 当前播放章节。
- 是否正在播放。
- 当前播放时间。
- 是否连续播放。
- 睡眠定时。
- 音色下拉框是否打开。
- 删除确认态。

这类状态使用 React local state 或 Zustand。

划分原则：

- 服务端真实数据不复制到 Zustand 当第二数据源。
- 跨页面播放器状态放 Zustand。
- 局部表单状态放组件内部 `useState`。
- API 数据统一走 Query + schema parse。

## 6. API 契约和错误处理

前端 hooks 一般按这个模式写：

```text
fetch API
-> 尝试解析 JSON
-> response.ok 判断
-> 失败抛出自定义 ApiError
-> 成功用 Zod schema parse
-> 组件基于 isPending / isError / data 渲染
```

例如播放器：

```text
fetchPlayer(bookId)
-> GET /api/player/books/[bookId]
-> playerSchema.parse(body)
```

好处：

- 组件不用猜响应结构。
- 错误状态能稳定展示。
- 测试可以基于同一份 DTO 契约写断言。

## 7. 轮询策略

项目里轮询不是无脑固定刷新，而是按业务状态停止。

任务页：

```text
queued / processing -> 继续轮询
paused / completed / completed_with_errors / failed / cancelled -> 停止轮询
```

播放器页：

```text
存在 pending / processing / tts / assembling 的 part -> 继续轮询
latestJob.status === paused -> 停止轮询
全部 part 稳定后 -> 停止轮询
```

这样能同时满足：

- 生成过程中页面自动更新。
- 完成后不浪费请求。
- 暂停后不继续无意义刷新。

## 8. UI 和交互设计

前端视觉使用统一的“暗色魔幻像素风”外壳：

- 侧边导航和移动端顶部导航。
- fuchsia / magenta / amber 为主色。
- 面板、按钮、输入框统一 `.demon-*` class。
- 关键操作使用 lucide-react 图标。
- 页面使用响应式 grid，在移动端保留 MiniPlayer 底部空间。

全局样式在 `src/app/globals.css` 中集中定义：

- CSS 变量定义颜色和字体。
- `.demon-page`、`.demon-panel`、`.demon-button-*`、`.demon-input` 等复用样式。
- 自定义滚动条和 range input。
- `prefers-reduced-motion` 降低动画。

交互上重点处理：

- loading 骨架和空状态。
- error 状态和 retry 按钮。
- disabled 状态。
- 长标题 `truncate` + `title`。
- 任务失败诊断信息。
- 删除二次确认。
- 移动端 MiniPlayer。

## 9. 前端主流程

### 音频生成主流程

```text
/upload
-> 用户粘贴文本或选择 TXT
-> 前端校验标题、正文/文件和 TTS 参数
-> POST /api/uploads/text 或 /api/uploads/file
-> 返回 jobId
-> router.push("/jobs/[jobId]")
-> useJobPolling 轮询任务进度
-> 章节规划后展示章节标题
-> 生成完成后从书架或任务页进入播放器
-> usePlayerQuery 获取 part 列表
-> PlayerAudioEngine 播放当前 audioUrl
```

### 播放主流程

```text
播放器页拿到 player.parts
-> setParts 写入 Zustand
-> 自动选中第一个可播放 part
-> AudioPlayer 点击 Play
-> Zustand isPlaying = true
-> PlayerAudioEngine 调用 audio.play()
-> timeupdate 写回 currentTimeSeconds
-> ended 后根据连续播放策略进入下一章
```

### 阅读主流程

```text
/reading/upload
-> 上传阅读书籍和可选封面
-> 创建阅读书籍
-> 返回阅读书架
-> 进入章节页
-> useReadingBookQuery 拉目录
-> useReadingChapterQuery 拉章节内容
-> useUpdateReadingProgress 保存进度
```

## 10. 体现的前端能力

这部分可以作为面试表达：

1. 复杂状态拆分能力  
   服务端状态用 TanStack Query，跨页面播放器状态用 Zustand，局部表单状态用 React state。

2. 长任务前端体验设计  
   通过轮询、阶段展示、章节队列、暂停/恢复、失败诊断，让用户理解后端 worker 正在做什么。

3. 播放器工程化能力  
   把真实 audio 元素抽成全局 `PlayerAudioEngine`，UI 组件只负责控制状态，避免多个播放器实例冲突。

4. API 契约意识  
   前端 hooks 使用 Zod parse 响应数据，减少隐式 any 和接口漂移。

5. 错误和边界状态处理  
   每个主页面都处理 loading、error、empty、disabled、retry、confirm delete 等状态。

6. 响应式和移动端体验  
   全局导航区分桌面侧边栏和移动顶部栏，播放器提供 MiniPlayer，布局避免长标题撑破容器。

7. 可测试性  
   页面关键节点设置 `data-testid`，主流程使用 Playwright 验证书架和播放器行为。

## 11. 可以继续优化的点

- 把多个页面内临时创建 `QueryClientProvider` 的模式统一成全局 Provider，减少重复。
- 给上传页的音色选择框补更完整的键盘操作，例如方向键和 Escape。
- 给播放器增加播放进度持久化，刷新后恢复到上次位置。
- 给阅读器增加字体大小、行距、主题切换。
- 给任务页增加 chunk 级失败详情，而不只展示 part 状态。
- 在视觉层继续统一中英文文案，减少不同页面之间的语气差异。

## 12. 一句话总结

前端部分的核心价值是：把一个耗时、容易失败、分阶段产出的“文本转音频”任务，包装成用户可以理解、可以暂停、可以恢复、可以边生成边查看结果的本地应用体验；同时用 Query、Zustand、Zod 和 App Router 把数据请求、播放器状态、契约校验和页面组织拆清楚。
