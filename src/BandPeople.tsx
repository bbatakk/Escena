import { useEffect, useState, type FormEvent } from 'react'
import { Plus, Trash2, UserRound } from 'lucide-react'
import { listResource, saveResource } from './data'
import { createId, type BandPerson, type PersonKind } from './model'

const kindLabels: Record<PersonKind, string> = { musica: 'Música', tecnic: 'Tècnic', manager: 'Mànager', contacte: 'Contacte' }

export default function BandPeople() {
  const [people, setPeople] = useState<BandPerson[]>([])
  const [person, setPerson] = useState({ name: '', kind: 'musica' as PersonKind, phone: '', email: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { let active = true; listResource<BandPerson>('band_people').then((items) => { if (active) setPeople(items) }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'No s’han pogut carregar les persones.') }); return () => { active = false } }, [])
  async function add(event: FormEvent) { event.preventDefault(); setBusy(true); setError(''); try { const saved = await saveResource('band_people', { id: createId(), ...person, active: true }); setPeople((items) => [...items, saved]); setPerson({ name: '', kind: 'musica', phone: '', email: '' }) } catch (cause) { setError(cause instanceof Error ? cause.message : 'No s’ha pogut desar la persona.') } finally { setBusy(false) } }
  async function archive(item: BandPerson) { setBusy(true); setError(''); try { await saveResource('band_people', { ...item, active: false }); setPeople((items) => items.filter((entry) => entry.id !== item.id)) } catch (cause) { setError(cause instanceof Error ? cause.message : 'No s’ha pogut arxivar la persona.') } finally { setBusy(false) } }
  const team = people.filter((item) => item.kind !== 'contacte')
  const contacts = people.filter((item) => item.kind === 'contacte')
  const group = (title: string, items: BandPerson[]) => <section className="resource-group"><div className="resource-group-heading"><div><span className="eyebrow">{items.length} {items.length === 1 ? 'PERSONA' : 'PERSONES'}</span><h2>{title}</h2></div></div>{items.length ? <div className="resource-list">{items.map((item) => <div className="resource-row" key={item.id}><div><strong>{item.name}</strong><small>{kindLabels[item.kind]}{item.phone ? ` · ${item.phone}` : ''}{item.email ? ` · ${item.email}` : ''}</small></div><button className="icon-button" type="button" disabled={busy} aria-label={`Arxivar ${item.name}`} onClick={() => void archive(item)}><Trash2 size={14} /></button></div>)}</div> : <p className="section-empty">Encara no hi ha persones en aquest grup.</p>}</section>

  return <div className="resource-page"><div className="page-heading resources-heading"><div><span className="eyebrow">PERSONES DE LA BANDA</span><h1>Banda, equip i contactes<span className="heading-period">.</span></h1><p>La gent que fa possible cada concert, disponible per seleccionar-la a la fitxa.</p></div></div><div className="resource-layout"><section className="form-card resource-add-card"><div className="section-heading"><span className="section-index"><UserRound size={16} /></span><div><h2>Afegir persona</h2><p>Guarda les dades que necessites tenir a mà.</p></div></div><form className="fields" onSubmit={(event) => void add(event)}><label className="field">Nom <input required value={person.name} onChange={(event) => setPerson({ ...person, name: event.target.value })} placeholder="Nom i cognoms" /></label><label className="field">Tipus <select value={person.kind} onChange={(event) => setPerson({ ...person, kind: event.target.value as PersonKind })}>{Object.entries(kindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="field">Telèfon <input type="tel" value={person.phone} onChange={(event) => setPerson({ ...person, phone: event.target.value })} /></label><label className="field">Correu <input type="email" value={person.email} onChange={(event) => setPerson({ ...person, email: event.target.value })} /></label><button className="button button-primary" disabled={busy}><Plus size={15} /> Afegir persona</button></form></section><div className="resource-groups">{group('Banda i equip', team)}{group('Contactes externs', contacts)}</div></div>{error ? <div className="global-error" role="alert">{error}</div> : null}</div>
}
