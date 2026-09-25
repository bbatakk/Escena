import { createClient } from '@supabase/supabase-js'
import { type BandDocument, type BandMaterial, type BandPerson, type Concert, type MerchProduct, type MerchSale, type MoneyMovement, type SetlistTemplate, emptyDetails } from './model'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY
export const cloudConfigured = Boolean(url && key)
export const supabase = cloudConfigured ? createClient(url, key) : null
const documentBucket = 'concert-documents'
const maxDocumentBytes = 20 * 1024 * 1024

function storageErrorMessage(error: { message?: string; statusCode?: string | number }): Error {
  const message = error.message || 'Error desconegut de Storage.'
  const suffix = error.statusCode ? ` (${error.statusCode})` : ''
  return new Error(`${message}${suffix}`)
}

const demoKey = 'escena-demo-concerts-v1'
const libraryKey = 'escena-demo-library-v1'
const moneyKey = 'escena-demo-money-v1'
const merchProductsKey = 'escena-demo-merch-products-v1'
const merchSalesKey = 'escena-demo-merch-sales-v1'
const offlineConcertsKey = 'escena-offline-concerts-v1'
const offlineQueueKey = 'escena-offline-queue-v1'
const offlineDataQueueKey = 'escena-offline-data-queue-v1'
const peopleKey = 'escena-demo-people-v1'
const materialsKey = 'escena-demo-materials-v1'
const setlistsKey = 'escena-demo-setlists-v1'
const bandNameKey = 'escena-demo-band-name-v1'
const bandLogoKey = 'escena-demo-band-logo-v1'
const bandLogoUrlCacheKey = 'escena-band-logo-url-v1'
const defaultBandName = 'La nostra banda'

export const backupVersion = 1
export interface AppBackup {
  version: number
  exportedAt: string
  theme?: string
  workspaceName?: string
  concerts: Concert[]
  library: BandDocument[]
  money: MoneyMovement[]
  merchProducts: MerchProduct[]
  merchSales: MerchSale[]
  people: BandPerson[]
  materials: BandMaterial[]
  setlists: SetlistTemplate[]
}

export async function exportBackup(): Promise<AppBackup> {
  const [concerts, library, money, merchProducts, merchSales, people, materials, setlists, workspaceName] = await Promise.all([listConcerts(), listBandDocuments(), listMoneyMovements(), listMerchProducts(), listMerchSales(), listAllResources<BandPerson>('band_people'), listAllResources<BandMaterial>('band_materials'), listAllResources<SetlistTemplate>('setlist_templates'), getBandName()])
  return { version: backupVersion, exportedAt: new Date().toISOString(), theme: localStorage.getItem('escena-theme') || undefined, workspaceName, concerts, library, money, merchProducts, merchSales, people, materials, setlists }
}

export function validateBackup(value: unknown): value is AppBackup {
  if (!isRecord(value)) return false
  const backup = value as Partial<AppBackup>
  const hasId = (item: unknown) => isRecord(item) && typeof item.id === 'string' && item.id.length > 0
  return backup.version === backupVersion && (backup.workspaceName === undefined || (typeof backup.workspaceName === 'string' && backup.workspaceName.trim().length > 0 && backup.workspaceName.length <= 80))
    && Array.isArray(backup.concerts) && backup.concerts.every((item) => hasId(item) && isRecord(item.details) && Array.isArray(item.details.documents) && Array.isArray(item.details.materials))
    && Array.isArray(backup.library) && backup.library.every((item) => hasId(item) && typeof item.name === 'string' && typeof item.url === 'string')
    && Array.isArray(backup.money) && backup.money.every((item) => hasId(item) && (item.kind === 'ingres' || item.kind === 'despesa') && typeof item.amount === 'number' && typeof item.date === 'string')
    && Array.isArray(backup.merchProducts) && backup.merchProducts.every((item) => hasId(item) && typeof item.name === 'string' && typeof item.price === 'number' && typeof item.stock === 'number' && (item.sizes === undefined || (Array.isArray(item.sizes) && item.sizes.every((size) => isRecord(size) && typeof size.name === 'string' && typeof size.stock === 'number'))))
    && Array.isArray(backup.merchSales) && backup.merchSales.every((item) => hasId(item) && typeof item.concertId === 'string' && typeof item.productId === 'string' && typeof item.quantity === 'number' && typeof item.unitPrice === 'number')
    && Array.isArray(backup.people) && backup.people.every((item) => hasId(item) && typeof item.name === 'string')
    && Array.isArray(backup.materials) && backup.materials.every((item) => hasId(item) && typeof item.name === 'string')
    && Array.isArray(backup.setlists) && backup.setlists.every((item) => hasId(item) && typeof item.name === 'string' && Array.isArray(item.songs) && item.songs.every((song) => typeof song === 'string'))
}

