import React from 'react'
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { IconGlyph } from './icons'
import { CN_FONT_STACK } from './fonts'

/**
 * 信息动画舞台（自动成片上区）。
 *
 * 按后端 scene_service 生成的「视觉脚本」渲染这句话的信息动画：
 * 4 种版式 keyword / steps / arrow / compare，每个元素按 enterAt（秒）逐个入场，
 * 带弹入 + 上移 + 淡入动效。配色走 DESIGN.md 设计 token（由 theme 传入）。
 */

export type SceneTheme = {
  accent: string
  ink: string
  bg: string
  sub: string
  line: string
  card: string // 卡片底色（浅主题=白，深主题=略亮于 bg）
  muted: string // 弱化色（对比项的灰）
  accentSoft: string // 强调色的柔和背景（强调卡片底）
  onAccent: string // 放在 accent 上的文字色（序号圆内）
  dark?: boolean // 是否深色主题（影响投影深浅）
}

// 卡片统一投影：深主题用更深的投影，避免浅投影在深底上看不见
const cardShadow = (theme: SceneTheme) =>
  theme.dark ? '0 8px 24px rgba(0,0,0,0.35)' : '0 8px 24px rgba(26,26,25,0.06)'

export type SceneElement = {
  type: string
  text: string
  icon?: string
  enterAt: number // 相对本句开始的秒数
  emphasis?: boolean
}

export type Scene = {
  layout: 'keyword' | 'steps' | 'arrow' | 'compare'
  elements: SceneElement[]
}

// 中文字体：显式加载的 Noto Sans SC（+ 系统字兜底），见 ./fonts
const FONT_STACK = CN_FONT_STACK

// 元素入场动画：从 enterAt 那一帧起，带弹性地「跳」入 + 上移 + 淡入。
// damping 调低 + stiffness 提高 → 有轻微回弹的活泼手感（不是平稳滑入）。
const useEnter = (enterAtSeconds: number) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const startFrame = Math.max(0, Math.round(enterAtSeconds * fps))
  const local = frame - startFrame
  const enter = spring({ frame: local, fps, config: { damping: 12, mass: 0.7, stiffness: 130 } })
  const appeared = local >= 0
  return {
    opacity: appeared ? interpolate(enter, [0, 1], [0, 1], { extrapolateRight: 'clamp' }) : 0,
    translateY: interpolate(enter, [0, 1], [40, 0], { extrapolateRight: 'clamp' }),
    scale: interpolate(enter, [0, 1], [0.8, 1]),
  }
}

