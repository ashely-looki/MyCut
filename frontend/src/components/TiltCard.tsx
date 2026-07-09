import React, { useCallback, useEffect, useRef } from 'react'

/**
 * TiltCard —— 只取 reactbits ProfileCard 的「3D 倾斜跟随鼠标」动效，不含任何配色/发光/头像。
 *
 * 机制（对齐 reactbits main 分支）：
 * - 鼠标在卡片上移动 → 按光标相对卡片的位置算出 rotateX/rotateY（朝光标方向倾斜）。
 *   rotateX ≈ ±10°、rotateY ≈ ±12.5°，X 轴反号让卡片"迎向"光标；CSS 里有意做轴交换。
 * - requestAnimationFrame 指数衰减平滑：current 每帧追 target，k = 1 - exp(-dt/tau)，tau=0.14s（跟手）。
 * - 悬停时 transition:none 逐帧跟随；移出后 target 回中心 → 归零，静止态 transition: transform .8s ease 收回。
 * - perspective 放在外层 wrapper（500px），不使用 preserve-3d。
 */

interface TiltCardProps {
  children: React.ReactNode
  /** wrapper 样式（用于 grid/flex 布局定位，动效不依赖它） */
  style?: React.CSSProperties
  className?: string
  /** 禁用倾斜（如上传卡展开成表单时，保持平整方便操作） */
  disabled?: boolean
}

const TAU = 0.14 // 稳态平滑时间常数（秒），越小越跟手
const clamp = (v: number, min = 0, max = 100) => Math.min(Math.max(v, min), max)
const round = (v: number) => parseFloat(v.toFixed(3))

const TiltCard: React.FC<TiltCardProps> = ({ children, style, className, disabled = false }) => {
  const wrapRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  // 平滑引擎状态（存 ref，不触发 render）
  const targetX = useRef(50)
  const targetY = useRef(50)
  const currentX = useRef(50)
  const currentY = useRef(50)
  const rafId = useRef<number | null>(null)
  const running = useRef(false)
  const lastTs = useRef(0)

  // 把 current(百分比 0~100) 写成 rotate 变量应用到卡片
  const applyVars = useCallback((px: number, py: number) => {
    const card = cardRef.current
    if (!card) return
    const centerX = px - 50 // -50..+50
    const centerY = py - 50
    const rx = round(-(centerX / 5)) // ≈ ±10deg，X 轴反号，朝光标倾
    const ry = round(centerY / 4) // ≈ ±12.5deg
    // CSS 里做轴交换：卡片 rotateX 用 --rotate-y，rotateY 用 --rotate-x
    card.style.setProperty('--rotate-x', `${rx}deg`)
    card.style.setProperty('--rotate-y', `${ry}deg`)
  }, [])

  const step = useCallback(
    (ts: number) => {
      if (!running.current) return
      if (lastTs.current === 0) lastTs.current = ts
      const dt = (ts - lastTs.current) / 1000
      lastTs.current = ts

      const k = 1 - Math.exp(-dt / TAU)
      currentX.current += (targetX.current - currentX.current) * k
      currentY.current += (targetY.current - currentY.current) * k
      applyVars(currentX.current, currentY.current)

      const stillFar =
        Math.abs(targetX.current - currentX.current) > 0.05 ||
        Math.abs(targetY.current - currentY.current) > 0.05
      if (stillFar) {
        rafId.current = requestAnimationFrame(step)
      } else {
        running.current = false
        lastTs.current = 0
        if (rafId.current) {
          cancelAnimationFrame(rafId.current)
          rafId.current = null
        }
      }
    },
    [applyVars],
  )

  const ensureRunning = useCallback(() => {
    if (running.current) return
    running.current = true
    lastTs.current = 0
    rafId.current = requestAnimationFrame(step)
  }, [step])

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled) return
      const el = wrapRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const w = el.clientWidth || 1
      const h = el.clientHeight || 1
      targetX.current = clamp((100 / w) * (e.clientX - rect.left))
      targetY.current = clamp((100 / h) * (e.clientY - rect.top))
      ensureRunning()
    },
    [ensureRunning, disabled],
  )

  const handlePointerEnter = useCallback(() => {
    if (disabled) return
    cardRef.current?.classList.add('tilt-active')
  }, [disabled])

  const handlePointerLeave = useCallback(() => {
    // 目标回中心 → rotate 归零，静止态 CSS transition 收回
    targetX.current = 50
    targetY.current = 50
    ensureRunning()
    cardRef.current?.classList.remove('tilt-active')
  }, [ensureRunning])

  // disabled 打开时（如上传卡展开表单）立即摆平
  useEffect(() => {
    if (disabled) {
      targetX.current = 50
      targetY.current = 50
      cardRef.current?.classList.remove('tilt-active')
      ensureRunning()
    }
  }, [disabled, ensureRunning])

  useEffect(() => {
    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current)
    }
  }, [])

  return (
    <div
      ref={wrapRef}
      className={className}
      style={{ perspective: '900px', ...style }}
      onPointerMove={handlePointerMove}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
    >
      <div
        ref={cardRef}
        className="tilt-card"
        style={{ height: '100%', transformStyle: 'flat' }}
      >
        {children}
      </div>
    </div>
  )
}

export default TiltCard
