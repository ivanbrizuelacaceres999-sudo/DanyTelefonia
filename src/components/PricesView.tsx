import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Tag, Clock, CheckCircle, Package, AlertTriangle, Edit2, X, MapPin } from 'lucide-react';
import { api } from '../api';
import { SpecialPriceItem, Product, Category, Manufacturer } from '../types';
import { NumericInput } from './ui/NumericInput';
import { cn } from '../lib/utils';

interface PricesViewProps {
  specialPriceItems: SpecialPriceItem[];
  products: Product[];
  categories: Category[];
  manufacturers: Manufacturer[];
  exchangeRate?: number;
  onRefresh: () => void;
}

const n = (v: any): number => {
  const x = Number(v);
  return isNaN(x) ? 0 : x;
};

const parseLocation = (loc: string) => {
  const [estante = '', columna = '', fila = ''] = (loc || '').split('|');
  return { estante, columna, fila };
};
const formatLocation = (e: string, c: string, f: string) => [e, c, f].join('|');

export const PricesView = ({ specialPriceItems, products, categories, manufacturers, exchangeRate = 6300, onRefresh }: PricesViewProps) => {
  const [tab, setTab]           = useState<'pending' | 'all'>('pending');
  const [prices, setPrices]     = useState<Record<string, string>>({});
  const [saving, setSaving]     = useState<string | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editLoc, setEditLoc]   = useState({ estante: '', columna: '', fila: '' });
  const [editCostUsd, setEditCostUsd] = useState('');
  const [editSaving, setEditSaving]   = useState(false);

  const pending = specialPriceItems.filter(i => i.status === 'pending');
  const all     = specialPriceItems;

  const openEdit = (item: SpecialPriceItem) => {
    const prod = products.find(p => p._id === item.productId);
    if (!prod) return;
    setEditingProduct(prod);
    setEditLoc(parseLocation(prod.location || ''));
    setEditCostUsd(prod.costPrice > 0 ? (prod.costPrice / exchangeRate).toFixed(2) : '');
  };

  const handleAssign = async (item: SpecialPriceItem) => {
    const price = parseInt((prices[item._id] ?? '').replace(/\D/g, '')) || 0;
    if (price === 0) { setError('Ingresá un precio mayor a 0.'); return; }
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

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    setEditSaving(true);
    try {
      await api.updateProduct(editingProduct._id, {
        ...editingProduct,
        location: formatLocation(editLoc.estante, editLoc.columna, editLoc.fila),
      });
      setEditingProduct(null);
      onRefresh();
    } catch (err: any) {
      setError(err?.message ?? 'Error al guardar');
    } finally {
      setEditSaving(false);
    }
  };

  const displayItems = tab === 'pending' ? pending : all;

  // Agrupar por mayorista
  const grouped = displayItems.reduce((acc, item) => {
    const key = item.wholesalerId || '__sin__';
    if (!acc[key]) acc[key] = { name: item.wholesalerName || 'Sin mayorista', items: [] };
    acc[key].items.push(item);
    return acc;
  }, {} as Record<string, { name: string; items: SpecialPriceItem[] }>);
  const groups = Object.entries(grouped);

  return (
    <div className="space-y-6 pb-24 md:pb-0">

      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 bg-pink-100 rounded-[20px] flex items-center justify-center text-pink-600">
          <Tag size={28} />
        </div>
        <div>
          <h1 className="text-3xl font-black text-gray-800 tracking-tighter">Precios Especiales</h1>
          <p className="text-sm font-bold text-gray-400">Asigná precios pendientes y editá productos</p>
        </div>
        {pending.length > 0 && (
          <span className="ml-auto bg-pink-100 text-pink-700 font-black text-xs px-3 py-1.5 rounded-full">
            {pending.length} pendiente{pending.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-gray-100 p-1 rounded-2xl w-fit">
        <button
          onClick={() => setTab('pending')}
          className={cn('px-5 py-2 rounded-xl font-black text-sm transition-all',
            tab === 'pending' ? 'bg-white text-pink-600 shadow-sm' : 'text-gray-400 hover:text-gray-600')}>
          Pendientes
          {pending.length > 0 && (
            <span className="ml-1.5 bg-pink-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">{pending.length}</span>
          )}
        </button>
        <button
          onClick={() => setTab('all')}
          className={cn('px-5 py-2 rounded-xl font-black text-sm transition-all',
            tab === 'all' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600')}>
          Historial
          {all.length > 0 && (
            <span className="ml-1.5 bg-indigo-400 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">{all.length}</span>
          )}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 font-bold text-sm">
          <AlertTriangle size={15} /> {error}
          <button onClick={() => setError(null)} className="ml-auto"><X size={14} /></button>
        </div>
      )}

      {/* Grupos por mayorista */}
      <div className="space-y-5">
        {groups.length === 0 ? (
          <div className="text-center py-20 text-gray-300">
            {tab === 'pending' ? <CheckCircle size={40} className="mx-auto mb-3" /> : <Tag size={40} className="mx-auto mb-3" />}
            <p className="font-black text-sm uppercase tracking-widest">
              {tab === 'pending' ? 'Sin pendientes' : 'Sin ventas especiales'}
            </p>
          </div>
        ) : groups.map(([key, group]) => {
          const pendingCount = group.items.filter(i => i.status === 'pending').length;
          return (
            <div key={key} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {/* Cabecera del grupo */}
              <div className="flex items-center gap-3 px-5 py-3 bg-gray-50 border-b border-gray-100">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600 font-black text-sm">
                  {group.name.charAt(0).toUpperCase()}
                </div>
                <p className="font-black text-gray-700 text-sm">{group.name}</p>
                <div className="ml-auto flex items-center gap-2">
                  {pendingCount > 0 && (
                    <span className="text-[10px] font-black text-pink-600 bg-pink-50 px-2 py-0.5 rounded-full">
                      {pendingCount} pendiente{pendingCount !== 1 ? 's' : ''}
                    </span>
                  )}
                  <span className="text-[10px] font-bold text-gray-400">
                    {group.items.length} producto{group.items.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>

              {/* Productos del grupo */}
              <div className="divide-y divide-gray-50">
                {group.items.map(item => {
                  const prod = products.find(p => p._id === item.productId);
                  const isPending = item.status === 'pending';
                  return (
                    <div key={item._id} className="p-4">
                      <div className="flex items-center gap-3">
                        <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0',
                          isPending ? 'bg-pink-100 text-pink-500' : 'bg-emerald-100 text-emerald-600')}>
                          <Package size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-black text-gray-800 text-sm leading-snug">{item.productName}</p>
                          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                            <span className="text-[10px] font-bold text-gray-400">
                              Cant: <span className="text-gray-600 font-black">{item.quantity}</span>
                            </span>
                            <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1">
                              <Clock size={9} />
                              {new Date(item.saleDate).toLocaleDateString('es-PY', { day: '2-digit', month: 'short', year: '2-digit' })}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {!isPending && (
                            <span className="font-black text-emerald-600 text-base">Gs. {n(item.specialPrice).toLocaleString()}</span>
                          )}
                          {prod && (
                            <button
                              onClick={() => openEdit(item)}
                              className="p-1.5 bg-gray-50 text-gray-400 hover:bg-indigo-50 hover:text-indigo-600 rounded-xl transition-all"
                              title="Editar producto">
                              <Edit2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Input asignación */}
                      {isPending && (
                        <div className="mt-3 flex gap-2 items-center pl-12">
                          <div className="flex-1">
                            <NumericInput
                              value={prices[item._id] ?? ''}
                              onChange={raw => setPrices(prev => ({ ...prev, [item._id]: raw }))}
                              placeholder="Precio en Gs."
                              className="w-full p-2.5 bg-gray-50 border-2 border-gray-200 focus:border-pink-400 focus:bg-white rounded-xl outline-none font-black text-base text-center transition-all"
                            />
                          </div>
                          <button
                            onClick={() => handleAssign(item)}
                            disabled={saving === item._id || !(parseInt((prices[item._id] ?? '').replace(/\D/g, '')) > 0)}
                            className="px-4 py-2.5 bg-pink-500 hover:bg-pink-600 text-white font-black rounded-xl shadow-md shadow-pink-200 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 whitespace-nowrap text-sm">
                            {saving === item._id
                              ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Guardando...</>
                              : <><CheckCircle size={14} /> Asignar</>
                            }
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal editar producto — igual que StockView */}
      <AnimatePresence>
        {editingProduct && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setEditingProduct(null)}>
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              className="bg-white rounded-[32px] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}>

              <div className="flex items-center justify-between px-8 pt-8 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600">
                    <Package size={22} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Precio Especial</p>
                    <h3 className="text-xl font-black text-gray-800">Editar Producto</h3>
                  </div>
                </div>
                <button onClick={() => setEditingProduct(null)}
                  className="p-2 text-gray-300 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleUpdateProduct} className="px-8 pb-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Modelo</label>
                    <input required value={editingProduct.model}
                      onChange={e => setEditingProduct({ ...editingProduct, model: e.target.value.toUpperCase() })}
                      className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl outline-none transition-all font-bold" />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Categoría</label>
                    <select value={editingProduct.categoryId ?? ''}
                      onChange={e => setEditingProduct({ ...editingProduct, categoryId: e.target.value })}
                      className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl outline-none transition-all font-bold cursor-pointer">
                      <option value="">Sin categoría</option>
                      {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Fabricante</label>
                    <select value={editingProduct.manufacturerId ?? ''}
                      onChange={e => setEditingProduct({ ...editingProduct, manufacturerId: e.target.value || undefined })}
                      className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl outline-none transition-all font-bold cursor-pointer">
                      <option value="">Sin fabricante</option>
                      {manufacturers.map(m => <option key={m._id} value={m._id}>{m.name}</option>)}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Cantidad Actual</label>
                    <NumericInput required value={String(editingProduct.quantity ?? '')}
                      onChange={raw => setEditingProduct({ ...editingProduct, quantity: Number(raw) || 0 })}
                      className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl outline-none transition-all font-bold" />
                  </div>

                  <div className="col-span-full space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Precio Costo</label>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest ml-1">Guaraníes (Gs.)</p>
                        <NumericInput
                          value={String(editingProduct.costPrice || '')}
                          onChange={raw => {
                            const gs = Number(raw) || 0;
                            setEditingProduct({ ...editingProduct, costPrice: gs });
                            setEditCostUsd(gs > 0 ? (gs / exchangeRate).toFixed(2) : '');
                          }}
                          className="w-full p-4 bg-emerald-50 border-2 border-transparent focus:border-emerald-500 focus:bg-white rounded-2xl outline-none transition-all font-bold"
                          placeholder="0" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest ml-1">Dólares (USD)</p>
                        <input type="text" inputMode="decimal" value={editCostUsd}
                          onChange={e => {
                            const v = e.target.value;
                            setEditCostUsd(v);
                            const usd = parseFloat(v.replace(',', '.'));
                            if (!isNaN(usd)) setEditingProduct(prev => prev ? { ...prev, costPrice: Math.round(usd * exchangeRate) } : prev);
                          }}
                          className="w-full p-4 bg-blue-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl outline-none transition-all font-bold"
                          placeholder="0.00" />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Precio Normal · Cliente (Gs.)</label>
                    <NumericInput required value={String(editingProduct.salePrice ?? '')}
                      onChange={raw => setEditingProduct({ ...editingProduct, salePrice: Number(raw) || 0 })}
                      className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl outline-none transition-all font-bold" />
                  </div>

                  <div className="col-span-full space-y-3 bg-gray-50 rounded-2xl p-4 border border-gray-100">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                      Precios adicionales <span className="font-bold normal-case text-gray-300">(opcionales)</span>
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-purple-500 uppercase tracking-widest ml-1">🏪 Precio Mayorista (Gs.)</label>
                        <NumericInput
                          value={String((editingProduct as any).priceWholesale ?? '')}
                          onChange={raw => setEditingProduct({ ...editingProduct, priceWholesale: Number(raw) || 0 } as any)}
                          className="w-full p-4 bg-white border-2 border-transparent focus:border-purple-500 rounded-2xl outline-none transition-all font-bold"
                          placeholder="0" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-orange-500 uppercase tracking-widest ml-1">💸 Precio Tacaño (Gs.)</label>
                        <NumericInput
                          value={String((editingProduct as any).priceCheap ?? '')}
                          onChange={raw => setEditingProduct({ ...editingProduct, priceCheap: Number(raw) || 0 } as any)}
                          className="w-full p-4 bg-white border-2 border-transparent focus:border-orange-400 rounded-2xl outline-none transition-all font-bold"
                          placeholder="0" />
                      </div>
                    </div>
                  </div>

                  <div className="col-span-full space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4 flex items-center gap-1.5">
                      <MapPin size={11} className="text-indigo-400" /> Ubicación en Estante
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      {(['estante', 'columna', 'fila'] as const).map(field => (
                        <div key={field} className="space-y-1">
                          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">{field.charAt(0).toUpperCase() + field.slice(1)}</p>
                          <input value={editLoc[field]}
                            onChange={e => setEditLoc({ ...editLoc, [field]: e.target.value })}
                            className="w-full p-3 bg-gray-50 border-2 border-transparent focus:border-indigo-400 focus:bg-white rounded-2xl outline-none transition-all font-bold text-sm uppercase"
                            placeholder={field === 'estante' ? 'A' : field === 'columna' ? '1' : '1'} />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setEditingProduct(null)}
                    className="flex-1 py-4 rounded-2xl border-2 border-gray-100 font-black text-gray-500 hover:bg-gray-50 cursor-pointer transition-all">
                    Cancelar
                  </button>
                  <button type="submit" disabled={editSaving}
                    className="flex-1 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black shadow-xl shadow-indigo-200 cursor-pointer transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                    {editSaving
                      ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Guardando...</>
                      : 'Guardar Cambios'
                    }
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