// —— 关键词大字卡（可带图标）——
const KeywordChip: React.FC<{ el: SceneElement; theme: SceneTheme }> = ({ el, theme }) => {
  const { opacity, translateY, scale } = useEnter(el.enterAt)
  const emph = !!el.emphasis
  const fg = emph ? theme.accent : theme.ink
  return (
    <div
      style={{
        opacity,
        transform: `translateY(${translateY}px) scale(${scale})`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 22,
        padding: '0 24px',
      }}
    >
      {el.icon ? (
        <div
          style={{
            width: 132,
            height: 132,
            borderRadius: 30,
            backgroundColor: emph ? theme.accentSoft : theme.card,
            border: `1px solid ${theme.line}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: cardShadow(theme),
          }}
        >
          <IconGlyph name={el.icon} size={72} color={fg} strokeWidth={1.8} />
        </div>
      ) : null}
      <div style={{ fontSize: 64, fontWeight: 700, color: fg, letterSpacing: '1px', textAlign: 'center' }}>
        {el.text}
      </div>
    </div>
  )
}

const KeywordLayout: React.FC<{ elements: SceneElement[]; theme: SceneTheme }> = ({ elements, theme }) => (
  <div
    style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 72,
      flexWrap: 'wrap',
      fontFamily: FONT_STACK,
    }}
  >
    {elements.map((el, i) => (
      <KeywordChip key={i} el={el} theme={theme} />
    ))}
  </div>
)

// —— 序号步骤列表 ——
const StepsLayout: React.FC<{ elements: SceneElement[]; theme: SceneTheme }> = ({ elements, theme }) => (
  <div
    style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      justifyContent: 'center',
      gap: 28,
      padding: '0 220px',
      fontFamily: FONT_STACK,
    }}
  >
    {elements.map((el, i) => {
      const { opacity, translateY } = useEnter(el.enterAt)
      const emph = !!el.emphasis
      return (
        <div
          key={i}
          style={{
            opacity,
            transform: `translateY(${translateY}px)`,
            display: 'flex',
            alignItems: 'center',
            gap: 28,
          }}
        >
          <div
            style={{
              width: 68,
              height: 68,
              flexShrink: 0,
              borderRadius: 999,
              backgroundColor: theme.accent,
              color: theme.onAccent,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 34,
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {i + 1}
          </div>
          <div style={{ fontSize: 52, fontWeight: 600, color: emph ? theme.accent : theme.ink }}>
            {el.text}
          </div>
        </div>
      )
    })}
  </div>
)

// —— 箭头流程：左 → 右 ——
const ArrowNode: React.FC<{ el: SceneElement; theme: SceneTheme }> = ({ el, theme }) => {
  const { opacity, translateY, scale } = useEnter(el.enterAt)
  const emph = !!el.emphasis
  const fg = emph ? theme.accent : theme.ink
  return (
    <div
      style={{
        opacity,
        transform: `translateY(${translateY}px) scale(${scale})`,
        flex: '0 1 460px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 18,
        padding: '40px 28px',
        borderRadius: 28,
        backgroundColor: emph ? theme.accentSoft : theme.card,
        border: `1px solid ${theme.line}`,
        boxShadow: cardShadow(theme),
      }}
    >
      {el.icon ? <IconGlyph name={el.icon} size={64} color={fg} strokeWidth={1.8} /> : null}
      <div style={{ fontSize: 46, fontWeight: 700, color: fg, textAlign: 'center' }}>{el.text}</div>
    </div>
  )
}

const ArrowLayout: React.FC<{ elements: SceneElement[]; theme: SceneTheme }> = ({ elements, theme }) => {
  const from = elements.find((e) => e.type === 'arrowFrom') || elements[0]
  const to = elements.find((e) => e.type === 'arrowTo') || elements[1]
  // 箭头随 "to" 元素入场
  const arrowEnter = useEnter(to ? to.enterAt : 0)
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 24,
        padding: '0 120px',
        fontFamily: FONT_STACK,
      }}
    >
      {from ? <ArrowNode el={from} theme={theme} /> : null}
      <div style={{ opacity: arrowEnter.opacity, flexShrink: 0 }}>
        <svg width="120" height="60" viewBox="0 0 120 60" fill="none" stroke={theme.accent} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round">
          <line x1="10" y1="30" x2="100" y2="30" />
          <path d="M88 16 L104 30 L88 44" />
        </svg>
      </div>
      {to ? <ArrowNode el={to} theme={theme} /> : null}
    </div>
  )
}

// —— 对比：左错 / 右对 ——
const CompareCol: React.FC<{ el: SceneElement; kind: 'bad' | 'good'; theme: SceneTheme }> = ({ el, kind, theme }) => {
  const { opacity, translateY, scale } = useEnter(el.enterAt)
  const bad = kind === 'bad'
  const badge = bad ? theme.muted : theme.accent
  return (
    <div
      style={{
        opacity: opacity * (bad ? 0.92 : 1), // 入场淡入 × 错项整体稍降
        transform: `translateY(${translateY}px) scale(${scale})`,
        flex: '0 1 500px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 20,
        padding: '44px 28px',
        borderRadius: 28,
        backgroundColor: theme.card,
        border: `1.5px solid ${bad ? theme.line : theme.accent}`,
        boxShadow: cardShadow(theme),
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 999,
          border: `2px solid ${badge}`,
          color: badge,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={badge} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
          {bad ? (
            <>
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </>
          ) : (
            <path d="M5 12.5 10 17.5 19 7" />
          )}
        </svg>
      </div>
      {el.icon ? <IconGlyph name={el.icon} size={56} color={bad ? theme.sub : theme.ink} strokeWidth={1.8} /> : null}
      <div style={{ fontSize: 44, fontWeight: 700, color: bad ? theme.sub : theme.ink, textAlign: 'center' }}>
        {el.text}
      </div>
    </div>
  )
}

const CompareLayout: React.FC<{ elements: SceneElement[]; theme: SceneTheme }> = ({ elements, theme }) => {
  const bad = elements.find((e) => e.type === 'compareBad') || elements[0]
  const good = elements.find((e) => e.type === 'compareGood') || elements[1]
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 40,
        padding: '0 120px',
        fontFamily: FONT_STACK,
      }}
    >
      {bad ? <CompareCol el={bad} kind="bad" theme={theme} /> : null}
      {good ? <CompareCol el={good} kind="good" theme={theme} /> : null}
    </div>
  )
}

// —— 极淡的浮动背景光斑（让上区不空、有呼吸感，但绝不抢字） ——
// 帧驱动正弦漂移，确定可复现（不用随机）。三团 accent 大模糊圆缓慢游动。
const AmbientBackground: React.FC<{ theme: SceneTheme }> = ({ theme }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const t = frame / fps // 秒
  const blobs = [
    { baseX: 22, baseY: 30, r: 460, sp: 0.06, ph: 0, amp: 5 },
    { baseX: 78, baseY: 62, r: 520, sp: 0.05, ph: 2.1, amp: 6 },
    { baseX: 55, baseY: 20, r: 380, sp: 0.08, ph: 4.2, amp: 4 },
  ]
  const alpha = theme.dark ? 0.16 : 0.10
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {blobs.map((b, i) => {
        const dx = Math.sin(t * b.sp * Math.PI * 2 + b.ph) * b.amp
        const dy = Math.cos(t * b.sp * Math.PI * 2 + b.ph) * b.amp
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `calc(${b.baseX + dx}% - ${b.r / 2}px)`,
              top: `calc(${b.baseY + dy}% - ${b.r / 2}px)`,
              width: b.r,
              height: b.r,
              borderRadius: '50%',
              background: theme.accent,
              opacity: alpha,
              filter: 'blur(90px)',
            }}
          />
        )
      })}
    </div>
  )
}

export const SceneStage: React.FC<{ scene: Scene; theme: SceneTheme; overlay?: boolean }> = ({
  scene,
  theme,
  overlay = false,
}) => {
  const elements = scene.elements || []
  const layout = (() => {
    switch (scene.layout) {
      case 'steps':
        return <StepsLayout elements={elements} theme={theme} />
      case 'arrow':
        return <ArrowLayout elements={elements} theme={theme} />
      case 'compare':
        return <CompareLayout elements={elements} theme={theme} />
      case 'keyword':
      default:
        return <KeywordLayout elements={elements} theme={theme} />
    }
  })()

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {/* overlay 模式（叠在实拍视频上）：跳过浮动光斑背景，只留悬浮卡片，避免弄脏画面 */}
      {overlay ? null : <AmbientBackground theme={theme} />}
      <div style={{ position: 'absolute', inset: 0 }}>
        {elements.length === 0 ? null : layout}
      </div>
    </div>
  )
}
