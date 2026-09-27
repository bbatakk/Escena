import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { Archive, Box, ImagePlus, Pencil, Plus, Search, ShoppingBag, Trash2 } from 'lucide-react'
import { cloudConfigured, listMerchProducts, listMerchSales, removeMerchProductImage, saveMerchProduct, uploadMerchProductImage } from './data'
import { createId, formatMoney, merchRevenueByConcert, totalMerchRevenue, type Concert, type MerchProduct, type MerchSale, type MerchSizeVariant } from './model'

const maxSourceImageBytes = 12 * 1024 * 1024

async function prepareProductImage(file: File): Promise<{ file: File; dataUrl: string }> {
  if (!file.type.startsWith('image/')) throw new Error('Tria un fitxer d’imatge.')
  if (file.size > maxSourceImageBytes) throw new Error('La imatge original no pot superar els 12 MB.')
  const source = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = source
    await image.decode()
    const scale = Math.min(1, 1400 / Math.max(image.naturalWidth, image.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('El navegador no pot processar aquesta imatge.')
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('No s’ha pogut preparar la imatge.')), 'image/webp', 0.84))
    if (blob.size > 5 * 1024 * 1024) throw new Error('La imatge optimitzada supera els 5 MB.')
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onerror = () => reject(new Error('No s’ha pogut llegir la imatge.'))
      reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Format d’imatge no vàlid.'))
      reader.readAsDataURL(blob)
    })
    const extension = blob.type === 'image/webp' ? 'webp' : blob.type === 'image/png' ? 'png' : 'jpg'
    return { file: new File([blob], `producte.${extension}`, { type: blob.type }), dataUrl }
  } finally { URL.revokeObjectURL(source) }
}

