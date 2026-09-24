import { lazy, Suspense, useEffect, useState, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  ArrowLeft, ArrowRight, CalendarDays, Check, ChevronLeft, ChevronRight,
  CircleHelp, Clock3, ExternalLink, FileText, List, MapPin, Menu,
  House, ListMusic, Music2, Navigation, PackageCheck, Paperclip, Pencil, Plus, Search, ShoppingBag, Ticket, Trash2,
  Settings as SettingsIcon, UsersRound, Wallet, X,
} from 'lucide-react'
import ConcertForm from './ConcertForm'
import { cloudConfigured, deleteConcert, deleteMerchSale, getBandProfile, isConcertOwnedFile, listConcerts, listMerchProducts, listMerchSales, listResource, removeConcertDocumentFile, saveConcert, saveMerchSale, signedDocumentUrl, supabase, syncOfflineConcerts, syncOfflineData, uploadConcertDocument } from './data'
import { createId, type BandPerson, type Concert, formatDate, formatMoney, getPending, newConcert, statusLabels, type MerchProduct, type MerchSale } from './model'
import Settings, { themeClass, type ThemeId } from './Settings'

const BandLibrary = lazy(() => import('./BandLibrary'))
const Treasury = lazy(() => import('./Treasury'))
const Merch = lazy(() => import('./Merch'))
const BandPeople = lazy(() => import('./BandPeople'))
const BandMaterials = lazy(() => import('./BandMaterials'))
const Setlists = lazy(() => import('./Setlists'))
type Screen = 'home' | 'list' | 'calendar' | 'detail' | 'form' | 'library' | 'treasury' | 'merch' | 'people' | 'materials' | 'setlists' | 'settings'

function safeLink(value: string): string | null {
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null
  } catch { return null }
}

function AuthScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [creating, setCreating] = useState(false)
  const [working, setWorking] = useState(false)
  const [message, setMessage] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) return
    setWorking(true)
    setMessage('')
    try {
      const result = creating
        ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } })
        : await supabase.auth.signInWithPassword({ email, password })
      if (result.error) setMessage(result.error.message)
      else if (creating && !result.data.session) setMessage('Comprova el correu per confirmar el compte i després entra.')
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'No s’ha pogut connectar. Comprova la connexió i torna-ho a provar.')
    } finally { setWorking(false) }
  }

  return <div className="auth-page"><div className="auth-brand"><div className="brand-mark"><Music2 size={22} strokeWidth={2.3} /></div><span>escena<span className="brand-dot">.</span></span></div>
    <div className="auth-panel"><span className="eyebrow">EL TEU ESPAI DE CONCERTS</span><h1>Tot el concert,<br /><em>al mateix lloc.</em></h1><p>Les dades, els horaris i el que queda pendent. Sense perdre el fil.</p>
      <form onSubmit={submit} className="auth-form"><label className="field">Correu electrònic <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label><label className="field">Contrasenya <input type="password" required minLength={6} autoComplete={creating ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} /></label>{message ? <p role="alert" className="auth-message">{message}</p> : null}<button type="submit" className="button button-primary" disabled={working}>{working ? 'Un moment…' : creating ? 'Crear espai' : 'Entrar'} <ArrowRight size={17} /></button></form>
      <button className="text-button auth-switch" type="button" onClick={() => { setCreating(!creating); setMessage('') }}>{creating ? 'Ja tens un compte? Entra' : 'Primera vegada? Crea un espai'}</button>
    </div><p className="auth-foot">Pensat per a bandes que no volen deixar cap detall enrere.</p></div>
}

function ConcertCard({ concert, onOpen }: { concert: Concert; onOpen: () => void }) {
  const pending = getPending(concert)
  const [year, month, day] = concert.date.split('-')
  const monthLabel = concert.date ? new Intl.DateTimeFormat('ca-ES', { month: 'short' }).format(new Date(Number(year), Number(month) - 1, Number(day))).replace('.', '') : ''
  return <button type="button" className="concert-card" onClick={onOpen}>
    <div className="date-stamp"><strong>{day || '–'}</strong><span>{monthLabel}</span></div>
    <div className="concert-card-info"><div className="card-topline"><span className={`status status-${concert.status}`}>{statusLabels[concert.status]}</span>{pending.length ? <span className="pending-count"><span className="small-dot" />{pending.length} {pending.length === 1 ? 'pendent' : 'pendents'}</span> : null}</div><h3>{concert.title}</h3><p><MapPin size={14} /> {[concert.venue, concert.city].filter(Boolean).join(' · ') || 'Ubicació per concretar'}</p></div><ArrowRight size={19} className="card-arrow" />
  </button>
}

