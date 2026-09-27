import { createClient } from '@supabase/supabase-js'
import { type BandDocument, type BandMaterial, type BandPerson, type Concert, type LabelAgreement, type MerchProduct, type MerchSale, type MoneyMovement, type SetlistTemplate, emptyDetails, validateLabelAgreement } from './model'

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
const offlineSyncErrorsKey = 'escena-offline-sync-errors-v1'
const peopleKey = 'escena-demo-people-v1'
const materialsKey = 'escena-demo-materials-v1'
const setlistsKey = 'escena-demo-setlists-v1'
const bandNameKey = 'escena-demo-band-name-v1'
const bandLogoKey = 'escena-demo-band-logo-v1'
const bandLogoUrlCacheKey = 'escena-band-logo-url-v1'
const bandLabelKey = 'escena-band-label-v1'
const defaultBandName = 'La nostra banda'

export const backupVersion = 1
export interface AppBackup {
  version: number
  exportedAt: string
  theme?: string
  workspaceName?: string
  labelAgreement?: LabelAgreement | null
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
  const [concerts, library, money, merchProducts, merchSales, people, materials, setlists, workspaceName, labelAgreement] = await Promise.all([listConcerts(), listBandDocuments(), listMoneyMovements(), listMerchProducts(), listMerchSales(), listAllResources<BandPerson>('band_people'), listAllResources<BandMaterial>('band_materials'), listAllResources<SetlistTemplate>('setlist_templates'), getBandName(), getBandLabel()])
  return { version: backupVersion, exportedAt: new Date().toISOString(), theme: localStorage.getItem('escena-theme') || undefined, workspaceName, labelAgreement, concerts, library, money, merchProducts, merchSales, people, materials, setlists }
}

function validLabel(value: unknown): boolean {
  if (value === null) return true
  if (!isRecord(value) || typeof value.name !== 'string' || !Array.isArray(value.tiers) || !value.tiers.every((tier) => isRecord(tier) && typeof tier.above === 'number' && typeof tier.percent === 'number')) return false
  try { validateLabelAgreement(value as unknown as LabelAgreement); return true } catch { return false }
}

