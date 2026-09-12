# Friday

Friday 是一个面向手机浏览器的个人任务与长期信息管理原型。项目使用 React、TypeScript 和 Vite 构建，采用暗色半透明玻璃界面，当前所有数据均保存在浏览器的 `localStorage` 中。

## 1. 项目解决什么问题

日常任务与长期资料通常分散在不同应用中：当天需要执行的事项缺少清晰的时间视图，而项目、旅行计划、灵感和学习资料又容易沉没在普通列表里。

Friday 将两类信息放进同一个本地 Web 应用：

- **Home** 用于查看和管理某一天需要执行的任务。
- **Archive / Life Hub** 用于保存项目、旅行、想法、学习和媒体等长期信息。

当前版本适合在电脑和同一 WiFi 下的手机浏览器中进行交互与视觉测试。它不依赖后端，也不会把任务或 Archive 内容上传到云端。

## 2. 主要功能

### Home 与日期管理

- 左右滑动日期，在不同日期之间切换。
- 点击日期打开月历，并可选择任意日期。
- 根据选中日期过滤任务。
- Daily Schedule 按开始时间展示当天任务、时间和状态。
- 查看其他日期时可通过 **Today** 返回当天。

### 任务管理

- 任务卡片以可滑动的空间堆栈显示。
- 点击 **Add Task** 进入文字创建模式。
- 支持 `Long-term`、`Scheduled` 和 `Flexible` 三种任务类型。
- Scheduled 任务支持开始时间和结束时间输入，并包含时间选择器展示模式。
- 输入未保存内容时退出，会提示是否放弃。
- 点击已有任务可以查看详情、编辑标题、描述、日期、时间、类型和状态。
- 删除任务前显示确认对话框。
- Pause 按钮支持暂停、恢复和长按中断输入状态。

### Archive / Life Hub

- 使用横向可滑动的空间文件柜浏览 Archive 文件夹。
- 内置 Project、Travel、Idea、Learning 和 Media 模板。
- 支持自定义文件夹名称。
- 点击选中文件夹后，再次点击可打开文件夹详情。
- 文件夹详情展示保存的内容和备注。
- 底部文字输入可将新内容保存到当前文件夹。
- Archive 页面没有 Pause 按钮。

### 本地数据持久化

- Tasks 使用 `friday.tasks.v1` 保存到 `localStorage`。
- Archive 使用 `friday.archive.v1` 保存到 `localStorage`。
- 页面刷新或重新打开浏览器后，数据仍会保留。
- 数据访问通过独立 Repository 层完成，后续可以迁移到 Supabase 或其他后端。

### 当前原型限制

- 尚未接入后端、账号系统或云同步。
- 尚未加入 AI 任务理解、自动分类或智能排程。
- 语音按钮目前演示 Listening、取消和完成流程，并使用预设示例内容创建数据；它还没有接入麦克风录音或真实语音转写。
- 时间选择器的 wheel 区域目前是视觉预览，实际时间通过浏览器原生 `time` 输入控件修改。

## 3. 安装方法

### 环境要求

- Node.js 20.19+ 或 22.12+
- npm

### 安装依赖

在项目根目录执行：

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev -- --host
```

Vite 会显示类似下面的地址：

```text
Local:   http://localhost:5173/
Network: http://192.168.x.x:5173/
```

- 电脑浏览器打开 `Local` 地址。
- 手机与电脑连接同一 WiFi 后，打开 Vite 显示的 `Network` 地址。
- 如果手机无法访问，请允许 Node.js 通过 Windows 防火墙的专用网络，并确认两台设备位于同一局域网。

### 构建检查

```bash
npm run build
```

构建输出位于 `dist/`，该目录不会提交到 Git。

## 4. 使用方法

### 创建和管理任务

1. 在 Home 页面左右滑动日期，或点击日期后从月历中选择日期。
2. 点击底部 **Add Task**。
3. 选择任务类型并输入任务描述。
4. 如果类型为 Scheduled，设置开始时间和结束时间。
5. 点击 **Add task** 保存。
6. 点击任务卡片打开详情；可继续编辑或删除任务。
7. 点击圆形 Pause 按钮暂停，再次点击恢复。

### 查看 Daily Schedule

1. 点击 Home 顶部的日期区域。
2. 从月历选择日期，月历会关闭并显示该日任务。
3. 点击日程中的任务进入现有任务详情与编辑流程。
4. 查看非当天日期时，点击 **Today** 返回当天。

### 使用 Archive

1. 点击 Home 右上角的 **Archive**。
2. 左右滑动文件夹，或使用左右按钮选择文件夹。
3. 再次点击中央选中文件夹，打开其内容。
4. 在底部输入文字并点击 **Save**，内容会保存到当前文件夹。
5. 点击 **＋ New**，选择模板并填写名称，即可创建自定义文件夹。
6. 点击麦克风按钮可体验当前的模拟语音输入流程。

## 5. 输入输出示例

### 示例一：创建 Scheduled 任务

用户操作：

```text
选中日期：2026-09-12
任务类型：Scheduled
任务描述：Edit photos from my Europe trip
开始时间：18:00
结束时间：19:30
```

应用保存的数据结构示例：

```json
{
  "id": "task-<timestamp>",
  "title": "Edit photos from…",
  "description": "Edit photos from my Europe trip",
  "date": "2026-09-12",
  "startTime": "18:00",
  "endTime": "19:30",
  "type": "scheduled",
  "status": "scheduled",
  "category": "Scheduled",
  "createdAt": "<ISO timestamp>"
}
```

输出结果：任务立即出现在 2026-09-12 的 Home 卡片堆栈和 Daily Schedule 中，并写入浏览器 `localStorage`。

### 示例二：创建 Flexible 任务

用户操作：

```text
任务类型：Flexible
任务描述：Read two chapters
```

输出结果：应用创建一个没有固定开始和结束时间的任务：

```json
{
  "title": "Read two chapters",
  "startTime": null,
  "endTime": null,
  "type": "flexible",
  "status": "scheduled"
}
```

### 示例三：保存 Archive 内容

用户操作：

```text
当前文件夹：Projects
输入：Friday App release notes
操作：点击 Save
```

应用保存的数据结构示例：

```json
{
  "id": "archive-item-<timestamp>",
  "title": "Friday App release notes",
  "note": "Saved from Archive input",
  "createdAt": "<ISO timestamp>"
}
```

输出结果：内容出现在 Projects 文件夹详情顶部，并写入浏览器 `localStorage`。

### 示例四：当前语音原型

- 长按 Home 的 Add Task 后，应用显示 Listening 状态，并在演示计时结束后创建预设的 `Photo editing tonight` 任务。
- 在 Archive 点击麦克风后，应用显示 Listening 状态，并在演示计时结束后保存预设的 `New photography project idea` 内容。
- 两个 Listening 状态均支持取消；取消后不会创建未完成内容。

## 开发脚本

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 启动 Vite 开发服务器 |
| `npm run dev -- --host` | 启动并允许同一局域网设备访问 |
| `npm run build` | TypeScript 检查并生成生产构建 |
| `npm run preview` | 本地预览生产构建 |
