import { useState, type FormEvent } from 'react'
import { ArrowRight, Bot, Check, MessageCircleQuestion, Sparkles } from 'lucide-react'
import { cloudConfigured, listAllResources, supabase } from './data'
import { createId, getPending, newConcert, statusLabels, type Concert, type ConcertStatus, type SetlistTemplate } from './model'

type DraftResponse = { title?: unknown; date?: unknown; status?: unknown; venue?: unknown; city?: unknown; country?: unknown; address?: unknown; feeAmount?: unknown; details?: Record<string, unknown> }
type ConcertChanges = Partial<Pick<Concert, 'title' | 'date' | 'status' | 'venue' | 'city' | 'country' | 'address' | 'feeAmount' | 'feePaid'>>
type AssistantPlan =
  | { type: 'answer'; answer: string }
  | { type: 'clarify'; question: string }
  | { type: 'create_concert'; draft: Concert }
  | { type: 'update_concerts'; updates: Array<{ concertId: string; changes: ConcertChanges }> }
  | { type: 'create_setlist'; template: { name: string; songs: string[] } }

const editableFields = ['title', 'date', 'status', 'venue', 'city', 'country', 'address', 'feeAmount', 'feePaid'] as const
const fieldLabels: Record<(typeof editableFields)[number], string> = { title: 'Nom', date: 'Data', status: 'Estat', venue: 'Sala o espai', city: 'Població', country: 'País', address: 'Adreça', feeAmount: 'Catxet acordat', feePaid: 'Catxet cobrat' }

function text(value: unknown): string { return typeof value === 'string' ? value.trim() : '' }
function record(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value) }
function validAnswer(value: unknown): 'pendent' | 'si' | 'no' { return value === 'si' || value === 'no' ? value : 'pendent' }

async function invokeAssistant(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (!supabase) throw new Error('Connecta Supabase per utilitzar l’assistent.')
  const { data, error } = await supabase.functions.invoke('concert-assistant', { body })
  if (error) {
    const response = (error as Error & { context?: Response }).context
    if (response) {
      const responseBody = await response.clone().text().catch(() => '')
      if (responseBody) {
        let providerMessage = ''
        try { const payload: unknown = JSON.parse(responseBody); if (record(payload) && typeof payload.error === 'string') providerMessage = payload.error } catch { /* The gateway may return plain text. */ }
        throw new Error(providerMessage || `La funció d’IA ha fallat (${response.status}): ${responseBody.slice(0, 240)}`)
      }
    }
    throw error
  }
  if (data?.error && typeof data.error === 'string') throw new Error(data.error)
  return data as Record<string, unknown>
}

function makeConcertDraft(value: DraftResponse): Concert {
  const concert = newConcert()
  concert.title = text(value.title)
  concert.date = validDate(text(value.date)) ? text(value.date) : ''
  if (['en_converses', 'reservat', 'confirmat'].includes(String(value.status))) concert.status = value.status as ConcertStatus
  concert.venue = text(value.venue); concert.city = text(value.city); concert.country = text(value.country); concert.address = text(value.address)
  concert.feeAmount = typeof value.feeAmount === 'number' && Number.isFinite(value.feeAmount) && value.feeAmount >= 0 ? value.feeAmount : 0
  const details = value.details || {}
  concert.details = {
    ...concert.details,
    conditions: text(details.conditions), cancellation: text(details.cancellation), contactName: text(details.contactName),
    contactPhone: text(details.contactPhone), contactEmail: text(details.contactEmail), dinner: validAnswer(details.dinner),
    dinnerDetails: text(details.dinnerDetails), lodging: validAnswer(details.lodging), lodgingDetails: text(details.lodgingDetails),
    lodgingAddress: text(details.lodgingAddress), passes: text(details.passes),
    schedule: Array.isArray(details.schedule) ? details.schedule.flatMap((item) => {
      if (!record(item)) return []
      const schedule = { id: createId(), time: text(item.time), label: text(item.label), place: text(item.place) }
      return schedule.time || schedule.label || schedule.place ? [schedule] : []
    }) : [],
  }
  return concert
}

