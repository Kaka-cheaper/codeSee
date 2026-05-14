import type { Annotation, AnnotationsFile } from './types'

export async function loadAnnotations(): Promise<AnnotationsFile | null> {
  try {
    const res = await fetch('/annotations.json', { cache: 'no-cache' })
    if (!res.ok) return null
    const data = (await res.json()) as AnnotationsFile
    if (data.version !== '0' || !data.annotations) return null
    return data
  } catch {
    return null
  }
}

export function getClusterAnnotation(
  annotations: AnnotationsFile | null,
  clusterId: string,
): Annotation | undefined {
  return annotations?.annotations[`cluster:${clusterId}`]
}

export function getNodeAnnotation(
  annotations: AnnotationsFile | null,
  nodeId: string,
): Annotation | undefined {
  return annotations?.annotations[`node:${nodeId}`]
}
