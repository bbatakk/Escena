export type ConcertStatus = 'en_converses' | 'reservat' | 'confirmat' | 'realitzat' | 'cancel·lat'
export type Answer = 'pendent' | 'si' | 'no'
export type DocumentStatus = 'pendent' | 'fet' | 'no_cal'

export interface ScheduleItem {
  id: string
  label: string
  time: string
  place: string
  kind?: string
}

export interface ConcertDocument {
  id: string
  name: string
  direction: 'enviar' | 'rebre'
  status: DocumentStatus
  url: string
  storagePath?: string
  fileName?: string
  libraryId?: string
}

export interface BandDocument {
  id: string
  name: string
  url: string
  storagePath?: string
  fileName?: string
  archived: boolean
}

export type MoneyMovementKind = 'ingres' | 'despesa'

export interface MoneyMovement {
  id: string
  concertId?: string
  kind: MoneyMovementKind
  amount: number
  date: string
  category: string
  note: string
}

export interface MerchProduct {
  id: string
  name: string
  price: number
  stock: number
  active: boolean
}

export interface MerchSale {
  id: string
  concertId: string
  productId: string
  quantity: number
  unitPrice: number
  note: string
}

export interface MaterialItem {
  id: string
  name: string
  loaded: boolean
  catalogId?: string
}

export type PersonKind = 'musica' | 'tecnic' | 'manager' | 'contacte'
export interface BandPerson { id: string; name: string; kind: PersonKind; phone: string; email: string; active: boolean }
export interface BandMaterial { id: string; name: string; category: string; active: boolean }
export interface SetlistTemplate { id: string; name: string; songs: string[]; active: boolean }

export interface ConcertDetails {
  conditions: string
  cancellation: string
  contactName: string
  contactPhone: string
  contactEmail: string
  team: string
  personIds: string[]
  travel: string
  loadIn: string
  parking: string
  dinner: Answer
  dinnerDetails: string
  lodging: Answer
  lodgingDetails: string
  lodgingAddress: string
  schedule: ScheduleItem[]
  documents: ConcertDocument[]
  materials: MaterialItem[]
  setlist: string
  setlistTemplateId?: string
  passes: string
  merchSales: number
  expenses: number
  notes: string
}

export interface Concert {
  id: string
  updatedAt?: string
  title: string
  date: string
  status: ConcertStatus
  venue: string
  city: string
  address: string
  feeAmount: number
  feePaid: number
  details: ConcertDetails
}

export const statusLabels: Record<ConcertStatus, string> = {
  en_converses: 'En converses',
  reservat: 'Reservat',
  confirmat: 'Confirmat',
  realitzat: 'Realitzat',
  'cancel·lat': 'Cancel·lat',
}

export function emptyDetails(): ConcertDetails {
  return {
    conditions: '', cancellation: '', contactName: '', contactPhone: '', contactEmail: '',
    team: '', personIds: [], travel: '', loadIn: '', parking: '', dinner: 'pendent', dinnerDetails: '',
    lodging: 'pendent', lodgingDetails: '', lodgingAddress: '', schedule: [], documents: [], materials: [],
    setlist: '', passes: '', merchSales: 0, expenses: 0, notes: '',
  }
}

export function createId(): string {
  if (crypto.randomUUID) return crypto.randomUUID()
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function newConcert(): Concert {
  return {
    id: createId(), title: '', date: '', status: 'en_converses', venue: '',
    city: '', address: '', feeAmount: 0, feePaid: 0, details: emptyDetails(),
  }
}

export function getPending(concert: Concert): string[] {
  if (concert.status === 'cancel·lat') return []
  const pending: string[] = []
  const d = concert.details
  if (concert.status === 'reservat') pending.push('Confirmar el concert')
  if (concert.status === 'confirmat' && !concert.address.trim() && !concert.venue.trim()) {
    pending.push('Concretar la ubicació')
  }
  if (d.lodging === 'si' && !d.lodgingAddress.trim()) pending.push('Concretar l’allotjament')
  for (const document of d.documents) {
    if (document.status === 'pendent' && document.name.trim()) {
      pending.push(`${document.direction === 'enviar' ? 'Enviar' : 'Rebre'} ${document.name}`)
    }
  }
  if (concert.status === 'realitzat' && concert.feeAmount > concert.feePaid) {
    pending.push('Cobrar el catxet pendent')
  }
  return pending
}

export function formatDate(date: string, options?: Intl.DateTimeFormatOptions): string {
  if (!date) return 'Data per concretar'
  return new Intl.DateTimeFormat('ca-ES', options ?? { day: 'numeric', month: 'long', year: 'numeric' })
    .format(new Date(`${date}T12:00:00`))
}

export function formatMoney(amount: number): string {
  return new Intl.NumberFormat('ca-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(amount)
}
