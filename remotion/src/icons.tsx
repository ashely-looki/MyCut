import React from 'react'

/**
 * 离线图标库（自动成片信息动画用）。
 *
 * 24×24 viewBox 的描边图标（Lucide 风格，stroke=currentColor / fill=none），
 * 单色、克制，贴 Calm Premium。名字与后端 scene_service._ICON_VOCAB / prompt 词表一致。
 * 未收录的名字 → 用一个通用圆点占位（不至于空白）。
 *
 * 不联网、不装第三方图标包：渲染确定、离线可用。
 */

// 每个值是 <path>/<circle>/<line> 等 SVG 子元素（去掉外层 <svg>），stroke 由外层统一给
const PATHS: Record<string, React.ReactNode> = {
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.2 3-4.8 6-4.8s6 1.6 6 4.8" />
      <path d="M16 5.2A3.2 3.2 0 0 1 16 11.4" />
      <path d="M17.5 15.6c2 .6 3.5 1.9 3.5 4.4" />
    </>
  ),
  brain: (
    <>
      <path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-1 5.8A3 3 0 0 0 9 18V4Z" />
      <path d="M15 4a3 3 0 0 1 3 3 3 3 0 0 1 1 5.8A3 3 0 0 1 15 18V4Z" />
      <line x1="12" y1="4" x2="12" y2="18" />
    </>
  ),
  robot: (
    <>
      <rect x="5" y="8" width="14" height="10" rx="2.5" />
      <line x1="12" y1="4" x2="12" y2="8" />
      <circle cx="12" cy="4" r="1.4" />
      <circle cx="9.5" cy="13" r="1.1" />
      <circle cx="14.5" cy="13" r="1.1" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6" />
      <line x1="20" y1="20" x2="15.5" y2="15.5" />
    </>
  ),
  document: (
    <>
      <path d="M7 3h7l4 4v14H7z" />
      <path d="M14 3v4h4" />
      <line x1="9.5" y1="12" x2="15" y2="12" />
      <line x1="9.5" y1="15.5" x2="15" y2="15.5" />
    </>
  ),
  book: (
    <>
      <path d="M5 5a2 2 0 0 1 2-2h11v16H7a2 2 0 0 0-2 2z" />
      <line x1="18" y1="19" x2="7" y2="19" />
    </>
  ),
  lightbulb: (
    <>
      <path d="M9 15a5 5 0 1 1 6 0c-.7.6-1 1.2-1 2v.5H10V17c0-.8-.3-1.4-1-2Z" />
      <line x1="10" y1="21" x2="14" y2="21" />
    </>
  ),
  idea: (
    <>
      <path d="M9 15a5 5 0 1 1 6 0c-.7.6-1 1.2-1 2v.5H10V17c0-.8-.3-1.4-1-2Z" />
      <line x1="10" y1="21" x2="14" y2="21" />
      <line x1="12" y1="2" x2="12" y2="3.5" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1.2" />
    </>
  ),
  check: <path d="M5 12.5 10 17.5 19 7" />,
  cross: (
    <>
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </>
  ),
  warning: (
    <>
      <path d="M12 4 21 19H3z" />
      <line x1="12" y1="10" x2="12" y2="14" />
      <circle cx="12" cy="16.6" r="0.6" />
    </>
  ),
  star: <path d="m12 3 2.6 5.6 6 .7-4.4 4.2 1.2 6L12 16.9 6.6 19.5l1.2-6L3.4 9.3l6-.7z" />,
  heart: <path d="M12 20S4 15 4 9.5A3.8 3.8 0 0 1 12 7a3.8 3.8 0 0 1 8 2.5C20 15 12 20 12 20Z" />,
  rocket: (
    <>
      <path d="M12 3c3.5 2 5 5.5 5 9l-3 3H10l-3-3c0-3.5 1.5-7 5-9Z" />
      <circle cx="12" cy="9.5" r="1.6" />
      <path d="M9 18c-1.5.5-2 2-2 3 1 0 2.5-.5 3-2" />
      <path d="M15 18c1.5.5 2 2 2 3-1 0-2.5-.5-3-2" />
    </>
  ),
  chart: (
    <>
      <line x1="4" y1="20" x2="20" y2="20" />
      <rect x="6" y="12" width="3" height="6" />
      <rect x="11" y="8" width="3" height="10" />
      <rect x="16" y="5" width="3" height="13" />
    </>
  ),
  growth: (
    <>
      <path d="M4 17 10 11 13 14 20 7" />
      <path d="M15 7h5v5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7.5V12l3.5 2" />
    </>
  ),
  calendar: (
    <>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <line x1="4" y1="9.5" x2="20" y2="9.5" />
      <line x1="8.5" y1="3" x2="8.5" y2="6.5" />
      <line x1="15.5" y1="3" x2="15.5" y2="6.5" />
    </>
  ),
  message: (
    <>
      <path d="M4 5h16v11H9l-4 4V16H4z" />
    </>
  ),
  chat: (
    <>
      <path d="M4 5h16v11H9l-4 4V16H4z" />
      <line x1="8" y1="9.5" x2="16" y2="9.5" />
      <line x1="8" y1="12.5" x2="13" y2="12.5" />
    </>
  ),
  question: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-.9.8-.9 1.5v.5" />
      <circle cx="12" cy="16.4" r="0.6" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8" />
    </>
  ),
  tool: <path d="M15 4a4 4 0 0 0-5 5l-6 6 2 2 6-6a4 4 0 0 0 5-5l-2.5 2.5-2-2z" />,
  key: (
    <>
      <circle cx="8" cy="8" r="4" />
      <path d="M11 11l8 8M16 16l2-2M19 19l2-2" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>
  ),
  link: (
    <>
      <path d="M9 15l6-6" />
      <path d="M13 6l2-2a3.5 3.5 0 0 1 5 5l-2 2" />
      <path d="M11 18l-2 2a3.5 3.5 0 0 1-5-5l2-2" />
    </>
  ),
  code: <path d="M8 8l-4 4 4 4M16 8l4 4-4 4M13.5 6l-3 12" />,
  data: (
    <>
      <ellipse cx="12" cy="6" rx="7" ry="3" />
      <path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6" />
      <path d="M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3" />
    </>
  ),
  money: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7v10M14.5 9.2c0-1.2-1.1-1.8-2.5-1.8s-2.5.7-2.5 2 1 1.6 2.5 1.6 2.5.5 2.5 1.8-1.1 1.8-2.5 1.8-2.5-.6-2.5-1.8" />
    </>
  ),
  trophy: (
    <>
      <path d="M8 4h8v5a4 4 0 0 1-8 0z" />
      <path d="M8 5H5v1a3 3 0 0 0 3 3M16 5h3v1a3 3 0 0 1-3 3" />
      <line x1="12" y1="13" x2="12" y2="17" />
      <path d="M9 20h6M10 17h4v3h-4z" />
    </>
  ),
  flag: (
    <>
      <line x1="6" y1="3" x2="6" y2="21" />
      <path d="M6 4h11l-2.5 3.5L17 11H6z" />
    </>
  ),
  eye: (
    <>
      <path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6Z" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  hand: (
    <>
      <path d="M8 11V6a1.5 1.5 0 0 1 3 0v4M11 10V5a1.5 1.5 0 0 1 3 0v5M14 10.5V7a1.5 1.5 0 0 1 3 0v6a6 6 0 0 1-6 6h-1a5 5 0 0 1-4-2.2L5 13.5a1.5 1.5 0 0 1 2.4-1.8L8 12.5" />
    </>
  ),
  thumbsup: (
    <>
      <path d="M7 11v9H4v-9z" />
      <path d="M7 11l3.5-7a2 2 0 0 1 3.5 1.3V9h4.5a2 2 0 0 1 2 2.4l-1.3 6A2 2 0 0 1 21 20H7" />
    </>
  ),
  list: (
    <>
      <line x1="9" y1="7" x2="20" y2="7" />
      <line x1="9" y1="12" x2="20" y2="12" />
      <line x1="9" y1="17" x2="20" y2="17" />
      <circle cx="5" cy="7" r="1.1" />
      <circle cx="5" cy="12" r="1.1" />
      <circle cx="5" cy="17" r="1.1" />
    </>
  ),
  filter: <path d="M4 5h16l-6 7v6l-4 2v-8z" />,
  magnet: (
    <>
      <path d="M6 4v7a6 6 0 0 0 12 0V4h-4v7a2 2 0 0 1-4 0V4z" />
      <line x1="6" y1="7.5" x2="10" y2="7.5" />
      <line x1="14" y1="7.5" x2="18" y2="7.5" />
    </>
  ),
  sparkle: (
    <>
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
      <path d="M18 15l.8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8z" />
    </>
  ),
}

const DOT: React.ReactNode = <circle cx="12" cy="12" r="3.5" />

export type IconGlyphProps = {
  name: string
  size?: number
  color?: string
  strokeWidth?: number
}

/** 按名字渲染一个描边图标；名字未收录时用通用圆点占位。 */
export const IconGlyph: React.FC<IconGlyphProps> = ({
  name,
  size = 64,
  color = '#1A1A19',
  strokeWidth = 1.8,
}) => {
  const glyph = PATHS[name] ?? DOT
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {glyph}
    </svg>
  )
}

export const hasIcon = (name: string): boolean => !!name && name in PATHS
