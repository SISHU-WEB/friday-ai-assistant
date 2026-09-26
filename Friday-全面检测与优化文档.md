# Friday App 全面检测与优化文档

> 检测日期：2026-09-26
> 检测对象：Friday（`com.friday.app`，React 19 + Vite 8 + TypeScript + Supabase + Capacitor iOS 17+，Web 端部署于 Vercel）
> 检测方式：全量源码审查（src 全部模块）、构建验证（`npm run build` 通过，exit 0）、产物体积分析、配置核查（Info.plist / capacitor.config / sw.js / manifest）
> 说明：本文所有行号基于当前工作区代码；静态审查结论中"待运行验证"的条目已在验证方法中给出复现步骤。

---

## 一、总体结论

- **构建健康**：`tsc -b && vite build` 通过，无类型错误。
- **架构合理**：reducer 状态机 + repository 模式 + CSS Modules，代码可维护性基础良好；已修复的旧 XSS（innerHTML）问题有注释留痕。
- **主要风险集中在四点**：
  1. 回收站功能入口丢失（功能不可达）；
  2. iOS 原生 App 内语音识别因 WKWebView 不支持 Web Speech API 而整体失效；
  3. 云同步存在"删除不传播、演示数据污染云端"两类数据正确性缺陷；
  4. 订阅/支付为纯前端模拟，商业化前必须服务端化（这也是接入支付宝的前提）。
- 主包 550.3 KB（未压缩）无代码分割；PWA 缓存当前为自毁模式，弱网/离线体验差。

---

## 二、问题清单（按维度）

优先级定义：**P0** 阻断性/数据风险，上线前必修；**P1** 重要缺陷，首个迭代修复；**P2** 明显体验/性能问题；**P3** 打磨项。

### 2.1 功能完整性

| # | 优先级 | 问题 | 位置 | 说明 |
|---|---|---|---|---|
| F-1 | **P0** | 回收站入口缺失，功能整体不可达 | `src/components/Header.tsx` | Header 声明并接收 `onOpenTrash`/`trashCount` props（第 8-9 行），但 JSX 中只渲染了日期块、设置按钮、归档按钮，**没有回收站按钮**；`Header.module.css` 中 `.trashButton` 样式存在却无元素使用。结果：删除任务后回收站面板（`TrashPanel`）永远无法打开，恢复/彻底删除/清空全部不可用。 |
| F-2 | **P0** | 支付为纯前端模拟，且界面货币自相矛盾 | `src/lib/stripe.ts`、`src/components/SubscriptionPanel.tsx` | `startCheckout` 直接调用 `simulateCheckoutSuccess` 写本地存储，未发起任何真实支付；`restorePurchases` 恒返回"已恢复"。同一订阅卡片中价格区显示 `¥28/月`，CTA 按钮英文态显示 `$4.99/mo`（中文态又显示 ¥28），用户看到两种货币。 |
| F-3 | **P1** | 游客/本地模式按钮无效 | `src/components/Auth.tsx:205-207` | "稍后再登录（本地模式）"仅 `setMessage`，没有任何进入应用的逻辑；`App.tsx:289-291` 在无 session 时恒渲染 `<Auth/>`，该承诺无法兑现。 |
| F-4 | **P1** | 登录后演示数据污染云端 | `src/app/initialState.ts:107-110`、`src/app/App.tsx:82-85`、`src/components/Auth.tsx:49-53` | 新设备首次启动时 `taskRepository.load(mockTasks)` 会把 mock 演示任务写入本地并作为初始 state；登录后 `scheduleSync` 立即把这些假任务 upsert 到用户 Supabase 账号。另外 `Auth.handleAuth` 中 `syncManager.syncTasks(session, [])` 的**返回值被丢弃**（远端数据未在登录时拉入 state）。 |
| F-5 | **P1** | 云同步不传播删除 | `src/lib/sync.ts:214-232` | `mergeCollections` 只做并集合并，本地删除的任务/归档项在远端仍然存在；下次同步或换设备登录时被合并回来，数据"复活"。需要墓碑（tombstone）机制或远端 diff 删除。 |
| F-6 | **P1** | 任务详情的"归档"功能不可达 | `src/features/home/TaskDetail.tsx:20` | 组件签名接收 `onArchive`，但渲染的 actions 只有 Delete / Edit 两个按钮；`App.tsx` 的 `handleArchiveTask` 因此成为死代码路径。 |
| F-7 | **P2** | "选轮/Wheel"时间选择是静态假象 | `src/features/home/AddTaskForm.tsx:290-296` | 选择 Wheel 后仅渲染一段硬编码的静态预览文本（`5 45 PM ...`），没有任何可交互的滚轮；用户以为可滑动，实际只能返回 Type 模式。 |
| F-8 | **P2** | 撤销删除造成"列表+回收站"双份 | `src/app/appReducer.ts:119-125, 128-139` | `DELETE_TASK` 同时写入 `lastDeletedTask` 和 `deletedTasks`；`UNDO_DELETE_TASK` 只把任务放回 tasks，**没有从 deletedTasks 移除**。之后在回收站点"恢复"会再次插入同 id 任务，产生重复。 |
| F-9 | **P2** | 导出/导入能力不对等且无校验 | `src/app/App.tsx:228-261` | 导出包含 `subscription` 字段，导入却不恢复订阅；导入仅 `JSON.parse` 后直接保存并 reload，不校验结构（结合 2.5 的 repository 覆盖行为，一份畸形备份可导致全部本地数据被 mock 覆盖）。 |
| F-10 | **P2** | AI 建议摘要永远不显示（运算符优先级 bug） | `src/features/home/AddTaskForm.tsx:63` | `result.summary || language === 'zh' ? 'AI 已为您智能规划' : 'AI schedule ready'` 实际解析为 `(result.summary \|\| language === 'zh') ? ... : ...`，AI 返回的 summary 被丢弃。 |
| F-11 | **P2** | 编辑器字段不完整 | `src/features/home/TaskEditor.tsx:18-22` | 状态只能选 active/completed/paused（无法把误标恢复为 scheduled），优先级与标签（AI 已生成）在编辑器中不可查看/修改。 |
| F-12 | **P3** | 恢复购买必然"成功" | `src/lib/stripe.ts:129-134` | 与 F-2 同源；在真实计费前会给用户错误预期。 |

