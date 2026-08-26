/**
 * 认证上下文
 *
 * 用 Supabase 管理邮箱+密码的注册/登录/会话。整个应用通过 useAuth() 读取
 * 当前用户、会话，以及登录/注册/登出方法。
 *
 * 关键点：
 * - access_token 由 authTokenStore 单独缓存一份，供 axios 请求拦截器同步读取
 *   （拦截器不方便用 React hook 拿 token）。
 * - 未配置 Supabase（authEnabled=false）时，直接视为「已登录的本地用户」，
 *   不挡任何页面，与后端 AUTH_ENABLED=false 对应。
 */

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { toast } from 'sonner'
import { supabase, authEnabled, authRedirectUrl } from '../lib/supabase'
import { consumeAuthCallback } from '../lib/auth-callback'
import { setAuthToken } from './authTokenStore'
import { adminApi } from '../services/api'

interface AuthContextValue {
  /** 是否启用了登录（Supabase 已配置）。false 时应用不挡登录门。 */
  authEnabled: boolean
  /** 认证状态是否还在初始化（读取本地会话中）。 */
  loading: boolean
  user: User | null
  session: Session | null
  /** 当前登录者是否是管理员（后端 ADMIN_EMAILS 白名单判定）。决定 /admin 入口是否显示。 */
  isAdmin: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<{ needsEmailConfirm: boolean }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState<boolean>(authEnabled)
  const [isAdmin, setIsAdmin] = useState<boolean>(false)

  useEffect(() => {
    if (!authEnabled || !supabase) {
      setLoading(false)
      return
    }

    let cancelled = false

    const bootstrap = async () => {
      // 1) 先消费邮件链接带回来的凭证（邮箱确认 / 找回密码），否则用户点完确认链接仍是未登录
      const callback = await consumeAuthCallback()
      if (callback?.kind === 'signed-in') {
        toast.success(callback.type === 'recovery' ? '验证通过，请设置新密码' : '邮箱确认成功')
      } else if (callback?.kind === 'error') {
        toast.error(callback.message ?? '邮件链接验证失败')
      }

      // 2) 读取已持久化的会话
      const { data } = await supabase!.auth.getSession()
      if (cancelled) return
      setSession(data.session)
      setUser(data.session?.user ?? null)
      setAuthToken(data.session?.access_token ?? null)
      setLoading(false)
    }
    void bootstrap()

    // 3) 订阅登录/登出/刷新 token 事件，保持 token 缓存与状态同步
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      setUser(newSession?.user ?? null)
      setAuthToken(newSession?.access_token ?? null)
    })

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [])

  // 判定当前登录者是否管理员：token 变化后问一次后端（whoami 不鉴权、不抛错）。
  // 未配置登录（authEnabled=false）时不查，直接非管理员——本地单人模式没有后台入口。
  useEffect(() => {
    if (!authEnabled) {
      setIsAdmin(false)
      return
    }
    const token = session?.access_token
    if (!token) {
      setIsAdmin(false)
      return
    }
    let cancelled = false
    adminApi
      .whoami()
      .then((res) => {
        if (!cancelled) setIsAdmin(!!res.is_admin)
      })
      .catch(() => {
        if (!cancelled) setIsAdmin(false)
      })
    return () => {
      cancelled = true
    }
  }, [session?.access_token])

  const signIn = async (email: string, password: string) => {
    if (!supabase) throw new Error('未配置登录服务')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  const signUp = async (email: string, password: string) => {
    if (!supabase) throw new Error('未配置登录服务')
    // emailRedirectTo 必须传：不传的话确认邮件里的链接会跳去后台配的 Site URL
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: authRedirectUrl() },
    })
    if (error) throw error
    // 若 Supabase 后台开启了邮箱确认，signUp 不会立即返回 session，
    // 需要用户去邮箱点确认链接后才能登录。
    const needsEmailConfirm = !data.session
    return { needsEmailConfirm }
  }

  const signOut = async () => {
    if (!supabase) return
    await supabase.auth.signOut()
    setAuthToken(null)
  }

  const value = useMemo<AuthContextValue>(
    () => ({ authEnabled, loading, user, session, isAdmin, signIn, signUp, signOut }),
    [loading, user, session, isAdmin],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
