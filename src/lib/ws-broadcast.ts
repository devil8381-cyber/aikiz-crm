/**
 * Broadcast utility — no-op on Vercel.
 * Activity logs are already written to the database by all API routes.
 * The client-side polling hook (useWebSocket.ts) reads those logs
 * to show real-time updates. This function is kept as a safe no-op
 * so existing API routes don't need any changes.
 */

type BroadcastData = {
  type: string
  payload?: any
  from?: string
}

export function wsBroadcast(_data: BroadcastData) {
  // No-op: activity logs handle real-time updates via polling
  // This is intentionally empty — do not add WebSocket logic here
}

export function wsGetOnlineAgents() {
  return []
}