### 2.2 用户体验流畅度

| # | 优先级 | 问题 | 位置 | 说明 |
|---|---|---|---|---|
| U-1 | **P1** | 长按手势零引导 | `src/features/home/BottomControls.tsx:34-47` | 长按"+"= 语音建任务、长按暂停 = 语音记录打断，是核心 AI 能力入口，但界面无任何视觉提示、首次使用教学或 aria 说明；发现成本极高。 |
| U-2 | **P1** | "清除所有数据"无二次确认 | `src/components/SettingsPanel.tsx:253-258`、`src/app/App.tsx:263-267` | 危险区按钮直接 `localStorage.clear()` + reload，不可逆操作一次误触即全部丢失；HomeScreen 已有 `ConfirmModal` 组件却未复用。 |
| U-3 | **P2** | 无任务新用户默认日期是过去的时间 | `src/app/initialState.ts:116` | 空数据时 `selectedDate` 兜底 `'2026-05-26'`（硬编码，已过去），新用户首屏停留在过去的日期上。 |
| U-4 | **P2** | 首帧语言闪烁 + 双轨 i18n | `src/lib/i18n.tsx:144-159`、全组件 | 默认语言 'en'，`useEffect` 读取 localStorage 后才切换（zh 用户首帧闪英文）；同时组件内大量 `language === 'zh' ? '…' : '…'` 内联翻译绕过 t()（AddTaskForm、InterruptionPanel、SettingsPanel 等），而 TaskDetail/DailySchedule/Header aria-label 完全未翻译，三套现状并存。 |
| U-5 | **P2** | 弹层缺少键盘/焦点管理 | `VoiceInput.tsx`、`InterruptionPanel.tsx`、`HomeScreen.tsx:154` | 语音/打断弹层 `role="dialog" aria-modal="true"` 但无 Esc 关闭、无焦点陷阱；TaskDetail 用纯 `onClick` div 做背景关闭，键盘用户无法关闭。 |
| U-6 | **P2** | 连续删除时 Undo 语义错乱 | `src/app/App.tsx:325`、`appReducer.ts:119-125` | `lastDeletedTask` 单槽：删除 A 再删除 B，点 A 的 toast "Undo" 实际恢复的是 B。 |
| U-7 | **P3** | AI 解析在 blur 自动触发，无防抖/取消 | `AddTaskForm.tsx:158-162` | 每次失焦都发一次 LLM 请求（无去重、无 AbortController），点别处即触发，成本与电量双重浪费；AI 批量结果未经用户确认直接入列表。 |
| U-8 | **P3** | 卡片图标按 mock id 硬编码 | `src/features/home/TaskCard.tsx:12-17,21` | 图标表键是演示任务 id（'ai-study'/'workout'…），真实任务一律显示 focusIndicator；卡片不展示优先级/标签。 |
| U-9 | **P3** | 日历/日期格式英文硬编码 | `DailySchedule.tsx:23`、`CalendarPicker.tsx:36` | `Intl.DateTimeFormat('en-US', …)` 未跟随语言设置，zh 模式下月份/星期仍为英文。 |

