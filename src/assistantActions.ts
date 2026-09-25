import type { BandDocument, BandMaterial, BandPerson, Concert, MerchProduct, MerchSale, MoneyMovement, SetlistTemplate } from './model'

export type Section = 'people' | 'materials' | 'setlists' | 'documents' | 'money' | 'products' | 'sales' | 'workspace' | 'theme'
export type Mode = 'create' | 'update' | 'archive' | 'delete'
export interface ActionContext {
  people: BandPerson[]
  materials: BandMaterial[]
  setlists: SetlistTemplate[]
  documents: BandDocument[]
  money: MoneyMovement[]
  products: MerchProduct[]
  sales: MerchSale[]
  concerts: Concert[]
  workspaceName: string
  theme: string
}
export interface AppAction { section: Section; mode: Mode; id?: string; before?: Record<string, unknown>; after?: Record<string, unknown>; productPrice?: number }

export const sectionFields: Record<Section, readonly string[]> = {
  people: ['name', 'kind', 'phone', 'email'], materials: ['name', 'category'], setlists: ['name', 'songs'], documents: ['name', 'url'],
  money: ['kind', 'amount', 'date', 'category', 'note', 'concertId'], products: ['name', 'price', 'stock', 'sizes'],
  sales: ['concertId', 'productId', 'quantity', 'size', 'note'], workspace: ['name'], theme: ['theme'],
}
const allowedModes: Record<Section, readonly Mode[]> = {
  people: ['create', 'update', 'archive'], materials: ['create', 'update', 'archive'], setlists: ['create', 'update', 'archive'], documents: ['create', 'update', 'archive', 'delete'],
  money: ['create', 'update', 'delete'], products: ['create', 'update', 'archive'], sales: ['create', 'delete'], workspace: ['update'], theme: ['update'],
}
export const sectionLabels: Record<Section, string> = { people: 'Persones', materials: 'Material', setlists: 'Setlists', documents: 'Documents', money: 'Tresoreria', products: 'Marxandatge', sales: 'Venda de marxandatge', workspace: 'Nom de la banda', theme: 'Tema visual' }
export const modeLabels: Record<Mode, string> = { create: 'Crear', update: 'Editar', archive: 'Arxivar', delete: 'Eliminar' }
export const actionFieldLabels: Record<string, string> = { name: 'Nom', kind: 'Tipus', phone: 'Telèfon', email: 'Correu', category: 'Categoria', songs: 'Cançons', url: 'Enllaç', amount: 'Import', date: 'Data', note: 'Nota', concertId: 'Concert', price: 'Preu', stock: 'Estoc', sizes: 'Talles', productId: 'Producte', quantity: 'Unitats', size: 'Talla', theme: 'Tema' }

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const str = (value: unknown, max = 200): value is string => typeof value === 'string' && value.length <= max
const money = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && Math.abs(Math.round(value * 100) - value * 100) < 1e-6
const date = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value
const keyName = (value: string) => value.trim().normalize('NFKC').toLocaleLowerCase('ca')

function records(section: Section, context: ActionContext): Array<Record<string, unknown>> {
  if (section === 'workspace') return [{ id: 'workspace', name: context.workspaceName }]
  if (section === 'theme') return [{ id: 'theme', theme: context.theme }]
  return context[section] as unknown as Array<Record<string, unknown>>
}

