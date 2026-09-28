import type { PosterConcert } from './model'

export type PosterFormat = 'vertical' | 'story' | 'square' | 'print'
export type PosterLayout = 'cartell' | 'columna' | 'quadrícula'
export type PosterTypeface = 'impacte' | 'modern' | 'classic'
export type PosterOrder = 'asc' | 'desc'
export type PosterAlign = 'left' | 'center'
export type PosterDivider = 'line' | 'block' | 'none'
export type PosterDateFormat = 'short' | 'numeric' | 'year'
export type PosterImagePosition = 'center' | 'top' | 'bottom'

export interface PosterDesign {
  format: PosterFormat
  layout: PosterLayout
  typeface: PosterTypeface
  order: PosterOrder
  align: PosterAlign
  divider: PosterDivider
  dateFormat: PosterDateFormat
  imagePosition: PosterImagePosition
  logoPosition: 'left' | 'right'
  title: string
  subtitle: string
  footer: string
  background: string
  foreground: string
  accent: string
  fontSize: number
  spacing: number
  columns: number
  columnGap: number
  margin: number
  titleSize: number
  bandSize: number
  imageShade: number
  uppercase: boolean
  rules: boolean
  showLogo: boolean
  showTitle: boolean
  showSubtitle: boolean
  showBand: boolean
  showFooter: boolean
  showDate: boolean
  showName: boolean
  showCity: boolean
  showPast: boolean
}

export const defaultPosterDesign: PosterDesign = {
  format: 'vertical', layout: 'cartell', typeface: 'impacte', order: 'asc', align: 'left', divider: 'line', dateFormat: 'short', imagePosition: 'center', logoPosition: 'right',
  title: 'EN DIRECTE', subtitle: 'DATES DE GIRA', footer: 'ENS VEIEM A LA CARRETERA',
  background: '#162542', foreground: '#fff8ee', accent: '#f4a57b',
  fontSize: 45, spacing: 12, columns: 1, columnGap: 24, margin: 76, titleSize: 90, bandSize: 27, imageShade: 78,
  uppercase: true, rules: true, showLogo: true, showTitle: true, showSubtitle: true, showBand: true, showFooter: true, showDate: true, showName: true, showCity: true, showPast: true,
}

export const posterFormats: Record<PosterFormat, { label: string; width: number; height: number }> = {
  vertical: { label: 'Publicació vertical', width: 1080, height: 1350 },
  story: { label: 'Història', width: 1080, height: 1920 },
  square: { label: 'Quadrat', width: 1080, height: 1080 },
  print: { label: 'A4 per imprimir', width: 2480, height: 3508 },
}

export const posterFormatList: PosterFormat[] = ['vertical', 'story', 'square', 'print']
export const posterLayoutList: PosterLayout[] = ['cartell', 'columna', 'quadrícula']
export const posterTypefaceList: PosterTypeface[] = ['impacte', 'modern', 'classic']
export const posterOrderList: PosterOrder[] = ['asc', 'desc']
export const posterAlignList: PosterAlign[] = ['left', 'center']
export const posterDividerList: PosterDivider[] = ['line', 'block', 'none']
export const posterDateFormatList: PosterDateFormat[] = ['short', 'numeric', 'year']
export const posterImagePositionList: PosterImagePosition[] = ['center', 'top', 'bottom']

export interface PosterMetrics {
  width: number
  height: number
  left: number
  right: number
  centerX: number
  contentWidth: number
  rowTop: number
  rowHeight: number
  rows: number
  columns: number
  columnGap: number
  columnWidth: number
  footerTop: number
  footerRule: number
}

export function posterColumns(design: PosterDesign): number {
  if (typeof design.columns === 'number' && design.columns >= 1 && design.columns <= 4) return Math.round(design.columns)
  return design.layout === 'quadrícula' ? 2 : 1
}

