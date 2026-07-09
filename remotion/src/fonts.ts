/**
 * 显式加载中文字体（Noto Sans SC）。
 *
 * 为什么必须显式加载：Remotion 渲染在 headless Chromium 里跑，不能假设机器上装了
 * 某个中文字体。之前只写 fontFamily: "PingFang SC" 靠系统字体——只在装了 PingFang 的
 * Mac 上渲得对，换台机器/云渲染就会变豆腐块或被替换字体。
 *
 * @remotion/google-fonts 的 loadFont() 内部用 delayRender/continueRender 挂起渲染，
 * 等字体真正加载完再继续，保证任何环境下中文都清晰一致。
 *
 * 只取 chinese-simplified + latin 子集，避免把整套 CJK 全量塞进包（体积大）。
 */
import { loadFont } from '@remotion/google-fonts/NotoSansSC'

const { fontFamily } = loadFont('normal', {
  weights: ['400', '600', '700'], // 正文 / 半粗 / 标题
  subsets: ['chinese-simplified', 'latin'],
})

// 加载后的字体族 + 系统字兜底（极端情况下 loadFont 失败也不至于全崩）
export const CN_FONT_STACK = `${fontFamily}, "PingFang SC", "Microsoft YaHei", system-ui, sans-serif`
