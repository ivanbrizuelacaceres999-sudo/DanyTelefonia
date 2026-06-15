// ============================================================
// src/socket.ts — Realtime via Supabase Broadcast
// Misma interfaz que antes (socket.on / socket.off)
// para que App.tsx no necesite cambios en los listeners
// ============================================================

import { supabase } from './lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

export type UpdateEvent =
  | 'products' | 'repairs' | 'sales' | 'users'
  | 'categories' | 'wholesalers' | 'fixed-costs'
  | 'repair-types' | 'warranties' | 'sessions'
  | 'cash-withdrawals' | 'withdrawal-motives'
  | 'reventa-items' | 'reventa-suppliers'
  | 'manufacturers' | 'stock-movements'
  | 'special-price-items';

type Handler = (payload: { event: UpdateEvent }) => void;

const listeners = new Map<string, Set<Handler>>();
let channel: RealtimeChannel | null = null;

// Objeto con la misma interfaz que socket.io-client
export const socket = {
  connected: false,
  on(event: string, handler: Handler) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event)!.add(handler);
  },
  off(event: string, handler: Handler) {
    listeners.get(event)?.delete(handler);
  },
};

export function connectSocket() {
  if (channel) return;
  socket.connected = true;

  channel = supabase
    .channel('phonemaster-updates')
    .on('broadcast', { event: 'data_update' }, ({ payload }) => {
      const handlers = listeners.get('data_update');
      if (handlers) handlers.forEach(h => h(payload as { event: UpdateEvent }));
    })
    .subscribe();
}

export function disconnectSocket() {
  if (channel) {
    supabase.removeChannel(channel);
    channel = null;
  }
  socket.connected = false;
}
