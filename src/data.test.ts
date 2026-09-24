import { describe, expect, it } from 'vitest'
import { isConcertOwnedFile } from './data'
import { newConcert } from './model'

describe('propietat dels fitxers d’un concert', () => {
  it('no elimina fitxers compartits de la biblioteca quan es treuen d’un concert', () => {
    const concert = newConcert()
    const band = 'b96d3a9b-7348-43d0-8054-9668854672aa'
    expect(isConcertOwnedFile(concert, `${band}/${concert.id}/document/arxiu.pdf`)).toBe(true)
    expect(isConcertOwnedFile(concert, `${band}/shared/document/arxiu.pdf`)).toBe(false)
    expect(isConcertOwnedFile(concert, `${band}/${newConcert().id}/document/arxiu.pdf`)).toBe(false)
  })
})
