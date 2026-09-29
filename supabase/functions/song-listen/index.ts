import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
}

type ShareRow = { id: string; band_id: string; expires_at: string; revoked_at: string | null; include_lyrics: boolean; include_notes: boolean }
type ProjectRow = { id: string; band_id: string; title: string; updated_at: string; lyrics?: string; notes?: string }
type VersionRow = {
  id: string
  band_id: string
  song_project_id: string
  name: string
  kind: string
  recorded_on: string
  updated_at: string
  audio_path: string
  audio_file_name: string | null
  audio_mime_type: string | null
  audio_size_bytes: number | null
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function tokenHash(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Mètode no admès.' }, 405)
  const length = Number(request.headers.get('Content-Length'))
  if (Number.isFinite(length) && length > 2048) return json({ error: 'La petició és massa gran.' }, 413)

  const serviceUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!serviceUrl || !serviceKey) return json({ error: 'El servei d’escolta no està configurat.' }, 503)

  let token = ''
  let knownSnapshot = ''
  let refreshUrls = false
  try {
    const bodyText = await request.text()
    if (bodyText.length > 2048) return json({ error: 'La petició és massa gran.' }, 413)
    const body: unknown = JSON.parse(bodyText)
    if (typeof body === 'object' && body !== null && 'token' in body && typeof body.token === 'string') {
      token = body.token
      if ('knownSnapshot' in body && typeof body.knownSnapshot === 'string') knownSnapshot = body.knownSnapshot.slice(0, 64)
      refreshUrls = body.refreshUrls === true
    }
  } catch { /* Es respon com a enllaç invàlid sense revelar detalls. */ }
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return json({ error: 'Aquest enllaç no és vàlid o ja no està actiu.' }, 404)

  try {
    const admin = createClient(serviceUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: share, error: shareError } = await admin.from('song_shares')
      .select('id,band_id,expires_at,revoked_at,include_lyrics,include_notes').eq('token_hash', await tokenHash(token)).maybeSingle()
    if (shareError || !share || share.revoked_at || new Date(share.expires_at).getTime() <= Date.now()) {
      return json({ error: 'Aquest enllaç no és vàlid o ja no està actiu.' }, 404)
    }

    const { data: band, error: bandError } = await admin.from('bands').select('name').eq('id', share.band_id).maybeSingle()
    if (bandError) throw bandError
    const bandName = typeof band?.name === 'string' && band.name.trim() ? band.name.trim().slice(0, 80) : 'la banda'

    const { data: selection, error: selectionError } = await admin.from('song_share_projects')
      .select('song_project_id').eq('share_id', share.id)
    if (selectionError) throw selectionError
    const projectIds = [...new Set((selection || []).map((item) => item.song_project_id as string))]
    if (!projectIds.length) return json({ error: 'Encara no hi ha cançons disponibles en aquest enllaç.' }, 404)

    const projectColumns = ['id', 'band_id', 'title', 'updated_at']
    if (share.include_lyrics) projectColumns.push('lyrics')
    if (share.include_notes) projectColumns.push('notes')
    const { data: projects, error: projectsError } = await admin.from('song_projects')
      .select(projectColumns.join(',')).in('id', projectIds).eq('archived', false).order('title', { ascending: true })
    if (projectsError) throw projectsError
    const projectRows = (projects || []) as ProjectRow[]
    if (!projectRows.length) return json({ error: 'Aquest enllaç no té cançons disponibles.' }, 404)

    const { data: versions, error: versionsError } = await admin.from('song_versions')
      .select('id,band_id,song_project_id,name,kind,recorded_on,updated_at,audio_path,audio_file_name,audio_mime_type,audio_size_bytes')
      .in('song_project_id', projectRows.map((item) => item.id))
      .not('audio_path', 'is', null)
      .order('recorded_on', { ascending: false }).order('created_at', { ascending: false })
    if (versionsError) throw versionsError
    const projectById = new Map(projectRows.map((project) => [project.id, project]))
    const versionRows = ((versions || []) as VersionRow[]).filter((version) => {
      const project = projectById.get(version.song_project_id)
      const parts = version.audio_path.split('/')
      return Boolean(project && version.band_id === project.band_id && parts.length === 4
        && parts[0] === project.band_id && parts[1] === project.id && parts[2] === version.id && parts[3])
    })
    const snapshotHash = await tokenHash(JSON.stringify({
      bandName,
      includeLyrics: share.include_lyrics,
      includeNotes: share.include_notes,
      projects: projectRows.map((project) => [project.id, project.title, project.updated_at,
        ...(share.include_lyrics ? [project.lyrics || ''] : []), ...(share.include_notes ? [project.notes || ''] : [])]),
      versions: versionRows.map(({ id, updated_at, audio_path }) => [id, updated_at, audio_path]),
    }))
    if (knownSnapshot === snapshotHash && !refreshUrls) return json({ notModified: true, snapshotHash })

    const signed = await Promise.all(versionRows.map(async (version) => {
      const { data, error } = await admin.storage.from('song-files').createSignedUrl(version.audio_path, 15 * 60)
      if (error || !data?.signedUrl) return null
      return {
        id: version.id,
        name: version.name,
        kind: version.kind,
        recordedOn: version.recorded_on,
        updatedAt: version.updated_at,
        audioUrl: data.signedUrl,
        audioFileName: version.audio_file_name || 'Àudio',
        audioMimeType: version.audio_mime_type || 'audio/mpeg',
        audioSizeBytes: version.audio_size_bytes === null ? undefined : Number(version.audio_size_bytes),
      }
    }))
    const versionsByProject = new Map<string, NonNullable<(typeof signed)[number]>[]>()
    versionRows.forEach((version, index) => {
      const item = signed[index]
      if (item) versionsByProject.set(version.song_project_id, [...(versionsByProject.get(version.song_project_id) || []), item])
    })
    const songs = projectRows.map((project) => ({
      id: project.id,
      title: project.title,
      versions: versionsByProject.get(project.id) || [],
      ...(share.include_lyrics && project.lyrics ? { lyrics: project.lyrics } : {}),
      ...(share.include_notes && project.notes ? { notes: project.notes } : {}),
    }))
    return json({ songs, bandName, snapshotHash, expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString() })
  } catch {
    return json({ error: 'No s’ha pogut carregar aquest espai d’escolta.' }, 503)
  }
})
