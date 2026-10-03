import { lazy, Suspense, useEffect, useRef, useState, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { ArrowLeft, ArrowRight, AudioLines, CalendarDays, Check, ChevronLeft, ChevronRight, CircleHelp, Clock3, ExternalLink, FileText, List, MapPin, Menu, House, ListMusic, LogOut, Mail, MapPinned, Music2, Navigation, PackageCheck, Paperclip, Pencil, Phone, Plus, Search, ShoppingBag, Sparkles, Ticket, Trash2, Image as ImageIcon, Settings as SettingsIcon, UsersRound, Wallet, X } from 'lucide-react'
import ConcertForm from './ConcertForm'
import ConcertAssistant from './ConcertAssistant'
import { cloudConfigured, completeBandOnboarding, dataStorageKey, deleteConcert, deleteMerchSale, discardOfflineDataChange, getBandLabel, getBandProfile, getCachedBandLabel, getCachedBandProfile, getOfflineSyncStatus, isConcertOwnedFile, listConcerts, listMerchProducts, listMerchSales, listMoneyMovements, listResource, removeConcertDocumentFile, resolveOfflineConcertConflict, resolveOfflineDataConflict, saveConcert, saveMerchSale, saveResource, setDataSessionOwner, signedDocumentUrl, supabase, syncOfflineConcerts, syncOfflineData, uploadConcertDocument, type OfflineSyncItem } from './data'
import { concertClosingSummary, concertSettlement, createId, type BandPerson, type Concert, formatDate, formatMoney, getPending, newConcert, statusLabels, type LabelAgreement, type MerchProduct, type MerchSale, type MoneyMovement, type SetlistTemplate } from './model'
import Settings, { themeClass, type ThemeId } from './Settings'
import { useDialogFocus } from './useDialogFocus'
import { TeamFeesSummary } from './ConcertTeamFees'

const BandLibrary = lazy(() => import('./BandLibrary'))
const Treasury = lazy(() => import('./Treasury'))
const Merch = lazy(() => import('./Merch'))
const BandPeople = lazy(() => import('./BandPeople'))
const BandMaterials = lazy(() => import('./BandMaterials'))
const Setlists = lazy(() => import('./Setlists'))
const Songs = lazy(() => import('./Songs'))
const SongListening = lazy(() => import('./SongListening'))
const TourPoster = lazy(() => import('./TourPoster'))
type Screen = 'home' | 'list' | 'calendar' | 'detail' | 'form' | 'assistant' | 'library' | 'treasury' | 'merch' | 'people' | 'materials' | 'setlists' | 'songs' | 'poster' | 'settings'
interface AppHistoryState {
  escena: true
  screen: Screen
  selectedId?: string
  formInitial?: Concert
}

function safeLink(value: string): string | null {
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null
  } catch {
    return null
  }
}

function BrandName() {
  return (
    <span className="brand-name" role="img" aria-label="Escena">
      <span className="brand-letters" aria-hidden="true">
        escena
      </span>
      <span className="brand-dot" aria-hidden="true">
        .
      </span>
    </span>
  )
}

function BrandMark() {
  return <img className="brand-mark" src="/escena-logo.svg" alt="" />
}

function AuthScreen({ initialError = '' }: { initialError?: string }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [creating, setCreating] = useState(false)
  const [working, setWorking] = useState(false)
  const [message, setMessage] = useState(initialError)

  const [messageType, setMessageType] = useState<'error' | 'success'>('error')

  async function signInWithGoogle() {
    if (!supabase) return
    setWorking(true)
    setMessage('')
    setMessageType('error')
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      })
      if (error) {
        setMessageType('error')
        setMessage(error.message)
      }
    } catch (cause) {
      setMessageType('error')
      setMessage(cause instanceof Error ? cause.message : 'No s’ha pogut connectar amb Google. Torna-ho a provar.')
    } finally {
      setWorking(false)
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) return
    setMessage('')
    setMessageType('error')

    if (creating && password.length < 6) {
      setMessage('La contrasenya ha de tenir com a mínim 6 caràcters.')
      return
    }
    if (creating && password !== confirmPassword) {
      setMessage('Les contrasenyes no coincideixen.')
      return
    }

    setWorking(true)
    try {
      const result = creating
        ? await supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: window.location.origin },
          })
        : await supabase.auth.signInWithPassword({ email, password })
      if (result.error) {
        setMessageType('error')
        setMessage(result.error.message)
      } else if (creating && !result.data.session) {
        setMessageType('success')
        setMessage('Compte creat correctament. Comprova el correu per confirmar-lo i després entra.')
      } else {
        setMessage('')
      }
    } catch (cause) {
      setMessageType('error')
      setMessage(cause instanceof Error ? cause.message : 'No s’ha pogut connectar. Comprova la connexió i torna-ho a provar.')
    } finally {
      setWorking(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-brand">
        <BrandMark />
        <BrandName />
      </div>
      <div className="auth-panel">
        <span className="eyebrow">EL TEU ESPAI DE CONCERTS</span>
        <h1>
          Tot el concert,
          <br />
          <em>al mateix lloc.</em>
        </h1>
        <p>Les dades, els horaris i el que queda pendent. Sense perdre el fil.</p>
        <button type="button" className="button auth-google" disabled={working} onClick={() => void signInWithGoogle()}>
          <svg width="19" height="19" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M21.35 12.2c0-.66-.06-1.3-.17-1.92H12v3.64h5.25a4.5 4.5 0 0 1-1.95 2.95v2.45h3.16c1.85-1.7 2.89-4.2 2.89-7.12Z" />
            <path fill="#34A853" d="M12 21.5c2.65 0 4.88-.87 6.5-2.36l-3.16-2.45c-.88.59-2 .94-3.34.94a6.01 6.01 0 0 1-5.65-4.17H3.1v2.52A9.5 9.5 0 0 0 12 21.5Z" />
            <path fill="#FBBC05" d="M6.35 13.46a5.73 5.73 0 0 1 0-3.65V7.29H3.1a9.5 9.5 0 0 0 0 8.69l3.25-2.52Z" />
            <path fill="#EA4335" d="M12 5.64c1.44 0 2.73.49 3.75 1.48l2.82-2.82A9.08 9.08 0 0 0 12 2.5a9.5 9.5 0 0 0-8.9 5.79l3.25 2.52A6.01 6.01 0 0 1 12 5.64Z" />
          </svg>
          Continua amb Google
        </button>
        <div className="auth-divider"><span>o amb correu</span></div>
        <form onSubmit={submit} className="auth-form">
          <label className="field">
            Correu electrònic <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="field">
            Contrasenya <input type="password" required minLength={6} autoComplete={creating ? 'new-password' : 'current-password'} aria-describedby={creating ? 'password-help' : undefined} value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {creating ? (
            <>
              <small id="password-help" className="auth-field-help">Com a mínim 6 caràcters.</small>
              <label className="field">
                Repeteix la contrasenya <input type="password" required minLength={6} autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
              </label>
            </>
          ) : null}
          {message ? (
            <p role={messageType === 'error' ? 'alert' : 'status'} className={`auth-message ${messageType === 'success' ? 'success' : ''}`}>
              {message}
            </p>
          ) : null}
          <button type="submit" className="button button-primary" disabled={working}>
            {working ? 'Un moment…' : creating ? 'Crear espai' : 'Entrar'} <ArrowRight size={17} />
          </button>
        </form>
        <button
          className="text-button auth-switch"
          type="button"
          onClick={() => {
            setCreating(!creating)
            setPassword('')
            setConfirmPassword('')
            setMessage('')
            setMessageType('error')
          }}
        >
          {creating ? 'Ja tens un compte? Entra' : 'Primera vegada? Crea un espai'}
        </button>
      </div>
      <p className="auth-foot">Pensat per a bandes que no volen deixar cap detall enrere.</p>
    </div>
  )
}

function OnboardingScreen({ initialName, onComplete, onSignOut }: { initialName: string; onComplete: (name: string) => void; onSignOut: () => void }) {
  const [name, setName] = useState(initialName === 'La nostra banda' ? '' : initialName)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    try {
      onComplete(await completeBandOnboarding(name))
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'No s’ha pogut preparar l’espai. Torna-ho a provar.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-page onboarding-page">
      <div className="auth-brand">
        <BrandMark />
        <BrandName />
      </div>
      <div className="auth-panel onboarding-panel">
        <span className="eyebrow">PRIMER PAS</span>
        <h1>
          Com es diu el teu
          <br />
          <em>projecte musical?</em>
        </h1>
        <p>Farem servir aquest nom a l’espai de treball, els cartells i els enllaços d’escolta. El podràs canviar més endavant.</p>
        <form className="auth-form" onSubmit={(event) => void submit(event)}>
          <label className="field">
            Nom de la banda o artista
            <input autoFocus required maxLength={80} autoComplete="organization" value={name} onChange={(event) => setName(event.target.value)} placeholder="Per exemple, Mishima" />
          </label>
          {message ? <p className="auth-message" role="alert">{message}</p> : null}
          <button type="submit" className="button button-primary" disabled={busy || !name.trim()}>
            {busy ? 'Preparant l’espai…' : 'Entrar a Escena'} <ArrowRight size={17} />
          </button>
        </form>
        <button type="button" className="text-button auth-switch" disabled={busy} onClick={onSignOut}>Entrar amb un altre compte</button>
      </div>
      <p className="auth-foot">Aquest nom identifica el teu espai; no és un perfil públic.</p>
    </div>
  )
}

function concertPlace(concert: { venue: string; city: string; country: string }): string {
  return [concert.venue, concert.city, concert.country].filter(Boolean).join(' · ')
}

function ConcertCard({ concert, onOpen }: { concert: Concert; onOpen: () => void }) {
  const pending = getPending(concert)
  const [year, month, day] = concert.date.split('-')
  const monthLabel = concert.date ? new Intl.DateTimeFormat('ca-ES', { month: 'short' }).format(new Date(Number(year), Number(month) - 1, Number(day))).replace('.', '') : ''
  return (
    <button type="button" className="concert-card" onClick={onOpen}>
      <div className="date-stamp">
        <strong>{day || '–'}</strong>
        <span>{monthLabel}</span>
      </div>
      <div className="concert-card-info">
        <div className="card-topline">
          <span className={`status status-${concert.status}`}>{statusLabels[concert.status]}</span>
          {pending.length ? (
            <span className="pending-count">
              <span className="small-dot" />
              {pending.length} {pending.length === 1 ? 'pendent' : 'pendents'}
            </span>
          ) : null}
        </div>
        <h3>{concert.title}</h3>
        <p>
          <MapPin size={14} />
          <span>{concertPlace(concert) || 'Ubicació per concretar'}</span>
        </p>
      </div>
      <ArrowRight size={19} className="card-arrow" />
    </button>
  )
}

