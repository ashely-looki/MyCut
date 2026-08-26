"""Seed realistic local preview content for the MyCut workspace.

The command is intentionally idempotent and only updates records that are
explicitly marked as preview data, plus the old repeated
``成片：MyCut 完整流程体验`` demo rows created by the local walkthrough.
All other projects and scripts are left untouched.

Run from the repository root:

    python -m backend.seed_preview_data
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import NAMESPACE_URL, uuid5

from backend.core.auth import LOCAL_USER_ID
from backend.core.database import SessionLocal
from backend.models.clip import Clip, ClipStatus
from backend.models.collection import Collection, CollectionStatus
from backend.models.project import Project, ProjectStatus, ProjectType
from backend.models.script import Script


PREVIEW_MARKER = "mycut-preview-v1"
LEGACY_DEMO_NAME = "成片：MyCut 完整流程体验"


PROJECT_FIXTURES: list[dict[str, Any]] = [
    {
        "key": "independent-brand-interview",
        "name": "独立品牌访谈：从 0 到 10 万用户",
        "description": "45 分钟创始人访谈，提炼品牌定位、冷启动与复购方法。",
        "project_type": ProjectType.BUSINESS,
        "status": ProjectStatus.COMPLETED,
        "thumbnail": "https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1200&q=82",
        "age_hours": 2,
        "duration": 2684,
        "clips": [
            ("品牌最难的不是设计，而是取舍", "一句话把品牌定位说清楚，观点集中、适合作为开场。"),
            ("第一批一千名用户从哪里来", "包含具体的冷启动路径和可复用的渠道判断。"),
            ("把复购做成内容资产", "从产品复购延伸到内容复购，结论完整且有行动建议。"),
        ],
    },
    {
        "key": "shanghai-city-walk",
        "name": "城市漫游：上海梧桐区的一天",
        "description": "竖屏 Vlog 素材，包含街景、咖啡店、展览与黄昏转场。",
        "project_type": ProjectType.EXPERIENCE,
        "status": ProjectStatus.COMPLETED,
        "thumbnail": "https://images.unsplash.com/photo-1704095981825-df894149bb6b?auto=format&fit=crop&w=1200&q=82",
        "age_hours": 8,
        "duration": 1138,
        "clips": [
            ("早晨九点的武康路", "环境声干净，人物入画自然，适合作为路线开篇。"),
            ("藏在老洋房里的小展览", "空间变化丰富，细节镜头能建立城市漫游氛围。"),
            ("日落前的安福路街角", "光线和人物节奏完整，适合作为情绪收束。"),
        ],
    },
    {
        "key": "ai-recorder-review",
        "name": "新品上手：AI 随身录音笔真实体验",
        "description": "数码测评素材，覆盖外观、降噪、转写准确率和三天使用结论。",
        "project_type": ProjectType.CONTENT_REVIEW,
        "status": ProjectStatus.COMPLETED,
        "thumbnail": "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=82",
        "age_hours": 27,
        "duration": 1542,
        "clips": [
            ("它解决的不是录音，而是整理", "开场反差明确，快速建立产品真正的使用价值。"),
            ("地铁和咖啡店的降噪实测", "真实场景对比充分，信息密度高且便于加字幕。"),
            ("连续用了三天后的结论", "优缺点平衡，适合作为购买建议和结尾。"),
        ],
    },
    {
        "key": "information-anxiety",
        "name": "知识口播：摆脱信息焦虑的 3 个方法",
        "description": "桌面口播录制，围绕信息筛选、输入节奏和个人知识库展开。",
        "project_type": ProjectType.KNOWLEDGE,
        "status": ProjectStatus.COMPLETED,
        "thumbnail": "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=82",
        "age_hours": 50,
        "duration": 786,
        "clips": [
            ("你缺的不是信息，而是筛选标准", "问题定义清楚，前五秒具备较强停留点。"),
            ("把收藏夹改成待办清单", "方法具体，可直接拆成步骤字幕和屏幕演示。"),
            ("每周只保留一个输入主题", "结论简单可执行，适合形成系列内容。"),
        ],
    },
    {
        "key": "rate-cut-finance",
        "name": "财经解读：降息后普通人的资产配置",
        "description": "宏观财经直播回放，整理现金流、债券与权益资产的配置逻辑。",
        "project_type": ProjectType.OPINION,
        "status": ProjectStatus.COMPLETED,
        "thumbnail": "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=1200&q=82",
        "age_hours": 76,
        "duration": 3225,
        "clips": [
            ("降息不等于所有资产都会涨", "纠正常见误区，适合作为观点型视频开头。"),
            ("先算清楚六个月现金流", "风险提示明确，给出普通人可执行的底线。"),
            ("配置比例要跟着目标走", "用三个生活目标解释配置差异，表达完整。"),
        ],
    },
    {
        "key": "midnight-bakery",
        "name": "探店短片：深夜面包房的 48 小时",
        "description": "纪录式探店素材，从凌晨备料到第一炉面包出炉。",
        "project_type": ProjectType.EXPERIENCE,
        "status": ProjectStatus.COMPLETED,
        "thumbnail": "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=82",
        "age_hours": 103,
        "duration": 1840,
        "clips": [
            ("凌晨两点，面包房刚刚开灯", "时间反差强，环境细节能迅速建立纪录片质感。"),
            ("一块面团要经过十二次折叠", "制作过程有动作连续性，适合节奏型剪辑。"),
            ("第一炉出炉时，街道还没醒", "声音和画面都有自然收束，适合作为结尾。"),
        ],
    },
    {
        "key": "fashion-behind-scenes",
        "name": "品牌短片：春夏系列幕后花絮",
        "description": "棚拍幕后素材，正在完成镜头筛选、节奏匹配和字幕校对。",
        "project_type": ProjectType.ENTERTAINMENT,
        "status": ProjectStatus.PROCESSING,
        "thumbnail": "https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=1200&q=82",
        "age_hours": 0.5,
        "duration": 967,
        "clips": [],
    },
    {
        "key": "product-launch-replay",
        "name": "直播回放：新品发布会重点速剪",
        "description": "发布会双机位回放，音轨校验未通过，等待重新连接素材。",
        "project_type": ProjectType.SPEECH,
        "status": ProjectStatus.FAILED,
        "thumbnail": "https://images.unsplash.com/photo-1505373877841-8d25f7d46678?auto=format&fit=crop&w=1200&q=82",
        "age_hours": 126,
        "duration": 4048,
        "clips": [],
    },
]


SCRIPT_FIXTURES: list[dict[str, Any]] = [
    {
        "key": "ai-meeting-review",
        "title": "为什么越来越多人开始用 AI 做会议复盘？",
        "domain": "AI 效率工具",
        "angle": "不讲功能清单，从会后信息损耗切入真实工作场景",
        "target_audience": "需要频繁开会的产品经理、创业者和内容团队",
        "keywords": ["AI 会议", "效率工具", "知识管理"],
        "style": "专业干货",
        "age_hours": 1,
        "hook": "一场一小时的会，真正被团队记住的内容，往往不到十分钟。",
        "sections": [
            ("先还原决策，不是整理逐字稿", "把结论、负责人和截止时间单独抽出来。"),
            ("让分歧有上下文", "保留为什么没选另一个方案，避免下次重新争论。"),
            ("会后十分钟完成分发", "按角色生成不同摘要，降低阅读成本。"),
        ],
        "cta": "先挑一场重复出现问题的周会测试，你会最先感受到差异。",
        "segments": [
            ("hook", "一场一小时的会，真正被团队记住的内容，往往不到十分钟。", "会议室散场，镜头切到散落的便签与空白会议纪要", 7),
            ("body", "AI 会议复盘最重要的不是把每句话都记下来，而是还原这次会议到底做了哪些决定。", "画面突出决策、负责人、截止时间三个字段", 10),
            ("body", "第二步是保留分歧的上下文：为什么没选另一个方案，下一次就不用从头争论。", "左右分屏展示两个方案，未采用方案淡出", 10),
            ("body", "最后按角色生成不同摘要。负责人看行动项，管理者看风险，协作者只看与自己相关的部分。", "三种角色卡片依次出现", 11),
            ("cta", "先挑一场每周都会开的会测试，十分钟内完成分发，就是最直接的价值。", "回到简洁的行动清单并出现完成勾选", 8),
        ],
    },
    {
        "key": "shanghai-weekend-walk",
        "title": "上海周末散步：从武康路走到安福路",
        "domain": "城市生活",
        "angle": "用半日步行路线串联建筑、咖啡和小型展览",
        "target_audience": "喜欢城市漫游、周末短途出行的年轻人",
        "keywords": ["上海 Citywalk", "武康路", "安福路"],
        "style": "松弛叙事",
        "age_hours": 7,
        "hook": "如果周末只想慢慢走路，这条两公里路线刚刚好。",
        "sections": [
            ("九点从武康大楼出发", "避开人流，先看清晨的建筑光影。"),
            ("中途留四十分钟给小展览", "路线不赶，给临时发现留出空间。"),
            ("在安福路等一场日落", "用街角和梧桐树影结束半日行程。"),
        ],
        "cta": "把路线收藏下来，挑一个晴天慢慢走完。",
        "segments": [
            ("hook", "如果周末只想慢慢走路，这条从武康路到安福路的两公里路线刚刚好。", "清晨街道广角，路线线条轻轻划过地图", 8),
            ("body", "九点从武康大楼出发，这时游客还不多，立面的光影也最干净。", "建筑仰拍与树影特写交替", 9),
            ("body", "沿湖南路向北走，中途挑一家临街咖啡店，别急着把路线塞满。", "手持咖啡、推门和临窗座位细节", 10),
            ("body", "下午留四十分钟给小型展览，最好的城市漫游总要给临时发现一点空间。", "展签、画作局部和观众背影", 11),
            ("cta", "最后在安福路等一场日落。收藏这条路线，挑一个晴天慢慢走完。", "暖色街角收束，出现简洁路线卡片", 9),
        ],
    },
    {
        "key": "desk-setup-budget",
        "title": "预算 3000 元，怎样搭一套舒服的桌面工作区",
        "domain": "数码与效率",
        "angle": "按使用优先级分配预算，不做单纯产品堆砌",
        "target_audience": "居家办公、刚开始升级桌面的上班族",
        "keywords": ["桌面改造", "居家办公", "效率"],
        "style": "实用测评",
        "age_hours": 24,
        "hook": "三千元改造桌面，最不该先买的可能就是显示器。",
        "sections": [
            ("先解决坐姿和光线", "椅子、桌高与照明决定长时间工作的舒适度。"),
            ("再补充输入与收纳", "键鼠和线材管理影响每天的操作摩擦。"),
            ("最后才升级显示设备", "根据工作内容选择尺寸和色彩需求。"),
        ],
        "cta": "先记录一周里最常见的不舒服，再决定第一笔预算花在哪里。",
        "segments": [
            ("hook", "预算三千元改造桌面，最不该先买的，可能就是显示器。", "凌乱桌面快速切换到整洁工作区", 7),
            ("body", "先用一千二解决坐姿：椅子支撑、桌面高度和脚下空间，比参数更直接。", "侧面示意坐姿与桌椅高度", 10),
            ("body", "再用六百元处理光线，一盏不直射屏幕的灯，能明显降低晚上的疲劳感。", "灯光开关前后对比", 9),
            ("body", "剩余预算放在每天都会摸到的键鼠和收纳，最后再看是否真的需要换屏幕。", "键鼠、理线和显示器细节镜头", 11),
            ("cta", "别照着清单买。先记录一周里最常见的不舒服，再决定第一笔钱花在哪里。", "预算清单逐项勾选", 9),
        ],
    },
    {
        "key": "coffee-shop-repeat-rate",
        "title": "一家社区咖啡店，如何把复购做到 60%",
        "domain": "商业案例",
        "angle": "从菜单、店员记忆与社群节奏拆解社区门店复购",
        "target_audience": "小店经营者、本地生活内容创作者",
        "keywords": ["咖啡店经营", "复购", "社区商业"],
        "style": "案例拆解",
        "age_hours": 38,
        "hook": "这家店没有网红装修，却让六成客人一个月内回来第二次。",
        "sections": [
            ("菜单只保留十二款", "减少选择压力，也让出品保持稳定。"),
            ("记住客人的上一次选择", "被识别的体验比折扣更容易形成关系。"),
            ("社群只发今天值得来的理由", "克制频率，保持信息价值。"),
        ],
        "cta": "复购不是多发优惠券，而是让下一次到店变得顺理成章。",
        "segments": [
            ("hook", "这家社区咖啡店没有网红装修，却让六成客人在一个月内回来第二次。", "普通街角门店外景，复购数字简洁出现", 8),
            ("body", "第一个细节是菜单只有十二款。选择更少，出品更稳，店员也更容易给出建议。", "短菜单、制作流程和递杯动作", 10),
            ("body", "第二个细节是记住客人的上一次选择。被识别的体验，往往比九折券更有用。", "店员与熟客对话的自然镜头", 11),
            ("body", "他们的社群也不刷屏，只在新品和天气真正值得来的时候发一条消息。", "手机消息界面与雨天店内镜头", 10),
            ("cta", "复购不是多发优惠券，而是让下一次到店变得顺理成章。", "熟客再次推门，画面定格店招", 8),
        ],
    },
    {
        "key": "information-filter-system",
        "title": "信息焦虑不是因为看得少，而是没有筛选系统",
        "domain": "个人成长",
        "angle": "用输入边界代替无限收藏，建立轻量信息处理流程",
        "target_audience": "长期刷资讯、收藏很多却很少消化的人",
        "keywords": ["信息焦虑", "知识管理", "专注力"],
        "style": "克制观点",
        "age_hours": 54,
        "hook": "你不是错过了重要信息，而是把所有信息都当成重要信息。",
        "sections": [
            ("每周只设一个输入主题", "让注意力有明确边界。"),
            ("收藏必须绑定下一步动作", "没有行动的内容不进入知识库。"),
            ("固定时间清空信息收件箱", "减少未处理内容带来的心理负担。"),
        ],
        "cta": "这周先删掉一个不会再看的收藏夹。",
        "segments": [
            ("hook", "你不是错过了重要信息，而是把所有信息都当成重要信息。", "通知不断叠加，随后全部静音", 7),
            ("body", "先给输入设置边界：每周只关注一个主题，其他内容哪怕很好，也先不展开。", "日历上只保留一个本周主题", 10),
            ("body", "第二，收藏必须绑定下一步动作。没有要写、要试或要分享的内容，就不要进入知识库。", "收藏按钮转成写作、实践、分享三个动作", 11),
            ("body", "最后固定一个时间清空信息收件箱，让未处理内容不再长期占用注意力。", "收件箱从大量未读归零", 9),
            ("cta", "不用再找一套复杂工具。这周先删掉一个你不会再看的收藏夹。", "删除旧收藏夹，画面恢复干净", 8),
        ],
    },
    {
        "key": "skincare-labels",
        "title": "护肤品成分表里，真正值得关注的 3 行字",
        "domain": "生活科普",
        "angle": "避开成分党术语，用使用场景解释有效浓度、刺激源和防腐体系",
        "target_audience": "想理性选择基础护肤品的消费者",
        "keywords": ["护肤成分", "成分表", "理性消费"],
        "style": "温和科普",
        "age_hours": 79,
        "hook": "看懂成分表，不需要背下几十个化学名词。",
        "sections": [
            ("先确认核心成分的位置", "排序能帮助判断宣传成分是否只是点缀。"),
            ("再排查自己的刺激源", "香精、酒精和特定防腐剂需要结合肤质判断。"),
            ("最后看包装与使用周期", "稳定性和开封后的保存方式同样重要。"),
        ],
        "cta": "下一次购买前，把成分表和自己的使用场景放在一起看。",
        "segments": [
            ("hook", "看懂护肤品成分表，不需要背下几十个化学名词。", "成分表快速扫过，画面停在前三行", 7),
            ("body", "第一看核心成分排在哪里。排序越靠后，通常越要谨慎看待夸张的宣传。", "核心成分位置被逐行标记", 10),
            ("body", "第二看你自己的刺激源，而不是跟着别人统一避雷。香精和酒精都要结合肤质与使用场景。", "不同肤质与场景的简洁对照", 12),
            ("body", "第三看包装和使用周期。有些活性成分怕光、怕空气，保存方式会直接影响体验。", "按压泵、避光瓶和开封日期特写", 10),
            ("cta", "下一次购买前，把成分表和自己的使用场景放在一起看，选择会简单很多。", "产品回到干净台面，出现检查清单", 8),
        ],
    },
    {
        "key": "talking-head-shots",
        "title": "第一次拍口播，先把这 4 个镜头拍对",
        "domain": "视频创作",
        "angle": "用最低拍摄成本补足口播剪辑需要的转场和信息镜头",
        "target_audience": "刚开始做短视频的个人创作者和小团队",
        "keywords": ["口播拍摄", "短视频", "镜头语言"],
        "style": "清晰教程",
        "age_hours": 105,
        "hook": "口播不好剪，很多时候不是你说得不够好，而是镜头不够。",
        "sections": [
            ("固定主机位", "保证完整表达和字幕安全区。"),
            ("补一个侧面近景", "用来隐藏删句和语气停顿。"),
            ("拍手部与物品细节", "让抽象观点有可视化支点。"),
            ("录十秒环境空镜", "为开头、转场和结尾留出节奏。"),
        ],
        "cta": "下次开机前先照着这四项拍一遍，剪辑会轻松很多。",
        "segments": [
            ("hook", "口播不好剪，很多时候不是你说得不够好，而是镜头根本不够。", "单一机位卡顿，随后切换到多机位时间线", 8),
            ("body", "第一，固定主机位完整拍完，给字幕留出安全区，也给剪辑保留一条稳定底线。", "正面机位构图与字幕安全框", 10),
            ("body", "第二，补一个侧面近景。删掉重复句和停顿时，它能自然盖住跳切。", "正侧面切换演示一次删句", 10),
            ("body", "第三拍手部和物品细节，最后再录十秒环境空镜，抽象观点就有了画面支点。", "手部、道具和房间空镜依次出现", 12),
            ("cta", "下次开机前先照着这四项拍一遍，你会发现后期轻松很多。", "四项拍摄清单全部勾选", 8),
        ],
    },
]


def _stable_id(kind: str, key: str, index: int | None = None) -> str:
    suffix = f":{index}" if index is not None else ""
    return str(uuid5(NAMESPACE_URL, f"mycut:{PREVIEW_MARKER}:{kind}:{key}{suffix}"))


def _seed_projects(db: Any, now: datetime) -> int:
    all_projects = db.query(Project).all()
    preview_projects = {
        (project.project_metadata or {}).get("preview_seed_key"): project
        for project in all_projects
        if (project.project_metadata or {}).get("preview_marker") == PREVIEW_MARKER
    }
    legacy_projects = [
        project for project in sorted(all_projects, key=lambda item: item.created_at, reverse=True)
        if project.name == LEGACY_DEMO_NAME
    ]

    for fixture in PROJECT_FIXTURES:
        project = preview_projects.get(fixture["key"])
        if project is None and legacy_projects:
            project = legacy_projects.pop(0)
        if project is None:
            project = Project(id=_stable_id("project", fixture["key"]))
            db.add(project)

        created_at = now - timedelta(hours=fixture["age_hours"])
        project.user_id = LOCAL_USER_ID
        project.name = fixture["name"]
        project.description = fixture["description"]
        project.project_type = fixture["project_type"]
        project.status = fixture["status"]
        project.video_duration = fixture["duration"]
        project.video_path = None
        project.subtitle_path = None
        project.thumbnail = fixture["thumbnail"]
        project.processing_config = {
            "video_category": fixture["project_type"].value,
            "preview_marker": PREVIEW_MARKER,
            "progress": 68 if fixture["status"] == ProjectStatus.PROCESSING else 100,
            "error_message": "双机位音轨长度不一致，请重新连接主素材。"
            if fixture["status"] == ProjectStatus.FAILED else None,
        }
        project.project_metadata = {
            "preview_marker": PREVIEW_MARKER,
            "preview_seed_key": fixture["key"],
            "source_duration": fixture["duration"],
        }
        project.created_at = created_at
        project.updated_at = created_at + timedelta(minutes=38)
        project.completed_at = (
            created_at + timedelta(minutes=42)
            if fixture["status"] == ProjectStatus.COMPLETED else None
        )
        db.flush()

        existing_clips = db.query(Clip).filter(Clip.project_id == project.id).order_by(Clip.created_at).all()
        for index, (title, reason) in enumerate(fixture["clips"]):
            clip_id = _stable_id("clip", fixture["key"], index)
            clip = db.query(Clip).filter(Clip.id == clip_id).first()
            if clip is None and index < len(existing_clips):
                clip = existing_clips[index]
            if clip is None:
                clip = Clip(id=clip_id, project_id=project.id)
                db.add(clip)

            start_time = 34 + index * 116
            duration = 32 + index * 4
            clip.project_id = project.id
            clip.title = title
            clip.description = reason
            clip.status = ClipStatus.COMPLETED
            clip.start_time = start_time
            clip.end_time = start_time + duration
            clip.duration = duration
            clip.score = round(9.3 - index * 0.35, 1)
            clip.recommendation_reason = reason
            clip.video_path = None
            clip.thumbnail_path = fixture["thumbnail"]
            clip.tags = [fixture["project_type"].value, "精选片段"]
            clip.clip_metadata = {
                "preview_marker": PREVIEW_MARKER,
                "recommend_reason": reason,
                "outline": title,
                "content": [
                    f"{fixture['name']} 中的核心片段。",
                    reason,
                ],
                "chunk_index": index,
            }
            clip.created_at = created_at + timedelta(minutes=index * 3)
            clip.updated_at = project.updated_at

        if fixture["clips"] and fixture["status"] == ProjectStatus.COMPLETED:
            collection_id = _stable_id("collection", fixture["key"])
            collection = db.query(Collection).filter(Collection.id == collection_id).first()
            if collection is None:
                collection = Collection(id=collection_id, project_id=project.id)
                db.add(collection)

            clip_ids = [_stable_id("clip", fixture["key"], index) for index in range(len(fixture["clips"]))]
            # Legacy demo clips may keep their original id after being reused.
            actual_clips = db.query(Clip).filter(Clip.project_id == project.id).order_by(Clip.start_time).limit(len(fixture["clips"])).all()
            if len(actual_clips) == len(fixture["clips"]):
                clip_ids = [clip.id for clip in actual_clips]

            collection.project_id = project.id
            collection.name = f"{fixture['name']}｜60 秒精华"
            collection.description = "AI 按观点完整度、节奏和画面连续性组合的发布版本。"
            collection.status = CollectionStatus.COMPLETED
            collection.theme = fixture["project_type"].value
            collection.tags = ["AI 推荐", "竖屏成片"]
            collection.total_duration = 60
            collection.clips_count = len(clip_ids)
            collection.thumbnail_path = fixture["thumbnail"]
            collection.collection_metadata = {
                "preview_marker": PREVIEW_MARKER,
                "clip_ids": clip_ids,
                "collection_type": "ai_recommended",
            }
            collection.created_at = project.updated_at
            collection.updated_at = project.updated_at

    return len(PROJECT_FIXTURES)


def _seed_scripts(db: Any, now: datetime) -> int:
    for fixture in SCRIPT_FIXTURES:
        script_id = _stable_id("script", fixture["key"])
        script = db.query(Script).filter(Script.id == script_id).first()
        if script is None:
            script = Script(id=script_id)
            db.add(script)

        sections = [
            {"point": point, "detail": detail}
            for point, detail in fixture["sections"]
        ]
        segments = [
            {
                "index": index + 1,
                "role": role,
                "narration": narration,
                "visual": visual,
                "est_seconds": seconds,
            }
            for index, (role, narration, visual, seconds) in enumerate(fixture["segments"])
        ]
        created_at = now - timedelta(hours=fixture["age_hours"])

        script.user_id = LOCAL_USER_ID
        script.title = fixture["title"]
        script.domain = fixture["domain"]
        script.angle = fixture["angle"]
        script.target_audience = fixture["target_audience"]
        script.keywords = fixture["keywords"]
        script.outline = {
            "hook": fixture["hook"],
            "sections": sections,
            "cta": fixture["cta"],
        }
        script.segments = segments
        script.style = fixture["style"]
        script.est_duration = sum(segment[3] for segment in fixture["segments"])
        script.created_at = created_at
        script.updated_at = created_at + timedelta(minutes=23)

    return len(SCRIPT_FIXTURES)


def main() -> None:
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        project_count = _seed_projects(db, now)
        script_count = _seed_scripts(db, now)
        db.commit()
        print(f"Preview data ready: {project_count} projects, {script_count} scripts")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