function validate(section: Section, fields: Record<string, unknown>, context: ActionContext): void {
  if ('name' in fields && (!str(fields.name, 120) || !fields.name.trim())) throw new Error('Cal un nom vàlid (màxim 120 caràcters).')
  if (section === 'people') {
    if (!['musica', 'tecnic', 'manager', 'contacte'].includes(String(fields.kind)) || !str(fields.phone, 80) || !str(fields.email, 200) || (fields.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(fields.email)))) throw new Error('El rol o el contacte de la persona no és vàlid.')
  } else if (section === 'materials') {
    if (!str(fields.category, 120)) throw new Error('La categoria no és vàlida.')
  } else if (section === 'setlists') {
    if (!Array.isArray(fields.songs) || !fields.songs.length || fields.songs.length > 100 || fields.songs.some((song) => !str(song, 200) || !song.trim())) throw new Error('La plantilla necessita entre 1 i 100 cançons amb nom.')
  } else if (section === 'documents') {
    if (!str(fields.url, 2048) || (fields.url && !/^https?:\/\/[^\s]+$/i.test(String(fields.url)))) throw new Error('L’enllaç del document ha de ser HTTP o HTTPS.')
  } else if (section === 'money') {
    if (!['ingres', 'despesa'].includes(String(fields.kind)) || !money(fields.amount) || fields.amount === 0 || !date(fields.date) || !str(fields.category, 120) || !str(fields.note, 1000) || (fields.concertId && !context.concerts.some((item) => item.id === fields.concertId))) throw new Error('El moviment necessita tipus, import positiu, data vàlida i un concert existent si s’indica.')
  } else if (section === 'products') {
    const sizes = fields.sizes
    if (!money(fields.price) || !Number.isInteger(fields.stock) || (fields.stock as number) < 0 || !Array.isArray(sizes) || sizes.length > 30 || sizes.some((size: unknown) => !isRecord(size) || !str(size.name, 80) || !size.name.trim() || !Number.isInteger(size.stock) || (size.stock as number) < 0)) throw new Error('El producte necessita preu i estoc vàlids.')
    const variants = sizes as Array<{ name: string; stock: number }>
    if (new Set(variants.map((size) => keyName(size.name))).size !== variants.length || (variants.length > 0 && fields.stock !== variants.reduce((total, size) => total + size.stock, 0))) throw new Error('Les talles han de ser úniques i sumar l’estoc total.')
    const old = context.products.find((item) => item.id === fields.id)
    const pastSales = context.sales.filter((item) => item.productId === old?.id)
    if (variants.length && !old?.sizes?.length && pastSales.some((sale) => !sale.size)) throw new Error('Un producte amb vendes sense talla no es pot convertir en variants.')
    if (variants.length ? pastSales.some((sale) => !sale.size || !variants.some((variant) => variant.name === sale.size && variant.stock >= pastSales.filter((entry) => entry.size === variant.name).reduce((sum, entry) => sum + entry.quantity, 0))) : (fields.stock as number) < pastSales.reduce((sum, sale) => sum + sale.quantity, 0)) throw new Error('L’estoc no pot ser inferior a les vendes registrades.')
  } else if (section === 'sales') {
    if (!context.concerts.some((item) => item.id === fields.concertId) || !context.products.some((item) => item.id === fields.productId && item.active) || !Number.isInteger(fields.quantity) || (fields.quantity as number) < 1 || (fields.quantity as number) > 100 || !str(fields.size, 80) || !str(fields.note, 500)) throw new Error('Cal un concert i un producte actiu, amb una quantitat vàlida.')
    const product = context.products.find((item) => item.id === fields.productId)!
    if ((product.sizes?.length && !product.sizes.some((size) => size.name === fields.size)) || (!product.sizes?.length && fields.size)) throw new Error('Tria una talla existent o deixa-la buida si no hi ha talles.')
    const sold = context.sales.filter((item) => item.productId === product.id && (!product.sizes?.length || item.size === fields.size)).reduce((sum, item) => sum + item.quantity, 0)
    const stock = product.sizes?.length ? product.sizes.find((size) => size.name === fields.size)!.stock : product.stock
    if (sold + (fields.quantity as number) > stock) throw new Error('No hi ha prou estoc per a aquesta venda.')
  } else if (section === 'workspace' && (!str(fields.name, 80) || !fields.name.trim())) throw new Error('Escriu un nom de banda vàlid.')
  else if (section === 'theme' && !['classic', 'live-stage', 'club', 'paper'].includes(String(fields.theme))) throw new Error('Tria un tema visual existent.')
}

