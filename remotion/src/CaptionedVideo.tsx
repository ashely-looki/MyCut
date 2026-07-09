import React from 'react'
import {
  AbsoluteFill,
  Audio,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion'
import { TransitionSeries, linearTiming } from '@remotion/transitions'
import { fade } from '@remotion/transitions/fade'
import { slide } from '@remotion/transitions/slide'
import { Scene, SceneStage, SceneTheme } from './SceneStage'
import { CN_FONT_STACK } from './fonts'

// 句间过渡时长（帧）。TransitionSeries 会让相邻片段重叠这么多帧做交叉过渡，
// 后端已把这段重叠帧补进每句时长，故音画不失步。~0.4s，克制不喧宾夺主。
export const TRANSITION_FRAMES = 12

/**
 * 逐句字幕科普视频。
 * 结构：片头标题卡 → 逐句（上区信息动画 SceneStage + 下区口播字幕 + 配音）→ 片尾收束卡。
 *
 * 上区不再是静态 AI 图，而是按后端「视觉脚本」逐元素入场的信息动画
 * （关键词大字 / 图标 / 序号步骤 / 箭头 / 对比）。
 *
 * 配色不再写死：由后端 theme_service 按每条视频的内容调性生成一套主题（theme prop）
 * 传入——科技冷蓝 / 暖情橙 / 深墨财经…。后端已强制保证字幕对比度。
 * LLM 失败时后端回退 DESIGN.md 默认主题（单橙暖底）。
 */

export type CaptionSegment = {
  text: string
  audioSrc: string | null // 该句配音文件（staticFile 相对路径），可为 null（无配音）
  scene?: Scene | null // 该句的信息动画视觉脚本；null/空则上区留暖底
  durationInFrames: number
  role?: string // hook | body | cta
}

// audioSrc 是相对 remotion/public/ 的 staticFile 路径；http(s)/data 原样用
const resolveSrc = (src: string): string =>
  /^(https?:|data:)/.test(src) ? src : staticFile(src)

export type CaptionedVideoProps = {
  title: string
  style?: string
  theme: SceneTheme
  segments: CaptionSegment[]
  titleDurationInFrames: number
  outroDurationInFrames: number
}

// 中文字体：显式加载的 Noto Sans SC（+ 系统字兜底），见 ./fonts
const FONT_STACK = CN_FONT_STACK

const TitleCard: React.FC<{ title: string; style?: string; theme: CaptionedVideoProps['theme'] }> = ({
  title,
  style,
  theme,
}) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const enter = spring({ frame, fps, config: { damping: 200 } })
  const opacity = interpolate(enter, [0, 1], [0, 1])
  const translateY = interpolate(enter, [0, 1], [24, 0])

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.bg,
        justifyContent: 'center',
        alignItems: 'center',
        fontFamily: FONT_STACK,
        padding: '0 160px',
      }}
    >
      <div style={{ opacity, transform: `translateY(${translateY}px)`, textAlign: 'center' }}>
        {/* 顶部克制橙色小标记 */}
        <div
          style={{
            width: 56,
            height: 6,
            borderRadius: 999,
            backgroundColor: theme.accent,
            margin: '0 auto 40px',
          }}
        />
        <div
          style={{
            fontSize: 88,
            fontWeight: 700,
            color: theme.ink,
            lineHeight: 1.25,
            letterSpacing: '1px',
          }}
        >
          {title}
        </div>
        {style ? (
          <div style={{ marginTop: 32, fontSize: 32, color: theme.sub, letterSpacing: '2px' }}>
            {style}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  )
}

