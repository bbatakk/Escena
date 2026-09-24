import { useEffect, useState, type FormEvent } from 'react'
import { ArrowDownLeft, ArrowUpRight, Plus, Trash2, Wallet } from 'lucide-react'
import { deleteMoneyMovement, listMerchSales, listMoneyMovements, saveMoneyMovement } from './data'
import { createId, formatDate, formatMoney, type Concert, type MoneyMovement, type MoneyMovementKind } from './model'

function today(): string { return new Date().toISOString().slice(0, 10) }

export default function Treasury({ concerts }: { concerts: Concert[] }) {
  const [movements, setMovements] = useState<MoneyMovement[]>([])
  const [merchTotal, setMerchTotal] = useState(0)
  const [kind, setKind] = useState<MoneyMovementKind>('ingres')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(today())
  const [category, setCategory] = useState('')
  const [note, setNote] = useState('')
  const [concertId, setConcertId] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { let active = true; Promise.all([listMoneyMovements(), listMerchSales()]).then(([items, sales]) => { if (active) { setMovements(items); setMerchTotal(sales.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)) } }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'No s’han pogut carregar els moviments.') }).finally(() => { if (active) setLoading(false) }); return () => { active = false } }, [])

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const numericAmount = Number(amount)
    if (!numericAmount || numericAmount < 0) { setError('Indica un import superior a zero.'); return }
    setBusy(true); setError('')
    try {
      const saved = await saveMoneyMovement({ id: createId(), kind, amount: numericAmount, date, category: category.trim() || (kind === 'ingres' ? 'Altres ingressos' : 'Altres despeses'), note: note.trim(), concertId: concertId || undefined })
      setMovements((previous) => [saved, ...previous]); setAmount(''); setCategory(''); setNote(''); setConcertId('')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No s’ha pogut desar el moviment.') }
    finally { setBusy(false) }
  }

  async function remove(id: string) {
    if (!window.confirm('Vols eliminar aquest moviment?')) return
    try { await deleteMoneyMovement(id); setMovements((previous) => previous.filter((item) => item.id !== id)) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No s’ha pogut eliminar el moviment.') }
  }

  const income = movements.filter((item) => item.kind === 'ingres').reduce((sum, item) => sum + item.amount, 0)
  const expenses = movements.filter((item) => item.kind === 'despesa').reduce((sum, item) => sum + item.amount, 0)
  const concertName = (id?: string) => id ? concerts.find((item) => item.id === id)?.title || 'Concert eliminat' : 'General'

  return <div className="treasury-shell"><div className="page-heading treasury-heading"><div><span className="eyebrow">CONTROL INTERN</span><h1>Tresoreria<span className="heading-period">.</span></h1><p>Registra els diners que entren i surten de la banda, amb o sense concert.</p></div></div>
    <div className="money-summary"><div><span className="eyebrow">BALANÇ REGISTRAT</span><strong className={income - expenses >= 0 ? 'positive-money' : 'negative-money'}>{formatMoney(income - expenses)}</strong><small className="summary-note">No inclou marxandatge per evitar duplicats</small></div><div><span className="eyebrow">INGRESSOS</span><strong className="positive-money">{formatMoney(income)}</strong></div><div><span className="eyebrow">DESPESES</span><strong className="negative-money">{formatMoney(expenses)}</strong></div></div>
    <div className="treasury-merch-note"><span className="eyebrow">MARXANDATGE REGISTRAT A PART</span><strong>{formatMoney(merchTotal)}</strong><span>Les vendes apareixen a Marxandatge i no entren automàticament al balanç de Tresoreria.</span></div>
    <div className="treasury-layout"><section className="form-card money-add"><div className="section-heading"><span className="section-index"><Plus size={17} /></span><div><h2>Nou moviment</h2><p>Un apunt real, no un resum automàtic.</p></div></div><form className="fields" onSubmit={(event) => void add(event)}><div className="money-kind"><button type="button" className={kind === 'ingres' ? 'kind-active income-kind' : ''} onClick={() => setKind('ingres')}><ArrowDownLeft size={16} /> Ingrés</button><button type="button" className={kind === 'despesa' ? 'kind-active expense-kind' : ''} onClick={() => setKind('despesa')}><ArrowUpRight size={16} /> Despesa</button></div><label className="field">Import (€) <input required type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0,00" /></label><div className="two-col"><label className="field">Data <input required type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label><label className="field">Categoria <input value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Catxet, gasolina…" /></label></div><label className="field">Concert (opcional) <select value={concertId} onChange={(event) => setConcertId(event.target.value)}><option value="">Moviment general</option>{concerts.map((concert) => <option key={concert.id} value={concert.id}>{concert.title || 'Concert sense nom'}</option>)}</select></label><label className="field">Nota <textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Informació útil per revisar-ho més endavant" /></label><button className="button button-primary" type="submit" disabled={busy}>Afegir moviment</button></form></section><section className="money-list"><div className="money-list-head"><span className="eyebrow">MOVIMENTS · {movements.length}</span></div>{loading ? <p className="section-empty">Carregant moviments…</p> : movements.length ? movements.map((item) => <div className="money-row" key={item.id}><span className={`money-icon ${item.kind}`} >{item.kind === 'ingres' ? <ArrowDownLeft size={17} /> : <ArrowUpRight size={17} />}</span><div className="money-row-main"><strong>{item.category}</strong><small>{formatDate(item.date)} · {concertName(item.concertId)}{item.note ? ` · ${item.note}` : ''}</small></div><strong className={item.kind === 'ingres' ? 'positive-money' : 'negative-money'}>{item.kind === 'ingres' ? '+' : '-'}{formatMoney(item.amount)}</strong><button className="icon-button" type="button" aria-label="Eliminar moviment" onClick={() => void remove(item.id)}><Trash2 size={15} /></button></div>) : <div className="empty-list"><Wallet size={25} /><h3>Encara no hi ha moviments</h3><p>Comença registrant un cobrament o una despesa.</p></div>}</section></div>{error ? <div className="global-error" role="alert">{error}</div> : null}</div>
}
