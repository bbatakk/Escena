import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { Check, Download, ImagePlus, RotateCcw, Save, Trash2, X } from 'lucide-react'
import { posterConcerts, type Concert } from './model'
import { defaultPosterDesign, drawPoster, normalizePosterDesign, parsePosterTemplates, posterFormatList, posterFormats, posterPageSize, posterSettingsStorageKey, posterTemplatesStorageKey, type PosterAlign, type PosterDateFormat, type PosterDesign, type PosterDivider, type PosterFormat, type PosterImagePosition, type PosterLayout, type PosterTemplate, type PosterTypeface } from './poster'

const layoutOptions: { value: PosterLayout; label: string; description: string }[] = [
  { value: 'cartell', label: 'Cartell', description: 'Dates en primer pla' },
  { value: 'columna', label: 'Columna', description: 'Data a l’esquerra' },
  { value: 'quadrícula', label: 'Quadrícula', description: 'Dates en blocs' },
]
const typeOptions: { value: PosterTypeface; label: string }[] = [
  { value: 'impacte', label: 'Impacte' }, { value: 'modern', label: 'Modern' }, { value: 'classic', label: 'Clàssic' },
]
const orderOptions: { value: PosterDesign['order']; label: string }[] = [{ value: 'asc', label: 'De més antiga a més recent' }, { value: 'desc', label: 'De més recent a més antiga' }]
const formatOptions: { value: PosterFormat; label: string }[] = posterFormatList.map((value) => ({ value, label: `${posterFormats[value].label} · ${posterFormats[value].width} × ${posterFormats[value].height}` }))
const alignOptions: { value: PosterAlign; label: string }[] = [{ value: 'left', label: 'A l’esquerra' }, { value: 'center', label: 'Centrat' }]
const dividerOptions: { value: PosterDivider; label: string }[] = [{ value: 'line', label: 'Línies' }, { value: 'block', label: 'Blocs' }, { value: 'none', label: 'Sense marca' }]
const dateOptions: { value: PosterDateFormat; label: string }[] = [{ value: 'short', label: '27 set' }, { value: 'numeric', label: '27/09/26' }, { value: 'year', label: '27 set 2026' }]
const imageOptions: { value: PosterImagePosition; label: string }[] = [{ value: 'center', label: 'Centrada' }, { value: 'top', label: 'Amunt' }, { value: 'bottom', label: 'Avall' }]
const logoOptions: { value: PosterDesign['logoPosition']; label: string }[] = [{ value: 'right', label: 'A la dreta' }, { value: 'left', label: 'A l’esquerra' }]

function storedDesign(): PosterDesign {
  try {
    return normalizePosterDesign(JSON.parse(localStorage.getItem(posterSettingsStorageKey) || 'null'))
  } catch { return defaultPosterDesign }
}

function storedTemplates(): PosterTemplate[] {
  try { return parsePosterTemplates(localStorage.getItem(posterTemplatesStorageKey)) }
  catch { return [] }
}

function loadImage(url: string, onLoad: (image: HTMLImageElement) => void, onError: () => void) {
  const image = new Image()
  image.crossOrigin = 'anonymous'
  image.onload = () => onLoad(image)
  image.onerror = onError
  image.src = url
  return image
}

function Select<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (value: T) => void }) {
  return <label className="field">{label} <select value={value} onChange={(event) => onChange(event.target.value as T)}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
}

