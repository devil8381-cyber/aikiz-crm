/** Zoom Phone desktop click-to-call helpers */

/** Normalize to digits; keep leading + for US/international */
export function normalizePhone(raw: string): string {
  if (!raw) return ''
  const cleaned = raw.replace(/[^\d+]/g, '')
  // If starts with 1 and 11 digits, ensure +
  const digits = cleaned.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  if (cleaned.startsWith('+')) return cleaned
  if (digits.length > 0) return `+${digits}`
  return cleaned
}

/** Launch Zoom Phone desktop app to dial */
export function dialZoomPhone(phone: string): boolean {
  const num = normalizePhone(phone)
  if (!num || num.length < 8) return false
  // Zoom Phone click-to-call protocol (desktop client)
  const url = `zoomphonecall://${num}`
  window.location.href = url
  return true
}

/** Fallback: system tel: link (if Zoom Phone is default handler it may still work) */
export function dialTel(phone: string): boolean {
  const num = normalizePhone(phone)
  if (!num) return false
  window.location.href = `tel:${num}`
  return true
}

/** Open default SMS app with prefilled body (desktop support varies) */
export function openSms(phone: string, body: string): void {
  const num = normalizePhone(phone)
  const encoded = encodeURIComponent(body)
  // sms: URI — works well on mobile; on Windows may open default messaging app
  window.location.href = `sms:${num}?body=${encoded}`
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.left = '-9999px'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      return true
    } catch {
      return false
    }
  }
}