export async function getBandName(): Promise<string> {
  if (!supabase || offline()) return localStorage.getItem(bandNameKey) || defaultBandName
  const { data, error } = await supabase.from('bands').select('name').eq('id', await bandId()).single()
  if (error) throw error
  const name = data.name?.trim() || defaultBandName
  localStorage.setItem(bandNameKey, name)
  return name
}

export interface BandProfile { name: string; logoUrl?: string }

export function getCachedBandProfile(): BandProfile {
  try {
    const name = localStorage.getItem(bandNameKey) || (supabase ? '' : defaultBandName)
    if (!supabase) return { name: name || defaultBandName, logoUrl: localStorage.getItem(bandLogoKey) || undefined }
    const cached = JSON.parse(localStorage.getItem(bandLogoUrlCacheKey) || 'null') as { url?: string; expiresAt?: number } | null
    return { name, logoUrl: cached?.expiresAt && cached.expiresAt > Date.now() + 30_000 ? cached.url : undefined }
  } catch { return { name: supabase ? '' : defaultBandName } }
}

export async function getBandProfile(): Promise<BandProfile> {
  const name = await getBandName()
  if (!supabase) return { name, logoUrl: localStorage.getItem(bandLogoKey) || undefined }
  if (offline()) return { name, logoUrl: getCachedBandProfile().logoUrl }
  const { data, error } = await supabase.from('bands').select('logo_path').eq('id', await bandId()).single()
  if (error) return { name }
  if (!data.logo_path) return { name }
  const { data: signed, error: signedError } = await supabase.storage.from('band-assets').createSignedUrl(data.logo_path, 60 * 60)
  if (signedError) return { name }
  localStorage.setItem(bandLogoUrlCacheKey, JSON.stringify({ url: signed.signedUrl, expiresAt: Date.now() + 55 * 60 * 1000 }))
  return { name, logoUrl: signed.signedUrl }
}

export function saveLocalBandLogo(dataUrl: string): string {
  localStorage.setItem(bandLogoKey, dataUrl)
  return dataUrl
}

export async function saveBandLogo(file: File): Promise<string> {
  if (!supabase) throw new Error('Fes servir el mode local per desar la imatge en aquest navegador.')
  if (offline()) throw new Error('Connecta’t a internet per canviar la imatge de l’espai compartit.')
  if (!file.type.startsWith('image/')) throw new Error('Tria un fitxer d’imatge.')
  if (file.size > 5 * 1024 * 1024) throw new Error('La imatge no pot superar els 5 MB.')
  const id = await bandId()
  const { data: current, error: currentError } = await supabase.from('bands').select('logo_path').eq('id', id).single()
  if (currentError) throw currentError
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80) || 'logo'
  const path = `${id}/branding/${crypto.randomUUID()}-${safeName}`
  const { error: uploadError } = await supabase.storage.from('band-assets').upload(path, file, { upsert: false })
  if (uploadError) throw storageErrorMessage(uploadError)
  const { error: updateError } = await supabase.from('bands').update({ logo_path: path }).eq('id', id)
  if (updateError) { await supabase.storage.from('band-assets').remove([path]); throw updateError }
  if (current.logo_path) void supabase.storage.from('band-assets').remove([current.logo_path])
  const { data: signed, error: signedError } = await supabase.storage.from('band-assets').createSignedUrl(path, 60 * 60)
  if (signedError) throw signedError
  localStorage.setItem(bandLogoUrlCacheKey, JSON.stringify({ url: signed.signedUrl, expiresAt: Date.now() + 55 * 60 * 1000 }))
  return signed.signedUrl
}

export async function removeBandLogo(): Promise<void> {
  if (!supabase) { localStorage.removeItem(bandLogoKey); return }
  if (offline()) throw new Error('Connecta’t a internet per treure la imatge de l’espai compartit.')
  const id = await bandId()
  const { data, error } = await supabase.from('bands').select('logo_path').eq('id', id).single()
  if (error) throw error
  const { error: updateError } = await supabase.from('bands').update({ logo_path: null }).eq('id', id)
  if (updateError) throw updateError
  localStorage.removeItem(bandLogoUrlCacheKey)
  if (data.logo_path) { const { error: removeError } = await supabase.storage.from('band-assets').remove([data.logo_path]); if (removeError) throw removeError }
}

