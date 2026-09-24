# Friday 完善方案 — Archive 视觉对齐与双端路线（修订版）

> 文档目的：梳理 Archive UI 与 Figma 差距的根因，确定"能否改、怎么改、Web 还是移动端先行"，并给出分阶段实施计划。
> 修订记录：2026-09-20（美西）v2 —— **修正设计源头判断**。用户确认 Archive 为手动在 Figma 绘制的 2D 设计，已弃用 Spline；v1 中"Spline 3D 场景"根因作废，`spline-archive-*.json` 视为废弃实验残留，不再作为设计依据。

## 1. 现状盘点

| 端 | 技术栈 | Archive 现状 | 健康度 |
| --- | --- | --- | --- |
| Web（根目录） | React 19 + TS + Vite 8 + CSS Modules | 功能完整（Home + Archive）；文件夹流用 CSS 伪 3D（`--folder-x/y/z` + rotateY + blur + opacity 模拟空间轨道，见 `src/features/archive/ArchiveFileStream.tsx`） | 构建通过 |
| 移动端（apps/mobile） | Expo SDK 54 + RN + Reanimated 4 + Gesture Handler | 仅 Archive 一屏；用 Figma 导出的 `trace-*.png` 切图 + transform 拼平面（见 `ArchiveFolder.tsx`） | typecheck ✓、6 个逻辑测试 ✓ |

共同痛点：**Archive 文件夹平面始终达不到 Figma 帧（Liquid Focus — Mobile Prototype 中 Archive 一帧）的效果**。

## 2. 差距根因（修订）：2D 合成保真度问题，不是渲染技术问题

设计源头：你**手动在 Figma 绘制的 2D 分层图形**——文件夹面是"磨砂半透明面 + 柔光发光边缘 + 斜贴标签 + 交叠遮挡"的静态合成（证据：`apps/mobile/assets/figma/trace-*.png` 导出切片、`archive-visual-spec.md` 的图层描述与测量）。

因此"达不到效果"的根因是 **2D 构图参数不一致**：

1. **几何**：文件夹面宽度、圆角、标签位置与 spec 测量值不符（spec 明确指出"planes are too narrow, too gray, too visually separate"）
2. **层次与交叠**：相邻面板的交叠顺序、纵深错位、中心聚焦唯一性
3. **光影**：磨砂白/翡翠绿填充、发光边缘（fresnel 感的亮边）、环境光晕
4. **标签**：斜贴到面板下部的透视贴附（rotate 角度与位置）

这些全部可以用纯 2D 手段（Web CSS / RN StyleSheet + 现有切图）精确还原，**不需要 3D 引擎**。

> ⚠️ `spline-archive-*.json`（场景对象、材质、灯光、槽位）来自已废弃的 Spline 实验，仅作历史存档；开发时不得再引用其中的 3D 参数作为设计依据。

## 3. 方案对比（修订）：主路径 2D 精修，Three.js 降级为可选增强

| 方案 | 效果 | 成本 | 结论 |
| --- | --- | --- | --- |
| **A. 2D 构图精修**（推荐主路径） | 可像素级对齐 Figma 手绘稿 | 低（无新依赖） | ✓ 先做这个 |
| B. Three.js 3D 复刻 | 能还原材质/纵深，但**目标不再是"对齐 Figma"**，是做出静态稿没有的动态 3D | 中（three/R3F/expo-gl） | ◎ 可选增强，仅当你想要动态纵深、拖拽倾角、动态光效时 |
| C. 继续现在这套但只调参数 | 部分改善，天花板低 | 极低 | ✗ 作为 A 的起点，不单列 |

选择 A 的决定性理由：**设计源本身是 2D 静态图**，3D 引擎不会让它"更像 Figma"；而 A 更快、更轻、Web 与移动端渲染模型一致（CSS ↔ RN 样式语义相近），一套构图参数可双端复用。

## 4. 决策：Web 先行，再镜像到移动端 —— 仍然推荐"是"

理由（修订）：

