import React, { useState } from 'react';
import { ShoppingBag, Plus, Trash2, Edit2, Check, X, Building2 } from 'lucide-react';
import { ReventaItem, ReventaSupplier } from '../types';
import { api } from '../api';
import { NumericInput } from './ui/NumericInput';
import { cn } from '../lib/utils';
import { AnimatePresence, motion } from 'motion/react';

interface ReventasViewProps {
  reventaItems: ReventaItem[];
  reventaSuppliers: ReventaSupplier[];
  onRefresh: () => void;
}

const n = (v: any): number => {
  if (v === null || v === undefined || v === '') return 0;
  const x = Number(v);
  return isNaN(x) ? 0 : x;
};

export const ReventasView = ({ reventaItems, reventaSuppliers, onRefresh }: ReventasViewProps) => {
  const [tab, setTab] = useState<'compras' | 'proveedores'>('compras');
  const [filterSupplier, setFilterSupplier] = useState('');
  const [showNewPurchase, setShowNewPurchase] = useState(false);
  const [showNewSupplier, setShowNewSupplier] = useState(false);
  const [form, setForm] = useState({ name: '', salePrice: '', costPrice: '', quantity: '1', supplierId: '' });
  const [supplierForm, setSupplierForm] = useState({ name: '', contact: '' });
  const [saving, setSaving] = useState(false);
  const [editingCost, setEditingCost] = useState<string | null>(null);
  const [editCostValue, setEditCostValue] = useState('');

  const displayItems = filterSupplier
    ? reventaItems.filter(i => i.supplierId === filterSupplier)
    : reventaItems;

  // Summary totals (always over ALL items, not filtered)
  const totalInvested   = reventaItems.reduce((s, i) => s + n(i.costPrice) * n(i.initialQuantity), 0);
  const soldRevenue     = reventaItems.reduce((s, i) => s + n(i.salePrice) * (n(i.initialQuantity) - n(i.quantity)), 0);
  const soldCost        = reventaItems.reduce((s, i) => s + n(i.costPrice) * (n(i.initialQuantity) - n(i.quantity)), 0);
  const profit          = soldRevenue - soldCost;
  const totalAvailable  = reventaItems.reduce((s, i) => s + n(i.quantity), 0);

  const handleCreatePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.salePrice) return;
    setSaving(true);
    try {
      await (api as any).createReventaItem({
        name: form.name.trim(),
        salePrice: parseInt(form.salePrice) || 0,
        costPrice: form.costPrice ? parseInt(form.costPrice) : null,
        quantity: parseInt(form.quantity) || 1,
        supplierId: form.supplierId || undefined,
      });
      setForm({ name: '', salePrice: '', costPrice: '', quantity: '1', supplierId: '' });
      setShowNewPurchase(false);
      onRefresh();
    } finally {
      setSaving(false);
    }
  };

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierForm.name.trim()) return;
    setSaving(true);
    try {
      await (api as any).createReventaSupplier({ name: supplierForm.name.trim(), contact: supplierForm.contact || undefined });
      setSupplierForm({ name: '', contact: '' });
      setShowNewSupplier(false);
      onRefresh();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await (api as any).deleteReventaItem(id);
    onRefresh();
  };

  const handleDeleteSupplier = async (id: string) => {
    await (api as any).deleteReventaSupplier(id);
    onRefresh();
  };

  const handleSaveCost = async (id: string) => {
    await (api as any).updateReventaItem(id, { costPrice: parseInt(editCostValue) || null });
    setEditingCost(null);
    onRefresh();
  };

  const supplierMap = Object.fromEntries(reventaSuppliers.map(s => [s._id, s.name]));

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-black text-gray-800 tracking-tighter">Reventas</h1>
          <p className="text-sm font-bold text-gray-400 mt-1">Productos comprados para revender</p>
        </div>
        <button onClick={() => setShowNewPurchase(true)}
          className="bg-orange-500 hover:bg-orange-600 text-white font-black px-5 py-3 rounded-2xl shadow-lg shadow-orange-200 flex items-center gap-2 transition-all active:scale-95 cursor-pointer">
          <Plus size={18} /> Nueva Compra
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-indigo-50 rounded-3xl p-5">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Invertido</p>
          <p className="text-xl font-black text-indigo-700 mt-1 tracking-tighter">Gs. {totalInvested.toLocaleString()}</p>
          <p className="text-[10px] font-bold text-gray-400 mt-0.5">en stock comprado</p>
        </div>
        <div className="bg-emerald-50 rounded-3xl p-5">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Vendido</p>
          <p className="text-xl font-black text-emerald-700 mt-1 tracking-tighter">Gs. {soldRevenue.toLocaleString()}</p>
          <p className="text-[10px] font-bold text-gray-400 mt-0.5">ingresos por ventas</p>
        </div>
        <div className={cn('rounded-3xl p-5', profit >= 0 ? 'bg-emerald-50' : 'bg-red-50')}>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Ganancia</p>
          <p className={cn('text-xl font-black mt-1 tracking-tighter', profit >= 0 ? 'text-emerald-700' : 'text-red-600')}>
            Gs. {profit.toLocaleString()}
          </p>
          <p className="text-[10px] font-bold text-gray-400 mt-0.5">beneficio neto</p>
        </div>
        <div className="bg-orange-50 rounded-3xl p-5">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Disponible</p>
          <p className="text-xl font-black text-orange-700 mt-1 tracking-tighter">{totalAvailable} u.</p>
          <p className="text-[10px] font-bold text-gray-400 mt-0.5">unidades en stock</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-100">
        <button onClick={() => setTab('compras')}
          className={cn('pb-3 px-1 font-black text-sm border-b-2 transition-colors',
            tab === 'compras' ? 'border-orange-500 text-orange-500' : 'border-transparent text-gray-400 hover:text-gray-600')}>
          Compras ({reventaItems.length})
        </button>
        <button onClick={() => setTab('proveedores')}
          className={cn('pb-3 px-1 font-black text-sm border-b-2 transition-colors',
            tab === 'proveedores' ? 'border-orange-500 text-orange-500' : 'border-transparent text-gray-400 hover:text-gray-600')}>
          Proveedores ({reventaSuppliers.length})
        </button>
      </div>

      {/* ── COMPRAS TAB ── */}
      {tab === 'compras' && (
        <div className="space-y-3">
          {reventaSuppliers.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setFilterSupplier('')}
                className={cn('px-4 py-2 rounded-2xl font-black text-xs cursor-pointer transition-all',
                  !filterSupplier ? 'bg-orange-500 text-white shadow-md shadow-orange-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200')}>
                Todos
              </button>
              {reventaSuppliers.map(s => (
                <button key={s._id} onClick={() => setFilterSupplier(s._id === filterSupplier ? '' : s._id)}
                  className={cn('px-4 py-2 rounded-2xl font-black text-xs cursor-pointer transition-all',
                    filterSupplier === s._id ? 'bg-orange-500 text-white shadow-md shadow-orange-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200')}>
                  {s.name}
                </button>
              ))}
            </div>
          )}

          {displayItems.length === 0 ? (
            <div className="bg-white rounded-3xl p-16 text-center border border-gray-100">
              <ShoppingBag size={40} className="mx-auto text-gray-200 mb-3" />
              <p className="font-black text-gray-300 text-lg">Sin compras registradas</p>
              <p className="text-sm font-bold text-gray-300 mt-1">Hacé click en "Nueva Compra" para agregar</p>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-gray-100 overflow-x-auto">
              {/* Header */}
              <div className="grid grid-cols-[2fr_1fr_repeat(5,auto)_32px] gap-4 px-5 py-3 border-b border-gray-100 bg-gray-50 min-w-[700px]">
                {['Producto', 'Proveedor', 'Comprado', 'Vendido', 'Disponible', 'Costo', 'Venta / Gan.', ''].map(h => (
                  <p key={h} className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{h}</p>
                ))}
              </div>

              {displayItems.map(item => {
                const sold     = n(item.initialQuantity) - n(item.quantity);
                const ganancia = (n(item.salePrice) - n(item.costPrice)) * sold;
                return (
                  <div key={item._id}
                    className="grid grid-cols-[2fr_1fr_repeat(5,auto)_32px] gap-4 px-5 py-4 border-b border-gray-100 last:border-0 items-center hover:bg-gray-50/50 transition-colors min-w-[700px]">

                    <div>
                      <p className="font-black text-gray-800 text-sm">{item.name}</p>
                      <p className="text-[10px] font-bold text-gray-400">{new Date(item.createdAt).toLocaleDateString('es-PY')}</p>
                    </div>

                    <p className="text-xs font-bold text-gray-600">
                      {item.supplierId ? (supplierMap[item.supplierId] ?? '—') : <span className="text-gray-300">—</span>}
                    </p>

                    <p className="text-sm font-black text-gray-700">{n(item.initialQuantity)}</p>

                    <p className={cn('text-sm font-black', sold > 0 ? 'text-emerald-600' : 'text-gray-300')}>{sold}</p>

                    <div className="flex items-center gap-1.5">
                      <p className={cn('text-sm font-black', n(item.quantity) === 0 ? 'text-red-500' : 'text-gray-700')}>
                        {n(item.quantity)}
                      </p>
                      {n(item.quantity) === 0 && (
                        <span className="text-[8px] font-black bg-red-100 text-red-500 px-1.5 py-0.5 rounded-full">Agotado</span>
                      )}
                    </div>

                    {/* Costo — editable inline */}
                    <div>
                      {editingCost === item._id ? (
                        <div className="flex items-center gap-1">
                          <NumericInput value={editCostValue} onChange={raw => setEditCostValue(raw)}
                            className="w-24 bg-orange-50 border border-orange-300 rounded-lg py-1 px-1.5 text-xs font-black text-orange-700 outline-none text-center" />
                          <button onClick={() => handleSaveCost(item._id)} className="text-emerald-600 hover:text-emerald-700 cursor-pointer"><Check size={13} /></button>
                          <button onClick={() => setEditingCost(null)} className="text-gray-400 hover:text-gray-600 cursor-pointer"><X size={13} /></button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setEditingCost(item._id); setEditCostValue(item.costPrice ? String(item.costPrice) : ''); }}
                          className={cn('flex items-center gap-1 cursor-pointer group', item.costPrice ? 'text-gray-700' : 'text-gray-300')}>
                          <span className="text-xs font-black">
                            {item.costPrice ? `Gs. ${n(item.costPrice).toLocaleString()}` : 'Sin costo'}
                          </span>
                          <Edit2 size={10} className="opacity-0 group-hover:opacity-60 transition-opacity text-orange-400" />
                        </button>
                      )}
                    </div>

                    <div>
                      <p className="text-xs font-black text-gray-700">Gs. {n(item.salePrice).toLocaleString()}</p>
                      {sold > 0 && (
                        <p className={cn('text-[10px] font-black', ganancia >= 0 ? 'text-emerald-600' : 'text-red-500')}>
                          {ganancia >= 0 ? '+' : ''}Gs. {ganancia.toLocaleString()}
                        </p>
                      )}
                    </div>

                    <button onClick={() => handleDelete(item._id)}
                      className="text-gray-300 hover:text-red-500 cursor-pointer transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}

              {/* Totals row */}
              {(() => {
                const totSold     = displayItems.reduce((s, i) => s + (n(i.initialQuantity) - n(i.quantity)), 0);
                const totGanancia = displayItems.reduce((s, i) => {
                  const sold = n(i.initialQuantity) - n(i.quantity);
                  return s + (n(i.salePrice) - n(i.costPrice)) * sold;
                }, 0);
                return (
                  <div className="grid grid-cols-[2fr_1fr_repeat(5,auto)_32px] gap-4 px-5 py-3 bg-orange-50/60 border-t-2 border-orange-100 min-w-[700px]">
                    <p className="text-[9px] font-black text-orange-700 uppercase tracking-widest self-center">TOTALES</p>
                    <span />
                    <p className="text-sm font-black text-orange-700">{displayItems.reduce((s, i) => s + n(i.initialQuantity), 0)}</p>
                    <p className="text-sm font-black text-emerald-700">{totSold}</p>
                    <p className="text-sm font-black text-orange-700">{displayItems.reduce((s, i) => s + n(i.quantity), 0)}</p>
                    <span />
                    <p className={cn('text-xs font-black', totGanancia >= 0 ? 'text-emerald-700' : 'text-red-600')}>
                      {totGanancia >= 0 ? '+' : ''}Gs. {totGanancia.toLocaleString()}
                    </p>
                    <span />
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* ── PROVEEDORES TAB ── */}
      {tab === 'proveedores' && (
        <div className="space-y-4">
          <button onClick={() => setShowNewSupplier(true)}
            className="flex items-center gap-2 bg-white border-2 border-dashed border-gray-200 hover:border-orange-300 hover:bg-orange-50 text-gray-400 hover:text-orange-500 font-black px-5 py-3 rounded-2xl transition-all w-full justify-center cursor-pointer">
            <Plus size={16} /> Nuevo Proveedor
          </button>

          {reventaSuppliers.length === 0 ? (
            <div className="text-center py-12 text-gray-300">
              <Building2 size={40} className="mx-auto mb-3" />
              <p className="font-black text-sm">Sin proveedores todavía</p>
            </div>
          ) : (
            <div className="space-y-4">
              {reventaSuppliers.map(s => {
                const items      = reventaItems.filter(i => i.supplierId === s._id);
                const invested   = items.reduce((sum, i) => sum + n(i.costPrice) * n(i.initialQuantity), 0);
                const sRevenue   = items.reduce((sum, i) => sum + n(i.salePrice) * (n(i.initialQuantity) - n(i.quantity)), 0);
                const sCost      = items.reduce((sum, i) => sum + n(i.costPrice) * (n(i.initialQuantity) - n(i.quantity)), 0);
                const gain       = sRevenue - sCost;
                return (
                  <div key={s._id} className="bg-white rounded-3xl border border-gray-100 p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-black text-gray-800 text-lg">{s.name}</h3>
                        {s.contact && <p className="text-sm font-bold text-gray-400">{s.contact}</p>}
                      </div>
                      <button onClick={() => handleDeleteSupplier(s._id)}
                        className="text-gray-300 hover:text-red-500 cursor-pointer p-1 transition-colors">
                        <Trash2 size={15} />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                      <div className="bg-gray-50 rounded-2xl p-3 text-center">
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Compras</p>
                        <p className="text-2xl font-black text-gray-800 mt-0.5">{items.length}</p>
                      </div>
                      <div className="bg-indigo-50 rounded-2xl p-3 text-center">
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Invertido</p>
                        <p className="text-base font-black text-indigo-700 mt-0.5">Gs. {invested.toLocaleString()}</p>
                      </div>
                      <div className="bg-emerald-50 rounded-2xl p-3 text-center">
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Vendido</p>
                        <p className="text-base font-black text-emerald-700 mt-0.5">Gs. {sRevenue.toLocaleString()}</p>
                      </div>
                      <div className={cn('rounded-2xl p-3 text-center', gain >= 0 ? 'bg-emerald-50' : 'bg-red-50')}>
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Ganancia</p>
                        <p className={cn('text-base font-black mt-0.5', gain >= 0 ? 'text-emerald-700' : 'text-red-600')}>
                          Gs. {gain.toLocaleString()}
                        </p>
                      </div>
                    </div>

                    {items.length > 0 && (
                      <div className="space-y-2">
                        {items.map(item => (
                          <div key={item._id} className="flex items-center justify-between py-2 border-t border-gray-100">
                            <div>
                              <p className="font-black text-gray-700 text-sm">{item.name}</p>
                              <p className="text-[10px] font-bold text-gray-400">
                                {n(item.initialQuantity) - n(item.quantity)} vendidos · {n(item.quantity)} disponibles
                              </p>
                            </div>
                            <p className="font-black text-gray-500 text-sm">Gs. {n(item.salePrice).toLocaleString()}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL: Nueva Compra */}
      <AnimatePresence>
        {showNewPurchase && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowNewPurchase(false)}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-[40px] p-8 shadow-2xl w-full max-w-md"
              onClick={e => e.stopPropagation()}>

              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 bg-orange-100 rounded-2xl flex items-center justify-center text-orange-600">
                  <ShoppingBag size={28} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest">Registrar</p>
                  <h3 className="text-xl font-black text-gray-800">Nueva Compra para Revender</h3>
                </div>
              </div>

              <form onSubmit={handleCreatePurchase} className="space-y-4">
                <div>
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1.5 ml-1">Nombre del producto *</label>
                  <input type="text" value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Ej: iPhone 13 usado"
                    autoFocus required
                    className="w-full p-3 bg-gray-50 border-2 border-transparent focus:border-orange-400 focus:bg-white rounded-2xl outline-none font-bold text-sm transition-all" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1.5 ml-1">Precio de venta *</label>
                    <NumericInput value={form.salePrice} onChange={raw => setForm(f => ({ ...f, salePrice: raw }))}
                      placeholder="0"
                      className="w-full p-3 bg-gray-50 border-2 border-transparent focus:border-orange-400 focus:bg-white rounded-2xl outline-none font-black text-sm text-center transition-all" />
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1.5 ml-1">Precio de costo</label>
                    <NumericInput value={form.costPrice} onChange={raw => setForm(f => ({ ...f, costPrice: raw }))}
                      placeholder="Opcional"
                      className="w-full p-3 bg-gray-50 border-2 border-transparent focus:border-orange-400 focus:bg-white rounded-2xl outline-none font-black text-sm text-center transition-all" />
                  </div>
                </div>

                <div>
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1.5 ml-1">Cantidad *</label>
                  <div className="flex items-center justify-center gap-4 bg-gray-50 rounded-2xl py-4">
                    <button type="button"
                      onClick={() => setForm(f => ({ ...f, quantity: String(Math.max(1, parseInt(f.quantity || '1') - 1)) }))}
                      className="w-10 h-10 bg-white rounded-xl flex items-center justify-center font-black text-gray-500 hover:text-red-500 hover:bg-red-50 shadow-sm transition-all cursor-pointer text-lg">-</button>
                    <NumericInput value={form.quantity} onChange={raw => setForm(f => ({ ...f, quantity: raw || '1' }))}
                      className="w-16 text-center text-3xl font-black bg-transparent outline-none" />
                    <button type="button"
                      onClick={() => setForm(f => ({ ...f, quantity: String(parseInt(f.quantity || '1') + 1) }))}
                      className="w-10 h-10 bg-white rounded-xl flex items-center justify-center font-black text-gray-500 hover:text-orange-500 hover:bg-orange-50 shadow-sm transition-all cursor-pointer text-lg">+</button>
                  </div>
                </div>

                <div>
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1.5 ml-1">Proveedor (opcional)</label>
                  <select value={form.supplierId} onChange={e => setForm(f => ({ ...f, supplierId: e.target.value }))}
                    className="w-full p-3 bg-gray-50 border-2 border-transparent focus:border-orange-400 focus:bg-white rounded-2xl outline-none font-bold text-sm cursor-pointer transition-all">
                    <option value="">Sin proveedor</option>
                    {reventaSuppliers.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                  </select>
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowNewPurchase(false)}
                    className="flex-1 py-3.5 rounded-2xl border-2 border-gray-100 font-black text-gray-500 hover:bg-gray-50 cursor-pointer">
                    Cancelar
                  </button>
                  <button type="submit" disabled={saving || !form.name.trim() || !form.salePrice}
                    className="flex-1 py-3.5 rounded-2xl bg-orange-500 text-white font-black shadow-xl shadow-orange-200 hover:bg-orange-600 disabled:opacity-40 cursor-pointer flex items-center justify-center gap-2">
                    {saving ? 'Guardando...' : <><Plus size={16} /> Registrar</>}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL: Nuevo Proveedor */}
      <AnimatePresence>
        {showNewSupplier && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowNewSupplier(false)}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-[40px] p-8 shadow-2xl w-full max-w-md"
              onClick={e => e.stopPropagation()}>

              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600">
                  <Building2 size={28} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Nuevo</p>
                  <h3 className="text-xl font-black text-gray-800">Proveedor</h3>
                </div>
              </div>

              <form onSubmit={handleCreateSupplier} className="space-y-4">
                <div>
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1.5 ml-1">Nombre *</label>
                  <input type="text" value={supplierForm.name}
                    onChange={e => setSupplierForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Nombre del proveedor"
                    autoFocus required
                    className="w-full p-3 bg-gray-50 border-2 border-transparent focus:border-indigo-400 focus:bg-white rounded-2xl outline-none font-bold text-sm transition-all" />
                </div>
                <div>
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1.5 ml-1">Contacto (opcional)</label>
                  <input type="text" value={supplierForm.contact}
                    onChange={e => setSupplierForm(f => ({ ...f, contact: e.target.value }))}
                    placeholder="Tel, WhatsApp, email..."
                    className="w-full p-3 bg-gray-50 border-2 border-transparent focus:border-indigo-400 focus:bg-white rounded-2xl outline-none font-bold text-sm transition-all" />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowNewSupplier(false)}
                    className="flex-1 py-3.5 rounded-2xl border-2 border-gray-100 font-black text-gray-500 hover:bg-gray-50 cursor-pointer">
                    Cancelar
                  </button>
                  <button type="submit" disabled={saving || !supplierForm.name.trim()}
                    className="flex-1 py-3.5 rounded-2xl bg-indigo-600 text-white font-black shadow-xl shadow-indigo-200 hover:bg-indigo-700 disabled:opacity-40 cursor-pointer flex items-center justify-center gap-2">
                    {saving ? 'Guardando...' : <><Plus size={16} /> Crear</>}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
