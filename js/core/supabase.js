import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const supabaseUrl = 'https://ipaayevpoqllucltvuhj.supabase.co'

const supabaseKey = 'sb_publishable_W8Fb0EBl25_CpE24YnFazg_ff_cBrNk'

export const supabase = createClient(
 supabaseUrl,
 supabaseKey,
 {
  auth:{
   persistSession:true,
   autoRefreshToken:true,
   detectSessionInUrl:true
  }
 }
)