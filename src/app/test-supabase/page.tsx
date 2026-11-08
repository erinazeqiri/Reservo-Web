import { supabase } from '@/lib/supabase'

export default async function TestSupabase() {
  const { data, error } = await supabase
    .from('businesses')
    .select('*')
    .limit(1)

  return (
    <main style={{ padding: '40px' }}>
      <h1>Supabase Connection Test</h1>

      {error ? (
        <p>Connected, but query failed: {error.message}</p>
      ) : (
        <p>Successfully connected to Supabase!</p>
      )}
    </main>
  )
}