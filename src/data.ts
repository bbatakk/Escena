import { createClient } from '@supabase/supabase-js'
import { type Concert, emptyDetails } from './model'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY
export const cloudConfigured = Boolean(url && key)
export const supabase = cloudConfigured ? createClient(url, key) : null

const demoKey = 'escena-demo-concerts-v1'

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
  const { data, error } = await supabase.from('concerts').select('*').order('date', { ascending: true })
  if (error) throw error
  return (data as ConcertRow[]).map(fromRow)
}

export async function saveConcert(concert: Concert): Promise<Concert> {
  if (!supabase) {
    const next = localConcerts().filter((item) => item.id !== concert.id)
    const saved = { ...concert, updatedAt: new Date().toISOString() }
    localStorage.setItem(demoKey, JSON.stringify([...next, saved]))
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

export async function deleteConcert(id: string): Promise<void> {
  if (!supabase) {
    localStorage.setItem(demoKey, JSON.stringify(localConcerts().filter((item) => item.id !== id)))
    return
  }
  const { error } = await supabase.from('concerts').delete().eq('id', id)
  if (error) throw error
}
