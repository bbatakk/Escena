import { useState, type FormEvent } from 'react'
import { ArrowRight, Bot, Check, MessageCircleQuestion, Sparkles } from 'lucide-react'
import { cloudConfigured, listAllResources, listMerchSales, listMoneyMovements, supabase } from './data'
import { createId, getPending, newConcert, statusLabels, totalMerchRevenue, type Concert, type ConcertStatus, type SetlistTemplate } from './model'

type DraftResponse = { title?: unknown; date?: unknown; status?: unknown; venue?: unknown; city?: unknown; country?: unknown; address?: unknown; feeAmount?: unknown; details?: Record<string, unknown> }
type ConcertChanges = Partial<Pick<Concert, 'title' | 'date' | 'status' | 'venue' | 'city' | 'country' | 'address' | 'feeAmount' | 'feePaid'>>
type AssistantPlan =
  | { type: 'answer'; answer: string }
  | { type: 'analysis'; answer: string }
  | { type: 'clarify'; question: string }
  | { type: 'create_concert'; draft: Concert }
  | { type: 'update_concerts'; updates: Array<{ concertId: string; updatedAt?: string; changes: ConcertChanges }> }
  | { type: 'delete_concerts'; concerts: Concert[] }
  | { type: 'create_setlist'; template: { name: string; songs: string[] } }
  | { type: 'update_setlist'; original: SetlistTemplate; template: { name: string; songs: string[] } }
  | { type: 'archive_setlist'; original: SetlistTemplate }

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

function parseSongs(value: unknown): string[] {
  return Array.isArray(value) && value.length <= 100 && value.every((song) => typeof song === 'string' && song.trim().length > 0 && song.length <= 200) ? value.map((song: string) => song.trim()) : []
}

