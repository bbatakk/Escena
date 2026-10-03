import { describe, expect, it } from 'vitest'
import { accountStorageKey, activeResources, backupVersion, clearAccountLocalData, isConcertOwnedFile, isSongOwnedFile, validateBackup } from './data'
import { createId, newConcert, selectConcertPeople, type BandPerson, type SongVersion } from './model'
import { deleteConcert, exportBackup, listMoneyMovements, listResource, saveConcert, saveResource } from './data'

describe('propietat dels fitxers d’un concert', () => {
  it('no elimina fitxers compartits de la biblioteca quan es treuen d’un concert', () => {
    const concert = newConcert()
    const band = 'b96d3a9b-7348-43d0-8054-9668854672aa'
    expect(isConcertOwnedFile(concert, `${band}/${concert.id}/document/arxiu.pdf`)).toBe(true)
    expect(isConcertOwnedFile(concert, `${band}/shared/document/arxiu.pdf`)).toBe(false)
    expect(isConcertOwnedFile(concert, `${band}/${newConcert().id}/document/arxiu.pdf`)).toBe(false)
  })
})

describe('aïllament local entre comptes', () => {
  it('genera claus independents per a la caché i la cua offline de cada usuari', () => {
    const cache = 'escena-demo-concerts-v1'
    const queue = 'escena-offline-data-queue-v1'
    expect(accountStorageKey(cache, 'user-a')).not.toBe(accountStorageKey(cache, 'user-b'))
    expect(accountStorageKey(queue, 'user-a')).not.toBe(accountStorageKey(queue, 'user-b'))
    expect(accountStorageKey(cache, 'user-a')).toBe(accountStorageKey(cache, 'user-a'))
  })

  it('elimina només les dades locals del compte esborrat', () => {
    const values = new Map([
      [accountStorageKey('escena-demo-concerts-v1', 'user-a'), 'concerts-a'],
      [accountStorageKey('escena-offline-queue-v1', 'user-a'), 'queue-a'],
      [accountStorageKey('escena-demo-concerts-v1', 'user-b'), 'concerts-b'],
      ['escena-theme', 'classic'],
    ])
    const storage = {
      get length() { return values.size },
      key(index: number) { return [...values.keys()][index] ?? null },
      removeItem(key: string) { values.delete(key) },
    }
    const original = globalThis.localStorage
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })
    try {
      clearAccountLocalData('user-a')
      expect([...values.keys()]).toEqual([accountStorageKey('escena-demo-concerts-v1', 'user-b'), 'escena-theme'])
    } finally {
      Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: original })
    }
  })
})

describe('persistència econòmica del concert', () => {
  it('conserva tarifes i liquidacions en backups, i regenera moviments sense duplicar-los', async () => {
    const values = new Map<string, string>()
    const original = globalThis.localStorage
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
      getItem(key: string) { return values.get(key) ?? null },
      setItem(key: string, value: string) { values.set(key, value) },
      removeItem(key: string) { values.delete(key) },
    } })
    try {
      const person: BandPerson = { id: createId(), name: 'Tècnica', kind: 'tecnic', phone: '', email: '', active: true, feeAgreement: { kind: 'fixed', amount: 150 } }
      await saveResource('band_people', person)
      expect((await listResource<BandPerson>('band_people'))[0].feeAgreement).toEqual(person.feeAgreement)
      const concert = newConcert()
      concert.title = 'Prova econòmica'
      concert.date = '2026-10-03'
      concert.feeAmount = 1000
      concert.feePaid = 500
      concert.details = selectConcertPeople(concert.details, [person.id], [person])
      concert.details.finalFee = 500
      concert.details.teamFees![0].payments = [{ id: createId(), date: '2026-10-03', amount: 100, payer: 'band', paymentMethod: 'cash' }]
      await saveConcert(concert)
      concert.details.teamFees![0].payments[0].date = '2026-10-04'
      await saveConcert(concert)
      const payments = (await listMoneyMovements()).filter((movement) => movement.sourceType === 'team_payment')
      expect(payments).toHaveLength(1)
      expect(payments[0]).toMatchObject({ amount: 100, date: '2026-10-04', paymentMethod: 'cash' })
      const backup = await exportBackup()
      expect(validateBackup(backup)).toBe(true)
      expect(backup.money.some((movement) => movement.sourceType === 'team_payment')).toBe(false)
      expect(backup.concerts.find((item) => item.id === concert.id)?.details.teamFees).toEqual(concert.details.teamFees)
      expect(validateBackup({ ...backup, people: [{ ...person, feeAgreement: { kind: 'fixed', amount: -10 } }] })).toBe(false)
      await deleteConcert(concert.id)
      expect((await listMoneyMovements()).some((movement) => movement.concertId === concert.id && movement.sourceType)).toBe(false)
    } finally {
      Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: original })
    }
  })
})

