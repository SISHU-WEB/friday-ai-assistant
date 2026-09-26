import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useI18n } from '../lib/i18n'
import { subscriptionManager } from '../lib/stripe'
import styles from './Auth.module.css'

interface AuthProps {
  onGuest: () => void
}

export function Auth({ onGuest }: AuthProps) {
  const { t, language } = useI18n()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [magicalLoading, setMagicalLoading] = useState(false)
  const [forgotMode, setForgotMode] = useState(false)

  const setMsg = (type: 'ok' | 'err', text: string) => setMessage({ type, text })

  const validate = () => {
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setMsg('err', language === 'zh' ? '请输入有效的邮箱地址' : 'Please enter a valid email')
      return false
    }
    if (!forgotMode && password.length < 6) {
      setMsg('err', language === 'zh' ? '密码至少 6 位' : 'Password must be at least 6 characters')
      return false
    }
    return true
  }

  const handleAuth = async () => {
    if (!validate()) return
    setLoading(true)
    setMessage(null)
    try {
      if (forgotMode) {
        const { error } = await supabase.auth.resetPasswordForEmail(email)
        if (error) throw error
        setMsg('ok', language === 'zh' ? '重置密码链接已发送至邮箱' : 'Password reset link sent to your email')
        setForgotMode(false)
      } else if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        setMsg('ok', language === 'zh' ? '登录成功！正在同步你的数据...' : 'Signed in! Syncing your data...')
        setMagicalLoading(true)
        subscriptionManager.restorePurchases().catch(() => {})
        // Remote data is pulled by App's login reconciliation effect — no
        // local-state merging here (F-4).
        setTimeout(() => setMagicalLoading(false), 900)
      } else {
        const { error, data } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        })
        if (error) throw error
        if (data.session) {
          setMsg('ok', language === 'zh' ? '注册并登录成功！' : 'Welcome to Friday!')
        } else {
          setMsg('ok', language === 'zh' ? '请查收邮箱确认注册后登录！' : 'Check your email to confirm signup, then sign in.')
          setIsLogin(true)
        }
      }
    } catch (err) {
      const msg = (err as Error).message
      if (msg.includes('Invalid login credentials')) {
        setMsg('err', language === 'zh' ? '邮箱或密码错误' : 'Invalid email or password')
      } else if (msg.includes('already registered')) {
        setMsg('err', language === 'zh' ? '该邮箱已注册，请直接登录' : 'Email already registered — please sign in')
        setIsLogin(true)
      } else {
        setMsg('err', msg)
      }
    } finally {
      setLoading(false)
    }
  }

  const continueAsGuest = () => {
    onGuest()
  }

  return (
    <div className={styles.container}>
      <div className={styles.ambient} aria-hidden="true" />
      <div className={`${styles.card} ${magicalLoading ? styles.loadingCard : ''}`}>
        <div className={styles.logoRow}>
          <div className={styles.logoIcon}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a7 7 0 00-7 7v3a5 5 0 005 5h4a5 5 0 005-5V9a7 7 0 00-7-7z" />
              <path d="M9 19v1a3 3 0 006 0v-1" />
            </svg>
          </div>
          <div>
            <h1 className={styles.title}>Friday</h1>
            <p className={styles.subtitle}>
              {language === 'zh' ? '你的 AI 日程规划伙伴' : 'Your AI planning partner'}
            </p>
          </div>
        </div>

        <p className={styles.sectionTitle}>
          {forgotMode
            ? (language === 'zh' ? '重置密码' : 'Reset password')
            : isLogin
            ? (language === 'zh' ? '欢迎回来' : 'Welcome back')
            : (language === 'zh' ? '创建你的 Friday 账户' : 'Create your Friday account')}
        </p>

        <label className={styles.fieldLabel}>
          {language === 'zh' ? '邮箱地址' : 'Email'}
        </label>
        <input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            setMessage(null)
          }}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAuth() }}
          className={styles.input}
          autoComplete="email"
        />

        {!forgotMode ? (
          <>
            <label className={styles.fieldLabel}>
              {language === 'zh' ? '密码' : 'Password'}
            </label>
            <input
              type="password"
              placeholder={t('password')}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setMessage(null)
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAuth() }}
              className={styles.input}
              autoComplete={isLogin ? 'current-password' : 'new-password'}
            />
          </>
        ) : null}

        <button
          onClick={handleAuth}
          disabled={loading || magicalLoading}
          className={styles.button}
        >
          {magicalLoading ? (
            <span className={styles.magicalSpinner} />
          ) : loading ? (
            '...'
          ) : forgotMode ? (
            language === 'zh' ? '发送重置链接' : 'Send reset link'
          ) : isLogin ? (
            t('signIn')
          ) : (
            t('signUp')
          )}
        </button>

        {message ? (
          <p className={`${styles.message} ${message.type === 'ok' ? styles.messageOk : styles.messageErr}`}>
            {message.text}
          </p>
        ) : null}

        <div className={styles.linkRow}>
          {isLogin && !forgotMode ? (
            <button className={styles.link} onClick={() => setForgotMode(true)}>
              {language === 'zh' ? '忘记密码？' : 'Forgot password?'}
            </button>
          ) : forgotMode ? (
            <button className={styles.link} onClick={() => setForgotMode(false)}>
              {language === 'zh' ? '← 返回登录' : '← Back to sign in'}
            </button>
          ) : null}
        </div>

        {!forgotMode ? (
          <button
            onClick={() => {
              setIsLogin(!isLogin)
              setMessage(null)
            }}
            className={styles.switch}
          >
            {isLogin ? t('dontHaveAccount') : t('alreadyHaveAccount')}
          </button>
        ) : null}

        <div className={styles.divider}>
          <span />
          <em>{language === 'zh' ? '或' : 'or'}</em>
          <span />
        </div>

        <button className={styles.guestBtn} onClick={continueAsGuest}>
          {language === 'zh' ? '稍后再登录（本地模式）' : 'Continue later (local mode)'}
        </button>

        <p className={styles.legal}>
          {language === 'zh'
            ? '继续即代表你同意服务条款与隐私政策。数据使用 Supabase 加密存储。'
            : 'By continuing you agree to our Terms & Privacy. Data is stored securely via Supabase.'}
        </p>
      </div>
    </div>
  )
}

