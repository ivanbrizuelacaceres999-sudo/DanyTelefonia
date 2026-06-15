import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, Search, Trash2, CheckCircle, XCircle, AlertCircle, Package, DollarSign, Clock, Settings, RefreshCw, TrendingDown, Award, Factory } from 'lucide-react';
import { api } from '../api';
import { Warranty, WarrantyConfig, Product, Sale, Manufacturer } from '../types';
import { Modal } from './ui/Modal';
import { NumericInput as NumInput } from './ui/NumericInput';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { cn } from '../lib/utils';

interface WarrantyViewProps {
  sales: Sale[];
  products: Product[];
  manufacturers: Manufacturer[];
  onRefresh: () => void;
}



export const WarrantyView = ({ sales, products, manufacturers, onRefresh }: WarrantyViewProps) => {
  const [warranties, setWarranties] = useState<Warranty[]>([]);
  const [config, setConfig] = useState<WarrantyConfig | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'active' | 'expired' | 'defective' | 'manufacturers'>('active');
  const [showConfig, setShowConfig] = useState(false);
  const [defaultDays, setDefaultDays] = useState('2');
  const [productDaysMap, setProductDaysMap] = useState<Record<string, string>>({});
  const [savingConfig, setSavingConfig] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<{ message: string; onConfirm: () => void } | null>(null);

  const fetchAll = async () => {
    const [w, c] = await Promise.all([api.getWarranties(), api.getWarrantyConfig()]);
    setWarranties(w);
    setConfig(c);
    setDefaultDays(String(c?.defaultDays ?? 2));
    if (c?.productOverrides) {
      const map: Record<string, string> = {};
      c.productOverrides.forEach((o: any) => { map[o.productId] = String(o.days); });
      setProductDaysMap(map);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const handleStatusChange = async (id: string, status: string) => {
    await api.updateWarranty(id, { status });
    fetchAll();
    onRefresh();
  };

  const handleDelete = (id: string) => {
    setPendingConfirm({
      message: '¿Eliminar esta garantía? Se perderá el registro permanentemente.',
      onConfirm: async () => { await api.deleteWarranty(id); fetchAll(); },
    });
  };

  const saveConfig = async () => {
    setSavingConfig(true);
    await api.updateWarrantyConfig({ defaultDays: parseInt(defaultDays) || 2 });
    // Save product overrides
    for (const [productId, days] of Object.entries(productDaysMap) as [string, string][]) {
      if (days && parseInt(days) > 0) {
        await api.updateProductWarranty(productId, parseInt(days));
      }
    }
    await fetchAll();
    setSavingConfig(false);
  };

  const filtered = warranties.filter(w => {
    const matchSearch = w.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.customerName.toLowerCase().includes(searchTerm.toLowerCase());
    if (activeTab === 'active') return matchSearch && (w.status === 'active');
    if (activeTab === 'expired') return matchSearch && (w.status === 'expired');
    if (activeTab === 'defective') return matchSearch && (w.status === 'defective' || w.status === 'resolved_by_provider' || w.status === 'loss');
    return matchSearch;
  });

  const activeCount    = warranties.filter(w => w.status === 'active').length;
  const expiredCount   = warranties.filter(w => w.status === 'expired').length;
  const defectiveCount = warranties.filter(w => w.status === 'defective' || w.status === 'loss').length;

  // ── Estadísticas por fabricante ───────────────────────────────
  const productMfrMap = new Map(products.map(p => [p._id, p.manufacturerId]));

  interface MfrStat {
    id: string; name: string;
    total: number; losses: number; resolved: number; pending: number;
    warranties: Warranty[];
  }

  const mfrStatsMap = new Map<string, MfrStat>();

  warranties
    .filter(w => w.status === 'defective' || w.status === 'loss' || w.status === 'resolved_by_provider')
    .forEach(w => {
      const mfrId   = productMfrMap.get(w.productId) || '__none__';
      const mfrName = manufacturers.find(m => m._id === mfrId)?.name || 'Sin fabricante';
      if (!mfrStatsMap.has(mfrId)) {
        mfrStatsMap.set(mfrId, { id: mfrId, name: mfrName, total: 0, losses: 0, resolved: 0, pending: 0, warranties: [] });
      }
      const s = mfrStatsMap.get(mfrId)!;
      s.total++;
      s.warranties.push(w);
      if (w.status === 'loss')                 s.losses++;
      if (w.status === 'resolved_by_provider') s.resolved++;
      if (w.status === 'defective')            s.pending++;
    });

  const mfrRanking = Array.from(mfrStatsMap.values()).sort((a, b) => b.total - a.total);
  const maxFails   = mfrRanking[0]?.total ?? 1;

  const getDaysLeft = (expiresAt: string) => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-4xl font-black text-gray-800 tracking-tighter">Garantías</h2>
          <p className="text-gray-400 font-bold tracking-widest uppercase text-[10px] mt-1">Gestión de Reclamos y Devoluciones</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setShowConfig(true)}
            className="bg-gray-50 text-gray-600 font-black px-5 py-3 rounded-2xl hover:bg-gray-100 transition-all flex items-center gap-2 border border-gray-200">
            <Settings size={18} /> Configurar Garantías
          </button>
          <button onClick={fetchAll} className="bg-gray-50 text-gray-600 font-black px-5 py-3 rounded-2xl hover:bg-gray-100 transition-all border border-gray-200">
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {/* Config info */}
      {config && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-3xl p-4 flex items-center gap-4">
          <ShieldCheck size={20} className="text-indigo-600" />
          <p className="font-bold text-indigo-700 text-sm">Garantía predeterminada: <span className="font-black">{config.defaultDays} día{config.defaultDays !== 1 ? 's' : ''}</span> · Las garantías vencidas pasan automáticamente a "Expiradas"</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'active',        label: `En Garantía (${activeCount})`,          color: 'emerald' },
          { key: 'expired',       label: `Expiradas / Ganancia (${expiredCount})`, color: 'gray'    },
          { key: 'defective',     label: `Defectuosos (${defectiveCount})`,        color: 'red'     },
          { key: 'manufacturers', label: `Por Fabricante (${mfrRanking.length})`,  color: 'violet'  },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
            className={cn("px-5 py-2.5 rounded-2xl font-black text-sm transition-all",
              activeTab === tab.key
                ? tab.color === 'emerald' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200'
                  : tab.color === 'red'    ? 'bg-red-500 text-white shadow-lg shadow-red-200'
                  : tab.color === 'violet' ? 'bg-violet-600 text-white shadow-lg shadow-violet-200'
                  : 'bg-gray-800 text-white'
                : 'bg-white text-gray-500 border border-gray-100 hover:bg-gray-50')}>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="relative group">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
        <input type="text" placeholder="Buscar por producto o cliente..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
          className="w-full bg-white border border-gray-100 rounded-[25px] py-4 pl-14 pr-6 outline-none shadow-sm focus:shadow-xl focus:border-indigo-100 transition-all font-bold text-gray-700" />
      </div>

      {/* Warranty cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <AnimatePresence mode="popLayout">
          {filtered.map(w => {
            const daysLeft = getDaysLeft(w.expiresAt);
            return (
              <motion.div layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                key={w._id} className={cn("bg-white p-6 rounded-[35px] border shadow-sm hover:shadow-xl transition-all",
                  w.status === 'active' && daysLeft <= 0 ? "border-amber-200 bg-amber-50" :
                  w.status === 'defective' ? "border-red-200 bg-red-50" :
                  w.status === 'resolved_by_provider' ? "border-emerald-200 bg-emerald-50" :
                  "border-gray-100")}>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center",
                      w.status === 'active' ? "bg-emerald-100 text-emerald-600" :
                      w.status === 'expired' ? "bg-gray-100 text-gray-500" :
                      w.status === 'defective' ? "bg-red-100 text-red-600" :
                      w.status === 'resolved_by_provider' ? "bg-emerald-100 text-emerald-600" :
                      "bg-gray-100 text-gray-400")}>
                      <ShieldCheck size={22} />
                    </div>
                    <div>
                      <h3 className="font-black text-gray-800">{w.productName}</h3>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{w.customerName}</p>
                    </div>
                  </div>
                  <button onClick={() => handleDelete(w._id)} className="p-2 text-gray-300 hover:text-red-500 transition-colors">
                    <Trash2 size={15} />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-4 text-center">
                  <div className="bg-gray-50 p-2.5 rounded-2xl">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Compra</p>
                    <p className="font-black text-gray-800 text-xs">{new Date(w.date).toLocaleDateString()}</p>
                  </div>
                  <div className="bg-gray-50 p-2.5 rounded-2xl">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Vence</p>
                    <p className={cn("font-black text-xs", daysLeft <= 0 ? "text-red-500" : daysLeft <= 1 ? "text-amber-500" : "text-gray-800")}>
                      {new Date(w.expiresAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="bg-gray-50 p-2.5 rounded-2xl">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Monto</p>
                    <p className="font-black text-emerald-600 text-xs">Gs. {w.amount.toLocaleString()}</p>
                  </div>
                </div>

                {/* Status badges & actions */}
                <div className="flex flex-wrap gap-2">
                  {w.status === 'active' && (
                    <>
                      <span className={cn("text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest",
                        daysLeft <= 0 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700")}>
                        {daysLeft <= 0 ? '⚠️ Por vencer' : `${daysLeft}d restantes`}
                      </span>
                      <button onClick={() => handleStatusChange(w._id, 'defective')}
                        className="text-[10px] font-black px-3 py-1.5 rounded-full bg-red-100 text-red-600 hover:bg-red-500 hover:text-white transition-all uppercase tracking-widest">
                        Marcar Defectuoso
                      </button>
                    </>
                  )}
                  {w.status === 'expired' && (
                    <span className="text-[10px] font-black px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 uppercase tracking-widest">
                      ✓ Garantía vencida · Ganancia confirmada
                    </span>
                  )}
                  {w.status === 'defective' && (
                    <>
                      <span className="text-[10px] font-black px-3 py-1.5 rounded-full bg-red-100 text-red-600 uppercase tracking-widest">
                        🔴 Defectuoso
                      </span>
                      <p className="w-full text-[10px] font-black text-gray-500 uppercase tracking-widest mt-1">¿Garantía aprobada por fabricante?</p>
                      <button onClick={() => handleStatusChange(w._id, 'resolved_by_provider')}
                        className="text-[10px] font-black px-4 py-1.5 rounded-full bg-emerald-600 text-white hover:bg-emerald-700 transition-all uppercase tracking-widest">
                        ✓ Sí · Reponer al Stock
                      </button>
                      <button onClick={() => handleStatusChange(w._id, 'loss')}
                        className="text-[10px] font-black px-4 py-1.5 rounded-full bg-red-600 text-white hover:bg-red-700 transition-all uppercase tracking-widest">
                        ✕ No · Pérdida
                      </button>
                    </>
                  )}
                  {w.status === 'resolved_by_provider' && (
                    <span className="text-[10px] font-black px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-700 uppercase tracking-widest">
                      ✓ Repuesto por fabricante · Volvió al stock
                    </span>
                  )}
                  {w.status === 'loss' && (
                    <span className="text-[10px] font-black px-3 py-1.5 rounded-full bg-red-100 text-red-600 uppercase tracking-widest">
                      🔴 Pérdida · Se descontó de caja
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {filtered.length === 0 && (
          <div className="col-span-2 text-center py-20 text-gray-300">
            <ShieldCheck size={48} className="mx-auto mb-4" />
            <p className="font-black uppercase tracking-widest text-sm">Sin garantías en esta categoría</p>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════
          PESTAÑA: POR FABRICANTE
          ══════════════════════════════════════════ */}
      {activeTab === 'manufacturers' && (
        <div className="space-y-8">
          {mfrRanking.length === 0 ? (
            <div className="text-center py-20 text-gray-300">
              <Factory size={48} className="mx-auto mb-4" />
              <p className="font-black uppercase tracking-widest text-sm">Sin productos defectuosos registrados</p>
            </div>
          ) : (
            <>
              {/* ── Ranking / Stats ── */}
              <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm p-6 space-y-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center text-violet-600">
                    <TrendingDown size={20} />
                  </div>
                  <div>
                    <h3 className="font-black text-gray-800 text-lg tracking-tight">Ranking de fallos por fabricante</h3>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Defectuosos + pérdidas + repuestos por proveedor</p>
                  </div>
                </div>

                {mfrRanking.map((mfr, idx) => {
                  const pct       = Math.round((mfr.total / maxFails) * 100);
                  const isWorst   = idx === 0 && mfr.total > 0;
                  const barColor  = mfr.losses > mfr.resolved
                    ? 'bg-red-500'
                    : mfr.total > 3
                      ? 'bg-amber-400'
                      : 'bg-emerald-400';
                  return (
                    <div key={mfr.id} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {isWorst && <span className="text-sm">🔴</span>}
                          <span className="font-black text-gray-800 text-sm">{mfr.name}</span>
                          {isWorst && (
                            <span className="text-[9px] font-black text-red-600 bg-red-50 px-2 py-0.5 rounded-full uppercase tracking-widest border border-red-100">
                              Más fallos
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-[10px] font-black">
                          <span className="text-red-500 bg-red-50 px-2 py-0.5 rounded-full">{mfr.total} defectos</span>
                          {mfr.losses > 0 && (
                            <span className="text-gray-500 bg-gray-50 px-2 py-0.5 rounded-full">{mfr.losses} pérdidas</span>
                          )}
                          {mfr.resolved > 0 && (
                            <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">{mfr.resolved} repuestos</span>
                          )}
                        </div>
                      </div>
                      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all', barColor)}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── Cards agrupadas por fabricante ── */}
              {mfrRanking.map(mfr => (
                <div key={mfr.id} className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center text-violet-600">
                      <Factory size={18} />
                    </div>
                    <div>
                      <h3 className="font-black text-gray-800 text-lg tracking-tight">{mfr.name}</h3>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        {mfr.total} defecto{mfr.total !== 1 ? 's' : ''}
                        {mfr.pending > 0  && ` · ${mfr.pending} pendiente${mfr.pending !== 1 ? 's' : ''}`}
                        {mfr.losses > 0   && ` · ${mfr.losses} pérdida${mfr.losses !== 1 ? 's' : ''}`}
                        {mfr.resolved > 0 && ` · ${mfr.resolved} repuesto${mfr.resolved !== 1 ? 's' : ''}`}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {mfr.warranties.map(w => {
                      const daysLeft = getDaysLeft(w.expiresAt);
                      return (
                        <div key={w._id}
                          className={cn('bg-white p-5 rounded-[28px] border shadow-sm hover:shadow-lg transition-all',
                            w.status === 'defective'            ? 'border-red-200'
                            : w.status === 'resolved_by_provider' ? 'border-emerald-200'
                            : 'border-gray-200')}>
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center',
                                w.status === 'defective'             ? 'bg-red-100 text-red-600'
                                : w.status === 'resolved_by_provider' ? 'bg-emerald-100 text-emerald-600'
                                : 'bg-gray-100 text-gray-500')}>
                                <ShieldCheck size={18} />
                              </div>
                              <div>
                                <p className="font-black text-gray-800 text-sm leading-snug">{w.productName}</p>
                                <p className="text-[10px] font-bold text-gray-400 uppercase">{w.customerName}</p>
                              </div>
                            </div>
                            <button onClick={() => handleDelete(w._id)} className="p-1.5 text-gray-300 hover:text-red-500 transition-colors">
                              <Trash2 size={14} />
                            </button>
                          </div>

                          <div className="grid grid-cols-3 gap-2 mb-3 text-center">
                            <div className="bg-gray-50 p-2 rounded-xl">
                              <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Compra</p>
                              <p className="font-black text-gray-800 text-[10px]">{new Date(w.date).toLocaleDateString()}</p>
                            </div>
                            <div className="bg-gray-50 p-2 rounded-xl">
                              <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Vence</p>
                              <p className={cn('font-black text-[10px]', daysLeft <= 0 ? 'text-red-500' : 'text-gray-800')}>
                                {new Date(w.expiresAt).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="bg-gray-50 p-2 rounded-xl">
                              <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Monto</p>
                              <p className="font-black text-emerald-600 text-[10px]">Gs. {w.amount.toLocaleString()}</p>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-1.5">
                            {w.status === 'defective' && (
                              <>
                                <span className="text-[9px] font-black px-2.5 py-1 rounded-full bg-red-100 text-red-600 uppercase tracking-widest">🔴 Defectuoso</span>
                                <button onClick={() => handleStatusChange(w._id, 'resolved_by_provider')}
                                  className="text-[9px] font-black px-2.5 py-1 rounded-full bg-emerald-600 text-white hover:bg-emerald-700 transition-all uppercase">
                                  ✓ Repuesto
                                </button>
                                <button onClick={() => handleStatusChange(w._id, 'loss')}
                                  className="text-[9px] font-black px-2.5 py-1 rounded-full bg-red-600 text-white hover:bg-red-700 transition-all uppercase">
                                  ✕ Pérdida
                                </button>
                              </>
                            )}
                            {w.status === 'resolved_by_provider' && (
                              <span className="text-[9px] font-black px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 uppercase">✓ Repuesto por fabricante</span>
                            )}
                            {w.status === 'loss' && (
                              <span className="text-[9px] font-black px-2.5 py-1 rounded-full bg-red-100 text-red-600 uppercase">🔴 Pérdida</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* Config modal */}
      {showConfig && (
        <Modal title="Configuración de Garantías" onClose={() => setShowConfig(false)}>
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Días de garantía predeterminados (todos los productos)</label>
              <NumInput value={defaultDays} onChange={setDefaultDays}
                className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl outline-none font-black text-2xl" />
              <p className="text-[10px] text-gray-400 ml-2">Por defecto: 2 días. Al vencer la garantía, el monto pasa a ser ganancia real.</p>
            </div>

            <div className="space-y-3">
              <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Garantía por Producto (sobreescribe el valor predeterminado)</h4>
              <div className="max-h-64 overflow-y-auto space-y-2">
                {products.map(p => (
                  <div key={p._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl">
                    <span className="font-bold text-gray-800 text-sm truncate flex-1 mr-3">{p.model}</span>
                    <div className="flex items-center gap-2">
                      <NumInput value={productDaysMap[p._id] || ''}
                        onChange={(v: string) => setProductDaysMap(prev => ({ ...prev, [p._id]: v }))}
                        placeholder={String(config?.defaultDays ?? 2)}
                        className="w-20 p-2 bg-white border border-gray-200 rounded-xl outline-none font-bold text-sm text-center focus:border-indigo-600" />
                      <span className="text-[10px] font-bold text-gray-400">días</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button onClick={saveConfig} disabled={savingConfig}
              className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all disabled:opacity-50">
              {savingConfig ? 'Guardando...' : 'Guardar Configuración'}
            </button>
          </div>
        </Modal>
      )}

      {pendingConfirm && (
        <ConfirmDialog
          message={pendingConfirm.message}
          onConfirm={() => { pendingConfirm.onConfirm(); setPendingConfirm(null); }}
          onCancel={() => setPendingConfirm(null)}
        />
      )}
    </div>
  );
};
