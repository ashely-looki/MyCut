import React from 'react'
import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion'
import { TransitionSeries, linearTiming } from '@remotion/transitions'
import { fade } from '@remotion/transitions/fade'
import { Scene, SceneTheme } from './SceneStage'
import { VisualStage, VisualType } from './VisualStage'
import { CN_FONT_STACK } from './fonts'

// 句间过渡时长（帧）。TransitionSeries 让相邻片段重叠这么多帧做交叉溶解；
// 总时长由 Root.tsx calcDuration 减去重叠帧算出，每句音频跟随自身片段，音画不失步。
// ~0.6s，丝滑从容的溶解（非 PPT 翻页/推屏）。
export const TRANSITION_FRAMES = 18

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
  // 上区画面来源（素材混剪路线）。给了 visualType+visualSrc 就渲素材，否则回退 scene：
  //   'video'          实拍/生成的视频素材（OffthreadVideo）
  //   'image-kenburns' 静图 + 缓慢推拉
  //   'scene'/未指定    走结构化信息动画 scene
  visualType?: VisualType | null
  visualSrc?: string | null // 素材文件路径（相对 remotion/public/，或 http(s)/data）
  scene?: Scene | null // 该句的信息动画视觉脚本；null/空则上区留暖底
  overlayTheme?: SceneTheme | null // 实拍句叠加组件专用 theme（accent 取自视频主色，呼应画面）
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

// 画面卡：只负责上区视觉（实拍/静图/信息动画）+ 底部暗化渐变。
// 字幕不在这里——字幕单独走一条不参与转场的轨（见 CaptionTrack），避免句间 fade
// 转场时前后两句字幕在重叠帧里半透明叠加、互相遮挡。
const CaptionCard: React.FC<{
  segment: CaptionSegment
  theme: CaptionedVideoProps['theme']
}> = ({ segment, theme }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: theme.bg, fontFamily: FONT_STACK }}>
      <AbsoluteFill style={{ overflow: 'hidden' }}>
        <VisualStage
          visualType={segment.visualType}
          visualSrc={segment.visualSrc}
          scene={segment.scene}
          theme={theme}
          overlayTheme={segment.overlayTheme}
          durationInFrames={segment.durationInFrames}
        />
      </AbsoluteFill>

      {/* 底部暗化渐变：统一都铺，保证任意画面（实拍/静图/信息动画）上白字字幕都清晰 */}
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(to bottom, rgba(0,0,0,0) 48%, rgba(0,0,0,0.32) 70%, rgba(0,0,0,0.8) 100%)',
          pointerEvents: 'none',
        }}
      />
    </AbsoluteFill>
  )
}

// 单条字幕：一次性显示整句，无淡入淡出。颜色统一白字 + 阴影，位置压底稍偏下。
const CaptionText: React.FC<{ text: string }> = ({ text }) => (
  <AbsoluteFill style={{ fontFamily: FONT_STACK }}>
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 90,
        display: 'flex',
        justifyContent: 'center',
        padding: '0 200px',
      }}
    >
      <div
        style={{
          textAlign: 'center',
          maxWidth: 1500,
          fontSize: 56,
          fontWeight: 600,
          color: '#FFFFFF',
          lineHeight: 1.45,
          letterSpacing: '0.5px',
          textShadow: '0 2px 16px rgba(0,0,0,0.6)',
        }}
      >
        {text}
      </div>
    </div>
  </AbsoluteFill>
)

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

  // 字幕轨每句的起始帧与时长。TransitionSeries 让相邻片段重叠 TRANSITION_FRAMES 帧做转场，
  // 所以片头后第一句起点 = 片头时长 − 重叠帧；之后每句 = 前句起点 + 前句时长 − 重叠帧。
  // 字幕时长同样各减一个重叠帧，使相邻字幕区间首尾相接、不重叠 → 硬切、永不互相遮挡。
  const captionRanges: { from: number; duration: number }[] = []
  let cursor = titleDurationInFrames - TRANSITION_FRAMES
  segments.forEach((seg, i) => {
    // 除最后一句外，每句砍掉与下一句转场重叠的那段，避免两句字幕并存
    const trim = i < segments.length - 1 ? TRANSITION_FRAMES : 0
    captionRanges.push({ from: cursor, duration: Math.max(1, seg.durationInFrames - trim) })
    cursor += seg.durationInFrames - TRANSITION_FRAMES
  })

  return (
    <AbsoluteFill style={{ backgroundColor: theme.bg }}>
      {/* 画面轨：片头 / 逐句画面 / 片尾，句间 fade 丝滑溶解 */}
      <TransitionSeries>
        {/* 片头 */}
        <TransitionSeries.Sequence durationInFrames={titleDurationInFrames}>
          <TitleCard title={title} style={style} theme={theme} />
        </TransitionSeries.Sequence>

        {/* 片头 → 第一句：淡入 */}
        <TransitionSeries.Transition presentation={fade()} timing={timing} />

        {/* 逐句：句与句之间用交叉溶解（fade），画面丝滑过渡，不是 PPT 式翻页/推屏 */}
        {segments.map((seg, i) => (
          <React.Fragment key={i}>
            <TransitionSeries.Sequence durationInFrames={seg.durationInFrames}>
              <CaptionCard segment={seg} theme={theme} />
              {seg.audioSrc ? <Audio src={resolveSrc(seg.audioSrc)} /> : null}
            </TransitionSeries.Sequence>
            {i < segments.length - 1 ? (
              <TransitionSeries.Transition presentation={fade()} timing={timing} />
            ) : null}
          </React.Fragment>
        ))}

        {/* 最后一句 → 片尾：淡入 */}
        <TransitionSeries.Transition presentation={fade()} timing={timing} />
        <TransitionSeries.Sequence durationInFrames={outroDurationInFrames}>
          <OutroCard theme={theme} />
        </TransitionSeries.Sequence>
      </TransitionSeries>

      {/* 字幕轨：独立于画面转场，按每句时间硬切显示，无淡入淡出、永不互相遮挡 */}
      {segments.map((seg, i) => {
        const r = captionRanges[i]
        return (
          <Sequence key={i} from={Math.max(0, r.from)} durationInFrames={r.duration}>
            <CaptionText text={seg.text} />
          </Sequence>
        )
      })}
    </AbsoluteFill>
  )
}
