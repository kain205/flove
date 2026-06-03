const DEBUG_STORAGE_KEY = 'flove:debug';

function isDebugEnabled(): boolean {
  if (import.meta.env.DEV) return true;
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(DEBUG_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

export function startTimer(): number {
  return nowMs();
}

export function elapsedMs(startedAt: number): number {
  return Math.round(nowMs() - startedAt);
}

export function debugLog(scope: string, event: string, details?: Record<string, unknown>): void {
  if (!isDebugEnabled()) return;
  console.debug(`[F-Love:${scope}] ${event}`, details ?? {});
}

export function debugWarn(scope: string, event: string, details?: Record<string, unknown>): void {
  if (!isDebugEnabled()) return;
  console.warn(`[F-Love:${scope}] ${event}`, details ?? {});
}
