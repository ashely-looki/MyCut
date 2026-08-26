import HotspotPanel from '@/components/HotspotPanel'
import SecondaryPageNavigation from '@/components/SecondaryPageNavigation'
import WorkspacePageHeader from '@/components/WorkspacePageHeader'

/**
 * 查热点全页：从工作台入口进入。
 * 完整流程都在这一页：查热点 → 生成大纲 → 生成文案 → 保存到文案库 / 用这个文案剪视频。
 */
const HotspotPage = () => (
  <main className="min-h-[calc(100svh-3.5rem)] bg-[var(--workspace-background)] px-4 pb-16 pt-6 sm:px-6 lg:px-8 lg:pb-20">
    <div className="mx-auto w-full max-w-[1120px]">
      <SecondaryPageNavigation
        backTo="/"
        backLabel="工作台"
      />

      <WorkspacePageHeader
        eyebrow="选题工具"
        title="AI 查热点"
        description="输入内容领域，筛选值得创作的选题，再继续生成大纲与文案。"
        className="mt-7 min-h-[176px]"
      />

      <HotspotPanel />
    </div>
  </main>
)

export default HotspotPage