export function validateBackup(value: unknown): value is AppBackup {
  if (!isRecord(value)) return false
  const backup = value as Partial<AppBackup>
  const hasId = (item: unknown) => isRecord(item) && typeof item.id === 'string' && item.id.length > 0
  const nonNegative = (item: unknown) => typeof item === 'number' && Number.isFinite(item) && item >= 0
  const isDate = (item: unknown) => {
    if (typeof item !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(item)) return false
    const date = new Date(`${item}T00:00:00Z`)
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === item
  }
  const validDocument = (item: unknown) => isRecord(item) && hasId(item) && typeof item.name === 'string' && typeof item.url === 'string' && (item.direction === 'enviar' || item.direction === 'rebre') && (item.status === 'pendent' || item.status === 'fet' || item.status === 'no_cal') && (item.storagePath === undefined || typeof item.storagePath === 'string') && (item.fileName === undefined || typeof item.fileName === 'string')
  const validConcertMaterial = (item: unknown) => isRecord(item) && hasId(item) && typeof item.name === 'string' && typeof item.loaded === 'boolean' && (item.category === undefined || typeof item.category === 'string')
  const validScheduleItem = (item: unknown) => isRecord(item) && hasId(item) && ['time', 'label', 'place', 'kind'].every((key) => item[key] === undefined || typeof item[key] === 'string')
  return backup.version === backupVersion && (backup.workspaceName === undefined || (typeof backup.workspaceName === 'string' && backup.workspaceName.trim().length > 0 && backup.workspaceName.length <= 80))
    && (backup.labelAgreement === undefined || validLabel(backup.labelAgreement))
    && Array.isArray(backup.concerts) && backup.concerts.every((item) => hasId(item) && typeof item.title === 'string' && isDate(item.date) && ['en_converses', 'reservat', 'confirmat', 'realitzat', 'cancel·lat'].includes(String(item.status)) && nonNegative(item.feeAmount) && nonNegative(item.feePaid) && isRecord(item.details) && Array.isArray(item.details.documents) && item.details.documents.every(validDocument) && Array.isArray(item.details.materials) && item.details.materials.every(validConcertMaterial) && (item.details.schedule === undefined || (Array.isArray(item.details.schedule) && item.details.schedule.every(validScheduleItem))) && (item.details.personIds === undefined || (Array.isArray(item.details.personIds) && item.details.personIds.every((id) => typeof id === 'string'))))
    && Array.isArray(backup.library) && backup.library.every((item) => hasId(item) && typeof item.name === 'string' && typeof item.url === 'string' && (item.archived === undefined || typeof item.archived === 'boolean') && (item.storagePath === undefined || typeof item.storagePath === 'string') && (item.fileName === undefined || typeof item.fileName === 'string'))
    && Array.isArray(backup.money) && backup.money.every((item) => hasId(item) && (item.kind === 'ingres' || item.kind === 'despesa') && nonNegative(item.amount) && isDate(item.date) && (item.category === undefined || typeof item.category === 'string') && (item.note === undefined || typeof item.note === 'string') && (item.concertId === undefined || typeof item.concertId === 'string'))
    && Array.isArray(backup.merchProducts) && backup.merchProducts.every((item) => hasId(item) && typeof item.name === 'string' && nonNegative(item.price) && Number.isSafeInteger(item.stock) && nonNegative(item.stock) && (item.active === undefined || typeof item.active === 'boolean') && (item.sizes === undefined || (Array.isArray(item.sizes) && item.sizes.every((size) => isRecord(size) && typeof size.name === 'string' && Number.isSafeInteger(size.stock) && nonNegative(size.stock)))))
    && Array.isArray(backup.merchSales) && backup.merchSales.every((item) => hasId(item) && typeof item.concertId === 'string' && typeof item.productId === 'string' && typeof item.quantity === 'number' && Number.isSafeInteger(item.quantity) && item.quantity > 0 && nonNegative(item.unitPrice) && (item.note === undefined || typeof item.note === 'string') && (item.size === undefined || typeof item.size === 'string'))
    && Array.isArray(backup.people) && backup.people.every((item) => hasId(item) && typeof item.name === 'string' && (item.active === undefined || typeof item.active === 'boolean'))
    && Array.isArray(backup.materials) && backup.materials.every((item) => hasId(item) && typeof item.name === 'string' && (item.active === undefined || typeof item.active === 'boolean') && (item.category === undefined || typeof item.category === 'string'))
    && Array.isArray(backup.setlists) && backup.setlists.every((item) => hasId(item) && typeof item.name === 'string' && (item.active === undefined || typeof item.active === 'boolean') && Array.isArray(item.songs) && item.songs.every((song) => typeof song === 'string'))
}

export async function getBandName(): Promise<string> {
  if (!supabase || offline()) return localStorage.getItem(bandNameKey) || defaultBandName
  const { data, error } = await supabase.from('bands').select('name').eq('id', await bandId()).single()
  if (error) throw error
  const name = data.name?.trim() || defaultBandName
  localStorage.setItem(bandNameKey, name)
  return name
}

export function getCachedBandLabel(): LabelAgreement | null {
  if (supabase) return null
  try { const saved: unknown = JSON.parse(localStorage.getItem(bandLabelKey) || 'null'); return validLabel(saved) ? saved as LabelAgreement | null : null } catch { return null }
}

export async function getBandLabel(): Promise<LabelAgreement | null> {
  if (!supabase) return getCachedBandLabel()
  const { data: auth } = await supabase.auth.getSession()
  if (!auth.session) throw new Error('Cal iniciar sessió per consultar la discogràfica.')
  const cacheKey = `${bandLabelKey}-${auth.session.user.id}`
  if (offline()) {
    const cached = localStorage.getItem(cacheKey)
    if (cached === null) throw new Error('No hi ha cap configuració de discogràfica disponible sense connexió.')
    const value: unknown = JSON.parse(cached)
    if (!validLabel(value)) throw new Error('La configuració guardada no és vàlida.')
    return value as LabelAgreement | null
  }
  const { data, error } = await supabase.from('bands').select('label_name,label_tiers').eq('id', await bandId()).single()
  if (error) throw error
  const label = data.label_name ? validateLabelAgreement({ name: data.label_name, tiers: data.label_tiers }) : null
  localStorage.setItem(cacheKey, JSON.stringify(label))
  return label
}

