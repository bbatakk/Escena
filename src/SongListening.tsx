import { useCallback, useEffect, useRef, useState } from 'react'
import { AudioLines, Headphones, Music, RefreshCw } from 'lucide-react'
import { supabase } from './data'
import { formatDate, songVersionKindLabels, type SongVersionKind } from './model'
import { isSongShareToken } from './songShares'

interface ListeningVersion {
  id: string
  name: string
  kind: SongVersionKind
  recordedOn: string
  updatedAt: string
  audioUrl: string
  audioFileName: string
  audioMimeType: string
  audioSizeBytes?: number
}
interface ListeningSong { id: string; title: string; versions: ListeningVersion[]; lyrics?: string; notes?: string }
interface ListeningResponse { songs: ListeningSong[]; bandName: string; expiresAt: string; snapshotHash: string; notModified?: boolean }

function keepLiveAudio(next: ListeningResponse, previous: ListeningResponse | null): ListeningResponse {
  if (!previous) return next
  const oldVersions = new Map(previous.songs.flatMap((song) => song.versions.map((version) => [version.id, version] as const)))
  const urlExpiry = Date.now() + 2 * 60 * 1000
  return {
    ...next,
    songs: next.songs.map((song) => ({
      ...song,
      versions: song.versions.map((version) => {
        const old = oldVersions.get(version.id)
        return old?.updatedAt === version.updatedAt && old.audioUrl && Date.parse(previous.expiresAt) > urlExpiry
          ? { ...version, audioUrl: old.audioUrl }
          : version
      }),
    })),
  }
}

export default function SongListening({ token }: { token: string }) {
  const [data, setData] = useState<ListeningResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [lastChecked, setLastChecked] = useState<Date | null>(null)
  const dataRef = useRef<ListeningResponse | null>(null)

  const refresh = useCallback(async (quiet = false) => {
    if (!isSongShareToken(token)) { setError('Aquest enllaç d’escolta no és vàlid.'); setLoading(false); return }
    if (!supabase) { setError('Aquest espai d’escolta no està disponible.'); setLoading(false); return }
    if (quiet) setRefreshing(true); else setLoading(true)
    let responseStatus: number | undefined
    try {
      const current = dataRef.current
      const refreshUrls = !current || Date.parse(current.expiresAt) <= Date.now() + 2 * 60 * 1000
      const { data: result, error: invokeError } = await supabase.functions.invoke<ListeningResponse>('song-listen', { body: { token, knownSnapshot: current?.snapshotHash || '', refreshUrls } })
      if (invokeError) {
        responseStatus = (invokeError as { context?: Response }).context?.status
        throw invokeError
      }
      if (!result) throw new Error('No s’ha pogut llegir el contingut de l’enllaç.')
      if (result.notModified) {
        setLastChecked(new Date())
        setError('')
        return
      }
      if (!Array.isArray(result.songs)) throw new Error('No s’ha pogut llegir el contingut de l’enllaç.')
      const merged = keepLiveAudio(result, dataRef.current)
      dataRef.current = merged
      setData(merged)
      setLastChecked(new Date())
      setError('')
    } catch {
      if (responseStatus === 404) {
        dataRef.current = null
        setData(null)
        setError('Aquest enllaç ha caducat o ha estat revocat.')
      } else if (dataRef.current) setError('No s’han pogut actualitzar les cançons. Es manté l’última informació carregada.')
      else setError('Aquest enllaç no és vàlid, ha caducat o ha estat revocat.')
    } finally { setLoading(false); setRefreshing(false) }
  }, [token])

  useEffect(() => {
    const previousTitle = document.title
    const previousPolicy = document.querySelector('meta[name="referrer"]')
    const createdPolicy = !previousPolicy
    const policy = previousPolicy || document.createElement('meta')
    policy.setAttribute('name', 'referrer')
    policy.setAttribute('content', 'no-referrer')
    if (createdPolicy) document.head.appendChild(policy)
    document.title = 'Escolta · Escena'
    void refresh()
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh(true) }, 15_000)
    const onFocus = () => { if (document.visibilityState === 'visible') void refresh(true) }
    document.addEventListener('visibilitychange', onFocus)
    window.addEventListener('focus', onFocus)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onFocus)
      window.removeEventListener('focus', onFocus)
      document.title = previousTitle
      if (createdPolicy) policy.remove()
      else if (previousPolicy) previousPolicy.setAttribute('content', previousPolicy.getAttribute('content') || 'strict-origin-when-cross-origin')
    }
  }, [refresh])

  return (
    <main className="song-listening-page">
      <header className="song-listening-header">
        <a className="song-listening-brand" href="/" aria-label="Escena"><span>e</span> escena</a>
        <span><Headphones size={15} /> Espai privat d’escolta</span>
      </header>
      <section className="song-listening-content">
        <div className="song-listening-intro">
          <span className="eyebrow">CANÇONS EN PROCÉS</span>
          <h1>Escolta amb calma<span>.</span></h1>
          <p>Aquí trobaràs els àudios compartits de {data?.bandName || 'la banda'}.</p>
        </div>
        {loading ? <div className="song-listening-state"><span className="song-listening-spinner" /><strong>Carregant les cançons…</strong></div> : null}
        {error && !data ? <div className="song-listening-state song-listening-error"><AudioLines size={24} /><strong>Enllaç no disponible</strong><p>{error}</p></div> : null}
        {data ? <>
          <div className="song-listening-list">
            {data.songs.map((song, index) => <article className="listening-song" key={song.id}>
              <div className="listening-song-heading">
                <span className="listening-song-index">{String(index + 1).padStart(2, '0')}</span>
                <div><span className="eyebrow">CANÇÓ</span><h2>{song.title}</h2></div>
              </div>
              {song.versions.length ? <div className="listening-versions">{song.versions.map((version) => <section className="listening-version" key={version.id}>
                <div className="listening-version-meta">
                  <div><strong>{version.name}</strong><small>{songVersionKindLabels[version.kind]} · {formatDate(version.recordedOn, { day: 'numeric', month: 'short', year: 'numeric' })}</small></div>
                  <span>{version.audioFileName}</span>
                </div>
                <audio controls preload="metadata" controlsList="nodownload" src={version.audioUrl} />
              </section>)}</div> : <p className="listening-await-audio">Encara no hi ha cap àudio pujat per a aquesta cançó.</p>}
              {song.notes ? <section className="listening-song-text"><h3>Notes de treball</h3><p>{song.notes}</p></section> : null}
              {song.lyrics ? <section className="listening-song-text listening-song-lyrics"><h3>Lletra</h3><p>{song.lyrics}</p></section> : null}
            </article>)}
          </div>
          {error ? <p className="song-listening-refresh-error" role="status">{error}</p> : null}
          <footer className="song-listening-footer">
            <span>{lastChecked ? `Actualitzat ${lastChecked.toLocaleTimeString('ca-ES', { hour: '2-digit', minute: '2-digit' })} · comprovació automàtica cada 15 segons` : 'Comprovació automàtica cada 15 segons'}</span>
            <button type="button" onClick={() => void refresh(true)} disabled={refreshing}>{refreshing ? <span className="song-listening-spinner small" /> : <RefreshCw size={14} />} Actualitzar</button>
          </footer>
        </> : null}
        <div className="song-listening-signoff"><Music size={14} /> Compartit de manera privada amb Escena</div>
      </section>
    </main>
  )
}
