import { useEffect, useState } from 'react'
import { PREMIUM_FEATURES, subscriptionManager, type SubscriptionStatus } from '../lib/stripe'
import { useI18n } from '../lib/i18n'
import type { TranslationKey } from '../lib/i18n'
import styles from './SubscriptionPanel.module.css'

interface SubscriptionPanelProps {
  onClose: () => void
}

/** Single source of truth for the displayed price (F-2). */
const PRICE_LABEL_ZH = '¥28/月'
const PRICE_LABEL_EN = '¥28/mo'

const FEATURE_I18N: Record<string, { name: TranslationKey; description: TranslationKey }> = {
  'ai-advanced': { name: 'featAiAdvancedName', description: 'featAiAdvancedDesc' },
  'ai-replan': { name: 'featAiReplanName', description: 'featAiReplanDesc' },
  'archive-unlimited': { name: 'featArchiveName', description: 'featArchiveDesc' },
  'cloud-sync': { name: 'featSyncName', description: 'featSyncDesc' },
  'priority-support': { name: 'featSupportName', description: 'featSupportDesc' },
}

export function SubscriptionPanel({ onClose }: SubscriptionPanelProps) {
  const { t, language } = useI18n()
  const [status, setStatus] = useState<SubscriptionStatus>(subscriptionManager.getStatus())
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    const unsub = subscriptionManager.subscribe((s) => setStatus(s))
    return () => { unsub() }
  }, [])

  const startCheckout = async () => {
    setLoading(true)
    setMessage(null)
    const result = await subscriptionManager.startCheckout()
    setLoading(false)
    if (result.error) {
      setMessage({ type: 'err', text: result.error })
    } else {
      setMessage({
        type: 'ok',
        text: language === 'zh' ? '已成功升级到 Pro！感谢你的支持。' : 'Welcome to Pro! Thank you for your support.',
      })
    }
  }

  const restore = async () => {
    setLoading(true)
    const ok = await subscriptionManager.restorePurchases()
    setLoading(false)
    setMessage({
      type: ok ? 'ok' : 'err',
      text: ok
        ? (language === 'zh' ? '已恢复 Pro 订阅' : 'Pro subscription restored')
        : (language === 'zh' ? '未找到可用订阅' : 'No active subscription found'),
    })
  }

  const cancel = async () => {
    await subscriptionManager.cancelSubscription()
    setMessage({
      type: 'ok',
      text: language === 'zh' ? '已取消自动续订，当前周期仍可使用 Pro 功能' : 'Auto-renew cancelled; Pro active until end of period',
    })
  }

  const remainingDays = status.expiresAt
    ? Math.max(0, Math.ceil((new Date(status.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <div className={styles.grabber} />
        <button className={styles.closeBtn} onClick={onClose} aria-label={t('close')}>
          ×
        </button>

        <div className={styles.hero}>
          <div className={styles.badge}>Friday · Pro</div>
          <h2 className={styles.title}>
            {status.isActive
              ? (language === 'zh' ? '你正在使用 Pro' : 'You are on Pro')
              : (language === 'zh' ? '升级到 Pro' : 'Upgrade to Pro')}
          </h2>
          <p className={styles.subtitle}>
            {language === 'zh'
              ? '解锁完整 AI 日程规划能力与多设备云端同步。'
              : 'Unlock full AI planning power and multi-device cloud sync.'}
          </p>
          {status.isActive && status.expiresAt ? (
            <p className={styles.expiry}>
              {language === 'zh' ? `订阅有效期剩余 ${remainingDays} 天` : `${remainingDays} days remaining`}
            </p>
          ) : null}
        </div>

        <ul className={styles.featureList}>
          {PREMIUM_FEATURES.map((f) => {
            const labels = FEATURE_I18N[f.id]
            return (
            <li key={f.id} className={`${styles.featureRow} ${f.requiresPremium ? '' : styles.includedFree}`}>
              <div className={styles.featureCheck}>
                {f.requiresPremium ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12l5 5L20 7" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.8">
                    <path d="M5 12l5 5L20 7" />
                  </svg>
                )}
              </div>
              <div className={styles.featureBody}>
                <p className={styles.featureName}>
                  {labels ? t(labels.name) : f.name}
                  {f.requiresPremium ? (
                    <span className={styles.proTag}>Pro</span>
                  ) : (
                    <span className={styles.freeTag}>{language === 'zh' ? '免费' : 'Free'}</span>
                  )}
                </p>
                <p className={styles.featureDesc}>{labels ? t(labels.description) : f.description}</p>
              </div>
            </li>
            )
          })}
        </ul>

        {!status.isActive ? (
          <div className={styles.planCard}>
            <div className={styles.planRow}>
              <div>
                <p className={styles.planName}>Friday Pro</p>
                <p className={styles.planDesc}>{language === 'zh' ? '按月订阅，随时可取消' : 'Monthly, cancel anytime'}</p>
              </div>
              <div className={styles.priceBox}>
                <span className={styles.priceSymbol}>¥</span>
                <span className={styles.price}>28</span>
                <span className={styles.pricePeriod}>/ {language === 'zh' ? '月' : 'mo'}</span>
              </div>
            </div>
            <button className={styles.cta} onClick={startCheckout} disabled={loading}>
              {loading
                ? '...'
                : (language === 'zh' ? `升级到 Pro · ${PRICE_LABEL_ZH}` : `Upgrade to Pro · ${PRICE_LABEL_EN}`)}
            </button>
            <button className={styles.restoreBtn} onClick={restore} disabled={loading}>
              {language === 'zh' ? '恢复购买' : 'Restore Purchases'}
            </button>
          </div>
        ) : (
          <div className={styles.planCard}>
            <div className={styles.planRow}>
              <div>
                <p className={styles.planName}>Friday Pro {language === 'zh' ? '（已订阅）' : '(Active)'}</p>
                <p className={styles.planDesc}>
                  {status.expiresAt
                    ? (language === 'zh' ? `下次续费：${new Date(status.expiresAt).toLocaleDateString()}` : `Renews on ${new Date(status.expiresAt).toLocaleDateString()}`)
                    : ''}
                </p>
              </div>
              <div className={styles.activeDot} />
            </div>
            <button className={styles.cancelSubBtn} onClick={cancel} disabled={loading}>
              {language === 'zh' ? '管理 / 取消订阅' : 'Manage / Cancel Subscription'}
            </button>
            <button className={styles.restoreBtn} onClick={restore} disabled={loading}>
              {language === 'zh' ? '刷新订阅状态' : 'Refresh status'}
            </button>
          </div>
        )}

        {message ? (
          <p className={`${styles.msg} ${message.type === 'ok' ? styles.msgOk : styles.msgErr}`}>
            {message.text}
          </p>
        ) : null}

        <p className={styles.legal}>
          {language === 'zh'
            ? '订阅将通过 Apple / Stripe 账户收取。自动续订可在账户设置中关闭。'
            : 'Charges via your Apple / Stripe account. Auto-renew can be turned off in Account Settings.'}
        </p>
      </div>
    </div>
  )
}
