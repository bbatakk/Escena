import { useEffect, useState, type FormEvent } from 'react'
import { ListMusic, Pencil, Plus, Trash2, X } from 'lucide-react'
import { listResource, saveResource } from './data'
import { createId, type SetlistTemplate } from './model'

const emptySetlist = { name: '', songs: '' }

export default function Setlists() {
  const [setlists, setSetlists] = useState<SetlistTemplate[]>([])
  const [setlist, setSetlist] = useState(emptySetlist)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    const load = () => void listResource<SetlistTemplate>('setlist_templates').then((items) => { if (active) setSetlists(items) }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'No s’han pogut carregar les plantilles.') })
    load()
    window.addEventListener('escena:offline-queue-change', load)
    return () => { active = false; window.removeEventListener('escena:offline-queue-change', load) }
  }, [])

  function edit(item: SetlistTemplate) {
    setEditingId(item.id)
    setSetlist({ name: item.name, songs: item.songs.join('\n') })
    setError('')
  }

  function cancelEdit() { setEditingId(null); setSetlist(emptySetlist); setError('') }

  async function save(event: FormEvent) {
    event.preventDefault()
    setBusy(true); setError('')
    try {
      const current = setlists.find((item) => item.id === editingId)
      const saved = await saveResource('setlist_templates', {
        id: editingId || createId(), name: setlist.name.trim(),
        songs: setlist.songs.split('\n').map((song) => song.trim()).filter(Boolean), active: current?.active ?? true,
      })
      setSetlists((items) => editingId ? items.map((item) => item.id === saved.id ? saved : item) : [...items, saved])
      setSetlist(emptySetlist); setEditingId(null)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No s’ha pogut desar la plantilla.') }
    finally { setBusy(false) }
  }

  async function archive(item: SetlistTemplate) {
    setBusy(true); setError('')
    try { await saveResource('setlist_templates', { ...item, active: false }); setSetlists((items) => items.filter((entry) => entry.id !== item.id)); if (editingId === item.id) cancelEdit() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No s’ha pogut arxivar la plantilla.') }
    finally { setBusy(false) }
  }

  return <div className="resource-page">
    <div className="page-heading resources-heading"><div><span className="eyebrow">SETLISTS DE LA BANDA</span><h1>El repertori, en ordre<span className="heading-period">.</span></h1><p>Prepara plantilles per a cada tipus d’actuació i ajusta-les després dins del concert.</p></div></div>
    <div className="resource-layout">
      <section className="form-card resource-add-card"><div className="section-heading"><span className="section-index"><ListMusic size={16} /></span><div><h2>{editingId ? 'Editar plantilla' : 'Nova plantilla'}</h2><p>Una cançó per línia, en l’ordre de l’actuació.</p></div></div>
        <form className="fields" onSubmit={(event) => void save(event)}><label className="field">Nom de la plantilla <input required value={setlist.name} onChange={(event) => setSetlist({ ...setlist, name: event.target.value })} placeholder="Setlist festival" /></label><label className="field">Cançons <textarea required rows={9} value={setlist.songs} onChange={(event) => setSetlist({ ...setlist, songs: event.target.value })} placeholder="Una cançó per línia" /></label><button className="button button-primary" disabled={busy}>{editingId ? 'Desar canvis' : <><Plus size={15} /> Afegir plantilla</>}</button>{editingId ? <button className="button button-secondary" type="button" disabled={busy} onClick={cancelEdit}><X size={15} /> Cancel·lar</button> : null}</form>
      </section>
      <div className="resource-groups">{setlists.length ? setlists.map((item) => <section className="resource-group setlist-resource" key={item.id}><div className="resource-group-heading"><div><span className="eyebrow">{item.songs.length} CANÇONS</span><h2>{item.name}</h2></div><div className="resource-row-actions"><button className="icon-button" type="button" disabled={busy} aria-label={`Editar ${item.name}`} title="Editar plantilla" onClick={() => edit(item)}><Pencil size={14} /></button><button className="icon-button" type="button" disabled={busy} aria-label={`Arxivar ${item.name}`} title="Arxivar plantilla" onClick={() => void archive(item)}><Trash2 size={14} /></button></div></div><div className="setlist-preview">{item.songs.map((song, index) => <div key={`${item.id}-${index}`}><span>{String(index + 1).padStart(2, '0')}</span>{song}</div>)}</div></section>) : <section className="resource-group"><p className="section-empty">Encara no hi ha plantilles de setlist.</p></section>}</div>
    </div>{error ? <div className="global-error" role="alert">{error}</div> : null}
  </div>
}
