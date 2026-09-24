import { describe, expect, it } from 'vitest'
import { getPending, newConcert } from './model'

describe('pendents derivats de la fitxa', () => {
  it('no converteix dades opcionals desconegudes en tasques', () => {
    const concert = newConcert()
    concert.status = 'confirmat'
    concert.venue = 'Sala Gran'
    expect(getPending(concert)).toEqual([])
  })

  it('mostra només compromisos explícits que encara no s’han resolt', () => {
    const concert = newConcert()
    concert.status = 'reservat'
    concert.details.dinner = 'si'
    concert.details.lodging = 'no'
    concert.details.documents = [
      { id: 'a', name: 'Rider', direction: 'enviar', status: 'pendent', url: '' },
      { id: 'b', name: 'Bio', direction: 'enviar', status: 'no_cal', url: '' },
    ]
    expect(getPending(concert)).toEqual(['Confirmar el concert', 'Enviar Rider'])
    concert.details.dinnerDetails = 'Al recinte, 20:00'
    concert.details.documents[0].status = 'fet'
    expect(getPending(concert)).toEqual(['Confirmar el concert'])
  })

  it('distingeix concert realitzat de catxet cobrat i descarta cancel·lats', () => {
    const concert = newConcert()
    concert.status = 'realitzat'
    concert.feeAmount = 1200
    concert.feePaid = 600
    expect(getPending(concert)).toContain('Cobrar el catxet pendent')
    concert.feePaid = 1200
    expect(getPending(concert)).toEqual([])
    concert.status = 'cancel·lat'
    concert.feePaid = 0
    expect(getPending(concert)).toEqual([])
  })

  it('adjuntar un fitxer no vol dir que el document ja s’hagi enviat', () => {
    const concert = newConcert()
    concert.details.documents = [{ id: 'rider', name: 'Rider', direction: 'enviar', status: 'pendent', url: '', storagePath: 'banda/concert/rider/fitxer.pdf', fileName: 'rider.pdf' }]
    expect(getPending(concert)).toEqual(['Enviar Rider'])
  })

  it('considera el sopar resolt i demana l’adreça de l’allotjament', () => {
    const concert = newConcert()
    concert.status = 'confirmat'
    concert.venue = 'Sala'
    concert.details.dinner = 'si'
    concert.details.lodging = 'si'
    expect(getPending(concert)).toEqual(['Concretar l’allotjament'])
    concert.details.lodgingAddress = 'Hotel Central, Carrer Major 1'
    expect(getPending(concert)).toEqual([])
  })
})
