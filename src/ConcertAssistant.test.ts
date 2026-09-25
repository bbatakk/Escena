import { describe, expect, it } from 'vitest'
import { parsePlan } from './ConcertAssistant'
import { newConcert, type BandPerson, type SetlistTemplate } from './model'

describe('plans de l’assistent', () => {
  const concert = { ...newConcert(), id: 'concert-1', title: 'Festa Major', date: '2026-10-10', updatedAt: '2026-09-25T10:00:00Z' }
  const template: SetlistTemplate = { id: 'setlist-1', name: 'Festival', songs: ['Cançó A'], active: true }
  const person: BandPerson = { id: 'person-1', name: 'Àlex Abad', kind: 'musica', phone: '', email: '', active: true }

  it('prepara tres músics per a Persones sense inventar dades de contacte', () => {
    const people = ['Àlex Abad', 'Edu Rodriguez', 'Mak Džinović'].map((name) => ({ name, kind: 'musica' }))
    expect(parsePlan({ type: 'create_people', people }, [])).toEqual({ type: 'create_people', people })
  })

  it('rebutja persones ja presents, repetides o amb rols desconeguts', () => {
    expect(() => parsePlan({ type: 'create_people', people: [{ name: 'ÀLEX ABAD', kind: 'musica' }] }, [], [], [person])).toThrow()
    expect(() => parsePlan({ type: 'create_people', people: [{ name: 'Edu', kind: 'musica' }, { name: ' edu ', kind: 'musica' }] }, [])).toThrow()
    expect(() => parsePlan({ type: 'create_people', people: [{ name: 'Mak', kind: 'guitarrista' }] }, [])).toThrow()
  })

  it('prepara edicions i eliminacions només per IDs existents', () => {
    expect(parsePlan({ type: 'update_concerts', updates: [{ concertId: concert.id, changes: { country: 'Espanya' } }] }, [concert])).toMatchObject({ type: 'update_concerts', updates: [{ concertId: concert.id, updatedAt: concert.updatedAt, changes: { country: 'Espanya' } }] })
    expect(parsePlan({ type: 'delete_concerts', concertIds: [concert.id] }, [concert])).toMatchObject({ type: 'delete_concerts', concerts: [concert] })
  })

  it('permet editar detalls de la fitxa i seleccionar persones existents sense esborrar la resta', () => {
    expect(parsePlan({ type: 'update_concerts', updates: [{ concertId: concert.id, changes: { details: { dinner: 'si', personIds: ['person-1'] } } }] }, [concert], [], [person])).toMatchObject({ type: 'update_concerts', updates: [{ changes: { details: { dinner: 'si', personIds: ['person-1'] } } }] })
    expect(() => parsePlan({ type: 'update_concerts', updates: [{ concertId: concert.id, changes: { details: { personIds: ['desconegut'] } } }] }, [concert], [], [person])).toThrow()
    expect(() => parsePlan({ type: 'update_concerts', updates: [{ concertId: concert.id, changes: { details: { materials: [] } } }] }, [concert])).toThrow()
  })

  it('copia les condicions quan l’IA assigna el concert al segell i no deixa inventar trams', () => {
    const agreement = { name: 'Segell', tiers: [{ above: 500, percent: 15 }, { above: 1000, percent: 20 }] }
    const request = { type: 'update_concerts', updates: [{ concertId: concert.id, changes: { details: { management: 'discografica' } } }] }
    expect(() => parsePlan(request, [concert])).toThrow()
    expect(parsePlan(request, [concert], [], [], undefined, agreement)).toMatchObject({ updates: [{ changes: { details: { management: 'discografica', labelAgreement: agreement } } }] })
    expect(() => parsePlan({ type: 'update_concerts', updates: [{ concertId: concert.id, changes: { details: { labelAgreement: agreement } } }] }, [concert], [], [], undefined, agreement)).toThrow()
    expect(parsePlan({ type: 'create_concert', draft: { title: 'Nou concert', details: { management: 'discografica' } } }, [], [], [], undefined, agreement)).toMatchObject({ draft: { details: { management: 'discografica', labelAgreement: agreement } } })
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
