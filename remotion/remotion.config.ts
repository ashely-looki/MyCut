import { Config } from '@remotion/cli/config'

// MP4 + H.264，适配大多数播放器
Config.setVideoImageFormat('jpeg')
Config.setCodec('h264')
Config.setConcurrency(null) // 由 Remotion 自动决定并发