export async function saveBandLabel(value: LabelAgreement | null): Promise<LabelAgreement | null> {
  const label = value ? validateLabelAgreement(value) : null
  if (supabase) {
    if (offline()) throw new Error('Connecta’t a internet per canviar les condicions de la discogràfica.')
    const { error } = await supabase.from('bands').update({ label_name: label?.name || '', label_tiers: label?.tiers || [] }).eq('id', await bandId())
    if (error) throw error
  }
  const { data: auth } = supabase ? await supabase.auth.getSession() : { data: { session: null } }
  const cacheKey = supabase && auth.session ? `${bandLabelKey}-${auth.session.user.id}` : bandLabelKey
  localStorage.setItem(cacheKey, JSON.stringify(label))
  return label
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
  localStorage.setItem(libraryKey, JSON.stringify(backup.library.map((item) => ({ ...item, archived: item.archived ?? false }))))
  localStorage.setItem(moneyKey, JSON.stringify(backup.money.map((item) => ({ ...item, category: item.category || '', note: item.note || '' }))))
  localStorage.setItem(merchProductsKey, JSON.stringify(backup.merchProducts.map((item) => ({ ...item, active: item.active ?? true }))))
  localStorage.setItem(merchSalesKey, JSON.stringify(backup.merchSales.map((item) => ({ ...item, note: item.note || '' }))))
  localStorage.setItem(peopleKey, JSON.stringify(backup.people.map((item) => ({ ...item, active: item.active ?? true }))))
  localStorage.setItem(materialsKey, JSON.stringify(backup.materials.map((item) => ({ ...item, active: item.active ?? true, category: item.category || '' }))))
  localStorage.setItem(setlistsKey, JSON.stringify(backup.setlists.map((item) => ({ ...item, active: item.active ?? true }))))
  if (backup.theme) localStorage.setItem('escena-theme', backup.theme)
  if (backup.workspaceName) localStorage.setItem(bandNameKey, backup.workspaceName)
  if (backup.labelAgreement !== undefined) localStorage.setItem(bandLabelKey, JSON.stringify(backup.labelAgreement))
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
    return saveBandDocument({ ...document, archived: document.archived ?? false, storagePath, fileName: storagePath ? document.fileName : undefined })
  }))
  await Promise.all(backup.money.map((item) => saveMoneyMovement({ ...item, category: item.category || '', note: item.note || '' })))
  await Promise.all(backup.merchProducts.map((item) => saveMerchProduct({ ...item, active: item.active ?? true })))
  await Promise.all(backup.people.map((item) => saveResource('band_people', { ...item, active: item.active ?? true })))
  await Promise.all(backup.materials.map((item) => saveResource('band_materials', { ...item, active: item.active ?? true, category: item.category || '' })))
  await Promise.all(backup.setlists.map((item) => saveResource('setlist_templates', { ...item, active: item.active ?? true })))
  for (const sale of backup.merchSales) {
    if (!currentSaleIds.has(sale.id)) await saveMerchSale({ ...sale, note: sale.note || '' })
  }
  if (backup.theme) localStorage.setItem('escena-theme', backup.theme)
  if (backup.workspaceName) await saveBandName(backup.workspaceName)
  if (backup.labelAgreement !== undefined) await saveBandLabel(backup.labelAgreement)
}

function offline(): boolean { return typeof navigator !== 'undefined' && !navigator.onLine }
function readCache<T>(key: string): T[] { try { return JSON.parse(localStorage.getItem(key) || '[]') as T[] } catch { return [] } }
function writeCache<T>(key: string, value: T[]): void { localStorage.setItem(key, JSON.stringify(value)) }
export function activeResources<T extends { active: boolean }>(items: T[]): T[] { return items.filter((item) => item.active) }