export function parseAppActions(value: unknown, context: ActionContext): AppAction[] {
  if (!Array.isArray(value) || !value.length || value.length > 20) throw new Error('L’assistent ha de proposar entre 1 i 20 accions.')
  const used = new Set<string>()
  const names = new Set<string>()
  const actions = value.map((raw: unknown) => {
    if (!isRecord(raw) || typeof raw.section !== 'string' || !(raw.section in sectionFields) || typeof raw.mode !== 'string') throw new Error('Acció desconeguda.')
    const section = raw.section as Section
    const mode = raw.mode as Mode
    if (!allowedModes[section].includes(mode)) throw new Error(`Aquesta acció no està disponible a ${sectionLabels[section]}.`)
    const list = records(section, context)
    const original = mode === 'create' ? undefined : list.find((item) => item.id === (section === 'workspace' || section === 'theme' ? section : raw.id))
    if (mode !== 'create' && !original) throw new Error(`No s’ha trobat el registre a ${sectionLabels[section]}.`)
    if (original && 'active' in original && original.active === false) throw new Error('Aquest registre ja està arxivat.')
    if (original && 'archived' in original && original.archived === true && mode === 'archive') throw new Error('Aquest document ja està arxivat.')
    const unique = `${section}:${original?.id ?? 'workspace'}`
    if (original && used.has(unique)) throw new Error('La proposta modifica dues vegades el mateix registre.')
    used.add(unique)
    if (mode === 'archive' || mode === 'delete') {
      if (raw.fields !== undefined) throw new Error('Arxivar o eliminar no admet camps addicionals.')
      return { section, mode, id: original!.id as string, before: original }
    }
    if (!isRecord(raw.fields) || !Object.keys(raw.fields).length || Object.keys(raw.fields).some((key) => !sectionFields[section].includes(key))) throw new Error(`Hi ha camps no permesos a ${sectionLabels[section]}.`)
    const defaults: Record<Section, Record<string, unknown>> = {
      people: { name: '', kind: '', phone: '', email: '' }, materials: { name: '', category: '' }, setlists: { name: '', songs: [] }, documents: { name: '', url: '' },
      money: { kind: '', amount: 0, date: '', category: '', note: '', concertId: '' }, products: { name: '', price: undefined, stock: undefined, sizes: [] },
      sales: { concertId: '', productId: '', quantity: 0, size: '', note: '' }, workspace: { name: '' }, theme: { theme: '' },
    }
    const fields = raw.fields as Record<string, unknown>
    const after = { ...(original || defaults[section]), ...fields }
    validate(section, after, context)
    if (section === 'money' && mode === 'create' && !after.category) after.category = after.kind === 'ingres' ? 'Altres ingressos' : 'Altres despeses'
    if (mode === 'update' && ['people', 'materials', 'setlists', 'documents', 'products'].includes(section) && typeof after.name === 'string' && list.some((item) => item.id !== original?.id && typeof item.name === 'string' && keyName(item.name) === keyName(after.name as string))) throw new Error(`«${after.name}» ja existeix a ${sectionLabels[section]}.`)
    if (mode === 'update' && Object.keys(fields).every((key) => JSON.stringify(original?.[key]) === JSON.stringify(fields[key]))) throw new Error('No hi ha cap canvi en aquest registre.')
    if (mode === 'create' && ['people', 'materials', 'setlists', 'documents', 'products'].includes(section)) {
      const name = keyName(after.name as string)
      if (list.some((item) => typeof item.name === 'string' && keyName(item.name) === name) || names.has(`${section}:${name}`)) throw new Error(`«${after.name}» ja existeix a ${sectionLabels[section]}.`)
      names.add(`${section}:${name}`)
    }
    return { section, mode, id: original?.id as string | undefined, before: original, after, productPrice: section === 'sales' ? context.products.find((item) => item.id === after.productId)?.price : undefined }
  })
  const proposedSales = new Map<string, number>()
  for (const action of actions) {
    if (action.section !== 'sales' || action.mode !== 'create') continue
    const sale = action.after!
    const product = context.products.find((item) => item.id === sale.productId)!
    if (actions.some((other) => other.section === 'products' && other.id === product.id)) throw new Error('Revisa el producte i la venda en peticions separades.')
    const key = `${product.id}:${sale.size || ''}`
    const total = (proposedSales.get(key) || 0) + (sale.quantity as number)
    proposedSales.set(key, total)
    const alreadySold = context.sales.filter((item) => item.productId === product.id && (!product.sizes?.length || item.size === sale.size)).reduce((sum, item) => sum + item.quantity, 0)
    const stock = product.sizes?.length ? product.sizes.find((size) => size.name === sale.size)!.stock : product.stock
    if (alreadySold + total > stock) throw new Error('Les vendes proposades superen l’estoc disponible.')
  }
  return actions
}
