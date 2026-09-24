import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useI18n } from '../lib/i18n'
import styles from './Auth.module.css'

export function Auth() {
  const { t, language } = useI18n()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleAuth = async () => {
    setLoading(true)
    setMessage('')
    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setMessage(error.message)
    } else {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setMessage(error.message)
      else setMessage(language === 'zh' ? '请查收邮箱确认注册！' : 'Check your email to confirm signup!')
    }
    setLoading(false)
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>Friday</h1>
        <p className={styles.subtitle}>{language === 'zh' ? '你的 AI 规划助手' : 'Your AI planning partner'}</p>
        <input
          type="email"
          placeholder={t('email')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={styles.input}
        />
        <input
          type="password"
          placeholder={t('password')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={styles.input}
        />
        <button onClick={handleAuth} disabled={loading} className={styles.button}>
          {loading ? '...' : isLogin ? t('signIn') : t('signUp')}
        </button>
        {message && <p className={styles.message}>{message}</p>}
        <button onClick={() => setIsLogin(!isLogin)} className={styles.switch}>
          {isLogin ? t('dontHaveAccount') : t('alreadyHaveAccount')}
        </button>
      </div>
    </div>
  )
}