export default function Merch({ concerts }: { concerts: Concert[] }) {
  const [products, setProducts] = useState<MerchProduct[]>([])
  const [sales, setSales] = useState<MerchSale[]>([])
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [stock, setStock] = useState('')
  const [sizes, setSizes] = useState<MerchSizeVariant[]>([])
  const [editing, setEditing] = useState<string | null>(null)
  const [newProductId, setNewProductId] = useState(() => createId())
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState('')
  const [removeImage, setRemoveImage] = useState(false)
  const [imageProcessing, setImageProcessing] = useState(false)
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const load = () => {
      void Promise.all([listMerchProducts(), listMerchSales()]).then(([items, entries]) => {
        if (active) { setProducts(items); setSales(entries) }
      }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'No s’ha pogut carregar el marxandatge.') })
        .finally(() => { if (active) setLoading(false) })
    }
    load()
    window.addEventListener('escena:offline-queue-change', load)
    return () => { active = false; window.removeEventListener('escena:offline-queue-change', load) }
  }, [])

  const soldFor = (id: string) => sales.filter((item) => item.productId === id).reduce((sum, item) => sum + item.quantity, 0)
  const revenueByConcert = merchRevenueByConcert(concerts, sales)
  const units = sales.reduce((sum, item) => sum + item.quantity, 0)
  const concertName = (id: string) => concerts.find((item) => item.id === id)?.title || 'Concert eliminat'
  const productSales = (id: string) => sales.filter((item) => item.productId === id).reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
  const concertTotals = Array.from(revenueByConcert.entries()).map(([id, total]) => {
    const entries = sales.filter((item) => item.concertId === id)
    return { id, name: concertName(id), total, units: entries.reduce((sum, item) => sum + item.quantity, 0), legacy: !entries.length }
  }).sort((a, b) => b.total - a.total)
  const total = totalMerchRevenue(concerts, sales)
  const activeProducts = products.filter((item) => item.active)
  const archivedProducts = products.filter((item) => !item.active)
  const visibleProducts = activeProducts.filter((item) => item.name.toLocaleLowerCase('ca').includes(search.toLocaleLowerCase('ca')))

  function resetForm() {
    setEditing(null); setNewProductId(createId()); setName(''); setPrice(''); setStock(''); setSizes([])
    setImageFile(null); setImagePreview(''); setRemoveImage(false)
  }

  function startEdit(product: MerchProduct) {
    setEditing(product.id); setNewProductId(product.id); setName(product.name); setPrice(String(product.price)); setStock(String(product.stock)); setSizes(product.sizes || [])
    setImageFile(null); setImagePreview(product.imageUrl || product.imageDataUrl || ''); setRemoveImage(false)
    window.requestAnimationFrame(() => document.querySelector('.merch-product-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  async function selectImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setImageProcessing(true); setError('')
    try {
      const prepared = await prepareProductImage(file)
      setImageFile(prepared.file); setImagePreview(prepared.dataUrl); setRemoveImage(false)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No s’ha pogut preparar la imatge.') }
    finally { setImageProcessing(false) }
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalizedSizes = sizes.map((item) => ({ name: item.name.trim(), stock: Math.max(0, Math.trunc(item.stock)) })).filter((item) => item.name)
    const existing = products.find((item) => item.id === editing)
    const previousSales = editing ? sales.filter((item) => item.productId === editing) : []
    if (sizes.some((item) => !item.name.trim() && item.stock > 0)) { setError('Posa un nom a cada talla que tingui estoc.'); return }
    if (normalizedSizes.some((item, index) => normalizedSizes.findIndex((other) => other.name.toLocaleLowerCase('ca') === item.name.toLocaleLowerCase('ca')) !== index)) { setError('No pots repetir una talla.'); return }
    if (normalizedSizes.length && !existing?.sizes?.length && previousSales.some((item) => !item.size)) { setError('Aquest producte ja té vendes sense talla. Crea un producte nou per començar-ne el seguiment per talles.'); return }
    if (normalizedSizes.length && previousSales.some((sale) => sale.size && !normalizedSizes.some((item) => item.name.toLocaleLowerCase('ca') === sale.size?.toLocaleLowerCase('ca')))) { setError('No pots treure una talla que ja té vendes registrades.'); return }
    const sold = previousSales.reduce((sum, item) => sum + item.quantity, 0)
    const soldBySize = (size: string) => previousSales.filter((item) => item.size?.toLocaleLowerCase('ca') === size.toLocaleLowerCase('ca')).reduce((sum, item) => sum + item.quantity, 0)
    const totalStock = normalizedSizes.length ? normalizedSizes.reduce((sum, item) => sum + item.stock, 0) : Math.max(0, Math.trunc(Number(stock)))
    if (normalizedSizes.length ? normalizedSizes.some((item) => item.stock < soldBySize(item.name)) : totalStock < sold) { setError('L’estoc no pot ser inferior a les unitats ja venudes.'); return }
    if (cloudConfigured && !navigator.onLine && (imageFile || removeImage)) { setError('Connecta’t a internet per canviar la imatge del producte.'); return }

    setBusy(true); setError('')
    const id = editing || newProductId
    let saved: MerchProduct | null = null
    try {
      if (removeImage && cloudConfigured && existing?.imagePath) await removeMerchProductImage(id)
      saved = await saveMerchProduct({
        id, name: name.trim(), price: Number(price), stock: totalStock, active: true, sizes: normalizedSizes,
        imagePath: removeImage ? undefined : existing?.imagePath,
        imageDataUrl: cloudConfigured ? undefined : removeImage ? undefined : imagePreview || undefined,
        imageUrl: cloudConfigured && !removeImage ? existing?.imageUrl : undefined,
      })
      if (imageFile && cloudConfigured) saved = await uploadMerchProductImage(id, imageFile)
      setProducts((items) => [...items.filter((item) => item.id !== saved!.id), saved!])
      resetForm()
    } catch (cause) {
      if (saved) setProducts((items) => [...items.filter((item) => item.id !== saved!.id), saved!])
      setError(cause instanceof Error ? cause.message : 'No s’ha pogut desar el producte.')
    } finally { setBusy(false) }
  }

  async function archive(product: MerchProduct) {
    if (!window.confirm(`Vols arxivar «${product.name}»?`)) return
    setBusy(true); setError('')
    try { const saved = await saveMerchProduct({ ...product, active: false }); setProducts((items) => items.map((item) => item.id === saved.id ? saved : item)) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No s’ha pogut arxivar el producte.') }
    finally { setBusy(false) }
  }

  function productStock(product: MerchProduct) {
    if (!product.sizes?.length) return `${Math.max(product.stock - soldFor(product.id), 0)} disponibles de ${product.stock}`
    const remaining = product.sizes.reduce((sum, size) => sum + Math.max(size.stock - sales.filter((sale) => sale.productId === product.id && sale.size === size.name).reduce((total, sale) => total + sale.quantity, 0), 0), 0)
    return `${remaining} disponibles · ${product.sizes.length} talles`
  }

  return <div className="merch-shell">
    <div className="page-heading merch-heading"><div><span className="eyebrow">CATÀLEG I ESTOC</span><h1>Marxandatge<span className="heading-period">.</span></h1><p>Els productes de la banda, amb estoc i imatge a primera vista.</p></div></div>
    <section className="merch-catalog-section" aria-labelledby="merch-catalog-title">
      <header className="merch-catalog-header"><div><span className="eyebrow">{activeProducts.length} PRODUCTES ACTIUS</span><h2 id="merch-catalog-title">Catàleg de marxandatge</h2></div><label className="search-box merch-catalog-search"><Search size={17} /><span className="sr-only">Cerca productes</span><input type="search" placeholder="Cerca un producte…" value={search} onChange={(event) => setSearch(event.target.value)} /></label><button type="button" className="button button-primary" onClick={() => { resetForm(); document.querySelector('.merch-product-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}><Plus size={16} /> Nou producte</button></header>
      {loading ? <p className="section-empty">Carregant productes…</p> : visibleProducts.length ? <div className="merch-product-grid">{visibleProducts.map((product) => <article className="merch-product-card" key={product.id}><div className="merch-product-image">{product.imageUrl || product.imageDataUrl ? <><div className="merch-image-placeholder"><ShoppingBag size={25} /><span>Sense imatge</span></div><img src={product.imageUrl || product.imageDataUrl} alt={product.name} loading="lazy" onError={(event) => { event.currentTarget.hidden = true }} /></> : <div className="merch-image-placeholder"><ShoppingBag size={25} /><span>Afegeix una imatge</span></div>}<div className="merch-product-card-actions"><button type="button" className="icon-button" aria-label={`Editar ${product.name}`} onClick={() => startEdit(product)}><Pencil size={15} /></button><button type="button" className="icon-button danger-icon" disabled={busy} aria-label={`Arxivar ${product.name}`} onClick={() => void archive(product)}><Archive size={15} /></button></div></div><div className="merch-product-card-body"><div className="merch-product-card-title"><h3>{product.name}</h3><strong>{formatMoney(product.price)}</strong></div><p className="merch-product-availability">{productStock(product)}</p>{product.sizes?.length ? <div className="catalog-size-list">{product.sizes.map((size) => { const sold = sales.filter((item) => item.productId === product.id && item.size === size.name).reduce((sum, item) => sum + item.quantity, 0); return <span key={size.name}>{size.name} · {Math.max(size.stock - sold, 0)}</span> })}</div> : null}<div className="merch-product-card-footer"><span>{soldFor(product.id)} venudes</span><strong>{formatMoney(productSales(product.id))}</strong></div><div className="stock-track"><span style={{ width: `${product.stock ? Math.min((soldFor(product.id) / product.stock) * 100, 100) : 0}%` }} /></div></div></article>)}</div> : <div className="merch-empty-catalog"><ShoppingBag size={28} /><h3>{search ? 'Cap producte trobat' : 'Encara no hi ha productes'}</h3><p>{search ? 'Prova amb un altre nom.' : 'Afegeix samarretes, discos o altres articles per controlar-ne l’estoc.'}</p></div>}
    </section>

    <div className="merch-secondary-summary"><div><span className="eyebrow">INGRESSOS REGISTRATS</span><strong>{formatMoney(total)}</strong></div><div><span className="eyebrow">UNITATS VENUDES</span><strong>{units}</strong></div></div>
    <div className="merch-management-layout"><section className="form-card merch-product-form"><div className="section-heading"><span className="section-index"><Box size={16} /></span><div><h2>{editing ? 'Editar producte' : 'Afegir producte'}</h2><p>Defineix el nom, el preu, l’estoc i la imatge.</p></div></div><form className="fields" onSubmit={(event) => void saveProduct(event)}><label className="field">Producte <input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Samarreta, CD, adhesiu…" /></label><div className="two-col"><label className="field">Preu (€) <input required type="number" min="0" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} /></label>{sizes.length === 0 ? <label className="field">Unitats <input required type="number" min="0" step="1" value={stock} onChange={(event) => setStock(event.target.value)} /></label> : <div className="size-stock-total"><span>Estoc total amb talles</span><strong>{sizes.reduce((sum, item) => sum + Math.max(0, Number(item.stock) || 0), 0)} unitats</strong></div>}</div><div className="product-image-editor"><span className="eyebrow">IMATGE DEL PRODUCTE</span><div className="product-image-editor-row"><div className="product-image-editor-preview">{imagePreview && !removeImage ? <img src={imagePreview} alt="Previsualització del producte" /> : <div className="merch-image-placeholder"><ShoppingBag size={23} /><span>Sense imatge</span></div>}</div><div className="product-image-editor-actions"><label className="button button-secondary"><ImagePlus size={15} /> {imageProcessing ? 'Preparant…' : imagePreview && !removeImage ? 'Canviar imatge' : 'Pujar imatge'}<input type="file" accept="image/*" disabled={busy || imageProcessing} onChange={(event) => void selectImage(event)} /></label>{imagePreview && !removeImage ? <button type="button" className="text-button danger-text" disabled={busy} onClick={() => { setRemoveImage(true); setImageFile(null) }}><Trash2 size={14} /> Treure imatge</button> : null}<small>WEBP, PNG o JPEG · Es redueix automàticament · Màxim 5 MB després de preparar-la</small></div></div></div><div className="size-editor"><div className="size-editor-heading"><div><strong>Talles i variants</strong><small>Opcional · cada talla té el seu propi estoc</small></div><button type="button" className="add-button" onClick={() => setSizes((items) => [...items, { name: '', stock: 0 }])}><Plus size={15} /> Afegir talla</button></div>{sizes.map((size, index) => <div className="size-editor-row" key={`${index}-${size.name}`}><input aria-label="Nom de la talla" value={size.name} onChange={(event) => setSizes((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))} placeholder="S, M, L, XL…" /><input aria-label={`Estoc talla ${size.name || index + 1}`} type="number" min="0" step="1" value={size.stock} onChange={(event) => setSizes((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, stock: Number(event.target.value) } : item))} /><button type="button" className="icon-button danger-icon" aria-label="Treure talla" onClick={() => setSizes((items) => items.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={15} /></button></div>)}</div><div className="product-form-actions"><button className="button button-primary" type="submit" disabled={busy || imageProcessing}><Plus size={16} /> {busy ? 'Desant…' : editing ? 'Desar canvis' : 'Afegir producte'}</button>{editing ? <button type="button" className="button button-secondary" onClick={resetForm}>Cancel·lar</button> : null}</div></form></section>
      <section className="form-card merch-archived"><div className="section-heading"><span className="section-index"><Archive size={16} /></span><div><h2>Productes arxivats</h2><p>Conserva l’historial dels articles que ja no ofereixes.</p></div></div><div className="archived-products">{archivedProducts.map((product) => <div className="archived-product-row" key={product.id}>{product.imageUrl || product.imageDataUrl ? <img src={product.imageUrl || product.imageDataUrl} alt="" /> : <span className="archived-product-placeholder"><ShoppingBag size={16} /></span>}<div><span>{product.name}</span><small>{formatMoney(product.price)} · {soldFor(product.id)} venudes</small></div></div>)}{!archivedProducts.length ? <p className="section-empty">No hi ha productes arxivats.</p> : null}</div></section></div>
    <section className="form-card merch-sales-by-concert"><div className="section-heading"><span className="section-index"><ShoppingBag size={16} /></span><div><h2>Vendes per concert</h2><p>Les línies individuals continuen a cada fitxa; aquí tens el total per concert.</p></div></div>{concertTotals.length ? <div className="concert-sales-summary">{concertTotals.map((item) => <div key={item.id}><div><strong>{item.name}</strong><small>{item.legacy ? 'Resum anterior · import antic' : `${item.units} unitats`}</small></div><strong>{formatMoney(item.total)}</strong></div>)}</div> : <p className="section-empty">Les vendes apareixeran aquí quan les registris des d’un concert.</p>}</section>
    {error ? <div className="global-error" role="alert">{error}</div> : null}
  </div>
}
