"""文案模型（阶段2/3 的选题→大纲→分镜文案，持久化）。

工作流：热点→生成文案→保存→(去拍)→从文案列表「用它剪视频」→上传自动关联。
文案需要跨会话保存，故落库。
"""

from sqlalchemy import Column, String, Integer, Text, JSON

from .base import BaseModel


class Script(BaseModel):
    """保存的文案。"""

    __tablename__ = "scripts"

    title = Column(String(255), nullable=False, comment="选题标题")
    domain = Column(String(255), nullable=True, comment="领域方向")
    angle = Column(Text, nullable=True, comment="切入角度")
    target_audience = Column(String(255), nullable=True, comment="目标观众")
    keywords = Column(JSON, nullable=True, comment="关键词数组")

    # 大纲 {hook, sections[], cta}
    outline = Column(JSON, nullable=True, comment="大纲 JSON")
    # 分镜文案 [{index, role, narration, visual, est_seconds}]
    segments = Column(JSON, nullable=True, comment="分镜文案数组 JSON")

    style = Column(String(50), nullable=True, comment="文案风格")
    est_duration = Column(Integer, nullable=True, comment="目标时长(秒)")