interface OfflineSyncError { key: string; message: string; conflict: boolean; updatedAt: string }
export interface OfflineSyncItem { key: string; id: string; kind: 'concert' | 'data'; entity?: OfflineDataEntity; label: string; message?: string; conflict: boolean }
export interface OfflineSyncStatus { pending: number; failed: number; items: OfflineSyncItem[] }
export type OfflineDataEntity = 'money' | 'product' | 'sale' | 'resource'
interface OfflineDataOperation { id: string; entity: OfflineDataEntity; action: 'save' | 'delete'; payload: unknown; hasBase?: boolean; base?: unknown }

function offlineErrors(): OfflineSyncError[] { return readCache<OfflineSyncError>(offlineSyncErrorsKey) }
function notifyOfflineQueueChange(): void { if (typeof window !== 'undefined') window.dispatchEvent(new Event('escena:offline-queue-change')) }
function clearOfflineError(key: string): void { writeCache(offlineSyncErrorsKey, offlineErrors().filter((item) => item.key !== key)) }
function setOfflineError(key: string, cause: unknown): void {
  const message = cause instanceof Error ? cause.message : 'No s’ha pogut sincronitzar aquest canvi.'
  const error: OfflineSyncError = { key, message, conflict: /ha canviat|ja no existeix/i.test(message), updatedAt: new Date().toISOString() }
  writeCache(offlineSyncErrorsKey, [...offlineErrors().filter((item) => item.key !== key), error])
  notifyOfflineQueueChange()
}

export function getOfflineSyncStatus(): OfflineSyncStatus {
  const items: OfflineSyncItem[] = []
  const errors = new Map(offlineErrors().map((item) => [item.key, item]))
  const queuedConcerts = readCache<Concert>(offlineQueueKey)
  const queuedData = readCache<OfflineDataOperation>(offlineDataQueueKey)
  for (const concert of queuedConcerts) {
    const key = `concert:${concert.id}`
    const issue = errors.get(key)
    items.push({ key, id: concert.id, kind: 'concert', label: concert.title || 'Concert sense nom', message: issue?.message, conflict: issue?.conflict || false })
  }
  for (const operation of queuedData) {
    const key = `${operation.entity}:${operation.id}`
    const issue = errors.get(key)
    const entityLabels = { money: 'moviment', product: 'producte', sale: 'venda', resource: 'recurs de banda' }
    const payload = operation.entity === 'resource' ? (operation.payload as { value?: { name?: string } }).value : operation.payload
    const label = payload && typeof payload === 'object' && 'name' in payload ? String((payload as { name: unknown }).name) : entityLabels[operation.entity]
    items.push({ key, id: operation.id, kind: 'data', entity: operation.entity, label, message: issue?.message, conflict: issue?.conflict || false })
  }
  return { pending: items.length, failed: items.filter((item) => item.message).length, items }
}

function normalizeConcert(concert: Concert): Concert {
  const details = { ...emptyDetails(), ...(isRecord(concert.details) ? concert.details : {}) } as Concert['details']
  return {
    ...concert,
    country: typeof concert.country === 'string' ? concert.country : '',
    details: {
      ...details,
      documents: Array.isArray(details.documents) ? details.documents : [],
      materials: Array.isArray(details.materials) ? details.materials : [],
      schedule: Array.isArray(details.schedule) ? details.schedule : [],
      personIds: Array.isArray(details.personIds) ? details.personIds : [],
    },
  }
}

function queueData(entity: OfflineDataEntity, action: 'save' | 'delete', payload: unknown, base?: unknown, hasBase = false): void {
  const queue = readCache<{ id: string; entity: string; action: string; payload: unknown }>(offlineDataQueueKey)
  const id = typeof payload === 'string' ? payload : (payload as { id: string }).id
  const existing = queue.find((item) => item.entity === entity && item.id === id) as OfflineDataOperation | undefined
  const preservedBase = existing?.hasBase ? existing.base : base
  const preservedHasBase = existing?.hasBase ?? hasBase
  writeCache(offlineDataQueueKey, [...queue.filter((item) => !(item.entity === entity && item.id === id)), { id, entity, action, payload, base: preservedBase, hasBase: preservedHasBase }])
  clearOfflineError(`${entity}:${id}`)
  notifyOfflineQueueChange()
}