### 2.3 性能表现

| # | 优先级 | 问题 | 位置 | 说明 |
|---|---|---|---|---|
| P-1 | **P1** | 同步链路全量 stringify + N+1 upsert | `src/app/App.tsx:69-75`、`src/lib/sync.ts:84-107,175-200,27-38` | 每次任务/归档变化（600ms 防抖后）对整个数据集做两次 `JSON.stringify` 对比；`syncTasks` 对每条任务**顺序 await 单条 upsert**（50 条任务=50 次往返）；`ensureTables` 每次同步先跑 2 个探测查询。数据量增长后同步期间 UI 明显变卡、流量放大。 |
| P-2 | **P2** | 主包 550.3 KB 无代码分割 | `dist/assets/index-zvUEKdqR.js`、`vite.config.ts` | 单 bundle 无 manualChunks/懒加载；移动端冷启动 JS 解析时间偏长（gzip 后约 170KB，仍可优化）。 |
| P-3 | **P2** | PWA 缓存为自毁模式，无离线能力 | `public/sw.js` | SW 安装即清缓存、注销自身、fetch 直接放行（注释明确说明是开发期权宜）；线上每次启动全量网络加载，弱网/离线直接白屏依赖网络。 |
| P-4 | **P3** | 死依赖拖慢安装/CI | `package.json` | `three`、`@splinetool/react-spline`、`@splinetool/runtime`、`sharp` 在 src 中零引用（grep 验证），不进包体但显著拖慢 `npm install`。 |
| P-5 | **P3** | 语音识别断流不自动恢复 | `src/hooks/useVoiceRecognition.ts:55` | `continuous=true` 但 `onend` 不自动重启，静音超时后需要用户手动点"重试"。 |

### 2.4 兼容性（不同设备/系统版本）

| # | 优先级 | 问题 | 位置 | 说明 |
|---|---|---|---|---|
| C-1 | **P0** | iOS App 内语音识别整体失效 | `src/hooks/useVoiceRecognition.ts:34-43`、`ios/App/App/Info.plist:29-32` | Web Speech API（`webkitSpeechRecognition`）**在 WKWebView 中不存在**，仅 Safari 浏览器可用。Info.plist 虽声明了麦克风/语音识别权限，但 App 内 `supported=false`，所有语音入口退化为手打。需接入原生插件（如 `@capacitor-community/speech-recognition`）并提供统一接口。 |
| C-2 | **P2** | 滚轮/触摸 preventDefault 无效 | `src/features/home/TaskCarousel.tsx:117-124`、`Header.tsx:30-36` | React 17+ 将 wheel 监听注册为 passive，`onWheel` 内 `preventDefault()` 不生效（控制台告警，页面可能同时滚动）；Header 的 pointermove preventDefault 亦不阻止触摸滚动，正确做法是 CSS `touch-action: pan-y`/`none` 或原生非 passive 监听。 |
| C-3 | **P2** | iOS 主屏图标为 SVG | `index.html:12`、`public/manifest.json` | iOS 不支持 SVG 作为 apple-touch-icon / 主屏图标，添加到主屏会显示网页截图；需提供 180×180 PNG，manifest 补 purpose/尺寸齐全的 PNG。 |
| C-4 | **P3** | Capaciitor 内邮件链接 origin | `src/components/Auth.tsx:59` | `emailRedirectTo: window.location.origin` 在 App 内为 `capacitor://localhost`，注册确认/重置密码邮件在该 origin 打开会失败；需按运行环境区分（Web 用 origin，App 用深链/通用链接）。 |
| C-5 | **P3** | 横屏布局未验证 | `Info.plist:60-72` | Info.plist 允许 iPhone 横屏，但全部 UI 按竖屏移动优先设计，横屏表现未知；若不打算支持应收紧为 Portrait。 |

