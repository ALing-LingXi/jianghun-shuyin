# 匠魂书音项目规则

## 1. 规则来源

- 总体计划：`docs/development-plan.md`
- 模块依赖：`docs/module-dependencies.md`
- 功能顺序：`docs/implementation-roadmap.md`
- `docs/.archive/development-plan.backup.md` 是历史备份。除非用户明确要求对比或恢复，否则不要读取、引用或修改。

本文件只保留必须遵守的工程规则，不重复上述文档的详细内容。

## 2. 固定技术栈

```text
Next.js + App Router
TypeScript
React
Tailwind CSS
TanStack Query
Zustand
SQLite + Drizzle ORM
Zod
Node Worker + p-queue
execa + FFmpeg
edge-tts
Vitest + React Testing Library + Playwright
ESLint + Prettier
```

未经用户同意，不要替换为 Python/FastAPI、另一套前端框架、另一套状态管理方案或生产级基础设施。

MVP 阶段不引入 PostgreSQL、Redis、BullMQ、SSE、WebSocket、对象存储和登录系统。

## 3. 核心边界

```text
src/app
  页面、布局、Route Handlers

src/features
  上传、任务、播放器、书架和 UI

src/shared
  Zod schema、共享类型、常量

src/server/domain
  实体、状态、业务错误

src/server/application
  业务用例编排

src/server/ports
  外部依赖接口

src/server/infrastructure
  数据库、文件、TTS、FFmpeg、Worker 实现

src/server/pipeline
  解码、清洗、章节识别、分段规划

src/worker
  长任务执行
```

必须遵守：

- 页面不直接访问数据库、文件系统、FFmpeg 或 TTS。
- 页面不直接实现复杂请求、轮询和跨页面播放器状态。
- Route Handler 只负责参数校验、调用 use case 和返回 DTO。
- Route Handler 不同步执行完整 TTS 或 FFmpeg 流程。
- application 不依赖 Next.js、React、Drizzle 或具体 provider。
- pipeline 不访问数据库和 storage。
- domain 不依赖框架、ORM、TTS 或 FFmpeg。
- worker 不依赖 React、页面和浏览器 API。

## 4. 类型和 API

- TypeScript 开启严格模式。
- API 入参和出参使用 Zod 校验。
- 前端、Route Handler、worker 和测试尽量复用 `src/shared` 的 schema 和类型。
- 不要在前后端复制相同 DTO。
- 任务状态和阶段使用统一类型。
- 修改 API 契约时，同时更新 schema、调用方、mock、测试和 README。
- API 错误使用稳定错误码或错误类型，前端不要依赖错误文案判断业务状态。

## 5. 前端状态

- 服务端数据使用 TanStack Query。
- 跨页面播放器状态使用 Zustand。
- 不要把服务端查询结果复制到 Zustand。
- 轮询在 `completed`、`failed`、`cancelled` 后停止。
- 页面离开时取消请求。
- 页面和组件必须处理 loading、error、empty、disabled 状态。

## 6. 服务端实现

- SQLite 只服务本地 MVP。
- 数据库访问集中在 infrastructure repository。
- 文件路径集中管理，application 和页面不得手写 storage 路径。
- TTS 调用必须通过 `TTSProvider`。
- FFmpeg 调用必须通过 `AudioAssembler`。
- chunk 缓存 key 至少包含文本 hash、音色、语速和音调。
- 单个 chunk 失败时只重试该 chunk，不重跑整本书。
- 具体实现统一在 `src/server/composition/container.ts` 组装。

## 7. 开发和修改方式

开始任务前：

1. 阅读本文件和相关计划文档。
2. 检查当前工作区和已有改动。
3. 阅读受影响的现有代码，再决定修改范围。

实现任务时：

1. 优先复用现有目录、类型、hook 和组件。
2. 保持修改范围小，不做无关重构。
3. 先实现最小可运行路径，再补错误状态和测试。
4. 不因为计划中存在目录就创建空文件。
5. 不提前实现当前任务不需要的基础设施。

## 8. 测试和交付

- 修改业务逻辑时补相关测试。
- 修改任务状态、轮询、缓存、重试、API schema 或播放器行为时必须测试。
- 纯函数优先使用 Vitest。
- 交互组件使用 React Testing Library。
- 主流程使用 Playwright。
- 完成后优先运行相关 lint、TypeScript 检查和测试；如果用户明确要求手动验证，则由用户执行这些命令并把结果发回。
- 手动验证受影响的主流程。
- 汇报修改文件、验证结果和未完成事项。

## 9. Git 保存

- 每次大的开发单元完成后，必须使用 Git 保存为一个独立 commit。
- 提交前必须检查工作区状态，确认只包含本次开发相关的修改。
- 提交前完成适用的 lint、TypeScript 检查和测试；若用户已接手最后验证，则等用户反馈结果后再提交。
- 一个大的开发单元不要混入无关修改；必要时拆分为多个清晰的 commit。
- 交付时汇报 commit id、提交内容和验证结果。

## 10. 用户指令优先

本文件和计划文档是默认约束，不是对用户明确要求的永久禁止。用户明确要求改变技术栈、范围或开发顺序时，遵循用户最新指令，并说明影响。
