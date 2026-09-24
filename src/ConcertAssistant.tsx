import { useState, type FormEvent } from 'react'
import { ArrowRight, Bot, FileInput, MessageCircleQuestion, Sparkles } from 'lucide-react'
import { cloudConfigured, supabase } from './data'
import { createId, getPending, newConcert, statusLabels, type Concert, type ConcertStatus } from './model'

type DraftResponse = {
  title?: unknown
  date?: unknown
  status?: unknown
  venue?: unknown
  city?: unknown
  address?: unknown
  feeAmount?: unknown
  details?: Record<string, unknown>
}

function text(value: unknown): string { return typeof value === 'string' ? value.trim() : '' }
function validAnswer(value: unknown): 'pendent' | 'si' | 'no' { return value === 'si' || value === 'no' ? value : 'pendent' }

async function invokeAssistant(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (!supabase) throw new Error('Connecta Supabase per utilitzar l’assistent.')
  const { data, error } = await supabase.functions.invoke('concert-assistant', { body })
  if (error) {
    const response = (error as Error & { context?: Response }).context
    if (response) {
      try {
        const payload = await response.clone().json() as { error?: unknown }
        if (typeof payload.error === 'string') throw new Error(payload.error)
      } catch (cause) { if (cause instanceof Error && cause.message !== 'Unexpected end of JSON input') throw cause }
    }
    throw error
  }
  if (data?.error && typeof data.error === 'string') throw new Error(data.error)
  return data as Record<string, unknown>
}

function makeConcertDraft(value: DraftResponse): Concert {
  const concert = newConcert()
  concert.title = text(value.title)
  concert.date = text(value.date)
  const statuses: ConcertStatus[] = ['en_converses', 'reservat', 'confirmat']
  if (statuses.includes(value.status as ConcertStatus)) concert.status = value.status as ConcertStatus
  concert.venue = text(value.venue)
  concert.city = text(value.city)
  concert.address = text(value.address)
  concert.feeAmount = typeof value.feeAmount === 'number' && Number.isFinite(value.feeAmount) && value.feeAmount >= 0 ? value.feeAmount : 0
  const details = value.details || {}
  concert.details = {
    ...concert.details,
    conditions: text(details.conditions), cancellation: text(details.cancellation),
    contactName: text(details.contactName), contactPhone: text(details.contactPhone), contactEmail: text(details.contactEmail),
    dinner: validAnswer(details.dinner), dinnerDetails: text(details.dinnerDetails),
    lodging: validAnswer(details.lodging), lodgingDetails: text(details.lodgingDetails), lodgingAddress: text(details.lodgingAddress),
    passes: text(details.passes),
    schedule: Array.isArray(details.schedule) ? details.schedule.flatMap((item) => {
      if (!item || typeof item !== 'object') return []
      const row = item as Record<string, unknown>
      const scheduleItem = { id: createId(), time: text(row.time), label: text(row.label), place: text(row.place) }
      return scheduleItem.time || scheduleItem.label || scheduleItem.place ? [scheduleItem] : []
    }) : [],
  }
  return concert
}

