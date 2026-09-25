export type ConcertStatus = 'en_converses' | 'reservat' | 'confirmat' | 'realitzat' | 'cancel·lat'
export type Answer = 'pendent' | 'si' | 'no'
export type DocumentStatus = 'pendent' | 'fet' | 'no_cal'

export interface CommissionTier { above: number; percent: number }
export interface LabelAgreement { name: string; tiers: CommissionTier[] }
export type ConcertManager = 'pendent' | 'banda' | 'discografica'

export function validateLabelAgreement(value: LabelAgreement): LabelAgreement {
  const name = value.name.trim()
  if (!name || name.length > 80 || !Array.isArray(value.tiers) || !value.tiers.length || value.tiers.length > 20) throw new Error('Indica el nom de la discogràfica i almenys un tram.')
  const tiers = value.tiers.map((tier) => ({ above: tier.above, percent: tier.percent }))
  if (tiers.some((tier) => !Number.isFinite(tier.above) || tier.above < 0 || Math.abs(Math.round(tier.above * 100) - tier.above * 100) > 1e-6 || !Number.isFinite(tier.percent) || tier.percent < 0 || tier.percent > 100 || Math.abs(Math.round(tier.percent * 100) - tier.percent * 100) > 1e-6) || tiers.some((tier, index) => index > 0 && tier.above <= tiers[index - 1].above)) throw new Error('Els llindars han de ser creixents i els percentatges entre 0 i 100, amb un màxim de dos decimals.')
  return { name, tiers }
}

export function commissionRate(amount: number, agreement: LabelAgreement): number {
  return agreement.tiers.reduce((rate, tier) => amount > tier.above ? tier.percent : rate, 0)
}

export function concertSettlement(concert: Concert, currentLabel?: LabelAgreement | null) {
  const grossAgreed = Math.max(0, concert.feeAmount)
  const grossPaid = Math.max(0, concert.feePaid)
  const management = concert.details.management || 'pendent'
  const agreement = concert.details.labelAgreement
  const unresolved = management === 'discografica' && !agreement || management === 'pendent' && Boolean(currentLabel?.name)
  if (unresolved) return { unresolved: true, grossAgreed, grossPaid, projectedCommission: 0, projectedNet: 0, paidCommission: 0, netPaid: 0, paidRate: 0 }
  const projectedRate = management === 'discografica' && agreement ? commissionRate(grossAgreed, agreement) : 0
  const paidRate = management === 'discografica' && agreement ? commissionRate(grossPaid, agreement) : 0
  const projectedCommission = Math.round(grossAgreed * projectedRate) / 100
  const paidCommission = Math.round(grossPaid * paidRate) / 100
  return { unresolved: false, grossAgreed, grossPaid, projectedCommission, projectedNet: grossAgreed - projectedCommission, paidCommission, netPaid: grossPaid - paidCommission, paidRate }
}

export function totalNetConcertFees(concerts: Concert[], currentLabel?: LabelAgreement | null): number {
  return concerts.reduce((sum, concert) => {
    const settlement = concertSettlement(concert, currentLabel)
    return sum + (settlement.unresolved ? 0 : settlement.netPaid)
  }, 0)
}

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
  sizes?: MerchSizeVariant[]
}

export interface MerchSizeVariant {
  name: string
  stock: number
}

export interface MerchSale {
  id: string
  concertId: string
  productId: string
  quantity: number
  unitPrice: number
  note: string
  size?: string
}

export function merchRevenueByConcert(concerts: Concert[], sales: MerchSale[]): Map<string, number> {
  const revenue = new Map<string, number>()
  for (const sale of sales) revenue.set(sale.concertId, (revenue.get(sale.concertId) || 0) + sale.quantity * sale.unitPrice)
  for (const concert of concerts) {
    if (concert.details.merchSales > 0 && !revenue.has(concert.id)) revenue.set(concert.id, concert.details.merchSales)
  }
  return revenue
}

export function totalMerchRevenue(concerts: Concert[], sales: MerchSale[]): number {
  return Array.from(merchRevenueByConcert(concerts, sales).values()).reduce((sum, amount) => sum + amount, 0)
}

export interface MaterialItem {
  id: string
  name: string
  loaded: boolean
  catalogId?: string
  category?: string
}

export type PersonKind = 'musica' | 'tecnic' | 'manager' | 'contacte'
export interface BandPerson { id: string; name: string; kind: PersonKind; phone: string; email: string; active: boolean }
export interface BandMaterial { id: string; name: string; category: string; active: boolean }
export interface SetlistTemplate { id: string; name: string; songs: string[]; active: boolean }

export interface ConcertDetails {
  management?: ConcertManager
  labelAgreement?: LabelAgreement
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
  country: string
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
    management: 'pendent',
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
    city: '', country: '', address: '', feeAmount: 0, feePaid: 0, details: emptyDetails(),
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
