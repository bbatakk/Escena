import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import PersonFeeEditor from './PersonFeeEditor'
import { createId, formatMoney, settleTeamFeeWithManager, teamFeeSummary, type BandPerson, type Concert, type ConcertTeamFee } from './model'

export function TeamFeesClosing({ concert, onChange }: { concert: Concert; onChange: (fees: ConcertTeamFee[]) => void }) {
  const summary = teamFeeSummary(concert)
  const [date, setDate] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  })
  if (!summary.rows.length) return null
  const pending = summary.rows.filter((fee) => fee.remaining !== null && fee.remaining > 0)
  return <div className="team-fees-closing">
    <h3>Honoraris al tancament</h3>
    <p className="label-concert-note">Si {concert.details.labelAgreement?.name || 'el gestor'} paga l’equip i en descompta els honoraris, registra’ls aquí abans de desar. Tresoreria rebrà el catxet menys la comissió i aquests honoraris. Els imports previstos encara no liquidats no es resten del saldo.</p>
    {pending.length ? <>
      <label className="field">Data de la liquidació d’honoraris<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
      {pending.map((fee) => <div className="team-fee-summary" key={fee.personId}>
        <strong>{fee.name} · {formatMoney(fee.remaining!)} pendents</strong>
        <button type="button" className="button button-secondary" disabled={!date || concert.feePaid <= 0} onClick={() => onChange(settleTeamFeeWithManager(concert, fee.personId, date))}>Descomptar {formatMoney(fee.remaining!)} del cobrament</button>
      </div>)}
      {concert.feePaid <= 0 ? <p className="label-concert-note">Indica el catxet brut cobrat per registrar el descompte.</p> : null}
    </> : null}
    {summary.unresolved ? <p className="label-concert-note">Hi ha honoraris per concretar: ajusta’n el tram o l’import a «Honoraris de l’equip».</p> : null}
    <p className="label-concert-note" role="status">Descomptat pel gestor: {formatMoney(summary.managerPaid)} · Pagat per la banda: {formatMoney(summary.bandPaid)}. Pots revisar o corregir les liquidacions a «Honoraris de l’equip».</p>
  </div>
}

export function TeamFeesSummary({ concert }: { concert: Concert }) {
  const summary = teamFeeSummary(concert)
  if (!summary.rows.length) return null
  return <div className="team-fees-summary">
    {summary.rows.map((fee) => <div className="team-fee-summary" key={fee.personId}>
      <strong>{fee.name}</strong>
      <span>{fee.amount === null ? 'Import per concretar' : `${formatMoney(fee.amount)} ${concert.details.finalFee === undefined ? 'previstos' : 'pactats'}`}</span>
      <small>Liquidat: {formatMoney(fee.paid)}{fee.remaining === null ? '' : fee.remaining < 0 ? ` · ${formatMoney(-fee.remaining)} pagats de més` : ` · Pendent: ${formatMoney(fee.remaining)}`}</small>
    </div>)}
    <p className="label-concert-note">Pagat per la banda: {formatMoney(summary.bandPaid)} · Descomptat pel gestor: {formatMoney(summary.managerPaid)}.</p>
  </div>
}

export default function ConcertTeamFees({ concert, people, onChange }: { concert: Concert; people: BandPerson[]; onChange: (fees: ConcertTeamFee[]) => void }) {
  const fees = concert.details.teamFees ?? []
  const candidates = people.filter((person) => concert.details.personIds.includes(person.id) && !fees.some((fee) => fee.personId === person.id))
  function update(personId: string, changes: Partial<ConcertTeamFee>) { onChange(fees.map((fee) => fee.personId === personId ? { ...fee, ...changes } : fee)) }
  return <section className="form-card wide-card team-fees-card">
    <div className="section-heading"><div><h2>Honoraris de l’equip</h2><p>Condicions copiades per a aquest concert. Els pagaments es registren quan es liquiden; no els tornis a sumar a «Despeses».</p></div></div>
    {candidates.length ? <label className="field">Afegir honoraris puntuals <select value="" onChange={(event) => {
      const person = candidates.find((item) => item.id === event.target.value)
      if (person) onChange([...fees, { personId: person.id, name: person.name, agreement: { kind: 'fixed', amount: 0 }, payments: [] }])
    }}><option value="">Tria una persona que hi va…</option>{candidates.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label> : null}
    {!fees.length ? <p className="section-empty">Sense honoraris configurats per a aquest concert.</p> : null}
    {fees.map((fee) => <div className="team-fee-entry" key={fee.personId}>
      <div className="team-fee-heading"><h3>{fee.name}</h3><button type="button" className="icon-button danger-icon" disabled={fee.payments.length > 0} aria-label={`Treure honoraris de ${fee.name}`} title={fee.payments.length ? 'Conserva els pagaments registrats' : 'Treure honoraris'} onClick={() => onChange(fees.filter((item) => item.personId !== fee.personId))}><Trash2 size={16} /></button></div>
      {!concert.details.personIds.includes(fee.personId) ? <p className="label-concert-note">Ja no està seleccionada a «Qui hi va»; es conserven les condicions i els pagaments registrats.</p> : null}
      <PersonFeeEditor value={fee.agreement} onChange={(agreement) => update(fee.personId, { agreement })} />
      <h4>Liquidacions registrades</h4>
      {fee.payments.map((payment) => <div className="team-payment-row" key={payment.id}>
        <label className="field">Import (€)<input required type="number" min="0.01" step="0.01" value={payment.amount} onChange={(event) => update(fee.personId, { payments: fee.payments.map((item) => item.id === payment.id ? { ...item, amount: Number(event.target.value) } : item) })} /></label>
        <label className="field">Data<input required type="date" value={payment.date} onChange={(event) => update(fee.personId, { payments: fee.payments.map((item) => item.id === payment.id ? { ...item, date: event.target.value } : item) })} /></label>
        <label className="field">Liquidat per<select value={payment.payer} onChange={(event) => update(fee.personId, { payments: fee.payments.map((item) => item.id === payment.id ? { ...item, payer: event.target.value as 'band' | 'manager' } : item) })}><option value="band">La banda</option><option value="manager">Gestor (descomptat del cobrament)</option></select></label>
        {payment.payer === 'band' ? <label className="field">Compte<select value={payment.paymentMethod} onChange={(event) => update(fee.personId, { payments: fee.payments.map((item) => item.id === payment.id ? { ...item, paymentMethod: event.target.value as 'bank' | 'cash' } : item) })}><option value="bank">Compte bancari</option><option value="cash">Efectiu</option></select></label> : null}
        <button type="button" className="icon-button danger-icon" aria-label={`Eliminar liquidació de ${fee.name}`} onClick={() => { if (window.confirm('Vols eliminar aquest registre de liquidació? Només fes-ho per corregir una entrada errònia.')) update(fee.personId, { payments: fee.payments.filter((item) => item.id !== payment.id) }) }}><Trash2 size={16} /></button>
      </div>)}
      <button type="button" className="add-button" onClick={() => update(fee.personId, { payments: [...fee.payments, { id: createId(), amount: 0, date: new Date().toISOString().slice(0, 10), payer: 'band', paymentMethod: 'bank' }] })}><Plus size={15} /> Registrar liquidació</button>
    </div>)}
    <TeamFeesSummary concert={concert} />
  </section>
}
