import { useEffect, useState, type FormEvent } from 'react'
import { ArrowDownLeft, ArrowUpRight, Pencil, Plus, Trash2, X } from 'lucide-react'
import { deleteMoneyMovement, listMerchSales, listMoneyMovements, saveMoneyMovement } from './data'
import { createId, formatDate, formatMoney, generatedTreasuryMovements, moneyMovementBalance, type Concert, type LabelAgreement, type MerchSale, type MoneyMovement, type MoneyMovementKind, type MoneyMovementPaymentMethod } from './model'

function today(): string { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}` }

export default function Treasury({ concerts, labelAgreement }: { concerts: Concert[]; labelAgreement: LabelAgreement | null }) {
  const [movements, setMovements] = useState<MoneyMovement[]>([])
  const [merchSales, setMerchSales] = useState<MerchSale[]>([])
  const [kind, setKind] = useState<MoneyMovementKind>('ingres')
  const [paymentMethod, setPaymentMethod] = useState<MoneyMovementPaymentMethod>('bank')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(today())
  const [category, setCategory] = useState('')
  const [note, setNote] = useState('')
  const [concertId, setConcertId] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const load = () => {
      void Promise.all([listMoneyMovements(), listMerchSales()]).then(([items, sales]) => {
        if (!active) return
        const sources = new Set(items.filter((item) => item.sourceType && item.sourceId).map((item) => `${item.sourceType}:${item.sourceId}`))
        const manualExpenseConcerts = new Set(items.filter((item) => item.kind === 'despesa' && !item.sourceType && item.concertId).map((item) => item.concertId))
        const projected = generatedTreasuryMovements(concerts, labelAgreement, sales).filter((item) => !(item.sourceType === 'concert_expense' && item.sourceId && manualExpenseConcerts.has(item.sourceId)) && (!item.sourceType || !item.sourceId || !sources.has(`${item.sourceType}:${item.sourceId}`)))
        setMovements([...projected, ...items]); setMerchSales(sales)
      }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'No s’han pogut carregar els moviments.') }).finally(() => { if (active) setLoading(false) })
    }
    load(); window.addEventListener('escena:offline-queue-change', load)
    return () => { active = false; window.removeEventListener('escena:offline-queue-change', load) }
  }, [concerts, labelAgreement])

  function resetForm() { setEditingId(null); setKind('ingres'); setPaymentMethod('bank'); setAmount(''); setDate(today()); setCategory(''); setNote(''); setConcertId('') }

  function edit(item: MoneyMovement) {
    if (item.sourceType) return
    setEditingId(item.id); setKind(item.kind); setPaymentMethod(item.paymentMethod === 'cash' ? 'cash' : 'bank'); setAmount(String(item.amount)); setDate(item.date); setCategory(item.category); setNote(item.note); setConcertId(item.concertId || ''); setError('')
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const numericAmount = Number(amount)
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) { setError('Indica un import superior a zero.'); return }
    setBusy(true); setError('')
    try {
      const saved = await saveMoneyMovement({ id: editingId || createId(), kind, paymentMethod, amount: numericAmount, date, category: category.trim() || (kind === 'ingres' ? 'Altres ingressos' : 'Altres despeses'), note: note.trim(), concertId: concertId || undefined })
      setMovements((previous) => editingId ? previous.map((item) => item.id === saved.id ? saved : item) : [saved, ...previous])
      resetForm()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No s’ha pogut desar el moviment.') }
    finally { setBusy(false) }
  }

  async function remove(id: string) {
    if (movements.find((item) => item.id === id)?.sourceType) { setError('Aquest moviment es genera automàticament i no es pot eliminar manualment.'); return }
    if (!window.confirm('Vols eliminar aquest moviment?')) return
    setBusy(true); setError('')
    try { await deleteMoneyMovement(id); setMovements((previous) => previous.filter((item) => item.id !== id)); if (editingId === id) resetForm() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No s’ha pogut eliminar el moviment.') }
    finally { setBusy(false) }
  }

  const recordedSources = new Set(movements.filter((item) => item.sourceType && item.sourceId).map((item) => `${item.sourceType}:${item.sourceId}`))
  const manualExpenseConcerts = new Set(movements.filter((item) => item.kind === 'despesa' && !item.sourceType && item.concertId).map((item) => item.concertId))
  const automaticMovements = generatedTreasuryMovements(concerts, labelAgreement, merchSales).filter((item) => !(item.sourceType === 'concert_expense' && item.sourceId && manualExpenseConcerts.has(item.sourceId)) && (!item.sourceType || !item.sourceId || !recordedSources.has(`${item.sourceType}:${item.sourceId}`)))
  const displayedMovements = [...automaticMovements, ...movements]
  const totalIncome = displayedMovements.filter((item) => item.kind === 'ingres').reduce((sum, item) => sum + item.amount, 0)
  const expenses = displayedMovements.filter((item) => item.kind === 'despesa').reduce((sum, item) => sum + item.amount, 0)
  const bankBalance = moneyMovementBalance(displayedMovements, 'bank')
  const cashBalance = moneyMovementBalance(displayedMovements, 'cash')
  const concertName = (id?: string) => id ? concerts.find((item) => item.id === id)?.title || 'Concert eliminat' : 'General'

  return <div className="treasury-shell">
    <div className="page-heading treasury-heading"><div><span className="eyebrow">CONTROL INTERN</span><h1>Tresoreria<span className="heading-period">.</span></h1><p>Registra els diners que entren i surten de la banda, amb o sense concert.</p></div></div>
    <div className="money-summary"><div><span className="eyebrow">BALANÇ TOTAL</span><strong className={totalIncome - expenses >= 0 ? 'positive-money' : 'negative-money'}>{formatMoney(totalIncome - expenses)}</strong><small className="summary-note">Ingressos registrats menys despeses</small></div><div><span className="eyebrow">COMPTE BANCARI</span><strong className={bankBalance >= 0 ? 'positive-money' : 'negative-money'}>{formatMoney(bankBalance)}</strong></div><div><span className="eyebrow">EFECTIU</span><strong className={cashBalance >= 0 ? 'positive-money' : 'negative-money'}>{formatMoney(cashBalance)}</strong></div><div><span className="eyebrow">INGRESSOS TOTALS</span><strong className="positive-money">{formatMoney(totalIncome)}</strong></div><div><span className="eyebrow">DESPESES</span><strong className="negative-money">{formatMoney(expenses)}</strong></div></div>
    <div className="treasury-layout">
      <section className="form-card money-add"><div className="section-heading"><span className="section-index">{editingId ? <Pencil size={16} /> : <Plus size={17} />}</span><div><h2>{editingId ? 'Editar moviment' : 'Nou moviment'}</h2><p>Un apunt real, no un resum automàtic.</p></div></div>
        <form className="fields" onSubmit={(event) => void save(event)}><div className="money-kind"><button type="button" className={kind === 'ingres' ? 'kind-active income-kind' : ''} onClick={() => setKind('ingres')}><ArrowDownLeft size={16} /> Ingrés</button><button type="button" className={kind === 'despesa' ? 'kind-active expense-kind' : ''} onClick={() => setKind('despesa')}><ArrowUpRight size={16} /> Despesa</button></div><label className="field">Import (€) <input required type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0,00" /></label><label className="field">Compte <select required value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as MoneyMovementPaymentMethod)}><option value="bank">Compte bancari</option><option value="cash">Efectiu</option></select></label><div className="two-col"><label className="field">Data <input required type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label><label className="field">Categoria <input value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Catxet, gasolina…" /></label></div><label className="field">Concert (opcional) <select value={concertId} onChange={(event) => setConcertId(event.target.value)}><option value="">Moviment general</option>{concerts.map((concert) => <option key={concert.id} value={concert.id}>{concert.title || 'Concert sense nom'}</option>)}</select></label><label className="field">Nota <textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Informació útil per revisar-ho més endavant" /></label><button className="button button-primary" type="submit" disabled={busy}>{editingId ? 'Desar canvis' : 'Afegir moviment'}</button>{editingId ? <button className="button button-secondary" type="button" disabled={busy} onClick={resetForm}><X size={15} /> Cancel·lar</button> : null}</form>
      </section>
      <section className="money-list"><div className="money-list-head"><span className="eyebrow">MOVIMENTS · {displayedMovements.length}</span></div>{loading ? <p className="section-empty">Carregant moviments…</p> : displayedMovements.length ? displayedMovements.map((item) => <article className="money-row" key={`${item.sourceType || 'manual'}-${item.id}`}><div className={`money-icon ${item.kind}`} aria-hidden="true">{item.kind === 'ingres' ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}</div><div className="money-row-main"><strong>{item.category || (item.kind === 'ingres' ? 'Ingrés' : 'Despesa')}</strong><small>{item.paymentMethod === 'cash' ? 'Efectiu' : 'Compte bancari'} · {formatDate(item.date)} · {concertName(item.concertId)}{item.note ? ` · ${item.note}` : ''}</small></div><strong className={item.kind === 'ingres' ? 'positive-money' : 'negative-money'}>{item.kind === 'ingres' ? '+' : '−'}{formatMoney(item.amount)}</strong>{item.sourceType ? <span className="money-auto-label">Generat</span> : <div className="resource-row-actions"><button className="icon-button" type="button" disabled={busy} aria-label={`Editar moviment ${item.category}`} title="Editar moviment" onClick={() => edit(item)}><Pencil size={14} /></button><button className="icon-button" type="button" disabled={busy} aria-label={`Eliminar moviment ${item.category}`} title="Eliminar moviment" onClick={() => void remove(item.id)}><Trash2 size={14} /></button></div>}</article>) : <p className="section-empty">Encara no hi ha moviments de tresoreria.</p>}</section>
    </div>{error ? <div className="global-error" role="alert">{error}</div> : null}
  </div>
}