function canonicalOfflineValue(entity: OfflineDataEntity, value: unknown, table?: ResourceTable): unknown {
  if (!isRecord(value)) return value ?? null
  if (entity === 'money') return { id: value.id, concertId: value.concertId || undefined, kind: value.kind, amount: Number(value.amount), date: value.date, category: value.category || '', note: value.note || '' }
  if (entity === 'product') return { id: value.id, name: value.name, price: Number(value.price), stock: Number(value.stock), active: value.active, sizes: value.sizes || [] }
  if (entity === 'resource') {
    const resource = value.value && isRecord(value.value) ? value.value : value
    const resourceTable = table || (typeof value.table === 'string' ? value.table as ResourceTable : undefined)
    if (resourceTable === 'band_people') return { id: resource.id, name: resource.name, kind: resource.kind, phone: resource.phone || '', email: resource.email || '', active: resource.active }
    if (resourceTable === 'band_materials') return { id: resource.id, name: resource.name, category: resource.category || '', active: resource.active }
    if (resourceTable === 'setlist_templates') return { id: resource.id, name: resource.name, songs: resource.songs || [], active: resource.active }
  }
  return value
}

async function ensureNoOfflineDataConflict(operation: OfflineDataOperation): Promise<void> {
  if (!supabase || !operation.hasBase || operation.entity === 'sale') return
  const table = operation.entity === 'money' ? 'money_movements' : operation.entity === 'product' ? 'merch_products' : (operation.payload as { table?: ResourceTable }).table
  if (!table) return
  const { data, error } = await (supabase as any).from(table).select('*').eq('id', operation.id).maybeSingle() as { data: Record<string, unknown> | null; error: Error | null }
  if (error) throw error
  let remote: unknown = null
  if (data) {
    if (operation.entity === 'money') remote = canonicalOfflineValue('money', { id: data.id, concertId: data.concert_id || undefined, kind: data.kind, amount: Number(data.amount), date: data.date, category: data.category, note: data.note })
    else if (operation.entity === 'product') remote = canonicalOfflineValue('product', fromMerchProduct(data as unknown as MerchProductRow))
    else remote = canonicalOfflineValue('resource', data, (operation.payload as { table: ResourceTable }).table)
  }
  const base = canonicalOfflineValue(operation.entity, operation.base, (operation.payload as { table?: ResourceTable }).table)
  if (JSON.stringify(remote) !== JSON.stringify(base)) {
    const noun = operation.entity === 'money' ? 'moviment' : operation.entity === 'product' ? 'producte' : 'recurs de banda'
    throw new Error(`El ${noun} ha canviat al servidor mentre l’editaves sense connexió. Tria quina versió vols conservar.`)
  }
}

