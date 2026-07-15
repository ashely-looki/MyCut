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
import { supabase, authEnabled } from '../lib/supabase'
import { setAuthToken } from './authTokenStore'

interface AuthContextValue {
  /** 是否启用了登录（Supabase 已配置）。false 时应用不挡登录门。 */
  authEnabled: boolean
  /** 认证状态是否还在初始化（读取本地会话中）。 */
  loading: boolean
  user: User | null
  session: Session | null
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<{ needsEmailConfirm: boolean }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState<boolean>(authEnabled)

  useEffect(() => {
    if (!authEnabled || !supabase) {
      setLoading(false)
      return
    }

    // 1) 读取已持久化的会话
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setUser(data.session?.user ?? null)
      setAuthToken(data.session?.access_token ?? null)
      setLoading(false)
    })

    // 2) 订阅登录/登出/刷新 token 事件，保持 token 缓存与状态同步
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      setUser(newSession?.user ?? null)
      setAuthToken(newSession?.access_token ?? null)
    })

    return () => sub.subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    if (!supabase) throw new Error('未配置登录服务')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  const signUp = async (email: string, password: string) => {
    if (!supabase) throw new Error('未配置登录服务')
    const { data, error } = await supabase.auth.signUp({ email, password })
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
    () => ({ authEnabled, loading, user, session, signIn, signUp, signOut }),
    [loading, user, session],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
