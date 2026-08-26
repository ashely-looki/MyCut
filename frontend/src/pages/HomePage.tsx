import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Icon } from '@iconify/react'
import altArrowRightLinear from '@iconify-icons/solar/alt-arrow-right-linear'
import documentTextLinear from '@iconify-icons/solar/document-text-linear'
import fireBold from '@iconify-icons/solar/fire-bold'
import videoFramePlayHorizontalBold from '@iconify-icons/solar/video-frame-play-horizontal-bold'
import { useNavigate } from 'react-router-dom'

import heroVideo from '../assets/home/biograph-memberships-hero.mp4'
import heroImage from '../assets/home/mycut-editorial-hero.webp'
import { Button } from '../components/ui/button'

const WORKFLOW = [
  {
    number: '01',
    title: 'AI 查热点',
    description: '输入关键词，找到值得现在开始讲的选题。',
    icon: fireBold,
  },
  {
    number: '02',
    title: 'AI 写文案',
    description: '编辑角度、大纲与每一个分镜表达。',
    icon: documentTextLinear,
  },
  {
    number: '03',
    title: 'AI 生成视频',
    description: '确认画面、配音和字幕，交付完整成片。',
    icon: videoFramePlayHorizontalBold,
  },
]

const HomePage = () => {
  const navigate = useNavigate()
  const heroRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [videoReady, setVideoReady] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const syncVideoPlayback = () => {
      const video = videoRef.current
      if (!video) return
      if (mediaQuery.matches) {
        video.pause()
        return
      }
      void video.play().catch(() => undefined)
    }

    syncVideoPlayback()
    mediaQuery.addEventListener('change', syncVideoPlayback)
    return () => mediaQuery.removeEventListener('change', syncVideoPlayback)
  }, [])

  const handleHeroPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const horizontal = (event.clientX - bounds.left) / bounds.width
    const vertical = (event.clientY - bounds.top) / bounds.height

    event.currentTarget.style.setProperty('--hero-pointer-x', `${horizontal * 100}%`)
    event.currentTarget.style.setProperty('--hero-pointer-y', `${vertical * 100}%`)
    event.currentTarget.style.setProperty('--hero-shift-x', `${(horizontal - 0.5) * -12}px`)
    event.currentTarget.style.setProperty('--hero-shift-y', `${(vertical - 0.5) * -8}px`)
  }

  const resetHeroPointer = () => {
    const hero = heroRef.current
    if (!hero) return
    hero.style.setProperty('--hero-pointer-x', '32%')
    hero.style.setProperty('--hero-pointer-y', '34%')
    hero.style.setProperty('--hero-shift-x', '0px')
    hero.style.setProperty('--hero-shift-y', '0px')
  }

  return (
    <main className="min-h-full bg-background text-foreground">
      <section className="min-h-full">
        <div
          ref={heroRef}
          className="home-hero relative min-h-[calc(100svh-4rem)] w-full overflow-hidden bg-[#100f0d] text-white"
          onPointerMove={handleHeroPointerMove}
          onPointerLeave={resetHeroPointer}
        >
          <img
            src={heroImage}
            alt="剪辑师在专业工作室中编辑视频"
            className="home-hero__media absolute inset-0 size-full object-cover object-[64%_center]"
          />
          <video
            ref={videoRef}
            className={`home-hero__media home-hero__video absolute inset-0 size-full object-cover ${videoReady ? 'is-ready' : ''}`}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            poster={heroImage}
            aria-hidden="true"
            onCanPlay={() => setVideoReady(true)}
            onError={() => setVideoReady(false)}
          >
            <source src={heroVideo} type="video/mp4" />
          </video>
          <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,5,5,0.96)_0%,rgba(5,5,5,0.78)_35%,rgba(5,5,5,0.17)_68%,rgba(5,5,5,0.32)_100%)]" />
          <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(0deg,rgba(5,5,5,0.90)_0%,rgba(5,5,5,0.12)_54%,rgba(5,5,5,0.28)_100%)]" />
          <div aria-hidden="true" className="home-hero__spotlight absolute inset-0" />

          <div className="relative z-10 flex min-h-[calc(100svh-4rem)] flex-col px-6 pb-6 pt-12 sm:px-10 sm:pb-10 sm:pt-14 lg:px-[60px] lg:pb-12 lg:pt-16">
            <div className="home-hero__intro max-w-[760px]">
              <h1 className="text-[clamp(3.25rem,5.8vw,5.9rem)] font-normal leading-[0.92] tracking-[-0.065em] text-white">
                从一个热点，
                <br />
                到一支成片。
              </h1>

              <p className="mt-6 max-w-[620px] text-[15px] leading-7 text-white/64 sm:text-base">
                输入关键词，完成选题、文案、分镜与视频生成。整个创作过程，都在同一个工作区持续完成。
              </p>

              <Button
                type="button"
                size="lg"
                variant="secondary"
                className="mt-8 h-11 rounded-[10px] bg-white px-5 text-sm text-black shadow-none transition-[transform,background-color] duration-200 ease-out hover:-translate-y-0.5 hover:bg-white/90"
                onClick={() => navigate('/create')}
              >
                开始创作
                <Icon icon={altArrowRightLinear} className="size-4" />
              </Button>
            </div>

            <div className="home-hero__rail mt-20 grid grid-cols-1 gap-3 sm:mt-auto sm:grid-cols-3 sm:gap-4 sm:pt-16" aria-label="MyCut 创作流程">
              {WORKFLOW.map((item) => (
                <div
                  key={item.number}
                  className="relative min-h-[148px] overflow-hidden rounded-[20px] bg-black/35 p-5 text-left text-white sm:min-h-[166px] sm:p-6"
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="text-xs font-medium tabular-nums text-white/52">
                      {item.number}
                    </span>
                    <Icon icon={item.icon} className="size-5 text-white/72" />
                  </span>
                  <span className="mt-8 block text-base font-semibold">{item.title}</span>
                  <span className="mt-2 block max-w-[280px] text-sm leading-6 text-white/60">
                    {item.description}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

    </main>
  )
}

export default HomePage