function parsePlan(value: unknown, concerts: Concert[]): AssistantPlan {
  if (!record(value) || typeof value.type !== 'string') throw new Error('La IA no ha retornat una acció vàlida.')
  if (value.type === 'answer' && typeof value.answer === 'string') return { type: 'answer', answer: value.answer }
  if (value.type === 'clarify' && typeof value.question === 'string') return { type: 'clarify', question: value.question }
  if (value.type === 'create_concert' && record(value.draft)) return { type: 'create_concert', draft: makeConcertDraft(value.draft) }
  if (value.type === 'create_setlist' && record(value.template)) {
    const name = text(value.template.name)
    const songs = Array.isArray(value.template.songs) ? value.template.songs.filter((song): song is string => typeof song === 'string').map((song) => song.trim()).filter(Boolean).slice(0, 100) : []
    if (!name || !songs.length) throw new Error('La plantilla proposada no té nom o cançons.')
    return { type: 'create_setlist', template: { name, songs } }
  }
  if (value.type === 'update_concerts' && Array.isArray(value.updates)) {
    const updates = value.updates.flatMap((raw) => {
      if (!record(raw) || typeof raw.concertId !== 'string' || !record(raw.changes)) return []
      const current = concerts.find((concert) => concert.id === raw.concertId)
      if (!current) return []
      const changes: Record<string, unknown> = {}
      for (const key of editableFields) {
        if (!(key in raw.changes)) continue
        const next = raw.changes[key]
        if (key === 'status') { if (['en_converses', 'reservat', 'confirmat', 'realitzat', 'cancel·lat'].includes(String(next))) changes[key] = next }
        else if (key === 'feeAmount' || key === 'feePaid') { if (typeof next === 'number' && Number.isFinite(next) && next >= 0) changes[key] = next }
        else if (typeof next === 'string' && next.length <= (key === 'address' ? 500 : 160) && (key !== 'date' || validDate(next))) changes[key] = next.trim()
      }
      return Object.keys(changes).length ? [{ concertId: current.id, changes: changes as ConcertChanges }] : []
    })
    if (!updates.length) throw new Error('No he pogut identificar concerts o canvis vàlids. Prova d’especificar els concerts pel nom o la data.')
    return { type: 'update_concerts', updates }
  }
  throw new Error('No he pogut interpretar la resposta de l’assistent. Torna-ho a provar amb una petició més concreta.')
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

function referenceDate(): string {
  const today = new Date()
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
}

export default function ConcertAssistant({ concerts, onCreateDraft, onUpdateConcert, onCreateSetlist }: { concerts: Concert[]; onCreateDraft: (draft: Concert) => void; onUpdateConcert: (concert: Concert) => Promise<void>; onCreateSetlist: (template: SetlistTemplate) => Promise<void> }) {
  const [request, setRequest] = useState('')
  const [plan, setPlan] = useState<AssistantPlan | null>(null)
  const [busy, setBusy] = useState(false)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [remainingToday, setRemainingToday] = useState<number | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !cloudConfigured) { setError('Connecta Supabase i configura la funció d’IA per utilitzar l’assistent.'); return }
    setBusy(true); setError(''); setNotice(''); setPlan(null)
    try {
      const context = concerts.slice(0, 300).map((concert) => ({ id: concert.id, title: concert.title, date: concert.date, status: concert.status, statusLabel: statusLabels[concert.status], venue: concert.venue, city: concert.city, country: concert.country, address: concert.address, feeAmount: concert.feeAmount, feePaid: concert.feePaid, pending: getPending(concert), schedule: concert.details.schedule.slice(0, 12), setlist: concert.details.setlist.slice(0, 1500) }))
      const templates = await listAllResources<SetlistTemplate>('setlist_templates')
      const data = await invokeAssistant({ action: 'copilot', request, referenceDate: referenceDate(), concerts: context, setlists: templates.map(({ name, songs }) => ({ name, songs })) })
      setPlan(parsePlan(data.plan, concerts))
      if (typeof data.remainingToday === 'number') setRemainingToday(data.remainingToday)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No s’ha pogut processar la petició.') }
    finally { setBusy(false) }
  }

  async function confirmPlan() {
    if (!plan || plan.type === 'answer' || plan.type === 'clarify' || plan.type === 'create_concert') return
    if (typeof navigator !== 'undefined' && !navigator.onLine) { setError('Connecta’t a internet abans de desar els canvis de l’assistent.'); return }
    setApplying(true); setError(''); setNotice('')
    try {
      if (plan.type === 'create_setlist') {
        await onCreateSetlist({ id: createId(), ...plan.template, active: true })
        setNotice(`Plantilla «${plan.template.name}» creada.`)
      } else {
        let saved = 0
        const failures: string[] = []
        for (const update of plan.updates) {
          const current = concerts.find((concert) => concert.id === update.concertId)
          if (!current) { failures.push('Un concert ja no és disponible.'); continue }
          try { await onUpdateConcert({ ...current, ...update.changes }); saved += 1 }
          catch (cause) { failures.push(cause instanceof Error ? cause.message : 'No s’ha pogut desar un concert.') }
        }
        setNotice(failures.length ? `S’han desat ${saved} de ${plan.updates.length} concerts. ${failures.join(' ')}` : `S’han actualitzat ${saved} concerts.`)
      }
      setPlan(null)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No s’ha pogut desar l’acció.') }
    finally { setApplying(false) }
  }

  function valueLabel(value: unknown): string {
    if (typeof value === 'number') return new Intl.NumberFormat('ca-ES', { style: 'currency', currency: 'EUR' }).format(value)
    if (typeof value === 'string' && value in statusLabels) return statusLabels[value as ConcertStatus]
    return String(value)
  }

  return <div className="assistant-shell">
    <div className="page-heading assistant-heading"><div><span className="eyebrow">AJUDA PER A LA BANDA</span><h1>Escena t’ajuda<span className="heading-period">.</span></h1><p>Demana una consulta, crea concerts o plantilles i modifica fitxes amb una instrucció.</p></div><span className="assistant-mark"><Sparkles size={19} /></span></div>
    {!cloudConfigured ? <div className="assistant-setup-note"><Bot size={17} /> L’assistent necessita Supabase i una funció d’IA configurada. Les dades continuen guardades només en aquest navegador.</div> : null}
    <section className="form-card assistant-card assistant-copilot"><div className="section-heading"><span className="section-index"><Sparkles size={16} /></span><div><h2>Què necessites?</h2><p>Pots preguntar, enganxar una proposta, editar concerts o crear una plantilla de repertori.</p></div></div>
      <form className="fields" onSubmit={(event) => void submit(event)}><label className="field">Escriu-ho com ho diries a la banda<textarea required rows={6} maxLength={20000} value={request} onChange={(event) => setRequest(event.target.value)} placeholder={'Ex. Canvia el país dels tres pròxims concerts a Espanya.\nQuins concerts tenim aquest mes amb coses pendents?\nCrea una plantilla amb aquestes cançons: …'} /></label><div className="assistant-form-footer"><small>{request.length.toLocaleString('ca')} / 20.000 · Es tramet a Gemini el text i dades bàsiques de concerts, horaris, repertoris i pendents; no contactes ni notes de les fitxes.</small><button className="button button-primary" type="submit" disabled={busy || !request.trim() || !cloudConfigured}><Sparkles size={15} /> {busy ? 'Pensant…' : 'Enviar a Escena'}</button></div></form>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {notice ? <p className="assistant-action-notice" role="status"><Check size={15} /> {notice}</p> : null}
      {plan?.type === 'answer' ? <div className="assistant-answer"><span className="eyebrow"><MessageCircleQuestion size={13} /> RESPOSTA</span><p>{plan.answer}</p></div> : null}
      {plan?.type === 'clarify' ? <div className="assistant-answer"><span className="eyebrow"><MessageCircleQuestion size={13} /> CAL CONCRETAR</span><p>{plan.question}</p></div> : null}
      {plan?.type === 'create_concert' ? <div className="assistant-action-preview"><span className="eyebrow">ESBORRANY · ENCARA NO DESAT</span><strong>{plan.draft.title || 'Concert sense títol'}</strong><p>{[plan.draft.date, plan.draft.venue, plan.draft.city, plan.draft.country].filter(Boolean).join(' · ') || 'Falten data i ubicació'}</p><button type="button" className="button button-secondary" onClick={() => onCreateDraft(plan.draft)}>Revisar i completar fitxa <ArrowRight size={15} /></button></div> : null}
      {plan?.type === 'update_concerts' ? <div className="assistant-action-preview"><span className="eyebrow">CANVIS PROPOSATS · CONFIRMA PER DESAR</span>{plan.updates.map((update) => { const concert = concerts.find((item) => item.id === update.concertId)!; return <div className="assistant-change" key={update.concertId}><strong>{concert.title} · {concert.date}</strong>{editableFields.filter((field) => field in update.changes).map((field) => <p key={field}>{fieldLabels[field]}: <span>{valueLabel(concert[field]) || '—'}</span> → <strong>{valueLabel(update.changes[field]) || '—'}</strong></p>)}</div> })}<div className="assistant-action-buttons"><button type="button" className="button button-secondary" disabled={applying} onClick={() => setPlan(null)}>Descartar</button><button type="button" className="button button-primary" disabled={applying} onClick={() => void confirmPlan()}>{applying ? 'Desant…' : 'Confirmar canvis'}</button></div></div> : null}
      {plan?.type === 'create_setlist' ? <div className="assistant-action-preview"><span className="eyebrow">PLANTILLA PROPOSADA · ENCARA NO DESADA</span><strong>{plan.template.name}</strong><ol>{plan.template.songs.map((song, index) => <li key={`${song}-${index}`}>{song}</li>)}</ol><div className="assistant-action-buttons"><button type="button" className="button button-secondary" disabled={applying} onClick={() => setPlan(null)}>Descartar</button><button type="button" className="button button-primary" disabled={applying} onClick={() => void confirmPlan()}>{applying ? 'Desant…' : 'Crear plantilla'}</button></div></div> : null}
    </section>
    <p className="assistant-privacy">Límit de 10 peticions d’IA al dia{remainingToday !== null ? ` · ${remainingToday} restants avui` : ''}, a més de les quotes gratuïtes de Google. Revisa sempre les accions proposades abans de confirmar-les.</p>
  </div>
}