function CalendarView({ concerts, onOpen, month, setMonth }: { concerts: Concert[]; onOpen: (id: string) => void; month: Date; setMonth: (date: Date) => void }) {
  const year = month.getFullYear()
  const monthIndex = month.getMonth()
  const days = new Date(year, monthIndex + 1, 0).getDate()
  const offset = (new Date(year, monthIndex, 1).getDay() + 6) % 7
  const cells = Array.from({ length: Math.ceil((offset + days) / 7) * 7 }, (_, index) => index - offset + 1)
  const today = new Date()
  const monthName = new Intl.DateTimeFormat('ca-ES', { month: 'long', year: 'numeric' }).format(month)
  const monthlyConcerts = concerts.filter((item) => {
    const [eventYear, eventMonth] = item.date.split('-').map(Number)
    return eventYear === year && eventMonth === monthIndex + 1
  }).sort((a, b) => a.date.localeCompare(b.date))
  return <div className="calendar-panel"><div className="calendar-head"><h2>{monthName}</h2><div className="calendar-controls"><button type="button" className="icon-button" aria-label="Mes anterior" onClick={() => setMonth(new Date(year, monthIndex - 1, 1))}><ChevronLeft size={20} /></button><button type="button" className="today-button" onClick={() => setMonth(new Date(today.getFullYear(), today.getMonth(), 1))}>Avui</button><button type="button" className="icon-button" aria-label="Mes següent" onClick={() => setMonth(new Date(year, monthIndex + 1, 1))}><ChevronRight size={20} /></button></div></div>
    <div className="calendar-grid">{['Dl', 'Dt', 'Dc', 'Dj', 'Dv', 'Ds', 'Dg'].map((day) => <div className="weekday" key={day}>{day}</div>)}
      {cells.map((day, index) => { const date = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`; const events = concerts.filter((item) => item.date === date); const isToday = day === today.getDate() && year === today.getFullYear() && monthIndex === today.getMonth(); return <div className={`calendar-day ${day < 1 || day > days ? 'calendar-day-outside' : ''}`} key={index}>{day >= 1 && day <= days ? <><span className={`calendar-number ${isToday ? 'calendar-today' : ''}`}>{day}</span>{events.map((item) => <button type="button" key={item.id} className="calendar-event" onClick={() => onOpen(item.id)} title={item.title}>{item.title}</button>)}</> : null}</div> })}
    </div><div className="calendar-agenda"><span className="eyebrow">CONCERTS DEL MES</span>{monthlyConcerts.length ? monthlyConcerts.map((item) => <button key={item.id} type="button" onClick={() => onOpen(item.id)}><span>{formatDate(item.date, { day: 'numeric', month: 'short' })}</span><strong>{item.title}</strong><ArrowRight size={16} /></button>) : <p>Encara no hi ha concerts aquest mes.</p>}</div></div>
}

function HomeView({ concerts, onOpen, onNewConcert, onGoToConcerts, onGoToCalendar }: { concerts: Concert[]; onOpen: (id: string) => void; onNewConcert: () => void; onGoToConcerts: () => void; onGoToCalendar: () => void }) {
  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const upcoming = concerts.filter((item) => item.date >= today && item.status !== 'cancel·lat').sort((a, b) => a.date.localeCompare(b.date))
  const next = upcoming[0]
  const pending = concerts.flatMap((concert) => getPending(concert).map((task) => ({ concert, task }))).sort((a, b) => a.concert.date.localeCompare(b.concert.date))
  const soon = upcoming.slice(0, 4)
  const monthConcerts = upcoming.filter((item) => item.date.slice(0, 7) === today.slice(0, 7)).length

  return <div className="home-dashboard">
    <div className="page-heading home-heading"><div><span className="eyebrow">PANORÀMICA DE LA BANDA</span><h1>La banda, al dia<span className="heading-period">.</span></h1><p>El que ve ara i el que cal tenir present.</p></div><button type="button" className="button button-primary" onClick={onNewConcert}><Plus size={17} /> Nou concert</button></div>
    {next ? <section className="home-next-gig"><div className="home-next-date"><span>{formatDate(next.date, { weekday: 'short' }).replace('.', '').toUpperCase()}</span><strong>{next.date.slice(8, 10)}</strong><small>{formatDate(next.date, { month: 'short' }).replace('.', '').toUpperCase()}</small></div><div className="home-next-info"><span className="eyebrow">PROPER CONCERT <i /> {statusLabels[next.status].toUpperCase()}</span><h2>{next.title}</h2><p><MapPin size={15} /> {[next.venue, next.city].filter(Boolean).join(' · ') || 'Ubicació per concretar'}</p></div><button type="button" className="button button-light" onClick={() => onOpen(next.id)}>Obrir fitxa <ArrowRight size={16} /></button></section> : <section className="home-next-gig home-next-empty"><div className="home-next-date"><Music2 size={23} /></div><div className="home-next-info"><span className="eyebrow">PROPER CONCERT</span><h2>Encara no hi ha cap data</h2><p>Afegeix un concert per començar a preparar la temporada.</p></div><button type="button" className="button button-light" onClick={onNewConcert}><Plus size={16} /> Crear concert</button></section>}
    <div className="home-stats"><button type="button" onClick={onGoToConcerts}><span className="home-stat-icon"><CalendarDays size={17} /></span><span><small>PROPERS CONCERTS</small><strong>{upcoming.length}</strong></span></button><button type="button" onClick={onGoToCalendar}><span className="home-stat-icon"><CalendarDays size={17} /></span><span><small>ENCARA AQUEST MES</small><strong>{monthConcerts}</strong></span></button><div><span className="home-stat-icon home-pending-icon"><CircleHelp size={17} /></span><span><small>PER RESOLDRE</small><strong>{pending.length}</strong></span></div></div>
    <div className="home-columns"><section className="home-panel home-pending-panel"><div className="home-panel-heading"><div><span className="eyebrow">SEGUIMENT DE LES FITXES</span><h2>Punts per resoldre</h2></div><span className="home-panel-count">{pending.length}</span></div>{pending.length ? <div className="home-pending-list">{pending.slice(0, 5).map(({ concert, task }, index) => <button type="button" key={`${concert.id}-${task}-${index}`} onClick={() => onOpen(concert.id)}><span className="home-pending-dot" /><span className="home-pending-copy"><strong>{task}</strong><small>{concert.title} · {formatDate(concert.date, { day: 'numeric', month: 'short' })}</small></span><ArrowRight size={16} /></button>)}</div> : <div className="home-all-clear"><Check size={19} /><div><strong>Tot al dia</strong><p>No hi ha compromisos pendents segons les dades de les fitxes.</p></div></div>}{pending.length > 5 ? <button className="text-button home-more-pending" type="button" onClick={onGoToConcerts}>Veure tots els concerts amb pendents <ArrowRight size={14} /></button> : null}</section>
      <section className="home-panel home-upcoming-panel"><div className="home-panel-heading"><div><span className="eyebrow">A L’AGENDA</span><h2>Els següents</h2></div><button type="button" className="text-button" onClick={onGoToConcerts}>Tots <ArrowRight size={14} /></button></div>{soon.length ? <div className="home-upcoming-list">{soon.map((concert) => <button type="button" key={concert.id} onClick={() => onOpen(concert.id)}><span className="home-upcoming-date"><strong>{concert.date.slice(8, 10)}</strong><small>{formatDate(concert.date, { month: 'short' }).replace('.', '')}</small></span><span className="home-upcoming-copy"><strong>{concert.title}</strong><small>{[concert.venue, concert.city].filter(Boolean).join(' · ') || 'Ubicació per concretar'}</small></span><ArrowRight size={15} /></button>)}</div> : <p className="home-empty-note">Quan afegeixis concerts, els veuràs aquí.</p>}</section></div>
  </div>
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="info-row"><span>{label}</span><strong>{children || '—'}</strong></div>
}

function Detail({ concert, onBack, onEdit, onDelete, onToggle, onUpload, onRemoveFile }: { concert: Concert; onBack: () => void; onEdit: () => void; onDelete: () => void; onToggle: (id: string) => Promise<void>; onUpload: (id: string, file: File) => Promise<void>; onRemoveFile: (id: string) => Promise<void> }) {
  const [busyMaterial, setBusyMaterial] = useState(false)
  const [materialError, setMaterialError] = useState('')
  const [busyDocument, setBusyDocument] = useState<string | null>(null)
  const [documentError, setDocumentError] = useState('')
  const [documentLinks, setDocumentLinks] = useState<Record<string, string>>({})
  const [people, setPeople] = useState<BandPerson[]>([])
  const [merchProducts, setMerchProducts] = useState<MerchProduct[]>([])
  const [merchSales, setMerchSales] = useState<MerchSale[]>([])
  const [savingProductId, setSavingProductId] = useState<string | null>(null)
  const [undoingSaleIds, setUndoingSaleIds] = useState<string[]>([])
  const [saleError, setSaleError] = useState('')
  const [merchSearch, setMerchSearch] = useState('')
  const d = concert.details
  useEffect(() => {
    let active = true
    const files = concert.details.documents.filter((doc) => doc.storagePath)
    void Promise.all(files.map(async (doc) => {
      try { return [doc.id, await signedDocumentUrl(doc.storagePath!)] as const }
      catch { return [doc.id, ''] as const }
    })).then((entries) => { if (active) setDocumentLinks(Object.fromEntries(entries)) })
    return () => { active = false }
  }, [concert.details.documents])
  useEffect(() => { let active = true; Promise.all([listResource<BandPerson>('band_people'), listMerchProducts(), listMerchSales()]).then(([items, products, sales]) => { if (active) { setPeople(items); setMerchProducts(products); setMerchSales(sales) } }).catch((cause) => { if (active) setSaleError(cause instanceof Error ? cause.message : 'No s’han pogut carregar les vendes.') }); return () => { active = false } }, [concert.id])
  const concertSales = merchSales.filter((item) => item.concertId === concert.id)
  const pending = getPending(concert)
  const sortedSchedule = [...d.schedule].filter((x) => x.time || x.label).sort((a, b) => a.time.localeCompare(b.time))
  const concertMerchRevenue = concertSales.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
  const visibleMerchProducts = merchProducts.filter((product) => product.active && `${product.name} ${(product.sizes || []).map((size) => size.name).join(' ')}`.toLocaleLowerCase('ca').includes(merchSearch.toLocaleLowerCase('ca')))
  const soldForConcert = (productId: string, size?: string) => concertSales.filter((item) => item.productId === productId && (size ? item.size === size : !item.size)).reduce((sum, item) => sum + item.quantity, 0)
  const stockRemaining = (product: MerchProduct, size?: string) => { const stock = size ? product.sizes?.find((item) => item.name === size)?.stock || 0 : product.stock; const sold = merchSales.filter((item) => item.productId === product.id && (size ? item.size === size : !item.size)).reduce((sum, item) => sum + item.quantity, 0); return Math.max(stock - sold, 0) }
  async function toggleMaterial(id: string) {
    setBusyMaterial(true)
    setMaterialError('')
    try { await onToggle(id) } catch (cause) { setMaterialError(cause instanceof Error ? cause.message : 'No s’ha pogut desar el canvi.') } finally { setBusyMaterial(false) }
  }
  async function upload(id: string, file?: File) {
    if (!file) return
    setBusyDocument(id)
    setDocumentError('')
    try { await onUpload(id, file) }
    catch (cause) { setDocumentError(cause instanceof Error ? cause.message : 'No s’ha pogut pujar el fitxer.') }
    finally { setBusyDocument(null) }
  }
  async function removeFile(id: string) {
    setBusyDocument(id)
    setDocumentError('')
    try { await onRemoveFile(id) }
    catch (cause) { setDocumentError(cause instanceof Error ? cause.message : 'No s’ha pogut treure el fitxer.') }
    finally { setBusyDocument(null) }
  }
  async function quickSale(product: MerchProduct, size?: string) { const sold = merchSales.filter((item) => item.productId === product.id && (size ? item.size === size : !item.size)).reduce((sum, item) => sum + item.quantity, 0); const available = size ? product.sizes?.find((item) => item.name === size)?.stock ?? 0 : product.stock; if (sold >= available) { setSaleError(`No queda estoc de ${product.name}${size ? ` talla ${size}` : ''}.`); return } const savingKey = `${product.id}:${size || ''}`; setSavingProductId(savingKey); setSaleError(''); try { const saved = await saveMerchSale({ id: createId(), concertId: concert.id, productId: product.id, quantity: 1, unitPrice: product.price, note: '', size }); setMerchSales((items) => [saved, ...items]) } catch (cause) { setSaleError(cause instanceof Error ? cause.message.replace('No hi ha prou estoc disponible', `No queda prou estoc de ${product.name}${size ? ` talla ${size}` : ''}`).replace('Producte de marxandatge no trobat', 'No s’ha trobat el producte.') : 'No s’ha pogut registrar la venda.') } finally { setSavingProductId((id) => id === savingKey ? null : id) } }
  async function undoSale(sale: MerchSale) { setUndoingSaleIds((ids) => [...ids, sale.id]); setSaleError(''); try { await deleteMerchSale(sale.id); setMerchSales((items) => items.filter((item) => item.id !== sale.id)) } catch (cause) { setSaleError(cause instanceof Error ? cause.message : 'No s’ha pogut desfer la venda.') } finally { setUndoingSaleIds((ids) => ids.filter((id) => id !== sale.id)) } }

  return <div className="detail-shell">
    <button className="text-button back-button" onClick={onBack}><ArrowLeft size={17} /> Tornar als concerts</button>
    <div className="detail-hero"><div className="detail-hero-main"><span className="eyebrow">FITXA DE CONCERT <span className="eyebrow-separator">/</span> {statusLabels[concert.status].toUpperCase()}</span><h1>{concert.title}</h1><div className="hero-meta"><span><CalendarDays size={17} />{formatDate(concert.date)}</span><span><MapPin size={17} />{[concert.venue, concert.city].filter(Boolean).join(' · ') || 'Ubicació per concretar'}</span></div></div><div className="hero-action"><button className="button button-light" onClick={onEdit}><Pencil size={16} /> Editar fitxa</button></div></div>
    <div className="detail-body"><div className="detail-main">
      <section className="pending-panel"><div className="panel-title"><div className="panel-title-icon"><CircleHelp size={19} /></div><div><span className="eyebrow">SEGUIMENT</span><h2>Coses pendents <span className="count-pill">{pending.length}</span></h2></div></div>{pending.length ? <ul className="pending-list">{pending.map((item, index) => <li key={`${item}-${index}`}><span className="pending-marker" />{item}</li>)}</ul> : <p className="empty-pending"><Check size={18} /> No hi ha res pendent segons les dades d'aquesta fitxa.</p>}</section>

      <section className="detail-section"><div className="detail-section-heading"><Wallet size={19} /><h2>Acord</h2></div><div className="info-rows"><InfoRow label="Catxet acordat">{formatMoney(concert.feeAmount)}</InfoRow><InfoRow label="Catxet cobrat">{formatMoney(concert.feePaid)}</InfoRow>{d.conditions ? <InfoRow label="Condicions">{d.conditions}</InfoRow> : null}{d.cancellation ? <InfoRow label="Cancel·lació">{d.cancellation}</InfoRow> : null}</div></section>

      <section className="detail-section"><div className="detail-section-heading"><Clock3 size={19} /><h2>Horaris i logística</h2></div>{sortedSchedule.length ? <div className="timeline">{sortedSchedule.map((item) => <div className="timeline-item" key={item.id}><span className="timeline-time">{item.time || '—'}</span><span className="timeline-line" /><div><strong>{item.label || item.kind || 'Sense nom'}</strong>{item.place ? <p>{item.place}</p> : null}</div></div>)}</div> : <p className="section-empty">Encara no hi ha horaris afegits.</p>}{d.travel || d.loadIn || d.parking ? <div className="info-rows subsection-rows">{d.travel ? <InfoRow label="Desplaçament">{d.travel}</InfoRow> : null}{d.loadIn ? <InfoRow label="Accés de càrrega">{d.loadIn}</InfoRow> : null}{d.parking ? <InfoRow label="Aparcament">{d.parking}</InfoRow> : null}</div> : null}</section>

      <section className="detail-section"><div className="detail-section-heading"><FileText size={19} /><h2>Documents</h2></div>{d.documents.length ? <div className="document-list">{d.documents.map((doc) => <div className="document-item" key={doc.id}><span className="document-icon"><FileText size={17} /></span><div><strong>{doc.name || 'Document sense nom'}</strong><small>{doc.direction === 'enviar' ? 'Per enviar' : 'Per rebre'} · {doc.status === 'pendent' ? 'Pendent' : doc.status === 'no_cal' ? 'No cal' : doc.direction === 'enviar' ? 'Enviat' : 'Rebut'}</small>{doc.storagePath ? <div className="document-file"><Paperclip size={13} />{documentLinks[doc.id] ? <a href={documentLinks[doc.id]} target="_blank" rel="noreferrer">{doc.fileName || 'Obrir fitxer adjunt'}</a> : documentLinks[doc.id] === '' ? <span>No s'ha pogut obrir el fitxer.</span> : <span>{doc.fileName || 'Fitxer adjunt'} · preparant enllaç…</span>}{cloudConfigured ? <button type="button" disabled={busyDocument !== null} onClick={() => void removeFile(doc.id)}>Treure</button> : null}</div> : null}{cloudConfigured ? <label className="document-upload">{busyDocument === doc.id ? 'Pujant fitxer…' : doc.storagePath ? 'Substituir fitxer' : 'Adjuntar fitxer'}<input type="file" disabled={busyDocument !== null} onChange={(e) => { const file = e.target.files?.[0]; void upload(doc.id, file); e.target.value = '' }} /></label> : null}</div>{safeLink(doc.url) ? <a href={safeLink(doc.url)!} target="_blank" rel="noreferrer" aria-label={`Obrir enllaç de ${doc.name}`}><ExternalLink size={16} /></a> : null}</div>)}</div> : <p className="section-empty">Encara no hi ha documents registrats. Afegeix-los editant la fitxa.</p>}{documentError ? <p className="form-error" role="alert">{documentError}</p> : null}</section>

      <section className="detail-section"><div className="detail-section-heading"><PackageCheck size={19} /><h2>Material a portar</h2><span className="section-counter">{d.materials.filter((item) => item.loaded).length}/{d.materials.length} carregat</span></div>{d.materials.length ? <div className="material-list">{d.materials.map((item) => <label className={`material-item ${item.loaded ? 'is-loaded' : ''}`} key={item.id}><input type="checkbox" checked={item.loaded} disabled={busyMaterial} onChange={() => void toggleMaterial(item.id)} /><span className="check-visual"><Check size={14} /></span>{item.name || 'Material sense nom'}</label>)}</div> : <p className="section-empty">Afegeix material a la fitxa per preparar la càrrega.</p>}{materialError ? <p className="form-error" role="alert">{materialError}</p> : null}</section>

       <section className="detail-section"><div className="detail-section-heading"><Music2 size={19} /><h2>Actuació</h2></div>{d.setlist ? <div className="setlist">{d.setlist.split('\n').filter(Boolean).map((song, index) => <div key={index}><span>{String(index + 1).padStart(2, '0')}</span>{song}</div>)}</div> : <p className="section-empty">Encara no hi ha setlist.</p>}{d.passes ? <div className="info-rows subsection-rows"><InfoRow label="Invitacions i passis">{d.passes}</InfoRow></div> : null}</section>
       <section className="detail-section merch-quick-sale">
         <div className="detail-section-heading quick-sale-heading"><span className="quick-sale-heading-icon"><ShoppingBag size={19} /></span><div><h2>Venda ràpida</h2><p>Un toc per cada producte venut.</p></div><div className="quick-sale-total"><strong>{formatMoney(concertSales.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0))}</strong><small>{concertSales.reduce((sum, item) => sum + item.quantity, 0)} unitats</small></div></div>
         {merchProducts.length ? <label className="quick-sale-search"><Search size={16} /><input type="search" value={merchSearch} onChange={(event) => setMerchSearch(event.target.value)} placeholder="Cerca producte o talla…" /><span>{visibleMerchProducts.length} productes</span></label> : null}
         {visibleMerchProducts.length ? <div className="quick-sale-grid">{visibleMerchProducts.map((product) => { const sizes = product.sizes || []; const productKey = `${product.id}:`; return <article className="quick-sale-product" key={product.id}><div className="quick-product-top"><div><strong>{product.name}</strong><span>{formatMoney(product.price)}</span></div>{!sizes.length ? <button type="button" className="quick-sale-add" disabled={savingProductId === productKey || stockRemaining(product) === 0} onClick={() => void quickSale(product)}>{savingProductId === productKey ? '…' : '+1'}</button> : null}</div>{sizes.length ? <div className="quick-sale-sizes">{sizes.map((size) => { const key = `${product.id}:${size.name}`; const remaining = stockRemaining(product, size.name); const soldHere = soldForConcert(product.id, size.name); return <button type="button" key={size.name} disabled={savingProductId === key || remaining === 0} onClick={() => void quickSale(product, size.name)}><strong>{size.name}</strong><small>{savingProductId === key ? 'Desant…' : remaining ? `${remaining} disponibles` : 'Esgotada'}</small><span>{soldHere} al concert</span></button> })}</div> : <div className="quick-product-stock"><span>{stockRemaining(product)} disponibles</span><span>{soldForConcert(product.id)} venudes en aquest concert</span></div>}</article> })}</div> : merchProducts.length ? <p className="section-empty">No hi ha productes que coincideixin amb «{merchSearch}».</p> : <p className="section-empty">Afegeix productes a Marxandatge per activar la venda ràpida.</p>}
         {saleError ? <p className="form-error" role="alert">{saleError}</p> : null}
         {concertSales.length ? <div className="quick-sale-history"><div className="quick-sale-history-heading"><strong>Últimes vendes</strong><span>{concertSales.length}</span></div>{concertSales.slice(0, 6).map((sale) => <div className="quick-sale-history-row" key={sale.id}><span className="quick-sale-history-quantity">{sale.quantity}×</span><span className="quick-sale-history-name">{merchProducts.find((item) => item.id === sale.productId)?.name || 'Producte eliminat'}{sale.size ? ` · ${sale.size}` : ''}</span><strong>{formatMoney(sale.quantity * sale.unitPrice)}</strong><button type="button" className="text-button" disabled={undoingSaleIds.includes(sale.id)} onClick={() => void undoSale(sale)}>{undoingSaleIds.includes(sale.id) ? '…' : 'Desfer'}</button></div>)}</div> : null}
       </section>
    </div><aside className="detail-aside">
      <section className="aside-card"><div className="aside-heading"><Navigation size={18} /><h3>Ubicació</h3></div><strong>{concert.venue || 'Lloc per concretar'}</strong>{concert.address ? <a className="address-link" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(concert.address)}`} target="_blank" rel="noreferrer">{concert.address} <ExternalLink size={14} /></a> : <p>Encara no hi ha adreça</p>}{concert.city ? <p>{concert.city}</p> : null}</section>
      <section className="aside-card"><div className="aside-heading"><UsersRound size={18} /><h3>Persones</h3></div>{d.contactName ? <><span className="aside-label">CONTACTE RESPONSABLE</span><strong>{d.contactName}</strong>{d.contactPhone ? <a href={`tel:${d.contactPhone}`} className="aside-contact">{d.contactPhone}</a> : null}{d.contactEmail ? <a href={`mailto:${d.contactEmail}`} className="aside-contact">{d.contactEmail}</a> : null}</> : null}{d.personIds.length ? <div className="selected-people">{d.personIds.map((id) => <span key={id}>{people.find((person) => person.id === id)?.name || 'Persona eliminada'}</span>)}</div> : null}{!d.contactName && !d.personIds.length ? <p>Encara no hi ha contacte.</p> : null}{d.team ? <><span className="aside-label team-label">NOTES D’EQUIP</span><p>{d.team}</p></> : null}</section>
      <section className="aside-card"><div className="aside-heading"><Ticket size={18} /><h3>Hospitalitat</h3></div><InfoRow label="Sopar">{d.dinner === 'si' ? 'Sí' : d.dinner === 'no' ? 'No' : 'Encara no se sap'}</InfoRow><InfoRow label="Allotjament">{d.lodging === 'si' ? d.lodgingDetails || 'Sí' : d.lodging === 'no' ? 'No cal' : 'Encara no se sap'}</InfoRow>{d.lodgingAddress ? <a className="inline-link" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(d.lodgingAddress)}`} target="_blank" rel="noreferrer">{d.lodgingAddress} <ExternalLink size={14} /></a> : null}</section>
       <section className="aside-card"><div className="aside-heading"><Wallet size={18} /><h3>Tancament</h3></div>{concertSales.length ? <InfoRow label="Marxandatge">{formatMoney(concertMerchRevenue)}</InfoRow> : d.merchSales > 0 ? <InfoRow label="Vendes antigues (resum)">{formatMoney(d.merchSales)}</InfoRow> : <InfoRow label="Marxandatge">{formatMoney(0)}</InfoRow>}<InfoRow label="Despeses">{formatMoney(d.expenses)}</InfoRow>{d.notes ? <p className="closing-notes">{d.notes}</p> : null}</section>
      <button type="button" className="delete-link" onClick={onDelete}><Trash2 size={15} /> Eliminar concert</button>
    </aside></div>
  </div>
}

export default function App() {
  const [theme, setTheme] = useState<ThemeId>(() => {
    const stored = localStorage.getItem('escena-theme')
    return stored === 'classic' || stored === 'live-stage' || stored === 'club' || stored === 'paper' ? stored : 'live-stage'
  })
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(!cloudConfigured)
  const [concerts, setConcerts] = useState<Concert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [screen, setScreen] = useState<Screen>('home')
  const [workspaceName, setWorkspaceName] = useState('La nostra banda')
  const [workspaceLogo, setWorkspaceLogo] = useState<string | undefined>()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [formInitial, setFormInitial] = useState<Concert | null>(null)
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [search, setSearch] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine)

  useEffect(() => { localStorage.setItem('escena-theme', theme); document.documentElement.dataset.theme = theme }, [theme])

  useEffect(() => {
    if (!authReady || (cloudConfigured && !session)) return
    let active = true
    getBandProfile().then((profile) => { if (active) { setWorkspaceName(profile.name); setWorkspaceLogo(profile.logoUrl) } }).catch(() => {})
    return () => { active = false }
  }, [authReady, session?.user.id, online])

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthReady(true) }).catch(() => { setSession(null); setAuthReady(true) })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, current) => setSession(current))
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!authReady || (cloudConfigured && !session)) {
      setLoading(false)
       if (authReady && cloudConfigured) { setConcerts([]); setSelectedId(null); setScreen('home') }
      return
    }
    let alive = true
    setLoading(true)
    if (cloudConfigured) setConcerts([])
    listConcerts().then((data) => { if (alive) { setConcerts(data); setError('') } }).catch((cause) => { if (alive) setError(cause instanceof Error ? cause.message : 'No s’han pogut carregar els concerts.') }).finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [authReady, session?.user.id])

  useEffect(() => {
    const becameOnline = () => { setOnline(true); void Promise.all([syncOfflineConcerts(), syncOfflineData()]).then(() => { if (cloudConfigured && session) void listConcerts().then(setConcerts).catch(() => {}) }) }
    const becameOffline = () => setOnline(false)
    window.addEventListener('online', becameOnline)
    window.addEventListener('offline', becameOffline)
    if (online) void Promise.all([syncOfflineConcerts(), syncOfflineData()])
    return () => { window.removeEventListener('online', becameOnline); window.removeEventListener('offline', becameOffline) }
  }, [online, session])

  if (!authReady) return <div className="loading-page">Carregant Escena…</div>
  if (cloudConfigured && !session) return <AuthScreen />

  const selected = concerts.find((item) => item.id === selectedId)
  const sorted = [...concerts].sort((a, b) => a.date.localeCompare(b.date))
  const visible = sorted.filter((item) => `${item.title} ${item.venue} ${item.city}`.toLocaleLowerCase('ca').includes(search.toLocaleLowerCase('ca')))
  const today = new Date()
  const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const upcoming = visible.filter((item) => item.date >= todayString && item.status !== 'cancel·lat')
  const other = visible.filter((item) => item.date < todayString || item.status === 'cancel·lat')
  const next = sorted.find((item) => item.date >= todayString && item.status !== 'cancel·lat')
  const totalPending = concerts.reduce((sum, item) => sum + getPending(item).length, 0)

  function open(id: string) { setSelectedId(id); setScreen('detail'); setMenuOpen(false); window.scrollTo(0, 0) }
  function navigate(to: Screen) { setScreen(to); setSelectedId(null); setMenuOpen(false); window.scrollTo(0, 0) }
  function startForm(initial: Concert) { setFormInitial(initial); setScreen('form'); setMenuOpen(false); window.scrollTo(0, 0) }
  async function save(item: Concert) {
    const saved = await saveConcert(item)
    const previous = concerts.find((existing) => existing.id === saved.id)
    const retained = new Set(saved.details.documents.map((doc) => doc.storagePath))
    for (const doc of previous?.details.documents ?? []) {
      if (doc.storagePath && isConcertOwnedFile(saved, doc.storagePath) && !retained.has(doc.storagePath)) void removeConcertDocumentFile(doc.storagePath).catch(() => {})
    }
    setConcerts((prev) => [...prev.filter((existing) => existing.id !== saved.id), saved])
    open(saved.id)
  }
  async function remove() {
    if (!selected || !window.confirm(`Vols eliminar «${selected.title}»? Aquesta acció no es pot desfer.`)) return
    try { await deleteConcert(selected.id); for (const doc of selected.details.documents) { if (doc.storagePath && isConcertOwnedFile(selected, doc.storagePath)) void removeConcertDocumentFile(doc.storagePath).catch(() => {}) }; setConcerts((prev) => prev.filter((item) => item.id !== selected.id)); navigate('list') } catch (cause) { setError(cause instanceof Error ? cause.message : 'No s’ha pogut eliminar el concert.') }
  }
  async function toggleMaterial(id: string) {
    if (!selected) return
    const changed: Concert = { ...selected, details: { ...selected.details, materials: selected.details.materials.map((item) => item.id === id ? { ...item, loaded: !item.loaded } : item) } }
    const saved = await saveConcert(changed)
    setConcerts((prev) => prev.map((item) => item.id === saved.id ? saved : item))
  }
  async function uploadDocument(id: string, file: File) {
    if (!selected) return
    const saved = await uploadConcertDocument(selected, id, file)
    setConcerts((prev) => prev.map((item) => item.id === saved.id ? saved : item))
  }
  async function removeDocumentFile(id: string) {
    if (!selected) return
    const doc = selected.details.documents.find((item) => item.id === id)
    if (!doc?.storagePath) return
    const changed: Concert = { ...selected, details: { ...selected.details, documents: selected.details.documents.map((item) => item.id === id ? { ...item, storagePath: undefined, fileName: undefined } : item) } }
    const saved = await saveConcert(changed)
    setConcerts((prev) => prev.map((item) => item.id === saved.id ? saved : item))
    if (isConcertOwnedFile(selected, doc.storagePath)) void removeConcertDocumentFile(doc.storagePath).catch(() => {})
  }

  return <div className={`app-layout ${themeClass(theme)}`}>
    <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}><div className="sidebar-brand"><div className="brand-mark"><Music2 size={21} strokeWidth={2.3} /></div><span>escena<span className="brand-dot">.</span></span><button className="icon-button close-menu" aria-label="Tancar menú" onClick={() => setMenuOpen(false)}><X size={20} /></button></div><div className="workspace-label">BANDA O ARTISTA</div><button type="button" className="workspace-name" aria-label={`Configurar l’espai ${workspaceName}`} onClick={() => navigate('settings')}><div className="workspace-avatar">{workspaceLogo ? <img src={workspaceLogo} alt="" /> : workspaceName.trim().charAt(0).toUpperCase() || 'B'}</div><span>{workspaceName}</span><SettingsIcon size={16} /></button>
       <nav className="sidebar-nav" aria-label="Navegació principal"><button className={screen === 'home' ? 'nav-active' : ''} onClick={() => navigate('home')}><House size={19} /> Inici</button><button className={screen === 'list' || screen === 'detail' || screen === 'form' ? 'nav-active' : ''} onClick={() => navigate('list')}><List size={19} /> Concerts</button><button className={screen === 'calendar' ? 'nav-active' : ''} onClick={() => navigate('calendar')}><CalendarDays size={19} /> Calendari</button><button className={screen === 'library' ? 'nav-active' : ''} onClick={() => navigate('library')}><FileText size={19} /> Documents</button><button className={screen === 'treasury' ? 'nav-active' : ''} onClick={() => navigate('treasury')}><Wallet size={19} /> Tresoreria</button><button className={screen === 'merch' ? 'nav-active' : ''} onClick={() => navigate('merch')}><ShoppingBag size={19} /> Marxandatge</button><div className="nav-divider" /><button className={screen === 'people' ? 'nav-active' : ''} onClick={() => navigate('people')}><UsersRound size={19} /> Persones</button><button className={screen === 'materials' ? 'nav-active' : ''} onClick={() => navigate('materials')}><PackageCheck size={19} /> Material</button><button className={screen === 'setlists' ? 'nav-active' : ''} onClick={() => navigate('setlists')}><ListMusic size={19} /> Setlists</button><div className="nav-divider" /><button className={screen === 'settings' ? 'nav-active' : ''} onClick={() => navigate('settings')}><SettingsIcon size={19} /> Configuració</button></nav>
      <div className="sidebar-bottom"><div className="sidebar-note"><span className="note-icon"><CircleHelp size={18} /></span><strong>Tot sota control</strong><p>Una fitxa per concert. Cap detall perdut pel camí.</p></div><div className="sidebar-account"><div className="account-avatar">{session?.user.email?.[0].toUpperCase() || 'D'}</div><div><strong>{session ? 'Compte compartit' : 'Mode demostració'}</strong><span>{session?.user.email || 'Dades només en aquest navegador'}</span></div>{session && supabase ? <button type="button" className="logout-button" onClick={() => void supabase?.auth.signOut()}>Sortir</button> : null}</div></div>
    </aside>
    {menuOpen ? <button className="mobile-overlay" aria-label="Tancar menú" onClick={() => setMenuOpen(false)} /> : null}
      <main className="main-area"><header className="topbar"><button type="button" className="icon-button menu-trigger" aria-label="Obrir menú" onClick={() => setMenuOpen(true)}><Menu size={21} /></button><span className="topbar-path">Espai de la banda <span>/</span> {screen === 'home' ? 'Inici' : screen === 'calendar' ? 'Calendari' : screen === 'detail' ? 'Fitxa del concert' : screen === 'form' ? 'Editar fitxa' : screen === 'library' ? 'Documents' : screen === 'treasury' ? 'Tresoreria' : screen === 'merch' ? 'Marxandatge' : screen === 'people' ? 'Persones' : screen === 'materials' ? 'Material' : screen === 'setlists' ? 'Setlists' : screen === 'settings' ? 'Configuració' : 'Concerts'}</span><span className="topbar-right">{cloudConfigured ? (online ? 'EN LÍNIA' : 'SENSE CONNEXIÓ') : 'DEMO LOCAL'} <span className={`online-dot ${online ? '' : 'offline-dot'}`} /></span></header>
      <div className="content-area">
        {error ? <div className="global-error" role="alert">{error}<button onClick={() => setError('')} aria-label="Tancar avís"><X size={16} /></button></div> : null}
        {!cloudConfigured ? <div className="demo-banner">Estàs provant una demo local: els canvis es guarden només en aquest navegador. Connecta Supabase per compartir concerts entre dispositius.</div> : null}
        {loading ? <div className="content-loading">Carregant concerts…</div> : null}
        {screen === 'library' ? <Suspense fallback={<div className="content-loading">Carregant documents…</div>}><BandLibrary /></Suspense> : null}
        {screen === 'treasury' ? <Suspense fallback={<div className="content-loading">Carregant tresoreria…</div>}><Treasury concerts={concerts} /></Suspense> : null}
        {screen === 'merch' ? <Suspense fallback={<div className="content-loading">Carregant marxandatge…</div>}><Merch concerts={concerts} /></Suspense> : null}
         {screen === 'people' ? <Suspense fallback={<div className="content-loading">Carregant persones…</div>}><BandPeople /></Suspense> : null}
         {screen === 'materials' ? <Suspense fallback={<div className="content-loading">Carregant material…</div>}><BandMaterials /></Suspense> : null}
         {screen === 'setlists' ? <Suspense fallback={<div className="content-loading">Carregant setlists…</div>}><Setlists /></Suspense> : null}
         {screen === 'settings' ? <Settings theme={theme} onThemeChange={(value: ThemeId) => { setTheme(value); document.documentElement.dataset.theme = value }} onImported={() => window.location.reload()} workspaceName={workspaceName} workspaceLogo={workspaceLogo} onWorkspaceNameChange={setWorkspaceName} onWorkspaceLogoChange={setWorkspaceLogo} /> : null}
         {!loading && screen === 'home' ? <HomeView concerts={concerts} onOpen={open} onNewConcert={() => startForm(newConcert())} onGoToConcerts={() => navigate('list')} onGoToCalendar={() => navigate('calendar')} /> : null}
         {!loading && screen === 'form' && formInitial ? <ConcertForm key={formInitial.id} initial={formInitial} onSave={save} onCancel={() => formInitial.title ? open(formInitial.id) : navigate('list')} /> : null}
        {!loading && screen === 'detail' && selected ? <Detail key={selected.id} concert={selected} onBack={() => navigate('list')} onEdit={() => startForm(selected)} onDelete={() => void remove()} onToggle={toggleMaterial} onUpload={uploadDocument} onRemoveFile={removeDocumentFile} /> : null}
        {!loading && (screen === 'list' || screen === 'calendar') ? <>
          <div className="page-heading list-heading"><div><span className="eyebrow">LA BANDA EN MOVIMENT</span><h1>Els concerts<span className="heading-period">.</span></h1><p>Tot el que passa abans, durant i després de pujar a l'escenari.</p></div><button className="button button-primary new-button" onClick={() => startForm(newConcert())}><Plus size={18} /> Nou concert</button></div>
          <div className="overview-strip"><div className="overview-next"><div className="overview-icon"><Music2 size={22} /></div><div><span className="eyebrow">PROPER CONCERT</span><strong>{next ? next.title : 'Encara no hi ha cap data'}</strong><small>{next ? `${formatDate(next.date)} · ${next.city || next.venue || 'Lloc per concretar'}` : 'Afegeix un concert per començar'}</small></div>{next ? <button aria-label={`Obrir ${next.title}`} onClick={() => open(next.id)} className="overview-arrow"><ArrowRight size={19} /></button> : null}</div><div className="overview-stat"><span className="eyebrow">PER RESOLDRE</span><strong>{totalPending.toString().padStart(2, '0')}</strong><small>{totalPending === 1 ? 'qüestió pendent' : 'qüestions pendents'}</small></div></div>
          <div className="listing-header"><div className="view-tabs"><button className={screen === 'list' ? 'active-tab' : ''} onClick={() => setScreen('list')}><List size={17} /> Llista</button><button className={screen === 'calendar' ? 'active-tab' : ''} onClick={() => setScreen('calendar')}><CalendarDays size={17} /> Calendari</button></div>{screen === 'list' ? <label className="search-box"><Search size={18} /><span className="sr-only">Cerca concerts</span><input type="search" placeholder="Cerca concerts..." value={search} onChange={(e) => setSearch(e.target.value)} /></label> : null}</div>
          {screen === 'calendar' ? <CalendarView concerts={concerts} onOpen={open} month={month} setMonth={setMonth} /> : <div className="concert-list"><div className="list-label"><span>PROPERS CONCERTS</span><span>{upcoming.length} {upcoming.length === 1 ? 'concert' : 'concerts'}</span></div>{upcoming.length ? upcoming.map((item) => <ConcertCard key={item.id} concert={item} onOpen={() => open(item.id)} />) : <div className="empty-list"><CalendarDays size={25} /><h3>{search ? 'Cap resultat' : 'Encara no hi ha concerts propers'}</h3><p>{search ? 'Prova una altra cerca.' : 'Crea un concert i comença a reunir tota la informació.'}</p></div>}{other.length ? <><div className="list-label past-label"><span>ANTERIORS I CANCEL·LATS</span><span>{other.length}</span></div>{other.map((item) => <ConcertCard key={item.id} concert={item} onOpen={() => open(item.id)} />)}</> : null}</div>}
        </> : null}
      </div><footer className="app-footer"><span>Escena · Els concerts, clars.</span><span>Fet per al camí <ArrowRight size={14} /></span></footer>
    </main>
  </div>
}
