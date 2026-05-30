import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL  as string;
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnon);

// ─── snake_case ↔ camelCase ────────────────────────────────────
function snakeToCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}
function camelToSnake(s: string): string {
  return s.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`);
}

/** DB row (snake_case) → objeto JS (camelCase + _id alias) */
export function toClient(row: any): any {
  if (row === null || row === undefined) return row;
  if (Array.isArray(row)) return row.map(toClient);
  if (typeof row !== 'object') return row;
  const out: any = {};
  for (const [k, v] of Object.entries(row)) {
    out[snakeToCamel(k)] = v;
  }
  if (out.id) out._id = out.id;
  return out;
}

/** Objeto JS (camelCase) → fila DB (snake_case) */
export function toDB(body: any): any {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return body;
  const out: any = {};
  for (const [k, v] of Object.entries(body)) {
    if (k === '_id' || k === '__v') continue;
    out[camelToSnake(k)] = v;
  }
  return out;
}

/** Genera ticket ID para reparaciones, ej: "SRV-AB12CD" */
export function generateTicketId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return `SRV-${code}`;
}

/** Notifica a todos los clientes conectados que un recurso cambió */
export async function broadcast(event: string) {
  await supabase.channel('phonemaster-updates').send({
    type: 'broadcast',
    event: 'data_update',
    payload: { event },
  });
}