export default function ConcertAssistant({ concerts, onCreateDraft }: { concerts: Concert[]; onCreateDraft: (draft: Concert) => void }) {
  const [offer, setOffer] = useState('')
  const [question, setQuestion] = useState('')
  const [draft, setDraft] = useState<Concert | null>(null)
  const [answer, setAnswer] = useState('')
  const [parseBusy, setParseBusy] = useState(false)
  const [askBusy, setAskBusy] = useState(false)
  const [parseError, setParseError] = useState('')
  const [askError, setAskError] = useState('')
  const [remainingToday, setRemainingToday] = useState<number | null>(null)

  async function parseOffer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !cloudConfigured) { setParseError('Connecta Supabase i configura la funció d’IA per utilitzar aquesta eina.'); return }
    setParseBusy(true); setParseError(''); setDraft(null)
    try {
      const data = await invokeAssistant({ action: 'parse_offer', text: offer })
      if (!data?.draft || typeof data.draft !== 'object') throw new Error('La IA no ha retornat un esborrany vàlid.')
      setDraft(makeConcertDraft(data.draft as DraftResponse))
      if (typeof data.remainingToday === 'number') setRemainingToday(data.remainingToday)
    } catch (cause) { setParseError(cause instanceof Error ? cause.message : 'No s’ha pogut llegir la proposta.') }
    finally { setParseBusy(false) }
  }

  async function ask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !cloudConfigured) { setAskError('Connecta Supabase i configura la funció d’IA per utilitzar aquesta eina.'); return }
    setAskBusy(true); setAskError(''); setAnswer('')
    const context = concerts.map((concert) => ({ title: concert.title, date: concert.date, status: statusLabels[concert.status], venue: concert.venue, city: concert.city, feeAmount: concert.feeAmount, feePaid: concert.feePaid, pending: getPending(concert) }))
    try {
      const data = await invokeAssistant({ action: 'ask', question, concerts: context })
      if (typeof data?.answer !== 'string') throw new Error('La IA no ha retornat cap resposta.')
      setAnswer(data.answer)
      if (typeof data.remainingToday === 'number') setRemainingToday(data.remainingToday)
    } catch (cause) { setAskError(cause instanceof Error ? cause.message : 'No s’ha pogut respondre la pregunta.') }
    finally { setAskBusy(false) }
  }

  return <div className="assistant-shell">
    <div className="page-heading assistant-heading"><div><span className="eyebrow">AJUDA PER A LA BANDA</span><h1>Escena t’ajuda<span className="heading-period">.</span></h1><p>Converteix propostes en esborranys i consulta la informació dels concerts.</p></div><span className="assistant-mark"><Sparkles size={19} /></span></div>
    {!cloudConfigured ? <div className="assistant-setup-note"><Bot size={17} /> L’assistent necessita Supabase i una funció d’IA configurada. Les dades continuen guardades només en aquest navegador.</div> : null}
    <div className="assistant-grid">
      <section className="form-card assistant-card"><div className="section-heading"><span className="section-index"><FileInput size={16} /></span><div><h2>Llegeix una proposta</h2><p>Enganxa el correu o missatge del promotor i Escena prepararà una fitxa editable.</p></div></div><form className="fields" onSubmit={(event) => void parseOffer(event)}><label className="field">Text de la proposta<textarea required rows={10} maxLength={20000} value={offer} onChange={(event) => setOffer(event.target.value)} placeholder={'Hola! Ens agradaria comptar amb vosaltres el 14 de juny a la Sala X…'} /></label><div className="assistant-form-footer"><small>{offer.length.toLocaleString('ca')} / 20.000</small><button className="button button-primary" type="submit" disabled={parseBusy || !offer.trim() || !cloudConfigured}><Sparkles size={15} /> {parseBusy ? 'Llegint…' : 'Preparar esborrany'}</button></div></form>{parseError ? <p className="form-error" role="alert">{parseError}</p> : null}{draft ? <div className="assistant-draft"><span className="eyebrow">ESBORRANY PREPARAT · REVISA’L ABANS DE DESAR</span><strong>{draft.title || 'Concert sense títol'}</strong><p>{[draft.date, draft.venue, draft.city].filter(Boolean).join(' · ') || 'Falten data i ubicació'}</p>{draft.feeAmount ? <small>Catxet: {new Intl.NumberFormat('ca-ES', { style: 'currency', currency: 'EUR' }).format(draft.feeAmount)}</small> : null}<button type="button" className="button button-secondary" onClick={() => onCreateDraft(draft)}>Revisar i completar fitxa <ArrowRight size={15} /></button></div> : null}</section>
      <section className="form-card assistant-card"><div className="section-heading"><span className="section-index"><MessageCircleQuestion size={16} /></span><div><h2>Pregunta a Escena</h2><p>Consulta concerts propers, horaris generals o compromisos pendents.</p></div></div><form className="fields" onSubmit={(event) => void ask(event)}><label className="field">La teva pregunta <textarea required rows={4} maxLength={2000} value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Quins concerts tenim aquest mes amb coses pendents?" /></label><div className="assistant-form-footer"><small>Només s’envien títol, data, lloc, catxet i pendents; no contactes ni notes.</small><button className="button button-primary" type="submit" disabled={askBusy || !question.trim() || !cloudConfigured}><ArrowRight size={15} /> {askBusy ? 'Pensant…' : 'Preguntar'}</button></div></form>{askError ? <p className="form-error" role="alert">{askError}</p> : null}{answer ? <div className="assistant-answer"><span className="eyebrow"><Sparkles size={13} /> RESPOSTA</span><p>{answer}</p></div> : null}</section>
    </div>
    <p className="assistant-privacy">L’app limita Gemini a 10 peticions diàries per compte{remainingToday !== null ? ` · ${remainingToday} restants avui` : ''}, a més de les quotes gratuïtes de Google. El nivell gratuït pot utilitzar les peticions per millorar els seus productes: no hi enganxis dades especialment sensibles. Les preguntes només envien el resum de concerts indicat. Revisa sempre les dades extretes abans de desar-les.</p>
  </div>
}
