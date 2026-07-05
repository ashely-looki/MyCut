import React from 'react'
import { Button } from 'antd'
import { TopicCard as TopicCardData } from '../services/api'

interface TopicCardProps {
  topic: TopicCardData
  onUse?: (topic: TopicCardData) => void
}

/**
 * 选题卡片 —— 克制专业风（对齐 DESIGN.md）。
 * 近乎全单色，仅用一抹克制蓝做强调（热度条 / 主操作）。
 */
const TopicCard: React.FC<TopicCardProps> = ({ topic, onUse }) => {
  const heatPct = Math.round((topic.heat_score || 0) * 100)

  return (
    <div
      style={{
        background: 'var(--ac-card)',
        border: '1px solid var(--ac-line)',
        borderRadius: '16px',
        padding: '20px',
        boxShadow: 'var(--ac-shadow)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        height: '100%',
      }}
    >
      {/* 标题 + 热度 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--ac-ink)', lineHeight: 1.4 }}>
          {topic.title}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ flex: 1, height: '4px', background: 'var(--ac-line-2)', borderRadius: '999px', overflow: 'hidden' }}>
            <div style={{ width: `${heatPct}%`, height: '100%', background: 'var(--ac-accent)', borderRadius: '999px' }} />
          </div>
          <span style={{ fontSize: '12px', color: 'var(--ac-muted)', minWidth: '54px', textAlign: 'right' }}>
            热度 {heatPct}
          </span>
        </div>
      </div>

      {/* 角度 */}
      {topic.angle && (
        <div style={{ fontSize: '13px', color: 'var(--ac-sub)', lineHeight: 1.6 }}>
          {topic.angle}
        </div>
      )}

      {/* 为什么热 / 人群 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', color: 'var(--ac-muted)' }}>
        {topic.why_hot && <div>🔥 {topic.why_hot}</div>}
        {topic.target_audience && <div>🎯 {topic.target_audience}</div>}
      </div>

      {/* 关键词 */}
      {topic.keywords?.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {topic.keywords.map((kw, i) => (
            <span
              key={i}
              style={{
                fontSize: '11px',
                color: 'var(--ac-sub)',
                background: 'var(--ac-line-2)',
                border: '1px solid var(--ac-line)',
                borderRadius: '999px',
                padding: '2px 10px',
              }}
            >
              {kw}
            </span>
          ))}
        </div>
      )}

      {/* 来源 */}
      {topic.sources?.length > 0 && (
        <div style={{ fontSize: '11px', color: 'var(--ac-muted)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {topic.sources.slice(0, 3).map((src, i) => (
            <a key={i} href={src} target="_blank" rel="noreferrer" style={{ color: 'var(--ac-accent)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {src}
            </a>
          ))}
        </div>
      )}

      {/* 主操作 */}
      <div style={{ marginTop: 'auto', paddingTop: '4px' }}>
        <Button
          type="text"
          onClick={() => onUse?.(topic)}
          style={{
            width: '100%',
            height: '36px',
            borderRadius: '999px',
            border: '1px solid var(--ac-line)',
            background: 'var(--ac-card)',
            color: 'var(--ac-ink)',
            fontSize: '13px',
            fontWeight: 500,
          }}
        >
          用这个选题创作 →
        </Button>
      </div>
    </div>
  )
}

export default TopicCard