export async function saveBandName(value: string): Promise<string> {
  const name = value.trim().replace(/\s+/g, ' ')
  if (!name) throw new Error('Escriu el nom de la banda.')
  if (name.length > 80) throw new Error('El nom no pot superar els 80 caràcters.')
  if (!supabase) { localStorage.setItem(bandNameKey, name); return name }
  if (offline()) throw new Error('Connecta’t a internet per canviar el nom de l’espai compartit.')
  const { error } = await supabase.from('bands').update({ name }).eq('id', await bandId())
  if (error) throw error
  localStorage.setItem(bandNameKey, name)
  return name
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value) }

export function importLocalBackup(backup: AppBackup): void {
  localStorage.setItem(demoKey, JSON.stringify(backup.concerts.map(normalizeConcert)))
  localStorage.setItem(libraryKey, JSON.stringify(backup.library))
  localStorage.setItem(moneyKey, JSON.stringify(backup.money))
  localStorage.setItem(merchProductsKey, JSON.stringify(backup.merchProducts))
  localStorage.setItem(merchSalesKey, JSON.stringify(backup.merchSales))
  localStorage.setItem(peopleKey, JSON.stringify(backup.people))
  localStorage.setItem(materialsKey, JSON.stringify(backup.materials))
  localStorage.setItem(setlistsKey, JSON.stringify(backup.setlists))
  if (backup.theme) localStorage.setItem('escena-theme', backup.theme)
  if (backup.workspaceName) localStorage.setItem(bandNameKey, backup.workspaceName)
}

export async function importBackup(backup: AppBackup): Promise<void> {
  if (!supabase) { importLocalBackup(backup); return }
  if (offline()) throw new Error('Connecta’t a internet per importar el backup a l’espai compartit.')

  // Cloud imports merge/overwrite matching IDs; they never delete records missing from the file.
  const [currentConcerts, currentSales, currentBandId] = await Promise.all([listConcerts(), listMerchSales(), bandId()])
  const concertVersions = new Map(currentConcerts.map((concert) => [concert.id, concert.updatedAt]))
  const currentSaleIds = new Set(currentSales.map((sale) => sale.id))
  const ownPath = (path?: string) => path?.startsWith(`${currentBandId}/`) ? path : undefined

  for (const concert of backup.concerts) {
    const safeConcert: Concert = {
      ...concert,
      country: typeof concert.country === 'string' ? concert.country : '',
      updatedAt: concertVersions.get(concert.id),
      details: {
        ...concert.details,
        documents: concert.details.documents.map((document) => {
          const storagePath = ownPath(document.storagePath)
          return { ...document, storagePath, fileName: storagePath ? document.fileName : undefined }
        }),
      },
    }
    await saveConcert(safeConcert)
  }
  await Promise.all(backup.library.map((document) => {
    const storagePath = ownPath(document.storagePath)
    return saveBandDocument({ ...document, storagePath, fileName: storagePath ? document.fileName : undefined })
  }))
  await Promise.all(backup.money.map(saveMoneyMovement))
  await Promise.all(backup.merchProducts.map(saveMerchProduct))
  await Promise.all(backup.people.map((item) => saveResource('band_people', item)))
  await Promise.all(backup.materials.map((item) => saveResource('band_materials', item)))
  await Promise.all(backup.setlists.map((item) => saveResource('setlist_templates', item)))
  for (const sale of backup.merchSales) {
    if (!currentSaleIds.has(sale.id)) await saveMerchSale(sale)
  }
  if (backup.theme) localStorage.setItem('escena-theme', backup.theme)
  if (backup.workspaceName) await saveBandName(backup.workspaceName)
}

function offline(): boolean { return typeof navigator !== 'undefined' && !navigator.onLine }
function readCache<T>(key: string): T[] { try { return JSON.parse(localStorage.getItem(key) || '[]') as T[] } catch { return [] } }
function writeCache<T>(key: string, value: T[]): void { localStorage.setItem(key, JSON.stringify(value)) }
export function activeResources<T extends { active: boolean }>(items: T[]): T[] { return items.filter((item) => item.active) }

function normalizeConcert(concert: Concert): Concert {
  return { ...concert, country: typeof concert.country === 'string' ? concert.country : '' }
}

function queueData(entity: 'money' | 'product' | 'sale', action: 'save' | 'delete', payload: unknown): void {
  const queue = readCache<{ id: string; entity: string; action: string; payload: unknown }>(offlineDataQueueKey)
  const id = typeof payload === 'string' ? payload : (payload as { id: string }).id
  writeCache(offlineDataQueueKey, [...queue.filter((item) => !(item.entity === entity && item.id === id)), { id, entity, action, payload }])
}