### 2.5 安全性

| # | 优先级 | 问题 | 位置 | 说明 |
|---|---|---|---|---|
| S-1 | **P1** | AI API Key 存 localStorage 且前端直连 LLM | `src/lib/ai.ts:50-66`、`SettingsPanel.tsx:44-48` | Key 明文存 localStorage（XSS 即可窃取），且直接从浏览器调用 DeepSeek/OpenAI 等；后续接支付、商业化后必须改为服务端代理（Vercel Function）+ 环境变量，浏览器端只发会话凭据。 |
| S-2 | **P2** | Supabase 凭据硬编码 + RLS 待验证 | `src/lib/supabase.ts:3-4` | anon key 属公开凭据可接受，但应走 `import.meta.env`；**关键风险在服务端**：tasks/archive 表的 RLS 策略是否强制 `user_id = auth.uid()` 需在 Supabase 控制台核验（客户端无法证明），否则任何登录用户可读写他人数据。 |
| S-3 | **P3** | 订阅状态本地可篡改 | `src/lib/stripe.ts:26-51` | premium 标志存 localStorage，用户可随意改；真实计费后权益校验必须服务端执行（与 F-2 同一改造）。 |
| S-4 | **P3** | 导入文件完全信任 | `App.tsx:247-261` | 结合 F-9：导入无 schema 校验、无数据大小限制；repository 的 `load` 在任一条目校验失败时**整体用 mock 覆盖存储**（`LocalStorageCollectionRepository.ts:32-35`），存在"一份坏数据毁掉全部本地数据"的放大路径。 |

### 2.6 其他潜在缺陷

| # | 优先级 | 问题 | 位置 | 说明 |
|---|---|---|---|---|
| B-1 | **P1** | AI 重排可能产生重复任务 ID | `src/app/App.tsx:198-199` | `id: interruptedTask.id === scheduledToToday[i % scheduledToToday.length]?.id ? … : 'replan-…'` 用取模把 AI 返回的任务映射回旧 id；当 `plan.tasks.length > scheduledToToday.length` 时同一旧 id 被赋给多个新任务，upsert 时互相覆盖、React key 冲突。 |
| B-2 | **P3** | 归档 itemCount 双源漂移 | `App.tsx:137` | `itemCount: (folder.itemCount ?? folder.items.length) + 1` 与 `items` 数组各自维护，任何一处遗漏（如删除条目未同步 itemCount）即显示错误计数。 |
| B-3 | **P3** | 日期解析静默吞错 | `src/utils/date.ts:3-7` | 非法日期字符串静默返回"今天"，掩盖脏数据问题，排障困难。 |
| B-4 | **P3** | Toast id 撞车 | `App.tsx:40` | `Date.now()` 作 id，同毫秒两个 toast 互相覆盖。 |
| B-5 | **P3** | 'Voice' 分类游离于分类体系 | `VoiceInput.tsx:55` | category='Voice' 不在七类分类与 AI 分类枚举中，统计/筛选会出现孤儿类目。 |

### 2.7 检测通过项（当前做得好的）

- TypeScript 全量类型检查通过，reducer 为穷尽 switch，无 `any` 泄漏点。
- TaskCarousel 手势实现质量高：指针捕获、rAF 节流、速度采样、rubber-band、点击抑制。
- 登录态鉴权路由清晰，`ErrorBoundary` 提供可见降级 UI 而非黑屏。
- dev 环境自动注销陈旧 SW 并清缓存（历史上"黑屏缓存"问题的针对性修复有注释留痕）。
- Info.plist 已正确声明麦克风与语音识别用途文案。
- 旧版 innerHTML XSS 已修复（ArchiveView 注释留痕），当前代码无 `dangerouslySetInnerHTML`。

---

## 三、优先级矩阵汇总

