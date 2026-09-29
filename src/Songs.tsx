import { useEffect, useState, type FormEvent } from 'react'
import { Archive, ExternalLink, FileAudio, Music, Pause, Pencil, Play, Plus, RotateCcw, Save, Search, Trash2, Upload, X } from 'lucide-react'
import { cloudConfigured, deleteSongVersion, listSongProjects, listSongVersions, removeSongVersionAudio, saveSongProject, saveSongVersion, signedSongAudioUrl, uploadSongVersionAudio } from './data'
import { createId, formatDate, songStatusLabels, songVersionKindLabels, type SongProject, type SongProjectStatus, type SongVersion, type SongVersionKind } from './model'

const statuses = Object.keys(songStatusLabels) as SongProjectStatus[]
const versionKinds = Object.keys(songVersionKindLabels) as SongVersionKind[]

function today(): string {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function fileSize(bytes?: number): string {
  if (!bytes) return ''
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toLocaleString('ca-ES', { maximumFractionDigits: 1 })} MB` : `${Math.ceil(bytes / 1024)} KB`
}

function safeUrl(value: string): string | null {
  try { const url = new URL(value); return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null } catch { return null }
}

interface VersionDraft { name: string; kind: SongVersionKind; recordedOn: string; notes: string; externalUrl: string }
const emptyVersion = (): VersionDraft => ({ name: '', kind: 'demo', recordedOn: today(), notes: '', externalUrl: '' })

export default function Songs({ onDirtyChange }: { onDirtyChange: (dirty: boolean) => void }) {
  const [projects, setProjects] = useState<SongProject[]>([])
  const [versions, setVersions] = useState<SongVersion[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<SongProject | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'totes' | SongProjectStatus>('totes')
  const [showArchived, setShowArchived] = useState(false)
  const [versionDraft, setVersionDraft] = useState<VersionDraft>(emptyVersion)
  const [editingVersionId, setEditingVersionId] = useState<string | null>(null)
  const [versionFile, setVersionFile] = useState<File | null>(null)
  const [audioLinks, setAudioLinks] = useState<Record<string, string>>({})
  const [loadingAudio, setLoadingAudio] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const load = () => {
      void Promise.all([listSongProjects(), listSongVersions()]).then(([nextProjects, nextVersions]) => {
        if (!active) return
        setProjects(nextProjects)
        setVersions(nextVersions)
        setSelectedId((current) => current && nextProjects.some((item) => item.id === current) ? current : nextProjects.find((item) => !item.archived)?.id || nextProjects[0]?.id || null)
        setError('')
      }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'No s’han pogut carregar les cançons.') }).finally(() => { if (active) setLoading(false) })
    }
    load()
    window.addEventListener('escena:offline-queue-change', load)
    return () => { active = false; window.removeEventListener('escena:offline-queue-change', load) }
  }, [])

  const selected = projects.find((project) => project.id === selectedId) || null
  useEffect(() => { setDraft(selected ? { ...selected } : null); setEditingVersionId(null); setVersionDraft(emptyVersion()); setVersionFile(null) }, [selected?.id, selected?.updatedAt])

  const visibleProjects = projects.filter((project) => project.archived === showArchived
    && (status === 'totes' || project.status === status)
    && `${project.title} ${project.notes} ${project.lyrics}`.toLocaleLowerCase('ca').includes(search.toLocaleLowerCase('ca')))
    .sort((a, b) => (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || ''))
  const selectedVersions = versions.filter((version) => version.songId === selectedId)
    .sort((a, b) => b.recordedOn.localeCompare(a.recordedOn) || (b.createdAt || '').localeCompare(a.createdAt || ''))
  const currentVersion = versions.find((version) => version.id === editingVersionId)
  const projectDirty = Boolean(draft && selected && (draft.title !== selected.title || draft.status !== selected.status || draft.notes !== selected.notes || draft.lyrics !== selected.lyrics))
  const cleanVersionDraft = currentVersion ? { name: currentVersion.name, kind: currentVersion.kind, recordedOn: currentVersion.recordedOn, notes: currentVersion.notes, externalUrl: currentVersion.externalUrl } : emptyVersion()
  const versionDirty = Boolean(versionFile || Object.keys(versionDraft).some((key) => versionDraft[key as keyof VersionDraft] !== cleanVersionDraft[key as keyof VersionDraft]))
  const dirty = projectDirty || versionDirty

  useEffect(() => { onDirtyChange(dirty) }, [dirty, onDirtyChange])
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault() }
    window.addEventListener('beforeunload', warn)
    return () => { window.removeEventListener('beforeunload', warn); onDirtyChange(false) }
  }, [dirty, onDirtyChange])

  function confirmDraftChange(): boolean {
    return !dirty || window.confirm('Hi ha canvis sense desar. Vols descartar-los?')
  }

  function selectProject(id: string | null) {
    if (!confirmDraftChange()) return
    setSelectedId(id)
  }

  async function createProject(event: FormEvent) {
    event.preventDefault(); if (!confirmDraftChange()) return; setBusy(true); setError('')
    try {
      const saved = await saveSongProject({ id: createId(), title: newTitle, status: 'idea', notes: '', lyrics: '', archived: false })
      setProjects((items) => [saved, ...items]); setSelectedId(saved.id); setNewTitle(''); setShowArchived(false)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No s’ha pogut crear la cançó.') }
    finally { setBusy(false) }
  }

  async function saveProject(event: FormEvent) {
    event.preventDefault(); if (!draft) return; setBusy(true); setError('')
    try { const saved = await saveSongProject(draft); setProjects((items) => items.map((item) => item.id === saved.id ? saved : item)); setDraft(saved) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No s’ha pogut desar la cançó.') }
    finally { setBusy(false) }
  }

  async function toggleArchive(project: SongProject) {
    if (versionDirty && !window.confirm('Hi ha una versió sense desar. Vols descartar-la i continuar?')) return
    setBusy(true); setError('')
    try {
      const saved = await saveSongProject({ ...(draft?.id === project.id ? draft : project), archived: !project.archived })
      setProjects((items) => items.map((item) => item.id === saved.id ? saved : item))
      setSelectedId(null); setShowArchived(saved.archived)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No s’ha pogut actualitzar la cançó.') }
    finally { setBusy(false) }
  }

  function editVersion(version: SongVersion) {
    if (!confirmDraftChange()) return
    setEditingVersionId(version.id)
    setVersionDraft({ name: version.name, kind: version.kind, recordedOn: version.recordedOn, notes: version.notes, externalUrl: version.externalUrl })
    setVersionFile(null)
  }

  function cancelVersionEdit() { setEditingVersionId(null); setVersionDraft(emptyVersion()); setVersionFile(null) }

  async function submitVersion(event: FormEvent) {
    event.preventDefault(); if (!selected) return; setBusy(true); setError('')
    try {
      const current = versions.find((version) => version.id === editingVersionId)
      let saved = await saveSongVersion(current
        ? { ...current, ...versionDraft }
        : { id: createId(), songId: selected.id, ...versionDraft })
      setVersions((items) => [saved, ...items.filter((item) => item.id !== saved.id)])
      if (versionFile) {
        setEditingVersionId(saved.id)
        try {
          saved = await uploadSongVersionAudio(saved, versionFile)
          setVersions((items) => [saved, ...items.filter((item) => item.id !== saved.id)])
        } catch (cause) {
          setVersionFile(null)
          throw cause
        }
      }
      cancelVersionEdit()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No s’ha pogut desar la versió.') }
    finally { setBusy(false) }
  }

  async function removeVersion(version: SongVersion) {
    if (!window.confirm(`Vols eliminar la versió «${version.name}»${version.audioPath ? ' i el seu àudio' : ''}?`)) return
    setBusy(true); setError('')
    try { await deleteSongVersion(version); setVersions((items) => items.filter((item) => item.id !== version.id)); if (editingVersionId === version.id) cancelVersionEdit() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No s’ha pogut eliminar la versió.') }
    finally { setBusy(false) }
  }

  async function uploadAudio(version: SongVersion, file?: File) {
    if (!file) return; setBusy(true); setError('')
    try { const saved = await uploadSongVersionAudio(version, file); setVersions((items) => items.map((item) => item.id === saved.id ? saved : item)); setAudioLinks((links) => ({ ...links, [version.id]: '' })) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No s’ha pogut pujar l’àudio.') }
    finally { setBusy(false) }
  }

  async function removeAudio(version: SongVersion) {
    if (!window.confirm('Vols treure l’àudio d’aquesta versió?')) return
    setBusy(true); setError('')
    try { const saved = await removeSongVersionAudio(version); setVersions((items) => items.map((item) => item.id === saved.id ? saved : item)); setAudioLinks((links) => ({ ...links, [version.id]: '' })) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No s’ha pogut treure l’àudio.') }
    finally { setBusy(false) }
  }

  async function loadAudio(version: SongVersion) {
    if (!version.audioPath) return
    setLoadingAudio(version.id); setError('')
    try { const url = await signedSongAudioUrl(version.audioPath); setAudioLinks((links) => ({ ...links, [version.id]: url })) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No s’ha pogut obrir l’àudio.') }
    finally { setLoadingAudio(null) }
  }

  return <div className="songs-shell">
    <div className="page-heading songs-heading"><div><span className="eyebrow">TALLER DE CANÇONS</span><h1>Cançons en procés<span className="heading-period">.</span></h1><p>Un lloc per conservar idees, lletres, demos i maquetes mentre encara estan prenent forma.</p></div></div>
    <form className="songs-new-bar" onSubmit={(event) => void createProject(event)}><span className="songs-new-icon"><Music size={18} /></span><label><span className="sr-only">Títol de la nova cançó</span><input required maxLength={200} value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="Títol provisional de la nova cançó" /></label><button className="button button-primary" disabled={busy}><Plus size={16} /> Nova cançó</button></form>
    <div className="songs-workspace">
      <aside className="songs-browser">
        <div className="songs-browser-tools"><label className="search-box"><Search size={17} /><span className="sr-only">Cerca cançons</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cerca títol o text..." /></label><select aria-label="Filtra per fase" value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option value="totes">Totes les fases</option>{statuses.map((value) => <option value={value} key={value}>{songStatusLabels[value]}</option>)}</select></div>
        <div className="songs-browser-tabs"><button type="button" className={!showArchived ? 'is-active' : ''} onClick={() => { if (!confirmDraftChange()) return; setShowArchived(false); setSelectedId(null) }}>Actives <span>{projects.filter((item) => !item.archived).length}</span></button><button type="button" className={showArchived ? 'is-active' : ''} onClick={() => { if (!confirmDraftChange()) return; setShowArchived(true); setSelectedId(null) }}>Arxivades <span>{projects.filter((item) => item.archived).length}</span></button></div>
        <div className="song-project-list">{loading ? <p className="section-empty">Carregant cançons…</p> : visibleProjects.length ? visibleProjects.map((project) => { const count = versions.filter((version) => version.songId === project.id).length; return <button type="button" className={`song-project-row ${selectedId === project.id ? 'is-selected' : ''}`} key={project.id} onClick={() => selectProject(project.id)}><span className={`song-status-mark song-status-${project.status}`} /><span><strong>{project.title}</strong><small>{songStatusLabels[project.status]} · {count} {count === 1 ? 'versió' : 'versions'}</small></span><span className="song-row-date">{project.updatedAt ? formatDate(project.updatedAt.slice(0, 10), { day: 'numeric', month: 'short' }) : ''}</span></button> }) : <div className="songs-empty-list"><Music size={22} /><strong>{search || status !== 'totes' ? 'Cap coincidència' : showArchived ? 'No hi ha cançons arxivades' : 'Comença amb una idea'}</strong><p>{search || status !== 'totes' ? 'Canvia la cerca o els filtres.' : 'Escriu un títol provisional per obrir la primera fitxa.'}</p></div>}</div>
      </aside>
      <main className="song-studio">{draft && selected ? <>
        <form className="song-project-editor" onSubmit={(event) => void saveProject(event)}><div className="song-editor-head"><div><span className="eyebrow">FITXA DE TREBALL</span><input className="song-title-input" required maxLength={200} aria-label="Títol de la cançó" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></div><label className="song-status-select"><span>Fase</span><select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as SongProjectStatus })}>{statuses.map((value) => <option value={value} key={value}>{songStatusLabels[value]}</option>)}</select></label></div><div className="song-writing-grid"><label className="field">Notes de treball<textarea rows={7} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder="Idees d’arranjament, referències, estructura, coses per provar…" /></label><label className="field song-lyrics-field">Lletra<textarea rows={12} value={draft.lyrics} onChange={(event) => setDraft({ ...draft, lyrics: event.target.value })} placeholder="Escriu o enganxa aquí la lletra en procés…" /></label></div><div className="song-project-actions"><button className="button button-primary" disabled={busy}><Save size={15} /> Desar cançó</button><button className="text-button" type="button" disabled={busy} onClick={() => void toggleArchive(selected)}>{selected.archived ? <><RotateCcw size={14} /> Restaurar</> : <><Archive size={14} /> Arxivar</>}</button></div></form>
        <section className="song-versions-section"><div className="song-versions-heading"><div><span className="eyebrow">HISTORIAL SONOR</span><h2>Versions <span>{selectedVersions.length}</span></h2></div><p>Cada prova queda en el seu moment, sense substituir l’anterior.</p></div>
          <form className="song-version-form fields" onSubmit={(event) => void submitVersion(event)}><div className="song-version-form-head"><strong>{editingVersionId ? 'Editar versió' : 'Afegir una versió'}</strong>{editingVersionId ? <button type="button" className="icon-button" aria-label="Cancel·lar edició" onClick={cancelVersionEdit}><X size={16} /></button> : null}</div><div className="song-version-fields"><label className="field">Nom <input required maxLength={200} value={versionDraft.name} onChange={(event) => setVersionDraft({ ...versionDraft, name: event.target.value })} placeholder="Demo veu i guitarra" /></label><label className="field">Tipus <select value={versionDraft.kind} onChange={(event) => setVersionDraft({ ...versionDraft, kind: event.target.value as SongVersionKind })}>{versionKinds.map((kind) => <option key={kind} value={kind}>{songVersionKindLabels[kind]}</option>)}</select></label><label className="field">Data <input required type="date" value={versionDraft.recordedOn} onChange={(event) => setVersionDraft({ ...versionDraft, recordedOn: event.target.value })} /></label></div><label className="field">Notes <textarea rows={3} value={versionDraft.notes} onChange={(event) => setVersionDraft({ ...versionDraft, notes: event.target.value })} placeholder="Què canvia, què funciona o què falta provar" /></label><label className="field">Enllaç extern (opcional) <input type="url" value={versionDraft.externalUrl} onChange={(event) => setVersionDraft({ ...versionDraft, externalUrl: event.target.value })} placeholder="https://drive.google.com/..." /></label>{cloudConfigured ? <label className="song-file-picker"><Upload size={15} /><span>{versionFile ? versionFile.name : editingVersionId ? 'Substituir l’àudio en desar' : 'Adjuntar MP3, M4A o WAV'}</span><input type="file" accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/x-wav,.mp3,.m4a,.wav" onChange={(event) => setVersionFile(event.target.files?.[0] || null)} /></label> : <p className="song-local-note">En demo local pots guardar l’enllaç. La pujada d’àudio necessita l’espai compartit.</p>}<button className="button button-primary" disabled={busy}>{editingVersionId ? <><Save size={15} /> Desar versió</> : <><Plus size={15} /> Afegir versió</>}</button></form>
          <div className="song-version-timeline">{selectedVersions.length ? selectedVersions.map((version) => <article className="song-version-card" key={version.id}><span className="song-version-line"><i /></span><div className="song-version-card-head"><div><span>{songVersionKindLabels[version.kind]} · {formatDate(version.recordedOn, { day: 'numeric', month: 'short', year: 'numeric' })}</span><h3>{version.name}</h3></div><div><button type="button" className="icon-button" disabled={busy} aria-label={`Editar ${version.name}`} onClick={() => editVersion(version)}><Pencil size={14} /></button><button type="button" className="icon-button danger-icon" disabled={busy} aria-label={`Eliminar ${version.name}`} onClick={() => void removeVersion(version)}><Trash2 size={14} /></button></div></div>{version.notes ? <p className="song-version-notes">{version.notes}</p> : null}{version.audioPath ? <div className="song-audio-block">{audioLinks[version.id] ? <audio controls preload="metadata" src={audioLinks[version.id]} /> : <button type="button" className="song-load-audio" disabled={loadingAudio !== null} onClick={() => void loadAudio(version)}>{loadingAudio === version.id ? <Pause size={16} /> : <Play size={16} />} {loadingAudio === version.id ? 'Preparant àudio…' : 'Escoltar àudio'}</button>}<div><FileAudio size={14} /><span>{version.audioFileName || 'Fitxer d’àudio'}{version.audioSizeBytes ? ` · ${fileSize(version.audioSizeBytes)}` : ''}</span>{cloudConfigured ? <><label className="text-button">Substituir<input type="file" accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/x-wav,.mp3,.m4a,.wav" disabled={busy} onChange={(event) => { void uploadAudio(version, event.target.files?.[0]); event.target.value = '' }} /></label><button type="button" className="text-button danger-text" disabled={busy} onClick={() => void removeAudio(version)}>Treure</button></> : null}</div></div> : cloudConfigured ? <label className="song-inline-upload"><Upload size={14} /> Adjuntar àudio<input type="file" accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/x-wav,.mp3,.m4a,.wav" disabled={busy} onChange={(event) => { void uploadAudio(version, event.target.files?.[0]); event.target.value = '' }} /></label> : null}{safeUrl(version.externalUrl) ? <a className="song-external-link" href={safeUrl(version.externalUrl)!} target="_blank" rel="noreferrer">Obrir enllaç extern <ExternalLink size={13} /></a> : null}</article>) : <div className="songs-empty-versions"><FileAudio size={23} /><strong>Encara no hi ha cap versió</strong><p>Afegeix la primera idea gravada, demo o maqueta.</p></div>}</div>
        </section>
      </> : <div className="song-studio-empty"><Music size={30} /><span className="eyebrow">ESPAI DE TREBALL</span><h2>{projects.length ? 'Tria una cançó' : 'La primera idea comença aquí'}</h2><p>{projects.length ? 'Selecciona una fitxa de la llista per continuar escrivint o escoltar-ne les versions.' : 'Crea una cançó amb un títol provisional. La podràs canviar sempre que vulguis.'}</p></div>}</main>
    </div>{error ? <div className="global-error songs-error" role="alert">{error}<button type="button" aria-label="Tancar avís" onClick={() => setError('')}><X size={15} /></button></div> : null}
  </div>
}
