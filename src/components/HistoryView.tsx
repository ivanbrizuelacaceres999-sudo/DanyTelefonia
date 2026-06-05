import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus, ShoppingBag, Wallet, ChevronRight, Wrench, Smartphone, Trash2,
  ShieldCheck, ShieldAlert, ShieldX, CheckCircle, X, AlertCircle, RefreshCw,
  Banknote, ArrowDownLeft, FileDown, Calendar, Loader2, Search, Hash, Package
} from 'lucide-react';
import { buildExcel } from '../utils/exportExcel';
import { api } from '../api';
import { socket } from '../socket';
import { Sale, FixedCost, CashSession, UserProfile, ExpenseConfig, CashWithdrawal, WithdrawalMotive, Product } from '../types';
import { Modal } from './ui/Modal';
import { NumericInput } from './ui/NumericInput';
import { cn } from '../lib/utils';
import { format, parseISO, isSameDay, isSameMonth, isSameYear } from 'date-fns';

interface HistoryViewProps {
  sales?:     Sale[];
  fixedCosts: FixedCost[];
  repairs?:   any[];
  products?:  Product[];
  user?:      UserProfile;
  onRefresh:  () => void;
}

const toNum = (v: any) => { const n = Number(v); return isNaN(n) ? 0 : n; };
const sameId = (a: any, b: any) => String(a) === String(b);
const METHOD_LABELS: Record<string, string> = {
  cash: 'Efectivo', credit_card: 'T. Crédito', debit_card: 'T. Débito',
  transfer: 'Transferencia', qr: 'QR', credit: 'Crédito', mixed: 'Múltiple'
};
const fmt = (date: string) => { try { return format(parseISO(date), 'dd/MM/yyyy HH:mm'); } catch { return '—'; } };
const fmtDate = (date: string) => { try { return format(parseISO(date), 'dd/MM/yyyy'); } catch { return '—'; } };

