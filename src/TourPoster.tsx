import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Download, ImagePlus, RotateCcw, X } from 'lucide-react'
import { posterConcerts, type Concert } from './model'
import { defaultPosterDesign, drawPoster, posterFormats, posterPageSize, type PosterDesign, type PosterFormat, type PosterLayout, type PosterTypeface } from './poster'

const settingsKey = 'escena-tour-poster-v1'
const formatOptions: PosterFormat[] = ['vertical', 'story', 'square', 'print']
const layoutOptions: { value: PosterLayout; label: string; description: string }[] = [
  { value: 'cartell', label: 'Cartell', description: 'Dates en primer pla' },
  { value: 'columna', label: 'Columna', description: 'Agenda en dues bandes' },
  { value: 'quadrícula', label: 'Quadrícula', description: 'Dates en blocs' },
]
const typeOptions: { value: PosterTypeface; label: string }[] = [
  { value: 'impacte', label: 'Impacte' }, { value: 'modern', label: 'Modern' }, { value: 'classic', label: 'Clàssic' },
]

function storedDesign(): PosterDesign {
  try {
    const saved = JSON.parse(localStorage.getItem(settingsKey) || 'null') as Partial<PosterDesign> | null
    if (!saved || !formatOptions.includes(saved.format as PosterFormat) || !layoutOptions.some((item) => item.value === saved.layout) || !typeOptions.some((item) => item.value === saved.typeface)) return defaultPosterDesign
    const color = (value: unknown, fallback: string) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback
    return {
      ...defaultPosterDesign, format: saved.format!, layout: saved.layout!, typeface: saved.typeface!,
      order: saved.order === 'desc' ? 'desc' : 'asc', logoPosition: saved.logoPosition === 'left' ? 'left' : 'right',
      title: typeof saved.title === 'string' ? saved.title.slice(0, 65) : defaultPosterDesign.title,
      subtitle: typeof saved.subtitle === 'string' ? saved.subtitle.slice(0, 65) : defaultPosterDesign.subtitle,
      footer: typeof saved.footer === 'string' ? saved.footer.slice(0, 90) : defaultPosterDesign.footer,
      background: color(saved.background, defaultPosterDesign.background), foreground: color(saved.foreground, defaultPosterDesign.foreground), accent: color(saved.accent, defaultPosterDesign.accent),
      fontSize: typeof saved.fontSize === 'number' && saved.fontSize >= 30 && saved.fontSize <= 64 ? saved.fontSize : defaultPosterDesign.fontSize,
      spacing: typeof saved.spacing === 'number' && saved.spacing >= 0 && saved.spacing <= 35 ? saved.spacing : defaultPosterDesign.spacing,
      imageShade: typeof saved.imageShade === 'number' && saved.imageShade >= 20 && saved.imageShade <= 95 ? saved.imageShade : defaultPosterDesign.imageShade,
      showLogo: saved.showLogo !== false,
    }
  } catch { return defaultPosterDesign }
}

function loadImage(url: string, onLoad: (image: HTMLImageElement) => void, onError: () => void) {
  const image = new Image()
  image.crossOrigin = 'anonymous'
  image.onload = () => onLoad(image)
  image.onerror = onError
  image.src = url
  return image
}

