import { useEffect, useState, type FormEvent } from 'react'
import { Pencil, Plus, Trash2, UserRound, X } from 'lucide-react'
import { listResource, saveResource } from './data'
import { createId, type BandPerson, type PersonKind, type PersonFeeAgreement } from './model'
import PersonFeeEditor from './PersonFeeEditor'

const kindLabels: Record<PersonKind, string> = { musica: 'Música', tecnic: 'Tècnic', manager: 'Mànager', contacte: 'Contacte' }
const emptyPerson = { name: '', kind: 'musica' as PersonKind, phone: '', email: '', feeAgreement: undefined as PersonFeeAgreement | undefined }

export default function BandPeople() {
  const [people, setPeople] = useState<BandPerson[]>([])
  const [person, setPerson] = useState(emptyPerson)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    const load = () => void listResource<BandPerson>('band_people').then((items) => { if (active) setPeople(items) }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'No s’han pogut carregar les persones.') })
    load()
    window.addEventListener('escena:offline-queue-change', load)
    return () => { active = false; window.removeEventListener('escena:offline-queue-change', load) }
  }, [])

  function edit(item: BandPerson) { setEditingId(item.id); setPerson({ name: item.name, kind: item.kind, phone: item.phone, email: item.email, feeAgreement: item.feeAgreement }); setError('') }
  function cancelEdit() { setEditingId(null); setPerson(emptyPerson); setError('') }

  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('')
    try {
      const current = people.find((item) => item.id === editingId)
      const saved = await saveResource('band_people', { id: editingId || createId(), ...person, name: person.name.trim(), phone: person.phone.trim(), email: person.email.trim(), active: current?.active ?? true })
      setPeople((items) => editingId ? items.map((item) => item.id === saved.id ? saved : item) : [...items, saved])
      setPerson(emptyPerson); setEditingId(null)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No s’ha pogut desar la persona.') }
    finally { setBusy(false) }
  }

  async function archive(item: BandPerson) {
    setBusy(true); setError('')
    try { await saveResource('band_people', { ...item, active: false }); setPeople((items) => items.filter((entry) => entry.id !== item.id)); if (editingId === item.id) cancelEdit() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No s’ha pogut arxivar la persona.') }
    finally { setBusy(false) }
  }

  const team = people.filter((item) => item.kind !== 'contacte')
  const contacts = people.filter((item) => item.kind === 'contacte')
  const group = (title: string, items: BandPerson[]) => <section className="resource-group"><div className="resource-group-heading"><div><span className="eyebrow">{items.length} {items.length === 1 ? 'PERSONA' : 'PERSONES'}</span><h2>{title}</h2></div></div>{items.length ? <div className="resource-list">{items.map((item) => <div className="resource-row" key={item.id}><div><strong>{item.name}</strong><small>{kindLabels[item.kind]}{item.phone ? ` · ${item.phone}` : ''}{item.email ? ` · ${item.email}` : ''}</small></div><div className="resource-row-actions"><button className="icon-button" type="button" disabled={busy} aria-label={`Editar ${item.name}`} title="Editar persona" onClick={() => edit(item)}><Pencil size={14} /></button><button className="icon-button" type="button" disabled={busy} aria-label={`Arxivar ${item.name}`} title="Arxivar persona" onClick={() => void archive(item)}><Trash2 size={14} /></button></div></div>)}</div> : <p className="section-empty">Encara no hi ha persones en aquest grup.</p>}</section>

  return <div className="resource-page"><div className="page-heading resources-heading"><div><span className="eyebrow">PERSONES DE LA BANDA</span><h1>Banda, equip i contactes<span className="heading-period">.</span></h1><p>La gent que fa possible cada concert, disponible per seleccionar-la a la fitxa. Les tarifes habituals són opcionals.</p></div></div>
    <div className="resource-layout">
      <section className="form-card resource-add-card">
        <div className="section-heading"><span className="section-index"><UserRound size={16} /></span><div><h2>{editingId ? 'Editar persona' : 'Afegir persona'}</h2><p>Guarda les dades que necessites tenir a mà.</p></div></div>
        <form className="fields" onSubmit={(event) => void save(event)}>
          <label className="field">Nom <input required value={person.name} onChange={(event) => setPerson({ ...person, name: event.target.value })} placeholder="Nom i cognoms" /></label>
          <label className="field">Tipus <select value={person.kind} onChange={(event) => setPerson({ ...person, kind: event.target.value as PersonKind })}>{Object.entries(kindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="field">Telèfon <input type="tel" value={person.phone} onChange={(event) => setPerson({ ...person, phone: event.target.value })} /></label>
          <label className="field">Correu <input type="email" value={person.email} onChange={(event) => setPerson({ ...person, email: event.target.value })} /></label>
          <PersonFeeEditor value={person.feeAgreement} onChange={(feeAgreement) => setPerson({ ...person, feeAgreement })} />
          <p className="label-concert-note">Les condicions es copien en seleccionar aquesta persona en un concert. Canviar-les aquí no modifica fitxes anteriors.</p>
          <button className="button button-primary" disabled={busy}>{editingId ? 'Desar canvis' : <><Plus size={15} /> Afegir persona</>}</button>
          {editingId ? <button className="button button-secondary" type="button" disabled={busy} onClick={cancelEdit}><X size={15} /> Cancel·lar</button> : null}
        </form>
      </section>
      <div className="resource-groups">{group('Banda i equip', team)}{group('Contactes externs', contacts)}</div>
    </div>{error ? <div className="global-error" role="alert">{error}</div> : null}
  </div>
}
