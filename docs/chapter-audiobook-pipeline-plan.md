# 章节级有声书生成流水线开发计划

## 1. 目标

将当前“整本书生成完成后再播放”的流程，重构为“按章节逐步生成、逐步可听”的流程。

核心目标：

- TXT 小说上传后自动识别章节。
- 每个章节生成一个最终 mp3。
- 生成完成一章，播放器就能立即播放一章。
- 章节内部按小 chunk 调用 TTS。
- 网络波动类 TTS 错误自动重试。
- 某章最终失败后，不阻断后续章节继续生成。
- 失败章节可手动重试。
- 播放器自动播放下一章，并跳过失败章节。
- 支持睡眠定时关闭。

## 2. 不做范围

第一版不做：

- 不做章节编辑、合并、手动拆分。
- 不做字幕、波形图。
- 不做登录和云同步。
- 不做跨章节 chunk 缓存。
- 不播放半章音频。
- 不新增 Chapter 数据表。

## 3. 核心模型

继续复用现有模型，但调整语义：

```text
Book = 一本书
Job = 整本书的生成任务
Part = 一个章节，也是播放器可播放的最小完整单位
Chunk = 章节内部 TTS 小音频，不直接给用户播放
```

结构：

```text
Book
  -> Part 1 / 第一章 / chapter.mp3
      -> Chunk 1
      -> Chunk 2
  -> Part 2 / 第二章 / chapter.mp3
      -> Chunk 1
      -> Chunk 2
```

## 4. 状态设计

### Job 状态

新增或支持：

```text
queued
processing
completed
completed_with_errors
failed
cancelled
```

说明：

- `completed`：所有章节成功。
- `completed_with_errors`：任务跑完，但部分章节失败；成功章节仍可播放。
- `failed`：源文件读取、解码、规划、数据库等致命错误，整本任务无法继续。

### Part 状态

```text
queued
processing
tts
assembling
completed
failed
cancelled
```

说明：

- `completed`：章节 mp3 已生成，可播放。
- `failed`：该章节生成失败，不可播放，可手动重试。
- `queued / processing / tts / assembling`：生成中或等待生成，不可播放。

## 5. 生成流程

```text
上传 TXT
-> 保存原始字节
-> worker 读取 source
-> decodeText
-> cleanText
-> detectChapters
-> 每个章节创建一个 Part
-> 逐章处理：

   Part processing
   -> 按约 350 字切 Chunk
   -> 每个 Chunk 调用 TTS
   -> 网络类错误自动重试
   -> 全部 Chunk 成功
      -> 拼接为该章 mp3
      -> Part completed
      -> 播放器可立即播放
   -> 任一 Chunk 最终失败
      -> 清除该章全部音频产物
      -> Part failed
      -> 记录错误
      -> 继续下一章

-> 全部章节处理结束
   -> 全成功：Job completed
   -> 有失败章节：Job completed_with_errors
```

## 6. 文件产物规则

章节产物必须隔离，避免误删。

建议结构：

```text
storage/chunks/<jobId>/<partId>/<chunkIndex>.mp3
storage/parts/<jobId>/<partId>.mp3
```

失败清理规则：

```text
某章 Chunk 最终失败
-> 删除该章所有 chunk mp3
-> 删除该章最终 part mp3
-> 清空 Part.audioPath / duration
-> 保留 Part 记录
-> Part.status = failed
-> Part.errorMessage = 明确错误
```

不删除其他章节产物。

## 7. TTS 重试策略

增加统一判断函数：

```ts
isRetryableTtsError(error): boolean
```

可重试错误：

```text
NoAudioReceived
WebSocket close
timeout
ECONNRESET
ETIMEDOUT
429
5xx
```

不可重试错误：

```text
文本为空
voice 不存在
rate / pitch 参数非法
本地文件写入失败
FFmpeg 输入缺失
```

默认策略：

```text
最多 5 次
等待间隔：1s / 3s / 8s / 15s / 30s
每次重新创建 TTS 请求
```

## 8. 手动重试章节