function dateFromNow(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function demoConcerts(): Concert[] {
  return [
    {
      id: 'demo-1', title: 'Festa Major de la Plaça', date: dateFromNow(12), status: 'confirmat',
      venue: 'Plaça del Mercat', city: 'Vilabona', country: 'Espanya', address: 'Plaça del Mercat, 1, Vilabona',
      feeAmount: 1200, feePaid: 0,
      details: {
        ...emptyDetails(), contactName: 'Marta Soler', contactPhone: '600 123 456',
        team: 'La banda i dos tècnics de so', travel: 'Sortim junts del local a les 15:30.',
        loadIn: 'Accés posterior de la plaça', dinner: 'si',
        schedule: [
          { id: 's1', label: 'Arribada i descàrrega', time: '17:00', place: 'Accés posterior' },
          { id: 's2', label: 'Prova de so', time: '18:00', place: 'Escenari' },
          { id: 's3', label: 'Concert', time: '22:30', place: 'Escenari' },
        ],
        documents: [
          { id: 'doc1', name: 'Rider tècnic', direction: 'enviar', status: 'fet', url: '' },
          { id: 'doc2', name: 'Contrarider', direction: 'rebre', status: 'pendent', url: '' },
          { id: 'doc3', name: 'Full de ruta', direction: 'rebre', status: 'fet', url: '' },
        ],
        materials: [
          { id: 'm1', name: 'Guitarres i fundes', loaded: false },
          { id: 'm2', name: 'Pedaleres', loaded: false },
          { id: 'm3', name: 'Caixa de marxandatge', loaded: false },
        ],
      },
    },
    {
      id: 'demo-2', title: 'Sala La Farinera', date: dateFromNow(28), status: 'reservat',
      venue: 'La Farinera', city: 'Girona', country: 'Espanya', address: '', feeAmount: 850, feePaid: 0,
      details: { ...emptyDetails(), contactName: 'Jordi Puig', lodging: 'no' },
    },
    {
      id: 'demo-3', title: 'Cicle Sons de Tardor', date: dateFromNow(-16), status: 'realitzat',
      venue: 'Teatre Principal', city: 'Reus', country: 'Espanya', address: 'Carrer Major, 12, Reus',
      feeAmount: 1000, feePaid: 1000,
      details: {
        ...emptyDetails(), dinner: 'no', lodging: 'no', merchSales: 215,
        expenses: 48, setlist: 'Obertura\nCamins\nEl retorn',
      },
    },
  ]
}

interface ConcertRow {
  id: string
  updated_at: string
  title: string
  date: string
  status: Concert['status']
  venue: string
  city: string
  country: string
  address: string
  fee_amount: number
  fee_paid: number
  details: Concert['details']
}

function fromRow(row: ConcertRow): Concert {
  return {
    id: row.id, updatedAt: row.updated_at, title: row.title, date: row.date, status: row.status,
    venue: row.venue, city: row.city, country: row.country ?? '', address: row.address,
    feeAmount: Number(row.fee_amount), feePaid: Number(row.fee_paid),
    details: { ...emptyDetails(), ...row.details },
  }
}

function localConcerts(): Concert[] {
  const saved = localStorage.getItem(demoKey)
  if (!saved) return demoConcerts()
  try {
    return (JSON.parse(saved) as Concert[]).map(normalizeConcert)
  } catch {
    return demoConcerts()
  }
}

export async function listConcerts(): Promise<Concert[]> {
  if (!supabase) return localConcerts()
  try {
    const { data, error } = await supabase.from('concerts').select('*').order('date', { ascending: true })
    if (error) throw error
    const concerts = (data as ConcertRow[]).map(fromRow)
    localStorage.setItem(offlineConcertsKey, JSON.stringify(concerts))
    return concerts
  } catch (error) {
    const cached = localStorage.getItem(offlineConcertsKey)
    if (cached) return (JSON.parse(cached) as Concert[]).map(normalizeConcert)
    throw error
  }
}

export async function saveConcert(concert: Concert): Promise<Concert> {
  concert = normalizeConcert(concert)
  if (!supabase) {
    const next = localConcerts().filter((item) => item.id !== concert.id)
    const saved = { ...concert, updatedAt: new Date().toISOString() }
    localStorage.setItem(demoKey, JSON.stringify([...next, saved]))
    return saved
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const queued = JSON.parse(localStorage.getItem(offlineQueueKey) || '[]') as Concert[]
    localStorage.setItem(offlineQueueKey, JSON.stringify([...queued.filter((item) => item.id !== concert.id), concert]))
    const cached = JSON.parse(localStorage.getItem(offlineConcertsKey) || '[]') as Concert[]
    const saved = { ...concert, updatedAt: concert.updatedAt || new Date().toISOString() }
    localStorage.setItem(offlineConcertsKey, JSON.stringify([...cached.filter((item) => item.id !== concert.id), saved]))
    return saved
  }

  const { data: membership, error: membershipError } = await supabase
    .from('band_members').select('band_id').single()
  if (membershipError || !membership) throw membershipError ?? new Error('No s’ha trobat l’espai de la banda.')

  const values = {
    title: concert.title.trim(),
    date: concert.date,
    status: concert.status,
    venue: concert.venue.trim(),
    city: concert.city.trim(),
    country: concert.country.trim(),
    address: concert.address.trim(),
    fee_amount: concert.feeAmount,
    fee_paid: concert.feePaid,
    details: concert.details,
  }
  const query = concert.updatedAt
    ? supabase.from('concerts').update(values).eq('id', concert.id).eq('updated_at', concert.updatedAt)
    : supabase.from('concerts').insert({ id: concert.id, band_id: membership.band_id, ...values })
  const { data, error } = await query.select('*').maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Aquest concert ha canviat en un altre dispositiu. Torna a la llista i obre’l de nou abans de desar.')
  return fromRow(data as ConcertRow)
}

export async function syncOfflineConcerts(): Promise<number> {
  if (!supabase || (typeof navigator !== 'undefined' && !navigator.onLine)) return 0
  const queued = JSON.parse(localStorage.getItem(offlineQueueKey) || '[]') as Concert[]
  if (!queued.length) return 0
  let synced = 0
  const remaining: Concert[] = []
  for (const concert of queued) {
    try { await saveConcert(concert); synced += 1 }
    catch { remaining.push(concert) }
  }
  localStorage.setItem(offlineQueueKey, JSON.stringify(remaining))
  return synced
}

export async function syncOfflineData(): Promise<number> {
  if (!supabase || offline()) return 0
  const queue = readCache<{ id: string; entity: 'money' | 'product' | 'sale'; action: 'save' | 'delete'; payload: unknown }>(offlineDataQueueKey)
  const remaining = [...queue]
  let synced = 0
  for (const operation of queue) {
    try {
      if (operation.entity === 'money') {
        if (operation.action === 'save') await saveMoneyMovement(operation.payload as MoneyMovement)
        else await deleteMoneyMovement(operation.id)
      } else if (operation.entity === 'product' && operation.action === 'save') await saveMerchProduct(operation.payload as MerchProduct)
      else if (operation.entity === 'sale') {
        if (operation.action === 'save') await saveMerchSale(operation.payload as MerchSale)
        else await deleteMerchSale(operation.id)
      }
      const index = remaining.findIndex((item) => item.id === operation.id && item.entity === operation.entity)
      if (index >= 0) remaining.splice(index, 1)
      synced += 1
    } catch { /* Keep the operation for the next reconnect. */ }
  }
  writeCache(offlineDataQueueKey, remaining)
  return synced
}

export async function deleteConcert(id: string, expectedUpdatedAt?: string): Promise<void> {
  if (!supabase) {
    localStorage.setItem(demoKey, JSON.stringify(localConcerts().filter((item) => item.id !== id)))
    return
  }
  const query = supabase.from('concerts').delete().eq('id', id)
  const { data, error } = await (expectedUpdatedAt ? query.eq('updated_at', expectedUpdatedAt) : query).select('id').maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Aquest concert ha canviat o ja no existeix. Recarrega la llista abans d’eliminar-lo.')
}

export async function uploadConcertDocument(concert: Concert, documentId: string, file: File): Promise<Concert> {
  if (!supabase) throw new Error('La pujada de fitxers només està disponible amb Supabase.')
  if (file.size > maxDocumentBytes) throw new Error('El fitxer no pot superar els 20 MB.')
  const document = concert.details.documents.find((item) => item.id === documentId)
  if (!document) throw new Error('Aquest document ja no existeix.')
  if (!concert.updatedAt) throw new Error('Desa el concert abans de pujar-hi un fitxer.')
  const { data: membership, error: membershipError } = await supabase.from('band_members').select('band_id').single()
  if (membershipError || !membership) throw membershipError ?? new Error('No s’ha trobat l’espai de la banda.')
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-90) || 'document'
  const path = `${membership.band_id}/${concert.id}/${documentId}/${crypto.randomUUID()}-${safeName}`
  const { error: uploadError } = await supabase.storage.from(documentBucket).upload(path, file, { upsert: false })
  if (uploadError) throw storageErrorMessage(uploadError)
  const updated: Concert = {
    ...concert,
    details: {
      ...concert.details,
      documents: concert.details.documents.map((item) => item.id === documentId
        ? { ...item, storagePath: path, fileName: file.name }
        : item),
    },
  }
  try {
    const saved = await saveConcert(updated)
    if (document.storagePath && isConcertOwnedFile(concert, document.storagePath)) void removeConcertDocumentFile(document.storagePath).catch(() => {})
    return saved
  } catch (error) {
    await removeConcertDocumentFile(path).catch(() => {})
    throw error
  }
}