export function posterMetrics(design: PosterDesign): PosterMetrics {
  const format = posterFormats[design.format] ?? posterFormats.vertical
  const width = 1080
  const height = format.height / (format.width / width)
  const margin = Math.min(Math.max(design.margin || 0, 40), 110)
  const left = margin
  const right = width - margin
  const contentWidth = right - left
  const rowTop = margin
    + (design.showSubtitle ? 34 : 0)
    + (design.showTitle ? design.titleSize * 1.04 : 0)
    + (design.showBand ? design.bandSize * 1.7 : 0)
    + (design.rules ? 26 : 0)
    + 14
  const footerReserve = (design.rules ? 60 : 0) + (design.showFooter ? 40 : 0)
  const footerTop = height - margin - 40
  const rowHeight = design.divider === 'block' ? Math.max(142, design.fontSize * 2.65 + design.spacing * 2) : Math.max(102, design.fontSize * 2.25 + design.spacing * 2)
  const rows = Math.max(1, Math.floor((height - rowTop - footerReserve - margin) / rowHeight))
  const columns = posterColumns(design)
  const columnGap = Math.min(Math.max(design.columnGap || 0, 8), 48)
  return { width, height, left, right, centerX: width / 2, contentWidth, rowTop, rowHeight, rows, columns, columnGap, columnWidth: (contentWidth - columnGap * (columns - 1)) / columns, footerTop, footerRule: footerTop - 34 }
}

export function posterPageSize(design: PosterDesign): number {
  const metrics = posterMetrics(design)
  return metrics.rows * metrics.columns
}

function fontFor(design: PosterDesign): string {
  return design.typeface === 'impacte' ? '"Archivo Black", sans-serif' : design.typeface === 'classic' ? '"Libre Baskerville", serif' : '"Space Grotesk", sans-serif'
}

function fit(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  let result = text
  while (result.length && ctx.measureText(`${result}…`).width > maxWidth) result = result.slice(0, -1)
  return `${result.trimEnd()}…`
}