| 优先级 | 数量 | 编号 |
|---|---|---|
| P0 | 3 | F-1 回收站不可达；F-2 支付模拟+货币矛盾；C-1 iOS 语音失效 |
| P1 | 9 | F-3、F-4、F-5、F-6、U-1、U-2、P-1、S-1、B-1 |
| P2 | 14 | F-7 ~ F-11、U-3 ~ U-6、P-2、P-3、C-2、C-3、S-2 |
| P3 | 14 | 其余（F-12、U-7 ~ U-9、P-4、P-5、C-4、C-5、S-3、S-4、B-2 ~ B-5） |

---

## 四、优化建议与实施步骤

### 阶段 0：P0 修复（建议第一个迭代内完成）

**0-1 恢复回收站入口（F-1）**
1. 在 `Header.tsx` 的 settingsBtn 与 ArchiveButton 之间渲染回收站按钮：复用 `Header.module.css` 现成的 `.trashButton`，图标建议内联垃圾桶 SVG；
2. 按钮点击调用已有 `onOpenTrash`，并以徽标显示 `trashCount > 0` 的数量；
3. `trashCount === 0` 时仍可进入（展示空态）或降级隐藏，二选一保持一致。

**0-2 统一订阅价格口径（F-2 最小修复）**
1. 在 `SubscriptionPanel.tsx` 将价格区与 CTA 统一为单一币种/数值常量（如 `PRICE = { amount: 28, currency: 'CNY' }`），两处同源渲染；
2. 文案中删除 "via your Apple / Stripe account" 直到真实支付接入（避免误导）；
3. 在页面显著位置加"演示环境，不会产生扣费"提示（临时合规兜底）。

**0-3 打通 iOS 语音（C-1）**
1. `npm i @capacitor-community/speech-recognition` 并 `npx cap sync ios`；
2. 新建 `src/lib/speech.ts` 作为适配层：Capacitor 原生平台走插件，Web 环境回落到现有 `useVoiceRecognition`（保持 hooks 返回值签名 `{ transcript, listening, supported, error, start, stop }` 不变）；
3. `VoiceInput.tsx` / `InterruptionPanel.tsx` 改用适配层，UI 无需改动；
4. Info.plist 权限文案已具备，无需改动。

### 阶段 1：P1 数据正确性与核心体验

**1-1 同步管线重构（F-4、F-5、P-1）**
1. 登录方向修正：`Auth.handleAuth` 内 `const merged = await syncManager.syncTasks(session, [])` 后 `taskRepository.save(merged)` 并触发 `REPLACE_DAY_TASKS`/`SET_ARCHIVE_FOLDERS`，保证"先拉云端"；
2. 首次登录检测：若本地 tasks 仍是 `isUntouchedSeed` 等价物，则跳过上传，直接以远端为准；
3. 删除传播：新增 `deleted_ids` 本地墓碑表（localStorage key `friday.tombstones.v1`，记录 `{id, table, deletedAt}`），同步时对远端执行 `delete().in('id', tombstones)`，成功后清空墓碑；
4. 批量化：把逐条 `upsert` 改为按 500 条一批的数组 upsert（Supabase 支持对象数组一次 upsert）；`ensureTables` 结果做进程级缓存，仅首次执行；
5. `App.tsx` 中用"同步版本号/lastSyncAt"替代 `JSON.stringify` 全量对比（由 syncManager 返回 `changed: boolean`）。

**1-2 重排 ID 生成修复（B-1）**
1. `App.tsx:198-199` 改为全部使用新 id（`replan-${crypto.randomUUID()}-${i}`），被中断任务通过标题匹配保留 `paused` 状态即可，不再复用旧 id。

**1-3 游客模式落地（F-3）**
1. 全局增加 `guestMode: boolean`（reducer state 或 localStorage 标志）；
2. Auth 按钮回调 `onEnterGuest()` → `App.tsx` 在 `!session && guestMode` 时照常渲染主界面（sync 相关 effect 已有 `if (session)` 守卫，天然跳过云同步）；
3. 设置面板在游客态显示"登录以同步"入口，点击后清除 guestMode 回到 Auth。

**1-4 数据安全操作确认（U-2）**
1. `SettingsPanel` 危险区按钮改为先 `setShowClearConfirm(true)` 渲染 `ConfirmModal`（文案明确"不可恢复，含云端登录态"），确认后才调用 `onClearData`；
2. 同理为"导入数据"加确认（提示将被覆盖）。