export async function removeConcertDocumentFile(path: string): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.storage.from(documentBucket).remove([path])
  if (error) throw error
}

export function isConcertOwnedFile(concert: Concert, path: string): boolean {
  return path.split('/')[1] === concert.id
}

export async function signedDocumentUrl(path: string): Promise<string> {
  if (!supabase) throw new Error('Aquest fitxer no està disponible en mode demostració.')
  const { data, error } = await supabase.storage.from(documentBucket).createSignedUrl(path, 60 * 60)
  if (error) throw error
  return data.signedUrl
}

interface LibraryRow {
  id: string
  name: string
  url: string
  storage_path: string | null
  file_name: string | null
  archived: boolean
}

function fromLibraryRow(row: LibraryRow): BandDocument {
  return { id: row.id, name: row.name, url: row.url, storagePath: row.storage_path || undefined, fileName: row.file_name || undefined, archived: row.archived }
}

export async function listBandDocuments(): Promise<BandDocument[]> {
  if (!supabase) {
    try { return JSON.parse(localStorage.getItem(libraryKey) || '[]') as BandDocument[] }
    catch { return [] }
  }
  const { data, error } = await supabase.from('band_documents').select('*').order('created_at', { ascending: true })
  if (error) throw error
  return (data as LibraryRow[]).map(fromLibraryRow)
}