1. **Web 迭代快**：浏览器 devtools + HMR + 可直接截图对比；移动端每次验证要经 Expo/真机。
2. **参数可复用**：2D 构图参数（尺寸/层次/颜色/阴影/模糊/标签角度）是纯数值，先调 Web，再把同一套值镜像到移动端 RN 样式，避免双端各调一遍。
3. 移动端现状更薄弱（只有 Archive 一屏），在 Web 把构图做对后整体迁移，风险最低。

路线：**Web 构图精修 → 对照 Figma 帧验收 → 镜像到移动端 → 再补齐 Home 等功能**。

## 5. 分阶段实施计划（修订）

### P0 Web 构图对齐（根因修正）
- [ ] 以 `archive-visual-spec.md` 测量值为准，修正 `ArchiveFileStream.tsx` / `ArchiveCategoryCard` 的几何参数：文件夹面宽度、间距/轨道、x/y/z 纵深、缩放与模糊
- [ ] 修正层次：交叠顺序、中心聚焦唯一性、前后遮挡（z-order）
- [ ] 修正光影：磨砂白填充与发光边缘、翡翠绿选中态、环境光晕、弧线 hint
- [ ] 修正标签：斜贴角度与贴附位置
- [ ] 保持现有拖拽交互不变（Web 用 pointer 拖拽，逻辑已验证可用）

### P1 Web 验收
- [ ] 用户导出 Figma Archive 帧 PNG 作为基准
- [ ] 截图逐项对照（header / filters / 文件夹面 / 信息卡 / 底部栏），记录偏差清单并清零
- [ ] `npm run build` 通过

### P2 镜像到移动端
- [ ] 把同一套构图参数（数值）映射到 `apps/mobile` 的 RN 样式（`ArchiveFolder.tsx` / `FolderStream.tsx` 已用 trace PNG，主要调参数）
- [ ] `npm run typecheck` + `test:logic` + `expo export` + Expo Go 真机

### P3 移动端补齐（后续）
- [ ] Expo Router 导航、Home 任务屏移植、持久化（AsyncStorage/MMKV）
- [ ] 真实语音 / AI 任务解析（另行讨论）

### 可选分支 B：动态 3D 增强（仅在你确认想要时启动）
- [ ] Web：three + @react-three/fiber 复刻文件夹面（MeshPhysicalMaterial），拖拽倾角/景深视差/动态光
- [ ] 移动端：expo-gl + @react-three/fiber native
- [ ] 此分支目标是"超出 Figma 的动态体验"，验收指标另行定义，不作为对齐 Figma 的手段

## 6. Skill 使用映射（修订）

| Skill | 用途 | 阶段 |
| --- | --- | --- |
| `react-native-dev` | 移动端样式/组件/动画规范、Expo 验证 | P2/P3 |
| （可选分支 B）`threejs-fundamentals/materials/lighting/interaction` | 仅在确认做动态 3D 增强时启用 | B |
| （不使用）`doubao-app-builder` / `frontend-dev` | 沙箱生成应用 / 新建营销页，与本代码库无关 | — |

主路径 A 是纯 CSS / RN 样式工作，不需要加载 threejs skills；B 分支需要时再按需读取对应 skill。

## 7. 验证方式

- Web：`npm run build` + 浏览器截图与 Figma 帧对照（基准见 `archive-visual-spec.md` + 用户导出的 PNG）
- 移动端：`npm run typecheck` + `npm run test:logic` + `npx expo export --platform ios` + Expo Go 真机
- 交付对照表：每项偏差（几何/层次/光影/标签）逐条记录修复前后数值

## 8. 风险与待确认

1. **基准图**：需要你从 Figma 导出 Archive 帧 PNG（选中帧 → Export），作为逐像素对照基准；`archive-visual-spec.md` 的测量值需与你当前稿一致（如已改稿请更新）。
2. **废弃文件处置**：`spline-archive-*.json` 建议移入 `archive/` 或删除，避免后续误导；移动端 `archive-visual-spec.md` 保留为测量基准。
3. **动态 3D 增强（分支 B）**：仅当你明确想要静态稿之外的动态效果时启动；默认不做。
4. **确认起点**：按本修订版先做 **P0 + P1（Web 2D 构图精修与验收）**，完成后再镜像移动端。
