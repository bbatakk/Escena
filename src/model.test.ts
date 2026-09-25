import { describe, expect, it } from 'vitest'
import { commissionRate, concertSettlement, getPending, merchRevenueByConcert, newConcert, totalMerchRevenue, totalNetConcertFees, validateLabelAgreement } from './model'

describe('discogràfica i liquidació del catxet', () => {
  const agreement = { name: 'Segell', tiers: [{ above: 500, percent: 15 }, { above: 1000, percent: 20 }] }
  it('fa servir llindars estrictes i el tipus sobre tot el catxet', () => {
    expect([500, 500.01, 1000, 1000.01, 1200].map((fee) => commissionRate(fee, agreement))).toEqual([0, 15, 15, 20, 20])
    expect(concertSettlement({ ...newConcert(), feeAmount: 1200, feePaid: 600, details: { ...newConcert().details, management: 'discografica', labelAgreement: agreement } })).toMatchObject({ projectedCommission: 240, projectedNet: 960, paidCommission: 90, netPaid: 510, paidRate: 15 })
  })
  it('deixa tot el catxet a la banda si el concert és seu o no té discogràfica', () => {
    const concert = newConcert(); concert.feePaid = 600
    expect(concertSettlement(concert).netPaid).toBe(600)
    concert.details.management = 'banda'; concert.details.labelAgreement = agreement
    expect(concertSettlement(concert, agreement).netPaid).toBe(600)
  })
  it('respecta la còpia històrica i deixa sense classificar els imports de concerts amb gestió desconeguda', () => {
    const concert = newConcert(); concert.feeAmount = 1200; concert.feePaid = 600
    expect(concertSettlement(concert, agreement).unresolved).toBe(true)
    concert.details.management = 'discografica'; concert.details.labelAgreement = agreement
    expect(concertSettlement(concert, { name: 'Segell nou', tiers: [{ above: 0, percent: 50 }] }).netPaid).toBe(510)
  })
  it('suma els catxets nets cobrats, independentment del marxandatge i dels moviments manuals', () => {
    const managed = newConcert(); managed.feePaid = 600; managed.details.management = 'discografica'; managed.details.labelAgreement = agreement
    const selfManaged = newConcert(); selfManaged.feePaid = 1000; selfManaged.details.management = 'banda'
    const unknown = newConcert(); unknown.feePaid = 300
    expect(totalNetConcertFees([managed, selfManaged, unknown], agreement)).toBe(1510)
    expect(totalNetConcertFees([managed, selfManaged, unknown], null)).toBe(1810)
  })
  it('rebutja trams sense ordre, percentatges fora de rang o sense segell', () => {
    expect(() => validateLabelAgreement({ name: '', tiers: agreement.tiers })).toThrow()
    expect(() => validateLabelAgreement({ name: 'S', tiers: [{ above: 1000, percent: 20 }, { above: 500, percent: 15 }] })).toThrow()
    expect(() => validateLabelAgreement({ name: 'S', tiers: [{ above: 0, percent: 101 }] })).toThrow()
  })
})

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

describe('ingressos de marxandatge per concert', () => {
  it('fa servir el resum antic només quan el concert encara no té vendes detallades', () => {
    const withDetail = newConcert()
    withDetail.id = 'concert-detail'
    withDetail.details.merchSales = 100
    const legacy = newConcert()
    legacy.id = 'concert-legacy'
    legacy.details.merchSales = 42
    const sales = [{ id: 'sale-1', concertId: withDetail.id, productId: 'shirt', quantity: 2, unitPrice: 15, note: '' }]
    const revenues = merchRevenueByConcert([withDetail, legacy], sales)
    expect(revenues.get(withDetail.id)).toBe(30)
    expect(revenues.get(legacy.id)).toBe(42)
    expect(totalMerchRevenue([withDetail, legacy], sales)).toBe(72)
  })
})

describe('ingressos de marxandatge per concert', () => {
  it('manté els resums antics només si el concert no té vendes detallades', () => {
    const concertWithSales = newConcert()
    concertWithSales.id = 'with-sales'
    concertWithSales.details.merchSales = 100
    const concertWithLegacy = newConcert()
    concertWithLegacy.id = 'legacy'
    concertWithLegacy.details.merchSales = 42
    const sales = [{ id: 's1', concertId: 'with-sales', productId: 'p1', quantity: 2, unitPrice: 15, note: '' }]
    expect(merchRevenueByConcert([concertWithSales, concertWithLegacy], sales)).toEqual(new Map([['with-sales', 30], ['legacy', 42]]))
    expect(totalMerchRevenue([concertWithSales, concertWithLegacy], sales)).toBe(72)
  })
})