async function bandId(): Promise<string> {
  if (!supabase) throw new Error('Cal connectar Supabase.')
  const { data, error } = await supabase.from('band_members').select('band_id').single()
  if (error || !data) throw error ?? new Error('No s’ha trobat l’espai de la banda.')
  return data.band_id as string
}

export async function saveBandDocument(document: BandDocument): Promise<BandDocument> {
  if (!supabase) {
    const all = await listBandDocuments()
    localStorage.setItem(libraryKey, JSON.stringify([...all.filter((item) => item.id !== document.id), document]))
    return document
  }
  const { data, error } = await supabase.from('band_documents').upsert({
    id: document.id, band_id: await bandId(), name: document.name.trim(), url: document.url.trim(),
    storage_path: document.storagePath ?? null, file_name: document.fileName ?? null,
    archived: document.archived,
  }).select('*').single()
  if (error) throw error
  return fromLibraryRow(data as LibraryRow)
}

export async function deleteBandDocument(document: BandDocument): Promise<void> {
  if (!supabase) {
    const all = await listBandDocuments()
    localStorage.setItem(libraryKey, JSON.stringify(all.filter((item) => item.id !== document.id)))
    return
  }
  const concerts = await listConcerts()
  const used = concerts.some((concert) => concert.details.documents.some((item) => item.libraryId === document.id || (document.storagePath && item.storagePath === document.storagePath)))
  if (used) throw new Error('No es pot eliminar: aquest document s’utilitza en una fitxa de concert.')
  if (document.storagePath) await removeConcertDocumentFile(document.storagePath)
  const { error } = await supabase.from('band_documents').delete().eq('id', document.id)
  if (error) throw error
}

export async function uploadBandDocument(document: BandDocument, file: File): Promise<BandDocument> {
  if (!supabase) throw new Error('La pujada de fitxers només està disponible amb Supabase.')
  if (file.size > maxDocumentBytes) throw new Error('El fitxer no pot superar els 20 MB.')
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-90) || 'document'
  const path = `${await bandId()}/shared/${document.id}/${crypto.randomUUID()}-${safeName}`
  const { error: uploadError } = await supabase.storage.from(documentBucket).upload(path, file, { upsert: false })
  if (uploadError) throw storageErrorMessage(uploadError)
  try { return await saveBandDocument({ ...document, storagePath: path, fileName: file.name }) }
  catch (error) { await removeConcertDocumentFile(path).catch(() => {}); throw error }
}

