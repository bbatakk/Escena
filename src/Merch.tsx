import { useEffect, useState, type FormEvent } from 'react'
import { Archive, Box, Plus, ShoppingBag, Trash2 } from 'lucide-react'
import { deleteMerchSale, listMerchProducts, listMerchSales, saveMerchProduct, saveMerchSale } from './data'
import { createId, formatMoney, type Concert, type MerchProduct, type MerchSale } from './model'

export default function Merch({ concerts }: { concerts: Concert[] }) {
  const [products, setProducts] = useState<MerchProduct[]>([])
  const [sales, setSales] = useState<MerchSale[]>([])
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [stock, setStock] = useState('')
  const [productId, setProductId] = useState('')
  const [concertId, setConcertId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [saleNote, setSaleNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { let active = true; Promise.all([listMerchProducts(), listMerchSales()]).then(([items, entries]) => { if (active) { setProducts(items); setSales(entries) } }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'No s’ha pogut carregar el marxandatge.') }).finally(() => { if (active) setLoading(false) }); return () => { active = false } }, [])

  async function addProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('')
    try { const saved = await saveMerchProduct({ id: createId(), name: name.trim(), price: Number(price), stock: Number(stock), active: true }); setProducts((previous) => [...previous, saved]); setName(''); setPrice(''); setStock('') }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No s’ha pogut afegir el producte.') } finally { setBusy(false) }
  }

  async function addSale(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const product = products.find((item) => item.id === productId); const amount = Number(quantity)
    if (!product || !concertId || !amount || amount < 1) { setError('Tria un producte, un concert i una quantitat.'); return }
    const sold = sales.filter((item) => item.productId === product.id).reduce((sum, item) => sum + item.quantity, 0)
    if (sold + amount > product.stock) { setError(`No hi ha prou estoc de ${product.name}.`); return }
    setBusy(true); setError('')
    try { const saved = await saveMerchSale({ id: createId(), concertId, productId, quantity: amount, unitPrice: product.price, note: saleNote.trim() }); setSales((previous) => [saved, ...previous]); setQuantity('1'); setSaleNote('') }
    catch (cause) { setError(cause instanceof Error ? cause.message.replace('Producte de marxandatge no trobat', 'No s’ha trobat el producte.').replace('No hi ha prou estoc disponible', 'No hi ha prou estoc disponible.') : 'No s’ha pogut registrar la venda.') } finally { setBusy(false) }
  }

  async function removeSale(sale: MerchSale) { if (!window.confirm('Vols eliminar aquesta venda?')) return; try { await deleteMerchSale(sale.id); setSales((previous) => previous.filter((item) => item.id !== sale.id)) } catch (cause) { setError(cause instanceof Error ? cause.message : 'No s’ha pogut eliminar la venda.') } }
  const soldFor = (id: string) => sales.filter((item) => item.productId === id).reduce((sum, item) => sum + item.quantity, 0)
  const concertName = (id: string) => concerts.find((item) => item.id === id)?.title || 'Concert eliminat'
  const total = sales.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)

  return <div className="merch-shell"><div className="page-heading merch-heading"><div><span className="eyebrow">ESTOC I VENDES</span><h1>Marxandatge<span className="heading-period">.</span></h1><p>Controla què porteu, què veneu i què queda després de cada concert.</p></div></div>
    <div className="merch-summary"><div><span className="eyebrow">VENDES REGISTRADES</span><strong>{formatMoney(total)}</strong></div><div><span className="eyebrow">PRODUCTES ACTIUS</span><strong>{products.filter((item) => item.active).length}</strong></div><div><span className="eyebrow">UNITATS VENUDES</span><strong>{sales.reduce((sum, item) => sum + item.quantity, 0)}</strong></div></div>
    <div className="merch-layout"><section className="form-card"><div className="section-heading"><span className="section-index"><Box size={16} /></span><div><h2>Productes i estoc</h2><p>Indica l'estoc total disponible per a la gira.</p></div></div><form className="fields" onSubmit={(event) => void addProduct(event)}><label className="field">Producte <input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Samarreta, CD, adhesiu…" /></label><div className="two-col"><label className="field">Preu (€) <input required type="number" min="0" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} /></label><label className="field">Unitats <input required type="number" min="0" step="1" value={stock} onChange={(event) => setStock(event.target.value)} /></label></div><button className="button button-primary" type="submit" disabled={busy}><Plus size={16} /> Afegir producte</button></form><div className="product-list">{products.map((product) => <div className="product-row" key={product.id}><span className="product-icon"><ShoppingBag size={16} /></span><div><strong>{product.name}</strong><small>{formatMoney(product.price)} · {Math.max(product.stock - soldFor(product.id), 0)} disponibles de {product.stock}</small></div></div>)}{!products.length && !loading ? <p className="section-empty">Encara no hi ha productes.</p> : null}</div></section>
      <section className="form-card"><div className="section-heading"><span className="section-index"><ShoppingBag size={16} /></span><div><h2>Registrar una venda</h2><p>La venda queda vinculada al concert i descompta l'estoc disponible.</p></div></div><form className="fields" onSubmit={(event) => void addSale(event)}><label className="field">Concert <select required value={concertId} onChange={(event) => setConcertId(event.target.value)}><option value="">Tria un concert…</option>{concerts.map((concert) => <option key={concert.id} value={concert.id}>{concert.title}</option>)}</select></label><label className="field">Producte <select required value={productId} onChange={(event) => setProductId(event.target.value)}><option value="">Tria un producte…</option>{products.filter((item) => item.active).map((product) => <option key={product.id} value={product.id}>{product.name} · {formatMoney(product.price)}</option>)}</select></label><div className="two-col"><label className="field">Quantitat <input required type="number" min="1" step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label><label className="field">Nota <input value={saleNote} onChange={(event) => setSaleNote(event.target.value)} placeholder="Opcional" /></label></div><button className="button button-primary" type="submit" disabled={busy}>Registrar venda</button></form></section></div>
    <section className="merch-sales"><div className="money-list-head"><span className="eyebrow">VENDES RECENTS · {sales.length}</span></div>{sales.length ? sales.map((sale) => { const product = products.find((item) => item.id === sale.productId); return <div className="money-row" key={sale.id}><span className="money-icon ingres"><ShoppingBag size={16} /></span><div className="money-row-main"><strong>{sale.quantity} × {product?.name || 'Producte eliminat'}</strong><small>{concertName(sale.concertId)}{sale.note ? ` · ${sale.note}` : ''}</small></div><strong className="positive-money">+{formatMoney(sale.quantity * sale.unitPrice)}</strong><button className="icon-button" type="button" aria-label="Eliminar venda" onClick={() => void removeSale(sale)}><Trash2 size={15} /></button></div> }) : <div className="empty-list"><Archive size={25} /><h3>Encara no hi ha vendes</h3><p>Registra la primera venda de marxandatge després d'un concert.</p></div>}</section>{error ? <div className="global-error" role="alert">{error}</div> : null}
  </div>
}