export function parsePlan(value: unknown, concerts: Concert[], setlists: SetlistTemplate[] = []): AssistantPlan {
  if (!record(value) || typeof value.type !== 'string') throw new Error('La IA no ha retornat una acció vàlida.')
  if ((value.type === 'answer' || value.type === 'analysis') && typeof value.answer === 'string') return { type: value.type, answer: value.answer }
  if (value.type === 'clarify' && typeof value.question === 'string') return { type: 'clarify', question: value.question }
  if (value.type === 'create_concert' && record(value.draft)) return { type: 'create_concert', draft: makeConcertDraft(value.draft) }
  if (value.type === 'create_setlist' && record(value.template)) {
    const name = text(value.template.name)
    const songs = parseSongs(value.template.songs)
    if (!name || name.length > 120 || !songs.length) throw new Error('La plantilla proposada no té un nom o una llista de cançons vàlids.')
    return { type: 'create_setlist', template: { name, songs } }
  }
  if (value.type === 'update_setlist' && typeof value.templateId === 'string' && record(value.changes)) {
    const original = setlists.find((item) => item.id === value.templateId && item.active)
    if (!original || Object.keys(value.changes).some((key) => key !== 'name' && key !== 'songs')) throw new Error('La plantilla o els canvis proposats no són vàlids.')
    const name = 'name' in value.changes ? text(value.changes.name) : original.name
    const songs = 'songs' in value.changes ? parseSongs(value.changes.songs) : original.songs
    if (!name || name.length > 120 || !songs.length) throw new Error('La plantilla necessita nom i cançons.')
    if (name === original.name && JSON.stringify(songs) === JSON.stringify(original.songs)) throw new Error('No hi ha canvis a la plantilla.')
    return { type: 'update_setlist', original, template: { name, songs } }
  }
  if (value.type === 'archive_setlist' && typeof value.templateId === 'string') {
    const original = setlists.find((item) => item.id === value.templateId && item.active)
    if (!original) throw new Error('No s’ha trobat la plantilla activa indicada.')
    return { type: 'archive_setlist', original }
  }
  if (value.type === 'delete_concerts' && Array.isArray(value.concertIds)) {
    const ids = value.concertIds
    if (!ids.length || ids.length > 20 || ids.some((id) => typeof id !== 'string') || new Set(ids).size !== ids.length) throw new Error('La selecció de concerts per eliminar no és vàlida.')
    const selected = ids.map((id) => concerts.find((concert) => concert.id === id))
    if (selected.some((concert) => !concert)) throw new Error('La IA ha seleccionat un concert inexistent. Concreta la petició.')
    return { type: 'delete_concerts', concerts: selected as Concert[] }
  }
  if (value.type === 'update_concerts' && Array.isArray(value.updates)) {
    if (!value.updates.length || value.updates.length > 50) throw new Error('La selecció de concerts no és vàlida.')
    const updates = value.updates.map((raw) => {
      if (!record(raw) || typeof raw.concertId !== 'string' || !record(raw.changes) || Object.keys(raw.changes).some((key) => !(editableFields as readonly string[]).includes(key))) throw new Error('La IA ha proposat camps de concert no permesos.')
      const current = concerts.find((concert) => concert.id === raw.concertId)
      if (!current) throw new Error('La IA ha seleccionat un concert inexistent. Concreta la petició.')
      const changes: Record<string, unknown> = {}
      for (const key of editableFields) {
        if (!(key in raw.changes)) continue
        const next = raw.changes[key]
        if (key === 'status') { if (['en_converses', 'reservat', 'confirmat', 'realitzat', 'cancel·lat'].includes(String(next))) changes[key] = next }
        else if (key === 'feeAmount' || key === 'feePaid') { if (typeof next === 'number' && Number.isFinite(next) && next >= 0) changes[key] = next }
        else if (typeof next === 'string' && next.length <= (key === 'address' ? 500 : 160) && (key !== 'date' || validDate(next))) changes[key] = next.trim()
        if (!(key in changes)) throw new Error(`El valor proposat per a «${fieldLabels[key]}» no és vàlid.`)
      }
      if (!Object.keys(changes).length) throw new Error('La IA no ha proposat cap canvi.')
      return { concertId: current.id, updatedAt: current.updatedAt, changes: changes as ConcertChanges }
    })
    if (new Set(updates.map((update) => update.concertId)).size !== updates.length) throw new Error('Hi ha concerts repetits a la proposta.')
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

export default function ConcertAssistant({ concerts, onCreateDraft, onUpdateConcert, onSaveSetlist, onDeleteConcert }: { concerts: Concert[]; onCreateDraft: (draft: Concert) => void; onUpdateConcert: (concert: Concert) => Promise<void>; onSaveSetlist: (template: SetlistTemplate) => Promise<void>; onDeleteConcert: (concert: Concert) => Promise<void> }) {
  const [request, setRequest] = useState('')
  const [plan, setPlan] = useState<AssistantPlan | null>(null)
  const [busy, setBusy] = useState(false)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [remainingToday, setRemainingToday] = useState<number | null>(null)
  const [linkedCounts, setLinkedCounts] = useState<Map<string, number>>(new Map())

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !cloudConfigured) { setError('Connecta Supabase i configura la funció d’IA per utilitzar l’assistent.'); return }
    setBusy(true); setError(''); setNotice(''); setPlan(null)
    try {
      const context = concerts.slice(0, 300).map((concert) => ({ id: concert.id, title: concert.title, date: concert.date, status: concert.status, statusLabel: statusLabels[concert.status], venue: concert.venue, city: concert.city, country: concert.country, address: concert.address, feeAmount: concert.feeAmount, feePaid: concert.feePaid, pending: getPending(concert), schedule: concert.details.schedule.slice(0, 12), setlist: concert.details.setlist.slice(0, 1500) }))
      const [templates, sales, movements] = await Promise.all([listAllResources<SetlistTemplate>('setlist_templates'), listMerchSales(), listMoneyMovements()])
      const data = await invokeAssistant({ action: 'copilot', request, referenceDate: referenceDate(), concerts: context, setlists: templates.map(({ id, name, songs, active }) => ({ id, name, songs, active })), analytics: { concertCount: concerts.length, concertsTruncated: concerts.length > 300, agreedFees: concerts.reduce((sum, concert) => sum + concert.feeAmount, 0), collectedFees: concerts.reduce((sum, concert) => sum + concert.feePaid, 0), merchRevenue: totalMerchRevenue(concerts, sales), movementsTruncated: movements.length > 500, movementIncome: movements.filter((item) => item.kind === 'ingres').reduce((sum, item) => sum + item.amount, 0), movementExpenses: movements.filter((item) => item.kind === 'despesa').reduce((sum, item) => sum + item.amount, 0), movements: movements.slice(0, 500).map(({ kind, amount, date, concertId }) => ({ kind, amount, date, concertId })) } })
      setLinkedCounts(new Map(concerts.map((concert) => [concert.id, sales.filter((sale) => sale.concertId === concert.id).length + movements.filter((movement) => movement.concertId === concert.id).length])))
      setPlan(parsePlan(data.plan, concerts, templates))
      if (typeof data.remainingToday === 'number') setRemainingToday(data.remainingToday)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No s’ha pogut processar la petició.') }
    finally { setBusy(false) }
  }

  async function confirmPlan() {
    if (!plan || plan.type === 'answer' || plan.type === 'analysis' || plan.type === 'clarify' || plan.type === 'create_concert' || applying) return
    if (typeof navigator !== 'undefined' && !navigator.onLine) { setError('Connecta’t a internet abans de desar els canvis de l’assistent.'); return }
    setApplying(true); setError(''); setNotice('')
    try {
      if (plan.type === 'create_setlist') {
        await onSaveSetlist({ id: createId(), ...plan.template, active: true })
        setNotice(`Plantilla «${plan.template.name}» creada.`)
      } else if (plan.type === 'update_setlist' || plan.type === 'archive_setlist') {
        const fresh = (await listAllResources<SetlistTemplate>('setlist_templates')).find((item) => item.id === plan.original.id)
        if (!fresh?.active || JSON.stringify(fresh) !== JSON.stringify(plan.original)) throw new Error('La plantilla ha canviat. Torna a preparar la petició abans de desar-la.')
        await onSaveSetlist(plan.type === 'archive_setlist' ? { ...fresh, active: false } : { ...fresh, ...plan.template })
        setNotice(plan.type === 'archive_setlist' ? `Plantilla «${fresh.name}» arxivada.` : `Plantilla «${fresh.name}» actualitzada.`)
      } else if (plan.type === 'delete_concerts') {
        const [sales, movements] = await Promise.all([listMerchSales(), listMoneyMovements()])
        if (plan.concerts.some((concert) => sales.some((sale) => sale.concertId === concert.id) || movements.some((movement) => movement.concertId === concert.id))) throw new Error('Algun concert té vendes o moviments vinculats. Revisa’ls abans d’eliminar-lo.')
        let removed = 0
        try { for (const concert of plan.concerts) { await onDeleteConcert(concert); removed += 1 } }
        catch (cause) { setPlan(null); throw new Error(`S’han eliminat ${removed} de ${plan.concerts.length} concerts. ${cause instanceof Error ? cause.message : 'No s’ha pogut completar.'}`) }
        setNotice(`S’han eliminat ${removed} concerts.`)
      } else {
        let saved = 0
        const failures: string[] = []
        for (const update of plan.updates) {
          const current = concerts.find((concert) => concert.id === update.concertId)
          if (!current) { failures.push('Un concert ja no és disponible.'); continue }
          try {
            if (current.updatedAt !== update.updatedAt) throw new Error(`El concert «${current.title}» ha canviat. Torna a preparar la petició.`)
            if ('title' in update.changes && !update.changes.title?.trim()) throw new Error('El concert necessita un nom.')
            await onUpdateConcert({ ...current, ...update.changes }); saved += 1
          }
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
    <div className="page-heading assistant-heading"><div><span className="eyebrow">AJUDA PER A LA BANDA</span><h1>Escena t’ajuda<span className="heading-period">.</span></h1><p>Pregunta, analitza concerts o proposa crear, editar i eliminar amb una instrucció.</p></div><span className="assistant-mark"><Sparkles size={19} /></span></div>
    {!cloudConfigured ? <div className="assistant-setup-note"><Bot size={17} /> L’assistent necessita Supabase i una funció d’IA configurada. Les dades continuen guardades només en aquest navegador.</div> : null}
    <section className="form-card assistant-card assistant-copilot"><div className="section-heading"><span className="section-index"><Sparkles size={16} /></span><div><h2>Què necessites?</h2><p>Consulta i analitza concerts, o proposa canvis en concerts i plantilles.</p></div></div>
      <form className="fields" onSubmit={(event) => void submit(event)}><label className="field">Escriu-ho com ho diries a la banda<textarea required rows={6} maxLength={20000} value={request} onChange={(event) => { setRequest(event.target.value); setPlan(null) }} placeholder={'Ex. Canvia el país dels tres pròxims concerts a Espanya.\nQuants concerts hem fet aquest any i quant hem cobrat?\nArxiva la plantilla Festival.'} /></label><div className="assistant-form-footer"><small>{request.length.toLocaleString('ca')} / 20.000 · Es tramet a Gemini el text, dades de concerts, repertoris i imports; no contactes ni notes de les fitxes.</small><button className="button button-primary" type="submit" disabled={busy || applying || !request.trim() || !cloudConfigured}><Sparkles size={15} /> {busy ? 'Pensant…' : 'Enviar a Escena'}</button></div></form>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {notice ? <p className="assistant-action-notice" role="status"><Check size={15} /> {notice}</p> : null}
      {plan?.type === 'answer' || plan?.type === 'analysis' ? <div className="assistant-answer"><span className="eyebrow"><MessageCircleQuestion size={13} /> {plan.type === 'analysis' ? 'ANÀLISI' : 'RESPOSTA'}</span><p>{plan.answer}</p></div> : null}
      {plan?.type === 'clarify' ? <div className="assistant-answer"><span className="eyebrow"><MessageCircleQuestion size={13} /> CAL CONCRETAR</span><p>{plan.question}</p></div> : null}
      {plan?.type === 'create_concert' ? <div className="assistant-action-preview"><span className="eyebrow">ESBORRANY · ENCARA NO DESAT</span><strong>{plan.draft.title || 'Concert sense títol'}</strong><p>{[plan.draft.date, plan.draft.venue, plan.draft.city, plan.draft.country].filter(Boolean).join(' · ') || 'Falten data i ubicació'}</p><button type="button" className="button button-secondary" onClick={() => onCreateDraft(plan.draft)}>Revisar i completar fitxa <ArrowRight size={15} /></button></div> : null}
      {plan?.type === 'update_concerts' ? <div className="assistant-action-preview"><span className="eyebrow">CANVIS PROPOSATS · CONFIRMA PER DESAR</span>{plan.updates.map((update) => { const concert = concerts.find((item) => item.id === update.concertId); if (!concert) return <p key={update.concertId}>Aquest concert ja no és disponible. Torna a preparar la petició.</p>; return <div className="assistant-change" key={update.concertId}><strong>{concert.title} · {concert.date}</strong>{editableFields.filter((field) => field in update.changes).map((field) => <p key={field}>{fieldLabels[field]}: <span>{valueLabel(concert[field]) || '—'}</span> → <strong>{valueLabel(update.changes[field]) || '—'}</strong></p>)}</div> })}<div className="assistant-action-buttons"><button type="button" className="button button-secondary" disabled={applying} onClick={() => setPlan(null)}>Descartar</button><button type="button" className="button button-primary" disabled={applying || plan.updates.some((update) => !concerts.some((concert) => concert.id === update.concertId && concert.updatedAt === update.updatedAt))} onClick={() => void confirmPlan()}>{applying ? 'Desant…' : 'Confirmar canvis'}</button></div></div> : null}
      {plan?.type === 'delete_concerts' ? <div className="assistant-action-preview"><span className="eyebrow">ELIMINACIÓ PERMANENT · CONFIRMA PER CONTINUAR</span>{plan.concerts.map((concert) => <div className="assistant-change" key={concert.id}><strong>{concert.title} · {concert.date}</strong><p>{concert.details.documents.length ? `${concert.details.documents.length} documents del concert` : 'Sense documents'} · {linkedCounts.get(concert.id) || 0} vendes o moviments vinculats</p></div>)}<p>Els documents propis del concert també es retiraran. Els concerts amb vendes o moviments vinculats no es poden eliminar des d’aquí.</p><div className="assistant-action-buttons"><button type="button" className="button button-secondary" disabled={applying} onClick={() => setPlan(null)}>Descartar</button><button type="button" className="button button-primary" disabled={applying || plan.concerts.some((concert) => (linkedCounts.get(concert.id) || 0) > 0)} onClick={() => void confirmPlan()}>{applying ? 'Eliminant…' : 'Confirmar eliminació'}</button></div></div> : null}
      {plan?.type === 'create_setlist' ? <div className="assistant-action-preview"><span className="eyebrow">PLANTILLA PROPOSADA · ENCARA NO DESADA</span><strong>{plan.template.name}</strong><ol>{plan.template.songs.map((song, index) => <li key={`${song}-${index}`}>{song}</li>)}</ol><div className="assistant-action-buttons"><button type="button" className="button button-secondary" disabled={applying} onClick={() => setPlan(null)}>Descartar</button><button type="button" className="button button-primary" disabled={applying} onClick={() => void confirmPlan()}>{applying ? 'Desant…' : 'Crear plantilla'}</button></div></div> : null}
      {plan?.type === 'update_setlist' || plan?.type === 'archive_setlist' ? <div className="assistant-action-preview"><span className="eyebrow">{plan.type === 'archive_setlist' ? 'ARXIVAR PLANTILLA' : 'EDITAR PLANTILLA'} · CONFIRMA PER DESAR</span><strong>{plan.original.name}</strong>{plan.type === 'update_setlist' ? <><p>Nom nou: {plan.template.name}</p><p>Cançons proposades:</p><ol>{plan.template.songs.map((song, index) => <li key={`${song}-${index}`}>{song}</li>)}</ol></> : <p>La plantilla desapareixerà del catàleg actiu. Els concerts que ja n’han copiat el repertori el conservaran.</p>}<div className="assistant-action-buttons"><button type="button" className="button button-secondary" disabled={applying} onClick={() => setPlan(null)}>Descartar</button><button type="button" className="button button-primary" disabled={applying} onClick={() => void confirmPlan()}>{applying ? 'Desant…' : 'Confirmar'}</button></div></div> : null}
    </section>
    <p className="assistant-privacy">Límit de 10 peticions d’IA al dia{remainingToday !== null ? ` · ${remainingToday} restants avui` : ''}, a més de les quotes gratuïtes de Google. Revisa sempre les accions proposades abans de confirmar-les.</p>
  </div>
}