**1-5 API Key 服务端代理（S-1）**
1. 新建 `api/ai-proxy.ts`（Vercel Function），从 `process.env.AI_PROXY_KEY` 读转发用密钥或透传用户 key，服务端设置超时与速率限制；
2. `ai.ts` 的 `callAI` 改为请求同源 `/api/ai-proxy`；localStorage 中的 key 仅作为迁移期回退并在设置面板标注"仅本机存储"风险说明。

### 阶段 2：P2 体验与性能

- **F-6**：TaskDetail actions 增加"归档"按钮，点击调用已有 `onArchive`（UI 建议放 Delete 左侧，图标+文字）。
- **F-7**：实现真滚轮或移除 Wheel 入口——短期建议直接隐藏该 Tab（`methodSelector` 去掉 Wheel 按钮），避免假交互。
- **F-8**：`UNDO_DELETE_TASK` 同时 `deletedTasks.filter(t => t.id !== state.lastDeletedTask.id)`。
- **F-9/S-4**：`handleImport` 增加 zod/手写校验（复用 `repositories/index.ts` 的 `isTask`/`isArchiveFolder`），失败整包拒绝；可选恢复 subscription 但仅当本地无更高权限时。同时将 `LocalStorageCollectionRepository.load` 的"整体覆盖"改为"过滤坏条目并保留好数据"。
- **F-10**：改为 `{result.summary || (language === 'zh' ? 'AI 已为您智能规划' : 'AI schedule ready')}`。
- **U-1**：首次进入 running 模式时在两个按钮上方显示一次性气泡提示（localStorage 记录已展示）；空态页 `EmptyDayState` 补充图文说明长按手势。
- **U-3**：`initialState.ts:116` 改为 `tasks[0]?.date ?? toIsoDate(new Date())`。
- **U-4**：i18n 初始化同步读取 localStorage（`useState(() => localStorage.getItem('friday-language') ?? detectFromNavigator())`），消除闪烁；分批把内联三元迁移到 t()，为 TaskDetail/DailySchedule/Header 补齐 zh 词条。
- **U-5**：dialog 组件统一加 `useEffect` 键盘监听（Esc→onCancel）+ `autoFocus` 首个输入框。
- **U-6**：toast 的 Undo 改为按 id 操作：`onAction` 闭包捕获对应任务 id，reducer 新增 `UNDO_DELETE_BY_ID`。
- **P-2**：`vite.config.ts` 增加 `build.rollupOptions.output.manualChunks = { vendor: ['react','react-dom'], supabase: ['@supabase/supabase-js'] }`；`React.lazy` 拆分 ArchiveScreen。
- **P-3**：引入 `vite-plugin-pwa` 生成 production SW（Workbox：App Shell precache + 运行时 NetworkFirst/CacheFirst 分策略），替换自毁 sw.js。
- **C-2**：TaskCarousel 根节点 CSS 加 `touch-action: pan-y`；Header dateBlock 加 `touch-action: pan-y`；wheel 逻辑改用 `useEffect` + `addEventListener('wheel', handler, { passive: false })`。
- **C-3**：用 `sharp`（已是依赖）从 SVG 生成 180/192/512 PNG，替换 index.html 与 manifest 的图标引用。

### 阶段 3：P3 打磨（可随版本滚动处理）

- 清理死依赖：`npm rm three @splinetool/react-spline @splinetool/runtime sharp`（若 C-3 用 sharp 生成图标则保留 sharp 一次性使用后移除）。
- F-11：TaskEditor 补 priority/tags 字段与全状态枚举；F-12 随真实支付一并处理；U-7 为 AI 请求加 AbortController + 2s 防抖 + "确认后入列"；U-8 图标映射改为按 `task.category`；U-9 日期格式化函数读取 `friday-language` 并透传 locale；B-2 删除 itemCount 或以 items.length 为唯一事实源；B-3 parseLocalDate 非法输入改为抛错或返回 null 并在调用处兜底；B-4 toast id 用 `crypto.randomUUID()`；B-5 语音任务创建后走一次本地规则分类映射到七类；C-4 按 `Capacitor.isNativePlatform()` 区分 emailRedirectTo；C-5 若不支持横屏将 iPhone 方向收紧为 Portrait；P-5 onend 中按需自动 restart（带 3 次重试上限）。

---

## 五、预期效果

