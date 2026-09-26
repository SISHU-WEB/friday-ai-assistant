import { createContext, useContext, useState, type ReactNode } from 'react'

type Language = 'en' | 'zh'

const translations = {
  en: {
    appName: 'Friday',
    settings: 'Settings',
    tasks: 'Tasks',
    archive: 'Archive',
    addTask: 'Add Task',
    pause: 'Pause',
    resume: 'Resume',
    today: 'Today',
    noTasks: 'No tasks for today',
    delete: 'Delete',
    edit: 'Edit',
    save: 'Save',
    cancel: 'Cancel',
    confirm: 'Confirm',
    close: 'Close',
    voiceInput: 'Voice Input',
    listening: 'Listening...',
    micAccessBlocked: 'Microphone access is blocked',
    noSpeechDetected: 'No speech detected',
    signIn: 'Sign In',
    signUp: 'Sign Up',
    email: 'Email',
    password: 'Password',
    dontHaveAccount: "Don't have an account? Sign Up",
    alreadyHaveAccount: 'Already have an account? Sign In',
    exportingData: 'Export Data',
    importingData: 'Import Data',
    clearAllData: 'Clear All Data',
    dangerZone: 'Danger Zone',
    backup: 'Backup',
    data: 'Data',
    about: 'About',
    aiAgent: 'AI Agent',
    openaiKey: 'OpenAI API Key',
    model: 'Model',
    language: 'Language',
    archiveItems: 'Archive Items',
    version: 'Version',
    focusedTask: 'Focused Task',
    upNext: 'Up Next',
    schedule: 'Schedule',
    trash: 'Trash',
    restore: 'Restore',
    permanentDelete: 'Delete Permanently',
    emptyTrash: 'Empty Trash',
    taskDeleted: 'Task deleted',
    undo: 'Undo',
    replanning: 'Replanning your day...',
    paused: 'Paused',
    archiveTitle: 'Archive',
    searchArchive: 'Search archive...',
    newFolder: 'New Folder',
    noArchiveItems: 'No items in archive',
    loginWelcome: 'Welcome back',
    loginSubtitle: 'Sign in to sync your tasks across devices',
    orContinueWith: 'Or continue with',
    loginFailed: 'Login failed. Please check your credentials.',
    signupFailed: 'Signup failed. Please try again.',
    minutes: 'min',
    interruptionReason: 'Interruption reason',
    estimatedReturn: 'Estimated return',
    submit: 'Submit',
  },
  zh: {
    appName: 'Friday',
    settings: '设置',
    tasks: '任务',
    archive: '归档',
    addTask: '添加任务',
    pause: '暂停',
    resume: '继续',
    today: '今天',
    noTasks: '今天没有任务',
    delete: '删除',
    edit: '编辑',
    save: '保存',
    cancel: '取消',
    confirm: '确认',
    close: '关闭',
    voiceInput: '语音输入',
    listening: '正在聆听...',
    micAccessBlocked: '麦克风权限被拒绝',
    noSpeechDetected: '未检测到语音',
    signIn: '登录',
    signUp: '注册',
    email: '邮箱',
    password: '密码',
    dontHaveAccount: '没有账号？注册',
    alreadyHaveAccount: '已有账号？登录',
    exportingData: '导出数据',
    importingData: '导入数据',
    clearAllData: '清除所有数据',
    dangerZone: '危险操作',
    backup: '备份',
    data: '数据',
    about: '关于',
    aiAgent: 'AI 助手',
    openaiKey: 'OpenAI API 密钥',
    model: '模型',
    language: '语言',
    archiveItems: '归档条目',
    version: '版本',
    focusedTask: '当前任务',
    upNext: '接下来',
    schedule: '日程',
    trash: '回收站',
    restore: '恢复',
    permanentDelete: '永久删除',
    emptyTrash: '清空回收站',
    taskDeleted: '任务已删除',
    undo: '撤销',
    replanning: '正在重新规划你的一天...',
    paused: '已暂停',
    archiveTitle: '归档',
    searchArchive: '搜索归档...',
    newFolder: '新建文件夹',
    noArchiveItems: '归档中没有条目',
    loginWelcome: '欢迎回来',
    loginSubtitle: '登录以在设备间同步你的任务',
    orContinueWith: '或继续使用',
    loginFailed: '登录失败，请检查你的账号密码',
    signupFailed: '注册失败，请重试',
    minutes: '分钟',
    interruptionReason: '打断事由',
    estimatedReturn: '预计回归时间',
    submit: '提交',
  },
}

interface I18nContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: keyof typeof translations.en) => string
}

const I18nContext = createContext<I18nContextType | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  // Synchronous init so the first frame already matches the saved language
  // (no English flash for zh users, U-4).
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      return localStorage.getItem('friday-language') === 'zh' ? 'zh' : 'en'
    } catch {
      return 'en'
    }
  })

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    localStorage.setItem('friday-language', lang)
  }

  const t = (key: keyof typeof translations.en) => {
    return translations[language][key] || translations.en[key] || key
  }

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
