import { createClient } from '@supabase/supabase-js'
import { type BandDocument, type Concert, type MerchProduct, type MerchSale, type MoneyMovement, emptyDetails } from './model'

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

function dateFromNow(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function demoConcerts(): Concert[] {
  return [
    {
      id: 'demo-1', title: 'Festa Major de la Plaça', date: dateFromNow(12), status: 'confirmat',
      venue: 'Plaça del Mercat', city: 'Vilabona', address: 'Plaça del Mercat, 1, Vilabona',
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
      venue: 'La Farinera', city: 'Girona', address: '', feeAmount: 850, feePaid: 0,
      details: { ...emptyDetails(), contactName: 'Jordi Puig', lodging: 'no' },
    },
    {
      id: 'demo-3', title: 'Cicle Sons de Tardor', date: dateFromNow(-16), status: 'realitzat',
      venue: 'Teatre Principal', city: 'Reus', address: 'Carrer Major, 12, Reus',
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
  address: string
  fee_amount: number
  fee_paid: number
  details: Concert['details']
}

function fromRow(row: ConcertRow): Concert {
  return {
    id: row.id, updatedAt: row.updated_at, title: row.title, date: row.date, status: row.status,
    venue: row.venue, city: row.city, address: row.address,
    feeAmount: Number(row.fee_amount), feePaid: Number(row.fee_paid),
    details: { ...emptyDetails(), ...row.details },
  }
}

function localConcerts(): Concert[] {
  const saved = localStorage.getItem(demoKey)
  if (!saved) return demoConcerts()
  try {
    return JSON.parse(saved) as Concert[]
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
    if (cached) return JSON.parse(cached) as Concert[]
    throw error
  }
}

export async function saveConcert(concert: Concert): Promise<Concert> {
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

export async function deleteConcert(id: string): Promise<void> {
  if (!supabase) {
    localStorage.setItem(demoKey, JSON.stringify(localConcerts().filter((item) => item.id !== id)))
    return
  }
  const { error } = await supabase.from('concerts').delete().eq('id', id)
  if (error) throw error
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
  if (!supabase) {
    try { return JSON.parse(localStorage.getItem(moneyKey) || '[]') as MoneyMovement[] }
    catch { return [] }
  }
  const { data, error } = await supabase.from('money_movements').select('*').order('date', { ascending: false }).order('created_at', { ascending: false })
  if (error) throw error
  return (data as MoneyRow[]).map(fromMoneyRow)
}

export async function saveMoneyMovement(movement: MoneyMovement): Promise<MoneyMovement> {
  if (!supabase) {
    const all = await listMoneyMovements()
    localStorage.setItem(moneyKey, JSON.stringify([movement, ...all.filter((item) => item.id !== movement.id)]))
    return movement
  }
  const { data, error } = await supabase.from('money_movements').upsert({
    id: movement.id, band_id: await bandId(), concert_id: movement.concertId || null,
    kind: movement.kind, amount: movement.amount, date: movement.date,
    category: movement.category.trim(), note: movement.note.trim(),
  }).select('*').single()
  if (error) throw error
  return fromMoneyRow(data as MoneyRow)
}

export async function deleteMoneyMovement(id: string): Promise<void> {
  if (!supabase) {
    const all = await listMoneyMovements()
    localStorage.setItem(moneyKey, JSON.stringify(all.filter((item) => item.id !== id)))
    return
  }
  const { error } = await supabase.from('money_movements').delete().eq('id', id)
  if (error) throw error
}

interface MerchProductRow { id: string; name: string; price: number; stock: number; active: boolean }
interface MerchSaleRow { id: string; concert_id: string; product_id: string; quantity: number; unit_price: number; note: string }
function fromMerchProduct(row: MerchProductRow): MerchProduct { return { id: row.id, name: row.name, price: Number(row.price), stock: Number(row.stock), active: row.active } }
function fromMerchSale(row: MerchSaleRow): MerchSale { return { id: row.id, concertId: row.concert_id, productId: row.product_id, quantity: Number(row.quantity), unitPrice: Number(row.unit_price), note: row.note } }

export async function listMerchProducts(): Promise<MerchProduct[]> {
  if (!supabase) { try { return JSON.parse(localStorage.getItem(merchProductsKey) || '[]') as MerchProduct[] } catch { return [] } }
  const { data, error } = await supabase.from('merch_products').select('*').order('name')
  if (error) throw error
  return (data as MerchProductRow[]).map(fromMerchProduct)
}

export async function saveMerchProduct(product: MerchProduct): Promise<MerchProduct> {
  if (!supabase) { const all = await listMerchProducts(); localStorage.setItem(merchProductsKey, JSON.stringify([...all.filter((item) => item.id !== product.id), product])); return product }
  const { data, error } = await supabase.from('merch_products').upsert({ id: product.id, band_id: await bandId(), name: product.name.trim(), price: product.price, stock: product.stock, active: product.active }).select('*').single()
  if (error) throw error
  return fromMerchProduct(data as MerchProductRow)
}

export async function listMerchSales(): Promise<MerchSale[]> {
  if (!supabase) { try { return JSON.parse(localStorage.getItem(merchSalesKey) || '[]') as MerchSale[] } catch { return [] } }
  const { data, error } = await supabase.from('merch_sales').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return (data as MerchSaleRow[]).map(fromMerchSale)
}

export async function saveMerchSale(sale: MerchSale): Promise<MerchSale> {
  if (!supabase) { const all = await listMerchSales(); localStorage.setItem(merchSalesKey, JSON.stringify([sale, ...all.filter((item) => item.id !== sale.id)])); return sale }
  const { data, error } = await supabase.from('merch_sales').insert({ id: sale.id, band_id: await bandId(), concert_id: sale.concertId, product_id: sale.productId, quantity: sale.quantity, unit_price: sale.unitPrice, note: sale.note.trim() }).select('*').single()
  if (error) throw error
  return fromMerchSale(data as MerchSaleRow)
}

export async function deleteMerchSale(id: string): Promise<void> {
  if (!supabase) { const all = await listMerchSales(); localStorage.setItem(merchSalesKey, JSON.stringify(all.filter((item) => item.id !== id))); return }
  const { error } = await supabase.from('merch_sales').delete().eq('id', id)
  if (error) throw error
}
