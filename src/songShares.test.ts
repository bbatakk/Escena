import { describe, expect, it } from 'vitest'
import { createSongShareToken, hashSongShareToken, isSongShareToken, songShareUrl } from './songShares'

describe('enllaços d’escolta de cançons', () => {
  it('genera tokens aleatoris opacs que no inclouen identificadors de dades', () => {
    const first = createSongShareToken()
    const second = createSongShareToken()
    expect(first).not.toBe(second)
    expect(isSongShareToken(first)).toBe(true)
    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/)
  })

  it('emmagatzema una empremta SHA-256 del token i construeix una URL neta', async () => {
    const token = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
    expect(await hashSongShareToken(token)).toHaveLength(64)
    expect(await hashSongShareToken(token)).toBe(await hashSongShareToken(token))
    expect(songShareUrl('https://escenaweb.vercel.app/', token)).toBe(`https://escenaweb.vercel.app/listen/${token}`)
    expect(isSongShareToken('short')).toBe(false)
  })
})
