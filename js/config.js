// ---------------------------------------------------------------
// Configuración de la plataforma
//
// Sin datos de Supabase la plataforma funciona en MODO DEMOSTRACIÓN:
// todo se guarda en el navegador de quien la usa y trae afiliados
// de ejemplo. Sirve para mostrarla y probarla.
//
// Para usarla con afiliados reales, crea un proyecto en supabase.com,
// ejecuta supabase/schema.sql y pega aquí la URL y la "anon public key"
// (Project Settings > API). La anon key es pública por diseño: la
// seguridad la dan las reglas RLS del esquema.
// ---------------------------------------------------------------
export const SUPABASE_URL = "";
export const SUPABASE_ANON_KEY = "";

// Dominio interno con el que se crean los usuarios de los afiliados.
// No se envía ningún correo a esta dirección.
export const MEMBER_EMAIL_DOMAIN = "afiliados.sebastianaleman.app";
