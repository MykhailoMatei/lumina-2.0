/**
 * Lightweight Client Error Monitoring & Logging
 * Captures unhandled client errors, promise rejections, and component errors
 */

interface ErrorLogEntry {
  timestamp: string;
  message: string;
  source?: string;
  stack?: string;
}

const ERROR_LOG_KEY = 'lumina_client_error_logs';
const MAX_LOGS = 30;

const shouldIgnoreError = (message: string, stack?: string): boolean => {
  const m = (message || '').toLowerCase();
  const s = (stack || '').toLowerCase();

  // Environment constraint: HMR is disabled in preview iframe; ignore WebSocket & dev server client reconnect errors
  if (
    m.includes('websocket') ||
    m.includes('vite') ||
    s.includes('@vite/client') ||
    s.includes('vite/dist/client') ||
    m.includes('resizeobserver') ||
    m.includes('script error')
  ) {
    return true;
  }
  return false;
};

export const logClientError = (error: any, context = 'general') => {
  try {
    const message = error?.message || (typeof error === 'string' ? error : 'Unknown error');
    const stack = error?.stack || '';

    // Ignore benign dev-server WebSocket or HMR disconnect errors
    if (shouldIgnoreError(message, stack)) {
      return;
    }

    const entry: ErrorLogEntry = {
      timestamp: new Date().toISOString(),
      message: `[${context}] ${message}`,
      stack: stack ? stack.split('\n').slice(0, 4).join('\n') : undefined,
    };

    console.warn('[Lumina Monitor]', entry.message);

    // Forward error to server-side telemetry endpoint
    try {
      fetch('/api/errors/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      }).catch(() => {});
    } catch {
      // ignore
    }

    const existingRaw = localStorage.getItem(ERROR_LOG_KEY);
    const existing: ErrorLogEntry[] = existingRaw ? JSON.parse(existingRaw) : [];
    const cleanExisting = existing.filter(e => !shouldIgnoreError(e.message, e.stack));
    const updated = [entry, ...cleanExisting].slice(0, MAX_LOGS);
    localStorage.setItem(ERROR_LOG_KEY, JSON.stringify(updated));
  } catch {
    // Fail silently
  }
};

export const initGlobalErrorListeners = () => {
  if (typeof window === 'undefined') return;

  // Clean out any previously stored WebSocket errors
  try {
    const existingRaw = localStorage.getItem(ERROR_LOG_KEY);
    if (existingRaw) {
      const existing: ErrorLogEntry[] = JSON.parse(existingRaw);
      const cleaned = existing.filter(e => !shouldIgnoreError(e.message, e.stack));
      localStorage.setItem(ERROR_LOG_KEY, JSON.stringify(cleaned));
    }
  } catch {
    // ignore
  }

  window.addEventListener('error', (event) => {
    // Ignore benign cross-origin script or font errors
    if (!event.error && !event.message) return;
    const msg = event.error?.message || event.message || '';
    const stack = event.error?.stack || '';
    if (shouldIgnoreError(msg, stack)) return;
    logClientError(event.error || event.message, 'uncaught_error');
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const msg = reason?.message || (typeof reason === 'string' ? reason : '');
    const stack = reason?.stack || '';
    if (shouldIgnoreError(msg, stack)) return;
    logClientError(reason, 'unhandled_promise');
  });
};
