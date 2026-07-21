import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

let _client = null;

export async function getClient() {
  if (_client) return _client;
  const res  = await fetch('./data/config.json');
  const cfg  = await res.json();
  _client = createClient(cfg.supabase.url, cfg.supabase.anonKey);
  return _client;
}

/**
 * Fetch all public songs from the `canciones` table.
 * Returns an array shaped for the audio player:
 *   { id, title, artist, url, tipo }
 */
export async function fetchCanciones() {
  const sb = await getClient();
  const { data, error } = await sb
    .from('canciones')
    .select('id, titulo, artista, url, path, tipo, creado_en')
    .eq('publico', true)
    .order('creado_en', { ascending: false });

  if (error) throw new Error(`Supabase error: ${error.message}`);

  return (data || []).map((row) => ({
    id:     row.id,
    title:  row.titulo  || 'Sin título',
    artist: row.artista || 'Artista desconocido',
    url:    row.url,
    tipo:   row.tipo    || 'cancion',
    art:    null,
  }));
}