function Slider({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return <label className="field">{label} · {value} <input type="range" min={min} max={max} step="1" value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="poster-logo-toggle"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /> {label}</label>
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return <div className="poster-control-group"><span className="poster-group-title">{title}</span>{children}</div>
}

export default function TourPoster({ concerts, bandName, logoUrl }: { concerts: Concert[]; bandName: string; logoUrl?: string }) {
  const [design, setDesign] = useState(storedDesign)
  const [templates, setTemplates] = useState(storedTemplates)
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [templateName, setTemplateName] = useState('')
  const [templateFeedback, setTemplateFeedback] = useState('')
  const [backgroundImage, setBackgroundImage] = useState<HTMLImageElement | undefined>()
  const [logo, setLogo] = useState<HTMLImageElement | undefined>()
  const [page, setPage] = useState(0)
  const [error, setError] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const backgroundUrl = useRef<string | null>(null)
  const today = new Date()
  const localToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const dates = posterConcerts(concerts, localToday).filter((item) => design.showPast || !item.past)
  if (design.order === 'desc') dates.reverse()
  const perPage = posterPageSize(design)
  const pages = Math.max(1, Math.ceil(dates.length / perPage))
  const currentPage = Math.min(page, pages - 1)
  const onPage = dates.slice(currentPage * perPage, (currentPage + 1) * perPage)

  useEffect(() => { try { localStorage.setItem(posterSettingsStorageKey, JSON.stringify(design)) } catch { /* The poster still works if storage is full. */ } }, [design])
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

  function update<K extends keyof PosterDesign>(key: K, value: PosterDesign[K]) {
    setDesign((previous) => ({ ...previous, [key]: value }))
    setTemplateFeedback(selectedTemplateId ? 'Hi ha canvis pendents per actualitzar aquesta plantilla.' : '')
    setError('')
  }

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

  function saveTemplates(next: PosterTemplate[]): boolean {
    try {
      localStorage.setItem(posterTemplatesStorageKey, JSON.stringify(next))
      setTemplates(next)
      setError('')
      return true
    } catch {
      setError('No s’ha pogut desar la plantilla. Pot ser que l’emmagatzematge del navegador estigui ple.')
      return false
    }
  }

  function saveTemplate() {
    const name = templateName.trim().slice(0, 40)
    if (!name) { setError('Escriu un nom per a la plantilla.'); return }
    if (templates.length >= 30) { setError('Ja tens 30 plantilles desades. Elimina’n alguna abans de desar-ne una altra.'); return }
    if (templates.some((template) => template.name.toLocaleLowerCase('ca') === name.toLocaleLowerCase('ca'))) {
      setError('Ja existeix una plantilla amb aquest nom. Selecciona-la per actualitzar-la.')
      return
    }
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
    const next = [...templates, { id, name, design: { ...design } }]
    if (saveTemplates(next)) { setSelectedTemplateId(id); setTemplateFeedback('Plantilla desada.') }
  }

  function updateTemplate() {
    const name = templateName.trim().slice(0, 40)
    if (!selectedTemplateId) { setError('Selecciona primer una plantilla per actualitzar-la.'); return }
    if (!name) { setError('Escriu un nom per a la plantilla.'); return }
    if (templates.some((template) => template.id !== selectedTemplateId && template.name.toLocaleLowerCase('ca') === name.toLocaleLowerCase('ca'))) {
      setError('Ja existeix una altra plantilla amb aquest nom.')
      return
    }
    const next = templates.map((template) => template.id === selectedTemplateId ? { ...template, name, design: { ...design } } : template)
    if (saveTemplates(next)) setTemplateFeedback('Plantilla actualitzada.')
  }

  function loadTemplate() {
    const template = templates.find((item) => item.id === selectedTemplateId)
    if (!template) return
    setDesign(normalizePosterDesign(template.design))
    setTemplateName(template.name)
    setPage(0)
    setTemplateFeedback('Plantilla carregada.')
    setError('')
  }

  function deleteTemplate() {
    const template = templates.find((item) => item.id === selectedTemplateId)
    if (!template || !window.confirm(`Vols eliminar la plantilla «${template.name}»?`)) return
    if (saveTemplates(templates.filter((item) => item.id !== selectedTemplateId))) {
      setSelectedTemplateId('')
      setTemplateName('')
      setTemplateFeedback('Plantilla eliminada.')
    }
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

  const pastCount = posterConcerts(concerts, localToday).filter((item) => item.past).length

  return <div className="poster-editor">
    <header className="page-heading poster-heading"><div><span className="eyebrow">LA GIRA, A PUNT PER COMPARTIR</span><h1>Cartell de gira<span className="heading-period">.</span></h1><p>El disseny és teu; les dates es mantenen al dia amb les fitxes.</p></div><button type="button" className="button button-primary" onClick={download} disabled={!dates.length}><Download size={17} /> Descarregar PNG</button></header>
    <div className="poster-workspace">
      <div className="poster-controls">
        <section className="poster-control-card"><h2>Plantilles</h2>
          <label className="field">Nom de la plantilla <input maxLength={40} value={templateName} onChange={(event) => setTemplateName(event.target.value)} placeholder="Per exemple, Gira d’estiu" /></label>
          <button type="button" className="button button-secondary" onClick={saveTemplate} disabled={!templateName.trim() || templates.length >= 30}><Save size={15} /> Desar plantilla actual</button>
          <Select label="Plantilles desades" value={selectedTemplateId} options={[{ value: '', label: templates.length ? 'Tria una plantilla' : 'Encara no n’hi ha cap' }, ...templates.map((item) => ({ value: item.id, label: item.name }))]} onChange={(id) => { setSelectedTemplateId(id); setTemplateName(templates.find((item) => item.id === id)?.name || ''); setTemplateFeedback('') }} />
          <div className="poster-template-actions"><button type="button" className="button button-primary" onClick={loadTemplate} disabled={!selectedTemplateId}><Check size={15} /> Carregar</button><button type="button" className="button button-secondary" onClick={updateTemplate} disabled={!selectedTemplateId}><Save size={15} /> Actualitzar</button><button type="button" className="button button-secondary" onClick={deleteTemplate} disabled={!selectedTemplateId} aria-label="Eliminar plantilla"><Trash2 size={15} /></button></div>
          {templateFeedback ? <small className="poster-template-feedback" role="status">{templateFeedback}</small> : null}<small className="poster-help">Les plantilles es guarden només en aquest navegador. Inclouen tots els ajustos; la imatge de fons s’ha de tornar a seleccionar.</small>
        </section>
        <section className="poster-control-card"><h2>Composició</h2>
          <Group title="Estil de les dates"><div className="poster-layout-options">{layoutOptions.map((option) => <button type="button" key={option.value} className={design.layout === option.value ? 'selected' : ''} aria-pressed={design.layout === option.value} onClick={() => { update('layout', option.value); if (option.value === 'quadrícula' && design.columns < 2) update('columns', 2) }}><strong>{option.label}</strong><small>{option.description}</small></button>)}</div></Group>
          <Group title="Columnes"><Slider label="Nombre de columnes" value={design.columns} min={1} max={4} onChange={(value) => update('columns', value)} /><Slider label="Separació" value={design.columnGap} min={8} max={48} onChange={(value) => update('columnGap', value)} /><Slider label="Marges" value={design.margin} min={40} max={110} onChange={(value) => update('margin', value)} /></Group>
          <Group title="Sortida"><Select label="Format" value={design.format} options={formatOptions} onChange={(value) => update('format', value)} /><Select label="Ordre de les dates" value={design.order} options={orderOptions} onChange={(value) => update('order', value)} /></Group>
        </section>

        <section className="poster-control-card"><h2>Dates</h2>
          <Group title="Presentació"><Select label="Marca de les files" value={design.divider} options={dividerOptions} onChange={(value) => update('divider', value)} /><Select label="Format de la data" value={design.dateFormat} options={dateOptions} onChange={(value) => update('dateFormat', value)} /><Slider label="Mida de les dates" value={design.fontSize} min={30} max={64} onChange={(value) => update('fontSize', value)} /><Slider label="Separació de les files" value={design.spacing} min={0} max={35} onChange={(value) => update('spacing', value)} /></Group>
          <Group title="Què s’hi veu"><div className="poster-toggles"><Toggle label="Data" checked={design.showDate} onChange={(value) => update('showDate', value)} /><Toggle label="Nom del concert" checked={design.showName} onChange={(value) => update('showName', value)} /><Toggle label="Població" checked={design.showCity} onChange={(value) => update('showCity', value)} /><Toggle label="Concerts passats" checked={design.showPast} onChange={(value) => update('showPast', value)} /></div></Group>
        </section>

        <section className="poster-control-card"><h2>Text</h2>
          <Group title="Tipografia"><Select label="Tipografia" value={design.typeface} options={typeOptions} onChange={(value) => update('typeface', value)} /><Select label="Alineació" value={design.align} options={alignOptions} onChange={(value) => update('align', value)} /><Slider label="Mida del títol" value={design.titleSize} min={40} max={130} onChange={(value) => update('titleSize', value)} /><Slider label="Mida del nom de la banda" value={design.bandSize} min={18} max={44} onChange={(value) => update('bandSize', value)} /></Group>
          <div className="poster-control-fields"><label className="field">Títol <input maxLength={65} value={design.title} onChange={(event) => update('title', event.target.value)} /></label><label className="field">Text superior <input maxLength={65} value={design.subtitle} onChange={(event) => update('subtitle', event.target.value)} /></label><label className="field">Peu <input maxLength={90} value={design.footer} onChange={(event) => update('footer', event.target.value)} /></label></div>
          <Group title="Mostrar"><div className="poster-toggles"><Toggle label="Text superior" checked={design.showSubtitle} onChange={(value) => update('showSubtitle', value)} /><Toggle label="Títol" checked={design.showTitle} onChange={(value) => update('showTitle', value)} /><Toggle label="Nom de la banda" checked={design.showBand} onChange={(value) => update('showBand', value)} /><Toggle label="Peu" checked={design.showFooter} onChange={(value) => update('showFooter', value)} /><Toggle label="Majúscules" checked={design.uppercase} onChange={(value) => update('uppercase', value)} /><Toggle label="Línies de separació" checked={design.rules} onChange={(value) => update('rules', value)} /></div></Group>
        </section>

        <section className="poster-control-card"><h2>Color i imatge</h2>
          <div className="poster-colors"><label>Fons<input type="color" value={design.background} onChange={(event) => update('background', event.target.value)} /></label><label>Text<input type="color" value={design.foreground} onChange={(event) => update('foreground', event.target.value)} /></label><label>Accent<input type="color" value={design.accent} onChange={(event) => update('accent', event.target.value)} /></label></div>
          <div className="poster-background-actions"><label className="button button-secondary"><ImagePlus size={16} /> {backgroundImage ? 'Canviar fons' : 'Pujar imatge de fons'}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={changeBackground} /></label>{backgroundImage ? <button type="button" className="text-button" onClick={removeBackground}><X size={14} /> Treure fons</button> : null}</div>
          {backgroundImage ? <><Slider label="Intensitat del color" value={design.imageShade} min={20} max={95} onChange={(value) => update('imageShade', value)} /><Select label="Enquadrament de la imatge" value={design.imagePosition} options={imageOptions} onChange={(value) => update('imagePosition', value)} /></> : null}
          {logoUrl ? <><Toggle label="Mostrar el logotip de la banda" checked={design.showLogo} onChange={(value) => update('showLogo', value)} />{design.showLogo ? <Select label="Posició del logotip" value={design.logoPosition} options={logoOptions} onChange={(value) => update('logoPosition', value)} /> : null}</> : null}
          <small className="poster-help">Els ajustos es guarden en aquest navegador. Torna a pujar la imatge de fons després de recarregar.</small>
        </section>
        <button type="button" className="text-button poster-reset" onClick={() => { setDesign(defaultPosterDesign); removeBackground(); setPage(0) }}><RotateCcw size={15} /> Restablir disseny</button>
      </div>
      <div className="poster-preview-column"><div className="poster-preview-head"><div><span className="eyebrow">VISTA PRÈVIA</span><p>{dates.length} {dates.length === 1 ? 'data inclosa' : 'dates incloses'} · {dates.filter((item) => item.hidden).length} per anunciar{design.showPast || !pastCount ? '' : ` · ${pastCount} passades amagades`}</p></div><span>{posterFormats[design.format].width} × {posterFormats[design.format].height} px</span></div>{dates.length ? <><div className="poster-preview-frame"><canvas ref={canvasRef} aria-label={`Vista prèvia del cartell de gira, pàgina ${currentPage + 1} de ${pages}`} role="img" /></div>{pages > 1 ? <div className="poster-page-controls"><button className="button button-secondary" type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Anterior</button><span>Pàgina {currentPage + 1} de {pages} · Descarrega-les una a una</span><button className="button button-secondary" type="button" disabled={currentPage === pages - 1} onClick={() => setPage(currentPage + 1)}>Següent</button></div> : null}</> : <div className="poster-empty"><strong>Encara no hi ha dates per al cartell.</strong><p>Confirma un concert per afegir-hi la data. Per mostrar-ne el nom i el lloc, marca «Es pot anunciar» a la fitxa.</p></div>}<p className="poster-privacy-note">Els concerts per anunciar només mostren la data. Els que ja han passat apareixen en gris.</p>{error ? <p className="form-error" role="alert">{error}</p> : null}</div>
    </div>
  </div>
}