function dateLabel(date: string, format: PosterDateFormat): string {
  const [year, month, day] = date.split('-').map(Number)
  const value = new Date(year, month - 1, day)
  if (format === 'numeric') return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${String(year).slice(2)}`
  const short = new Intl.DateTimeFormat('ca-ES', { day: '2-digit', month: 'short' }).format(value).replace('.', '').trim().toLocaleLowerCase('ca')
  return format === 'year' ? `${short} ${year}` : short
}

function caseText(value: string, upper: boolean): string {
  return upper ? value.toLocaleUpperCase('ca') : value
}

function cover(ctx: CanvasRenderingContext2D, image: HTMLImageElement, width: number, height: number, position: PosterImagePosition): void {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight)
  const w = image.naturalWidth * scale
  const h = image.naturalHeight * scale
  const y = position === 'top' ? 0 : position === 'bottom' ? height - h : (height - h) / 2
  ctx.drawImage(image, (width - w) / 2, y, w, h)
}

function block(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number): void {
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath()
    ctx.roundRect(x, y, width, height, 14)
    ctx.fill()
    return
  }
  ctx.fillRect(x, y, width, height)
}

export function drawPoster(canvas: HTMLCanvasElement, design: PosterDesign, concerts: PosterConcert[], bandName: string, page: number, totalPages: number, image?: HTMLImageElement, logo?: HTMLImageElement): void {
  const format = posterFormats[design.format] ?? posterFormats.vertical
  canvas.width = format.width
  canvas.height = format.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('El navegador no pot dibuixar el cartell.')
  const scale = format.width / 1080
  ctx.scale(scale, scale)
  const m = posterMetrics(design)
  const display = fontFor(design)
  const centered = design.align === 'center'
  const headerX = centered ? m.centerX : m.left
  const headerAlign: CanvasTextAlign = centered ? 'center' : 'left'

  const text = (content: string, x: number, y: number, maxWidth: number, font: string, fill: string, alpha = 1, align: CanvasTextAlign = headerAlign): void => {
    if (!content) return
    ctx.font = font
    ctx.fillStyle = fill
    ctx.globalAlpha = alpha
    ctx.textAlign = align
    ctx.fillText(fit(ctx, caseText(content, design.uppercase), maxWidth), x, y)
    ctx.globalAlpha = 1
    ctx.textAlign = 'left'
  }

  ctx.textBaseline = 'top'
  ctx.fillStyle = design.background
  ctx.fillRect(0, 0, m.width, m.height)
  if (image?.naturalWidth) {
    cover(ctx, image, m.width, m.height, design.imagePosition)
    ctx.fillStyle = design.background
    ctx.globalAlpha = design.imageShade / 100
    ctx.fillRect(0, 0, m.width, m.height)
    ctx.globalAlpha = 1
  }

  const showLogo = Boolean(logo?.naturalWidth && design.showLogo)
  if (showLogo) {
    const maxSide = 112
    const ratio = Math.min(maxSide / logo!.naturalWidth, maxSide / logo!.naturalHeight)
    ctx.drawImage(logo!, design.logoPosition === 'left' ? m.left : m.right - logo!.naturalWidth * ratio, m.left - 20, logo!.naturalWidth * ratio, logo!.naturalHeight * ratio)
  }
  const headerWidth = m.contentWidth - (showLogo && !centered ? 150 : 0)

  let y = m.left
  if (design.showSubtitle) { text(design.subtitle, headerX, y, headerWidth, '600 23px "IBM Plex Mono", monospace', design.accent); y += 34 }
  if (design.showTitle) { text(design.title, headerX, y, m.contentWidth - 30, `900 ${design.titleSize}px ${display}`, design.foreground); y += design.titleSize * 1.04 }
  if (design.showBand) { text(bandName, headerX, y, m.contentWidth - 40, `700 ${design.bandSize}px "Space Grotesk", sans-serif`, design.accent); y += design.bandSize * 1.7 }
  if (design.rules) { ctx.fillStyle = design.accent; ctx.fillRect(m.left, y + 8, m.contentWidth, 3) }

  const perColumn = Math.max(1, Math.ceil(concerts.length / m.columns))
  concerts.forEach((concert, index) => {
    const x = m.left + Math.floor(index / perColumn) * (m.columnWidth + m.columnGap)
    const top = m.rowTop + index % perColumn * m.rowHeight
    const rowForeground = concert.past ? '#969ba4' : design.foreground
    const rowAccent = concert.past ? '#858c96' : design.accent
    if (design.divider === 'block') {
      ctx.fillStyle = rowForeground
      ctx.globalAlpha = 0.08
      block(ctx, x, top, m.columnWidth, m.rowHeight - 12)
      ctx.globalAlpha = 1
    } else if (design.divider === 'line') {
      ctx.fillStyle = rowForeground
      ctx.globalAlpha = concert.past ? 0.12 : 0.24
      ctx.fillRect(x, top + m.rowHeight - 11, m.columnWidth, 1)
      ctx.globalAlpha = 1
    }

    const pad = design.divider === 'block' ? 22 : 8
    const textWidth = m.columnWidth - pad * 2
    const name = concert.hidden ? 'Per anunciar' : concert.title
    if (design.layout === 'columna' && design.showDate) {
      const gutter = Math.min(240, m.columnWidth * 0.42)
      text(dateLabel(concert.date, design.dateFormat), x + 8, top + 20, gutter - 16, '600 29px "IBM Plex Mono", monospace', rowAccent)
      const textX = centered ? x + gutter + (m.columnWidth - gutter) / 2 : x + gutter + 8
      let lineY = top + 14
      if (design.showName) { text(name, textX, lineY, m.columnWidth - gutter - 16, `700 ${design.fontSize}px ${display}`, rowForeground); lineY += design.fontSize * 0.9 }
      if (design.showCity && concert.city) text(concert.city, textX, lineY + 6, m.columnWidth - gutter - 17, '500 23px "Space Grotesk", sans-serif', rowForeground, 0.76)
    } else {
      const rowX = centered ? x + m.columnWidth / 2 : x + pad
      let lineY = top + (design.divider === 'block' ? 14 : 12)
      if (design.showDate) { text(dateLabel(concert.date, design.dateFormat), rowX, lineY, textWidth, '600 26px "IBM Plex Mono", monospace', rowAccent); lineY += 34 }
      if (design.showName) { text(name, rowX, lineY, textWidth, `700 ${design.fontSize}px ${display}`, rowForeground); lineY += design.fontSize * 0.9 }
      if (design.showCity && concert.city) text(concert.city, rowX, lineY + 6, textWidth, '500 22px "Space Grotesk", sans-serif', rowForeground, 0.76)
    }
  })

  if (design.rules) { ctx.fillStyle = design.accent; ctx.fillRect(m.left, m.footerRule, m.contentWidth, 3) }
  if (design.showFooter) text(design.footer, headerX, m.footerTop, m.contentWidth - 120, '600 20px "IBM Plex Mono", monospace', design.accent)
  if (totalPages > 1) text(`${page + 1} / ${totalPages}`, m.right, m.footerTop, 200, '600 20px "IBM Plex Mono", monospace', design.accent, 1, 'right')
}