interface MoneyRow { id: string; concert_id: string | null; kind: MoneyMovement['kind']; amount: number; date: string; category: string; note: string }
function fromMoneyRow(row: MoneyRow): MoneyMovement { return { id: row.id, concertId: row.concert_id || undefined, kind: row.kind, amount: Number(row.amount), date: row.date, category: row.category, note: row.note } }

export async function listMoneyMovements(): Promise<MoneyMovement[]> {
  if (!supabase) return readCache<MoneyMovement>(moneyKey)
  if (offline()) return readCache<MoneyMovement>(moneyKey)
  const { data, error } = await supabase.from('money_movements').select('*').order('date', { ascending: false }).order('created_at', { ascending: false })
  if (error) throw error
  const movements = (data as MoneyRow[]).map(fromMoneyRow); writeCache(moneyKey, movements); return movements
}

export async function saveMoneyMovement(movement: MoneyMovement): Promise<MoneyMovement> {
  if (!supabase) {
    const all = await listMoneyMovements()
    localStorage.setItem(moneyKey, JSON.stringify([movement, ...all.filter((item) => item.id !== movement.id)]))
    return movement
  }
  if (offline()) { const all = readCache<MoneyMovement>(moneyKey); const saved = { ...movement }; writeCache(moneyKey, [saved, ...all.filter((item) => item.id !== saved.id)]); queueData('money', 'save', saved); return saved }
  const { data, error } = await supabase.from('money_movements').upsert({
    id: movement.id, band_id: await bandId(), concert_id: movement.concertId || null,
    kind: movement.kind, amount: movement.amount, date: movement.date,
    category: movement.category.trim(), note: movement.note.trim(),
  }).select('*').single()
  if (error) throw error
  const saved = fromMoneyRow(data as MoneyRow); const all = readCache<MoneyMovement>(moneyKey); writeCache(moneyKey, [saved, ...all.filter((item) => item.id !== saved.id)]); return saved
}

export async function deleteMoneyMovement(id: string): Promise<void> {
  if (!supabase) {
    const all = await listMoneyMovements()
    localStorage.setItem(moneyKey, JSON.stringify(all.filter((item) => item.id !== id)))
    return
  }
  if (offline()) { writeCache(moneyKey, readCache<MoneyMovement>(moneyKey).filter((item) => item.id !== id)); queueData('money', 'delete', id); return }
  const { error } = await supabase.from('money_movements').delete().eq('id', id)
  if (error) throw error
  writeCache(moneyKey, readCache<MoneyMovement>(moneyKey).filter((item) => item.id !== id))
}

interface MerchProductRow { id: string; name: string; price: number; stock: number; active: boolean; sizes?: MerchProduct['sizes'] | null }
interface MerchSaleRow { id: string; concert_id: string; product_id: string; quantity: number; unit_price: number; note: string; size?: string | null }
function fromMerchProduct(row: MerchProductRow): MerchProduct { return { id: row.id, name: row.name, price: Number(row.price), stock: Number(row.stock), active: row.active, sizes: row.sizes || [] } }
function fromMerchSale(row: MerchSaleRow): MerchSale { return { id: row.id, concertId: row.concert_id, productId: row.product_id, quantity: Number(row.quantity), unitPrice: Number(row.unit_price), note: row.note, size: row.size || undefined } }

export async function listMerchProducts(): Promise<MerchProduct[]> {
  if (!supabase || offline()) return readCache<MerchProduct>(merchProductsKey)
  const { data, error } = await supabase.from('merch_products').select('*').order('name')
  if (error) throw error
  const products = (data as MerchProductRow[]).map(fromMerchProduct); writeCache(merchProductsKey, products); return products
}

export async function saveMerchProduct(product: MerchProduct): Promise<MerchProduct> {
  if (!supabase) { const all = await listMerchProducts(); localStorage.setItem(merchProductsKey, JSON.stringify([...all.filter((item) => item.id !== product.id), product])); return product }
  if (offline()) { const all = readCache<MerchProduct>(merchProductsKey); writeCache(merchProductsKey, [...all.filter((item) => item.id !== product.id), product]); queueData('product', 'save', product); return product }
  const { data, error } = await supabase.from('merch_products').upsert({ id: product.id, band_id: await bandId(), name: product.name.trim(), price: product.price, stock: product.stock, active: product.active, sizes: product.sizes || [] }).select('*').single()
  if (error) throw error
  const saved = fromMerchProduct(data as MerchProductRow); const all = readCache<MerchProduct>(merchProductsKey); writeCache(merchProductsKey, [...all.filter((item) => item.id !== saved.id), saved]); return saved
}

