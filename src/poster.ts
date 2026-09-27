import type { PosterConcert } from './model'

export type PosterFormat = 'vertical' | 'story' | 'square' | 'print'
export type PosterLayout = 'cartell' | 'columna' | 'quadrícula'
export type PosterTypeface = 'impacte' | 'modern' | 'classic'
export type PosterOrder = 'asc' | 'desc'

export interface PosterDesign {
  format: PosterFormat
  layout: PosterLayout
  typeface: PosterTypeface
  order: PosterOrder
  logoPosition: 'left' | 'right'
  title: string
  subtitle: string
  footer: string
  background: string
  foreground: string
  accent: string
  fontSize: number
  spacing: number
  imageShade: number
  showLogo: boolean
}

export const defaultPosterDesign: PosterDesign = {
  format: 'vertical', layout: 'cartell', typeface: 'impacte', order: 'asc', logoPosition: 'right', title: 'EN DIRECTE', subtitle: 'DATES DE GIRA', footer: 'ENS VEIEM A LA CARRETERA',
  background: '#162542', foreground: '#fff8ee', accent: '#f4a57b', fontSize: 45, spacing: 12, imageShade: 78, showLogo: true,
}

export const posterFormats: Record<PosterFormat, { label: string; width: number; height: number }> = {
  vertical: { label: 'Publicació vertical', width: 1080, height: 1350 },
  story: { label: 'Història', width: 1080, height: 1920 },
  square: { label: 'Quadrat', width: 1080, height: 1080 },
  print: { label: 'A4 per imprimir', width: 2480, height: 3508 },
}

export function posterPageSize(design: PosterDesign): number {
  const height = posterFormats[design.format].height / (posterFormats[design.format].width / 1080)
  const rowHeight = design.layout === 'quadrícula' ? Math.max(142, design.fontSize * 2.65 + design.spacing * 2) : Math.max(102, design.fontSize * 2.25 + design.spacing * 2)
  const rows = Math.max(1, Math.floor((height - 338 - 170) / rowHeight))
  return design.layout === 'quadrícula' ? rows * 2 : rows
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

function dateLabel(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  return new Intl.DateTimeFormat('ca-ES', { day: '2-digit', month: 'short' }).format(new Date(year, month - 1, day)).replace('.', '').toLocaleUpperCase('ca')
}

function cover(ctx: CanvasRenderingContext2D, image: HTMLImageElement, width: number, height: number): void {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight)
  const w = image.naturalWidth * scale
  const h = image.naturalHeight * scale
  ctx.drawImage(image, (width - w) / 2, (height - h) / 2, w, h)
}