async function fetchOfflineDataVersion(operation: OfflineDataOperation): Promise<unknown | null> {
  if (!supabase) return null
  const table = operation.entity === 'money' ? 'money_movements' : operation.entity === 'product' ? 'merch_products' : operation.entity === 'resource' ? (operation.payload as { table?: ResourceTable }).table : undefined
  if (!table) return null
  const { data, error } = await (supabase as any).from(table).select('*').eq('id', operation.id).maybeSingle() as { data: Record<string, unknown> | null; error: Error | null }
  if (error) throw error
  if (!data) return null
  if (operation.entity === 'money') return canonicalOfflineValue('money', { id: data.id, concertId: data.concert_id || undefined, kind: data.kind, amount: Number(data.amount), date: data.date, category: data.category, note: data.note })
  if (operation.entity === 'product') return canonicalOfflineValue('product', fromMerchProduct(data as unknown as MerchProductRow))
  return canonicalOfflineValue('resource', data, (operation.payload as { table: ResourceTable }).table)
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
    for (const queued of readCache<Concert>(offlineQueueKey)) {
      const index = concerts.findIndex((concert) => concert.id === queued.id)
      if (index >= 0) concerts[index] = queued
      else concerts.push(queued)
    }
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
  if (concert.details.management === 'discografica') {
    if (!concert.details.labelAgreement) throw new Error('Indica les condicions de la discogràfica abans de desar el concert.')
    concert = { ...concert, details: { ...concert.details, labelAgreement: validateLabelAgreement(concert.details.labelAgreement) } }
  } else if (concert.details.labelAgreement) concert = { ...concert, details: { ...concert.details, labelAgreement: undefined } }
  if (!supabase) {
    const next = localConcerts().filter((item) => item.id !== concert.id)
    const saved = { ...concert, updatedAt: new Date().toISOString() }
    localStorage.setItem(demoKey, JSON.stringify([...next, saved]))
    return saved
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const queued = JSON.parse(localStorage.getItem(offlineQueueKey) || '[]') as Concert[]
    localStorage.setItem(offlineQueueKey, JSON.stringify([...queued.filter((item) => item.id !== concert.id), concert]))
    clearOfflineError(`concert:${concert.id}`)
    const cached = JSON.parse(localStorage.getItem(offlineConcertsKey) || '[]') as Concert[]
    const saved = { ...concert, updatedAt: concert.updatedAt || new Date().toISOString() }
    localStorage.setItem(offlineConcertsKey, JSON.stringify([...cached.filter((item) => item.id !== concert.id), saved]))
    notifyOfflineQueueChange()
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
    try { await saveConcert(concert); synced += 1; clearOfflineError(`concert:${concert.id}`) }
    catch (cause) {
      remaining.push(concert)
      const latest = readCache<Concert>(offlineQueueKey).find((item) => item.id === concert.id)
      if (latest && JSON.stringify(latest) === JSON.stringify(concert)) setOfflineError(`concert:${concert.id}`, cause)
    }
  }
  const latest = readCache<Concert>(offlineQueueKey)
  const failedIds = new Set(remaining.map((concert) => concert.id))
  localStorage.setItem(offlineQueueKey, JSON.stringify(latest.filter((concert) => {
    if (failedIds.has(concert.id)) return true
    const beforeSync = queued.find((item) => item.id === concert.id)
    return !beforeSync || JSON.stringify(beforeSync) !== JSON.stringify(concert)
  })))
  notifyOfflineQueueChange()
  return synced
}

export async function resolveOfflineConcertConflict(id: string, choice: 'local' | 'server'): Promise<Concert | null> {
  if (!supabase || offline()) throw new Error('Connecta’t a internet per resoldre el conflicte.')
  const queued = readCache<Concert>(offlineQueueKey)
  const local = queued.find((item) => item.id === id)
  if (!local) return null
  const { data, error } = await supabase.from('concerts').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  const latest = data ? fromRow(data as ConcertRow) : null

  if (choice === 'local') {
    if (!latest) throw new Error('El concert s’ha eliminat al servidor. Tria «Fer servir servidor» per descartar els canvis locals.')
    const rebased = { ...local, updatedAt: latest.updatedAt }
    localStorage.setItem(offlineQueueKey, JSON.stringify([...queued.filter((item) => item.id !== id), rebased]))
    const cache = readCache<Concert>(offlineConcertsKey)
    localStorage.setItem(offlineConcertsKey, JSON.stringify([...cache.filter((item) => item.id !== id), rebased]))
    clearOfflineError(`concert:${id}`)
    notifyOfflineQueueChange()
    return rebased
  }

  localStorage.setItem(offlineQueueKey, JSON.stringify(queued.filter((item) => item.id !== id)))
  const cache = readCache<Concert>(offlineConcertsKey)
  localStorage.setItem(offlineConcertsKey, JSON.stringify(latest
    ? [...cache.filter((item) => item.id !== id), latest]
    : cache.filter((item) => item.id !== id)))
  clearOfflineError(`concert:${id}`)
  notifyOfflineQueueChange()
  return latest
}

