// ============================================================
// src/utils/notifications.ts
// Gestión centralizada de notificaciones PWA
// ============================================================

export interface NotifSettings {
  garantia: boolean;        // Nueva reparación de garantía
  ventas10: boolean;        // Más de 10 ventas en el día
  reparaciones2dias: boolean; // Reparaciones con +2 días sin avanzar
  retiros: boolean;         // Retiro de caja registrado
}

const SETTINGS_KEY  = 'dany_notif_settings';
const COOLDOWN_KEY  = 'dany_notif_cooldowns';

export const DEFAULT_SETTINGS: NotifSettings = {
  garantia: true,
  ventas10: true,
  reparaciones2dias: true,
  retiros: true,
};

// ── Configuración ────────────────────────────────────────────
export function getSettings(): NotifSettings {
  try {
    const s = localStorage.getItem(SETTINGS_KEY);
    if (s) return { ...DEFAULT_SETTINGS, ...JSON.parse(s) };
  } catch {}
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(s: NotifSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

// ── Permiso ──────────────────────────────────────────────────
export async function requestPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied';
  if (Notification.permission !== 'default') return Notification.permission;
  return await Notification.requestPermission();
}

export function getPermission(): NotificationPermission {
  if (!('Notification' in window)) return 'denied';
  return Notification.permission;
}

export function canNotify(): boolean {
  return 'Notification' in window && Notification.permission === 'granted';
}

// ── Mostrar notificación ─────────────────────────────────────
export function notify(title: string, body: string, tag?: string) {
  if (!canNotify()) return;
  try {
    new Notification(title, {
      body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-64x64.png',
      tag,
      renotify: false,
    });
  } catch (e) {
    console.warn('[PWA] Notification failed:', e);
  }
}

// ── Cooldowns (evitar spam) ──────────────────────────────────
function getCooldowns(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(COOLDOWN_KEY) || '{}'); } catch { return {}; }
}

function setCooldown(key: string) {
  const c = getCooldowns();
  c[key] = new Date().toISOString();
  localStorage.setItem(COOLDOWN_KEY, JSON.stringify(c));
}

function isInCooldown(key: string, hours: number): boolean {
  const c = getCooldowns();
  if (!c[key]) return false;
  return Date.now() - new Date(c[key]).getTime() < hours * 3_600_000;
}

// ── IDs ya notificados (no repetir en la misma sesión) ───────
const knownWarrantyIds    = new Set<string>();
const knownWithdrawalIds  = new Set<string>();
let   initialized         = false;

/**
 * Llamar UNA VEZ al abrir la app para marcar los registros ya
 * existentes como "vistos" — así no se notifican al cargar.
 */
export function initKnownIds(repairs: any[], withdrawals: any[]) {
  if (initialized) return;
  initialized = true;
  repairs.filter((r: any) => r.isWarranty).forEach((r: any) => knownWarrantyIds.add(r._id));
  withdrawals.forEach((w: any) => knownWithdrawalIds.add(w._id));
}

// ── Check 1: Garantía nueva ──────────────────────────────────
export function checkWarranty(repairs: any[], settings: NotifSettings) {
  if (!settings.garantia || !canNotify()) return;
  repairs
    .filter((r: any) => r.isWarranty && !knownWarrantyIds.has(r._id))
    .forEach((r: any) => {
      knownWarrantyIds.add(r._id);
      notify(
        '🛡️ Nueva garantía aplicada',
        `${r.deviceModel} — ${r.customerName}`,
        `warranty-${r._id}`,
      );
    });
}

// ── Check 2: Más de 10 ventas hoy ───────────────────────────
export function checkSales10(sales: any[], settings: NotifSettings) {
  if (!settings.ventas10 || !canNotify()) return;
  const today = new Date().toISOString().slice(0, 10);
  const count  = sales.filter((s: any) => (s.date ?? '').slice(0, 10) === today).length;
  if (count < 10) return;
  const key = `sales10_${today}`;
  if (isInCooldown(key, 23)) return;   // solo 1 vez por día
  setCooldown(key);
  notify(
    '🎉 ¡Más de 10 ventas hoy!',
    `Ya van ${count} ventas en el día. ¡Sigan así!`,
    'sales-10',
  );
}

// ── Check 3: Reparaciones con +2 días sin avanzar ───────────
export function checkOldRepairs(repairs: any[], settings: NotifSettings) {
  if (!settings.reparaciones2dias || !canNotify()) return;
  if (isInCooldown('old_repairs', 6)) return;   // máx 1 vez cada 6 h
  const now = Date.now();
  const old  = repairs.filter((r: any) => {
    if (r.status !== 'pending' && r.status !== 'in_progress') return false;
    if (r.isWarranty) return false;
    return now - new Date(r.createdAt).getTime() > 2 * 86_400_000;
  });
  if (old.length === 0) return;
  setCooldown('old_repairs');
  const plural = old.length > 1;
  notify(
    `⏰ ${old.length} reparación${plural ? 'es' : ''} sin resolver`,
    `Lleva${plural ? 'n' : ''} más de 2 días en espera.`,
    'old-repairs',
  );
}

// ── Check 4: Retiro de caja nuevo ───────────────────────────
export function checkWithdrawal(withdrawals: any[], settings: NotifSettings) {
  if (!settings.retiros || !canNotify()) return;
  withdrawals
    .filter((w: any) => !knownWithdrawalIds.has(w._id))
    .forEach((w: any) => {
      knownWithdrawalIds.add(w._id);
      const gs = new Intl.NumberFormat('es-PY').format(w.amount ?? 0);
      notify(
        '💸 Retiro de caja registrado',
        `${w.motive ?? 'Sin motivo'} — Gs. ${gs}`,
        `withdrawal-${w._id}`,
      );
    });
}