export function drawPoster(canvas: HTMLCanvasElement, design: PosterDesign, concerts: PosterConcert[], bandName: string, page: number, totalPages: number, image?: HTMLImageElement, logo?: HTMLImageElement): void {
  const format = posterFormats[design.format]
  canvas.width = format.width
  canvas.height = format.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('El navegador no pot dibuixar el cartell.')
  const scale = format.width / 1080
  ctx.scale(scale, scale)
  const width = 1080
  const height = format.height / scale
  ctx.fillStyle = design.background
  ctx.fillRect(0, 0, width, height)
  if (image?.naturalWidth) {
    cover(ctx, image, width, height)
    ctx.fillStyle = design.background
    ctx.globalAlpha = design.imageShade / 100
    ctx.fillRect(0, 0, width, height)
    ctx.globalAlpha = 1
  }

  const display = fontFor(design)
  ctx.textBaseline = 'top'
  ctx.fillStyle = design.accent
  ctx.font = '600 23px "IBM Plex Mono", monospace'
  const logoLeft = logo?.naturalWidth && design.showLogo && design.logoPosition === 'left'
  ctx.fillText(fit(ctx, design.subtitle.toLocaleUpperCase('ca'), logoLeft ? 770 : 700), logoLeft ? 218 : 76, 72)
  if (logo?.naturalWidth && design.showLogo) {
    const maxSide = 112
    const ratio = Math.min(maxSide / logo.naturalWidth, maxSide / logo.naturalHeight)
    ctx.drawImage(logo, design.logoPosition === 'left' ? 76 : width - 76 - logo.naturalWidth * ratio, 56, logo.naturalWidth * ratio, logo.naturalHeight * ratio)
  }
  ctx.fillStyle = design.foreground
  ctx.font = `900 ${design.typeface === 'impacte' ? 90 : 79}px ${display}`
  ctx.fillText(fit(ctx, design.title.toLocaleUpperCase('ca'), 928), 72, 128)
  ctx.fillStyle = design.accent
  ctx.font = '700 27px "Space Grotesk", sans-serif'
  ctx.fillText(fit(ctx, bandName.toLocaleUpperCase('ca'), 850), 76, 240)
  ctx.fillRect(76, 300, 928, 3)

  const rowHeight = design.layout === 'quadrícula' ? Math.max(142, design.fontSize * 2.65 + design.spacing * 2) : Math.max(102, design.fontSize * 2.25 + design.spacing * 2)
  const rowTop = 338
  concerts.forEach((concert, index) => {
    const grid = design.layout === 'quadrícula'
    const x = grid ? 76 + index % 2 * 474 : 76
    const y = rowTop + Math.floor(grid ? index / 2 : index) * rowHeight
    const itemWidth = grid ? 452 : 928
    const rowForeground = concert.past ? '#969ba4' : design.foreground
    const rowAccent = concert.past ? '#858c96' : design.accent
    if (grid) {
      ctx.fillStyle = rowForeground
      ctx.globalAlpha = 0.08
      ctx.fillRect(x, y, itemWidth, rowHeight - 12)
      ctx.globalAlpha = 1
    } else {
      ctx.fillStyle = rowForeground
      ctx.globalAlpha = concert.past ? 0.12 : 0.24
      ctx.fillRect(x, y + rowHeight - 11, itemWidth, 1)
      ctx.globalAlpha = 1
    }

    if (design.layout === 'columna') {
      ctx.fillStyle = rowAccent
      ctx.font = '600 29px "IBM Plex Mono", monospace'
      ctx.fillText(dateLabel(concert.date), x + 8, y + 20)
      ctx.fillStyle = rowForeground
      ctx.font = `700 ${design.fontSize}px ${display}`
      ctx.fillText(fit(ctx, concert.hidden ? 'PER ANUNCIAR' : concert.title, 680), x + 240, y + 14)
      if (!concert.hidden && concert.city) {
        ctx.fillStyle = rowForeground
        ctx.globalAlpha = 0.76
        ctx.font = '500 23px "Space Grotesk", sans-serif'
        ctx.fillText(fit(ctx, concert.city, 680), x + 241, y + 20 + design.fontSize)
        ctx.globalAlpha = 1
      }
    } else {
      const textX = x + (grid ? 22 : 8)
      const textY = y + (grid ? 14 : 12)
      ctx.fillStyle = rowAccent
      ctx.font = '600 26px "IBM Plex Mono", monospace'
      ctx.fillText(dateLabel(concert.date), textX, textY)
      ctx.fillStyle = rowForeground
      ctx.font = `700 ${design.fontSize}px ${display}`
      const line = concert.hidden ? 'PER ANUNCIAR' : concert.title
      ctx.fillText(fit(ctx, line, itemWidth - (grid ? 44 : 24)), textX, textY + 34)
      if (!concert.hidden && concert.city) {
        ctx.fillStyle = rowForeground
        ctx.globalAlpha = 0.76
        ctx.font = '500 22px "Space Grotesk", sans-serif'
        ctx.fillText(fit(ctx, concert.city, itemWidth - (grid ? 44 : 24)), textX, textY + 42 + design.fontSize)
        ctx.globalAlpha = 1
      }
    }
  })

  ctx.fillStyle = design.accent
  ctx.fillRect(76, height - 133, 928, 3)
  ctx.font = '600 20px "IBM Plex Mono", monospace'
  ctx.fillText(fit(ctx, design.footer.toLocaleUpperCase('ca'), 775), 76, height - 99)
  if (totalPages > 1) {
    ctx.textAlign = 'right'
    ctx.fillText(`${page + 1} / ${totalPages}`, width - 76, height - 99)
    ctx.textAlign = 'left'
  }
}
