import { describe, expect, it } from 'vitest'
import { commissionRate, concertClosingSummary, concertSettlement, generatedTreasuryMovements, getPending, merchRevenueByConcert, moneyMovementBalance, newConcert, shouldMarkConcertRealized, totalMerchRevenue, totalNetConcertFees, validateLabelAgreement, type MoneyMovement } from './model'

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

describe('estat automàtic del concert', () => {
  it('marca només concerts anteriors a avui que encara no han acabat', () => {
    const concert = newConcert()
    concert.date = '2026-09-26'
    concert.status = 'confirmat'
    expect(shouldMarkConcertRealized(concert, '2026-09-27')).toBe(true)
    concert.date = '2026-09-27'
    expect(shouldMarkConcertRealized(concert, '2026-09-27')).toBe(false)
    concert.date = '2026-09-28'
    expect(shouldMarkConcertRealized(concert, '2026-09-27')).toBe(false)
  })

  it('respecta els concerts cancel·lats i els que ja estan realitzats', () => {
    const concert = newConcert()
    concert.date = '2026-09-26'
    concert.status = 'cancel·lat'
    expect(shouldMarkConcertRealized(concert, '2026-09-27')).toBe(false)
    concert.status = 'realitzat'
    expect(shouldMarkConcertRealized(concert, '2026-09-27')).toBe(false)
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

describe('tancament econòmic del concert', () => {
  it('prefereix vendes i despeses detallades als resums antics sense duplicar-los', () => {
    const concert = newConcert()
    concert.id = 'concert-1'
    concert.feePaid = 500
    concert.details.management = 'banda'
    concert.details.merchSales = 100
    concert.details.expenses = 40
    const summary = concertClosingSummary(concert, null,
      [{ id: 'sale-1', concertId: concert.id, productId: 'shirt', quantity: 2, unitPrice: 15, note: '' }],
      [
        { id: 'auto-fee', concertId: concert.id, kind: 'ingres', amount: 500, date: '2026-10-05', category: 'Catxet', note: '', sourceType: 'concert_fee', sourceId: concert.id },
        { id: 'auto-sale', concertId: concert.id, kind: 'ingres', amount: 30, date: '2026-10-05', category: 'Marxandatge', note: '', sourceType: 'merch_sale', sourceId: 'sale-1' },
        { id: 'income-1', concertId: concert.id, kind: 'ingres', amount: 25, date: '2026-10-05', category: 'Aportació', note: '' },
        { id: 'expense-1', concertId: concert.id, kind: 'despesa', amount: 12, date: '2026-10-05', category: 'Gasolina', note: '' },
      ])
    expect(summary).toMatchObject({ netFee: 500, merchRevenue: 30, usesDetailedSales: true, manualIncome: 25, manualExpenses: 12, legacyExpenses: 0, balance: 543 })
  })

  it('utilitza resums antics només quan no hi ha registres detallats', () => {
    const concert = newConcert()
    concert.id = 'legacy'
    concert.details.merchSales = 42
    concert.details.expenses = 18
    expect(concertClosingSummary(concert, null, [], [])).toMatchObject({ merchRevenue: 42, usesDetailedSales: false, legacyExpenses: 18, balance: 24 })
  })
})

describe('moviments d’ingressos automàtics', () => {
  it('projecta catxet net, despesa de fitxa i un total de vendes per concert', () => {
    const paid = newConcert(); paid.id = 'paid'; paid.feePaid = 600; paid.details.expenses = 12; paid.details.management = 'discografica'; paid.details.labelAgreement = { name: 'Segell', tiers: [{ above: 500, percent: 15 }] }
    const legacy = newConcert(); legacy.id = 'legacy'; legacy.details.merchSales = 25
    const sales = [{ id: 'sale', concertId: paid.id, productId: 'cd', quantity: 2, unitPrice: 10, note: '', createdAt: '2026-10-05T10:00:00.000Z' }]
    expect(generatedTreasuryMovements([paid, legacy], null, sales, '2026-10-06')).toMatchObject([
      { sourceType: 'concert_fee', sourceId: 'paid', amount: 510, kind: 'ingres' },
      { sourceType: 'concert_expense', sourceId: 'paid', amount: 12, kind: 'despesa' },
      { sourceType: 'merch_total', sourceId: 'paid', concertId: 'paid', amount: 20, date: '2026-10-06', kind: 'ingres' },
      { sourceType: 'merch_total', sourceId: 'legacy', concertId: 'legacy', amount: 25, date: '2026-10-06', kind: 'ingres' },
    ])
  })

  it('desglossa el balanç per compte i assumeix bancari per registres antics', () => {
    const movements: MoneyMovement[] = [
      { id: 'bank-income', kind: 'ingres', amount: 100, date: '2026-10-01', category: '', note: '', paymentMethod: 'bank' },
      { id: 'cash-expense', kind: 'despesa', amount: 20, date: '2026-10-01', category: '', note: '', paymentMethod: 'cash' },
      { id: 'old-income', kind: 'ingres', amount: 15, date: '2026-10-01', category: '', note: '' },
    ]
    expect(moneyMovementBalance(movements)).toBe(95)
    expect(moneyMovementBalance(movements, 'bank')).toBe(115)
    expect(moneyMovementBalance(movements, 'cash')).toBe(-20)
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
