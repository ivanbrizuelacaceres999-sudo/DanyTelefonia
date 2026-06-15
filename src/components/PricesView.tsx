import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Tag, Clock, CheckCircle, Package, AlertTriangle, Edit2, X, MapPin, Search, Sparkles, Users, Lock } from 'lucide-react';
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

const n = (v: any): number => { const x = Number(v); return isNaN(x) ? 0 : x; };
const parseLocation = (loc: string) => { const [estante = '', columna = '', fila = ''] = (loc || '').split('|'); return { estante, columna, fila }; };
const formatLocation = (e: string, c: string, f: string) => [e, c, f].join('|');

const COLORS = [
  { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-200', header: 'bg-indigo-50' },
  { bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-200', header: 'bg-violet-50' },
  { bg: 'bg-sky-100',    text: 'text-sky-700',    border: 'border-sky-200',    header: 'bg-sky-50'    },
  { bg: 'bg-teal-100',   text: 'text-teal-700',   border: 'border-teal-200',   header: 'bg-teal-50'   },
  { bg: 'bg-rose-100',   text: 'text-rose-700',   border: 'border-rose-200',   header: 'bg-rose-50'   },
];

export const PricesView = ({ specialPriceItems, products, categories, manufacturers, exchangeRate = 6300, onRefresh }: PricesViewProps) => {
  const [tab, setTab]         = useState<'pending' | 'all'>('pending');
  const [search, setSearch]   = useState('');
  const [prices, setPrices]   = useState<Record<string, string>>({});
  const [saving, setSaving]   = useState<string | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editLoc, setEditLoc] = useState({ estante: '', columna: '', fila: '' });
  const [editCostUsd, setEditCostUsd] = useState('');
  const [editSaving, setEditSaving]   = useState(false);

  // Modal forzado de precios faltantes post-asignación
  const [forcedModal, setForcedModal] = useState<{ product: Product } | null>(null);
  const [forcedPrices, setForcedPrices] = useState({ salePrice: '', priceWholesale: '', priceCheap: '' });
  const [forcedSaving, setForcedSaving] = useState(false);

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
      // Verificar si al producto le faltan precios
      const prod = products.find(p => p._id === item.productId);
      if (prod) {
        const missing = !n(prod.salePrice) || !n((prod as any).priceWholesale) || !n((prod as any).priceCheap);
        if (missing) {
          setForcedModal({ product: prod });
          setForcedPrices({
            salePrice:      n(prod.salePrice) ? String(prod.salePrice) : '',
            priceWholesale: n((prod as any).priceWholesale) ? String((prod as any).priceWholesale) : '',
            priceCheap:     n((prod as any).priceCheap) ? String((prod as any).priceCheap) : '',
          });
        }
      }
    } catch (e: any) {
      setError(e.message ?? 'Error al asignar precio');
    } finally { setSaving(null); }
  };

  const handleForcedSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forcedModal) return;
    setForcedSaving(true);
    try {
      await api.updateProduct(forcedModal.product._id, {
        ...forcedModal.product,
        salePrice:      parseInt(forcedPrices.salePrice.replace(/\D/g, '')) || 0,
        priceWholesale: parseInt(forcedPrices.priceWholesale.replace(/\D/g, '')) || 0,
        priceCheap:     parseInt(forcedPrices.priceCheap.replace(/\D/g, '')) || 0,
      } as any);
      setForcedModal(null);
      onRefresh();
    } catch (err: any) {
      setError(err?.message ?? 'Error al guardar precios');
    } finally { setForcedSaving(false); }
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
    } finally { setEditSaving(false); }
  };

  const baseItems = tab === 'pending' ? pending : all;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return baseItems;
    return baseItems.filter(i =>
      i.productName.toLowerCase().includes(q) ||
      (i.wholesalerName ?? '').toLowerCase().includes(q)
    );
  }, [baseItems, search]);

  const groups = useMemo(() => {
    const map: Record<string, { name: string; items: SpecialPriceItem[]; colorIdx: number }> = {};
    const keys: string[] = [];
    filtered.forEach(item => {
      const key = item.wholesalerId || '__sin__';
      if (!map[key]) {
        map[key] = { name: item.wholesalerName || 'Sin mayorista', items: [], colorIdx: keys.length % COLORS.length };
        keys.push(key);
      }
      map[key].items.push(item);
    });
    return keys.map(k => ({ key: k, ...map[k] }));
  }, [filtered]);

  return (
    <div className="space-y-6 pb-24 md:pb-0">

      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 bg-gradient-to-br from-pink-400 to-rose-500 rounded-[20px] flex items-center justify-center text-white shadow-lg shadow-pink-200 flex-shrink-0">
          <Sparkles size={26} />
        </div>
        <div className="flex-1">
          <h1 className="text-3xl font-black text-gray-800 tracking-tighter">Precios Especiales</h1>
          <p className="text-sm font-bold text-gray-400">Asigná precios pendientes y editá productos</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {pending.length > 0 && (
            <div className="text-center bg-pink-50 border border-pink-100 rounded-2xl px-4 py-2">
              <p className="text-2xl font-black text-pink-600 leading-none">{pending.length}</p>
              <p className="text-[10px] font-black text-pink-400 uppercase tracking-widest mt-0.5">pendiente{pending.length !== 1 ? 's' : ''}</p>
            </div>
          )}
          <div className="text-center bg-gray-50 border border-gray-100 rounded-2xl px-4 py-2">
            <p className="text-2xl font-black text-gray-700 leading-none">{all.length}</p>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-0.5">total</p>
          </div>
        </div>
      </div>

      {/* Tabs + Buscador */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-2xl w-fit">
          <button onClick={() => setTab('pending')}
            className={cn('px-5 py-2 rounded-xl font-black text-sm transition-all',
              tab === 'pending' ? 'bg-white text-pink-600 shadow-sm' : 'text-gray-400 hover:text-gray-600')}>
            Pendientes
            {pending.length > 0 && (
              <span className="ml-1.5 bg-pink-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">{pending.length}</span>
            )}
          </button>
          <button onClick={() => setTab('all')}
            className={cn('px-5 py-2 rounded-xl font-black text-sm transition-all',
              tab === 'all' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600')}>
            Historial
            {all.length > 0 && (
              <span className="ml-1.5 bg-indigo-400 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">{all.length}</span>
            )}
          </button>
        </div>

        {/* Buscador */}
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar producto o mayorista…"
            className="w-full pl-9 pr-9 py-2.5 bg-white border border-gray-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 rounded-2xl outline-none font-bold text-sm text-gray-700 placeholder-gray-300 transition-all"
          />
          {search && (
            <button onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 font-bold text-sm">
          <AlertTriangle size={15} /> {error}
          <button onClick={() => setError(null)} className="ml-auto"><X size={14} /></button>
        </div>
      )}

      {/* Sin resultados de búsqueda */}
      {search && filtered.length === 0 && (
        <div className="text-center py-12 text-gray-300">
          <Search size={36} className="mx-auto mb-3" />
          <p className="font-black text-sm uppercase tracking-widest">Sin resultados para "{search}"</p>
        </div>
      )}

      {/* Grupos por mayorista */}
      <div className="space-y-4">
        {!search && groups.length === 0 ? (
          <div className="text-center py-20 text-gray-300">
            {tab === 'pending' ? <CheckCircle size={40} className="mx-auto mb-3" /> : <Tag size={40} className="mx-auto mb-3" />}
            <p className="font-black text-sm uppercase tracking-widest">
              {tab === 'pending' ? 'Sin pendientes' : 'Sin ventas especiales'}
            </p>
          </div>
        ) : groups.map(({ key, name, items, colorIdx }) => {
          const color = COLORS[colorIdx];
          const pendingCount = items.filter(i => i.status === 'pending').length;
          return (
            <motion.div key={key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

              {/* Cabecera del grupo */}
              <div className={cn('flex items-center gap-3 px-5 py-3.5 border-b border-gray-100', color.header)}>
                <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center font-black text-base flex-shrink-0', color.bg, color.text)}>
                  {name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn('font-black text-sm', color.text)}>{name}</p>
                  <p className="text-[10px] font-bold text-gray-400 flex items-center gap-1">
                    <Users size={9} /> {items.length} producto{items.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {pendingCount > 0 && (
                    <span className="text-[10px] font-black text-pink-600 bg-pink-50 border border-pink-100 px-2.5 py-1 rounded-full">
                      {pendingCount} pendiente{pendingCount !== 1 ? 's' : ''}
                    </span>
                  )}
                  {pendingCount === 0 && tab !== 'pending' && (
                    <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full flex items-center gap-1">
                      <CheckCircle size={9} /> Completo
                    </span>
                  )}
                </div>
              </div>

              {/* Productos del grupo */}
              <div className="divide-y divide-gray-50">
                {items.map(item => {
                  const prod = products.find(p => p._id === item.productId);
                  const isPending = item.status === 'pending';
                  return (
                    <div key={item._id} className="px-5 py-3.5 hover:bg-gray-50/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0',
                          isPending ? 'bg-pink-100 text-pink-500' : 'bg-emerald-100 text-emerald-600')}>
                          <Package size={15} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-black text-gray-800 text-sm leading-snug truncate">{item.productName}</p>
                          <div className="flex items-center gap-3 mt-0.5">
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
                          {isPending ? (
                            <span className="text-[10px] font-black text-pink-500 bg-pink-50 px-2 py-0.5 rounded-lg border border-pink-100">PENDIENTE</span>
                          ) : (
                            <span className="font-black text-emerald-600 text-sm">Gs. {n(item.specialPrice).toLocaleString()}</span>
                          )}
                          {prod && (
                            <button onClick={() => openEdit(item)}
                              className="p-1.5 text-gray-300 hover:text-indigo-500 hover:bg-indigo-50 rounded-xl transition-all"
                              title="Editar producto">
                              <Edit2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Input asignación */}
                      {isPending && (
                        <div className="mt-3 flex gap-2 items-center pl-11">
                          <NumericInput
                            value={prices[item._id] ?? ''}
                            onChange={raw => setPrices(prev => ({ ...prev, [item._id]: raw }))}
                            placeholder="Ingresá el precio en Gs."
                            className="flex-1 p-2.5 bg-gray-50 border-2 border-gray-200 focus:border-pink-400 focus:bg-white rounded-xl outline-none font-black text-sm text-center transition-all"
                          />
                          <button
                            onClick={() => handleAssign(item)}
                            disabled={saving === item._id || !(parseInt((prices[item._id] ?? '').replace(/\D/g, '')) > 0)}
                            className="px-4 py-2.5 bg-pink-500 hover:bg-pink-600 text-white font-black rounded-xl shadow-md shadow-pink-200 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 whitespace-nowrap text-sm">
                            {saving === item._id
                              ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Guardando...</>
                              : <><CheckCircle size={13} /> Asignar</>
                            }
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Modal FORZADO — completar precios faltantes */}
      <AnimatePresence>
        {forcedModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, y: 24 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 24 }}
              className="bg-white rounded-[28px] shadow-2xl w-full max-w-md overflow-hidden">

              {/* Cabecera con advertencia */}
              <div className="bg-amber-500 px-7 pt-7 pb-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center">
                    <Lock size={20} className="text-white" />
                  </div>
                  <div>
                    <p className="text-white/70 text-[10px] font-black uppercase tracking-widest">Acción requerida</p>
                    <h3 className="text-white font-black text-lg leading-tight">Completá los precios</h3>
                  </div>
                </div>
                <p className="text-white/80 text-sm font-bold leading-snug">
                  <span className="text-white font-black">{forcedModal.product.model}</span> no tiene todos los precios de venta. Completalos para continuar.
                </p>
              </div>

              <form onSubmit={handleForcedSave} className="px-7 py-6 space-y-4">
                {/* Normal */}
                <div>
                  <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest ml-1 flex items-center gap-1.5 mb-1.5">
                    Precio Normal (Gs.)
                    {n(forcedModal.product.salePrice) > 0
                      ? <span className="text-[9px] text-emerald-400 font-bold normal-case">ya cargado</span>
                      : <span className="text-[9px] text-red-400 font-bold normal-case">falta</span>
                    }
                  </label>
                  <NumericInput
                    value={forcedPrices.salePrice}
                    onChange={raw => setForcedPrices(p => ({ ...p, salePrice: raw }))}
                    placeholder="0"
                    className={cn('w-full p-3.5 rounded-2xl outline-none font-black text-base transition-all border-2',
                      n(forcedModal.product.salePrice) > 0
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        : 'bg-gray-50 border-transparent focus:border-emerald-500 focus:bg-white'
                    )}
                  />
                </div>

                {/* Mayorista */}
                <div>
                  <label className="text-[10px] font-black text-purple-500 uppercase tracking-widest ml-1 flex items-center gap-1.5 mb-1.5">
                    🏪 Precio Mayorista (Gs.)
                    {n((forcedModal.product as any).priceWholesale) > 0
                      ? <span className="text-[9px] text-emerald-400 font-bold normal-case">ya cargado</span>
                      : <span className="text-[9px] text-red-400 font-bold normal-case">falta</span>
                    }
                  </label>
                  <NumericInput
                    value={forcedPrices.priceWholesale}
                    onChange={raw => setForcedPrices(p => ({ ...p, priceWholesale: raw }))}
                    placeholder="0"
                    className={cn('w-full p-3.5 rounded-2xl outline-none font-black text-base transition-all border-2',
                      n((forcedModal.product as any).priceWholesale) > 0
                        ? 'bg-purple-50 border-purple-200 text-purple-700'
                        : 'bg-gray-50 border-transparent focus:border-purple-500 focus:bg-white'
                    )}
                  />
                </div>

                {/* Tacaño */}
                <div>
                  <label className="text-[10px] font-black text-orange-500 uppercase tracking-widest ml-1 flex items-center gap-1.5 mb-1.5">
                    💸 Precio Tacaño (Gs.)
                    {n((forcedModal.product as any).priceCheap) > 0
                      ? <span className="text-[9px] text-emerald-400 font-bold normal-case">ya cargado</span>
                      : <span className="text-[9px] text-red-400 font-bold normal-case">falta</span>
                    }
                  </label>
                  <NumericInput
                    value={forcedPrices.priceCheap}
                    onChange={raw => setForcedPrices(p => ({ ...p, priceCheap: raw }))}
                    placeholder="0"
                    className={cn('w-full p-3.5 rounded-2xl outline-none font-black text-base transition-all border-2',
                      n((forcedModal.product as any).priceCheap) > 0
                        ? 'bg-orange-50 border-orange-200 text-orange-700'
                        : 'bg-gray-50 border-transparent focus:border-orange-400 focus:bg-white'
                    )}
                  />
                </div>

                <button type="submit" disabled={forcedSaving ||
                    !(parseInt(forcedPrices.salePrice.replace(/\D/g,''))||0) ||
                    !(parseInt(forcedPrices.priceWholesale.replace(/\D/g,''))||0) ||
                    !(parseInt(forcedPrices.priceCheap.replace(/\D/g,''))||0)
                  }
                  className="w-full py-4 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-black shadow-lg shadow-amber-200 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2">
                  {forcedSaving
                    ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Guardando...</>
                    : <><CheckCircle size={16} /> Guardar y continuar</>
                  }
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal editar producto */}
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
                            placeholder={field === 'estante' ? 'A' : '1'} />
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