export const HistoryView = ({ fixedCosts, repairs = [], products = [], user, onRefresh }: HistoryViewProps) => {
  const isAdmin = user?.role === 'admin';

  // ── Sub-pestañas ──────────────────────────────────────────
  const [mainTab, setMainTab] = useState<'ventas' | 'garantias' | 'retiros'>('ventas');

  // ── Ventas desde MongoDB directo (no desde estado de React) ──
  const [sales,        setSales]        = useState<Sale[]>([]);
  const [loadingSales, setLoadingSales] = useState(false);

  // ── Estado ────────────────────────────────────────────────
  const [isAddingCost,      setIsAddingCost]      = useState(false);
  const [newCost,           setNewCost]            = useState({ description: '', amount: '' });
  const [filterType,        setFilterType]         = useState<'session'|'day'|'month'|'year'>('session');
  const [selectedDate,      setSelectedDate]       = useState(new Date().toISOString().split('T')[0]);
  const [selectedSaleId,    setSelectedSaleId]     = useState<string | null>(null);
  const [sessions,          setSessions]           = useState<CashSession[]>([]);
  const [selectedSessionId, setSelectedSessionId]  = useState<string>('');
  const [expenseConfig,     setExpenseConfig]      = useState<ExpenseConfig>({ operativePercent: 0, fixedPercent: 0 });
  const [warrantyModal,     setWarrantyModal]      = useState<any | null>(null);
  // Producto seleccionado dentro del modal de garantía
  const [warrantyItem,      setWarrantyItem]       = useState<{id: string; name: string; qty: number; maxQty: number} | null>(null);
  const [applyingWarranty,  setApplyingWarranty]   = useState(false);
  const [warranties,        setWarranties]         = useState<any[]>([]);
  // Flujo garantía de reparación
  const [repairWarrantyFlow, setRepairWarrantyFlow] = useState<'labor' | 'part' | null>(null);
  const [repairWarrantyPart, setRepairWarrantyPart] = useState('');

  // ── Retiros de caja ────────────────────────────────────────────
  const [withdrawals,       setWithdrawals]        = useState<CashWithdrawal[]>([]);
  const [withdrawalMotives, setWithdrawalMotives]  = useState<WithdrawalMotive[]>([]);
  const [addingWithdrawal,  setAddingWithdrawal]   = useState(false);
  const [savingWithdrawal,  setSavingWithdrawal]   = useState(false);
  const [newWithdrawal,     setNewWithdrawal]      = useState({ amount: '', motiveId: '', note: '' });

  // ── Búsqueda ───────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');

  // ── Exportar Excel ─────────────────────────────────────────────
  type ExportPeriod = 'today' | 'week' | 'month' | 'custom';
  const [exportModal,    setExportModal]    = useState(false);
  const [exportPeriod,   setExportPeriod]   = useState<ExportPeriod>('month');
  const [exportFrom,     setExportFrom]     = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [exportTo,       setExportTo]       = useState(() => new Date().toISOString().split('T')[0]);
  const [exportLoading,  setExportLoading]  = useState(false);
  const [exportError,    setExportError]    = useState(false);

  // selectedSale reactivo — se actualiza automáticamente cuando sales cambia (WebSocket)
  const selectedSale = selectedSaleId
    ? (sales.find(s => s._id === selectedSaleId) ?? null)
    : null;

  // Cargar ventas desde MongoDB cada vez que cambia el filtro
  const loadSales = async () => {
    setLoadingSales(true);
    try {
      const data = await api.getSales();
      if (Array.isArray(data)) setSales(data);
    } catch { /* silent */ }
    finally { setLoadingSales(false); }
  };

  const loadWithdrawals = () => {
    (api as any).getCashWithdrawals().then((w: any) => {
      if (Array.isArray(w)) setWithdrawals(w);
    });
  };

  useEffect(() => {
    (api as any).getExpenseConfig().then((c: any) => {
      if (c && !c.error) setExpenseConfig({ operativePercent: c.operativePercent ?? 0, fixedPercent: c.fixedPercent ?? 0 });
    });
    api.getSessions().then((s: any) => {
      if (Array.isArray(s) && s.length > 0) {
        setSessions(s);
        setSelectedSessionId(String(s[0]._id));
      }
    });
    loadWarranties();
    loadSales();
    loadWithdrawals();
    (api as any).getWithdrawalMotives().then((m: any) => { if (Array.isArray(m)) setWithdrawalMotives(m); });

    // Si venimos de escanear un código VEN-, abrir esa venta directo
    const openSaleId = sessionStorage.getItem('openSaleId');
    if (openSaleId) {
      sessionStorage.removeItem('openSaleId');
      setTimeout(() => setSelectedSaleId(openSaleId), 300);
    }
    // Si venimos del Dashboard (alerta de garantías)
    const openWarrantyTab = sessionStorage.getItem('openWarrantyTab');
    if (openWarrantyTab) {
      sessionStorage.removeItem('openWarrantyTab');
      setMainTab('garantias');
    }
  }, []);

  // Recargar ventas cuando cambia el filtro
  useEffect(() => { loadSales(); }, [filterType, selectedDate, selectedSessionId]);

  // Recargar garantías cuando se aplica una
  useEffect(() => { loadWarranties(); }, []);

  // Escuchar cambios via WebSocket — recarga desde MongoDB automáticamente
  // Sin depender del estado de React de App.tsx
  useEffect(() => {
    const handleUpdate = ({ event }: { event: string }) => {
      if (event === 'sales' || event === 'warranties' || event === 'sessions') {
        loadSales();
        if (event === 'warranties') loadWarranties();
      }
    };
    socket.on('data_update', handleUpdate);
    return () => { socket.off('data_update', handleUpdate); };
  }, []);

  // Escuchar cambios en tiempo real via WebSocket
  // Cuando se crea una venta, se aplica una garantía, etc.
  // HistoryView recarga automáticamente desde MongoDB
  useEffect(() => {
    const handleUpdate = ({ event }: { event: string }) => {
      if (event === 'sales' || event === 'warranties' || event === 'sessions') {
        loadSales();
        if (event === 'warranties') loadWarranties();
      }
      if (event === 'cash-withdrawals') loadWithdrawals();
    };
    socket.on('data_update', handleUpdate);
    return () => { socket.off('data_update', handleUpdate); };
  }, [filterType, selectedDate, selectedSessionId]);

  const loadWarranties = () => {
    api.getWarranties().then((w: any) => { if (Array.isArray(w)) setWarranties(w); });
  };

  // ── Filtrado de ventas ────────────────────────────────────
  const filteredSales: Sale[] = (() => {
    if (filterType === 'session') {
      const sess = sessions.find(s => sameId(s._id, selectedSessionId));
      if (!sess) return [];
      try {
        const sessDate = parseISO(sess.openedAt);
        return sales.filter(s => { try { return isSameDay(parseISO(s.date), sessDate); } catch { return false; } });
      } catch { return []; }
    }
    try {
      const d = parseISO(selectedDate);
      return sales.filter(s => {
        try {
          const sd = parseISO(s.date);
          if (filterType === 'day')   return isSameDay(sd, d);
          if (filterType === 'month') return isSameMonth(sd, d);
          if (filterType === 'year')  return isSameYear(sd, d);
        } catch { return false; }
        return false;
      });
    } catch { return []; }
  })();

  const filteredCosts: FixedCost[] = (() => {
    if (filterType === 'session' || filterType === 'day') return [];
    try {
      const d = parseISO(selectedDate);
      return fixedCosts.filter(c => {
        try {
          const cd = parseISO(c.date);
          if (filterType === 'month') return isSameMonth(cd, d);
          if (filterType === 'year')  return isSameYear(cd, d);
        } catch { return false; }
        return false;
      });
    } catch { return []; }
  })();

  const showsFixedCosts = filterType === 'month' || filterType === 'year';

  // Búsqueda sobre las ventas ya filtradas por período
  const visibleSales: Sale[] = searchQuery.trim()
    ? filteredSales.filter(s => {
        const q = searchQuery.trim().toLowerCase();
        return (
          s._id.toLowerCase().includes(q) ||
          (s.customerName || '').toLowerCase().includes(q)
        );
      })
    : filteredSales;

  // ── Cálculos ─────────────────────────────────────────────
  const revenue    = filteredSales.reduce((a, s) => a + toNum(s.total), 0);
  const costTotal  = filteredSales.reduce((a, s) => a + toNum(s.costTotal), 0);
  const fixedTotal = filteredCosts.reduce((a, c) => a + toNum(c.amount), 0);
  const warrantyImpact = filteredSales.reduce((a, s) => {
    return a + (((s as any).warrantyAdjustments || []) as any[]).reduce((sum: number, adj: any) => sum + toNum(adj.amount), 0);
  }, 0);
  const operativeAlloc = revenue * expenseConfig.operativePercent / 100;
  const fixedAlloc     = revenue * expenseConfig.fixedPercent / 100;

  // effectiveFixed: si hay gastos fijos registrados (vista mes/año) se usan los reales;
  // en vista sesión/día se usa la asignación porcentual configurada (fixedPercent).
  // Esto asegura que el % de "Gasto Fijo" siempre repercute en el resultado.
  const effectiveFixed = (showsFixedCosts && fixedTotal > 0) ? fixedTotal : fixedAlloc;

  const profit     = revenue - costTotal - effectiveFixed + warrantyImpact;
  const realProfit = revenue - costTotal - operativeAlloc - effectiveFixed + warrantyImpact;

  const byMethod: Record<string, number> = {};
  filteredSales.forEach(s => {
    if (s.payments?.length > 0) s.payments.forEach(p => { byMethod[p.method] = (byMethod[p.method] || 0) + toNum(p.amount); });
    else byMethod[s.paymentMethod] = (byMethod[s.paymentMethod] || 0) + toNum(s.total);
  });

  // ── Garantías pendientes (defectuosas sin resolver) ───────
  const pendingWarranties = warranties.filter(w => w.status === 'defective');

  // Contador de garantías del mes actual
  const now = new Date();
  const monthWarranties = warranties.filter(w => {
    try { return isSameMonth(parseISO(w.date), now); } catch { return false; }
  });
  const monthLosses = monthWarranties.filter(w => w.status === 'loss').length;

  // ── Aplicar garantía ──────────────────────────────────────
  const handleApplyWarranty = async (warrantyId: string, status: 'defective' | 'resolved_by_provider' | 'loss') => {
    setApplyingWarranty(true);
    try {
      // Si hay un ítem seleccionado, pasamos la info al servidor
      await (api as any).applyWarranty(warrantyId, status, warrantyItem);
      await Promise.all([loadWarranties(), loadSales()]);
      onRefresh();
      setWarrantyModal(null);
      setWarrantyItem(null);
    } catch { /* silent – el usuario ve el botón volver a su estado normal */ }
    finally { setApplyingWarranty(false); }
  };

  const handleAddCost = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.createFixedCost({ description: newCost.description, amount: parseInt(newCost.amount) || 0, date: new Date().toISOString() });
    setIsAddingCost(false);
    setNewCost({ description: '', amount: '' });
    onRefresh();
  };

  const handleAddWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseInt(newWithdrawal.amount) || 0;
    if (!amount || !newWithdrawal.motiveId) return;
    setSavingWithdrawal(true);
    try {
      const motive = withdrawalMotives.find(m => m._id === newWithdrawal.motiveId);
      await (api as any).createCashWithdrawal({
        amount,
        motive: motive?.name ?? newWithdrawal.motiveId,
        note: newWithdrawal.note.trim(),
      });
      setAddingWithdrawal(false);
      setNewWithdrawal({ amount: '', motiveId: '', note: '' });
      loadWithdrawals();
    } finally { setSavingWithdrawal(false); }
  };

  const handleDeleteWithdrawal = async (id: string) => {
    await (api as any).deleteCashWithdrawal(id);
    loadWithdrawals();
  };

  // ── Calcular rango de exportación ─────────────────────────────
  const getExportRange = () => {
    const today = new Date();
    if (exportPeriod === 'today') {
      const d = today.toISOString().split('T')[0];
      return { from: d, to: d, label: `Hoy_${d}` };
    }
    if (exportPeriod === 'week') {
      const mon = new Date(today);
      mon.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1));
      const from = mon.toISOString().split('T')[0];
      const to   = today.toISOString().split('T')[0];
      return { from, to, label: `Semana_${from}_${to}` };
    }
    if (exportPeriod === 'month') {
      const from = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
      const to   = today.toISOString().split('T')[0];
      return { from, to, label: `${today.toLocaleDateString('es-PY', { month: 'long', year: 'numeric' })}` };
    }
    return { from: exportFrom, to: exportTo, label: `${exportFrom}_${exportTo}` };
  };

  const handleExport = async () => {
    setExportLoading(true);
    try {
      const { from, to, label } = getExportRange();
      const data = await (api as any).getExportData(from, to);
      buildExcel(data, label);
      setExportModal(false);
    } catch (e) {
      setExportError(true);
    } finally {
      setExportLoading(false);
    }
  };

  // ── Garantías de la venta seleccionada ───────────────────
  const saleWarranties = selectedSale
    ? warranties.filter(w => String(w.saleId) === String(selectedSale._id))
    : [];

  // ── Detección de garantía de reparación ──────────────────
  const isRepairWarranty = warrantyModal?.productName?.startsWith('Reparación:') ?? false;
  const repairWarrantyRepairItem = isRepairWarranty
    ? (selectedSale?.items || []).find((i: any) => i.type === 'repair')
    : null;
  const repairId = (warrantyModal as any)?.productId || repairWarrantyRepairItem?.id || null;
  const repairRepairData = repairId ? (repairs || []).find((r: any) => r._id === repairId) : null;

  const handleApplyRepairWarranty = async () => {
    if (!repairId || !repairWarrantyFlow) return;
    if (repairWarrantyFlow === 'part' && !repairWarrantyPart) return;
    setApplyingWarranty(true);
    try {
      await api.applyRepairWarranty(repairId, {
        type: repairWarrantyFlow,
        defectivePart: repairWarrantyFlow === 'part' ? repairWarrantyPart : undefined,
      });
      // Marcar la garantía original como usada
      try { await (api as any).applyWarranty(warrantyModal._id, 'defective'); } catch {}
      setWarrantyModal(null);
      setRepairWarrantyFlow(null);
      setRepairWarrantyPart('');
      setWarrantyItem(null);
      onRefresh();
      loadWarranties();
    } catch (e: any) {
      alert('Error al aplicar garantía: ' + (e?.message ?? 'Error desconocido'));
    } finally { setApplyingWarranty(false); }
  };

  return (
    <div className="space-y-6 pb-20">

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-4xl font-black text-gray-800 tracking-tighter">Historial</h2>
          <p className="text-gray-400 font-bold tracking-widest uppercase text-[10px] mt-1">Reportes Detallados</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Contador garantías del mes */}
          {pendingWarranties.length > 0 && (
            <button onClick={() => setMainTab('garantias')}
              className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-600 border border-amber-200 rounded-2xl font-black text-sm hover:bg-amber-100 transition-all">
              <ShieldAlert size={16} />
              {pendingWarranties.length} garantía{pendingWarranties.length !== 1 ? 's' : ''} pendiente{pendingWarranties.length !== 1 ? 's' : ''}
            </button>
          )}
          {monthLosses > 0 && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 border border-red-100 rounded-2xl text-[10px] font-black">
              🔴 {monthLosses} pérdida{monthLosses !== 1 ? 's' : ''} este mes
            </span>
          )}
          <button onClick={() => onRefresh()}
            className="flex items-center gap-2 bg-gray-50 text-gray-600 font-black px-4 py-2 rounded-2xl hover:bg-gray-100 transition-all border border-gray-100 text-sm">
            <RefreshCw size={16} /> Actualizar
          </button>
          <button onClick={() => setExportModal(true)}
            className="flex items-center gap-2 bg-emerald-600 text-white font-black px-4 py-2 rounded-2xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 text-sm">
            <FileDown size={16} /> Exportar Excel
          </button>
          {showsFixedCosts && (
            <button onClick={() => setIsAddingCost(true)}
              className="flex items-center gap-2 bg-red-50 text-red-600 font-black px-4 py-2 rounded-2xl hover:bg-red-100 transition-all border border-red-100 text-sm">
              <Plus size={16} /> Registrar Gasto
            </button>
          )}
          {mainTab === 'retiros' && (
            <button onClick={() => setAddingWithdrawal(true)}
              className="flex items-center gap-2 bg-indigo-600 text-white font-black px-4 py-2 rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 text-sm">
              <ArrowDownLeft size={16} /> Registrar Retiro
            </button>
          )}
        </div>
      </div>

      {/* ── Sub-pestañas: Ventas | Garantías Pendientes ── */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
        <button onClick={() => setMainTab('ventas')}
          className={cn("px-4 md:px-6 py-3 rounded-2xl font-black text-sm transition-all flex items-center gap-2 whitespace-nowrap flex-shrink-0",
            mainTab === 'ventas'
              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200"
              : "bg-white text-gray-500 border border-gray-100 hover:bg-gray-50")}>
          <ShoppingBag size={16} /> Ventas
        </button>
        <button onClick={() => setMainTab('garantias')}
          className={cn("px-4 md:px-6 py-3 rounded-2xl font-black text-sm transition-all flex items-center gap-2 whitespace-nowrap flex-shrink-0",
            mainTab === 'garantias'
              ? "bg-amber-500 text-white shadow-lg shadow-amber-200"
              : "bg-white text-gray-500 border border-gray-100 hover:bg-gray-50")}>
          <ShieldAlert size={16} /> <span className="hidden sm:inline">Garantías Pendientes</span><span className="sm:hidden">Garantías</span>
          {pendingWarranties.length > 0 && (
            <span className={cn("text-[9px] font-black px-1.5 py-0.5 rounded-full",
              mainTab === 'garantias' ? "bg-white/30 text-white" : "bg-amber-100 text-amber-600")}>
              {pendingWarranties.length}
            </span>
          )}
        </button>
        <button onClick={() => setMainTab('retiros')}
          className={cn("px-4 md:px-6 py-3 rounded-2xl font-black text-sm transition-all flex items-center gap-2 whitespace-nowrap flex-shrink-0",
            mainTab === 'retiros'
              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200"
              : "bg-white text-gray-500 border border-gray-100 hover:bg-gray-50")}>
          <Banknote size={16} /> <span className="hidden sm:inline">Retiros de Caja</span><span className="sm:hidden">Retiros</span>
          {withdrawals.length > 0 && (
            <span className={cn("text-[9px] font-black px-1.5 py-0.5 rounded-full",
              mainTab === 'retiros' ? "bg-white/30 text-white" : "bg-indigo-100 text-indigo-600")}>
              {withdrawals.length}
            </span>
          )}
        </button>
      </div>

      {/* ════════════════════════════════════════
          SUB-PESTAÑA: GARANTÍAS PENDIENTES
          ════════════════════════════════════════ */}
      {mainTab === 'garantias' && (
        <div className="space-y-4">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">
            Garantías defectuosas sin resolver — esperando decisión de empate o pérdida
          </p>

          {pendingWarranties.length === 0 ? (
            <div className="text-center py-20 bg-gray-50 rounded-[30px] text-gray-300">
              <ShieldCheck size={40} className="mx-auto mb-4" />
              <p className="font-black uppercase tracking-widest text-sm">Sin garantías pendientes</p>
              <p className="text-[10px] font-bold mt-2">Todas las garantías defectuosas fueron resueltas</p>
            </div>
          ) : (
            pendingWarranties.map(w => {
              const sale = sales.find(s => String(s._id) === String(w.saleId));
              return (
                <motion.div key={w._id} layout
                  className="bg-amber-50 border-2 border-amber-200 rounded-[30px] p-6 space-y-4">

                  {/* Info de la garantía */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600">
                        <ShieldAlert size={24} />
                      </div>
                      <div>
                        <p className="font-black text-gray-800">{w.productName}</p>
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                          {w.customerName} · Compra: {fmtDate(w.date)}
                        </p>
                        <p className="text-[10px] font-bold text-amber-600 mt-0.5">
                          Garantía hasta: {fmtDate(w.expiresAt)} · Monto: Gs. {toNum(w.amount).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <span className="text-[9px] font-black px-3 py-1.5 bg-amber-200 text-amber-800 rounded-full uppercase tracking-widest">
                      🟠 Defectuoso
                    </span>
                  </div>

                  {/* Venta original */}
                  {sale && (
                    <button onClick={() => { setSelectedSaleId(String(sale._id)); setMainTab('ventas'); }}
                      className="w-full flex items-center justify-between p-3 bg-white rounded-2xl border border-amber-100 hover:border-indigo-300 transition-all group">
                      <div className="flex items-center gap-2">
                        <ShoppingBag size={14} className="text-indigo-500" />
                        <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Ver venta original</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-gray-400">{fmt(sale.date)} · Gs. {toNum(sale.total).toLocaleString()}</span>
                        <ChevronRight size={14} className="text-gray-300 group-hover:text-indigo-500" />
                      </div>
                    </button>
                  )}

                  {/* Decisión */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">¿Cómo se resolvió?</p>
                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() => handleApplyWarranty(w._id, 'resolved_by_provider')}
                        disabled={applyingWarranty}
                        className="flex items-center gap-2 px-5 py-3 bg-emerald-600 text-white rounded-2xl font-black text-sm hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 disabled:opacity-50">
                        <CheckCircle size={16} />
                        {applyingWarranty ? '...' : '🟡 Empate — Fabricante repuso'}
                      </button>
                      <button
                        onClick={() => handleApplyWarranty(w._id, 'loss')}
                        disabled={applyingWarranty}
                        className="flex items-center gap-2 px-5 py-3 bg-red-600 text-white rounded-2xl font-black text-sm hover:bg-red-700 transition-all shadow-lg shadow-red-200 disabled:opacity-50">
                        <X size={16} />
                        {applyingWarranty ? '...' : '🔴 Pérdida — Costo nuestro'}
                      </button>
                    </div>
                    <p className="text-[9px] font-bold text-gray-400">
                      Empate: el fabricante repone el producto al stock. Sin impacto en ganancias.
                      Pérdida: se descuenta de la ganancia de la venta original.
                    </p>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      )}

      {/* ════════════════════════════════════════
          SUB-PESTAÑA: RETIROS DE CAJA
          ════════════════════════════════════════ */}
      {mainTab === 'retiros' && (
        <div className="space-y-4">

          {/* Tarjeta resumen */}
          {withdrawals.length > 0 && (() => {
            const totalRetiro = withdrawals.reduce((s, w) => s + toNum(w.amount), 0);
            return (
              <div className="bg-indigo-600 text-white p-6 rounded-[30px] shadow-xl shadow-indigo-200 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mb-1">Total Retirado</p>
                  <p className="text-4xl font-black tracking-tighter">Gs. {totalRetiro.toLocaleString()}</p>
                  <p className="text-[9px] font-bold text-indigo-300 mt-1">{withdrawals.length} retiro{withdrawals.length !== 1 ? 's' : ''} registrado{withdrawals.length !== 1 ? 's' : ''}</p>
                </div>
                <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center">
                  <Banknote size={32} className="text-white" />
                </div>
              </div>
            );
          })()}

          {/* Lista de retiros */}
          {withdrawals.length === 0 ? (
            <div className="text-center py-20 bg-gray-50 rounded-[30px] text-gray-300">
              <Banknote size={40} className="mx-auto mb-4" />
              <p className="font-black uppercase tracking-widest text-sm">Sin retiros registrados</p>
              <p className="text-[10px] font-bold mt-2">Usá "Registrar Retiro" para empezar</p>
            </div>
          ) : (
            <div className="space-y-3">
              {[...withdrawals].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(w => (
                <motion.div key={w._id} layout
                  className="bg-white flex items-center justify-between p-5 rounded-[25px] border border-gray-100 hover:shadow-md transition-all group">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-500 flex-shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                      <ArrowDownLeft size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-black text-gray-800">{w.motive}</p>
                        {w.note && (
                          <span className="text-[9px] font-bold text-gray-400 bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-full">
                            {w.note}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                        {(() => { try { return format(parseISO(w.date), 'dd/MM/yyyy HH:mm'); } catch { return '—'; } })()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="font-black text-indigo-600 text-xl tracking-tighter">
                      Gs. {toNum(w.amount).toLocaleString()}
                    </p>
                    {isAdmin && (
                      <button
                        onClick={() => handleDeleteWithdrawal(w._id)}
                        className="p-2 text-gray-300 hover:text-red-500 transition-colors rounded-xl hover:bg-red-50">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Aviso si no hay destinos configurados */}
          {withdrawalMotives.length === 0 && (
            <div className="bg-amber-50 border border-amber-100 rounded-[25px] p-4 flex items-start gap-3">
              <AlertCircle size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
              <p className="text-[10px] font-bold text-amber-600">
                No hay destinos configurados. Andá a <strong>Gastos → Destinos Retiro</strong> para crear el primero.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════
          SUB-PESTAÑA: VENTAS
          ════════════════════════════════════════ */}
      {mainTab === 'ventas' && (
        <div className="space-y-6">

          {/* Filtros */}
          <div className="bg-white rounded-[30px] p-6 shadow-sm border border-gray-100 space-y-4">
            <div className="flex gap-2 flex-wrap">
              {(['session','day','month','year'] as const).map(t => (
                <button key={t} onClick={() => setFilterType(t)}
                  className={cn("px-4 py-2 rounded-2xl font-black text-sm transition-all",
                    filterType === t ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" : "bg-gray-50 text-gray-500 hover:bg-gray-100")}>
                  {t === 'session' ? 'Sesión' : t === 'day' ? 'Día' : t === 'month' ? 'Mes' : 'Año'}
                </button>
              ))}
            </div>
            {filterType === 'session' && (
              <select value={selectedSessionId} onChange={e => setSelectedSessionId(e.target.value)}
                className="w-full p-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-bold text-sm">
                {sessions.map(s => (
                  <option key={String(s._id)} value={String(s._id)}>
                    {fmtDate(s.openedAt)} — {s.status === 'open' ? '🟢 Abierta' : '🔴 Cerrada'}
                  </option>
                ))}
              </select>
            )}
            {filterType !== 'session' && (
              <input
                type={filterType === 'day' ? 'date' : filterType === 'month' ? 'month' : 'number'}
                value={filterType === 'month' ? selectedDate.slice(0, 7) : selectedDate}
                onChange={e => setSelectedDate(
                  filterType === 'month' ? e.target.value + '-01' : e.target.value
                )}
                className="w-full p-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-bold text-sm" />
            )}

            {/* Buscador por ID o nombre */}
            <div className="relative">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Buscar por ID de ticket o nombre del cliente…"
                className="w-full pl-10 pr-10 py-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-bold text-sm focus:border-indigo-300 focus:bg-white transition-all"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors">
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Tarjetas de estadísticas */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

            <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Cobrado</p>
              <p className="text-[9px] font-bold text-gray-300 mb-2">Lo que entraste en caja</p>
              <p className="text-4xl font-black text-emerald-500 tracking-tighter">Gs. {revenue.toLocaleString()}</p>
              {Object.keys(byMethod).length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100 space-y-1.5">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Por método</p>
                  {Object.entries(byMethod).map(([m, v]) => (
                    <div key={m} className="flex justify-between">
                      <span className="text-[10px] font-bold text-gray-500">{METHOD_LABELS[m] || m}</span>
                      <span className="text-[10px] font-black text-gray-800">Gs. {toNum(v).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Costo Mercancía</p>
              <p className="text-[9px] font-bold text-gray-300 mb-2">Lo que pagaste por los productos</p>
              <p className="text-4xl font-black text-amber-500 tracking-tighter">Gs. {costTotal.toLocaleString()}</p>
              {filteredSales.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                  <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Ganancia bruta</p>
                  <p className="text-2xl font-black text-emerald-600">Gs. {(revenue - costTotal).toLocaleString()}</p>
                  {warrantyImpact < 0 && (
                    <div className="bg-red-50 rounded-xl p-2">
                      <p className="text-[9px] font-black text-red-500">🔴 Pérdidas garantías: -Gs. {Math.abs(warrantyImpact).toLocaleString()}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Gastos Fijos</p>
              {showsFixedCosts && fixedTotal > 0 ? (
                <>
                  <p className="text-4xl font-black text-red-500 tracking-tighter">Gs. {fixedTotal.toLocaleString()}</p>
                  <p className="text-[9px] font-bold text-gray-400 mt-3">{filteredCosts.length} gasto{filteredCosts.length !== 1 ? 's' : ''} registrado{filteredCosts.length !== 1 ? 's' : ''}</p>
                </>
              ) : expenseConfig.fixedPercent > 0 ? (
                <>
                  <p className="text-4xl font-black text-violet-400 tracking-tighter">Gs. {Math.round(fixedAlloc).toLocaleString()}</p>
                  <p className="text-[9px] font-bold text-gray-400 mt-3">
                    {expenseConfig.fixedPercent}% asignado de las ventas
                    {!showsFixedCosts && <span className="ml-1 text-violet-400">(estimado)</span>}
                  </p>
                </>
              ) : (
                <div className="mt-2">
                  <p className="text-2xl font-black text-gray-200">—</p>
                  <p className="text-[9px] font-bold text-gray-300 mt-2">Sin gastos fijos configurados</p>
                </div>
              )}
            </div>

            <div className={cn("p-8 rounded-[40px] shadow-xl", realProfit >= 0 ? "bg-indigo-600" : "bg-red-500")}>
              <p className="text-[10px] font-black text-white/60 uppercase tracking-widest mb-1">Ganancia Real</p>
              <p className="text-4xl font-black text-white tracking-tighter">Gs. {realProfit.toLocaleString()}</p>
              <p className={cn('text-[9px] font-bold mt-2', realProfit >= 0 ? 'text-indigo-300' : 'text-red-200')}>
                {showsFixedCosts && fixedTotal > 0
                  ? `Ingreso − Stock − Gastos registrados − Sueldos (${expenseConfig.operativePercent}%)`
                  : `Ingreso − Stock − Gasto fijo (${expenseConfig.fixedPercent}%) − Sueldos (${expenseConfig.operativePercent}%)`
                }
              </p>
              {revenue > 0 && (
                <p className="text-[9px] font-bold text-white/50 mt-1">
                  Margen real: {Math.round((realProfit / revenue) * 100)}%
                  {operativeAlloc > 0 && ` · Sueldos: Gs. ${Math.round(operativeAlloc).toLocaleString()}`}
                  {effectiveFixed > 0 && ` · Gastos: Gs. ${Math.round(effectiveFixed).toLocaleString()}`}
                </p>
              )}
            </div>
          </div>

          {/* Gastos fijos */}
          {showsFixedCosts && filteredCosts.length > 0 && (
            <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100">
              <h3 className="text-xl font-black text-gray-800 mb-6 flex items-center gap-3">
                <Wallet size={20} className="text-red-500" /> Gastos Fijos del Período
              </h3>
              <div className="space-y-3">
                {filteredCosts.map((c, i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-red-50 rounded-2xl border border-red-100">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center text-red-500"><Wallet size={16} /></div>
                      <div>
                        <p className="font-bold text-gray-800">{c.description}</p>
                        <p className="text-[10px] font-bold text-gray-400">{fmtDate(c.date)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="font-black text-red-600">-Gs. {toNum(c.amount).toLocaleString()}</p>
                      <button onClick={async () => { await api.deleteFixedCost(c._id); onRefresh(); }}
                        className="p-2 text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={15} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Lista de ventas */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                {searchQuery.trim() ? 'Resultados de búsqueda' : 'Ventas del Período'}
              </h3>
              <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full uppercase tracking-widest">
                {visibleSales.length}{searchQuery.trim() && filteredSales.length !== visibleSales.length ? ` de ${filteredSales.length}` : ''} operaciones
              </span>
            </div>

            {loadingSales ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
              </div>
            ) : visibleSales.length === 0 ? (
              <div className="text-center py-20 bg-gray-50 rounded-[30px] text-gray-300">
                <ShoppingBag size={40} className="mx-auto mb-4" />
                <p className="font-black uppercase tracking-widest text-sm">
                  {searchQuery.trim() ? 'Sin resultados para esa búsqueda' : 'Sin ventas en este período'}
                </p>
                {searchQuery.trim() && (
                  <button onClick={() => setSearchQuery('')} className="mt-3 text-[11px] font-black text-indigo-400 hover:text-indigo-600 underline">
                    Limpiar búsqueda
                  </button>
                )}
              </div>
            ) : (
              visibleSales.map(s => {
                const adjList   = ((s as any).warrantyAdjustments || []) as any[];
                const hasLoss   = adjList.some((a: any) => a.type === 'loss');
                const hasEmpate = adjList.some((a: any) => a.type === 'provider_replenishment');
                const impact    = adjList.reduce((sum: number, a: any) => sum + toNum(a.amount), 0);
                const _opCost   = Math.round(toNum(s.total) * expenseConfig.operativePercent / 100);
                const _fixCost  = Math.round(toNum(s.total) * expenseConfig.fixedPercent / 100);
                const ganancia  = toNum(s.total) - toNum(s.costTotal) - _opCost - _fixCost + impact;
                const saleWarrs = warranties.filter(w => String(w.saleId) === String(s._id));
                const hasActive = saleWarrs.some(w => w.status === 'active');
                const hasPending = saleWarrs.some(w => w.status === 'defective');

                return (
                  <motion.div layout key={s._id} onClick={() => setSelectedSaleId(s._id)}
                    className={cn(
                      "p-5 rounded-[25px] border hover:shadow-xl transition-all cursor-pointer group flex items-center justify-between",
                      hasLoss    ? "bg-red-50 border-red-200 hover:border-red-400"
                      : hasPending ? "bg-amber-50 border-amber-200 hover:border-amber-300"
                      : hasEmpate  ? "bg-amber-50 border-amber-100 hover:border-amber-200"
                      : "bg-white border-gray-100 hover:border-indigo-100"
                    )}>
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center transition-all",
                        hasLoss    ? "bg-red-100 text-red-500 group-hover:bg-red-500 group-hover:text-white"
                        : hasPending ? "bg-amber-100 text-amber-500 group-hover:bg-amber-500 group-hover:text-white"
                        : "bg-gray-50 text-gray-400 group-hover:bg-indigo-600 group-hover:text-white"
                      )}>
                        <ShoppingBag size={20} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-black text-gray-800 text-sm">{s.customerName || 'Consumidor Final'}</p>
                          <span className="inline-flex items-center gap-1 text-[9px] font-black text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full font-mono">
                            <Hash size={9} />#{s._id.slice(-8).toUpperCase()}
                          </span>
                        </div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex flex-wrap items-center gap-1">
                          {(() => { try { return format(parseISO(s.date), 'HH:mm · dd/MM/yy'); } catch { return '—'; } })()}
                          {' · '}{s.items?.length ?? 0} art.
                          {s.items?.some((i: any) => i.type === 'repair') && (
                            <span className="text-[9px] font-black px-1.5 py-0.5 bg-amber-100 text-amber-600 rounded-full">🔧 Rep.</span>
                          )}
                          {hasLoss && <span className="text-[9px] font-black px-2 py-0.5 bg-red-200 text-red-700 rounded-full">🔴 Pérdida</span>}
                          {hasPending && <span className="text-[9px] font-black px-2 py-0.5 bg-amber-200 text-amber-700 rounded-full">🟠 Garantía pendiente</span>}
                          {hasEmpate && !hasLoss && <span className="text-[9px] font-black px-2 py-0.5 bg-amber-100 text-amber-600 rounded-full">🟡 Empate</span>}
                          {hasActive && !hasPending && !hasLoss && !hasEmpate && (
                            <span className="text-[9px] font-black px-1.5 py-0.5 bg-emerald-100 text-emerald-600 rounded-full">🛡 Garantía</span>
                          )}
                          {' · '}{METHOD_LABELS[s.paymentMethod] || s.paymentMethod}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-black text-indigo-600 text-xl tracking-tighter">Gs. {toNum(s.total).toLocaleString()}</p>
                        <p className={cn("text-[10px] font-black uppercase tracking-widest",
                          hasLoss ? "text-red-600" : hasEmpate ? "text-amber-600" : "text-emerald-500")}>
                          {hasLoss ? '🔴 ' : hasEmpate ? '🟡 ' : ''}Gs. {ganancia.toLocaleString()}
                        </p>
                        {(expenseConfig.operativePercent + expenseConfig.fixedPercent) > 0 && (
                          <p className="text-[9px] font-bold text-gray-400 mt-0.5">
                            -{expenseConfig.operativePercent + expenseConfig.fixedPercent}% costos deducidos
                          </p>
                        )}
                      </div>
                      <ChevronRight size={18} className="text-gray-300 group-hover:text-indigo-600 transition-colors" />
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ── Modal detalle de venta ── */}
      {selectedSale && (
        <Modal title="Detalle de Venta" onClose={() => { setSelectedSaleId(null); setWarrantyModal(null); }}>
          <div className="space-y-6">

            {/* ID del ticket */}
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-2xl border border-gray-100">
              <Hash size={14} className="text-gray-400 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">ID de Ticket</p>
                <p className="font-mono text-xs font-black text-gray-700 truncate">{selectedSale._id}</p>
              </div>
              <span className="ml-auto text-[10px] font-black text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full font-mono flex-shrink-0">
                #{selectedSale._id.slice(-8).toUpperCase()}
              </span>
            </div>

            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Fecha y Hora</p>
                <p className="text-xl font-black text-gray-800">{fmt(selectedSale.date)}</p>
              </div>
              <span className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                {selectedSale.paymentMethod === 'mixed' ? 'MÚLTIPLE' : (METHOD_LABELS[selectedSale.paymentMethod] || selectedSale.paymentMethod).toUpperCase()}
              </span>
            </div>

            {selectedSale.customerName && selectedSale.customerName !== 'Consumidor Final' && (
              <p className="font-bold text-gray-700 text-sm">
                Cliente: <span className="font-black text-gray-900">{selectedSale.customerName}</span>
              </p>
            )}

            {selectedSale.payments?.length > 1 && (
              <div className="p-4 bg-indigo-50 rounded-2xl space-y-2">
                <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Desglose de pagos</p>
                {selectedSale.payments.map((p, i) => (
                  <div key={i} className="flex justify-between text-sm font-bold text-indigo-800">
                    <span>{METHOD_LABELS[p.method] || p.method}</span>
                    <span>Gs. {toNum(p.amount).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Artículos */}
            <div className="space-y-2">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Artículos</p>
              {selectedSale.items?.map((item, idx) => {
                const isRepair   = item.type === 'repair';
                const repairData = isRepair ? (repairs || []).find((r: any) => r._id === item.id) : null;
                return (
                  <div key={idx} className={cn("p-4 rounded-2xl border",
                    isRepair ? "bg-amber-50 border-amber-100" : "bg-gray-50 border-transparent")}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center text-white flex-shrink-0',
                          isRepair ? 'bg-amber-500' : 'bg-indigo-500')}>
                          {isRepair ? <Wrench size={16} /> : <Smartphone size={16} />}
                        </div>
                        <div>
                          <p className="font-bold text-gray-800 text-sm">{item.name}</p>
                          <p className="text-[10px] font-bold text-gray-400 uppercase">
                            {isRepair ? 'Servicio de reparación' : `×${item.quantity} · Gs. ${toNum(item.price).toLocaleString()} c/u`}
                          </p>
                        </div>
                      </div>
                      <p className="font-black text-gray-800">Gs. {(toNum(item.price) * item.quantity).toLocaleString()}</p>
                    </div>
                    {isRepair && repairData?.partsUsed?.length > 0 && (
                      <div className="mt-3 ml-12 space-y-1.5">
                        <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest">Repuestos usados:</p>
                        {repairData.partsUsed.map((part: any, i: number) => (
                          <div key={i} className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-gray-600">• {part.name} ×{part.quantity || 1}</span>
                            <div className="text-right">
                              <p className="text-[10px] font-bold text-gray-500">Venta: Gs. {(toNum(part.price) * (part.quantity||1)).toLocaleString()}</p>
                              {part.cost > 0 && (
                                <p className="text-[9px] font-bold text-amber-600">Costo: Gs. {(toNum(part.cost) * (part.quantity||1)).toLocaleString()}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {isRepair && repairData?.partsUsed?.length === 0 && (
                      <p className="mt-2 ml-12 text-[10px] font-bold text-gray-400">Sin repuestos (mano de obra)</p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Totales + Desglose de costos */}
            <div className="pt-4 border-t border-gray-100 space-y-2">
              {toNum(selectedSale.discount) > 0 && (
                <>
                  <div className="flex justify-between text-sm text-gray-400 font-bold">
                    <span>Subtotal</span>
                    <span>Gs. {(toNum(selectedSale.total) + toNum(selectedSale.discount)).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm text-red-400 font-bold">
                    <span>Descuento</span><span>-Gs. {toNum(selectedSale.discount).toLocaleString()}</span>
                  </div>
                </>
              )}

              {/* Desglose de costos */}
              {(() => {
                const total   = toNum(selectedSale.total);
                const stock   = toNum(selectedSale.costTotal);
                const opCost  = Math.round(total * expenseConfig.operativePercent / 100);
                const fixCost = Math.round(total * expenseConfig.fixedPercent / 100);
                const adjs      = ((selectedSale as any).warrantyAdjustments || []) as any[];
                const hasLossM  = adjs.some((a: any) => a.type === 'loss');
                const imp       = adjs.reduce((s: number, a: any) => s + toNum(a.amount), 0);
                const ganReal   = total - stock - opCost - fixCost + imp;
                const showPerc  = expenseConfig.operativePercent > 0 || expenseConfig.fixedPercent > 0;

                return (
                  <div className="bg-gray-50 rounded-2xl p-4 space-y-2.5 border border-gray-100">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Desglose de costos</p>

                    <div className="flex justify-between items-center">
                      <span className="text-sm font-bold text-gray-600">📦 Costo stock (producto)</span>
                      <span className="font-black text-amber-600">-Gs. {stock.toLocaleString()}</span>
                    </div>

                    {showPerc && (
                      <>
                        {expenseConfig.operativePercent > 0 && (
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-bold text-gray-600">
                              👥 Costo operativo ({expenseConfig.operativePercent}%) sueldos
                            </span>
                            <span className="font-black text-orange-500">-Gs. {opCost.toLocaleString()}</span>
                          </div>
                        )}
                        {expenseConfig.fixedPercent > 0 && (
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-bold text-gray-600">
                              🏠 Gasto fijo ({expenseConfig.fixedPercent}%) luz/agua/renta
                            </span>
                            <span className="font-black text-violet-500">-Gs. {fixCost.toLocaleString()}</span>
                          </div>
                        )}
                      </>
                    )}

                    {adjs.length > 0 && (
                      <div className={cn("p-3 rounded-xl space-y-1.5 border",
                        hasLossM ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200")}>
                        <p className={cn("text-[9px] font-black uppercase tracking-widest",
                          hasLossM ? "text-red-600" : "text-amber-600")}>
                          {hasLossM ? "🔴 Garantía pérdida aplicada" : "🟡 Garantía empate (sin impacto)"}
                        </p>
                        {adjs.map((a: any, i: number) => (
                          <div key={i} className="flex justify-between text-[10px] font-bold">
                            <span className={hasLossM ? "text-red-500" : "text-amber-500"}>{a.productName}</span>
                            <span className={hasLossM ? "text-red-600 font-black" : "text-amber-600"}>
                              {a.amount < 0 ? `-Gs. ${Math.abs(a.amount).toLocaleString()}` : 'Sin impacto'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className={cn(
                      "flex justify-between items-center pt-2 border-t-2 font-black",
                      ganReal >= 0 ? "border-emerald-200 text-emerald-700" : "border-red-200 text-red-600"
                    )}>
                      <span className="text-sm">✅ Ganancia real</span>
                      <span className="text-lg">Gs. {ganReal.toLocaleString()}</span>
                    </div>
                    {total > 0 && (
                      <p className="text-[9px] font-bold text-gray-400 text-right">
                        Margen real: {Math.round((ganReal / total) * 100)}%
                      </p>
                    )}
                  </div>
                );
              })()}

              <div className="flex justify-between items-center pt-2 border-t-2 border-indigo-100">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Cobrado</span>
                <span className="text-3xl font-black text-indigo-600 tracking-tighter">Gs. {toNum(selectedSale.total).toLocaleString()}</span>
              </div>
            </div>

            {/* ── Garantías de esta venta ── */}
            {saleWarranties.length > 0 && (
              <div className="space-y-3 pt-2 border-t border-gray-100">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <ShieldCheck size={14} className="text-indigo-500" /> Garantías de esta venta
                </p>
                {saleWarranties.map(w => {
                  const expires   = new Date(w.expiresAt);
                  const isExpired = expires < new Date();
                  const daysLeft  = Math.ceil((expires.getTime() - Date.now()) / 86400000);
                  const canApply  = !isExpired || isAdmin;
                  const isDone    = w.status === 'loss' || w.status === 'resolved_by_provider';
                  return (
                    <div key={w._id} className={cn("p-4 rounded-2xl border",
                      w.status === 'loss'                   ? "bg-red-50 border-red-200"
                      : w.status === 'resolved_by_provider' ? "bg-emerald-50 border-emerald-200"
                      : w.status === 'defective'            ? "bg-amber-50 border-amber-200"
                      : isExpired                           ? "bg-gray-50 border-gray-200"
                      : "bg-indigo-50 border-indigo-200")}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {w.status === 'loss'                   ? <ShieldX size={16} className="text-red-600" />
                           : w.status === 'resolved_by_provider' ? <ShieldCheck size={16} className="text-emerald-600" />
                           : w.status === 'defective'            ? <ShieldAlert size={16} className="text-amber-600" />
                           : <ShieldCheck size={16} className={isExpired ? "text-gray-400" : "text-indigo-600"} />}
                          <p className="font-black text-gray-800 text-sm">{w.productName}</p>
                        </div>
                        <span className={cn("text-[9px] font-black px-2 py-0.5 rounded-full uppercase",
                          w.status === 'loss'                   ? "bg-red-200 text-red-700"
                          : w.status === 'resolved_by_provider' ? "bg-emerald-200 text-emerald-700"
                          : w.status === 'defective'            ? "bg-amber-200 text-amber-700"
                          : isExpired                           ? "bg-gray-200 text-gray-600"
                          : "bg-indigo-200 text-indigo-700")}>
                          {w.status === 'active'                 ? (isExpired ? 'Vencida' : `${daysLeft}d restantes`)
                           : w.status === 'defective'            ? '🟠 Defectuoso'
                           : w.status === 'loss'                 ? '🔴 Pérdida'
                           : w.status === 'resolved_by_provider' ? '🟡 Empate'
                           : w.status}
                        </span>
                      </div>
                      <p className="text-[10px] font-bold text-gray-400 mb-3">
                        Vence: {fmtDate(w.expiresAt)} · Monto: Gs. {toNum(w.amount).toLocaleString()}
                        {isExpired && isAdmin && ' · ⚠️ Vencida — admin puede ignorar'}
                      </p>
                      {/* ── Btn Aplicar Garantía ── */}
                      {!isDone && w.status === 'active' && (
                        <button
                          onClick={() => setWarrantyModal(w)}
                          disabled={!canApply}
                          className={cn("flex items-center gap-2 text-[10px] font-black px-4 py-2 rounded-xl transition-all",
                            canApply
                              ? "bg-amber-500 text-white hover:bg-amber-600 shadow-lg shadow-amber-200"
                              : "bg-gray-100 text-gray-400 cursor-not-allowed")}>
                          <ShieldAlert size={14} />
                          {canApply ? 'Aplicar Garantía' : 'Garantía vencida'}
                          {isExpired && isAdmin && ' (como admin)'}
                        </button>
                      )}
                      {!isDone && w.status === 'defective' && (
                        <div className="space-y-2">
                          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">¿Cómo se resolvió?</p>
                          <div className="flex gap-2">
                            <button onClick={() => handleApplyWarranty(w._id, 'resolved_by_provider')} disabled={applyingWarranty}
                              className="flex items-center gap-1.5 text-[10px] font-black px-3 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">
                              <CheckCircle size={12} /> {applyingWarranty ? '...' : '🟡 Empate'}
                            </button>
                            <button onClick={() => handleApplyWarranty(w._id, 'loss')} disabled={applyingWarranty}
                              className="flex items-center gap-1.5 text-[10px] font-black px-3 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
                              <X size={12} /> {applyingWarranty ? '...' : '🔴 Pérdida'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Modal aplicar garantía */}
      {warrantyModal && (() => {
        const saleItems = (selectedSale?.items || []).filter((i: any) => i.type === 'product');
        const hasMultipleItems = saleItems.length > 1;
        return (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }}
              className="bg-white rounded-[40px] p-8 shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">

              {/* Header */}
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600">
                  <ShieldAlert size={28} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Aplicar Garantía</p>
                  <h3 className="text-lg font-black text-gray-800">
                    {warrantyItem ? warrantyItem.name : warrantyModal.productName}
                  </h3>
                  <p className="text-xs font-bold text-gray-400 mt-0.5">
                    Monto: Gs. {toNum(warrantyModal.amount).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* ═══ FLUJO GARANTÍA DE REPARACIÓN ═══ */}
              {isRepairWarranty ? (
                <div className="space-y-4 mb-6">

                  {/* Paso 1: elegir tipo */}
                  {!repairWarrantyFlow && (
                    <div className="space-y-3">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">¿Por qué vuelve?</p>
                      <button onClick={() => setRepairWarrantyFlow('labor')}
                        className="w-full flex items-start gap-4 p-4 bg-amber-50 border-2 border-amber-200 rounded-2xl hover:border-amber-400 transition-all text-left">
                        <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600 flex-shrink-0">
                          <Wrench size={20} />
                        </div>
                        <div>
                          <p className="font-black text-gray-800">El problema volvió</p>
                          <p className="text-[10px] font-bold text-gray-500 mt-0.5">Falla de mano de obra. Se reabre sin costo.</p>
                        </div>
                      </button>
                      <button onClick={() => setRepairWarrantyFlow('part')}
                        className="w-full flex items-start gap-4 p-4 bg-red-50 border-2 border-red-200 rounded-2xl hover:border-red-400 transition-all text-left">
                        <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center text-red-600 flex-shrink-0">
                          <Package size={20} />
                        </div>
                        <div>
                          <p className="font-black text-gray-800">Un repuesto falló</p>
                          <p className="text-[10px] font-bold text-gray-500 mt-0.5">Seleccionás el repuesto defectuoso.</p>
                        </div>
                      </button>
                    </div>
                  )}

                  {/* Paso 2a: mano de obra */}
                  {repairWarrantyFlow === 'labor' && (
                    <div className="space-y-3">
                      <button onClick={() => setRepairWarrantyFlow(null)}
                        className="text-[10px] font-black text-indigo-500 hover:text-indigo-700">← Cambiar</button>
                      <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                        <p className="font-black text-amber-700 text-sm">Se creará una nueva reparación:</p>
                        <ul className="mt-2 space-y-1 text-[11px] font-bold text-amber-600">
                          <li>• Mismo cliente y equipo</li>
                          <li>• Costo: <span className="font-black">Gs. 0</span></li>
                          <li>• Marcada como 🔴 GARANTÍA</li>
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* Paso 2b: repuesto */}
                  {repairWarrantyFlow === 'part' && (
                    <div className="space-y-3">
                      <button onClick={() => { setRepairWarrantyFlow(null); setRepairWarrantyPart(''); }}
                        className="text-[10px] font-black text-indigo-500 hover:text-indigo-700">← Cambiar</button>

                      {repairRepairData?.partsUsed?.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Repuestos de esta reparación</p>
                          {repairRepairData.partsUsed.map((p: any, i: number) => (
                            <button key={i} onClick={() => setRepairWarrantyPart(p.name)}
                              className={cn('w-full flex items-center justify-between p-3 rounded-2xl border-2 transition-all text-left',
                                repairWarrantyPart === p.name
                                  ? 'bg-red-600 border-red-600 text-white'
                                  : 'bg-gray-50 border-gray-100 hover:border-red-300 text-gray-700')}>
                              <div className="flex items-center gap-2">
                                <Package size={14} />
                                <span className="font-black text-sm">{p.name}</span>
                              </div>
                              <span className="text-[10px] font-bold">×{p.quantity}</span>
                            </button>
                          ))}
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                          {repairRepairData?.partsUsed?.length > 0 ? 'O escribir manualmente' : '¿Qué repuesto falló?'}
                        </p>
                        <input type="text" value={repairWarrantyPart}
                          onChange={e => setRepairWarrantyPart(e.target.value)}
                          placeholder="Ej: Pantalla iPhone 13, Batería Samsung A15…"
                          className="w-full p-3 bg-gray-50 border-2 border-transparent focus:border-red-400 focus:bg-white rounded-2xl outline-none font-bold text-sm transition-all" />
                      </div>

                      {repairWarrantyPart && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-2xl">
                          <p className="font-black text-red-700 text-sm">
                            Repuesto: <span className="text-red-600">{repairWarrantyPart}</span>
                          </p>
                          <p className="text-[10px] font-bold text-red-400 mt-0.5">Se reabre sin costo. Después marcás pérdida o empate.</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

              ) : (
                /* ═══ FLUJO GARANTÍA DE PRODUCTO (existente) ═══ */
                <>
                  {hasMultipleItems && !warrantyItem && (
                    <div className="space-y-3 mb-6">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">¿Cuál producto trae el cliente?</p>
                      {saleItems.map((item: any, i: number) => (
                        <button key={i}
                          onClick={() => setWarrantyItem({ id: item.id, name: item.name, qty: 1, maxQty: item.quantity || 1 })}
                          className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:border-amber-300 hover:bg-amber-50 transition-all text-left">
                          <div>
                            <p className="font-black text-gray-800 text-sm">{item.name}</p>
                            <p className="text-[10px] font-bold text-gray-400">×{item.quantity || 1} unidades · Gs. {toNum(item.price).toLocaleString()} c/u</p>
                          </div>
                          <ChevronRight size={16} className="text-gray-300" />
                        </button>
                      ))}
                    </div>
                  )}
                  {(!hasMultipleItems || warrantyItem) && (() => {
                    if (!warrantyItem && saleItems.length === 1) {
                      setTimeout(() => setWarrantyItem({ id: saleItems[0].id, name: saleItems[0].name, qty: 1, maxQty: saleItems[0].quantity || 1 }), 0);
                    }
                    const item = warrantyItem || (saleItems.length === 1 ? { id: saleItems[0].id, name: saleItems[0].name, qty: 1, maxQty: saleItems[0].quantity || 1 } : null);
                    if (!item) return null;
                    return (
                      <div className="mb-6 space-y-4">
                        {warrantyItem && hasMultipleItems && (
                          <button onClick={() => setWarrantyItem(null)} className="text-[10px] font-black text-indigo-500 hover:text-indigo-700">← Cambiar producto</button>
                        )}
                        <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
                          <p className="font-black text-gray-800">{item.name}</p>
                          <p className="text-[10px] font-bold text-gray-400 mt-0.5">Máximo: {item.maxQty} unidad{item.maxQty !== 1 ? 'es' : ''}</p>
                        </div>
                        {item.maxQty > 1 && (
                          <div className="space-y-2">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">¿Cuántas unidades trae?</p>
                            <div className="flex items-center gap-3">
                              <button onClick={() => setWarrantyItem(w => w ? { ...w, qty: Math.max(1, w.qty - 1) } : w)} className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center font-black hover:bg-gray-200">−</button>
                              <span className="text-3xl font-black text-gray-800 w-12 text-center">{item.qty}</span>
                              <button onClick={() => setWarrantyItem(w => w ? { ...w, qty: Math.min(w.maxQty, w.qty + 1) } : w)} className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600 font-black hover:bg-amber-200">+</button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  <p className="text-[10px] font-bold text-gray-400 mb-4">
                    Después decidís si es <span className="font-black text-amber-600">empate</span> (fabricante repone) o <span className="font-black text-red-600">pérdida</span>.
                  </p>
                </>
              )}

              {/* Botones */}
              <div className="flex gap-3">
                <button
                  onClick={() => { setWarrantyModal(null); setWarrantyItem(null); setRepairWarrantyFlow(null); setRepairWarrantyPart(''); }}
                  className="flex-1 py-3 rounded-2xl border-2 border-gray-100 font-black text-gray-500 hover:bg-gray-50">
                  Cancelar
                </button>
                {isRepairWarranty ? (
                  <button
                    onClick={handleApplyRepairWarranty}
                    disabled={applyingWarranty || !repairWarrantyFlow || (repairWarrantyFlow === 'part' && !repairWarrantyPart)}
                    className="flex-1 py-3 rounded-2xl bg-red-600 text-white font-black hover:bg-red-700 disabled:opacity-50 transition-all">
                    {applyingWarranty ? 'Creando…'
                      : !repairWarrantyFlow ? 'Elegí una opción'
                      : repairWarrantyFlow === 'labor' ? 'Confirmar — Reabrir gratis'
                      : repairWarrantyPart ? 'Confirmar — Garantía repuesto'
                      : 'Seleccioná el repuesto'}
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      if (hasMultipleItems && !warrantyItem) return;
                      if (!warrantyItem && saleItems.length === 1) {
                        setWarrantyItem({ id: saleItems[0].id, name: saleItems[0].name, qty: 1, maxQty: saleItems[0].quantity || 1 });
                      }
                      handleApplyWarranty(warrantyModal._id, 'defective');
                    }}
                    disabled={applyingWarranty || (hasMultipleItems && !warrantyItem)}
                    className="flex-1 py-3 rounded-2xl bg-amber-500 text-white font-black hover:bg-amber-600 disabled:opacity-50">
                    {applyingWarranty ? 'Procesando...' : 'Marcar defectuoso'}
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        );
      })()}

      {/* ── Modal registrar retiro ── */}
      {addingWithdrawal && (
        <Modal title="Registrar Retiro de Caja" onClose={() => { setAddingWithdrawal(false); setNewWithdrawal({ amount: '', motiveId: '', note: '' }); }}>
          <form onSubmit={handleAddWithdrawal} className="space-y-5">

            {/* Monto */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Monto Retirado (Gs.)</label>
              <NumericInput
                required
                autoFocus
                placeholder="0"
                value={newWithdrawal.amount}
                onChange={raw => setNewWithdrawal(w => ({ ...w, amount: raw }))}
                className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl outline-none font-black text-3xl text-indigo-600 transition-all tracking-tighter"
              />
              {newWithdrawal.amount && (
                <p className="text-[10px] font-bold text-indigo-500 ml-1">
                  Gs. {(parseInt(newWithdrawal.amount) || 0).toLocaleString()}
                </p>
              )}
            </div>

            {/* Destino */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">¿A dónde va el dinero?</label>
              {withdrawalMotives.length === 0 ? (
                <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl">
                  <p className="text-[10px] font-bold text-amber-600">
                    Sin destinos configurados. Andá a <strong>Gastos → Destinos Retiro</strong> para crear el primero.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {withdrawalMotives.map(m => (
                    <button
                      key={m._id}
                      type="button"
                      onClick={() => setNewWithdrawal(w => ({ ...w, motiveId: m._id }))}
                      className={cn(
                        "flex items-center gap-3 p-4 rounded-2xl border-2 text-left transition-all font-bold",
                        newWithdrawal.motiveId === m._id
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-200"
                          : "bg-gray-50 text-gray-700 border-transparent hover:border-indigo-200 hover:bg-indigo-50"
                      )}>
                      <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0",
                        newWithdrawal.motiveId === m._id ? "bg-white/20" : "bg-indigo-100")}>
                        <Banknote size={16} className={newWithdrawal.motiveId === m._id ? "text-white" : "text-indigo-500"} />
                      </div>
                      {m.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Nota opcional */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nota (opcional)</label>
              <input
                type="text"
                placeholder="Ej: Para pago de alquiler…"
                value={newWithdrawal.note}
                onChange={e => setNewWithdrawal(w => ({ ...w, note: e.target.value }))}
                className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl outline-none font-bold transition-all"
              />
            </div>

            <div className="flex gap-3 pt-1">
              <button type="button"
                onClick={() => { setAddingWithdrawal(false); setNewWithdrawal({ amount: '', motiveId: '', note: '' }); }}
                className="flex-1 py-4 rounded-2xl border-2 border-gray-100 font-black text-gray-500 hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              <button type="submit"
                disabled={savingWithdrawal || !newWithdrawal.amount || !newWithdrawal.motiveId}
                className="flex-1 py-4 rounded-2xl bg-indigo-600 text-white font-black shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
                <ArrowDownLeft size={16} />
                {savingWithdrawal ? 'Guardando…' : 'Registrar Retiro'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Modal Exportar Excel ── */}
      {exportModal && (
        <Modal title="Exportar a Excel" onClose={() => setExportModal(false)}>
          <div className="space-y-6">

            {/* Selector de período */}
            <div className="space-y-3">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Período a exportar</p>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { key: 'today', label: '📅 Hoy' },
                  { key: 'week',  label: '📆 Esta semana' },
                  { key: 'month', label: '🗓️ Este mes' },
                  { key: 'custom', label: '✏️ Personalizado' },
                ] as { key: ExportPeriod; label: string }[]).map(opt => (
                  <button key={opt.key} type="button"
                    onClick={() => setExportPeriod(opt.key)}
                    className={cn(
                      "py-3 px-4 rounded-2xl font-black text-sm transition-all border-2",
                      exportPeriod === opt.key
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-200"
                        : "bg-gray-50 text-gray-600 border-transparent hover:border-emerald-200 hover:bg-emerald-50"
                    )}>
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Rango personalizado */}
              {exportPeriod === 'custom' && (
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Desde</label>
                    <input type="date" value={exportFrom}
                      onChange={e => setExportFrom(e.target.value)}
                      className="w-full p-3 bg-gray-50 border-2 border-transparent focus:border-emerald-500 focus:bg-white rounded-2xl outline-none font-bold text-sm transition-all" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Hasta</label>
                    <input type="date" value={exportTo}
                      onChange={e => setExportTo(e.target.value)}
                      className="w-full p-3 bg-gray-50 border-2 border-transparent focus:border-emerald-500 focus:bg-white rounded-2xl outline-none font-bold text-sm transition-all" />
                  </div>
                </div>
              )}
            </div>

            {/* Qué incluye */}
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 space-y-2.5">
              <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">El archivo incluye</p>
              {[
                { icon: '📊', text: 'Ventas detalladas (por ítem, precio, costo, ganancia)' },
                { icon: '🏷️', text: 'Indicador de reclamo de garantía por venta' },
                { icon: '💳', text: 'Desglose por método de pago' },
                { icon: '📅', text: 'Resumen de ingresos y ganancias por día' },
                { icon: '💸', text: 'Retiros de caja registrados' },
                { icon: '📋', text: 'Gastos fijos del período' },
                { icon: '📈', text: 'Resumen general con utilidad neta estimada' },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span className="text-base leading-none mt-0.5">{item.icon}</span>
                  <p className="text-xs font-bold text-gray-600">{item.text}</p>
                </div>
              ))}
            </div>

            {/* Error de exportación */}
            {exportError && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 rounded-2xl px-4 py-3">
                <AlertCircle size={16} className="shrink-0" />
                <p className="text-xs font-bold">Error al exportar. Verificá la conexión e intentá de nuevo.</p>
              </div>
            )}

            {/* Botones */}
            <div className="flex gap-3 pt-1">
              <button type="button"
                onClick={() => { setExportModal(false); setExportError(false); }}
                className="flex-1 py-4 rounded-2xl border-2 border-gray-100 font-black text-gray-500 hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              <button type="button"
                onClick={() => { setExportError(false); handleExport(); }}
                disabled={exportLoading || (exportPeriod === 'custom' && (!exportFrom || !exportTo))}
                className="flex-1 py-4 rounded-2xl bg-emerald-600 text-white font-black shadow-xl shadow-emerald-200 hover:bg-emerald-700 transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
                {exportLoading
                  ? <><Loader2 size={18} className="animate-spin" /> Generando…</>
                  : <><FileDown size={18} /> Descargar Excel</>
                }
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal agregar gasto */}
      {isAddingCost && (
        <Modal title="Registrar Gasto" onClose={() => setIsAddingCost(false)}>
          <form onSubmit={handleAddCost} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Descripción</label>
              <input required value={newCost.description} onChange={e => setNewCost({ ...newCost, description: e.target.value })}
                className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl outline-none font-bold" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Monto (Gs.)</label>
              <NumericInput required value={newCost.amount}
                onChange={raw => setNewCost({ ...newCost, amount: raw })}
                className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl outline-none font-black text-2xl text-red-500" />
            </div>
            <button type="submit"
              className="w-full bg-indigo-600 text-white font-black py-5 rounded-2xl shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all">
              Guardar Gasto
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
};
