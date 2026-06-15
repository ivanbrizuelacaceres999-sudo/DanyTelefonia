import React, { useState } from 'react';
import { api } from '../api';
import { SpecialPriceItem } from '../types';
import { Tag, Clock, CheckCircle, Package, AlertTriangle } from 'lucide-react';
import { cn } from '../lib/utils';
import { NumericInput } from './ui/NumericInput';

interface PricesViewProps {
  specialPriceItems: SpecialPriceItem[];
  onRefresh: () => void;
}

const n = (v: any): number => {
  if (v === null || v === undefined || v === '') return 0;
  const x = Number(v);
  return isNaN(x) ? 0 : x;
};

export const PricesView = ({ specialPriceItems, onRefresh }: PricesViewProps) => {
  const [tab, setTab] = useState<'pending' | 'assigned'>('pending');
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pending  = specialPriceItems.filter(i => i.status === 'pending');
  const assigned = specialPriceItems.filter(i => i.status === 'assigned');

  const handleAssign = async (item: SpecialPriceItem) => {
    const priceStr = prices[item._id] ?? '';
    const price = parseInt(priceStr.replace(/\D/g, '')) || 0;
    if (price === 0) { setError('Ingresá un precio válido mayor a 0.'); return; }
    setSaving(item._id); setError(null);
    try {
      await (api as any).assignSpecialPrice(item._id, price);
      setPrices(prev => { const p = { ...prev }; delete p[item._id]; return p; });
      onRefresh();
    } catch (e: any) {
      setError(e.message ?? 'Error al asignar precio');
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-6 pb-24 md:pb-0">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 bg-pink-100 rounded-[20px] flex items-center justify-center text-pink-600">
          <Tag size={28} />
        </div>
        <div>
          <h1 className="text-3xl font-black text-gray-800 tracking-tighter">Precios Especiales</h1>
          <p className="text-sm font-bold text-gray-400">Asigná precios a ventas con precio pendiente</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {pending.length > 0 && (
            <span className="bg-pink-100 text-pink-700 font-black text-xs px-3 py-1.5 rounded-full">
              {pending.length} pendiente{pending.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-gray-100 p-1 rounded-2xl w-fit">
        <button
          onClick={() => setTab('pending')}
          className={cn('px-5 py-2 rounded-xl font-black text-sm transition-all',
            tab === 'pending' ? 'bg-white text-pink-600 shadow-sm' : 'text-gray-400 hover:text-gray-600')}>
          Pendientes {pending.length > 0 && <span className="ml-1.5 bg-pink-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">{pending.length}</span>}
        </button>
        <button
          onClick={() => setTab('assigned')}
          className={cn('px-5 py-2 rounded-xl font-black text-sm transition-all',
            tab === 'assigned' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-400 hover:text-gray-600')}>
          Asignados {assigned.length > 0 && <span className="ml-1.5 bg-emerald-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">{assigned.length}</span>}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 font-bold text-sm">
          <AlertTriangle size={15} /> {error}
        </div>
      )}

      {/* Pending list */}
      {tab === 'pending' && (
        <div className="space-y-3">
          {pending.length === 0 ? (
            <div className="text-center py-20 text-gray-300">
              <CheckCircle size={40} className="mx-auto mb-3" />
              <p className="font-black text-sm uppercase tracking-widest">Sin pendientes</p>
              <p className="text-xs font-bold mt-1">Todos los precios están asignados</p>
            </div>
          ) : pending.map(item => (
            <div key={item._id} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 bg-pink-100 rounded-xl flex items-center justify-center text-pink-600 flex-shrink-0">
                  <Package size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-gray-800 text-base leading-snug">{item.productName}</p>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    <span className="text-[10px] font-bold text-gray-400">Cantidad: <span className="text-gray-700 font-black">{item.quantity}</span></span>
                    {item.wholesalerName && (
                      <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">
                        {item.wholesalerName}
                      </span>
                    )}
                    <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1">
                      <Clock size={9} />
                      {new Date(item.saleDate).toLocaleDateString('es-PY', { day: '2-digit', month: 'short', year: '2-digit' })}
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-black text-pink-500 bg-pink-50 px-2 py-1 rounded-lg flex-shrink-0">PENDIENTE</span>
              </div>
              <div className="mt-4 flex gap-2 items-center">
                <div className="flex-1">
                  <NumericInput
                    value={prices[item._id] ?? ''}
                    onChange={raw => setPrices(prev => ({ ...prev, [item._id]: raw }))}
                    placeholder="Precio en Gs."
                    className="w-full p-3 bg-gray-50 border-2 border-gray-200 focus:border-pink-400 focus:bg-white rounded-xl outline-none font-black text-lg text-center transition-all"
                  />
                </div>
                <button
                  onClick={() => handleAssign(item)}
                  disabled={saving === item._id || !(parseInt((prices[item._id] ?? '').replace(/\D/g, '')) > 0)}
                  className="px-5 py-3 bg-pink-500 hover:bg-pink-600 text-white font-black rounded-xl shadow-lg shadow-pink-200 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap">
                  {saving === item._id
                    ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Guardando...</>
                    : <><CheckCircle size={15} /> Asignar</>
                  }
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Assigned list */}
      {tab === 'assigned' && (
        <div className="space-y-3">
          {assigned.length === 0 ? (
            <div className="text-center py-20 text-gray-300">
              <Tag size={40} className="mx-auto mb-3" />
              <p className="font-black text-sm uppercase tracking-widest">Sin precios asignados</p>
            </div>
          ) : assigned.map(item => (
            <div key={item._id} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600 flex-shrink-0">
                  <CheckCircle size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-gray-800 text-base leading-snug">{item.productName}</p>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    <span className="text-[10px] font-bold text-gray-400">Cantidad: <span className="text-gray-700 font-black">{item.quantity}</span></span>
                    {item.wholesalerName && (
                      <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">
                        {item.wholesalerName}
                      </span>
                    )}
                    <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1">
                      <Clock size={9} />
                      {new Date(item.saleDate).toLocaleDateString('es-PY', { day: '2-digit', month: 'short', year: '2-digit' })}
                    </span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-black text-emerald-600 text-xl">Gs. {n(item.specialPrice).toLocaleString()}</p>
                  <p className="text-[10px] font-bold text-gray-400">× {item.quantity} u.</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
