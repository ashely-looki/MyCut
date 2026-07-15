/**
 * Supabase 客户端（前端认证：邮箱 + 密码）
 *
 * 配置来自 Vite 环境变量（打包进前端的公开 key，非机密）：
 *   VITE_SUPABASE_URL       —— 你的 Supabase 项目 URL
 *   VITE_SUPABASE_ANON_KEY  —— 项目的 anon/public key
 * 在 frontend/.env.local 里填（见 .env.example）。
 *
 * 未配置时 supabase 为 null，前端会降级为「不启用登录」——直接进入应用，
 * 与后端 AUTH_ENABLED=false 对应，方便本地调试。
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

// 是否启用登录：只有 URL + anon key 都配置了才启用
export const authEnabled = Boolean(supabaseUrl && supabaseAnonKey)

export const supabase: SupabaseClient | null = authEnabled
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false, // HashRouter 环境，避免与路由 hash 冲突
      },
    })
  : null