| 领域 | 现状 | 完成阶段 0-1 后 | 完成阶段 2-3 后 |
|---|---|---|---|
| 功能可用性 | 回收站/归档/游客模式三个入口不可达或无效 | 核心功能全部可达，删除-恢复链路闭环 | 无假交互（假滚轮移除），编辑器字段完整 |
| 数据正确性 | 删除不传播、演示数据上云、坏备份毁库 | 同步闭环（增删改均传播），首登数据干净，导入有校验 | — |
| 性能 | 主包 550KB、同步 N+1、无离线 | 同步请求次数从 O(n) 降至 O(n/500)+2，全量 stringify 移除 | 主包预计 ≤380KB（vendor 拆分后首屏解析↓），PWA 弱网二次启动近乎秒开 |
| 兼容性 | iOS 语音全废、图标降级、滚轮告警 | App 内语音可用（原生插件） | 主屏图标正常，控制台无 passive 告警 |
| 安全 | Key 明文本地、支付可伪造 | Key 服务端代理，删除危险操作有确认 | 权益服务端校验（随真实支付） |

---

## 六、验证方法

### 6.1 自动化/静态

1. `npm run build` —— 每阶段收尾必须通过（当前基线 exit 0）。
2. `npx tsc --noEmit` 已含于 build；新增 `grep -r "JSON.stringify" src/app src/lib` 应无同步对比残留。
3. 产物检查：`ls dist/assets` 应出现 2 个以上 js chunk（vendor 分包生效）。

### 6.2 手工用例（关键回归）

| 用例 | 步骤 | 预期 |
|---|---|---|
| TC-1 回收站闭环 | 删除任务 → 打开 Header 回收站 → 恢复 | 任务回到列表，回收站为空，无重复 |
| TC-2 Undo 幂等 | 删除 A → 删除 B → 点 A 的 Undo | 恢复的是 A；回收站内 A、B 均被移除 |
| TC-3 删除同步 | 设备 A 删除任务 → 等待同步 → 设备 B 刷新登录 | 任务在 B 上消失（墓碑生效） |
| TC-4 首登干净 | 全新浏览器注册新账号 | 云端 tasks 表无 mock 数据；本地演示数据被远端（空）覆盖 |
| TC-5 清数据确认 | 设置 → 清除所有数据 | 先弹确认框，取消不丢失，确认后清空并 reload |
| TC-6 iOS 语音 | Xcode 真机运行 → 长按"+"说话 | 麦克风弹权限 → 转写文本出现 → 可创建任务 |
| TC-7 归档任务 | 任务详情 → 归档 | 出现归档按钮，任务进入所选文件夹，归档角标 +1 |
| TC-8 断网启动 | 部署后开飞行模式打开 PWA | App Shell 正常渲染（缓存生效），提示离线 |
| TC-9 支付口径 | 中文/英文各打开订阅面板 | 价格区与 CTA 币种一致，含演示提示 |
| TC-10 横滚轮告警 | 桌面 Chrome 触控板横向滑动 | 无 passive listener 告警，轮播正常切换 |
| TC-11 AI 摘要 | 添加任务触发 AI 解析 | 提示行显示 AI 返回的 summary 原文 |
| TC-12 重复 ID | 制造 >当日任务数的重排计划（或单测模拟） | 全部任务 id 唯一，无覆盖 |

### 6.3 性能基线（优化前后各测一次留档）

- Lighthouse（移动端模拟）：记录 FCP/LCP/TBT 分数；
- 真机冷启动：iOS 真机从点击图标到首屏可交互秒表计时；
- 同步压测：脚本向 localStorage 写入 200 条任务后触发变更，观察 DevTools Performance 中同步耗时（目标：< 300ms）。

---

## 七、附录：涉及文件索引

- 核心状态：`src/app/App.tsx`、`src/app/appReducer.ts`、`src/app/initialState.ts`
- 数据/同步：`src/lib/sync.ts`、`src/data/repositories/*`
- AI：`src/lib/ai.ts`、`src/features/home/AddTaskForm.tsx`
- 支付：`src/lib/stripe.ts`、`src/components/SubscriptionPanel.tsx`
- 语音：`src/hooks/useVoiceRecognition.ts`、`VoiceInput.tsx`、`InterruptionPanel.tsx`
- 配置：`ios/App/App/Info.plist`、`capacitor.config.ts`、`public/sw.js`、`vite.config.ts`、`index.html`