export async function resolveOfflineDataConflict(id: string, entity: Exclude<OfflineDataEntity, 'sale'>, choice: 'local' | 'server'): Promise<void> {
  if (!supabase || offline()) throw new Error('Connecta’t a internet per resoldre el conflicte.')
  const queued = readCache<OfflineDataOperation>(offlineDataQueueKey)
  const original = queued.find((item) => item.id === id && item.entity === entity)
  if (!original) return
  const latest = await fetchOfflineDataVersion(original)
  const currentQueue = readCache<OfflineDataOperation>(offlineDataQueueKey)
  const current = currentQueue.find((item) => item.id === id && item.entity === entity)
  if (!current || JSON.stringify(current) !== JSON.stringify(original)) throw new Error('Aquest canvi offline s’ha tornat a editar. Recarrega i resol el conflicte més recent.')

  const removeQueued = () => writeCache(offlineDataQueueKey, currentQueue.filter((item) => !(item.id === id && item.entity === entity)))
  if (choice === 'local' && !(original.action === 'delete' && latest === null)) {
    const rebased = { ...original, base: latest, hasBase: true }
    writeCache(offlineDataQueueKey, [...currentQueue.filter((item) => !(item.id === id && item.entity === entity)), rebased])
  } else {
    removeQueued()
    if (entity === 'money') writeCache(moneyKey, latest ? [...readCache<MoneyMovement>(moneyKey).filter((item) => item.id !== id), latest as MoneyMovement] : readCache<MoneyMovement>(moneyKey).filter((item) => item.id !== id))
    else if (entity === 'product') writeCache(merchProductsKey, latest ? [...readCache<MerchProduct>(merchProductsKey).filter((item) => item.id !== id), latest as MerchProduct] : readCache<MerchProduct>(merchProductsKey).filter((item) => item.id !== id))
    else {
      const table = (original.payload as { table: ResourceTable }).table
      const cacheKey = resourceKeys[table]
      const resources = readCache<Resource>(cacheKey).filter((item) => item.id !== id)
      writeCache(cacheKey, latest ? [...resources, latest as Resource] : resources)
    }
  }
  clearOfflineError(`${entity}:${id}`)
  notifyOfflineQueueChange()
}

export function discardOfflineDataChange(id: string, entity: OfflineDataEntity): void {
  const queue = readCache<OfflineDataOperation>(offlineDataQueueKey)
  const operation = queue.find((item) => item.id === id && item.entity === entity)
  if (!operation) return
  const remaining = queue.filter((item) => !(item.id === id && item.entity === entity))
  const restore = <T extends { id: string }>(key: string, value: T | undefined) => {
    const current = readCache<T>(key).filter((item) => item.id !== id)
    writeCache(key, value ? [...current, value] : current)
  }
  if (entity === 'money') restore(moneyKey, operation.base as MoneyMovement | null || undefined)
  else if (entity === 'product') restore(merchProductsKey, operation.base as MerchProduct | null || undefined)
  else if (entity === 'sale') restore(merchSalesKey, operation.base as MerchSale | null || undefined)
  else {
    const table = (operation.payload as { table: ResourceTable }).table
    restore(resourceKeys[table], operation.base as Resource | null || undefined)
  }
  writeCache(offlineDataQueueKey, remaining)
  clearOfflineError(`${entity}:${id}`)
  notifyOfflineQueueChange()
}

