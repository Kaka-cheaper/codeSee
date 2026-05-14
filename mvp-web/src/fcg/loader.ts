import type { FeaturesFile } from './types'

export async function loadFeatures(): Promise<FeaturesFile | null> {
  try {
    const res = await fetch('/features.json', { cache: 'no-cache' })
    if (!res.ok) return null
    const data = (await res.json()) as FeaturesFile
    if (data.version !== '0' || !Array.isArray(data.features)) return null
    return data
  } catch {
    return null
  }
}
