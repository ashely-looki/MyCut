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
        // HashRouter 环境，避免与路由 hash 冲突；邮件链接回跳由 lib/auth-callback.ts 接管
        detectSessionInUrl: false,
      },
    })
  : null

/**
 * 邮件确认链接点开后应该回到哪个地址。
 *
 * 不传这个参数时，Supabase 会用后台配置的 Site URL——本地开发期它常年是
 * http://localhost:3000，线上注册的用户点开确认邮件就落到一个打不开的地址（白屏）。
 * 所以这里按当前站点的 origin 动态给出，本地和线上各回各自的域名。
 *
 * 注意：给出的地址必须同时出现在 Supabase 后台 Authentication → URL Configuration 的
 * Redirect URLs 白名单里，否则 Supabase 会忽略它、退回 Site URL。
 * 需要写死时用 VITE_AUTH_REDIRECT_URL 覆盖。
 */
export function authRedirectUrl(): string | undefined {
  const configured = import.meta.env.VITE_AUTH_REDIRECT_URL as string | undefined
  if (configured) return configured
  if (typeof window === 'undefined') return undefined
  // Tauri 桌面端 origin 不是 http(s)，回跳没有意义，交回 Site URL 处理
  if (!/^https?:$/.test(window.location.protocol)) return undefined
  return `${window.location.origin}${window.location.pathname}`
}