function CalendarView({ concerts, onOpen, onCreate, month, setMonth }: { concerts: Concert[]; onOpen: (id: string) => void; onCreate: (date: string) => void; month: Date; setMonth: (date: Date) => void }) {
  const year = month.getFullYear()
  const monthIndex = month.getMonth()
  const days = new Date(year, monthIndex + 1, 0).getDate()
  const offset = (new Date(year, monthIndex, 1).getDay() + 6) % 7
  const cells = Array.from({ length: Math.ceil((offset + days) / 7) * 7 }, (_, index) => index - offset + 1)
  const today = new Date()
  const monthName = new Intl.DateTimeFormat('ca-ES', {
    month: 'long',
    year: 'numeric',
  }).format(month)
  const monthlyConcerts = concerts
    .filter((item) => {
      const [eventYear, eventMonth] = item.date.split('-').map(Number)
      return eventYear === year && eventMonth === monthIndex + 1
    })
    .sort((a, b) => a.date.localeCompare(b.date))
  return (
    <div className="calendar-panel">
      <div className="calendar-head">
        <h2>{monthName}</h2>
        <div className="calendar-controls">
          <button type="button" className="icon-button" aria-label="Mes anterior" onClick={() => setMonth(new Date(year, monthIndex - 1, 1))}>
            <ChevronLeft size={20} />
          </button>
          <button type="button" className="today-button" onClick={() => setMonth(new Date(today.getFullYear(), today.getMonth(), 1))}>
            Avui
          </button>
          <button type="button" className="icon-button" aria-label="Mes següent" onClick={() => setMonth(new Date(year, monthIndex + 1, 1))}>
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
      <div className="calendar-grid">
        {['Dl', 'Dt', 'Dc', 'Dj', 'Dv', 'Ds', 'Dg'].map((day) => (
          <div className="weekday" key={day}>
            {day}
          </div>
        ))}
        {cells.map((day, index) => {
          const validDay = day >= 1 && day <= days
          const date = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const events = validDay ? concerts.filter((item) => item.date === date) : []
          const isToday = validDay && day === today.getDate() && year === today.getFullYear() && monthIndex === today.getMonth()
          return (
            <div
              className={`calendar-day ${!validDay ? 'calendar-day-outside' : 'calendar-day-actionable'}`}
              key={index}
              onClick={(event) => {
                if (validDay && !(event.target as HTMLElement).closest('button')) onCreate(date)
              }}
            >
              {validDay ? (
                <>
                  <span className={`calendar-number ${isToday ? 'calendar-today' : ''}`}>{day}</span>
                  <button type="button" className="calendar-add-button" aria-label={`Afegir concert el ${formatDate(date)}`} title="Afegir concert aquest dia" onClick={() => onCreate(date)}>
                    <Plus size={14} />
                  </button>
                  {events.map((item) => (
                    <button type="button" key={item.id} className="calendar-event" onClick={() => onOpen(item.id)} title={item.title}>
                      {item.title}
                    </button>
                  ))}
                </>
              ) : null}
            </div>
          )
        })}
      </div>
      <div className="calendar-agenda">
        <span className="eyebrow">CONCERTS DEL MES</span>
        {monthlyConcerts.length ? (
          monthlyConcerts.map((item) => (
            <button key={item.id} type="button" onClick={() => onOpen(item.id)}>
              <span>{formatDate(item.date, { day: 'numeric', month: 'short' })}</span>
              <strong>{item.title}</strong>
              <ArrowRight size={16} />
            </button>
          ))
        ) : (
          <p>Encara no hi ha concerts aquest mes.</p>
        )}
      </div>
    </div>
  )
}

function groupConcertsByYear(concerts: Concert[], newestFirst: boolean) {
  const groups = new Map<string, Concert[]>()
  for (const concert of concerts) {
    const year = concert.date.slice(0, 4) || 'sense-data'
    groups.set(year, [...(groups.get(year) || []), concert])
  }
  return Array.from(groups.entries()).sort(([a], [b]) => {
    if (a === 'sense-data') return 1
    if (b === 'sense-data') return -1
    return newestFirst ? b.localeCompare(a) : a.localeCompare(b)
  })
}

function ConcertYearGroup({ year, concerts, onOpen, collapsible = false }: { year: string; concerts: Concert[]; onOpen: (id: string) => void; collapsible?: boolean }) {
  const label = year === 'sense-data' ? 'Sense data' : year
  const cards = concerts.map((concert) => <ConcertCard key={concert.id} concert={concert} onOpen={() => onOpen(concert.id)} />)
  if (collapsible)
    return (
      <details className="concert-year-archive">
        <summary>
          <strong>{label}</strong>
          <span>
            {concerts.length} {concerts.length === 1 ? 'concert' : 'concerts'}
          </span>
          <ArrowRight size={15} />
        </summary>
        <div className="concert-year-cards">{cards}</div>
      </details>
    )
  return (
    <section className="concert-year-section">
      <div className="concert-year-heading">
        <strong>{label}</strong>
        <span>
          {concerts.length} {concerts.length === 1 ? 'concert' : 'concerts'}
        </span>
      </div>
      <div className="concert-year-cards">{cards}</div>
    </section>
  )
}

