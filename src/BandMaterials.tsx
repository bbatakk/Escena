import { useEffect, useState, type FormEvent } from 'react'
import { Package, Pencil, Plus, Trash2, X } from 'lucide-react'
import { listResource, saveResource } from './data'
import { createId, type BandMaterial } from './model'

const emptyMaterial = { name: '', category: '' }

export default function BandMaterials() {
  const [materials, setMaterials] = useState<BandMaterial[]>([])
  const [material, setMaterial] = useState(emptyMaterial)
  const [newCategory, setNewCategory] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    const load = () => void listResource<BandMaterial>('band_materials').then((items) => { if (active) setMaterials(items) }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'No s’ha pogut carregar el material.') })
    load()
    window.addEventListener('escena:offline-queue-change', load)
    return () => { active = false; window.removeEventListener('escena:offline-queue-change', load) }
  }, [])

  function edit(item: BandMaterial) { setEditingId(item.id); setMaterial({ name: item.name, category: item.category || '' }); setNewCategory(''); setError('') }
  function cancelEdit() { setEditingId(null); setMaterial(emptyMaterial); setNewCategory(''); setError('') }

  async function save(event: FormEvent) {
    event.preventDefault()
    const category = material.category === '__new__' ? newCategory.trim() : material.category
    if (material.category === '__new__' && !category) return
    setBusy(true); setError('')
    try {
      const current = materials.find((item) => item.id === editingId)
      const saved = await saveResource('band_materials', { id: editingId || createId(), name: material.name.trim(), category, active: current?.active ?? true })
      setMaterials((items) => editingId ? items.map((item) => item.id === saved.id ? saved : item) : [...items, saved])
      setMaterial(emptyMaterial); setNewCategory(''); setEditingId(null)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No s’ha pogut desar el material.') }
    finally { setBusy(false) }
  }

  async function archive(item: BandMaterial) {
    setBusy(true); setError('')
    try { await saveResource('band_materials', { ...item, active: false }); setMaterials((items) => items.filter((entry) => entry.id !== item.id)); if (editingId === item.id) cancelEdit() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No s’ha pogut arxivar el material.') }
    finally { setBusy(false) }
  }

  const categories = Array.from(new Set(materials.map((item) => item.category || 'Sense categoria')))
  return <div className="resource-page"><div className="page-heading resources-heading"><div><span className="eyebrow">MATERIAL DE LA BANDA</span><h1>El que ha de pujar a l’escenari<span className="heading-period">.</span></h1><p>Construeix el catàleg habitual i tria la càrrega de cada concert des de la seva fitxa.</p></div></div>
    <div className="resource-layout"><section className="form-card resource-add-card"><div className="section-heading"><span className="section-index"><Package size={16} /></span><div><h2>{editingId ? 'Editar material' : 'Afegir material'}</h2><p>Un element del catàleg reutilitzable.</p></div></div><form className="fields" onSubmit={(event) => void save(event)}><label className="field">Material <input required value={material.name} onChange={(event) => setMaterial({ ...material, name: event.target.value })} placeholder="Micròfon, pedalera…" /></label><label className="field">Categoria <select value={material.category} onChange={(event) => setMaterial({ ...material, category: event.target.value })}><option value="">Sense categoria</option>{categories.filter((category) => category !== 'Sense categoria').map((category) => <option key={category} value={category}>{category}</option>)}<option value="__new__">Nova categoria…</option></select></label>{material.category === '__new__' ? <label className="field">Nom de la nova categoria <input required autoFocus value={newCategory} onChange={(event) => setNewCategory(event.target.value)} placeholder="Per exemple, Escenari" /></label> : null}<button className="button button-primary" disabled={busy}>{editingId ? 'Desar canvis' : <><Plus size={15} /> Afegir material</>}</button>{editingId ? <button className="button button-secondary" type="button" disabled={busy} onClick={cancelEdit}><X size={15} /> Cancel·lar</button> : null}</form></section>
      <div className="resource-groups">{categories.length ? categories.map((category) => { const items = materials.filter((item) => (item.category || 'Sense categoria') === category); return <section className="resource-group" key={category}><div className="resource-group-heading"><div><span className="eyebrow">{items.length} ELEMENTS</span><h2>{category}</h2></div></div><div className="resource-list">{items.map((item) => <div className="resource-row" key={item.id}><strong>{item.name}</strong><div className="resource-row-actions"><button className="icon-button" type="button" disabled={busy} aria-label={`Editar ${item.name}`} title="Editar material" onClick={() => edit(item)}><Pencil size={14} /></button><button className="icon-button" type="button" disabled={busy} aria-label={`Arxivar ${item.name}`} title="Arxivar material" onClick={() => void archive(item)}><Trash2 size={14} /></button></div></div>)}</div></section> }) : <section className="resource-group"><p className="section-empty">Encara no hi ha material al catàleg.</p></section>}</div>
    </div>{error ? <div className="global-error" role="alert">{error}</div> : null}
  </div>
}
