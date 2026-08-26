import type { Outline, ScriptSegment, TopicCard } from '@/services/api'

export const CONTENT_CREATION_DEMO_TOPICS: TopicCard[] = [
  {
    id: 'demo-ai-workflow',
    title: '别再堆 AI 工具了：真正省时间的是这套内容工作流',
    angle: '从“工具越多效率越高”的误区切入，拆解选题、写作和成片之间应该如何衔接。',
    why_hot: 'AI 工具数量持续增长，但创作者更关心的是如何减少重复操作并稳定交付。',
    target_audience: '需要稳定更新短视频的个人创作者、品牌内容团队和新媒体运营。',
    keywords: ['AI 工作流', '内容效率', '短视频创作'],
    heat_score: 0.94,
    sources: [],
  },
  {
    id: 'demo-meeting-review',
    title: '为什么越来越多团队开始用 AI 做会议复盘？',
    angle: '不讨论逐字转写，而是聚焦怎样把一小时会议压缩成真正能推动执行的三类信息。',
    why_hot: '混合办公让会议数量增加，团队开始重新审视记录、同步和执行之间的损耗。',
    target_audience: '管理者、产品团队、项目负责人，以及经常参加跨部门会议的人。',
    keywords: ['会议复盘', '团队协作', 'AI 效率'],
    heat_score: 0.91,
    sources: [],
  },
  {
    id: 'demo-creator-growth',
    title: '流量越来越贵，内容创作者还能抓住哪三个增长机会？',
    angle: '从存量竞争出发，分析垂直内容、系列化表达和多平台复用三个低成本机会。',
    why_hot: '平台分发逻辑趋于成熟，创作者从追逐单次爆款转向构建可持续的内容资产。',
    target_audience: '正在冷启动或遇到增长瓶颈的知识类、商业类内容创作者。',
    keywords: ['内容增长', '账号定位', '系列化'],
    heat_score: 0.88,
    sources: [],
  },
  {
    id: 'demo-solo-team',
    title: '一人团队如何在一天内完成选题、文案和短视频？',
    angle: '用一条完整生产链路说明如何把判断留给人，把资料整理和重复执行交给 AI。',
    why_hot: '越来越多小团队希望在不增加人力的情况下提升内容产量和更新稳定性。',
    target_audience: '自由职业者、独立开发者、小型品牌主理人和一人内容团队。',
    keywords: ['一人团队', '内容生产', '自动化'],
    heat_score: 0.86,
    sources: [],
  },
  {
    id: 'demo-ai-sameness',
    title: 'AI 内容越来越像，真正稀缺的为什么是“判断力”？',
    angle: '从同质化内容现象切入，解释选题取舍、观点密度和个人经验如何建立差异。',
    why_hot: '生成门槛降低后，内容数量快速增加，用户对套路化表达的敏感度也在上升。',
    target_audience: '使用 AI 辅助写作，但担心内容失去辨识度的创作者和编辑。',
    keywords: ['内容同质化', '创作者判断', '个人表达'],
    heat_score: 0.83,
    sources: [],
  },
]

export const createContentCreationDemoOutline = (title: string): Outline => ({
  hook: `你可能已经收藏了十几个 AI 工具，但“${title}”真正要解决的，从来不是工具不够多，而是每一步都在重新开始。`,
  sections: [
    {
      point: '先固定创作链路，再选择工具',
      detail: '把工作拆成确定选题、明确角度、组织大纲、生成分镜和交付成片五个阶段。工具只负责其中一个动作，流程负责让结果连续。',
    },
    {
      point: '把重复整理交给 AI，把关键判断留给人',
      detail: 'AI 可以整理资料、扩写结构和生成画面建议；创作者需要决定什么值得讲、从哪个角度讲，以及哪些内容应该删掉。',
    },
    {
      point: '用同一份内容资产贯穿到成片',
      detail: '大纲、口播和分镜保持一一对应，任何修改都能沿着同一条链路继续，不再在多个页面和文档之间反复复制。',
    },
  ],
  cta: '先别急着再找一个新工具，试着把你现在的创作过程写成四步，再找出最重复、最适合自动化的那一步。',
})

export const createContentCreationDemoSegments = (outline: Outline): ScriptSegment[] => {
  const bodyNarrations = [
    '第一步不是打开某个 AI，而是先把创作链路固定下来：确定选题、明确角度、组织大纲、生成分镜，最后交付成片。工具会变，但这条链路不会。',
    '第二步，把资料整理、结构扩写和画面建议交给 AI，把真正影响内容质量的判断留给自己：什么值得讲，为什么现在讲，以及哪些内容必须删掉。',
    '第三步，让同一份内容资产一直走到成片。大纲里的每个要点，都对应一段口播和一个画面建议，修改时不再来回复制，也不会丢掉上下文。',
  ]

  const bodyVisuals = [
    '俯视桌面，多个工具窗口快速切换后收拢为一条清晰的四阶段流程；简洁信息图动效。',
    '左右分屏：左侧 AI 自动整理资料，右侧创作者删改重点句；突出“AI 执行 / 人做判断”。',
    '大纲卡片依次连到口播、分镜与视频时间线，节点之间以流动线条连接。',
  ]

  return [
    {
      index: 1,
      role: 'hook',
      narration: outline.hook,
      visual: '快速掠过堆叠的 AI 工具图标，画面突然暂停，只保留一条干净的创作流程线。',
      est_seconds: 8,
    },
    ...outline.sections.map((section, index) => ({
      index: index + 2,
      role: 'body' as const,
      narration: bodyNarrations[index] || `${section.point}。${section.detail}`,
      visual: bodyVisuals[index] || `围绕“${section.point}”设计简洁的信息动画和场景演示。`,
      est_seconds: 12,
    })),
    {
      index: outline.sections.length + 2,
      role: 'cta',
      narration: outline.cta,
      visual: '镜头回到创作者的工作台，屏幕上出现四步流程清单，最后停在“开始创作”按钮。',
      est_seconds: 8,
    },
  ]
}
