import { Check, Palette } from 'lucide-react'

export type ThemeId = 'classic' | 'live-stage' | 'club' | 'paper'

const themes: Array<{ id: ThemeId; name: string; description: string; className: string; colors: string[] }> = [
  { id: 'classic', name: 'Clàssic Escena', description: 'Blau net i familiar, pensat per treballar cada dia.', className: 'theme-classic', colors: ['#182846', '#3c5add', '#f5f7fb'] },
  { id: 'live-stage', name: 'Live stage', description: 'Tinta fosca, coral d’escenari i ambient de backstage.', className: 'theme-live-stage', colors: ['#211c24', '#c8423b', '#f3efe8'] },
  { id: 'club', name: 'Club nocturn', description: 'Una atmosfera fosca amb accents elèctrics de sala.', className: 'theme-club', colors: ['#11151d', '#b7f34a', '#1c2430'] },
  { id: 'paper', name: 'Full de gira', description: 'Paper càlid, tinta i una estètica de roadbook.', className: 'theme-paper', colors: ['#3b3026', '#d56b42', '#f0e5d2'] },
]

export function themeClass(theme: ThemeId): string { return themes.find((item) => item.id === theme)?.className || 'theme-classic' }

export default function Settings({ theme, onThemeChange }: { theme: ThemeId; onThemeChange: (value: ThemeId) => void }) {
  return <div className="settings-shell"><div className="page-heading settings-heading"><div><span className="eyebrow">CONFIGURACIÓ DE L’ESPAI</span><h1>Tria l’ambient d’Escena<span className="heading-period">.</span></h1><p>Canvia el caràcter visual de l’aplicació sense afectar les dades ni la manera de treballar.</p></div></div><section className="settings-card"><div className="settings-card-heading"><span className="section-index"><Palette size={16} /></span><div><h2>Disseny de la web</h2><p>El canvi es desa en aquest navegador i s’aplica a totes les pantalles.</p></div></div><div className="theme-grid">{themes.map((item) => <button type="button" key={item.id} className={`theme-option ${theme === item.id ? 'theme-option-selected' : ''} ${item.className}`} onClick={() => onThemeChange(item.id)}><span className="theme-preview"><span className="theme-preview-sidebar" /><span className="theme-preview-main"><span /><span /><span /></span></span><span className="theme-option-copy"><strong>{item.name}</strong><small>{item.description}</small></span><span className="theme-swatches">{item.colors.map((color) => <i key={color} style={{ backgroundColor: color }} />)}</span>{theme === item.id ? <span className="theme-check"><Check size={14} /></span> : null}</button>)}</div></section></div>
}
