import { createClient } from 'npm:@supabase/supabase-js@2'

const allowedOrigins = new Set([
  'https://escenaweb.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  ...(Deno.env.get('APP_ORIGIN') || '').split(',').map((origin) => origin.trim()).filter(Boolean),
])

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('Origin') || ''
  return {
    'Access-Control-Allow-Origin': allowedOrigins.has(origin) ? origin : 'https://escenaweb.vercel.app',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Cache-Control': 'no-store',
    'Vary': 'Origin',
  }
}

function json(request: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(request), 'Content-Type': 'application/json' },
  })
}

async function listStorageFiles(admin: ReturnType<typeof createClient>, bucket: string, prefix: string): Promise<string[]> {
  const files: string[] = []
  let offset = 0
  const pageSize = 100

  while (true) {
    const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: pageSize, offset })
    if (error) throw error
    for (const item of data || []) {
      const path = `${prefix}/${item.name}`
      if (item.id) files.push(path)
      else files.push(...await listStorageFiles(admin, bucket, path))
    }
    if (!data || data.length < pageSize) break
    offset += pageSize
  }
  return files
}

async function removeBandStorage(admin: ReturnType<typeof createClient>, bandId: string): Promise<void> {
  for (const bucket of ['concert-documents', 'band-assets', 'merch-product-images', 'song-files']) {
    const paths = await listStorageFiles(admin, bucket, bandId)
    for (let index = 0; index < paths.length; index += 100) {
      const { error } = await admin.storage.from(bucket).remove(paths.slice(index, index + 100))
      if (error) throw error
    }
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(request) })
  if (request.method !== 'POST') return json(request, { error: 'Metode no admes.' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const authorization = request.headers.get('Authorization')
  if (!supabaseUrl || !anonKey || !serviceKey) return json(request, { error: 'El servei d’eliminacio no esta configurat.' }, 503)
  if (!authorization) return json(request, { error: 'Cal iniciar sessio.' }, 401)

  const client = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } })
  const { data: auth, error: authError } = await client.auth.getUser()
  if (authError || !auth.user) return json(request, { error: 'La sessio no es valida. Torna a entrar.' }, 401)

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  try {
    const { data: membership, error: membershipError } = await admin.from('band_members')
      .select('band_id,role').eq('user_id', auth.user.id).maybeSingle()
    if (membershipError) throw membershipError

    if (membership) {
      const { data: members, error: membersError } = await admin.from('band_members')
        .select('user_id,role').eq('band_id', membership.band_id).order('user_id')
      if (membersError) throw membersError
      const remaining = (members || []).filter((member) => member.user_id !== auth.user.id)

      if (remaining.length === 0) {
        await removeBandStorage(admin, membership.band_id)
        const { error: bandError } = await admin.from('bands').delete().eq('id', membership.band_id)
        if (bandError) throw bandError
      } else if (membership.role === 'owner' && !remaining.some((member) => member.role === 'owner')) {
        const { error: transferError } = await admin.from('band_members').update({ role: 'owner' })
          .eq('band_id', membership.band_id).eq('user_id', remaining[0].user_id)
        if (transferError) throw transferError
      }
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(auth.user.id)
    if (deleteError) throw deleteError
    return json(request, { deleted: true })
  } catch (error) {
    console.error('delete-account failed', error)
    return json(request, { error: 'No s’ha pogut eliminar completament el compte. Torna-ho a provar.' }, 500)
  }
})