describe('propietat dels àudios de cançons', () => {
  it('només reconeix la ruta de la cançó i versió corresponents', () => {
    const version: SongVersion = { id: 'version-1', songId: 'song-1', name: 'Demo', kind: 'demo', recordedOn: '2026-09-29', notes: '', externalUrl: '' }
    expect(isSongOwnedFile(version, 'band/song-1/version-1/demo.mp3')).toBe(true)
    expect(isSongOwnedFile(version, 'band/song-2/version-1/demo.mp3')).toBe(false)
    expect(isSongOwnedFile(version, 'band/song-1/version-2/demo.mp3')).toBe(false)
  })
})

describe('validació de backups', () => {
  const emptyBackup = { version: backupVersion, exportedAt: '2026-09-24T10:00:00.000Z', concerts: [], library: [], money: [], merchProducts: [], merchSales: [], people: [], materials: [], setlists: [], songProjects: [], songVersions: [] }

  it('accepta l’estructura buida vàlida de la versió actual', () => {
    expect(validateBackup(emptyBackup)).toBe(true)
  })

  it('accepta quantitats de material i conserva la compatibilitat amb backups antics', () => {
    const material = { id: 'mic', name: 'Micròfon', category: 'So', active: true }
    const concert = { ...newConcert(), date: '2026-10-05' }
    const withQuantity = { ...emptyBackup, materials: [{ ...material, quantity: 4 }], concerts: [{ ...concert, details: { ...concert.details, materials: [{ ...material, quantity: 2, loaded: false }] } }] }
    expect(validateBackup(withQuantity)).toBe(true)
    expect(validateBackup({ ...emptyBackup, materials: [material], concerts: [{ ...concert, details: { ...concert.details, materials: [{ ...material, loaded: false }] } }] })).toBe(true)
    for (const quantity of [0, -1, 1.5, 2147483648, '2', null]) {
      expect(validateBackup({ ...emptyBackup, materials: [{ ...material, quantity }] })).toBe(false)
      expect(validateBackup({ ...emptyBackup, concerts: [{ ...concert, details: { ...concert.details, materials: [{ ...material, quantity, loaded: false }] } }] })).toBe(false)
    }
  })

  it('rebutja la versió desconeguda i registres mal formats', () => {
    expect(validateBackup({ ...emptyBackup, version: backupVersion + 1 })).toBe(false)
    expect(validateBackup({ ...emptyBackup, merchSales: [{ id: 'sale' }] })).toBe(false)
    expect(validateBackup({ ...emptyBackup, money: [{ id: 'movement', kind: 'ingres', amount: -1, date: '2026-09-24' }] })).toBe(false)
    expect(validateBackup({ ...emptyBackup, merchProducts: [{ id: 'product', name: 'Samarreta', price: 10, stock: 3, sizes: [{ name: 'M', stock: -1 }] }] })).toBe(false)
  })

  it('accepta backups v1 sense cançons i valida els projectes i versions de v2', () => {
    const { songProjects: _projects, songVersions: _versions, ...versionOne } = emptyBackup
    expect(validateBackup({ ...versionOne, version: 1 })).toBe(true)
    const project = { id: 'song', title: 'Títol provisional', status: 'en_proces', notes: '', lyrics: 'Primera estrofa', archived: false }
    const version = { id: 'version', songId: 'song', name: 'Demo 1', kind: 'demo', recordedOn: '2026-09-29', notes: '', externalUrl: '' }
    expect(validateBackup({ ...emptyBackup, songProjects: [project], songVersions: [version] })).toBe(true)
    expect(validateBackup({ ...emptyBackup, songProjects: [{ ...project, status: 'publicada' }] })).toBe(false)
    expect(validateBackup({ ...emptyBackup, songVersions: [{ ...version, audioPath: 'band/song/version/file.mp3' }] })).toBe(false)
    expect(validateBackup({ ...emptyBackup, songProjects: [project], songVersions: [{ ...version, songId: 'missing' }] })).toBe(false)
    expect(validateBackup({ ...emptyBackup, songProjects: [project], songVersions: [{ ...version, externalUrl: 'javascript:alert(1)' }] })).toBe(false)
  })

  it('valida l’estructura dels concerts abans de mostrar-ne la previsualització', () => {
    const concert = { ...newConcert(), date: '2026-10-05' }
    expect(validateBackup({ ...emptyBackup, concerts: [concert] })).toBe(true)
    expect(validateBackup({ ...emptyBackup, concerts: [{ ...concert, details: { ...concert.details, announceable: true } }] })).toBe(true)
    expect(validateBackup({ ...emptyBackup, concerts: [{ ...concert, details: { ...concert.details, announceable: 'sí' } }] })).toBe(false)
    expect(validateBackup({ ...emptyBackup, concerts: [{ ...concert, details: { ...concert.details, documents: [{ id: 'doc', name: 'Rider', url: '', direction: 'executar', status: 'pendent' }] } }] })).toBe(false)
  })

  it('continua acceptant backups antics amb camps afegits en versions posteriors', () => {
    const concert = { ...newConcert(), date: '2026-10-05' }
    expect(validateBackup({ ...emptyBackup, concerts: [concert], library: [{ id: 'doc', name: 'Rider', url: '' }], money: [{ id: 'movement', kind: 'ingres', amount: 10, date: '2026-10-05' }], merchProducts: [{ id: 'product', name: 'CD', price: 10, stock: 5 }], merchSales: [{ id: 'sale', concertId: concert.id, productId: 'product', quantity: 1, unitPrice: 10 }], people: [{ id: 'person', name: 'Músic' }], materials: [{ id: 'material', name: 'Micròfon' }], setlists: [{ id: 'setlist', name: 'Festival', songs: ['Tema'] }] })).toBe(true)
  })

  it('valida el compte de catxet i despeses de la fitxa', () => {
    const concert = { ...newConcert(), date: '2026-10-05', details: { ...newConcert().details, feePaymentMethod: 'cash', expensePaymentMethod: 'bank' } }
    expect(validateBackup({ ...emptyBackup, concerts: [concert] })).toBe(true)
    expect(validateBackup({ ...emptyBackup, concerts: [{ ...concert, details: { ...concert.details, expensePaymentMethod: 'other' } }] })).toBe(false)
  })

  it('valida el compte associat als moviments de tresoreria', () => {
    const movement = { id: 'movement', kind: 'ingres', amount: 10, date: '2026-10-05' }
    expect(validateBackup({ ...emptyBackup, money: [{ ...movement, paymentMethod: 'bank' }] })).toBe(true)
    expect(validateBackup({ ...emptyBackup, money: [{ ...movement, paymentMethod: 'cash' }] })).toBe(true)
    expect(validateBackup({ ...emptyBackup, money: [{ ...movement, paymentMethod: 'card' }] })).toBe(false)
  })

  it('valida la forma de pagament de les vendes de marxandatge', () => {
    const sale = { id: 'sale', concertId: 'concert', productId: 'product', quantity: 1, unitPrice: 10 }
    expect(validateBackup({ ...emptyBackup, merchSales: [{ ...sale, paymentMethod: 'card' }] })).toBe(true)
    expect(validateBackup({ ...emptyBackup, merchSales: [{ ...sale, paymentMethod: 'cash' }] })).toBe(true)
    expect(validateBackup({ ...emptyBackup, merchSales: [{ ...sale, paymentMethod: 'transfer' }] })).toBe(false)
  })

  it('accepta imatges optimitzades del catàleg als backups locals i rebutja URL externes com a imatge', () => {
    const product = { id: 'shirt', name: 'Samarreta', price: 20, stock: 4, active: true }
    expect(validateBackup({ ...emptyBackup, merchProducts: [{ ...product, imageDataUrl: 'data:image/webp;base64,UklGRg==' }] })).toBe(true)
    expect(validateBackup({ ...emptyBackup, merchProducts: [{ ...product, imageDataUrl: 'https://example.com/image.webp' }] })).toBe(false)
    expect(validateBackup({ ...emptyBackup, merchProducts: [{ ...product, imageUrl: 'https://project.supabase.co/storage/v1/object/sign/...' }] })).toBe(false)
  })

  it('accepta backups antics i valida les condicions opcionals de discogràfica', () => {
    expect(validateBackup(emptyBackup)).toBe(true)
    expect(validateBackup({ ...emptyBackup, labelAgreement: { name: 'Segell', tiers: [{ above: 500, percent: 15 }] } })).toBe(true)
    expect(validateBackup({ ...emptyBackup, labelAgreement: { name: 'Segell', tiers: [{ above: 500, percent: 150 }] } })).toBe(false)
  })
})

describe('recursos actius en mode local', () => {
  it('no torna a mostrar recursos arxivats després de recarregar', () => {
    expect(activeResources([{ id: 'live', active: true }, { id: 'archived', active: false }])).toEqual([{ id: 'live', active: true }])
  })
})
