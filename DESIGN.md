# Design System — AutoClip

> AutoClip 的设计唯一标准。做任何 UI/视觉决策前先读这里。
> 方向：**克制专业 / Calm Premium**（参考 Dia Browser）。安静、精确、留白多、几乎全单色，
> 只用一个克制的蓝做强调。给"认真做内容的人"用，不是玩具风、不是冷黑科技风。

## Product Context
- **是什么**：基于 AI 的视频切片桌面工具。粘 B站/YouTube 链接或本地视频 → 自动出切片与合集。
- **给谁用**：内容创作者 / 剪辑者。
- **类型**：macOS 桌面应用（Tauri + React + TypeScript）。当前用 Ant Design，需按本系统逐屏重做。
- **记忆点**：有调性、克制、专业——让人觉得"这是认真的好工具"。

## Aesthetic Direction
- **方向**：Calm Premium / 克制编辑感。
- **装饰级别**：minimal（排版和留白做所有的活，不堆装饰）。
- **气质**：安静、精确、从容、高级。大量留白、低信息密度、发丝级分隔。
- **参考**：Dia Browser (diabrowser.com) —— sans+serif 混排、近乎全单色、一抹克制强调色。
- **明确不要**：玩具撞色、彩色 chip、紫色渐变、霓虹、3 列图标网格、居中堆砌、死黑 `#000`。

## Color

双主题（浅色为主，深色等价）。强调色**极克制**：只用于进行中状态、活动态、链接；其余一律单色。

### 浅色（默认）
```css
--bg:        #F6F5F3;  /* 暖浅灰底，非纯白 */
--card:      #FFFFFF;
--ink:       #1A1A19;  /* 柔近黑正文，非纯黑 */
--sub:       #6E6B66;  /* 次级文字 */
--muted:     #A8A59F;  /* 弱化/占位 */
--line:      #EBE9E4;  /* 发丝边框 */
--line-2:    #F0EEEA;  /* 更弱分隔 */
--accent:    #2D6BFF;  /* 唯一强调蓝，克制使用 */
--thumb:     #EEECE8;  /* 缩略图占位底 */
--cta-bg:    #1A1A19;  /* 主按钮：实心墨 */
--cta-fg:    #FFFFFF;
```

### 深色
```css
--bg:        #19181A;  /* 暖近黑，非纯黑 */
--card:      #211F22;
--ink:       #ECEAE6;  /* 暖白正文 */
--sub:       #A6A29B;
--muted:     #76726C;
--line:      #2C2A2D;
--line-2:    #232124;
--accent:    #5A8BFF;  /* 深色下蓝亮一档 */
--thumb:     #262428;
--cta-bg:    #ECEAE6;  /* 主按钮：浅墨 */
--cta-fg:    #19181A;
```

### 语义色（两主题通用，克制使用）
```css
--ok:    #5BB36A;  /* 已完成（小圆点） */
--warn:  #E6B23C;
--error: #E66A5C;  /* 失败 */
--info:  var(--accent);
```
- **暗色策略**：不是把浅色反相，而是重设表面层级；强调蓝提亮约 10–15% 保证对比。

## Typography

sans + serif 混排是高级感来源：衬线只用于**拉丁品牌时刻**（wordmark、大数字），中文与 UI 一律干净无衬线。

- **品牌/衬线（仅拉丁）**：`Instrument Serif`（含 italic）。用于 `AutoClip` wordmark、大号英文数字等点睛处。
- **中文**：`PingFang SC`（mac 原生、最克制）优先，跨平台回退 `Noto Sans SC`。
- **UI / 正文（拉丁）**：`Geist`（400/500/600）。**不用 Inter/Roboto**。
- **数据 / 数字 / 时间码**：`Geist Mono`（tabular）。
- **字体栈**：
  ```css
  --font-sans: "Geist", "PingFang SC", "Noto Sans SC", system-ui, sans-serif;
  --font-serif: "Instrument Serif", Georgia, serif;   /* 仅拉丁 */
  --font-mono: "Geist Mono", ui-monospace, monospace;
  ```
- **字号阶**（rem，16px 基准）：
  | 角色 | 字号 | 字重 | 行高 |
  |------|------|------|------|
  | wordmark（serif）| 28px | 400 | 1.1 |
  | 区块标题 h2 | 16px | 600 | 1.3 |
  | 卡片标题 | 15px | 500 | 1.45 |
  | 正文 | 14–15px | 400 | 1.5 |
  | 次级/元信息 | 12.5–13px | 400/500 | 1.4 |
  | 标签/uppercase | 11px / letter-spacing .8px | 500 | — |

## Spacing
- **基准**：4px。
- **密度**：spacious（留白多、信息少）。
- **阶**：`2(2) xs(4) sm(8) md(16) lg(24) xl(32) 2xl(40) 3xl(56)`。
- **常用**：窗口内边距 56px；区块间距 56px；卡片网格 gap 24px；卡片内边距 20–22px；导入框与首项目区之间大留白。

## Layout
- **方式**：grid-disciplined（克制网格），不玩编辑式破格。
- **项目网格**：3 列（大间距、大卡片），窄屏降到 2/1 列。
- **最大内容宽度**：跟随窗口，左右 56px 安全边距。
- **圆角**：卡片/输入框/缩略图 `16px`；小元素 `10px`；按钮/徽章/分段切换 `999px`（胶囊）。
- **边框**：发丝级 `1px solid var(--line)`，靠边框而非重阴影分隔。

## Components
- **主按钮**：实心墨胶囊（浅色=黑/深色=浅墨），文字 14.5px/500，内边距 ~14×26px。
- **次按钮**：发丝边框胶囊，文字 `--sub`。
- **分段切换**（链接/文件）：胶囊容器 `--line-2` 底，选中项 `--card` 底 + 极轻阴影。
- **状态表达（克制）**：缩略图左上角小圆点 + 文字标签（`下载中`/`分析中`=accent、`已完成`=ok、`失败`=error）。进度用 4px 细线（accent），右侧百分比用 mono。
- **已完成元信息**：纯灰 mono 数字 + 中点分隔，例 `7 切片 · 1 合集 · 8 个月前`，**不用彩色 chip**。
- **阴影**：极轻。`0 1px 2px rgba(0,0,0,.03), 0 8px 24px rgba(0,0,0,.04)`（深色相应降透明度）。

## Motion
- **方式**：minimal-functional + 个别 intentional。只做有意义的过渡，不炫技。
- **缓动**：进入 `ease-out`、退出 `ease-in`、位移 `ease-in-out`。
- **时长**：micro 80–120ms、short 150–250ms。
- **微交互**：卡片 hover 上移 2px + 极轻阴影；进度线平滑过渡。
- **一个值得做的高光**：「出片成功」给一个克制但有仪式感的过渡（无彩纸、无弹跳），服务"想分享"。

## Decisions Log
| 日期 | 决策 | 理由 |
|------|------|------|
| 2026-05-31 | 初版设计系统 | /design-consultation 产出。方向几经迭代（暖编辑→玩具风→否决）最终锁定 Dia 式「克制专业」，浅/深双主题，去大标题、低密度、单一克制蓝。 |
