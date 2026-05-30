import React, { useState, useEffect, useCallback } from 'react';
// ✅ CORRECCIÓN: importamos de react-qr-code (el que instalaste)
import QRCode from 'react-qr-code';
import { Wifi, RefreshCw, Copy, Check, Monitor, Smartphone, Shield, AlertCircle } from 'lucide-react';

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface NetworkInfo {
  ip: string;
  tailscaleIp: string | null;
  port: number;
  pin: string;
}

// ─── Componente Principal ─────────────────────────────────────────────────────
export const WebConnectView = () => {
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'local' | 'tailscale'>('local');

  // ── Obtiene la IP y PIN desde el servidor ──────────────────────────────────
  // ✅ CORRECCIÓN: ruta cambiada a /api/network-info (la que agregamos en server.ts)
  const fetchNetworkInfo = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch('/api/network-info');
      if (!res.ok) throw new Error('No se pudo obtener la información de red');
      const data: NetworkInfo = await res.json();
      setNetworkInfo(data);
    } catch (err) {
      setError('Error al obtener la IP local. ¿El servidor está corriendo?');
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Regenera el PIN (cambia el QR) ─────────────────────────────────────────
  // ✅ CORRECCIÓN: ruta cambiada a /api/regenerate-pin (la que agregamos en server.ts)
  const regeneratePin = async () => {
    try {
      setRegenerating(true);
      const res = await fetch('/api/regenerate-pin', { method: 'POST' });
      if (!res.ok) throw new Error('No se pudo regenerar el PIN');
      const { pin } = await res.json();
      setNetworkInfo(prev => prev ? { ...prev, pin } : null);
    } catch {
      setError('Error al regenerar el PIN');
    } finally {
      setRegenerating(false);
    }
  };

  // ── Copia la URL al portapapeles ───────────────────────────────────────────
  const copyUrl = async () => {
    if (!networkInfo) return;
    await navigator.clipboard.writeText(qrUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    fetchNetworkInfo();
  }, [fetchNetworkInfo]);

  // ── IP activa según el modo seleccionado ──────────────────────────────────
  const activeIp = mode === 'tailscale' && networkInfo?.tailscaleIp
    ? networkInfo.tailscaleIp
    : networkInfo?.ip ?? '';

  // ── URL que se codifica en el QR ───────────────────────────────────────────
  const qrUrl = networkInfo
    ? `http://${activeIp}:${networkInfo.port}?pin=${networkInfo.pin}`
    : '';

  // ── Render: estado de carga ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto" />
          <p className="text-gray-500 font-medium">Detectando red local...</p>
        </div>
      </div>
    );
  }

  // ── Render: error ──────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-4 max-w-sm">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
          <p className="text-red-500 font-semibold">{error}</p>
          <button
            onClick={fetchNetworkInfo}
            className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  // ── Render: vista principal ────────────────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto space-y-8">

      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
          <Wifi className="text-white" size={28} />
        </div>
        <div>
          <h1 className="text-3xl font-black text-gray-800 tracking-tight">Conexión Web</h1>
          <p className="text-gray-400 font-medium mt-0.5">
            Conectá otros dispositivos a la misma red WiFi
          </p>
        </div>
      </div>

      {/* Estado de conexión Tailscale */}
      {networkInfo && (
        <div className={`flex items-center gap-4 px-5 py-4 rounded-2xl border ${
          networkInfo.tailscaleIp
            ? 'bg-emerald-50 border-emerald-200'
            : 'bg-red-50 border-red-200'
        }`}>
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 text-xl ${
            networkInfo.tailscaleIp ? 'bg-emerald-100' : 'bg-red-100'
          }`}>
            {networkInfo.tailscaleIp ? '🟢' : '🔴'}
          </div>
          <div className="flex-1">
            {networkInfo.tailscaleIp ? (
              <>
                <p className="font-bold text-emerald-700 text-sm">
                  Esta PC está conectada a Tailscale — podés usar la VPN
                </p>
                <p className="text-xs text-emerald-600 mt-0.5">
                  IP Tailscale:{' '}
                  <span className="font-mono font-black">{networkInfo.tailscaleIp}</span>
                  {' '}— Cualquier dispositivo con Tailscale puede conectarse desde cualquier lugar
                </p>
              </>
            ) : (
              <>
                <p className="font-bold text-red-600 text-sm">
                  Tailscale no está activo en esta PC
                </p>
                <p className="text-xs text-red-500 mt-0.5">
                  Abrí Tailscale, iniciá sesión y conectate para habilitar el acceso remoto por VPN
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Toggle: Red local / Tailscale */}
      <div className="flex gap-2 p-1 bg-gray-100 rounded-2xl w-fit">
        <button
          onClick={() => setMode('local')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
            mode === 'local'
              ? 'bg-white text-indigo-700 shadow-md'
              : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          <Wifi size={16} />
          Red local (WiFi)
        </button>
        <button
          onClick={() => setMode('tailscale')}
          disabled={!networkInfo?.tailscaleIp}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
            mode === 'tailscale'
              ? 'bg-white text-emerald-700 shadow-md'
              : 'text-gray-400 hover:text-gray-600'
          } disabled:opacity-40 disabled:cursor-not-allowed`}
          title={!networkInfo?.tailscaleIp ? 'Tailscale no detectado en este equipo' : ''}
        >
          <Shield size={16} />
          Tailscale (remoto)
          {networkInfo?.tailscaleIp && (
            <span className="bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5 rounded-full">
              {networkInfo.tailscaleIp}
            </span>
          )}
        </button>
      </div>

      {mode === 'tailscale' && !networkInfo?.tailscaleIp && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3 items-start">
          <AlertCircle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-700 font-medium">
            Tailscale no está instalado o no está activo en este equipo.
            Instalá Tailscale y volvé a esta pantalla para conectarte de forma remota.
          </p>
        </div>
      )}

      {/* Contenido principal: QR + Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Panel izquierdo: QR */}
        <div className="bg-white rounded-3xl p-8 shadow-xl shadow-gray-100 border border-gray-100 flex flex-col items-center gap-6">
          <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">
            Escaneá con el celular
          </p>

          {/* QR Code */}
          <div className="p-4 bg-white rounded-2xl border-4 border-indigo-50 shadow-inner">
            <QRCode
              value={qrUrl}
              size={220}
              bgColor="#FFFFFF"
              fgColor="#3730a3"
              level="M"
            />
          </div>

          {/* PIN destacado */}
          <div className="w-full bg-indigo-50 rounded-2xl p-4 text-center">
            <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-1">
              PIN de acceso
            </p>
            <div className="flex justify-center gap-3">
              {networkInfo!.pin.split('').map((digit, i) => (
                <span
                  key={i}
                  className="w-12 h-14 bg-white rounded-xl flex items-center justify-center text-2xl font-black text-indigo-700 shadow-sm border border-indigo-100"
                >
                  {digit}
                </span>
              ))}
            </div>
          </div>

          {/* Botón regenerar PIN */}
          <button
            onClick={regeneratePin}
            disabled={regenerating}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-indigo-200 w-full justify-center"
          >
            <RefreshCw size={18} className={regenerating ? 'animate-spin' : ''} />
            {regenerating ? 'Regenerando...' : 'Nuevo QR / PIN'}
          </button>
          <p className="text-xs text-gray-400 text-center -mt-3">
            El QR anterior quedará inválido
          </p>
        </div>

        {/* Panel derecho: Info de conexión + instrucciones */}
        <div className="space-y-4">

          {/* URL de conexión */}
          <div className="bg-white rounded-3xl p-6 shadow-xl shadow-gray-100 border border-gray-100">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
              URL de conexión
            </p>
            <div className="flex items-center gap-3 bg-gray-50 rounded-2xl p-4 border border-gray-100">
              <code className="flex-1 text-sm font-mono text-indigo-700 break-all leading-relaxed">
                {qrUrl}
              </code>
              <button
                onClick={copyUrl}
                className="flex-shrink-0 p-2 hover:bg-white rounded-xl transition-colors text-gray-400 hover:text-indigo-600"
                title="Copiar URL"
              >
                {copied ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="bg-gray-50 rounded-2xl p-3 text-center">
                <p className="text-xs text-gray-400 font-bold">
                  {mode === 'tailscale' ? 'IP Tailscale' : 'IP Local'}
                </p>
                <p className="text-lg font-black text-gray-700 font-mono">{activeIp}</p>
              </div>
              <div className="bg-gray-50 rounded-2xl p-3 text-center">
                <p className="text-xs text-gray-400 font-bold">Puerto</p>
                <p className="text-lg font-black text-gray-700 font-mono">{networkInfo!.port}</p>
              </div>
            </div>
          </div>

          {/* Instrucciones */}
          <div className="bg-white rounded-3xl p-6 shadow-xl shadow-gray-100 border border-gray-100">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
              Cómo conectarse
            </p>
            <div className="space-y-4">
              {(mode === 'local' ? [
                {
                  icon: Wifi,
                  title: 'Misma red WiFi',
                  desc: 'El celular y esta PC deben estar en el mismo WiFi',
                  color: 'bg-blue-50 text-blue-600',
                },
                {
                  icon: Smartphone,
                  title: 'Escaneá el QR',
                  desc: 'Abrí la cámara y apuntá al código QR',
                  color: 'bg-purple-50 text-purple-600',
                },
                {
                  icon: Shield,
                  title: 'PIN incluido',
                  desc: 'El PIN ya está en el QR. No hace falta escribirlo.',
                  color: 'bg-green-50 text-green-600',
                },
                {
                  icon: Monitor,
                  title: 'Usá tu rol',
                  desc: 'Iniciá sesión con tu usuario y tu rol correspondiente.',
                  color: 'bg-orange-50 text-orange-600',
                },
              ] : [
                {
                  icon: Shield,
                  title: 'Tailscale activo',
                  desc: 'El dispositivo remoto debe tener Tailscale instalado y conectado a tu red.',
                  color: 'bg-emerald-50 text-emerald-600',
                },
                {
                  icon: Smartphone,
                  title: 'Escaneá el QR',
                  desc: 'Usá la cámara o abrí la URL en el navegador del dispositivo remoto.',
                  color: 'bg-purple-50 text-purple-600',
                },
                {
                  icon: Wifi,
                  title: 'Sin límite de distancia',
                  desc: `Funciona desde cualquier lugar del mundo usando la IP ${networkInfo?.tailscaleIp ?? '100.x.x.x'}.`,
                  color: 'bg-blue-50 text-blue-600',
                },
                {
                  icon: Monitor,
                  title: 'Usá tu rol',
                  desc: 'Iniciá sesión con tu usuario y tu rol correspondiente.',
                  color: 'bg-orange-50 text-orange-600',
                },
              ]).map(({ icon: Icon, title, desc, color }) => (
                <div key={title} className="flex items-start gap-4">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
                    <Icon size={18} />
                  </div>
                  <div>
                    <p className="font-bold text-gray-700 text-sm">{title}</p>
                    <p className="text-xs text-gray-400 leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Aviso de seguridad */}
          <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100 flex gap-3">
            <Shield size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 font-medium leading-relaxed">
              <span className="font-bold">Seguridad:</span> El PIN cambia cada vez que hacés clic en "Nuevo QR / PIN".
              Si alguien no debería conectarse, regenerá el QR para invalidar el acceso anterior.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
