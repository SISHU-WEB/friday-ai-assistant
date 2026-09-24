import { useRef, useState, useEffect } from 'react'
import { useI18n } from '../lib/i18n'
import styles from './SettingsPanel.module.css'

interface SettingsPanelProps {
  onClose: () => void
  onExport: () => void
  onImport: (file: File) => void
  onClearData: () => void
  taskCount: number
  archiveCount: number
}

export function SettingsPanel({ onClose, onExport, onImport, onClearData, taskCount, archiveCount }: SettingsPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { language, setLanguage, t } = useI18n()
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('gpt-4o-mini')
  const [baseUrl, setBaseUrl] = useState('')

  useEffect(() => {
    setApiKey(localStorage.getItem('friday-openai-key') || '')
    setModel(localStorage.getItem('friday-ai-model') || 'gpt-4o-mini')
    setBaseUrl(localStorage.getItem('friday-ai-base-url') || '')
  }, [])

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

  return (
    <section className={styles.panel} aria-label="Settings">
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>SETTINGS</p>
          <h2>{t('settings')}</h2>
        </div>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close settings">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className={styles.section}>
        <h3>{t('aiAgent')}</h3>
        <p className={styles.desc}>Connect your AI provider API key to enable automatic scheduling and replanning.</p>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>{model.startsWith('deepseek') ? 'DeepSeek API Key' : model.startsWith('moonshot') ? 'Kimi API Key' : model.startsWith('qwen') ? '通义千问 API Key' : model.startsWith('glm') ? '智谱 API Key' : model.startsWith('ernie') ? '文心一言 API Key' : model.startsWith('claude') ? 'Claude API Key' : 'OpenAI API Key'}</label>
          <input
            type="password"
            className={styles.fieldInput}
            placeholder={model.startsWith('deepseek') ? 'sk-...' : model.startsWith('moonshot') ? 'sk-...' : model.startsWith('qwen') ? 'sk-...' : model.startsWith('glm') ? 'xxx.xxx' : model.startsWith('ernie') ? 'bce-...' : model.startsWith('claude') ? 'sk-ant-...' : 'sk-...'}
            value={apiKey}
            onChange={saveApiKey}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Model</label>
          <select className={styles.fieldInput} value={model} onChange={saveModel}>
            <optgroup label="OpenAI">
              <option value="gpt-4o-mini">GPT-4o Mini (fast, cheap)</option>
              <option value="gpt-4o">GPT-4o (smart)</option>
              <option value="gpt-4-turbo">GPT-4 Turbo</option>
              <option value="gpt-3.5-turbo">GPT-3.5 Turbo (cheapest)</option>
            </optgroup>
            <optgroup label="Anthropic">
              <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
              <option value="claude-3-haiku-20240307">Claude 3 Haiku (fast)</option>
            </optgroup>
            <optgroup label="国产模型">
              <option value="deepseek-chat">DeepSeek V3 (深度求索)</option>
              <option value="deepseek-reasoner">DeepSeek R1 (推理模型)</option>
              <option value="moonshot-v1-8k">Kimi 8K (月之暗面)</option>
              <option value="moonshot-v1-32k">Kimi 32K (长上下文)</option>
              <option value="moonshot-v1-128k">Kimi 128K (超长上下文)</option>
              <option value="qwen-turbo">通义千问 Turbo (阿里)</option>
              <option value="qwen-plus">通义千问 Plus (阿里)</option>
              <option value="glm-4-flash">智谱 GLM-4 Flash (免费)</option>
              <option value="glm-4">智谱 GLM-4</option>
              <option value="ernie-3.5-8k">文心一言 3.5 (百度)</option>
            </optgroup>
          </select>
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>API Base URL (留空用默认)</label>
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
          <label className={styles.fieldLabel}>App Language</label>
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
            <span className={styles.statLabel}>Tasks</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{archiveCount}</span>
            <span className={styles.statLabel}>Archive Items</span>
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <h3>{t('backup')}</h3>
        <p className={styles.desc}>Export your data as a JSON file or import from a backup.</p>
        <div className={styles.actions}>
          <button className={styles.primaryBtn} onClick={onExport}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
            Export Data
          </button>
          <button className={styles.secondaryBtn} onClick={() => fileInputRef.current?.click()}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
            </svg>
            Import Data
          </button>
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileChange} hidden />
        </div>
      </div>

      <div className={styles.section}>
        <h3>{t('about')}</h3>
        <div className={styles.about}>
          <p><strong>Friday</strong></p>
          <p className={styles.version}>Version 1.0.0</p>
          <p className={styles.desc}>A focused task manager for deep work.</p>
        </div>
      </div>

      <div className={styles.section}>
        <h3>{t('dangerZone')}</h3>
        <button className={styles.dangerBtn} onClick={onClearData}>
          Clear All Data
        </button>
      </div>
    </section>
  )
}
