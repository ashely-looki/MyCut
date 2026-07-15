/**
 * 认证 token 的进程内缓存
 *
 * axios 请求拦截器需要在每次请求时同步拿到当前 access_token，但拦截器不在
 * React 组件里，用不了 hook。所以由 AuthContext 在会话变化时把 token 写到这里，
 * 拦截器同步读取。避免让拦截器每次都 await supabase.auth.getSession()。
 */

let currentToken: string | null = null

export function setAuthToken(token: string | null): void {
  currentToken = token
}

export function getAuthToken(): string | null {
  return currentToken
}
