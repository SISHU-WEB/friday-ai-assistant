export type SubscriptionTier = 'free' | 'premium'

export interface SubscriptionStatus {
  tier: SubscriptionTier
  isActive: boolean
  expiresAt?: string
  stripeCustomerId?: string
  stripeSubscriptionId?: string
}

export interface PremiumFeature {
  id: string
  name: string
  description: string
  requiresPremium: boolean
}

export const PREMIUM_FEATURES: PremiumFeature[] = [
  { id: 'ai-advanced', name: 'Advanced AI Scheduling', description: 'DeepSeek 4.1 advanced parsing, unlimited tasks', requiresPremium: false },
  { id: 'ai-replan', name: 'Smart Replanning', description: 'Unlimited interruption-based rescheduling', requiresPremium: true },
  { id: 'archive-unlimited', name: 'Unlimited Archive', description: 'Unlimited folders and items', requiresPremium: true },
  { id: 'cloud-sync', name: 'Cloud Sync', description: 'Multi-device sync via Supabase', requiresPremium: true },
  { id: 'priority-support', name: 'Priority Support', description: 'Fast support responses', requiresPremium: true },
]

const STORAGE_KEY = 'friday.subscription'

function loadFromStorage(): SubscriptionStatus {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as SubscriptionStatus
      if (parsed.expiresAt) {
        const now = new Date()
        const exp = new Date(parsed.expiresAt)
        if (now > exp) {
          return { tier: 'free', isActive: false }
        }
      }
      return parsed
    }
  } catch {}
  return { tier: 'free', isActive: false }
}

function saveToStorage(status: SubscriptionStatus) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(status))
  } catch {}
}

export class SubscriptionManager {
  private status: SubscriptionStatus
  private listeners: Set<(s: SubscriptionStatus) => void> = new Set()

  constructor() {
    this.status = loadFromStorage()
  }

  getStatus(): SubscriptionStatus {
    return { ...this.status }
  }

  isPremium(): boolean {
    return this.status.tier === 'premium' && this.status.isActive
  }

  canUseFeature(featureId: string): boolean {
    const feature = PREMIUM_FEATURES.find((f) => f.id === featureId)
    if (!feature) return true
    if (!feature.requiresPremium) return true
    return this.isPremium()
  }

  subscribe(listener: (s: SubscriptionStatus) => void) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit() {
    for (const l of this.listeners) l(this.getStatus())
  }

  async startCheckout(userId?: string): Promise<{ checkoutUrl?: string; error?: string }> {
    try {
      const pubKey = localStorage.getItem('friday-stripe-pk')
      if (!pubKey) {
        return this.simulateCheckoutSuccess(userId)
      }

      return this.simulateCheckoutSuccess(userId)
    } catch (e) {
      return { error: (e as Error).message }
    }
  }

  private simulateCheckoutSuccess(userId?: string): { checkoutUrl?: string; error?: string } {
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    this.status = {
      tier: 'premium',
      isActive: true,
      expiresAt,
      stripeCustomerId: userId ? `cus_sim_${userId}` : 'cus_sim_local',
      stripeSubscriptionId: `sub_sim_${Date.now()}`,
    }
    saveToStorage(this.status)
    this.emit()
    return { checkoutUrl: 'simulated://success' }
  }

  async handleCheckoutSuccess(sessionId: string): Promise<void> {
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    this.status = {
      tier: 'premium',
      isActive: true,
      expiresAt,
      stripeSubscriptionId: sessionId,
    }
    saveToStorage(this.status)
    this.emit()
  }

  async cancelSubscription(): Promise<void> {
    this.status = { ...this.status, isActive: false }
    saveToStorage(this.status)
    this.emit()
  }

  async restorePurchases(): Promise<boolean> {
    const current = loadFromStorage()
    this.status = current
    this.emit()
    return this.isPremium()
  }
}

export const subscriptionManager = new SubscriptionManager()
