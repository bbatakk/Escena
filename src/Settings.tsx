import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { Check, Download, ImagePlus, Palette, Save, Trash2, Upload } from 'lucide-react'
import { cloudConfigured, exportBackup, importBackup, removeBandLogo, saveBandLogo, saveBandName, saveLocalBandLogo, validateBackup, type AppBackup } from './data'

export type ThemeId = 'classic' | 'live-stage' | 'club' | 'paper'

const themes: Array<{ id: ThemeId; name: string; description: string; className: string; colors: string[] }> = [
  { id: 'classic', name: 'Clàssic Escena', description: 'Blau net i familiar, pensat per treballar cada dia.', className: 'theme-classic', colors: ['#182846', '#3c5add', '#f5f7fb'] },
  { id: 'live-stage', name: 'Live stage', description: 'Tinta fosca, coral d’escenari i ambient de backstage.', className: 'theme-live-stage', colors: ['#211c24', '#c8423b', '#f3efe8'] },
  { id: 'club', name: 'Club nocturn', description: 'Una atmosfera fosca amb accents elèctrics de sala.', className: 'theme-club', colors: ['#11151d', '#b7f34a', '#1c2430'] },
  { id: 'paper', name: 'Full de gira', description: 'Paper càlid, tinta i una estètica de roadbook.', className: 'theme-paper', colors: ['#3b3026', '#d56b42', '#f0e5d2'] },
]

export function themeClass(theme: ThemeId): string { return themes.find((item) => item.id === theme)?.className || 'theme-classic' }

async function localLogoDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Tria un fitxer d’imatge.')
  const sourceUrl = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = sourceUrl
    await image.decode()
    const scale = Math.min(1, 512 / Math.max(image.naturalWidth, image.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('El navegador no pot processar aquesta imatge.')
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/webp', 0.86)
  } finally { URL.revokeObjectURL(sourceUrl) }
}

function WorkspaceSettings({ name, logoUrl, onSaved, onLogoChange }: { name: string; logoUrl?: string; onSaved: (name: string) => void; onLogoChange: (logo?: string) => void }) {
  const [draft, setDraft] = useState(name)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [logoBusy, setLogoBusy] = useState(false)
  const [logoMessage, setLogoMessage] = useState('')
  useEffect(() => setDraft(name), [name])
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    try { const saved = await saveBandName(draft); onSaved(saved); setDraft(saved); setMessage('Nom de l’espai actualitzat.') }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : 'No s’ha pogut desar el nom de l’espai.') }
    finally { setBusy(false) }
  }
  async function changeLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setLogoBusy(true); setLogoMessage('')
    try {
      const logo = cloudConfigured ? await saveBandLogo(file) : saveLocalBandLogo(await localLogoDataUrl(file))
      onLogoChange(logo)
      setLogoMessage('Imatge actualitzada.')
    } catch (cause) { setLogoMessage(cause instanceof Error ? cause.message : 'No s’ha pogut desar la imatge.') }
    finally { setLogoBusy(false) }
  }
  async function clearLogo() {
    setLogoBusy(true); setLogoMessage('')
    try { await removeBandLogo(); onLogoChange(undefined); setLogoMessage('Imatge eliminada.') }
    catch (cause) { setLogoMessage(cause instanceof Error ? cause.message : 'No s’ha pogut eliminar la imatge.') }
    finally { setLogoBusy(false) }
  }
  return <section className="settings-card workspace-settings-card"><div className="settings-card-heading"><div className="workspace-logo-preview">{logoUrl ? <img src={logoUrl} alt={`Imatge de ${name}`} /> : <span>{name.trim().charAt(0).toUpperCase() || 'B'}</span>}</div><div><h2>Nom de la banda o artista</h2><p>Aquest nom i la imatge apareixeran a la barra lateral.</p></div></div><div className="workspace-logo-actions"><label className="button button-secondary"><ImagePlus size={15} /> {logoBusy ? 'Pujant imatge…' : logoUrl ? 'Canviar imatge' : 'Afegir imatge'}<input className="workspace-logo-input" type="file" accept="image/*" disabled={logoBusy} onChange={(event) => void changeLogo(event)} /></label>{logoUrl ? <button type="button" className="text-button danger-text" disabled={logoBusy} onClick={() => void clearLogo()}><Trash2 size={14} /> Treure imatge</button> : null}<small>Format d’imatge habitual. A Supabase, màxim 5 MB.</small></div>{logoMessage ? <p className="backup-message" role="status">{logoMessage}</p> : null}<form className="workspace-name-form" onSubmit={(event) => void submit(event)}><label className="field">Nom artístic <input required maxLength={80} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Per exemple, Mishima" /></label><button className="button button-primary" type="submit" disabled={busy || draft.trim() === name.trim()}><Save size={15} /> {busy ? 'Desant…' : 'Desar nom'}</button></form>{message ? <p className="backup-message" role="status">{message}</p> : null}</section>
}

