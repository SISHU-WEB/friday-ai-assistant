import { useRef, useState, useEffect } from 'react'
import { useI18n } from '../lib/i18n'
import type { TranslationKey } from '../lib/i18n'
import { subscriptionManager, type SubscriptionStatus } from '../lib/stripe'
import { syncManager } from '../lib/sync'
import { SubscriptionPanel } from './SubscriptionPanel'
import { getServerUrl, setServerUrl, serverHealth, serverFetch, DEFAULT_SERVER_URL } from '../lib/serverApi'
import { useServerAuth } from '../hooks/useServerAuth'
import styles from './SettingsPanel.module.css'

interface SettingsPanelProps {
  onClose: () => void
  onExport: () => void
  onImport: (file: File) => void
  onClearData: () => void
  taskCount: number
  archiveCount: number
  onSignOut?: () => void
  onSignIn?: () => void
  userEmail?: string
}

interface ModelOption {
  value: string
  label: string
  hintKey?: TranslationKey
}

const MODEL_GROUPS: Array<{ groupKey: TranslationKey; options: ModelOption[] }> = [
  {
    groupKey: 'ogDeepSeek',
    options: [
      { value: 'deepseek-chat', label: 'DeepSeek V3 / 4.1 (deepseek-chat)', hintKey: 'modelRecommended' },
      { value: 'deepseek-reasoner', label: 'DeepSeek R1', hintKey: 'modelReasoning' },
    ],
  },
  {
    groupKey: 'ogOpenAI',
    options: [
      { value: 'gpt-4o-mini', label: 'GPT-4o Mini', hintKey: 'modelFastCheap' },
      { value: 'gpt-4o', label: 'GPT-4o', hintKey: 'modelSmart' },
      { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
      { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo', hintKey: 'modelCheapest' },
    ],
  },
  {
    groupKey: 'ogAnthropic',
    options: [
      { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
      { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku', hintKey: 'modelFast' },
    ],
  },
  {
    groupKey: 'ogChinese',
    options: [
      { value: 'moonshot-v1-8k', label: 'Kimi 8K', hintKey: 'providerMoonshot' },
      { value: 'moonshot-v1-32k', label: 'Kimi 32K', hintKey: 'modelLongContext' },
      { value: 'qwen-turbo', label: '通义千问 Turbo', hintKey: 'providerAlibaba' },
      { value: 'qwen-plus', label: '通义千问 Plus', hintKey: 'providerAlibaba' },
      { value: 'glm-4-flash', label: '智谱 GLM-4 Flash' },
      { value: 'glm-4', label: '智谱 GLM-4' },
    ],
  },
]

const API_KEY_PLACEHOLDERS: Record<string, string> = {
  glm: 'xxx.xxx',
  ernie: 'bce-...',
  claude: 'sk-ant-...',
}

export function SettingsPanel({ onClose, onExport, onImport, onClearData, taskCount, archiveCount, onSignOut, onSignIn, userEmail }: SettingsPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { language, setLanguage, t } = useI18n()
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('gpt-4o-mini')
  const [baseUrl, setBaseUrl] = useState('')
  const [subStatus, setSubStatus] = useState<SubscriptionStatus>(subscriptionManager.getStatus())
  const [showSub, setShowSub] = useState(false)
  const [syncState, setSyncState] = useState(syncManager.getStatus())
  const server = useServerAuth()
  const [serverUrlInput, setServerUrlInput] = useState(getServerUrl())
  const [serverEmail, setServerEmail] = useState('')
  const [serverPassword, setServerPassword] = useState('')
  const [serverOnline, setServerOnline] = useState<boolean | null>(null)

  useEffect(() => {
    setApiKey(localStorage.getItem('friday-openai-key') || '')
    setModel(localStorage.getItem('friday-ai-model') || 'gpt-4o-mini')
    setBaseUrl(localStorage.getItem('friday-ai-base-url') || '')
  }, [])

  useEffect(() => {
    const unsub = subscriptionManager.subscribe((s) => setSubStatus(s))
    return () => { unsub() }
  }, [])
  useEffect(() => {
    const unsub = syncManager.subscribe(() => setSyncState(syncManager.getStatus()))
    return () => { unsub() }
  }, [])

  useEffect(() => {
    let cancelled = false
    serverHealth().then((ok) => { if (!cancelled) setServerOnline(ok) })
    return () => { cancelled = true }
  }, [serverUrlInput])

  // GDPR: download a JSON export of everything the server holds for this user.
  const exportServerData = async () => {
    const res = await serverFetch('/v1/me/export')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'friday-export.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  // GDPR right to erasure: password confirmation, then full server-side delete.
  const deleteServerAccount = async () => {
    const password = window.prompt(t('serverDeleteConfirm'))
    if (!password) return
    try {
      await serverFetch('/v1/me', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      await server.logout()
    } catch (e) {
      window.alert((e as Error).message)
    }
  }

  const saveApiKey = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setApiKey(val)
    localStorage.setItem('friday-openai-key', val)
  }

  const saveModel = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    setModel(val)
    localStorage.setItem('friday-ai-model', val)
  }

  const saveBaseUrl = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setBaseUrl(val)
    localStorage.setItem('friday-ai-base-url', val)
  }

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setLanguage(e.target.value as 'en' | 'zh')
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) onImport(file)
    e.target.value = ''
  }

  const providerName = model.startsWith('deepseek')
    ? 'DeepSeek'
    : model.startsWith('moonshot')
    ? 'Kimi'
    : model.startsWith('qwen')
    ? '通义千问'
    : model.startsWith('glm')
    ? '智谱'
    : model.startsWith('ernie')
    ? '文心一言'
    : model.startsWith('claude')
    ? 'Claude'
    : 'OpenAI'
  const apiKeyPlaceholder = API_KEY_PLACEHOLDERS[Object.keys(API_KEY_PLACEHOLDERS).find((prefix) => model.startsWith(prefix)) ?? ''] ?? 'sk-...'

  const syncLabel =
    syncState.status === 'syncing'
      ? t('syncing')
      : syncState.status === 'error'
      ? t('syncFailed')
      : syncState.lastSyncAt
      ? t('syncedAt', { time: new Date(syncState.lastSyncAt).toLocaleTimeString(language === 'zh' ? 'zh-CN' : undefined, { hour: '2-digit', minute: '2-digit' }) })
      : t('autoSync')

  return (
    <section className={`${styles.panel}${showSub ? ` ${styles.subOpen}` : ''}`} aria-label={t('settings')}>
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>{t('settingsEyebrow')}</p>
          <h2>{t('settings')}</h2>
        </div>
        <button className={styles.closeBtn} onClick={onClose} aria-label={t('closeSettings')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className={styles.section}>
        <h3>{t('account')}</h3>
        {userEmail ? (
          <div className={styles.accountRow}>
            <div className={styles.avatar}>{userEmail[0]?.toUpperCase() || 'U'}</div>
            <div className={styles.accountBody}>
              <p className={styles.accountEmail}>{userEmail}</p>
              <p className={styles.accountPlan}>
                {subStatus.isActive ? t('proPremiumBadge') : t('freePlan')}
              </p>
            </div>
            <button className={styles.subCta} onClick={() => setShowSub(true)}>
              {subStatus.isActive ? t('manage') : t('upgrade')}
            </button>
          </div>
        ) : null}
        <div className={styles.syncRow}>
          <span className={`${styles.syncDot} ${syncState.status === 'syncing' ? styles.syncDotSyncing : ''} ${syncState.status === 'error' ? styles.syncDotError : ''}`} />
          <span className={styles.syncText}>{syncLabel}</span>
        </div>
        {onSignOut && userEmail ? (
          <button className={styles.secondaryBtn + ' ' + styles.signOutBtn} onClick={onSignOut}>
            {t('signOut')}
          </button>
        ) : null}
        {!userEmail && onSignIn ? (
          <button className={styles.secondaryBtn + ' ' + styles.signOutBtn} onClick={onSignIn}>
            {t('signInSync')}
          </button>
        ) : null}
      </div>

      <div className={styles.section}>
        <h3>{t('serverIntegration')}</h3>
        <p className={styles.desc}>{t('voiceServerConnect')}</p>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>{t('serverUrl')}</label>
          <input
            type="text"
            className={styles.fieldInput}
            placeholder={DEFAULT_SERVER_URL}
            value={serverUrlInput}
            onChange={(e) => {
              setServerUrlInput(e.target.value)
              setServerUrl(e.target.value)
            }}
          />
        </div>
        <div className={styles.syncRow}>
          <span
            className={`${styles.syncDot} ${serverOnline === null ? '' : serverOnline ? '' : styles.syncDotError}`}
          />
          <span className={styles.syncText}>
            {t('serverHealth')}: {serverOnline === null ? '…' : serverOnline ? t('serverOnline') : t('serverOffline')}
          </span>
        </div>
        {server.isSignedIn && server.session ? (
          <>
            <p className={styles.desc}>{t('serverSignedInAs', { email: server.session.user.email })}</p>
            <div className={styles.actions}>
              <button className={styles.secondaryBtn} onClick={() => void exportServerData()}>
                {t('serverExportData')}
              </button>
              <button
                className={styles.secondaryBtn + ' ' + styles.signOutBtn}
                onClick={() => void server.logout()}
              >
                {t('serverSignOut')}
              </button>
              <button className={styles.dangerBtn} onClick={() => void deleteServerAccount()}>
                {t('serverDeleteAccount')}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>{t('serverEmail')}</label>
              <input
                type="email"
                className={styles.fieldInput}
                placeholder="you@example.com"
                value={serverEmail}
                onChange={(e) => setServerEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>{t('serverPassword')}</label>
              <input
                type="password"
                className={styles.fieldInput}
                value={serverPassword}
                onChange={(e) => setServerPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            {server.error ? <p className={styles.desc}>{server.error}</p> : null}
            <div className={styles.actions}>
              <button
                className={styles.primaryBtn}
                disabled={server.loading || !serverEmail || !serverPassword}
                onClick={() => void server.login(serverEmail, serverPassword).catch(() => {})}
              >
                {t('serverSignIn')}
              </button>
              <button
                className={styles.secondaryBtn}
                disabled={server.loading || !serverEmail || !serverPassword}
                onClick={() => void server.register(serverEmail, serverPassword).catch(() => {})}
              >
                {t('serverSignUp')}
              </button>
            </div>
          </>
        )}
      </div>

      <div className={styles.section}>
        <h3>Friday Pro</h3>
        <div className={styles.proCard}>
          <div>
            <p className={styles.proTitle}>
              {subStatus.isActive ? t('proFullPower') : t('proUnlock')}
            </p>
            <p className={styles.proSub}>
              {subStatus.isActive
                ? (subStatus.expiresAt ? t('proExpires', { date: new Date(subStatus.expiresAt).toLocaleDateString(language === 'zh' ? 'zh-CN' : undefined) }) : '')
                : t('proBenefits')}
            </p>
          </div>
          <button className={styles.primaryBtn + ' ' + styles.proBtn} onClick={() => setShowSub(true)}>
            {subStatus.isActive ? t('subscription') : t('upgradeNow')}
          </button>
        </div>
      </div>

      <div className={styles.section}>
        <h3>{t('aiAgent')}</h3>
        <p className={styles.desc}>{t('aiSettingsDesc')}</p>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>{t('apiKeyForProvider', { provider: providerName })}</label>
          <input
            type="password"
            className={styles.fieldInput}
            placeholder={apiKeyPlaceholder}
            value={apiKey}
            onChange={saveApiKey}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>{t('model')}</label>
          <select className={styles.fieldInput} value={model} onChange={saveModel}>
            {MODEL_GROUPS.map((group) => (
              <optgroup key={group.groupKey} label={t(group.groupKey)}>
                {group.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.hintKey ? `${option.label} · ${t(option.hintKey)}` : option.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>{t('apiBaseUrl')}</label>
          <input
            type="text"
            className={styles.fieldInput}
            placeholder="https://api.deepseek.com/v1"
            value={baseUrl}
            onChange={saveBaseUrl}
          />
        </div>
      </div>

      <div className={styles.section}>
        <h3>{t('language')}</h3>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>{t('appLanguage')}</label>
          <select className={styles.fieldInput} value={language} onChange={handleLanguageChange}>
            <option value="en">English</option>
            <option value="zh">中文</option>
          </select>
        </div>
      </div>

      <div className={styles.section}>
        <h3>{t('data')}</h3>
        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.statValue}>{taskCount}</span>
            <span className={styles.statLabel}>{t('tasks')}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{archiveCount}</span>
            <span className={styles.statLabel}>{t('archiveItems')}</span>
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <h3>{t('backup')}</h3>
        <p className={styles.desc}>{t('backupDesc')}</p>
        <div className={styles.actions}>
          <button className={styles.primaryBtn} onClick={onExport}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
            {t('exportingData')}
          </button>
          <button className={styles.secondaryBtn} onClick={() => fileInputRef.current?.click()}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
            </svg>
            {t('importingData')}
          </button>
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileChange} hidden />
        </div>
      </div>

      <div className={styles.section}>
        <h3>{t('about')}</h3>
        <div className={styles.about}>
          <p><strong>{t('appName')}</strong></p>
          <p className={styles.version}>{t('versionLabel')}</p>
          <p className={styles.desc}>{t('aboutTagline')}</p>
        </div>
      </div>

      <div className={styles.section}>
        <h3>{t('dangerZone')}</h3>
        <button className={styles.dangerBtn} onClick={onClearData}>
          {t('clearAllData')}
        </button>
      </div>

      {showSub ? <SubscriptionPanel onClose={() => setShowSub(false)} /> : null}
    </section>
  )
}
