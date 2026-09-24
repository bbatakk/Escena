import { useState, type FormEvent } from 'react'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { createId, type Concert, type ConcertDetails, statusLabels } from './model'

interface Props {
  initial: Concert
  onSave: (concert: Concert) => Promise<void>
  onCancel: () => void
}

export default function ConcertForm({ initial, onSave, onCancel }: Props) {
  const [concert, setConcert] = useState<Concert>(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const d = concert.details

  function setField<K extends keyof Concert>(key: K, value: Concert[K]) {
    setConcert((prev) => ({ ...prev, [key]: value }))
  }

  function setDetail<K extends keyof ConcertDetails>(key: K, value: ConcertDetails[K]) {
    setConcert((prev) => ({ ...prev, details: { ...prev.details, [key]: value } }))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await onSave(concert)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No s’ha pogut desar el concert. Torna-ho a provar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="form-shell">
      <button type="button" className="text-button back-button" onClick={onCancel}><ArrowLeft size={17} /> Tornar als concerts</button>
      <div className="page-heading form-heading">
        <div><span className="eyebrow">FITXA DE CONCERT</span><h1>{initial.title ? 'Editar concert' : 'Nou concert'}</h1></div>
        <p>Omple només la informació que tinguis. La resta pot esperar.</p>
      </div>

      <form onSubmit={submit}>
        <div className="form-grid">
          <section className="form-card wide-card">
            <div className="section-heading"><span className="section-index">01</span><div><h2>El concert</h2><p>El que necessites per identificar-lo al calendari.</p></div></div>
            <div className="fields two-col">
              <label className="field field-span">Nom del concert <input required autoFocus value={concert.title} onChange={(e) => setField('title', e.target.value)} placeholder="Ex. Festa Major de la Plaça" /></label>
              <label className="field">Data <input required type="date" value={concert.date} onChange={(e) => setField('date', e.target.value)} /></label>
              <label className="field">Estat <select value={concert.status} onChange={(e) => setField('status', e.target.value as Concert['status'])}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label className="field">Sala o espai <input value={concert.venue} onChange={(e) => setField('venue', e.target.value)} placeholder="Ex. Sala La Farinera" /></label>
              <label className="field">Població <input value={concert.city} onChange={(e) => setField('city', e.target.value)} placeholder="Ex. Girona" /></label>
              <label className="field field-span">Adreça <input value={concert.address} onChange={(e) => setField('address', e.target.value)} placeholder="Adreça de l'actuació" /></label>
            </div>
          </section>

          <section className="form-card">
            <div className="section-heading"><span className="section-index">02</span><div><h2>Acord</h2><p>Què s'ha pactat amb l'organització.</p></div></div>
            <div className="fields">
              <label className="field">Catxet acordat (€) <input type="number" min="0" step="0.01" value={concert.feeAmount} onChange={(e) => setField('feeAmount', Number(e.target.value))} /></label>
              <label className="field">Condicions <textarea rows={3} value={d.conditions} onChange={(e) => setDetail('conditions', e.target.value)} placeholder="Despeses cobertes, forma de pagament..." /></label>
              <label className="field">Condicions de cancel·lació <textarea rows={2} value={d.cancellation} onChange={(e) => setDetail('cancellation', e.target.value)} /></label>
            </div>
          </section>

          <section className="form-card">
            <div className="section-heading"><span className="section-index">03</span><div><h2>Persones</h2><p>Amb qui parlareu i qui vindrà.</p></div></div>
            <div className="fields">
              <label className="field">Contacte responsable <input value={d.contactName} onChange={(e) => setDetail('contactName', e.target.value)} placeholder="Nom i cognoms" /></label>
              <div className="two-col"><label className="field">Telèfon <input type="tel" value={d.contactPhone} onChange={(e) => setDetail('contactPhone', e.target.value)} /></label><label className="field">Correu <input type="email" value={d.contactEmail} onChange={(e) => setDetail('contactEmail', e.target.value)} /></label></div>
              <label className="field">Banda i equip <textarea rows={2} value={d.team} onChange={(e) => setDetail('team', e.target.value)} placeholder="Músics, tècnics, mànager..." /></label>
            </div>
          </section>

          <section className="form-card wide-card">
            <div className="section-heading"><span className="section-index">04</span><div><h2>Horaris i desplaçament</h2><p>Els moments importants i com arribareu.</p></div></div>
            <div className="repeat-list">
              {d.schedule.map((item) => <div className="repeat-row schedule-row" key={item.id}>
                <input aria-label="Hora" type="time" value={item.time} onChange={(e) => setDetail('schedule', d.schedule.map((x) => x.id === item.id ? { ...x, time: e.target.value } : x))} />
                <input aria-label="Què passa" value={item.label} onChange={(e) => setDetail('schedule', d.schedule.map((x) => x.id === item.id ? { ...x, label: e.target.value } : x))} placeholder="Prova de so, actuació..." />
                <input aria-label="On" value={item.place} onChange={(e) => setDetail('schedule', d.schedule.map((x) => x.id === item.id ? { ...x, place: e.target.value } : x))} placeholder="Lloc (opcional)" />
                <button type="button" className="icon-button danger-icon" aria-label="Eliminar horari" onClick={() => setDetail('schedule', d.schedule.filter((x) => x.id !== item.id))}><Trash2 size={17} /></button>
              </div>)}
              <button type="button" className="add-button" onClick={() => setDetail('schedule', [...d.schedule, { id: createId(), time: '', label: '', place: '' }])}><Plus size={16} /> Afegir horari</button>
            </div>
            <div className="fields two-col form-subsection">
              <label className="field field-span">Pla de desplaçament <textarea rows={2} value={d.travel} onChange={(e) => setDetail('travel', e.target.value)} placeholder="Punt de trobada, vehicles o com hi arriba cadascú" /></label>
              <label className="field">Accés de càrrega <input value={d.loadIn} onChange={(e) => setDetail('loadIn', e.target.value)} /></label>
              <label className="field">Aparcament <input value={d.parking} onChange={(e) => setDetail('parking', e.target.value)} /></label>
            </div>
          </section>

          <section className="form-card">
            <div className="section-heading"><span className="section-index">05</span><div><h2>Hospitalitat</h2><p>Indica «Sí» només quan estigui confirmat.</p></div></div>
            <div className="fields">
              <label className="field">Sopar <select value={d.dinner} onChange={(e) => setDetail('dinner', e.target.value as ConcertDetails['dinner'])}><option value="pendent">Encara no ho sabem</option><option value="si">Sí</option><option value="no">No</option></select></label>
              {d.dinner === 'si' ? <label className="field">Detalls del sopar <input value={d.dinnerDetails} onChange={(e) => setDetail('dinnerDetails', e.target.value)} placeholder="Hora, lloc, persones..." /></label> : null}
              <label className="field">Allotjament <select value={d.lodging} onChange={(e) => setDetail('lodging', e.target.value as ConcertDetails['lodging'])}><option value="pendent">Encara no ho sabem</option><option value="si">Sí</option><option value="no">No cal</option></select></label>
              {d.lodging === 'si' ? <label className="field">Detalls de l'allotjament <input value={d.lodgingDetails} onChange={(e) => setDetail('lodgingDetails', e.target.value)} placeholder="Nom, adreça, reserves..." /></label> : null}
            </div>
          </section>

          <section className="form-card">
            <div className="section-heading"><span className="section-index">06</span><div><h2>Documents</h2><p>Registra què s'ha d'enviar o rebre. Pots afegir un enllaç.</p></div></div>
            <div className="repeat-list">
              {d.documents.map((doc) => <div className="repeat-entry" key={doc.id}>
                <div className="repeat-row"><input aria-label="Nom del document" value={doc.name} onChange={(e) => setDetail('documents', d.documents.map((x) => x.id === doc.id ? { ...x, name: e.target.value } : x))} placeholder="Rider, full de ruta..." /><button type="button" className="icon-button danger-icon" aria-label="Eliminar document" onClick={() => setDetail('documents', d.documents.filter((x) => x.id !== doc.id))}><Trash2 size={17} /></button></div>
                <div className="two-col"><label className="field">Acció <select value={doc.direction} onChange={(e) => setDetail('documents', d.documents.map((x) => x.id === doc.id ? { ...x, direction: e.target.value as typeof doc.direction } : x))}><option value="enviar">Enviar</option><option value="rebre">Rebre</option></select></label><label className="field">Situació <select value={doc.status} onChange={(e) => setDetail('documents', d.documents.map((x) => x.id === doc.id ? { ...x, status: e.target.value as typeof doc.status } : x))}><option value="pendent">Pendent</option><option value="fet">{doc.direction === 'enviar' ? 'Enviat' : 'Rebut'}</option><option value="no_cal">No cal</option></select></label></div>
                <label className="field">Enllaç al document <input type="url" value={doc.url} onChange={(e) => setDetail('documents', d.documents.map((x) => x.id === doc.id ? { ...x, url: e.target.value } : x))} placeholder="https://..." /></label>
              </div>)}
              <button type="button" className="add-button" onClick={() => setDetail('documents', [...d.documents, { id: createId(), name: '', direction: 'rebre', status: 'pendent', url: '' }])}><Plus size={16} /> Afegir document</button>
            </div>
          </section>

          <section className="form-card">
            <div className="section-heading"><span className="section-index">07</span><div><h2>Material</h2><p>La llista que comprovareu abans de sortir.</p></div></div>
            <div className="repeat-list">
              {d.materials.map((item) => <div className="repeat-row" key={item.id}><input aria-label="Material a portar" value={item.name} onChange={(e) => setDetail('materials', d.materials.map((x) => x.id === item.id ? { ...x, name: e.target.value } : x))} placeholder="Ex. Caixa de cables" /><button type="button" className="icon-button danger-icon" aria-label="Eliminar material" onClick={() => setDetail('materials', d.materials.filter((x) => x.id !== item.id))}><Trash2 size={17} /></button></div>)}
              <button type="button" className="add-button" onClick={() => setDetail('materials', [...d.materials, { id: createId(), name: '', loaded: false }])}><Plus size={16} /> Afegir material</button>
            </div>
          </section>

          <section className="form-card">
            <div className="section-heading"><span className="section-index">08</span><div><h2>Actuació i acreditacions</h2><p>Allò que cal tenir a mà el dia del concert.</p></div></div>
            <div className="fields"><label className="field">Setlist <textarea rows={5} value={d.setlist} onChange={(e) => setDetail('setlist', e.target.value)} placeholder="Una cançó per línia" /></label><label className="field">Invitacions i passis <textarea rows={2} value={d.passes} onChange={(e) => setDetail('passes', e.target.value)} /></label></div>
          </section>

          <section className="form-card">
            <div className="section-heading"><span className="section-index">09</span><div><h2>Tancament</h2><p>Imports de resum d'aquest concert.</p></div></div>
            <div className="fields two-col"><label className="field">Catxet cobrat (€) <input type="number" min="0" step="0.01" value={concert.feePaid} onChange={(e) => setField('feePaid', Number(e.target.value))} /></label><label className="field">Vendes de merxandatge (€) <input type="number" min="0" step="0.01" value={d.merchSales} onChange={(e) => setDetail('merchSales', Number(e.target.value))} /></label><label className="field">Despeses (€) <input type="number" min="0" step="0.01" value={d.expenses} onChange={(e) => setDetail('expenses', Number(e.target.value))} /></label><label className="field field-span">Notes i incidències <textarea rows={3} value={d.notes} onChange={(e) => setDetail('notes', e.target.value)} /></label></div>
          </section>
        </div>
        <div className="form-actions">{error ? <p className="form-error" role="alert">{error}</p> : null}<button type="button" className="button button-secondary" onClick={onCancel}>Cancel·lar</button><button type="submit" className="button button-primary" disabled={saving}>{saving ? 'Desant…' : 'Desar concert'}</button></div>
      </form>
    </div>
  )
}