新增接口：

```text
POST /api/parts/[partId]/retry
```

规则：

```text
只允许 failed Part 重试
processing / tts / assembling 中的 Part 不允许重试
同一个 Part 同一时间只允许一个 retry
重试只影响当前章节
不影响其他已完成章节
不影响后续章节继续生成
```

重试流程：

```text
-> 清理该章旧音频产物
-> 清空错误信息和 audioPath
-> Part 回到 queued / processing
-> 重新生成该章全部 Chunk
-> 成功后 Part completed
-> 失败后 Part failed，并记录新错误
```

## 9. 播放器规则

播放器以 Part 作为播放列表单位。

显示规则：

- `completed`：可播放。
- `failed`：显示生成失败、错误摘要、重试本章按钮。
- `queued / processing / tts / assembling`：显示生成中，不可播放。

自动播放规则：

```text
当前章播放完
-> 找下一章 completed
-> 遇到 failed 直接跳过
-> 遇到 processing，显示“等待下一章生成”，继续轮询
-> 后面没有可播放章节，停止播放
```

Job 仍在生成时，播放器也要轮询播放列表，让新完成的章节自动出现。

## 10. 睡眠定时器

MVP 支持：

```text
10 / 15 / 30 / 45 / 60 分钟
本章结束后停止
```

触发后：

```text
暂停播放
关闭自动下一章
保留当前播放章节
```

刷新页面后定时器可以重置。

## 11. 实施阶段

### 第一阶段：章节级生成核心

- Part 调整为章节级播放单位。
- 长章节只切 Chunk，不再切多个 Part。
- 一章完成后立即可播放。
- 某章失败不阻断后续章节。
- Job 支持 `completed_with_errors`。

### 第二阶段：可靠性

- 增加 TTS 错误分类。
- 网络类错误自动重试 5 次。
- 失败章节清理本章产物。
- 增加手动重试本章。
- 避免同一章节并发重试。

### 第三阶段：播放器体验

- 播放器轮询新增章节。
- 自动播放下一章。
- 跳过失败章节。
- 等待生成中章节。
- 睡眠定时器。

## 12. 测试计划

必须覆盖：

- 一章长文本只生成一个 Part。
- 一个 Part 内部生成多个 Chunk。
- Chunk 网络错误会自动重试。
- 可恢复错误最多重试 5 次。
- 不可恢复错误不重复重试。
- Chunk 最终失败后，该章所有音频产物被清理。
- 失败章节保留错误信息，但没有 audioPath。
- 某章失败不阻断下一章生成。
- Job 最终进入 completed_with_errors。
- 播放器只播放 completed 章节。
- 自动播放跳过 failed 章节。
- 下一章生成中时，播放器进入等待状态。
- 手动重试 failed 章节成功后恢复可播放。
- 睡眠定时器到点暂停，并阻止自动下一章。

## 13. 验收标准

手动验收：

1. 启动 Next.js。
2. 启动 worker。
3. 上传一本包含多章的 TXT 小说。
4. 观察任务页章节进度变化。
5. 第一章生成完成后，直接进入播放器播放。
6. 确认后续章节继续陆续生成。
7. 模拟一个 Chunk TTS 网络失败。
8. 确认该章节自动重试。
9. 重试耗尽后，该章节 failed，音频产物被清理。
10. 确认后续章节继续生成。
11. 播放器自动跳过 failed 章节。
12. 点击“重试本章”，确认只重新生成该章节。
13. 设置睡眠定时器，确认到点暂停且不自动下一章。

## 14. 风险

- Edge TTS 在线服务不稳定，需要详细错误信息。
- 长篇小说章节多，worker 需要支持长时间运行。
- 浏览器后台或手机锁屏时，睡眠定时器不保证原生 App 级精确。
- FFmpeg 不可用时，章节拼接会失败，需要明确错误提示。

## 15. 核心原则

```text
章节是播放单位。
Chunk 是内部实现细节。
失败章不拖垮整本书。
生成多少章，就能听多少章。
```
