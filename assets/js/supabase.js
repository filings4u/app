const CONFIG = window.S4U_SUPABASE_CONFIG;
if(!CONFIG?.url || !CONFIG?.publishableKey){
  throw new Error('Screenings4u Supabase configuration is missing. Load supabase-config.js before portal modules.');
}
const {createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
const supabase=createClient(CONFIG.url,CONFIG.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
export {supabase};
