export function createSongShareToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

export async function hashSongShareToken(token: string): Promise<string> {
  const bytes = new TextEncoder().encode(token)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function isSongShareToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token)
}

export function songShareUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, '')}/listen/${token}`
}
