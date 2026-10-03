import { Plus, Trash2 } from 'lucide-react'
import type { PersonFeeAgreement } from './model'

export default function PersonFeeEditor({ value, onChange }: { value?: PersonFeeAgreement; onChange: (value?: PersonFeeAgreement) => void }) {
  return <div className="fields person-fee-editor">
    <label className="field">Honoraris <select value={value?.kind || 'none'} onChange={(event) => onChange(event.target.value === 'fixed' ? { kind: 'fixed', amount: 0 } : event.target.value === 'tiers' ? { kind: 'tiers', tiers: [{ from: 0, amount: 0 }] } : undefined)}>
      <option value="none">Sense honoraris configurats</option><option value="fixed">Import fix</option><option value="tiers">Import fix per trams</option>
    </select></label>
    {value?.kind === 'fixed' ? <label className="field">Import per concert (€) <input type="number" required min="0" step="0.01" value={value.amount} onChange={(event) => onChange({ kind: 'fixed', amount: Number(event.target.value) })} /></label> : null}
    {value?.kind === 'tiers' ? <>
      <p className="label-concert-note">Sobre el catxet final brut, o l’acordat mentre no es concreti. S’aplica el tram més alt assolit, inclòs el llindar. Per sota del primer tram cal pactar un import.</p>
      {value.tiers.map((tier, index) => <div className="label-tier-row" key={index}>
        <label className="field">A partir de (€) <input type="number" required min="0" step="0.01" value={tier.from} onChange={(event) => onChange({ ...value, tiers: value.tiers.map((item, i) => i === index ? { ...item, from: Number(event.target.value) } : item) })} /></label>
        <label className="field">Honoraris (€) <input type="number" required min="0" step="0.01" value={tier.amount} onChange={(event) => onChange({ ...value, tiers: value.tiers.map((item, i) => i === index ? { ...item, amount: Number(event.target.value) } : item) })} /></label>
        <button type="button" className="icon-button danger-icon" disabled={value.tiers.length === 1} aria-label={`Eliminar tram ${index + 1}`} onClick={() => onChange({ ...value, tiers: value.tiers.filter((_, i) => i !== index) })}><Trash2 size={15} /></button>
      </div>)}
      <button type="button" className="add-button" disabled={value.tiers.length >= 20} onClick={() => onChange({ ...value, tiers: [...value.tiers, { from: (value.tiers.at(-1)?.from || 0) + 500, amount: 0 }] })}><Plus size={15} /> Afegir tram</button>
    </> : null}
  </div>
}