export default function TourPoster({ concerts, bandName, logoUrl }: { concerts: Concert[]; bandName: string; logoUrl?: string }) {
  const [design, setDesign] = useState(storedDesign)
  const [backgroundImage, setBackgroundImage] = useState<HTMLImageElement | undefined>()
  const [logo, setLogo] = useState<HTMLImageElement | undefined>()
  const [page, setPage] = useState(0)
  const [error, setError] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const backgroundUrl = useRef<string | null>(null)
  const today = new Date()
  const localToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const dates = posterConcerts(concerts, localToday)
  if (design.order === 'desc') dates.reverse()
  const perPage = posterPageSize(design)
  const pages = Math.max(1, Math.ceil(dates.length / perPage))
  const currentPage = Math.min(page, pages - 1)
  const onPage = dates.slice(currentPage * perPage, (currentPage + 1) * perPage)

  useEffect(() => { try { localStorage.setItem(settingsKey, JSON.stringify(design)) } catch { /* The poster still works if storage is full. */ } }, [design])
  useEffect(() => {
    if (!logoUrl) { setLogo(undefined); return }
    let active = true
    loadImage(logoUrl, (image) => { if (active) setLogo(image) }, () => { if (active) setLogo(undefined) })
    return () => { active = false }
  }, [logoUrl])
  useEffect(() => () => { if (backgroundUrl.current) URL.revokeObjectURL(backgroundUrl.current) }, [])
  useEffect(() => {
    let active = true
    void document.fonts.ready.then(() => {
      if (!active || !canvasRef.current) return
      try { drawPoster(canvasRef.current, design, onPage, bandName, currentPage, pages, backgroundImage, logo) }
      catch { if (active) setError('No s’ha pogut mostrar el cartell. Torna a provar un altre fons.') }
    })
    return () => { active = false }
  }, [design, concerts, bandName, currentPage, pages, backgroundImage, logo])

  function update<K extends keyof PosterDesign>(key: K, value: PosterDesign[K]) { setDesign((previous) => ({ ...previous, [key]: value })); setError('') }

  function changeBackground(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024) { setError('Tria una imatge JPG, PNG o WEBP de fins a 8 MB.'); return }
    const url = URL.createObjectURL(file)
    loadImage(url, (image) => {
      if (backgroundUrl.current) URL.revokeObjectURL(backgroundUrl.current)
      backgroundUrl.current = url
      setBackgroundImage(image)
      setError('')
    }, () => { URL.revokeObjectURL(url); setError('No s’ha pogut obrir aquesta imatge.') })
  }

  function removeBackground() {
    setBackgroundImage(undefined)
    if (backgroundUrl.current) URL.revokeObjectURL(backgroundUrl.current)
    backgroundUrl.current = null
  }

  function download() {
    if (!dates.length) return
    try {
      const canvas = document.createElement('canvas')
      drawPoster(canvas, design, onPage, bandName, currentPage, pages, backgroundImage, logo)
      const link = document.createElement('a')
      link.download = `cartell-gira-${currentPage + 1}${pages > 1 ? `-de-${pages}` : ''}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
      setError('')
    } catch { setError('No s’ha pogut descarregar el cartell. Prova de desactivar el logotip o canviar la imatge de fons.') }
  }

  return <div className="poster-editor">
    <header className="page-heading poster-heading"><div><span className="eyebrow">LA GIRA, A PUNT PER COMPARTIR</span><h1>Cartell de gira<span className="heading-period">.</span></h1><p>El disseny és teu; les dates es mantenen al dia amb les fitxes.</p></div><button type="button" className="button button-primary" onClick={download} disabled={!dates.length}><Download size={17} /> Descarregar PNG</button></header>
    <div className="poster-workspace">
      <div className="poster-controls">
        <section className="poster-control-card"><h2>Composició</h2><div className="poster-layout-options">{layoutOptions.map((option) => <button type="button" key={option.value} className={design.layout === option.value ? 'selected' : ''} aria-pressed={design.layout === option.value} onClick={() => update('layout', option.value)}><strong>{option.label}</strong><small>{option.description}</small></button>)}</div><label className="field">Format <select value={design.format} onChange={(event) => update('format', event.target.value as PosterFormat)}>{formatOptions.map((format) => <option key={format} value={format}>{posterFormats[format].label} · {posterFormats[format].width} × {posterFormats[format].height}</option>)}</select></label><label className="field">Ordre de les dates <select value={design.order} onChange={(event) => update('order', event.target.value as PosterDesign['order'])}><option value="asc">De més antiga a més recent</option><option value="desc">De més recent a més antiga</option></select></label></section>
        <section className="poster-control-card"><h2>Text</h2><div className="poster-control-fields"><label className="field">Títol <input maxLength={65} value={design.title} onChange={(event) => update('title', event.target.value)} /></label><label className="field">Text superior <input maxLength={65} value={design.subtitle} onChange={(event) => update('subtitle', event.target.value)} /></label><label className="field">Peu <input maxLength={90} value={design.footer} onChange={(event) => update('footer', event.target.value)} /></label><label className="field">Tipografia <select value={design.typeface} onChange={(event) => update('typeface', event.target.value as PosterTypeface)}>{typeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><label className="field">Mida de les dates · {design.fontSize} <input type="range" min="30" max="64" value={design.fontSize} onChange={(event) => update('fontSize', Number(event.target.value))} /></label><label className="field">Separació · {design.spacing} <input type="range" min="0" max="35" value={design.spacing} onChange={(event) => update('spacing', Number(event.target.value))} /></label></div></section>
        <section className="poster-control-card"><h2>Color i imatge</h2><div className="poster-colors"><label>Fons<input type="color" value={design.background} onChange={(event) => update('background', event.target.value)} /></label><label>Text<input type="color" value={design.foreground} onChange={(event) => update('foreground', event.target.value)} /></label><label>Accent<input type="color" value={design.accent} onChange={(event) => update('accent', event.target.value)} /></label></div><div className="poster-background-actions"><label className="button button-secondary"><ImagePlus size={16} /> {backgroundImage ? 'Canviar fons' : 'Pujar imatge de fons'}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={changeBackground} /></label>{backgroundImage ? <button type="button" className="text-button" onClick={removeBackground}><X size={14} /> Treure fons</button> : null}</div>{backgroundImage ? <label className="field">Intensitat del color · {design.imageShade} % <input type="range" min="20" max="95" value={design.imageShade} onChange={(event) => update('imageShade', Number(event.target.value))} /></label> : null}{logoUrl ? <><label className="poster-logo-toggle"><input type="checkbox" checked={design.showLogo} onChange={(event) => update('showLogo', event.target.checked)} /> Mostrar el logotip de la banda</label>{design.showLogo ? <label className="field">Posició del logotip <select value={design.logoPosition} onChange={(event) => update('logoPosition', event.target.value as PosterDesign['logoPosition'])}><option value="right">A la dreta</option><option value="left">A l’esquerra</option></select></label> : null}</> : null}<small className="poster-help">Els ajustos de text i color es guarden en aquest navegador. Torna a pujar la imatge de fons després de recarregar.</small></section>
        <button type="button" className="text-button poster-reset" onClick={() => { setDesign(defaultPosterDesign); removeBackground(); setPage(0) }}><RotateCcw size={15} /> Restablir disseny</button>
      </div>
      <div className="poster-preview-column"><div className="poster-preview-head"><div><span className="eyebrow">VISTA PRÈVIA</span><p>{dates.length} {dates.length === 1 ? 'data inclosa' : 'dates incloses'} · {dates.filter((item) => item.hidden).length} per anunciar</p></div><span>{posterFormats[design.format].width} × {posterFormats[design.format].height} px</span></div>{dates.length ? <><div className="poster-preview-frame"><canvas ref={canvasRef} aria-label={`Vista prèvia del cartell de gira, pàgina ${currentPage + 1} de ${pages}`} role="img" /></div>{pages > 1 ? <div className="poster-page-controls"><button className="button button-secondary" type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Anterior</button><span>Pàgina {currentPage + 1} de {pages} · Descarrega-les una a una</span><button className="button button-secondary" type="button" disabled={currentPage === pages - 1} onClick={() => setPage(currentPage + 1)}>Següent</button></div> : null}</> : <div className="poster-empty"><strong>Encara no hi ha dates per al cartell.</strong><p>Confirma un concert per afegir-hi la data. Per mostrar-ne el nom i el lloc, marca «Es pot anunciar» a la fitxa.</p></div>}<p className="poster-privacy-note">Els concerts per anunciar només mostren la data. Els que ja han passat apareixen ratllats.</p>{error ? <p className="form-error" role="alert">{error}</p> : null}</div>
    </div>
  </div>
}