const CaptionCard: React.FC<{
  segment: CaptionSegment
  index: number
  total: number
  theme: CaptionedVideoProps['theme']
}> = ({ segment, index, total, theme }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const enter = spring({ frame, fps, config: { damping: 200, mass: 0.6 } })
  const opacity = interpolate(enter, [0, 1], [0, 1])
  const translateY = interpolate(enter, [0, 1], [40, 0])

  return (
    <AbsoluteFill style={{ backgroundColor: theme.bg, fontFamily: FONT_STACK }}>
      {/* 上区 62%：信息动画舞台（按视觉脚本逐元素入场） */}
      <div style={{ height: '62%', width: '100%', overflow: 'hidden', position: 'relative', backgroundColor: theme.bg }}>
        {segment.scene ? <SceneStage scene={segment.scene} theme={theme} /> : null}
        {/* 右上角进度序号 */}
        <div
          style={{
            position: 'absolute',
            top: 48,
            right: 64,
            fontSize: 26,
            color: theme.sub,
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '2px',
          }}
        >
          {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
        </div>
      </div>

      {/* 下区 38%：暖底字幕区（与上区之间一条发丝线分隔）。整句一次显示，清晰易读。 */}
      <div
        style={{
          height: '38%',
          width: '100%',
          backgroundColor: theme.bg,
          borderTop: `1px solid ${theme.line}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 200px',
          position: 'relative',
        }}
      >
        <div style={{ opacity, transform: `translateY(${translateY}px)`, textAlign: 'center', maxWidth: 1500 }}>
          <div style={{ fontSize: 56, fontWeight: 600, color: theme.ink, lineHeight: 1.45, letterSpacing: '0.5px' }}>
            {segment.text}
          </div>
        </div>
        {/* 底部细橙线 */}
        <div
          style={{
            position: 'absolute',
            bottom: 56,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 120,
            height: 4,
            borderRadius: 999,
            backgroundColor: theme.accent,
            opacity,
          }}
        />
      </div>
    </AbsoluteFill>
  )
}

const OutroCard: React.FC<{ theme: CaptionedVideoProps['theme'] }> = ({ theme }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const enter = spring({ frame, fps, config: { damping: 200 } })
  const opacity = interpolate(enter, [0, 1], [0, 1])

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.ink,
        justifyContent: 'center',
        alignItems: 'center',
        fontFamily: FONT_STACK,
      }}
    >
      <div style={{ opacity, textAlign: 'center' }}>
        <div style={{ fontSize: 48, fontWeight: 600, color: theme.bg, letterSpacing: '2px' }}>
          感谢观看
        </div>
        <div style={{ marginTop: 24, fontSize: 28, color: theme.accent, letterSpacing: '6px' }}>
          MyCut
        </div>
      </div>
    </AbsoluteFill>
  )
}

export const CaptionedVideo: React.FC<CaptionedVideoProps> = ({
  title,
  style,
  theme,
  segments,
  titleDurationInFrames,
  outroDurationInFrames,
}) => {
  const timing = linearTiming({ durationInFrames: TRANSITION_FRAMES })

  return (
    <AbsoluteFill style={{ backgroundColor: theme.bg }}>
      <TransitionSeries>
        {/* 片头 */}
        <TransitionSeries.Sequence durationInFrames={titleDurationInFrames}>
          <TitleCard title={title} style={style} theme={theme} />
        </TransitionSeries.Sequence>

        {/* 片头 → 第一句：淡入 */}
        <TransitionSeries.Transition presentation={fade()} timing={timing} />

        {/* 逐句：句与句之间轻横向滑动过渡 */}
        {segments.map((seg, i) => (
          <React.Fragment key={i}>
            <TransitionSeries.Sequence durationInFrames={seg.durationInFrames}>
              <CaptionCard segment={seg} index={i} total={segments.length} theme={theme} />
              {seg.audioSrc ? <Audio src={resolveSrc(seg.audioSrc)} /> : null}
            </TransitionSeries.Sequence>
            {i < segments.length - 1 ? (
              <TransitionSeries.Transition
                presentation={slide({ direction: 'from-right' })}
                timing={timing}
              />
            ) : null}
          </React.Fragment>
        ))}

        {/* 最后一句 → 片尾：淡入 */}
        <TransitionSeries.Transition presentation={fade()} timing={timing} />
        <TransitionSeries.Sequence durationInFrames={outroDurationInFrames}>
          <OutroCard theme={theme} />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  )
}
