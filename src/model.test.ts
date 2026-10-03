import { describe, expect, it } from 'vitest'
import { createId, personFeeAmount, selectConcertPeople, settleTeamFeeWithManager, teamFeeSummary, validConcertEconomics, validPersonFeeAgreement, type BandPerson, type PersonFeeAgreement } from './model'
import { commissionRate, concertClosingSummary, concertSettlement, generatedTreasuryMovements, getPending, merchRevenueByConcert, moneyMovementBalance, newConcert, posterConcerts, totalMerchRevenue, totalNetConcertFees, validateLabelAgreement, type MoneyMovement } from './model'

describe('discogràfica i liquidació del catxet', () => {
  const agreement = { name: 'Segell', tiers: [{ above: 500, percent: 15 }, { above: 1000, percent: 20 }] }
  it('fa servir llindars estrictes i el tipus sobre tot el catxet', () => {
    expect([500, 500.01, 1000, 1000.01, 1200].map((fee) => commissionRate(fee, agreement))).toEqual([0, 15, 15, 20, 20])
    expect(concertSettlement({ ...newConcert(), feeAmount: 1200, feePaid: 600, details: { ...newConcert().details, management: 'discografica', labelAgreement: agreement } })).toMatchObject({ projectedCommission: 240, projectedNet: 960, paidCommission: 120, netPaid: 480, paidRate: 20 })
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
    expect(concertSettlement(concert, { name: 'Segell nou', tiers: [{ above: 0, percent: 50 }] }).netPaid).toBe(480)
  })
  it('suma els catxets nets cobrats, independentment del marxandatge i dels moviments manuals', () => {
    const managed = newConcert(); managed.feeAmount = 600; managed.feePaid = 600; managed.details.management = 'discografica'; managed.details.labelAgreement = agreement
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

describe('catxet final i honoraris de l’equip', () => {
  const tariff: PersonFeeAgreement = { kind: 'tiers', tiers: [{ from: 500, amount: 150 }, { from: 1000, amount: 200 }] }
  const person: BandPerson = { id: 'technician', name: 'Tècnica', kind: 'tecnic', phone: '', email: '', active: true, feeAgreement: tariff }
  function concertWithTeam() {
    const concert = newConcert()
    concert.feeAmount = 1000
    concert.details.management = 'banda'
    concert.details = selectConcertPeople(concert.details, [person.id], [person])
    return concert
  }
  it('aplica un únic tram inclusiu i no inventa honoraris per sota del primer', () => {
    expect([499, 500, 999.99, 1000, 2000].map((fee) => personFeeAmount(tariff, fee))).toEqual([null, 150, 150, 200, 200])
    expect(validPersonFeeAgreement({ kind: 'tiers', tiers: [{ from: 1000, amount: 200 }, { from: 500, amount: 150 }] })).toBe(false)
    expect(validPersonFeeAgreement({ kind: 'fixed', amount: -1 })).toBe(false)
  })
  it('copia les tarifes i conserva pagaments en deseleccionar o arxivar la persona', () => {
    const concert = concertWithTeam()
    person.feeAgreement = { kind: 'fixed', amount: 99 }
    expect(teamFeeSummary(concert).total).toBe(200)
    person.feeAgreement = tariff
    concert.details.teamFees![0].payments.push({ id: createId(), date: '2026-10-03', amount: 100, payer: 'band', paymentMethod: 'cash' })
    concert.details = selectConcertPeople(concert.details, [], [])
    expect(teamFeeSummary(concert)).toMatchObject({ total: 200, bandPaid: 100 })
  })
  it('recalcula sobre el final, no sobre una bestreta, sense alterar pagaments', () => {
    const concert = concertWithTeam()
    concert.feePaid = 500
    expect(teamFeeSummary(concert).total).toBe(200)
    concert.details.teamFees![0].payments.push({ id: createId(), date: '2026-10-03', amount: 200, payer: 'band', paymentMethod: 'bank' })
    concert.details.finalFee = 500
    expect(teamFeeSummary(concert).rows[0]).toMatchObject({ amount: 150, paid: 200, remaining: -50 })
    concert.details.finalFee = 1500
    expect(teamFeeSummary(concert).rows[0]).toMatchObject({ amount: 200, paid: 200, remaining: 0 })
  })
  it('respecta un final zero i els imports puntuals fixos', () => {
    const concert = concertWithTeam()
    concert.details.finalFee = 0
    concert.details.teamFees![0].agreement = { kind: 'fixed', amount: 50 }
    concert.details.labelAgreement = { name: 'Segell', tiers: [{ above: 0, percent: 20 }] }
    concert.details.management = 'discografica'
    expect(concertSettlement(concert)).toMatchObject({ grossFinal: 0, paidRate: 0, projectedCommission: 0, projectedNet: -50 })
    concert.status = 'realitzat'
    expect(getPending(concert)).not.toContain('Cobrar el catxet pendent')
  })
  it('separa pagaments mixtos del gestor i la banda sense duplicar despeses', () => {
    const concert = concertWithTeam()
    concert.feePaid = 1000
    const bandPayment = { id: createId(), date: '2026-10-03', amount: 75, payer: 'band' as const, paymentMethod: 'cash' as const }
    concert.details.teamFees![0].payments = [bandPayment, { id: createId(), date: '2026-10-03', amount: 100, payer: 'manager', paymentMethod: 'bank' }]
    expect(concertSettlement(concert)).toMatchObject({ netPaid: 900, projectedNet: 800 })
    const movements = generatedTreasuryMovements([concert], null, [])
    expect(movements.filter((item) => item.sourceType === 'team_payment')).toHaveLength(1)
    expect(movements.find((item) => item.sourceType === 'team_payment')).toMatchObject({ amount: 75, paymentMethod: 'cash', date: '2026-10-03', sourceId: bandPayment.id })
    expect(moneyMovementBalance(movements)).toBe(825)
    expect(concertClosingSummary(concert, null, [], [])).toMatchObject({ netFee: 900, teamExpenses: 75, balance: 825 })
  })
  it('rebutja dates impossibles, UUID duplicats i imports amb més de dos decimals', () => {
    const concert = concertWithTeam()
    const payment = { id: createId(), date: '2026-02-30', amount: 10, payer: 'band' as const, paymentMethod: 'bank' as const }
    concert.details.teamFees![0].payments = [payment]
    expect(validConcertEconomics(concert)).toBe(false)
    payment.date = '2026-10-03'
    expect(validConcertEconomics(concert)).toBe(true)
    concert.details.teamFees![0].payments.push({ ...payment })
    expect(validConcertEconomics(concert)).toBe(false)
    concert.details.teamFees![0].payments = []
    concert.details.finalFee = 100.001
    expect(validConcertEconomics(concert)).toBe(false)
  })
  it('descompta al tancament el tram del tècnic a més de la comissió, sense duplicar-lo', () => {
    const concert = concertWithTeam()
    concert.feePaid = 1000
    concert.details.management = 'discografica'
    concert.details.labelAgreement = { name: 'Segell', tiers: [{ above: 0, percent: 20 }] }
    expect(concertSettlement(concert)).toMatchObject({ projectedNet: 600, netPaid: 800 })
    concert.details.teamFees = settleTeamFeeWithManager(concert, person.id, '2026-10-03')
    const payment = concert.details.teamFees[0].payments[0]
    expect(payment).toMatchObject({ amount: 200, payer: 'manager', date: '2026-10-03' })
    expect(validConcertEconomics(concert)).toBe(true)
    expect(concertSettlement(concert)).toMatchObject({ projectedNet: 600, netPaid: 600 })
    expect(moneyMovementBalance(generatedTreasuryMovements([concert], null, []))).toBe(600)
    expect(generatedTreasuryMovements([concert], null, []).some((item) => item.sourceType === 'team_payment')).toBe(false)
    concert.details.teamFees = settleTeamFeeWithManager(concert, person.id, '2026-10-04')
    expect(concert.details.teamFees[0].payments).toEqual([payment])
  })
  it('liquida només el pendent amb el tram final i conserva pagaments parcials o excessius', () => {
    const concert = concertWithTeam()
    concert.details.finalFee = 500
    concert.feePaid = 500
    const partial = { id: createId(), date: '2026-10-02', amount: 75, payer: 'band' as const, paymentMethod: 'cash' as const }
    concert.details.teamFees![0].payments = [partial]
    concert.details.teamFees = settleTeamFeeWithManager(concert, person.id, '2026-10-03')
    expect(concert.details.teamFees[0].payments).toEqual([partial, expect.objectContaining({ amount: 75, payer: 'manager' })])
    expect(teamFeeSummary(concert).rows[0].remaining).toBe(0)
    expect(moneyMovementBalance(generatedTreasuryMovements([concert], null, []))).toBe(350)
    const payments = concert.details.teamFees[0].payments
    concert.details.teamFees[0].agreement = { kind: 'fixed', amount: 50 }
    concert.details.teamFees = settleTeamFeeWithManager(concert, person.id, '2026-10-04')
    expect(concert.details.teamFees[0].payments).toEqual(payments)
    concert.details.teamFees[0].agreement = tariff
    concert.details.finalFee = 499
    concert.details.teamFees = settleTeamFeeWithManager(concert, person.id, '2026-10-04')
    expect(concert.details.teamFees[0].payments).toEqual(payments)
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

describe('cartell de gira', () => {
  it('publica només concerts confirmats i protegeix els que encara no es poden anunciar', () => {
    const hidden = newConcert(); hidden.id = 'hidden'; hidden.date = '2026-10-04'; hidden.status = 'confirmat'; hidden.title = 'Secret'; hidden.city = 'Girona'; hidden.venue = 'Sala secreta'
    const publicGig = newConcert(); publicGig.id = 'public'; publicGig.date = '2026-10-06'; publicGig.status = 'confirmat'; publicGig.details.announceable = true; publicGig.title = 'Festa'; publicGig.city = 'Reus'; publicGig.venue = 'Sala pública'
    const past = newConcert(); past.id = 'past'; past.date = '2026-09-01'; past.status = 'realitzat'; past.details.announceable = true
    const unconfirmed = newConcert(); unconfirmed.status = 'reservat'; unconfirmed.date = '2026-10-05'
    const cancelled = newConcert(); cancelled.status = 'cancel·lat'; cancelled.date = '2026-10-05'
    const result = posterConcerts([publicGig, cancelled, hidden, unconfirmed, past], '2026-10-05')
    expect(result.map((item) => item.id)).toEqual(['past', 'hidden', 'public'])
    expect(result[1]).toEqual({ id: 'hidden', date: '2026-10-04', title: 'Per anunciar', city: '', hidden: true, past: true })
    expect(result[2]).toMatchObject({ title: 'Festa', city: 'Reus', past: false })
    expect(JSON.stringify(result)).not.toContain('Sala secreta')
    expect(JSON.stringify(result)).not.toContain('Sala pública')
  })
})

describe('moviments d’ingressos automàtics', () => {
  it('projecta catxet net, despesa de fitxa i un total de vendes per concert', () => {
    const paid = newConcert(); paid.id = 'paid'; paid.feeAmount = 600; paid.feePaid = 600; paid.details.expenses = 12; paid.details.feePaymentMethod = 'cash'; paid.details.management = 'discografica'; paid.details.labelAgreement = { name: 'Segell', tiers: [{ above: 500, percent: 15 }] }
    const legacy = newConcert(); legacy.id = 'legacy'; legacy.details.merchSales = 25; legacy.details.expenses = 4; legacy.details.expensePaymentMethod = 'cash'
    const sales = [{ id: 'sale', concertId: paid.id, productId: 'cd', quantity: 2, unitPrice: 10, note: '', paymentMethod: 'cash' as const, createdAt: '2026-10-05T10:00:00.000Z' }]
    expect(generatedTreasuryMovements([paid, legacy], null, sales, '2026-10-06')).toMatchObject([
      { sourceType: 'concert_fee', sourceId: 'paid', amount: 510, kind: 'ingres', paymentMethod: 'cash' },
      { sourceType: 'concert_expense', sourceId: 'paid', amount: 12, kind: 'despesa', paymentMethod: 'bank' },
      { sourceType: 'concert_expense', sourceId: 'legacy', amount: 4, kind: 'despesa', paymentMethod: 'cash' },
      { sourceType: 'merch_total_cash', sourceId: 'paid', concertId: 'paid', amount: 20, date: '2026-10-06', kind: 'ingres', paymentMethod: 'cash' },
      { sourceType: 'merch_total_card', sourceId: 'legacy', concertId: 'legacy', amount: 25, date: '2026-10-06', kind: 'ingres', paymentMethod: 'bank' },
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

  it('assigna les vendes amb targeta al banc i les vendes en efectiu a caixa', () => {
    const concert = newConcert(); concert.id = 'concert'
    const movements = generatedTreasuryMovements([concert], null, [
      { id: 'card', concertId: concert.id, productId: 'cd', quantity: 1, unitPrice: 10, note: '', paymentMethod: 'card' },
      { id: 'cash', concertId: concert.id, productId: 'shirt', quantity: 1, unitPrice: 20, note: '', paymentMethod: 'cash' },
    ])
    expect(moneyMovementBalance(movements, 'bank')).toBe(10)
    expect(moneyMovementBalance(movements, 'cash')).toBe(20)
    expect(movements).toHaveLength(2)
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