function HomeView({ concerts, onOpen, onNewConcert, onGoToConcerts, onGoToCalendar }: { concerts: Concert[]; onOpen: (id: string) => void; onNewConcert: () => void; onGoToConcerts: () => void; onGoToCalendar: () => void }) {
  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const upcoming = concerts.filter((item) => item.date >= today && item.status !== 'cancel·lat').sort((a, b) => a.date.localeCompare(b.date))
  const next = upcoming[0]
  const pending = concerts.flatMap((concert) => getPending(concert).map((task) => ({ concert, task }))).sort((a, b) => a.concert.date.localeCompare(b.concert.date))
  const soon = upcoming.slice(0, 4)
  const monthConcerts = upcoming.filter((item) => item.date.slice(0, 7) === today.slice(0, 7)).length

  return (
    <div className="home-dashboard">
      <div className="page-heading home-heading">
        <div>
          <span className="eyebrow">PANORÀMICA DE LA BANDA</span>
          <h1>
            La banda, al dia<span className="heading-period">.</span>
          </h1>
          <p>El que ve ara i el que cal tenir present.</p>
        </div>
        <button type="button" className="button button-primary" onClick={onNewConcert}>
          <Plus size={17} /> Nou concert
        </button>
      </div>
      {next ? (
        <section className="home-next-gig">
          <div className="home-next-date">
            <span>{formatDate(next.date, { weekday: 'short' }).replace('.', '').toUpperCase()}</span>
            <strong>{next.date.slice(8, 10)}</strong>
            <small>{formatDate(next.date, { month: 'short' }).replace('.', '').toUpperCase()}</small>
          </div>
          <div className="home-next-info">
            <span className="eyebrow">
              PROPER CONCERT <i /> {statusLabels[next.status].toUpperCase()}
            </span>
            <h2>{next.title}</h2>
            <p>
              <MapPin size={15} /> {concertPlace(next) || 'Ubicació per concretar'}
            </p>
          </div>
          <button type="button" className="button button-light" onClick={() => onOpen(next.id)}>
            Obrir fitxa <ArrowRight size={16} />
          </button>
        </section>
      ) : (
        <section className="home-next-gig home-next-empty">
          <div className="home-next-date">
            <Music2 size={23} />
          </div>
          <div className="home-next-info">
            <span className="eyebrow">PROPER CONCERT</span>
            <h2>Encara no hi ha cap data</h2>
            <p>Afegeix un concert per començar a preparar la temporada.</p>
          </div>
          <button type="button" className="button button-light" onClick={onNewConcert}>
            <Plus size={16} /> Crear concert
          </button>
        </section>
      )}
      <div className="home-stats">
        <button type="button" onClick={onGoToConcerts}>
          <span className="home-stat-icon">
            <CalendarDays size={17} />
          </span>
          <span>
            <small>PROPERS CONCERTS</small>
            <strong>{upcoming.length}</strong>
          </span>
        </button>
        <button type="button" onClick={onGoToCalendar}>
          <span className="home-stat-icon">
            <CalendarDays size={17} />
          </span>
          <span>
            <small>ENCARA AQUEST MES</small>
            <strong>{monthConcerts}</strong>
          </span>
        </button>
        <div>
          <span className="home-stat-icon home-pending-icon">
            <CircleHelp size={17} />
          </span>
          <span>
            <small>PER RESOLDRE</small>
            <strong>{pending.length}</strong>
          </span>
        </div>
      </div>
      <div className="home-columns">
        <section className="home-panel home-pending-panel">
          <div className="home-panel-heading">
            <div>
              <span className="eyebrow">SEGUIMENT DE LES FITXES</span>
              <h2>Punts per resoldre</h2>
            </div>
            <span className="home-panel-count">{pending.length}</span>
          </div>
          {pending.length ? (
            <div className="home-pending-list">
              {pending.slice(0, 5).map(({ concert, task }, index) => (
                <button type="button" key={`${concert.id}-${task}-${index}`} onClick={() => onOpen(concert.id)}>
                  <span className="home-pending-dot" />
                  <span className="home-pending-copy">
                    <strong>{task}</strong>
                    <small>
                      {concert.title} ·{' '}
                      {formatDate(concert.date, {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </small>
                  </span>
                  <ArrowRight size={16} />
                </button>
              ))}
            </div>
          ) : (
            <div className="home-all-clear">
              <Check size={19} />
              <div>
                <strong>Tot al dia</strong>
                <p>No hi ha compromisos pendents segons les dades de les fitxes.</p>
              </div>
            </div>
          )}
          {pending.length > 5 ? (
            <button className="text-button home-more-pending" type="button" onClick={onGoToConcerts}>
              Veure tots els concerts amb pendents <ArrowRight size={14} />
            </button>
          ) : null}
        </section>
        <section className="home-panel home-upcoming-panel">
          <div className="home-panel-heading">
            <div>
              <span className="eyebrow">A L’AGENDA</span>
              <h2>Els següents</h2>
            </div>
            <button type="button" className="text-button" onClick={onGoToConcerts}>
              Tots <ArrowRight size={14} />
            </button>
          </div>
          {soon.length ? (
            <div className="home-upcoming-list">
              {soon.map((concert) => (
                <button type="button" key={concert.id} onClick={() => onOpen(concert.id)}>
                  <span className="home-upcoming-date">
                    <strong>{concert.date.slice(8, 10)}</strong>
                    <small>{formatDate(concert.date, { month: 'short' }).replace('.', '')}</small>
                  </span>
                  <span className="home-upcoming-copy">
                    <strong>{concert.title}</strong>
                    <small>{concertPlace(concert) || 'Ubicació per concretar'}</small>
                  </span>
                  <ArrowRight size={15} />
                </button>
              ))}
            </div>
          ) : (
            <p className="home-empty-note">Quan afegeixis concerts, els veuràs aquí.</p>
          )}
        </section>
      </div>
    </div>
  )
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="info-row">
      <span>{label}</span>
      <strong>{children || '—'}</strong>
    </div>
  )
}

function StageSetlist({ title, songs, onClose }: { title: string; songs: string[]; onClose: () => void }) {
  useDialogFocus(true, '.stage-setlist')
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  return (
    <div tabIndex={-1} className="stage-setlist" role="dialog" aria-modal="true" aria-label={`Setlist de ${title}`}>
      <header className="stage-setlist-header">
        <div>
          <span className="eyebrow">MODE ESCENARI</span>
          <p>{songs.length} cançons · Llista completa · Esc per sortir</p>
        </div>
        <button type="button" className="stage-close" onClick={onClose}>
          <X size={20} /> Tancar
        </button>
      </header>
      <div className="stage-setlist-body">
        <div className="stage-paper stage-paper-list" aria-label="Setlist complet">
          {songs.map((song, index) => (
            <div className="stage-list-song" key={`${song}-${index}`}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <p>{song}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ConcertDayView({ concert, onClose, onMaterial, onSetlist }: { concert: Concert; onClose: () => void; onMaterial: () => void; onSetlist: () => void }) {
  useDialogFocus(true, '.concert-day-view')
  useEffect(() => {
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', closeWithEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeWithEscape)
    }
  }, [onClose])
  const details = concert.details
  const schedule = [...details.schedule].filter((item) => item.time || item.label || item.place).sort((a, b) => a.time.localeCompare(b.time))
  const songs = details.setlist
    .split('\n')
    .map((song) => song.trim())
    .filter(Boolean)
  const place = [concert.venue, concert.city, concert.country].filter(Boolean).join(' · ')

  return (
    <div className="concert-day-overlay">
      <section className="concert-day-view" role="dialog" aria-modal="true" aria-label={`Informació del dia del concert ${concert.title}`}>
        <header className="concert-day-header">
          <div>
            <span className="eyebrow">A MÀ EL DIA DEL CONCERT</span>
            <h2>{concert.title}</h2>
            <p>
              {formatDate(concert.date, {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          </div>
          <button type="button" className="icon-button" aria-label="Tancar vista del dia" onClick={onClose}>
            <X size={21} />
          </button>
        </header>
        <div className="concert-day-content">
          <section className="concert-day-location">
            <MapPinned size={20} />
            <div>
              <strong>{place || 'Ubicació per concretar'}</strong>
              {concert.address ? (
                <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(concert.address)}`} target="_blank" rel="noreferrer">
                  {concert.address} · Obrir mapa <ExternalLink size={13} />
                </a>
              ) : (
                <small>Encara no hi ha adreça del concert.</small>
              )}
            </div>
          </section>
          {details.contactName || details.contactPhone || details.contactEmail ? (
            <section className="concert-day-contact">
              <span className="eyebrow">CONTACTE</span>
              <strong>{details.contactName || 'Organització'}</strong>
              <div>
                {details.contactPhone ? (
                  <a href={`tel:${details.contactPhone}`}>
                    <Phone size={15} />
                    {details.contactPhone}
                  </a>
                ) : null}
                {details.contactEmail ? (
                  <a href={`mailto:${details.contactEmail}`}>
                    <Mail size={15} />
                    {details.contactEmail}
                  </a>
                ) : null}
              </div>
            </section>
          ) : null}
          <section className="concert-day-section">
            <div className="concert-day-section-heading">
              <Clock3 size={17} />
              <h3>Horaris</h3>
            </div>
            {schedule.length ? (
              <ol className="concert-day-schedule">
                {schedule.map((item) => (
                  <li key={item.id}>
                    <time>{item.time || '—'}</time>
                    <div>
                      <strong>{item.label || item.kind || 'Horari'}</strong>
                      {item.place ? <small>{item.place}</small> : null}
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="section-empty">Encara no hi ha horaris afegits.</p>
            )}
          </section>
          <section className="concert-day-section">
            <div className="concert-day-section-heading">
              <ListMusic size={17} />
              <h3>Setlist · {songs.length} cançons</h3>
              {songs.length ? (
                <button type="button" className="text-button" onClick={onSetlist}>
                  Mode escenari <ArrowRight size={14} />
                </button>
              ) : null}
            </div>
            {songs.length ? (
              <ol className="concert-day-songs">
                {songs.map((song, index) => (
                  <li key={`${song}-${index}`}>
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    {song}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="section-empty">Encara no hi ha setlist.</p>
            )}
          </section>
          <section className="concert-day-material">
            <div>
              <PackageCheck size={19} />
              <div>
                <strong>Material</strong>
                <small>
                  {details.materials.filter((item) => item.loaded).length} de {details.materials.length} carregat
                </small>
              </div>
            </div>
            <button type="button" className="button button-primary" onClick={onMaterial}>
              Obrir checklist
            </button>
          </section>
        </div>
      </section>
    </div>
  )
}

function Detail({ concert, labelAgreement, onBack, onEdit, onDelete, onToggle, onUpload, onRemoveFile }: { concert: Concert; labelAgreement: LabelAgreement | null; onBack: () => void; onEdit: () => void; onDelete: () => void; onToggle: (id: string) => Promise<void>; onUpload: (id: string, file: File) => Promise<void>; onRemoveFile: (id: string) => Promise<void> }) {
  const [busyMaterial, setBusyMaterial] = useState(false)
  const [materialError, setMaterialError] = useState('')
  const [busyDocument, setBusyDocument] = useState<string | null>(null)
  const [documentError, setDocumentError] = useState('')
  const [documentLinks, setDocumentLinks] = useState<Record<string, string>>({})
  const [people, setPeople] = useState<BandPerson[]>([])
  const [merchProducts, setMerchProducts] = useState<MerchProduct[]>([])
  const [merchSales, setMerchSales] = useState<MerchSale[]>([])
  const [moneyMovements, setMoneyMovements] = useState<MoneyMovement[]>([])
  const [savingProductId, setSavingProductId] = useState<string | null>(null)
  const [undoingSaleIds, setUndoingSaleIds] = useState<string[]>([])
  const [saleError, setSaleError] = useState('')
  const [merchSearch, setMerchSearch] = useState('')
  const [merchSaleOpen, setMerchSaleOpen] = useState(false)
  const [salePaymentMethod, setSalePaymentMethod] = useState<'card' | 'cash'>('card')
  const [materialOpen, setMaterialOpen] = useState(false)
  const [dayViewOpen, setDayViewOpen] = useState(false)
  const [stageSetlistOpen, setStageSetlistOpen] = useState(false)
  useDialogFocus(materialOpen, '.material-window')
  useDialogFocus(merchSaleOpen, '.merch-sale-window')
  const d = concert.details
  const settlement = concertSettlement(concert, labelAgreement)
  useEffect(() => {
    let active = true
    const files = concert.details.documents.filter((doc) => doc.storagePath)
    void Promise.all(
      files.map(async (doc) => {
        try {
          return [doc.id, await signedDocumentUrl(doc.storagePath!)] as const
        } catch {
          return [doc.id, ''] as const
        }
      }),
    ).then((entries) => {
      if (active) setDocumentLinks(Object.fromEntries(entries))
    })
    return () => {
      active = false
    }
  }, [concert.details.documents])
  useEffect(() => {
    let active = true
    const load = () => {
      void Promise.all([listResource<BandPerson>('band_people'), listMerchProducts(), listMerchSales(), listMoneyMovements()])
        .then(([items, products, sales, movements]) => {
          if (active) {
            setPeople(items)
            setMerchProducts(products)
            setMerchSales(sales)
            setMoneyMovements(movements)
          }
        })
        .catch((cause) => {
          if (active) setSaleError(cause instanceof Error ? cause.message : 'No s’han pogut carregar les dades del concert.')
        })
    }
    load()
    window.addEventListener('escena:offline-queue-change', load)
    return () => {
      active = false
      window.removeEventListener('escena:offline-queue-change', load)
    }
  }, [concert.id])
  useEffect(() => {
    if (!merchSaleOpen) return
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMerchSaleOpen(false)
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', closeWithEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeWithEscape)
    }
  }, [merchSaleOpen])
  useEffect(() => {
    if (!materialOpen) return
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMaterialOpen(false)
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', closeWithEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeWithEscape)
    }
  }, [materialOpen])
  const concertSales = merchSales.filter((item) => item.concertId === concert.id)
  const concertMoney = moneyMovements.filter((item) => item.concertId === concert.id)
  const concertExpenseMovements = concertMoney.filter((item) => item.kind === 'despesa' && !item.sourceType)
  const pending = getPending(concert)
  const sortedSchedule = [...d.schedule].filter((x) => x.time || x.label).sort((a, b) => a.time.localeCompare(b.time))
  const closing = concertClosingSummary(concert, labelAgreement, merchSales, moneyMovements)
  const concertMerchRevenue = concertSales.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
  const visibleMerchProducts = merchProducts.filter((product) => product.active && `${product.name} ${(product.sizes || []).map((size) => size.name).join(' ')}`.toLocaleLowerCase('ca').includes(merchSearch.toLocaleLowerCase('ca')))
  const soldForConcert = (productId: string, size?: string) => concertSales.filter((item) => item.productId === productId && (size ? item.size === size : !item.size)).reduce((sum, item) => sum + item.quantity, 0)
  const stockRemaining = (product: MerchProduct, size?: string) => {
    const stock = size ? product.sizes?.find((item) => item.name === size)?.stock || 0 : product.stock
    const sold = merchSales.filter((item) => item.productId === product.id && (size ? item.size === size : !item.size)).reduce((sum, item) => sum + item.quantity, 0)
    return Math.max(stock - sold, 0)
  }
  async function toggleMaterial(id: string) {
    setBusyMaterial(true)
    setMaterialError('')
    try {
      await onToggle(id)
    } catch (cause) {
      setMaterialError(cause instanceof Error ? cause.message : 'No s’ha pogut desar el canvi.')
    } finally {
      setBusyMaterial(false)
    }
  }
  async function upload(id: string, file?: File) {
    if (!file) return
    setBusyDocument(id)
    setDocumentError('')
    try {
      await onUpload(id, file)
    } catch (cause) {
      setDocumentError(cause instanceof Error ? cause.message : 'No s’ha pogut pujar el fitxer.')
    } finally {
      setBusyDocument(null)
    }
  }
  async function removeFile(id: string) {
    setBusyDocument(id)
    setDocumentError('')
    try {
      await onRemoveFile(id)
    } catch (cause) {
      setDocumentError(cause instanceof Error ? cause.message : 'No s’ha pogut treure el fitxer.')
    } finally {
      setBusyDocument(null)
    }
  }
  async function quickSale(product: MerchProduct, size?: string) {
    const sold = merchSales.filter((item) => item.productId === product.id && (size ? item.size === size : !item.size)).reduce((sum, item) => sum + item.quantity, 0)
    const available = size ? (product.sizes?.find((item) => item.name === size)?.stock ?? 0) : product.stock
    if (sold >= available) {
      setSaleError(`No queda estoc de ${product.name}${size ? ` talla ${size}` : ''}.`)
      return
    }
    const savingKey = `${product.id}:${size || ''}`
    setSavingProductId(savingKey)
    setSaleError('')
    try {
      const saved = await saveMerchSale({
        id: createId(),
        concertId: concert.id,
        productId: product.id,
        quantity: 1,
        unitPrice: product.price,
        note: '',
        size,
        paymentMethod: salePaymentMethod,
      })
      setMerchSales((items) => [saved, ...items])
    } catch (cause) {
      setSaleError(cause instanceof Error ? cause.message.replace('No hi ha prou estoc disponible', `No queda prou estoc de ${product.name}${size ? ` talla ${size}` : ''}`).replace('Producte de marxandatge no trobat', 'No s’ha trobat el producte.') : 'No s’ha pogut registrar la venda.')
    } finally {
      setSavingProductId((id) => (id === savingKey ? null : id))
    }
  }
  async function undoSale(sale: MerchSale) {
    setUndoingSaleIds((ids) => [...ids, sale.id])
    setSaleError('')
    try {
      await deleteMerchSale(sale.id)
      setMerchSales((items) => items.filter((item) => item.id !== sale.id))
    } catch (cause) {
      setSaleError(cause instanceof Error ? cause.message : 'No s’ha pogut desfer la venda.')
    } finally {
      setUndoingSaleIds((ids) => ids.filter((id) => id !== sale.id))
    }
  }

  return (
    <>
      {dayViewOpen ? (
        <ConcertDayView
          concert={concert}
          onClose={() => setDayViewOpen(false)}
          onMaterial={() => {
            setDayViewOpen(false)
            setMaterialOpen(true)
          }}
          onSetlist={() => {
            setDayViewOpen(false)
            setStageSetlistOpen(true)
          }}
        />
      ) : null}
      <div className="detail-shell">
        <button className="text-button back-button" onClick={onBack}>
          <ArrowLeft size={17} /> Tornar als concerts
        </button>
        <div className="detail-hero">
          <div className="detail-hero-main">
            <span className="eyebrow">
              FITXA DE CONCERT <span className="eyebrow-separator">/</span> {statusLabels[concert.status].toUpperCase()}
            </span>
            <h1>{concert.title}</h1>
            <div className="hero-meta">
              <span>
                <CalendarDays size={17} />
                {formatDate(concert.date)}
              </span>
              <span>
                <MapPin size={17} />
                {concertPlace(concert) || 'Ubicació per concretar'}
              </span>
            </div>
          </div>
          <div className="hero-action">
            <button type="button" className="button button-light day-view-trigger" onClick={() => setDayViewOpen(true)}>
              <CalendarDays size={16} /> Dia del concert
            </button>
            <button className="button button-light" onClick={onEdit}>
              <Pencil size={16} /> Editar fitxa
            </button>
          </div>
        </div>
        <nav className="concert-quick-actions" aria-label="Accions del concert">
          <span className="concert-quick-actions-label">ACCIONS DEL CONCERT</span>
          <button type="button" onClick={() => setMaterialOpen(true)}>
            <span className="concert-quick-action-icon">
              <PackageCheck size={17} />
            </span>
            <span>
              <strong>Material</strong>
              <small>
                {d.materials.filter((item) => item.loaded).length}/{d.materials.length} carregat
              </small>
            </span>
            <ArrowRight size={15} />
          </button>
          <button
            type="button"
            onClick={() => {
              setSaleError('')
              setMerchSaleOpen(true)
            }}
          >
            <span className="concert-quick-action-icon">
              <ShoppingBag size={17} />
            </span>
            <span>
              <strong>Marxandatge</strong>
              <small>
                {concertSales.reduce((sum, item) => sum + item.quantity, 0)} unitats · {formatMoney(concertMerchRevenue)}
              </small>
            </span>
            <ArrowRight size={15} />
          </button>
          <button type="button" disabled={!d.setlist} onClick={() => setStageSetlistOpen(true)}>
            <span className="concert-quick-action-icon">
              <ListMusic size={17} />
            </span>
            <span>
              <strong>Setlist</strong>
              <small>{d.setlist ? `${d.setlist.split('\n').filter(Boolean).length} cançons` : 'No carregat'}</small>
            </span>
            <ArrowRight size={15} />
          </button>
        </nav>
        <div className="detail-body">
          <div className="detail-main">
            <section className="pending-panel">
              <div className="panel-title">
                <div className="panel-title-icon">
                  <CircleHelp size={19} />
                </div>
                <div>
                  <span className="eyebrow">SEGUIMENT</span>
                  <h2>
                    Coses pendents <span className="count-pill">{pending.length}</span>
                  </h2>
                </div>
              </div>
              {pending.length ? (
                <ul className="pending-list">
                  {pending.map((item, index) => (
                    <li key={`${item}-${index}`}>
                      <span className="pending-marker" />
                      {item}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="empty-pending">
                  <Check size={18} /> No hi ha res pendent segons les dades d'aquesta fitxa.
                </p>
              )}
            </section>

            <section className="detail-section">
              <div className="detail-section-heading">
                <Wallet size={19} />
                <h2>Acord</h2>
              </div>
              <div className="info-rows">
                <InfoRow label="Gestionat per">{d.management === 'discografica' ? d.labelAgreement?.name || 'Discogràfica sense condicions' : d.management === 'banda' ? 'La banda' : 'Per concretar'}</InfoRow>
                <InfoRow label="Catxet acordat (brut)">{formatMoney(concert.feeAmount)}</InfoRow>
                <InfoRow label="Catxet final (brut)">{d.finalFee === undefined ? 'Sense canvi concretat; es fa servir l’acordat' : formatMoney(d.finalFee)}</InfoRow>
                <InfoRow label="Catxet cobrat (brut)">{formatMoney(concert.feePaid)}</InfoRow>
                {settlement.unresolved ? (
                  <p className="label-concert-note">Indica qui ha gestionat el concert per calcular el net de la banda.</p>
                ) : (
                  <>
                    <InfoRow label="Comissió prevista">{formatMoney(settlement.projectedCommission)}</InfoRow>
                    <InfoRow label="Previsió inicial">{formatMoney(settlement.initialNet)}</InfoRow>
                    <InfoRow label="Honoraris de l’equip">{formatMoney(settlement.teamTotal)}</InfoRow>
                    <InfoRow label="Net previst">{settlement.teamUnresolved ? 'Honoraris per concretar' : formatMoney(settlement.projectedNet)}</InfoRow>
                    <InfoRow label="Comissió sobre el cobrat">
                      {formatMoney(settlement.paidCommission)}
                      {d.management === 'discografica' ? ` (${settlement.paidRate} %)` : ''}
                    </InfoRow>
                    <InfoRow label="Net cobrat per la banda">{formatMoney(settlement.netPaid)}</InfoRow>
                  </>
                )}
                {d.conditions ? <InfoRow label="Condicions">{d.conditions}</InfoRow> : null}
                {d.cancellation ? <InfoRow label="Cancel·lació">{d.cancellation}</InfoRow> : null}
                <TeamFeesSummary concert={concert} />
              </div>
            </section>

            <section className="detail-section">
              <div className="detail-section-heading">
                <Clock3 size={19} />
                <h2>Horaris i logística</h2>
              </div>
              {sortedSchedule.length ? (
                <div className="timeline">
                  {sortedSchedule.map((item) => (
                    <div className="timeline-item" key={item.id}>
                      <span className="timeline-time">{item.time || '—'}</span>
                      <span className="timeline-line" />
                      <div>
                        <strong>{item.label || item.kind || 'Sense nom'}</strong>
                        {item.place ? <p>{item.place}</p> : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="section-empty">Encara no hi ha horaris afegits.</p>
              )}
              {d.travel || d.loadIn || d.parking ? (
                <div className="info-rows subsection-rows">
                  {d.travel ? <InfoRow label="Desplaçament">{d.travel}</InfoRow> : null}
                  {d.loadIn ? <InfoRow label="Accés de càrrega">{d.loadIn}</InfoRow> : null}
                  {d.parking ? <InfoRow label="Aparcament">{d.parking}</InfoRow> : null}
                </div>
              ) : null}
            </section>

            <section className="detail-section">
              <div className="detail-section-heading">
                <FileText size={19} />
                <h2>Documents</h2>
              </div>
              {d.documents.length ? (
                <div className="document-list">
                  {d.documents.map((doc) => (
                    <div className="document-item" key={doc.id}>
                      <span className="document-icon">
                        <FileText size={17} />
                      </span>
                      <div>
                        <strong>{doc.name || 'Document sense nom'}</strong>
                        <small>
                          {doc.direction === 'enviar' ? 'Per enviar' : 'Per rebre'} · {doc.status === 'pendent' ? 'Pendent' : doc.status === 'no_cal' ? 'No cal' : doc.direction === 'enviar' ? 'Enviat' : 'Rebut'}
                        </small>
                        {doc.storagePath ? (
                          <div className="document-file">
                            <Paperclip size={13} />
                            {documentLinks[doc.id] ? (
                              <a href={documentLinks[doc.id]} target="_blank" rel="noreferrer">
                                {doc.fileName || 'Obrir fitxer adjunt'}
                              </a>
                            ) : documentLinks[doc.id] === '' ? (
                              <span>No s'ha pogut obrir el fitxer.</span>
                            ) : (
                              <span>{doc.fileName || 'Fitxer adjunt'} · preparant enllaç…</span>
                            )}
                            {cloudConfigured ? (
                              <button type="button" disabled={busyDocument !== null} onClick={() => void removeFile(doc.id)}>
                                Treure
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                        {cloudConfigured ? (
                          <label className="document-upload">
                            {busyDocument === doc.id ? 'Pujant fitxer…' : doc.storagePath ? 'Substituir fitxer' : 'Adjuntar fitxer'}
                            <input
                              type="file"
                              disabled={busyDocument !== null}
                              onChange={(e) => {
                                const file = e.target.files?.[0]
                                void upload(doc.id, file)
                                e.target.value = ''
                              }}
                            />
                          </label>
                        ) : null}
                      </div>
                      {safeLink(doc.url) ? (
                        <a href={safeLink(doc.url)!} target="_blank" rel="noreferrer" aria-label={`Obrir enllaç de ${doc.name}`}>
                          <ExternalLink size={16} />
                        </a>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="section-empty">Encara no hi ha documents registrats. Afegeix-los editant la fitxa.</p>
              )}
              {documentError ? (
                <p className="form-error" role="alert">
                  {documentError}
                </p>
              ) : null}
            </section>
          </div>
          <aside className="detail-aside">
            <section className="aside-card">
              <div className="aside-heading">
                <Navigation size={18} />
                <h3>Ubicació</h3>
              </div>
              <strong>{concert.venue || 'Lloc per concretar'}</strong>
              {concert.address ? (
                <a className="address-link" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(concert.address)}`} target="_blank" rel="noreferrer">
                  {concert.address} <ExternalLink size={14} />
                </a>
              ) : (
                <p>Encara no hi ha adreça</p>
              )}
              {concert.city || concert.country ? <p>{[concert.city, concert.country].filter(Boolean).join(', ')}</p> : null}
            </section>
            <section className="aside-card">
              <div className="aside-heading">
                <UsersRound size={18} />
                <h3>Persones</h3>
              </div>
              {d.contactName ? (
                <>
                  <span className="aside-label">CONTACTE RESPONSABLE</span>
                  <strong>{d.contactName}</strong>
                  {d.contactPhone ? (
                    <a href={`tel:${d.contactPhone}`} className="aside-contact">
                      {d.contactPhone}
                    </a>
                  ) : null}
                  {d.contactEmail ? (
                    <a href={`mailto:${d.contactEmail}`} className="aside-contact">
                      {d.contactEmail}
                    </a>
                  ) : null}
                </>
              ) : null}
              {d.personIds.length ? (
                <div className="selected-people">
                  {d.personIds.map((id) => (
                    <span key={id}>{people.find((person) => person.id === id)?.name || 'Persona eliminada'}</span>
                  ))}
                </div>
              ) : null}
              {!d.contactName && !d.personIds.length ? <p>Encara no hi ha contacte.</p> : null}
              {d.team ? (
                <>
                  <span className="aside-label team-label">NOTES D’EQUIP</span>
                  <p>{d.team}</p>
                </>
              ) : null}
            </section>
            <section className="aside-card">
              <div className="aside-heading">
                <Ticket size={18} />
                <h3>Hospitalitat</h3>
              </div>
              <InfoRow label="Sopar">{d.dinner === 'si' ? 'Sí' : d.dinner === 'no' ? 'No' : 'Encara no se sap'}</InfoRow>
              <InfoRow label="Allotjament">{d.lodging === 'si' ? d.lodgingDetails || 'Sí' : d.lodging === 'no' ? 'No cal' : 'Encara no se sap'}</InfoRow>
              {d.lodgingAddress ? (
                <a className="inline-link" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(d.lodgingAddress)}`} target="_blank" rel="noreferrer">
                  {d.lodgingAddress} <ExternalLink size={14} />
                </a>
              ) : null}
            </section>
            <section className="aside-card closing-card">
              <div className="aside-heading">
                <Wallet size={18} />
                <h3>Tancament del concert</h3>
              </div>
              <div className="info-rows">
                <InfoRow label="Catxet net cobrat">{settlement.unresolved ? 'Pendent de classificar' : formatMoney(closing.netFee)}</InfoRow>
                <InfoRow label={closing.usesDetailedSales ? 'Marxandatge venut' : 'Marxandatge (resum antic)'}>{formatMoney(closing.merchRevenue)}</InfoRow>
                <InfoRow label="Altres ingressos reals">{formatMoney(closing.manualIncome)}</InfoRow>
                <InfoRow label="Honoraris pagats per la banda">{formatMoney(closing.teamExpenses)}</InfoRow>
                <InfoRow label="Honoraris descomptats pel gestor">{formatMoney(settlement.managerPaid)} (ja descomptats del catxet net)</InfoRow>
                <InfoRow label={concertExpenseMovements.length ? 'Despeses registrades' : 'Despeses (resum antic)'}>{formatMoney(closing.manualExpenses || closing.legacyExpenses)}</InfoRow>
              </div>
              {closing.usesDetailedSales && d.merchSales > 0 ? <small className="closing-legacy-note">El resum antic de vendes no se suma perquè ja hi ha vendes detallades.</small> : null}
              {concertExpenseMovements.length && d.expenses > 0 ? <small className="closing-legacy-note">El resum antic de despeses no se suma perquè ja hi ha moviments registrats.</small> : null}
              <div className={`concert-closing-balance ${closing.balance < 0 ? 'is-negative' : ''}`}>
                <span>Balanç del concert</span>
                <strong>{formatMoney(closing.balance)}</strong>
              </div>
              {concertMoney.length ? (
                <details className="concert-closing-movements">
                  <summary>Moviments vinculats · {concertMoney.length}</summary>
                  {concertMoney.map((movement) => (
                    <div key={movement.id}>
                      <span>
                        {movement.category || (movement.kind === 'ingres' ? 'Ingrés' : 'Despesa')} · {formatDate(movement.date)}
                      </span>
                      <strong className={movement.kind === 'ingres' ? 'positive-money' : 'negative-money'}>
                        {movement.kind === 'despesa' ? '−' : '+'}
                        {formatMoney(movement.amount)}
                      </strong>
                    </div>
                  ))}
                </details>
              ) : null}
              {settlement.unresolved && concert.feePaid > 0 ? <p className="label-concert-note">El catxet cobrat no entra al balanç fins que indiquis qui ha gestionat el concert.</p> : null}
              {d.notes ? <p className="closing-notes">{d.notes}</p> : null}
            </section>
            <button type="button" className="delete-link" onClick={onDelete}>
              <Trash2 size={15} /> Eliminar concert
            </button>
          </aside>
        </div>
        {materialOpen ? (
          <div className="material-overlay">
            <section className="material-window" role="dialog" aria-modal="true" aria-label={`Material del concert ${concert.title}`}>
              <header className="merch-sale-header">
                <div>
                  <span className="eyebrow">CÀRREGA DEL CONCERT</span>
                  <h2>Material a portar</h2>
                  <p>{concert.title} · Marca cada element quan el carreguis.</p>
                </div>
                <button type="button" className="merch-sale-close" aria-label="Tancar material" onClick={() => setMaterialOpen(false)}>
                  <X size={21} />
                </button>
              </header>
              <div className="material-summary">
                <div>
                  <span>Carregat</span>
                  <strong>{d.materials.filter((item) => item.loaded).length}</strong>
                </div>
                <div>
                  <span>Pendent</span>
                  <strong>{d.materials.filter((item) => !item.loaded).length}</strong>
                </div>
                <div>
                  <span>Total</span>
                  <strong>{d.materials.length}</strong>
                </div>
              </div>
              <div className="material-window-content">
                {d.materials.length ? (
                  Array.from(new Set(d.materials.map((item) => item.category || 'Sense categoria'))).map((category) => (
                    <section className="material-group" key={category}>
                      <span className="eyebrow">{category}</span>
                      <div className="material-list">
                        {d.materials
                          .filter((item) => (item.category || 'Sense categoria') === category)
                          .map((item) => (
                            <button type="button" className={`material-item material-toggle ${item.loaded ? 'is-loaded' : ''}`} aria-pressed={item.loaded} disabled={busyMaterial} key={item.id} onClick={() => void toggleMaterial(item.id)}>
                              <span className="check-visual">
                                <Check size={14} />
                              </span>
                              <strong>{item.name || 'Material sense nom'}</strong>
                              <span className="material-quantity">{item.quantity ?? 1} u.</span>
                            </button>
                          ))}
                      </div>
                    </section>
                  ))
                ) : (
                  <p className="section-empty">Afegeix material a la fitxa per preparar la càrrega.</p>
                )}
                {materialError ? (
                  <p className="form-error" role="alert">
                    {materialError}
                  </p>
                ) : null}
              </div>
            </section>
          </div>
        ) : null}
        {merchSaleOpen ? (
          <div className="merch-sale-overlay">
            <section className="merch-sale-window" role="dialog" aria-modal="true" aria-label={`Venda de marxandatge de ${concert.title}`}>
              <header className="merch-sale-header">
                <div>
                  <span className="eyebrow">VENDA AL CONCERT</span>
                  <h2>Marxandatge</h2>
                  <p>{concert.title} · Tria com cobrareu i toca `+1` per cada unitat.</p>
                </div>
                <button type="button" className="merch-sale-close" aria-label="Tancar venda de marxandatge" onClick={() => setMerchSaleOpen(false)}>
                  <X size={21} />
                </button>
              </header>
              <div className="merch-sale-summary">
                <div>
                  <span>Ingressos</span>
                  <strong>{formatMoney(concertMerchRevenue)}</strong>
                </div>
                <div>
                  <span>Unitats</span>
                  <strong>{concertSales.reduce((sum, item) => sum + item.quantity, 0)}</strong>
                </div>
                <div>
                  <span>Productes</span>
                  <strong>{merchProducts.length}</strong>
                </div>
              </div>
              <div className="merch-payment-method" role="group" aria-label="Forma de pagament de les vendes següents">
                <span>COBRAMENT</span>
                <button type="button" className={salePaymentMethod === 'card' ? 'is-active' : ''} aria-pressed={salePaymentMethod === 'card'} onClick={() => setSalePaymentMethod('card')}>
                  Targeta
                </button>
                <button type="button" className={salePaymentMethod === 'cash' ? 'is-active' : ''} aria-pressed={salePaymentMethod === 'cash'} onClick={() => setSalePaymentMethod('cash')}>
                  Efectiu
                </button>
              </div>
              {merchProducts.length ? (
                <label className="quick-sale-search merch-sale-search">
                  <Search size={17} />
                  <input type="search" value={merchSearch} onChange={(event) => setMerchSearch(event.target.value)} placeholder="Cerca producte o talla…" />
                  <span>{visibleMerchProducts.length}</span>
                </label>
              ) : null}
              <div className="merch-sale-content">
                <div>
                  {visibleMerchProducts.length ? (
                    <div className="quick-sale-grid">
                      {visibleMerchProducts.map((product) => {
                        const sizes = product.sizes || []
                        const productKey = `${product.id}:`
                        return (
                          <article className="quick-sale-product" key={product.id}>
                            <div className="quick-product-top">
                              <div>
                                <strong>{product.name}</strong>
                                <span>{formatMoney(product.price)}</span>
                              </div>
                              {!sizes.length ? (
                                <button type="button" className="quick-sale-add" disabled={savingProductId === productKey || stockRemaining(product) === 0} onClick={() => void quickSale(product)}>
                                  {savingProductId === productKey ? '…' : '+1'}
                                </button>
                              ) : null}
                            </div>
                            {sizes.length ? (
                              <div className="quick-sale-sizes">
                                {sizes.map((size) => {
                                  const key = `${product.id}:${size.name}`
                                  const remaining = stockRemaining(product, size.name)
                                  const soldHere = soldForConcert(product.id, size.name)
                                  return (
                                    <button type="button" key={size.name} disabled={savingProductId === key || remaining === 0} onClick={() => void quickSale(product, size.name)}>
                                      <strong>{size.name}</strong>
                                      <small>{savingProductId === key ? 'Desant…' : remaining ? `${remaining} disponibles` : 'Esgotada'}</small>
                                      <span>{soldHere} al concert</span>
                                    </button>
                                  )
                                })}
                              </div>
                            ) : (
                              <div className="quick-product-stock">
                                <span>{stockRemaining(product)} disponibles</span>
                                <span>{soldForConcert(product.id)} venudes aquí</span>
                              </div>
                            )}
                          </article>
                        )
                      })}
                    </div>
                  ) : merchProducts.length ? (
                    <p className="section-empty">No hi ha productes que coincideixin amb «{merchSearch}».</p>
                  ) : (
                    <p className="section-empty">Afegeix productes a Marxandatge per activar la venda.</p>
                  )}
                  {saleError ? (
                    <p className="form-error" role="alert">
                      {saleError}
                    </p>
                  ) : null}
                </div>
                {concertSales.length ? (
                  <div className="quick-sale-history merch-sale-history">
                    <div className="quick-sale-history-heading">
                      <strong>Últimes vendes</strong>
                      <span>{concertSales.length}</span>
                    </div>
                    {concertSales.slice(0, 8).map((sale) => (
                      <div className="quick-sale-history-row" key={sale.id}>
                        <span className="quick-sale-history-quantity">{sale.quantity}×</span>
                        <span className="quick-sale-history-name">
                          {merchProducts.find((item) => item.id === sale.productId)?.name || 'Producte eliminat'}
                          {sale.size ? ` · ${sale.size}` : ''}
                          <small>{sale.paymentMethod === 'cash' ? 'Efectiu' : 'Targeta'}</small>
                        </span>
                        <strong>{formatMoney(sale.quantity * sale.unitPrice)}</strong>
                        <button type="button" className="text-button" disabled={undoingSaleIds.includes(sale.id)} onClick={() => void undoSale(sale)}>
                          {undoingSaleIds.includes(sale.id) ? '…' : 'Desfer'}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="merch-sale-empty">Encara no hi ha vendes en aquest concert.</p>
                )}
              </div>
            </section>
          </div>
        ) : null}
        {stageSetlistOpen ? <StageSetlist title={concert.title} songs={d.setlist.split('\n').filter(Boolean)} onClose={() => setStageSetlistOpen(false)} /> : null}
      </div>
    </>
  )
}

export default function App() {
  const [oauthError] = useState(() => {
    const query = new URLSearchParams(window.location.search)
    const hash = new URLSearchParams(window.location.hash.slice(1))
    return query.get('error_description') || hash.get('error_description') ||
      (query.has('error') || hash.has('error') ? 'No s’ha pogut iniciar la sessió amb Google. Torna-ho a provar.' : '')
  })
  const publicListenToken = /^\/listen\/([A-Za-z0-9_-]+)\/?$/.exec(window.location.pathname)?.[1] || null
  const [initialWorkspaceProfile] = useState(() => getCachedBandProfile())
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
  const [workspaceName, setWorkspaceName] = useState(initialWorkspaceProfile.name)
  const [workspaceLogo, setWorkspaceLogo] = useState<string | undefined>(initialWorkspaceProfile.logoUrl)
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(initialWorkspaceProfile.onboardingComplete ?? (cloudConfigured ? null : true))
  const [labelAgreement, setLabelAgreement] = useState<LabelAgreement | null>(() => getCachedBandLabel())
  const [labelReady, setLabelReady] = useState(!cloudConfigured)
  const [workspaceProfileLoading, setWorkspaceProfileLoading] = useState(cloudConfigured)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [formInitial, setFormInitial] = useState<Concert | null>(null)
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [search, setSearch] = useState('')
  const [concertYear, setConcertYear] = useState('tots')
  const [menuOpen, setMenuOpen] = useState(false)
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine)
  const [offlineSyncStatus, setOfflineSyncStatus] = useState(() => getOfflineSyncStatus())
  const formDirtyRef = useRef(false)
  const songsDirtyRef = useRef(false)
  const formExitApprovedRef = useRef(false)
  const formHistoryRef = useRef<AppHistoryState | null>(null)

  function updateFormDirty(dirty: boolean) {
    if (dirty && formExitApprovedRef.current) return
    formDirtyRef.current = dirty
  }
  function confirmLeaveForm(): boolean {
    if (!formDirtyRef.current) return true
    const leave = window.confirm('Hi ha canvis desats com a esborrany. Vols sortir de la fitxa? Podràs recuperar-los en tornar-hi.')
    if (leave) {
      formExitApprovedRef.current = true
      updateFormDirty(false)
    }
    return leave
  }
  function confirmLeaveSongs(): boolean {
    if (screen !== 'songs' || !songsDirtyRef.current) return true
    const leave = window.confirm('Hi ha canvis sense desar a la cançó o la versió. Vols sortir igualment?')
    if (leave) songsDirtyRef.current = false
    return leave
  }
  function confirmLeaveEditor(): boolean {
    return confirmLeaveForm() && confirmLeaveSongs()
  }

  useEffect(() => {
    localStorage.setItem('escena-theme', theme)
    document.documentElement.dataset.theme = theme
  }, [theme])

  useEffect(() => {
    if (!authReady || (cloudConfigured && !session)) return
    let active = true
    setWorkspaceProfileLoading(true)
    getBandProfile()
      .then((profile) => {
        if (active) {
          setWorkspaceName(profile.name)
          setWorkspaceLogo(profile.logoUrl)
          setOnboardingComplete(profile.onboardingComplete ?? false)
        }
      })
      .catch(() => {
        if (active) setOnboardingComplete((current) => current ?? false)
      })
      .finally(() => {
        if (active) setWorkspaceProfileLoading(false)
      })
    return () => {
      active = false
    }
  }, [authReady, session?.user.id, online])

  useEffect(() => {
    if (!authReady || (cloudConfigured && !session)) return
    let active = true
    setLabelReady(false)
    getBandLabel()
      .then((label) => {
        if (active) {
          setLabelAgreement(label)
          setLabelReady(true)
        }
      })
      .catch(() => {
        if (active) setError('No s’ha pogut carregar la discogràfica. Revisa la connexió i la migració 016 de Supabase.')
      })
    return () => {
      active = false
    }
  }, [authReady, session?.user.id, online])

  useEffect(() => {
    if (!supabase) return
    supabase.auth
      .getSession()
      .then(({ data }) => {
        setDataSessionOwner(data.session?.user.id)
        setSession(data.session)
        setAuthReady(true)
      })
      .catch(() => {
        setDataSessionOwner()
        setSession(null)
        setAuthReady(true)
      })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, current) => {
      setDataSessionOwner(current?.user.id)
      setSession(current)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    // Keep the OAuth callback URL intact until Supabase has processed the session.
    if (!authReady) return
    window.history.replaceState({ escena: true, screen: 'home' } satisfies AppHistoryState, '')
    const restore = (event: PopStateEvent) => {
      const state = event.state as AppHistoryState | null
      if (!state?.escena) return
      if ((screen === 'form' && formDirtyRef.current) || (screen === 'songs' && songsDirtyRef.current)) {
        window.history.pushState(
          screen === 'form'
            ? formHistoryRef.current || {
                escena: true,
                screen: 'form',
                formInitial: formInitial || undefined,
              }
            : { escena: true, screen: 'songs' },
          '',
        )
        if (confirmLeaveEditor()) window.history.back()
        return
      }
      setScreen(state.screen)
      setSelectedId(state.selectedId || null)
      setFormInitial(state.formInitial || null)
      setMenuOpen(false)
      window.scrollTo(0, 0)
    }
    window.addEventListener('popstate', restore)
    return () => window.removeEventListener('popstate', restore)
  }, [authReady, screen, formInitial])

  useEffect(() => {
    if (!authReady || (cloudConfigured && !session)) {
      setLoading(false)
      if (authReady && cloudConfigured) {
        setConcerts([])
        setSelectedId(null)
        setScreen('home')
      }
      return
    }
    let alive = true
    setLoading(true)
    if (cloudConfigured) setConcerts([])
    listConcerts()
      .then((data) => {
        if (alive) {
          setConcerts(data)
          setError('')
        }
      })
      .catch((cause) => {
        if (alive) setError(cause instanceof Error ? cause.message : 'No s’han pogut carregar els concerts.')
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [authReady, session?.user.id])

  useEffect(() => {
    const refreshQueue = () => setOfflineSyncStatus(getOfflineSyncStatus())
    window.addEventListener('escena:offline-queue-change', refreshQueue)
    window.addEventListener('storage', refreshQueue)
    refreshQueue()
    return () => {
      window.removeEventListener('escena:offline-queue-change', refreshQueue)
      window.removeEventListener('storage', refreshQueue)
    }
  }, [])

  useEffect(() => {
    setOfflineSyncStatus(getOfflineSyncStatus())
  }, [session?.user.id])

  useEffect(() => {
    const becameOnline = () => {
      setOnline(true)
      void Promise.all([syncOfflineConcerts(), syncOfflineData()]).then(() => {
        if (cloudConfigured && session)
          void listConcerts().then(setConcerts).catch(() => {})
      })
    }
    const becameOffline = () => setOnline(false)
    window.addEventListener('online', becameOnline)
    window.addEventListener('offline', becameOffline)
    if (online) void Promise.all([syncOfflineConcerts(), syncOfflineData()])
    return () => {
      window.removeEventListener('online', becameOnline)
      window.removeEventListener('offline', becameOffline)
    }
  }, [online, session])

  if (!authReady) return <div className="loading-page">Carregant Escena…</div>
  if (publicListenToken)
    return (
      <Suspense fallback={<div className="loading-page">Carregant l’espai d’escolta…</div>}>
        <SongListening token={publicListenToken} />
      </Suspense>
    )
  if (cloudConfigured && !session) return <AuthScreen initialError={oauthError} />
  if (cloudConfigured && session && workspaceProfileLoading) return <div className="loading-page">Preparant el teu espai…</div>
  if (cloudConfigured && session && onboardingComplete === false)
    return (
      <OnboardingScreen
        initialName={workspaceName}
        onComplete={(name) => {
          setWorkspaceName(name)
          setOnboardingComplete(true)
        }}
        onSignOut={() => void supabase?.auth.signOut()}
      />
    )

  const selected = concerts.find((item) => item.id === selectedId)
  const sorted = [...concerts].sort((a, b) => a.date.localeCompare(b.date))
  const concertYears = Array.from(new Set(concerts.map((item) => item.date.slice(0, 4) || 'sense-data'))).sort((a, b) => (a === 'sense-data' ? 1 : b === 'sense-data' ? -1 : b.localeCompare(a)))
  const visible = sorted.filter((item) => `${item.title} ${item.venue} ${item.city}`.toLocaleLowerCase('ca').includes(search.toLocaleLowerCase('ca')) && (concertYear === 'tots' || (item.date.slice(0, 4) || 'sense-data') === concertYear))
  const today = new Date()
  const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const upcoming = visible.filter((item) => item.date >= todayString && item.status !== 'cancel·lat')
  const other = visible.filter((item) => item.date < todayString || item.status === 'cancel·lat')
  const upcomingByYear = groupConcertsByYear(upcoming, false)
  const pastByYear = groupConcertsByYear(other, true)
  const next = sorted.find((item) => item.date >= todayString && item.status !== 'cancel·lat')
  const totalPending = concerts.reduce((sum, item) => sum + getPending(item).length, 0)

  function open(id: string, replace = false) {
    if (!confirmLeaveEditor()) return
    const state: AppHistoryState = {
      escena: true,
      screen: 'detail',
      selectedId: id,
    }
    window.history[replace ? 'replaceState' : 'pushState'](state, '')
    setSelectedId(id)
    setFormInitial(null)
    setScreen('detail')
    setMenuOpen(false)
    window.scrollTo(0, 0)
  }
  function navigate(to: Screen, replace = false) {
    if (!confirmLeaveEditor()) return
    if (!replace && screen === to && !selectedId) {
      setMenuOpen(false)
      return
    }
    const state: AppHistoryState = { escena: true, screen: to }
    window.history[replace ? 'replaceState' : 'pushState'](state, '')
    setScreen(to)
    setSelectedId(null)
    setFormInitial(null)
    setMenuOpen(false)
    window.scrollTo(0, 0)
  }
  function startForm(initial: Concert, recoverNewDraft = true) {
    if (!confirmLeaveEditor()) return
    formExitApprovedRef.current = false
    if (recoverNewDraft && !initial.updatedAt && !initial.title) {
      try {
        const newConcertDraftKey = dataStorageKey('escena-new-concert-draft-id-v1')
        const draftId = localStorage.getItem(newConcertDraftKey)
        if (draftId) {
          const saved = JSON.parse(localStorage.getItem(dataStorageKey(`escena-concert-draft-${draftId}`)) || 'null') as Concert | null
          if (saved?.id === draftId && saved.details) initial = { ...initial, id: draftId }
          else localStorage.removeItem(newConcertDraftKey)
        }
      } catch {
        /* Continua amb un formulari nou si la recuperació local no està disponible. */
      }
    }
    const state: AppHistoryState = {
      escena: true,
      screen: 'form',
      formInitial: initial,
    }
    formHistoryRef.current = state
    window.history.pushState(state, '')
    setFormInitial(initial)
    setScreen('form')
    setMenuOpen(false)
    window.scrollTo(0, 0)
  }
  function startFormOnDate(date: string) {
    const concert = newConcert()
    concert.date = date
    startForm(concert, false)
  }
  async function save(item: Concert, navigateAfterSave = true) {
    const saved = await saveConcert(item, labelAgreement)
    formExitApprovedRef.current = true
    updateFormDirty(false)
    const previous = concerts.find((existing) => existing.id === saved.id)
    const retained = new Set(saved.details.documents.map((doc) => doc.storagePath))
    for (const doc of previous?.details.documents ?? []) {
      if (doc.storagePath && isConcertOwnedFile(saved, doc.storagePath) && !retained.has(doc.storagePath)) void removeConcertDocumentFile(doc.storagePath).catch(() => {})
    }
    setConcerts((prev) => [...prev.filter((existing) => existing.id !== saved.id), saved])
    if (navigateAfterSave) {
      open(saved.id, true)
    }
  }
  async function createAssistantSetlist(template: SetlistTemplate) {
    await saveResource('setlist_templates', template)
  }
  async function createAssistantPerson(person: BandPerson) {
    await saveResource('band_people', person)
  }
  async function deleteAssistantConcert(concert: Concert) {
    if (!concert.updatedAt) throw new Error('No es pot verificar la versió del concert. Recarrega la pàgina.')
    await deleteConcert(concert.id, concert.updatedAt)
    setConcerts((prev) => prev.filter((item) => item.id !== concert.id))
    for (const doc of concert.details.documents) {
      if (doc.storagePath && isConcertOwnedFile(concert, doc.storagePath)) void removeConcertDocumentFile(doc.storagePath).catch(() => {})
    }
  }
  async function remove() {
    if (!selected || !window.confirm(`Vols eliminar «${selected.title}»? Aquesta acció no es pot desfer.`)) return
    try {
      await deleteConcert(selected.id, selected.updatedAt)
      for (const doc of selected.details.documents) {
        if (doc.storagePath && isConcertOwnedFile(selected, doc.storagePath)) void removeConcertDocumentFile(doc.storagePath).catch(() => {})
      }
      setConcerts((prev) => prev.filter((item) => item.id !== selected.id))
      navigate('list', true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No s’ha pogut eliminar el concert.')
    }
  }
  async function toggleMaterial(id: string) {
    if (!selected) return
    const changed: Concert = {
      ...selected,
      details: {
        ...selected.details,
        materials: selected.details.materials.map((item) => (item.id === id ? { ...item, loaded: !item.loaded } : item)),
      },
    }
    const saved = await saveConcert(changed, labelAgreement)
    setConcerts((prev) => prev.map((item) => (item.id === saved.id ? saved : item)))
  }
  async function uploadDocument(id: string, file: File) {
    if (!selected) return
    const saved = await uploadConcertDocument(selected, id, file)
    setConcerts((prev) => prev.map((item) => (item.id === saved.id ? saved : item)))
  }
  async function removeDocumentFile(id: string) {
    if (!selected) return
    const doc = selected.details.documents.find((item) => item.id === id)
    if (!doc?.storagePath) return
    const changed: Concert = {
      ...selected,
      details: {
        ...selected.details,
        documents: selected.details.documents.map((item) => (item.id === id ? { ...item, storagePath: undefined, fileName: undefined } : item)),
      },
    }
    const saved = await saveConcert(changed, labelAgreement)
    setConcerts((prev) => prev.map((item) => (item.id === saved.id ? saved : item)))
    if (isConcertOwnedFile(selected, doc.storagePath)) void removeConcertDocumentFile(doc.storagePath).catch(() => {})
  }

  async function retryOfflineSync() {
    if (!online) return
    await Promise.all([syncOfflineConcerts(), syncOfflineData()])
    setOfflineSyncStatus(getOfflineSyncStatus())
    if (cloudConfigured && session) {
      try {
        setConcerts(await listConcerts())
      } catch {
        /* Keep the local list visible; queued errors remain in the sync panel. */
      }
    }
  }

  async function chooseConflictVersion(item: OfflineSyncItem, choice: 'local' | 'server') {
    try {
      if (item.kind === 'concert') await resolveOfflineConcertConflict(item.id, choice)
      else if (item.entity && item.entity !== 'sale') await resolveOfflineDataConflict(item.id, item.entity, choice)
      if (choice === 'local') await Promise.all([syncOfflineConcerts(), syncOfflineData()])
      setOfflineSyncStatus(getOfflineSyncStatus())
      if (cloudConfigured && session) setConcerts(await listConcerts())
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No s’ha pogut resoldre el conflicte.')
      setOfflineSyncStatus(getOfflineSyncStatus())
    }
  }

  async function discardFailedOfflineData(item: OfflineSyncItem) {
    if (!item.entity || !window.confirm(`Vols descartar el canvi local de «${item.label}»?`)) return
    await discardOfflineDataChange(item.id, item.entity)
    setOfflineSyncStatus(getOfflineSyncStatus())
    if (cloudConfigured && session) setConcerts(await listConcerts())
  }

  return (
    <div className={`app-layout ${themeClass(theme)}`}>
      <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-brand">
          <BrandMark />
          <BrandName />
          <button className="icon-button close-menu" aria-label="Tancar menú" onClick={() => setMenuOpen(false)}>
            <X size={20} />
          </button>
        </div>
        <div className="workspace-label">BANDA O ARTISTA</div>
        <button type="button" className={`workspace-name ${workspaceProfileLoading ? 'workspace-name-loading' : ''}`} aria-label={workspaceName ? `Configurar l’espai ${workspaceName}` : 'Configurar l’espai de la banda'} onClick={() => navigate('settings')}>
          <div className="workspace-avatar">{workspaceLogo ? <img src={workspaceLogo} alt="" /> : workspaceProfileLoading ? <Music2 size={18} /> : workspaceName.trim().charAt(0).toUpperCase() || 'B'}</div>
          <span>{workspaceName || (workspaceProfileLoading ? 'Carregant banda…' : 'Configura la banda')}</span>
          <SettingsIcon size={16} />
        </button>
        <nav className="sidebar-nav" aria-label="Navegació principal">
          <div className="sidebar-nav-group">
            <span className="sidebar-nav-heading">Activitat</span>
            <button className={screen === 'home' ? 'nav-active' : ''} onClick={() => navigate('home')}>
              <House size={19} /> Inici
            </button>
            <button className={screen === 'list' || screen === 'detail' || screen === 'form' ? 'nav-active' : ''} onClick={() => navigate('list')}>
              <List size={19} /> Concerts
            </button>
            <button className={screen === 'calendar' ? 'nav-active' : ''} onClick={() => navigate('calendar')}>
              <CalendarDays size={19} /> Calendari
            </button>
          </div>
          <div className="sidebar-nav-group">
            <span className="sidebar-nav-heading">Recursos</span>
            <button className={screen === 'people' ? 'nav-active' : ''} onClick={() => navigate('people')}>
              <UsersRound size={19} /> Persones
            </button>
            <button className={screen === 'materials' ? 'nav-active' : ''} onClick={() => navigate('materials')}>
              <PackageCheck size={19} /> Material
            </button>
            <button className={screen === 'songs' ? 'nav-active' : ''} onClick={() => navigate('songs')}>
              <AudioLines size={19} /> Cançons
            </button>
            <button className={screen === 'setlists' ? 'nav-active' : ''} onClick={() => navigate('setlists')}>
              <ListMusic size={19} /> Setlists
            </button>
            <button className={screen === 'library' ? 'nav-active' : ''} onClick={() => navigate('library')}>
              <FileText size={19} /> Documents
            </button>
          </div>
          <div className="sidebar-nav-group">
            <span className="sidebar-nav-heading">Gestió</span>
            <button className={screen === 'treasury' ? 'nav-active' : ''} onClick={() => navigate('treasury')}>
              <Wallet size={19} /> Tresoreria
            </button>
            <button className={screen === 'merch' ? 'nav-active' : ''} onClick={() => navigate('merch')}>
              <ShoppingBag size={19} /> Marxandatge
            </button>
          </div>
          <div className="sidebar-nav-group">
            <span className="sidebar-nav-heading">Eines</span>
            <button className={screen === 'poster' ? 'nav-active' : ''} onClick={() => navigate('poster')}>
              <ImageIcon size={19} /> Cartell de gira
            </button>
            <button className={screen === 'assistant' ? 'nav-active' : ''} onClick={() => navigate('assistant')}>
              <Sparkles size={19} /> IA
            </button>
          </div>
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-account">
            <div className="sidebar-account-copy">
              <strong>{session ? 'Sessió activa' : 'Demo local'}</strong>
              <span>{session ? 'Espai de la banda' : 'Dades en aquest navegador'}</span>
            </div>
            {session && supabase ? (
              <button
                type="button"
                className="logout-button"
                aria-label="Tancar sessió"
                title="Tancar sessió"
                onClick={() => {
                  if (confirmLeaveEditor()) void supabase?.auth.signOut()
                }}
              >
                <LogOut size={15} />
              </button>
            ) : null}
          </div>
        </div>
      </aside>
      {menuOpen ? <button className="mobile-overlay" aria-label="Tancar menú" onClick={() => setMenuOpen(false)} /> : null}
      <main className="main-area">
        <header className="topbar">
          <button type="button" className="icon-button menu-trigger" aria-label="Obrir menú" onClick={() => setMenuOpen(true)}>
            <Menu size={21} />
          </button>
          <span className="topbar-path">
            Espai de la banda <span>/</span> {screen === 'home' ? 'Inici' : screen === 'calendar' ? 'Calendari' : screen === 'poster' ? 'Cartell de gira' : screen === 'assistant' ? 'IA' : screen === 'detail' ? 'Fitxa del concert' : screen === 'form' ? 'Editar fitxa' : screen === 'library' ? 'Documents' : screen === 'treasury' ? 'Tresoreria' : screen === 'merch' ? 'Marxandatge' : screen === 'people' ? 'Persones' : screen === 'materials' ? 'Material' : screen === 'songs' ? 'Cançons' : screen === 'setlists' ? 'Setlists' : screen === 'settings' ? 'Configuració' : 'Concerts'}
          </span>
          <span className="topbar-right">
            {cloudConfigured ? (online ? 'EN LÍNIA' : 'SENSE CONNEXIÓ') : 'DEMO LOCAL'} <span className={`online-dot ${online ? '' : 'offline-dot'}`} />
          </span>
        </header>
        <div className="content-area">
          {cloudConfigured && offlineSyncStatus.pending > 0 ? (
            <section className={`offline-sync-panel ${offlineSyncStatus.failed ? 'offline-sync-failed' : ''}`} aria-live="polite">
              <div className="offline-sync-heading">
                <div>
                  <strong>{offlineSyncStatus.failed ? 'Canvis pendents de sincronitzar' : online ? 'Sincronitzant canvis' : 'Canvis desats en aquest dispositiu'}</strong>
                  <small>{offlineSyncStatus.failed ? `${offlineSyncStatus.failed} de ${offlineSyncStatus.pending} canvis necessiten atenció.` : `${offlineSyncStatus.pending} ${offlineSyncStatus.pending === 1 ? 'canvi pendent' : 'canvis pendents'}.`}</small>
                </div>
                {online ? (
                  <button type="button" className="button button-secondary" onClick={() => void retryOfflineSync()}>
                    Torna-ho a provar
                  </button>
                ) : null}
              </div>
              {offlineSyncStatus.items.slice(0, 5).map((item) => (
                <div className="offline-sync-item" key={item.key}>
                  <div>
                    <strong>{item.label}</strong>
                    {item.message ? <small>{item.message}</small> : null}
                  </div>
                  {item.conflict && online && (item.kind === 'concert' || item.entity === 'money' || item.entity === 'product' || item.entity === 'resource' || item.entity === 'song' || item.entity === 'song_version') ? (
                    <div className="offline-conflict-actions">
                      <button type="button" onClick={() => void chooseConflictVersion(item, 'local')}>
                        Conservar els meus canvis
                      </button>
                      <button type="button" onClick={() => void chooseConflictVersion(item, 'server')}>
                        Fer servir la versió del servidor
                      </button>
                    </div>
                  ) : item.message && item.kind === 'data' && online ? (
                    <div className="offline-conflict-actions">
                      <button type="button" onClick={() => void discardFailedOfflineData(item).catch((cause) => setError(cause instanceof Error ? cause.message : 'No s’ha pogut descartar el canvi.'))}>
                        Descartar aquest canvi
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
              {offlineSyncStatus.pending > 5 ? <small className="offline-sync-more">I {offlineSyncStatus.pending - 5} canvis més a la cua.</small> : null}
            </section>
          ) : null}
          {error ? (
            <div className="global-error" role="alert">
              {error}
              <button onClick={() => setError('')} aria-label="Tancar avís">
                <X size={16} />
              </button>
            </div>
          ) : null}
          {!cloudConfigured ? <div className="demo-banner">Estàs provant una demo local: els canvis es guarden només en aquest navegador. Connecta Supabase per compartir concerts entre dispositius.</div> : null}
          {loading ? <div className="content-loading">Carregant concerts…</div> : null}
          {!labelReady && ['treasury', 'settings', 'form', 'detail', 'assistant'].includes(screen) ? <div className="content-loading">No es pot mostrar la liquidació fins que es carreguin les condicions de la banda. Comprova la connexió o la migració 016.</div> : null}
          {screen === 'library' ? (
            <Suspense fallback={<div className="content-loading">Carregant documents…</div>}>
              <BandLibrary />
            </Suspense>
          ) : null}
          {screen === 'treasury' && labelReady ? (
            <Suspense fallback={<div className="content-loading">Carregant tresoreria…</div>}>
              <Treasury concerts={concerts} labelAgreement={labelAgreement} />
            </Suspense>
          ) : null}
          {screen === 'merch' ? (
            <Suspense fallback={<div className="content-loading">Carregant marxandatge…</div>}>
              <Merch concerts={concerts} />
            </Suspense>
          ) : null}
          {!loading && screen === 'poster' ? (
            <Suspense fallback={<div className="content-loading">Carregant cartell…</div>}>
              <TourPoster concerts={concerts} bandName={workspaceName} logoUrl={workspaceLogo} />
            </Suspense>
          ) : null}
          {screen === 'people' ? (
            <Suspense fallback={<div className="content-loading">Carregant persones…</div>}>
              <BandPeople />
            </Suspense>
          ) : null}
          {screen === 'materials' ? (
            <Suspense fallback={<div className="content-loading">Carregant material…</div>}>
              <BandMaterials />
            </Suspense>
          ) : null}
          {screen === 'setlists' ? (
            <Suspense fallback={<div className="content-loading">Carregant setlists…</div>}>
              <Setlists />
            </Suspense>
          ) : null}
          {screen === 'songs' ? (
            <Suspense fallback={<div className="content-loading">Carregant cançons…</div>}>
              <Songs
                onDirtyChange={(dirty) => {
                  songsDirtyRef.current = dirty
                }}
              />
            </Suspense>
          ) : null}
          {screen === 'settings' && labelReady ? (
            <Settings
              theme={theme}
              onThemeChange={(value: ThemeId) => {
                setTheme(value)
                document.documentElement.dataset.theme = value
              }}
              onImported={() => window.location.reload()}
              workspaceName={workspaceName}
              workspaceLogo={workspaceLogo}
              onWorkspaceNameChange={setWorkspaceName}
              onWorkspaceLogoChange={setWorkspaceLogo}
              labelAgreement={labelAgreement}
              onLabelChange={setLabelAgreement}
              accountEmail={session?.user.email || ''}
              onAccountDeleted={() => {
                setDataSessionOwner()
                setSession(null)
                void supabase?.auth.signOut({ scope: 'local' })
              }}
            />
          ) : null}
          {screen === 'assistant' && labelReady ? (
            <ConcertAssistant
              concerts={concerts}
              workspaceName={workspaceName}
              workspaceLogo={workspaceLogo}
              labelAgreement={labelAgreement}
              onWorkspaceNameChange={setWorkspaceName}
              onThemeChange={(value) => {
                setTheme(value)
                document.documentElement.dataset.theme = value
              }}
              onCreateDraft={(draft) => startForm(draft)}
              onUpdateConcert={(concert) => save(concert, false)}
              onSaveSetlist={createAssistantSetlist}
              onDeleteConcert={deleteAssistantConcert}
              onSavePerson={createAssistantPerson}
            />
          ) : null}
          {!loading && screen === 'home' ? <HomeView concerts={concerts} onOpen={open} onNewConcert={() => startForm(newConcert())} onGoToConcerts={() => navigate('list')} onGoToCalendar={() => navigate('calendar')} /> : null}
          {!loading && labelReady && screen === 'form' && formInitial ? (
            <ConcertForm
              key={formInitial.id}
              initial={formInitial}
              labelAgreement={labelAgreement}
              onDirtyChange={updateFormDirty}
              onSave={save}
              onCancel={() => {
                formExitApprovedRef.current = true
                updateFormDirty(false)
                if (formInitial.updatedAt) open(formInitial.id, true)
                else navigate('list', true)
              }}
            />
          ) : null}
          {!loading && labelReady && screen === 'detail' && selected ? <Detail key={selected.id} concert={selected} labelAgreement={labelAgreement} onBack={() => navigate('list', true)} onEdit={() => startForm(selected)} onDelete={() => void remove()} onToggle={toggleMaterial} onUpload={uploadDocument} onRemoveFile={removeDocumentFile} /> : null}
          {!loading && (screen === 'list' || screen === 'calendar') ? (
            <>
              <div className="page-heading list-heading">
                <div>
                  <span className="eyebrow">LA BANDA EN MOVIMENT</span>
                  <h1>
                    Els concerts<span className="heading-period">.</span>
                  </h1>
                  <p>Tot el que passa abans, durant i després de pujar a l'escenari.</p>
                </div>
                <button className="button button-primary new-button" onClick={() => startForm(newConcert())}>
                  <Plus size={18} /> Nou concert
                </button>
              </div>
              <div className="overview-strip">
                <div className="overview-next">
                  <div className="overview-icon">
                    <Music2 size={22} />
                  </div>
                  <div>
                    <span className="eyebrow">PROPER CONCERT</span>
                    <strong>{next ? next.title : 'Encara no hi ha cap data'}</strong>
                    <small>{next ? `${formatDate(next.date)} · ${concertPlace(next) || 'Lloc per concretar'}` : 'Afegeix un concert per començar'}</small>
                  </div>
                  {next ? (
                    <button aria-label={`Obrir ${next.title}`} onClick={() => open(next.id)} className="overview-arrow">
                      <ArrowRight size={19} />
                    </button>
                  ) : null}
                </div>
                <div className="overview-stat">
                  <span className="eyebrow">PER RESOLDRE</span>
                  <strong>{totalPending.toString().padStart(2, '0')}</strong>
                  <small>{totalPending === 1 ? 'qüestió pendent' : 'qüestions pendents'}</small>
                </div>
              </div>
              <div className="listing-header">
                <div className="view-tabs">
                  <button className={screen === 'list' ? 'active-tab' : ''} onClick={() => navigate('list')}>
                    <List size={17} /> Llista
                  </button>
                  <button className={screen === 'calendar' ? 'active-tab' : ''} onClick={() => navigate('calendar')}>
                    <CalendarDays size={17} /> Calendari
                  </button>
                </div>
                {screen === 'list' ? (
                  <div className="concert-list-filters">
                    <label className="year-filter">
                      <span className="sr-only">Filtrar concerts per any</span>
                      <select value={concertYear} onChange={(event) => setConcertYear(event.target.value)}>
                        <option value="tots">Tots els anys</option>
                        {concertYears.map((year) => (
                          <option key={year} value={year}>
                            {year === 'sense-data' ? 'Sense data' : year}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="search-box">
                      <Search size={18} />
                      <span className="sr-only">Cerca concerts</span>
                      <input type="search" placeholder="Cerca concerts..." value={search} onChange={(e) => setSearch(e.target.value)} />
                    </label>
                  </div>
                ) : null}
              </div>
              {screen === 'calendar' ? (
                <CalendarView concerts={concerts} onOpen={open} onCreate={startFormOnDate} month={month} setMonth={setMonth} />
              ) : (
                <div className="concert-list">
                  <div className="list-label">
                    <span>PROPERS CONCERTS</span>
                    <span>
                      {upcoming.length} {upcoming.length === 1 ? 'concert' : 'concerts'}
                    </span>
                  </div>
                  {upcoming.length ? (
                    upcomingByYear.map(([year, items]) => <ConcertYearGroup key={year} year={year} concerts={items} onOpen={open} />)
                  ) : (
                    <div className="empty-list">
                      <CalendarDays size={25} />
                      <h3>{search || concertYear !== 'tots' ? 'Cap resultat' : 'Encara no hi ha concerts propers'}</h3>
                      <p>{search || concertYear !== 'tots' ? 'Prova una altra cerca o any.' : 'Crea un concert i comença a reunir tota la informació.'}</p>
                    </div>
                  )}
                  {other.length ? (
                    <>
                      <div className="list-label past-label">
                        <span>ANTERIORS I CANCEL·LATS</span>
                        <span>{other.length}</span>
                      </div>
                      {pastByYear.map(([year, items]) => (
                        <ConcertYearGroup key={year} year={year} concerts={items} onOpen={open} collapsible={year !== String(today.getFullYear()) && year !== 'sense-data'} />
                      ))}
                    </>
                  ) : null}
                </div>
              )}
            </>
          ) : null}
        </div>
        <footer className="app-footer">
          <span>Escena · Els concerts, clars.</span>
          <span>
            Fet per al camí <ArrowRight size={14} />
          </span>
        </footer>
      </main>
    </div>
  )
}