export async function listMerchSales(): Promise<MerchSale[]> {
  if (!supabase || offline()) return readCache<MerchSale>(merchSalesKey)
  const { data, error } = await supabase.from('merch_sales').select('*').order('created_at', { ascending: false })
  if (error) throw error
  const sales = (data as MerchSaleRow[]).map(fromMerchSale); writeCache(merchSalesKey, sales); return sales
}

export async function saveMerchSale(sale: MerchSale): Promise<MerchSale> {
  if (!supabase) { const all = await listMerchSales(); localStorage.setItem(merchSalesKey, JSON.stringify([sale, ...all.filter((item) => item.id !== sale.id)])); return sale }
  if (offline()) { const all = readCache<MerchSale>(merchSalesKey); writeCache(merchSalesKey, [sale, ...all.filter((item) => item.id !== sale.id)]); queueData('sale', 'save', sale); return sale }
  const { data, error } = await supabase.from('merch_sales').insert({ id: sale.id, band_id: await bandId(), concert_id: sale.concertId, product_id: sale.productId, quantity: sale.quantity, unit_price: sale.unitPrice, note: sale.note.trim(), size: sale.size || null }).select('*').single()
  if (error) throw error
  const saved = fromMerchSale(data as MerchSaleRow); const all = readCache<MerchSale>(merchSalesKey); writeCache(merchSalesKey, [saved, ...all.filter((item) => item.id !== saved.id)]); return saved
}

export async function deleteMerchSale(id: string): Promise<void> {
  if (!supabase) { const all = await listMerchSales(); localStorage.setItem(merchSalesKey, JSON.stringify(all.filter((item) => item.id !== id))); return }
  if (offline()) { writeCache(merchSalesKey, readCache<MerchSale>(merchSalesKey).filter((item) => item.id !== id)); queueData('sale', 'delete', id); return }
  const { error } = await supabase.from('merch_sales').delete().eq('id', id)
  if (error) throw error
  writeCache(merchSalesKey, readCache<MerchSale>(merchSalesKey).filter((item) => item.id !== id))
}

type Resource = BandPerson | BandMaterial | SetlistTemplate
type ResourceTable = 'band_people' | 'band_materials' | 'setlist_templates'
const resourceKeys: Record<ResourceTable, string> = { band_people: peopleKey, band_materials: materialsKey, setlist_templates: setlistsKey }
export async function listResource<T extends Resource>(table: ResourceTable): Promise<T[]> {
  return activeResources(await listAllResources<T>(table))
}

export async function listAllResources<T extends Resource>(table: ResourceTable): Promise<T[]> {
  if (!supabase || offline()) return readCache<T>(resourceKeys[table])
  const { data, error } = await supabase.from(table).select('*').order('name')
  if (error) throw error
  const rows = data as T[]
  writeCache(resourceKeys[table], rows)
  return rows
}

export async function saveResource<T extends Resource>(table: ResourceTable, resource: T): Promise<T> {
  if (!supabase) { const all = readCache<T>(resourceKeys[table]); const next = [...all.filter((item) => item.id !== resource.id), resource]; writeCache(resourceKeys[table], next); return resource }
  if (offline()) { const all = readCache<T>(resourceKeys[table]); writeCache(resourceKeys[table], [...all.filter((item) => item.id !== resource.id), resource]); return resource }
  const values = table === 'band_people'
    ? { id: resource.id, band_id: await bandId(), name: (resource as BandPerson).name, kind: (resource as BandPerson).kind, phone: (resource as BandPerson).phone, email: (resource as BandPerson).email, active: resource.active }
    : table === 'band_materials'
      ? { id: resource.id, band_id: await bandId(), name: (resource as BandMaterial).name, category: (resource as BandMaterial).category, active: resource.active }
      : { id: resource.id, band_id: await bandId(), name: (resource as SetlistTemplate).name, songs: (resource as SetlistTemplate).songs, active: resource.active }
  const { data, error } = await (supabase as any).from(table).upsert(values).select('*').single() as { data: T | null; error: Error | null }
  if (error) throw error
  const saved = data as T
  writeCache(resourceKeys[table], [...readCache<T>(resourceKeys[table]).filter((item) => item.id !== saved.id), saved])
  return saved
}
