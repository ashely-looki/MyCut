import React from 'react'
import { Composition } from 'remotion'
import { CaptionedVideo, CaptionedVideoProps, TRANSITION_FRAMES } from './CaptionedVideo'

const FPS = 30
const WIDTH = 1920
const HEIGHT = 1080

// 默认 theme（DESIGN.md 值 + 派生字段）——后端 theme_service 会通过 inputProps 覆盖，
// Studio 预览时用这套兜底。字段须与 SceneTheme 一致。
const DEFAULT_THEME = {
  accent: '#E8710A',
  ink: '#1A1A19',
  bg: '#F6F5F3',
  sub: '#6E6B66',
  line: '#EBE9E4',
  card: '#FFFFFF',
  muted: '#A8A49C',
  accentSoft: '#FBEBDD',
  onAccent: '#FFFFFF',
  dark: false,
}

// Studio 预览用的示例 props（渲染时被 --props 覆盖）。
// 这里三句演示上区三种画面来源：实拍视频 / 静图推拉 / 结构化信息动画。
// video/image 用公网示例素材，方便无本地素材时直接预览；换成自己的素材时，
// 把文件放 remotion/public/ 下，visualSrc 改成相对路径即可（http/data 也直接支持）。
const DEFAULT_PROPS: CaptionedVideoProps = {
  title: '为什么 AI 有时候搜不到你想要的东西',
  style: '科普',
  theme: DEFAULT_THEME,
  titleDurationInFrames: 2 * FPS,
  outroDurationInFrames: 2 * FPS,
  segments: [
    {
      // Higgsfield Kling 3.0 生成的荒漠空镜（5.04s，1920×1080），落在 public/samples/
      text: '两年前，他独自驾车驶入了这片无人区。',
      audioSrc: null,
      visualType: 'video',
      visualSrc: 'samples/desert-kling.mp4',
      durationInFrames: 5 * FPS,
      role: 'hook',
    },
    {
      text: '问题往往不在 AI，而在你的提问方式。',
      audioSrc: null,
      visualType: 'image-kenburns',
      visualSrc: 'https://picsum.photos/seed/mycut/1920/1080',
      durationInFrames: 3 * FPS,
      role: 'body',
    },
    {
      text: '记住这三个技巧，你也能成为提问高手。',
      audioSrc: null,
      visualType: 'scene',
      scene: {
        layout: 'keyword',
        elements: [
          { type: 'keyword', text: '提问技巧', icon: 'sparkle', enterAt: 0, emphasis: true },
        ],
      },
      durationInFrames: 3 * FPS,
      role: 'cta',
    },
  ],
}

const calcDuration = (props: CaptionedVideoProps) => {
  const seg = props.segments.reduce((s, x) => s + (x.durationInFrames || 0), 0)
  const total = (props.titleDurationInFrames || 0) + seg + (props.outroDurationInFrames || 0)
  // TransitionSeries 让相邻片段各重叠 TRANSITION_FRAMES 帧做过渡，总时长要相应减去。
  // 过渡数 = 片头→首句(1) + 句间(n-1) + 末句→片尾(1) = 片段数
  const pieces = props.segments.length + 2 // 片头 + n 句 + 片尾
  const transitions = Math.max(0, pieces - 1)
  return Math.max(1, total - transitions * TRANSITION_FRAMES)
}

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="CaptionedVideo"
      component={CaptionedVideo}
      durationInFrames={calcDuration(DEFAULT_PROPS)}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={DEFAULT_PROPS}
      // 数据驱动：真实时长由传入的 props 算出
      calculateMetadata={({ props }) => ({
        durationInFrames: calcDuration(props as CaptionedVideoProps),
        fps: FPS,
        width: WIDTH,
        height: HEIGHT,
      })}
    />
  )
}
