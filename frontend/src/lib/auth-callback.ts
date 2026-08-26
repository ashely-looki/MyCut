/**
 * 处理 Supabase 邮件链接的回跳（邮箱确认 / 找回密码 / magic link）。
 *
 * 应用用的是 HashRouter，所以 supabase client 关掉了 detectSessionInUrl（见 lib/supabase.ts），
 * 否则 SDK 会和路由争抢 location.hash。代价是邮件链接带回来的
 * `#access_token=...&refresh_token=...` 没人消费：用户点完确认链接落在一个不匹配任何路由的
 * hash 上（白屏），而且并没有真的登录。这里把这一环补上，分两步：
 *
 * 1. captureAuthCallback()：在 React 挂载前同步执行，把 hash / query 里的凭证抄下来，
 *    并立刻把地址复位成 `#/`，这样 HashRouter 从一开始就拿到正常路由。
 * 2. consumeAuthCallback()：AuthProvider 初始化时调用，把抄下来的凭证交给 supabase 换成会话。
 */

import { supabase } from './supabase'

/** 邮件回跳里可能出现的字段，命中任意一个就认为这是一次 auth 回调。 */
const CALLBACK_KEYS = [
  'access_token',
  'refresh_token',
  'error',
  'error_code',
  'error_description',
  'code',
] as const

export interface AuthCallbackResult {
  kind: 'signed-in' | 'error'
  /** Supabase 给的回调类型：signup / recovery / invite / magiclink 等。 */
  type: string | null
  message?: string
}

let captured: URLSearchParams | null = null

function parseCandidate(raw: string): URLSearchParams | null {
  if (!raw) return null
  const params = new URLSearchParams(raw)
  return CALLBACK_KEYS.some((key) => params.has(key)) ? params : null
}

/** 同步抄走并清掉 URL 里的回调参数。必须在渲染 HashRouter 之前调用。 */
export function captureAuthCallback(): void {
  if (typeof window === 'undefined') return

  const hash = window.location.hash.replace(/^#/, '')
  // hash 以 / 开头的是正常的应用路由（HashRouter），不是回调
  const fromHash = hash.startsWith('/') ? null : parseCandidate(hash)
  const fromSearch = parseCandidate(window.location.search.replace(/^\?/, ''))
  const params = fromHash ?? fromSearch
  if (!params) return

  captured = params
  const { origin, pathname } = window.location
  window.history.replaceState(null, '', `${origin}${pathname}#/`)
}

/** 把抄下来的凭证换成会话。没有回调时返回 null。 */
export async function consumeAuthCallback(): Promise<AuthCallbackResult | null> {
  const params = captured
  captured = null
  if (!params || !supabase) return null

  const type = params.get('type')

  const description = params.get('error_description') ?? params.get('error')
  if (description) {
    return { kind: 'error', type, message: friendlyError(description, params.get('error_code')) }
  }

  const accessToken = params.get('access_token')
  const refreshToken = params.get('refresh_token')
  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    })
    return error ? { kind: 'error', type, message: error.message } : { kind: 'signed-in', type }
  }

  // PKCE 流程回跳的是 ?code=...，虽然当前 client 用的是默认的 implicit，一并兜住
  const code = params.get('code')
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    return error ? { kind: 'error', type, message: error.message } : { kind: 'signed-in', type }
  }

  return null
}

function friendlyError(description: string, code: string | null): string {
  if (code === 'otp_expired' || /expired/i.test(description)) {
    return '邮件链接已失效，请重新注册以获取新的确认邮件'
  }
  if (code === 'access_denied') {
    return '邮件链接无效，请重新发送确认邮件'
  }
  return description
}