export async function syncOfflineData(): Promise<number> {
  if (!supabase || offline()) return 0
  const queue = readCache<{ id: string; entity: 'money' | 'product' | 'sale' | 'resource'; action: 'save' | 'delete'; payload: unknown }>(offlineDataQueueKey)
  const remaining = [...queue]
  let synced = 0
  for (const operation of queue) {
    try {
      await ensureNoOfflineDataConflict(operation)
      if (operation.entity === 'money') {
        if (operation.action === 'save') await saveMoneyMovement(operation.payload as MoneyMovement)
        else await deleteMoneyMovement(operation.id)
      } else if (operation.entity === 'product' && operation.action === 'save') await saveMerchProduct(operation.payload as MerchProduct)
      else if (operation.entity === 'resource' && operation.action === 'save') {
        const resource = operation.payload as { table: ResourceTable; value: Resource }
        await saveResource(resource.table, resource.value)
      }
      else if (operation.entity === 'sale') {
        if (operation.action === 'save') await saveMerchSale(operation.payload as MerchSale)
        else await deleteMerchSale(operation.id)
      }
      const index = remaining.findIndex((item) => item.id === operation.id && item.entity === operation.entity)
      if (index >= 0) remaining.splice(index, 1)
      synced += 1
      clearOfflineError(`${operation.entity}:${operation.id}`)
    } catch (cause) {
      const latest = readCache<typeof queue[number]>(offlineDataQueueKey).find((item) => item.id === operation.id && item.entity === operation.entity)
      if (latest && JSON.stringify(latest) === JSON.stringify(operation)) setOfflineError(`${operation.entity}:${operation.id}`, cause)
      /* Keep the latest version visible for retry. */
    }
  }
  const latest = readCache<typeof queue[number]>(offlineDataQueueKey)
  const failedKeys = new Set(remaining.map((item) => `${item.entity}:${item.id}`))
  writeCache(offlineDataQueueKey, latest.filter((item) => {
    const key = `${item.entity}:${item.id}`
    if (failedKeys.has(key)) return true
    const beforeSync = queue.find((operation) => `${operation.entity}:${operation.id}` === key)
    return !beforeSync || JSON.stringify(beforeSync) !== JSON.stringify(item)
  }))
  notifyOfflineQueueChange()
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
  if (offline()) { const all = readCache<MoneyMovement>(moneyKey); const previous = all.find((item) => item.id === movement.id) ?? null; const saved = { ...movement }; writeCache(moneyKey, [saved, ...all.filter((item) => item.id !== saved.id)]); queueData('money', 'save', saved, previous, true); return saved }
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
  if (offline()) { const all = readCache<MoneyMovement>(moneyKey); const previous = all.find((item) => item.id === id) ?? null; writeCache(moneyKey, all.filter((item) => item.id !== id)); queueData('money', 'delete', id, previous, true); return }
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
  if (offline()) { const all = readCache<MerchProduct>(merchProductsKey); const previous = all.find((item) => item.id === product.id) ?? null; writeCache(merchProductsKey, [...all.filter((item) => item.id !== product.id), product]); queueData('product', 'save', product, previous, true); return product }
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
  if (error) {
    // An insert may have reached Postgres even when the client lost the response. Reuse its UUID as an idempotency key.
    const { data: alreadySaved } = await supabase.from('merch_sales').select('*').eq('id', sale.id).maybeSingle()
    if (!alreadySaved) throw error
    const saved = fromMerchSale(alreadySaved as MerchSaleRow)
    const all = readCache<MerchSale>(merchSalesKey)
    writeCache(merchSalesKey, [saved, ...all.filter((item) => item.id !== saved.id)])
    return saved
  }
  const saved = fromMerchSale(data as MerchSaleRow); const all = readCache<MerchSale>(merchSalesKey); writeCache(merchSalesKey, [saved, ...all.filter((item) => item.id !== saved.id)]); return saved
}

export async function deleteMerchSale(id: string): Promise<void> {
  if (!supabase) { const all = await listMerchSales(); localStorage.setItem(merchSalesKey, JSON.stringify(all.filter((item) => item.id !== id))); return }
  if (offline()) { const all = readCache<MerchSale>(merchSalesKey); const previous = all.find((item) => item.id === id) ?? null; writeCache(merchSalesKey, all.filter((item) => item.id !== id)); queueData('sale', 'delete', id, previous, true); return }
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
  if (offline()) { const all = readCache<T>(resourceKeys[table]); const previous = all.find((item) => item.id === resource.id) ?? null; writeCache(resourceKeys[table], [...all.filter((item) => item.id !== resource.id), resource]); queueData('resource', 'save', { id: resource.id, table, value: resource }, previous, true); return resource }
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