export default function Settings({ theme, onThemeChange, onImported, workspaceName, workspaceLogo, onWorkspaceNameChange, onWorkspaceLogoChange }: { theme: ThemeId; onThemeChange: (value: ThemeId) => void; onImported: () => void; workspaceName: string; workspaceLogo?: string; onWorkspaceNameChange: (name: string) => void; onWorkspaceLogoChange: (logo?: string) => void }) {
  const [backupBusy, setBackupBusy] = useState(false)
  const [backupMessage, setBackupMessage] = useState('')

  async function downloadBackup() {
    setBackupBusy(true)
    setBackupMessage('')
    try {
      const backup = await exportBackup()
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `escena-backup-${new Date().toISOString().slice(0, 10)}.json`
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      setBackupMessage('Backup exportat correctament.')
    } catch (cause) { setBackupMessage(cause instanceof Error ? cause.message : 'No s’ha pogut exportar el backup.') }
    finally { setBackupBusy(false) }
  }

  async function readBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setBackupBusy(true)
    setBackupMessage('')
    try {
      const parsed: unknown = JSON.parse(await file.text())
      if (!validateBackup(parsed)) throw new Error('El fitxer no és un backup d’Escena vàlid.')
      const confirmation = cloudConfigured
        ? 'Es fusionaran les dades: els registres s’afegiran o actualitzaran; les vendes ja presents no es duplicaran. La resta de dades actuals es conservaran. Vols continuar?'
        : 'El backup substituirà les dades locals d’aquest navegador. Vols continuar?'
      if (!window.confirm(confirmation)) return
      await importBackup(parsed as AppBackup)
      setBackupMessage('Backup importat. Recarregant les dades…')
      onImported()
    } catch (cause) { setBackupMessage(cause instanceof Error ? cause.message : 'No s’ha pogut importar el backup.') }
    finally { setBackupBusy(false) }
  }

  return <div className="settings-shell">
    <div className="page-heading settings-heading"><div><span className="eyebrow">CONFIGURACIÓ DE L’ESPAI</span><h1>Tria l’ambient d’Escena<span className="heading-period">.</span></h1><p>Canvia el caràcter visual de l’aplicació sense afectar les dades ni la manera de treballar.</p></div></div>
    <WorkspaceSettings name={workspaceName} logoUrl={workspaceLogo} onSaved={onWorkspaceNameChange} onLogoChange={onWorkspaceLogoChange} />
    <section className="settings-card"><div className="settings-card-heading"><span className="section-index"><Palette size={16} /></span><div><h2>Disseny de la web</h2><p>El canvi es desa en aquest navegador i s’aplica a totes les pantalles.</p></div></div><div className="theme-grid">{themes.map((item) => <button type="button" key={item.id} className={`theme-option ${theme === item.id ? 'theme-option-selected' : ''} ${item.className}`} onClick={() => onThemeChange(item.id)}><span className="theme-preview"><span className="theme-preview-sidebar" /><span className="theme-preview-main"><span /><span /><span /></span></span><span className="theme-option-copy"><strong>{item.name}</strong><small>{item.description}</small></span><span className="theme-swatches">{item.colors.map((color) => <i key={color} style={{ backgroundColor: color }} />)}</span>{theme === item.id ? <span className="theme-check"><Check size={14} /></span> : null}</button>)}</div></section>
    <section className="settings-card backup-card"><div className="settings-card-heading"><span className="section-index"><Download size={16} /></span><div><h2>Backup de l’espai</h2><p>Exporta concerts, documents, tresoreria, marxandatge i catàlegs en un fitxer JSON.</p></div></div><div className="backup-actions"><button type="button" className="button button-secondary" disabled={backupBusy} onClick={() => void downloadBackup()}><Download size={15} /> Exportar backup</button><label className="button button-primary"><Upload size={15} /> Importar backup<input type="file" accept="application/json,.json" disabled={backupBusy} onChange={(event) => void readBackup(event)} /></label></div>{backupMessage ? <p className="backup-message" role="status">{backupMessage}</p> : null}<small className="backup-note">{cloudConfigured ? 'Amb Supabase, la importació actualitza o afegeix registres a la banda actual i conserva la resta. No substitueix fitxers físics ni credencials.' : 'En mode local, la importació substitueix les dades d’aquest navegador. No inclou fitxers físics ni credencials.'}</small></section>
  </div>
}
