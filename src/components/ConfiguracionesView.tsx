import React, { useState, useEffect } from 'react';
import { Bell, BellOff, Shield, ShoppingBag, Wrench, ArrowDownLeft, Settings } from 'lucide-react';
import {
  getSettings, saveSettings, getPermission, requestPermission,
  NotifSettings,
} from '../utils/notifications';
import { cn } from '../lib/utils';

// ── Toggle switch ────────────────────────────────────────────────
const Toggle = ({
  checked, onChange, disabled = false,
}: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) => (
  <button
    onClick={() => !disabled && onChange(!checked)}
    className={cn(
      'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200',
      disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
      checked ? 'bg-indigo-600' : 'bg-gray-200',
    )}
  >
    <span className={cn(
      'inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200',
      checked ? 'translate-x-6' : 'translate-x-1',
    )} />
  </button>
);

// ── Row de configuración ─────────────────────────────────────────
const NotifRow = ({
  icon: Icon, color, title, description, checked, onChange, disabled,
}: {
  icon: React.ElementType;
  color: string;
  title: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) => (
  <div className={cn(
    'flex items-center justify-between p-4 rounded-2xl border transition-all',
    checked && !disabled ? 'bg-indigo-50 border-indigo-100' : 'bg-white border-gray-100',
    disabled && 'opacity-50',
  )}>
    <div className="flex items-center gap-3">
      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', color)}>
        <Icon size={18} />
      </div>
      <div>
        <p className="font-black text-gray-800 text-sm">{title}</p>
        <p className="text-[10px] font-bold text-gray-400 mt-0.5">{description}</p>
      </div>
    </div>
    <Toggle checked={checked} onChange={onChange} disabled={disabled} />
  </div>
);

export const ConfiguracionesView = () => {
  const [permission, setPermission] = useState<NotificationPermission>(getPermission());
  const [settings,   setSettings]   = useState<NotifSettings>(getSettings());
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    setPermission(getPermission());
    setSettings(getSettings());
  }, []);

  const updateSetting = (key: keyof NotifSettings, value: boolean) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    saveSettings(next);
  };

  const handleRequestPermission = async () => {
    setRequesting(true);
    const result = await requestPermission();
    setPermission(result);
    setRequesting(false);
  };

  const disabled = permission !== 'granted';

  return (
    <div className="space-y-8 max-w-2xl">

      {/* Header */}
      <div>
        <h2 className="text-4xl font-black text-gray-800 tracking-tighter">Configuraciones</h2>
        <p className="text-gray-400 font-bold tracking-widest uppercase text-[10px] mt-1">Ajustes del sistema</p>
      </div>

      {/* ── NOTIFICACIONES ── */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
            <Bell size={18} />
          </div>
          <div>
            <h3 className="font-black text-gray-800">Notificaciones</h3>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              Alertas en la barra de tareas
            </p>
          </div>
        </div>

        {/* Estado del permiso */}
        {permission === 'granted' && (
          <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-100 rounded-2xl">
            <Bell size={15} className="text-emerald-600 shrink-0" />
            <p className="text-sm font-bold text-emerald-700">Notificaciones activadas</p>
          </div>
        )}

        {permission === 'denied' && (
          <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-100 rounded-2xl">
            <BellOff size={15} className="text-red-500 shrink-0" />
            <div>
              <p className="text-sm font-bold text-red-600">Notificaciones bloqueadas</p>
              <p className="text-[10px] font-bold text-red-400 mt-0.5">
                Habilitá los permisos desde la configuración del navegador para este sitio.
              </p>
            </div>
          </div>
        )}

        {permission === 'default' && (
          <button
            onClick={handleRequestPermission}
            disabled={requesting}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-indigo-600 text-white font-black text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50 cursor-pointer">
            <Bell size={16} />
            {requesting ? 'Solicitando permiso...' : 'Activar notificaciones'}
          </button>
        )}

        {/* Toggles */}
        <div className="space-y-3">
          <NotifRow
            icon={Shield}
            color="bg-red-100 text-red-600"
            title="Garantía aplicada"
            description="Notifica cuando se crea una nueva reparación de garantía"
            checked={settings.garantia}
            onChange={v => updateSetting('garantia', v)}
            disabled={disabled}
          />
          <NotifRow
            icon={ShoppingBag}
            color="bg-emerald-100 text-emerald-600"
            title="Más de 10 ventas hoy"
            description="Notifica cuando el total de ventas del día supera 10"
            checked={settings.ventas10}
            onChange={v => updateSetting('ventas10', v)}
            disabled={disabled}
          />
          <NotifRow
            icon={Wrench}
            color="bg-amber-100 text-amber-600"
            title="Reparaciones sin resolver (+2 días)"
            description="Alerta si hay reparaciones pendientes o en proceso por más de 2 días"
            checked={settings.reparaciones2dias}
            onChange={v => updateSetting('reparaciones2dias', v)}
            disabled={disabled}
          />
          <NotifRow
            icon={ArrowDownLeft}
            color="bg-orange-100 text-orange-600"
            title="Retiro de caja"
            description="Notifica cada vez que se registra un retiro de caja"
            checked={settings.retiros}
            onChange={v => updateSetting('retiros', v)}
            disabled={disabled}
          />
        </div>

        {disabled && permission !== 'denied' && (
          <p className="text-[10px] font-bold text-gray-400 text-center">
            Activá las notificaciones arriba para configurar cada tipo
          </p>
        )}
      </div>

      {/* ── MÁS CONFIGURACIONES (futuras) ── */}
      <div className="text-center py-16 bg-white rounded-[30px] border border-gray-100">
        <Settings size={36} className="mx-auto mb-3 text-gray-200" />
        <p className="font-black text-gray-300 uppercase tracking-widest text-sm">Más opciones próximamente</p>
      </div>
    </div>
  );
};
