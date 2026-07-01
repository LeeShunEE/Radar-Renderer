# 背景媒体支持（Issue #18）— 设计讨论决策记录

> 创建日期：2026-06-24
> 关联 Issue：[#18 背景媒体支持 (Background Media Support)](https://github.com/LeeShunEE/Radar-Renderer/issues/18)
> 用途：逐条记录本特性各讨论问题的**最终结论**，作为后续出实施计划（`writing-plans`）的依据。
> 状态：讨论进行中（决策随讨论推进逐条追加）。

---

## 决策基线（已拍板）

| 项 | 决定 |
| - | - |
| 背景配置数据结构 | **独立 `background` 对象**挂到 `RadarVideoSchema` 顶层，vignette 保留在 `theme`；旧配置用 `.default()` 回落 `gradient` |
| 首期范围 | **图片 + 视频一起做**，视频加上传体积 / 1080p 分辨率护栏 |
| 渲染端媒体鉴权 | 复用现有 **改写机制**（`silhouette_rewrite.py`）；**方案 A 软链已被验证否决，改用方案 B：把 `backend_storage` 只读挂进 worker publicDir，零拷贝**（见问题 1 + 验证记录） |
| 预览端媒体鉴权 | 复用现有 **blob objectURL 机制**（`replaceUploads`），视频同样走 blob（见问题 1） |

---

## 问题 1 — 视频在「预览」与「渲染」两端的媒体加载与资源消耗

### 背景事实（代码现状）

- **渲染端鉴权不走 token，而是物理改写**：提交渲染时 `render_service.submit` 调 `rewrite_uploaded_silhouettes`（`backend/app/service/silhouette_rewrite.py`）——遍历 `input_props`，命中 `silhouetteSrc` 且值匹配 `/api/v1/files/uploads/<name>` 时，把文件 `shutil.copy2` 到 `publicDir/_render_tmp/<token>/<name>` 并改写成相对路径；worker 用 `staticFile` 读本地文件，headless Chromium 全程不需要 Bearer token；渲染后 `cleanup_render_tmp` 按 token 删目录。**该逻辑只认 `silhouetteSrc` 这一个 key 名。**
- **预览端鉴权走 blob**：`PreviewPanel.tsx` 的 `replaceUploads`（约 line 499）把 `input_props` 中匹配 uploads URL 的 `silhouetteSrc` 换成 blob objectURL（裸 http src 会 401）。**同样只认 `silhouetteSrc` key。**
- **下载端点已流式**：`files_router.py:52` `download_upload` 用 Starlette `FileResponse`，**按 ~64KB 分块从磁盘流式**，服务器内存恒定 ≈ 一个 chunk，不随文件大小涨，且原生支持 HTTP Range。
- **鉴权方式**：纯 **Bearer**（`deps.py` `HTTPBearer`，Authorization header）——这正是 `<img>`/`<video>` 标签发不了 header、需要 blob 变通的根因。
- **卷拓扑**（`deploy/docker-compose.yml`）：`backend_storage` 卷在 backend 与 worker 中**都挂在同一绝对路径 `/app/storage`**（worker 第 150 行已挂，为回写产物）；`render_tmp` 卷在 backend 挂 `/app/public_assets/_render_tmp`、在 worker 挂 `/app/public/_render_tmp`。当前 copy 是 `backend_storage` → `render_tmp` 的**跨卷全量拷贝**。

### 决策

#### 1a. 渲染端大文件复制 → **方案 B：只读挂载零拷贝（方案 A 软链已验证否决）**

> 2026-06-24 spike 结论：**方案 A（软链）行不通**，见文末「验证记录」。改用方案 B。

**方案 B（最终决策）**：
- compose 给 worker 加只读挂载 `backend_storage:/app/public/_user_media:ro`，使用户上传原件以**真实文件**形态出现在 worker publicDir 下。
- src 改写成相对路径 `_user_media/<user>/uploads/<name>`，worker `staticFile` 直读 → **零拷贝、零额外磁盘、无 `_render_tmp` 复制、无清理逻辑**。
- **不做内容 hash 去重**：无 copy 可省，去重徒增复杂度。
- 安全：用户文件整体出现在 publicDir 下，但 worker 是纯内网服务、publicDir 不对公网暴露，风险低；挂载只读防 worker 误写。
- 改写逻辑同时**从「按 key 名 `silhouetteSrc` 匹配」泛化为「按值匹配 uploads 正则」**，使背景媒体及未来任何媒体字段自动覆盖，无需逐字段改。剪影现有 copy 路径一并迁移到挂载方案（去掉 `_render_tmp` copy/cleanup）。

**方案 A（已否决，留档）**：原设想 backend 建绝对路径软链 `_render_tmp/<token>/<name>` → `/app/storage/...`。被否原因见验证记录——Remotion 静态服务默认拒绝软链（404），且 Windows 本地开发无权限建软链（EPERM）。

#### 1b. 预览端大视频 → **方案 (a)：视频也走 blob（与剪影同一套 `replaceUploads`）**

- 目标澄清：**只在意服务器内存，客户端浏览器内存不重要**。
- blob 占的是**客户端**内存（不重要）；服务器端 `FileResponse` 本就分块流式，blob 的整文件 GET **不会**让服务器多吃内存。故 blob 对服务器内存目标**无负面影响**，且实现最简。
- **取消**短时签名 URL / Range 流式那套——它优化的是客户端内存，对本目标无价值，且会增加后端复杂度（`download_upload` 无需改动）。
- `replaceUploads` 需扩展为识别背景媒体 src（同 1a 的泛化思路），不止 `silhouetteSrc`。

#### 1c. 服务器内存的真正杠杆 → 渲染端运行时旋钮

服务器 RAM 实际大头在 worker `OffthreadVideo` 抽帧，由以下兜住：

- 方案 A 软链：零复制 → 不额外占盘 / 不额外 IO。
- `offthreadVideoCacheSizeInBytes`：封顶帧缓存内存。
- **1080p 分辨率上限**：抽帧成本随分辨率平方增长，收益最大。
- 含视频的渲染任务**降 concurrency**（worker 当前 `concurrency: null` 自动）。
- `imageFormat: "jpeg"` 抽帧比 png 省内存。

### 待办（由问题 1 引出，进实施计划）

- [ ] **spike**：验证 Remotion 渲染端跟随 publicDir 外软链（决定方案 A vs B）。
- [ ] 后端 `silhouette_rewrite.py`：copy2 → 软链；key 匹配泛化为值匹配；函数/模块更名（如 `media_rewrite`）。
- [ ] 前端 `replaceUploads`：扩展识别背景媒体 src。
- [ ] 上传/选择背景视频时加体积上限护栏；渲染配 1080p 上限 + OffthreadVideo 缓存上限 + 视频任务降并发。

---

## 问题 2–9 决策记录（2026-06-24 已拍板）

### 问题 2 — 背景视频时长适配
雷达视频总时长由 `calculateDuration(animation)` 决定。背景视频通常长短不一：
- 比总时长短 → `loop`（issue 已有选项）。
- 比总时长长 → `startFrom`（issue 定义为毫秒）截取一段。
- `playbackRate` 改变有效时长，与 loop 叠加行为需定义。

均可由 `<OffthreadVideo trimBefore playbackRate loop>` 表达（注意 issue 的 `startFrom` 是**毫秒**，Remotion 需**帧**，落地时按 fps 做 ms→帧换算）。

**决策**：默认 `loop: true`（短视频循环）；编辑器读 `<video>` 元数据显示「视频 Xs / 总时长 Ys」**非阻塞提示**，不强行截断报错。

### 问题 3 — vignette 抽离的像素级等价
**关键事实**：现有 vignette 是把 backgroundColor **加性变暗**（`vignetteBrightness` 是 -100~0 的 RGB 偏移）烘进同一个 `radial-gradient`。用「黑色半透明叠加层」**无法**像素级等价复现（alpha 混合 ≠ 加性偏移）——所以"等价抽离"在数学上做不到。

**决策**：**gradient 模式的 `BackgroundGradient` 原样不动**（零回归）；仅为 image/video **新增一个独立 vignette 叠加层**，用相同参数（center/stops/brightness）转成叠加渐变，**近似即可**（全新路径，无存量观感漂移问题）。两条路**不强行统一**。

### 问题 4 — AssetSelector 第三类
当前 `category: "silhouettes" | "music"`。背景媒体含图片 + 视频，缩略图渲染逻辑不同。

**决策**：**新增 `backgrounds` 类**（接受 image+video 扩展名），不复用 silhouettes，避免污染剪影列表；视频缩略图用 `<video muted preload="metadata">`（浏览器自动显首帧），图片用 `<img>`。

### 问题 5 — BackgroundSchema 形状与跨页覆盖集成
`background` 作为 `RadarVideoSchema` 顶层独立对象，`.default({ type: "gradient" })` 确保旧 JSON 无 `background` 时回落。

**关键事实**：`OVERRIDE_GROUPS`（`global-override.ts`）是扁平点路径字段表，UI 按 number/color/boolean/enum/string 通用控件渲染——**渲染不出资源选择器**，`media.src` 只能裸字符串输入框，体验差；且 `src` 偏「身份/品牌」属性（同 `silhouetteSrc` 被刻意排除在 override 外）。

**决策**：**首期 background 不进 `OVERRIDE_GROUPS`**，保持逐页独立；样式参数（opacity/blur 等）的跨页覆盖留后续迭代。

### 问题 6 — 编辑器 UI 形态
**决策**：**新建独立「背景」面板**，含类型三选一 + media 控件（opacity / blur / scale / position）+ videoOptions（loop / muted / playbackRate / startFrom，按 type=video 条件展开）；并把 vignette 从 `ThemeEditor` **挪进**该面板（背景与暗角语义相关，聚拢更顺）。ThemeEditor 回归纯配色。

### 问题 7 — 视频上传护栏阈值
issue 风险表要求体积 + 1080p 上限。用户总配额 `max_user_storage_bytes` = 200MB。

**决策**：**软警告，不硬拦**。背景视频单文件 **~50MB 软上限 + 超 1080p 提示**（上传时读 `videoWidth/videoHeight` 给警告，不阻止）；渲染端 composition 本就 1920×1080，超分辨率视频自动缩放绘制（仅多耗解码，功能可用）。具体阈值可在实现时微调。

### 问题 8 — 预览端 OffthreadVideo 降级行为
`<OffthreadVideo>` 在浏览器 Player 中实际降级为 HTML `<Video>`，muted/playbackRate/loop/trim 两端一致；唯一差异是渲染端逐帧精确、预览近实时，时序有微小差。

**决策**：**接受该微小时序差并记录**，无需额外处理。

### 问题 9 — 背景视频自带音轨 vs musicUrl
**决策**：**首期就支持背景视频出声**（不锁 muted）。

**⚠️ 范围警示（本特性最大工作面，需独立子阶段 / 可能 spike）**：已核实当前音频架构——

- **关键事实**：Remotion `<OffthreadVideo>` **本身不含音轨**。要让背景视频出声，必须为其**额外加一个 `<Audio src={bgVideoSrc}>`**（与 OffthreadVideo 同源并行），不能指望 OffthreadVideo 带声。
- **两条产物链路都要改**：
  1. **服务端渲染**（render-worker `renderMedia`）：composition 现仅 `MultiPageVideo.tsx:68` 一个 `<Audio src={musicSrc}>`。加背景视频 `<Audio>` 后 Remotion 会自动混多轨——这条相对省力。
  2. **客户端导出**（#41 WebCodecs AAC）：`render-media-source.ts` 现在**只 `fetchAndDecodeAudio` 单个 musicUrl → 单 AudioBuffer**。要含背景视频音轨，须**解码视频音轨 + 多 AudioBuffer 混音**后再编 AAC。
- **多页放大复杂度**：每页可有各自背景视频、各自音轨、各自时间偏移，客户端导出需按偏移混 N 路视频音轨 + musicUrl。
- **建议**：实施计划里把「背景视频音频」拆成**独立阶段**，先做无声视频背景（OffthreadVideo 纯视觉）跑通主链路，再单独攻音频混流；客户端多 buffer 混音可能需先 spike。

---

#### 问题 9 最终落地决策（Task 7 实施后更新，2026-06-25）

**采用 Option B：服务端渲染支持背景视频出声；客户端/浏览器即时导出不含背景视频音轨（留后续 PR）。**

##### 决策依据

客户端导出实现背景视频音轨存在以下阻力，评估后决定拆出：

1. **视频音频鉴权复杂**：客户端 `fetchAndDecodeAudio` 需 Bearer Token 获取视频文件，而目前 music URL 无鉴权，两路逻辑差异大。
2. **`decodeAudioData` 兼容性不保证**：对视频容器（`.mp4`/`.webm`）调用 `decodeAudioData` 的行为不在 Web Audio API 规范中明确保证，部分视频无音轨时须做静默回落。
3. **多页混音复杂度**：每页背景视频各有自己的 src、`startFrom` 时间偏移，客户端须在 `OfflineAudioContext` 时间轴上按帧精确对齐混 N 路视频音轨 + musicUrl，约需 2 天 / 中高风险。
4. **服务端路径省力**：`<Audio src={bgVideoSrc}>` 与现有 `<Audio src={musicSrc}>` 并列，Remotion 自动多轨混音，约 1.5 小时完成，已在 Task 7.1 实施完毕。

##### 用户侧行为

- **`videoOptions.muted`**（默认 `true`，即静音）控制背景视频是否出声。
- 用户在 `BackgroundConfigPanel` 中将「声音」开关打开（`muted → false`）时，UI 立即显示以下明示提示：

  > ⚠ 背景视频声音仅在**服务端渲染成片**中生效；浏览器即时导出不含背景视频声音（音乐轨道不受影响）。

- 客户端导出（WebCodecs AAC 路径）始终忽略背景视频音轨；musicUrl 音乐轨道两端均有效。

##### 两路输出音频行为汇总

| 场景 | `muted=true`（静音，默认）| `muted=false`（开声音）|
| - | - | - |
| **服务端渲染** | 背景视频无声，仅含 musicUrl | 背景视频有声（`<Audio>` 并行混轨），含 musicUrl |
| **浏览器即时导出** | 背景视频无声，仅含 musicUrl | 背景视频**仍无声**（UI 已明示）；仅含 musicUrl |

> 客户端背景视频音轨支持作为独立 PR 延后实施，届时删除 UI 明示提示。

---

## 验证记录：方案 A/B 基础验证（2026-06-24）

### 验证对象
Remotion 渲染端静态文件服务对「软链 vs 真实文件」的处理，决定方案 A 是否可行。

### 源码分析（@remotion/renderer 4.0.481）
- 渲染时由 `dist/serve-static.js` 起静态服务；图片直读、`<OffthreadVideo>` 经 `/proxy` 回取 staticFile URL，**两条路最终都过 `dist/serve-handler/index.js`**。
- `serve-static.js` 调用处仅传 `{ public: path }`，**未开启 `symlinks` 选项**。
- `serve-handler/index.js`：用 `lstat`（不跟随软链）取状态；`line 163` `isSymLink = stats.isSymbolicLink()`；`line 166-173` 注释明示 "symlink while the `symlinks` option is disabled (which it is by default)"，**命中软链直接返回 404**。

### 运行时验证（本机直接驱动 serve-handler）
| 用例 | 结果 | 含义 |
| - | - | - |
| publicDir 内**真实文件** GET | **200** | 方案 B（挂载真实文件）成立 |
| 真实文件 **Range 请求 `bytes=0-99`** | **206** | 视频流式（Range）成立，方案 B 支持视频 |
| publicDir 内**软链**指向外部文件 | 本机 **EPERM 无法创建软链** | Windows 本地开发无权限建软链 → 方案 A 连本地都跑不起来 |

### 结论
- **方案 A（软链）否决**：① serve-handler 默认对软链返回 404（源码确认，Remotion 无开关启用）；② Windows 开发机建软链 EPERM。两点任一即否决。
- **方案 B（只读挂载）确认可行**：真实文件 200、Range 206，视频与图片均成立。**最终采用方案 B。**

---

## 问题 10+ — （待讨论）

> 问题 1–9 已全部拍板（见上）。后续如有新问题在此追加。

---

## 下一步

问题 1–9 决策齐备，可进入 `writing-plans` 出正式实施计划。实施分阶段建议：

1. **数据层**：`BackgroundSchema`（含 `.default` 回落）+ 类型 + Zod。
2. **渲染端零拷贝**：方案 B 只读挂载 + `media_rewrite`（值匹配泛化，替换 `silhouette_rewrite` 的 copy/cleanup）。
3. **组件**：`BackgroundMedia`（Img / OffthreadVideo，**首期纯视觉无声**）+ 独立 `Vignette` 叠加层；`RadarVideo` 背景 `<Sequence>` 按 type 分发。
4. **预览/上传**：`replaceUploads` 泛化识别背景媒体 src；`AssetSelector` 新增 `backgrounds` 类 + 视频体积/分辨率软警告。
5. **编辑器**：独立「背景」面板 + 挪入 vignette。
6. **（独立阶段）背景视频音频**：服务端 `<Audio>` 多轨 + 客户端 #41 多 buffer 混音（可能先 spike）。
7. **测试**：三阶 + 1:1 镜像 + 覆盖率门槛（见 CLAUDE.md）。
