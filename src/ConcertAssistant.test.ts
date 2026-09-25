import { describe, expect, it } from 'vitest'
import { parsePlan } from './ConcertAssistant'
import { newConcert, type SetlistTemplate } from './model'

describe('plans de l’assistent', () => {
  const concert = { ...newConcert(), id: 'concert-1', title: 'Festa Major', date: '2026-10-10', updatedAt: '2026-09-25T10:00:00Z' }
  const template: SetlistTemplate = { id: 'setlist-1', name: 'Festival', songs: ['Cançó A'], active: true }

  it('prepara edicions i eliminacions només per IDs existents', () => {
    expect(parsePlan({ type: 'update_concerts', updates: [{ concertId: concert.id, changes: { country: 'Espanya' } }] }, [concert])).toMatchObject({ type: 'update_concerts', updates: [{ concertId: concert.id, updatedAt: concert.updatedAt, changes: { country: 'Espanya' } }] })
    expect(parsePlan({ type: 'delete_concerts', concertIds: [concert.id] }, [concert])).toMatchObject({ type: 'delete_concerts', concerts: [concert] })
  })

  it('rebutja seleccions parcials, duplicades o camps no permesos', () => {
    expect(() => parsePlan({ type: 'delete_concerts', concertIds: [concert.id, 'inventat'] }, [concert])).toThrow()
    expect(() => parsePlan({ type: 'delete_concerts', concertIds: [concert.id, concert.id] }, [concert])).toThrow()
    expect(() => parsePlan({ type: 'update_concerts', updates: [{ concertId: concert.id, changes: { details: { documents: [] } } }] }, [concert])).toThrow()
    expect(() => parsePlan({ type: 'update_concerts', updates: [{ concertId: concert.id, changes: { date: '2026-02-30' } }] }, [concert])).toThrow()
  })

  it('diferencia editar i arxivar una plantilla activa', () => {
    expect(parsePlan({ type: 'update_setlist', templateId: template.id, changes: { songs: ['Cançó B'] } }, [], [template])).toMatchObject({ type: 'update_setlist', original: template, template: { name: template.name, songs: ['Cançó B'] } })
    expect(parsePlan({ type: 'archive_setlist', templateId: template.id }, [], [template])).toEqual({ type: 'archive_setlist', original: template })
    expect(() => parsePlan({ type: 'archive_setlist', templateId: 'inventat' }, [], [template])).toThrow()
  })

  it('diferencia preguntes i anàlisis de les accions', () => {
    expect(parsePlan({ type: 'analysis', answer: 'Hi ha 2 concerts.' }, [])).toEqual({ type: 'analysis', answer: 'Hi ha 2 concerts.' })
  })
})
