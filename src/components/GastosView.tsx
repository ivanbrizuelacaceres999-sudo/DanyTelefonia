import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Wallet, Plus, Trash2, Users, Settings, TrendingDown,
  Zap, Home, Save, AlertCircle, ChevronRight,
  Lightbulb, TrendingUp, RefreshCw, ArrowDownLeft, X
} from 'lucide-react';
import { NumericInput } from './ui/NumericInput';
import { api } from '../api';
import { FixedCost, UserProfile, ExpenseConfig } from '../types';
import { cn } from '../lib/utils';

interface GastosViewProps {
  fixedCosts: FixedCost[];
  users: UserProfile[];
  onRefresh: () => void;
}

const toNum = (v: any) => { const n = Number(v); return isNaN(n) ? 0 : n; };
const fmtGs = (n: number) => `Gs. ${Math.round(n).toLocaleString('es-PY')}`;
const fmtDate = (d: string) => {
  try { return new Date(d).toLocaleDateString('es-PY', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return '—'; }
};

type TabKey = 'gastos' | 'sueldos' | 'config' | 'destinos';

export const GastosView = ({ fixedCosts, users, onRefresh }: GastosViewProps) => {
  const [tab, setTab]                   = useState<TabKey>('gastos');
  const [expenseConfig, setExpenseConfig] = useState<ExpenseConfig>({ operativePercent: 0, fixedPercent: 0, exchangeRate: 6300 });
  const [saving, setSaving]             = useState(false);
  const [savedOk, setSavedOk]           = useState(false);
  const [isAddingCost, setIsAddingCost] = useState(false);
  const [newCost, setNewCost]           = useState({ description: '', amount: '' });
  const [adding, setAdding]             = useState(false);


  // ── Recomendación automática de porcentajes ─────────────────────
  type CfEntry = { month: string; revenue: number; stockCosts: number; costs: number; profit: number };
  const [cashflow,   setCashflow]   = useState<CfEntry[]>([]);
  const [loadingRec, setLoadingRec] = useState(false);
  const [recLoaded,  setRecLoaded]  = useState(false);

  // ── Destinos de retiro ─────────────────────────────────────────
  const [motives,      setMotives]      = useState<{ _id: string; name: string }[]>([]);
  const [newMotive,    setNewMotive]    = useState('');
  const [addingMotive, setAddingMotive] = useState(false);
  const [savingMotive, setSavingMotive] = useState(false);

  const loadMotives = () => {
    (api as any).getWithdrawalMotives().then((m: any) => { if (Array.isArray(m)) setMotives(m); });
  };

  // ── Cargar config + destinos ───────────────────────────────────
  useEffect(() => {
    (api as any).getExpenseConfig().then((c: any) => {
      if (c && !c.error) {
        setExpenseConfig({ operativePercent: c.operativePercent ?? 0, fixedPercent: c.fixedPercent ?? 0, exchangeRate: c.exchangeRate ?? 6300 });
      }
    });
    loadMotives();
  }, []);

  // ── Cargar historial de cashflow al entrar en tab config ────────
  useEffect(() => {
    if (tab !== 'config' || recLoaded) return;
    setLoadingRec(true);
    api.getStats().then((d: any) => {
      if (Array.isArray(d?.monthlyCashflow)) setCashflow(d.monthlyCashflow);
    }).catch(() => {}).finally(() => { setLoadingRec(false); setRecLoaded(true); });
  }, [tab, recLoaded]);

  // ── Datos calculados ───────────────────────────────────────────
  const employees       = users.filter(u => u.role !== 'admin');
  const totalWeeklyWage = employees.reduce((s, u) => s + toNum(u.weeklyWage), 0);
  const totalMonthly    = totalWeeklyWage * 4;

  const now         = new Date();
  const thisMonth   = fixedCosts.filter(c => {
    try {
      const d = new Date(c.date);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    } catch { return false; }
  });
  const fixedMonthTotal = thisMonth.reduce((s, c) => s + toNum(c.amount), 0);
  const totalPercent    = expenseConfig.operativePercent + expenseConfig.fixedPercent;

  // ── Cálculo de recomendaciones ─────────────────────────────────
  const revenueMonths  = cashflow.filter(m => m.revenue > 0);
  const dataCount      = revenueMonths.length;
  const avgRevenue     = dataCount > 0
    ? Math.round(revenueMonths.reduce((s, m) => s + m.revenue, 0) / dataCount) : 0;
  // Operativo: sueldos mensuales ÷ ingreso promedio
  const rawOp          = avgRevenue > 0 && totalMonthly > 0
    ? +(totalMonthly / avgRevenue * 100).toFixed(1) : null;
  const recOperative: number | null = avgRevenue > 0
    ? (rawOp !== null ? Math.min(50, rawOp) : 0) : null;

  // Gasto Fijo: usa TODOS los meses con gastos registrados (sin exigir ventas en el mismo mes).
  // Calcula gasto mensual promedio ÷ ingreso mensual promedio (ratio cruzado).
  // Esto evita que un gasto registrado en un mes sin ventas quede invisible.
  const allCostMonths   = cashflow.filter(m => m.costs > 0);
  const avgMonthlyCost  = allCostMonths.length > 0
    ? allCostMonths.reduce((s, m) => s + m.costs, 0) / allCostMonths.length : 0;
  // Si hay meses con ambos datos, priorizar el ratio directo (más preciso)
  const costMonths      = revenueMonths.filter(m => m.costs > 0);
  const recFixed: number | null =
    costMonths.length > 0
      // Ratio directo: meses donde coinciden ventas y gastos
      ? Math.min(50, +(costMonths.reduce((s, m) => s + m.costs / m.revenue * 100, 0) / costMonths.length).toFixed(1))
      : avgRevenue > 0 && avgMonthlyCost > 0
        // Ratio cruzado: gastos promedio / ingresos promedio (distintos meses)
        ? Math.min(50, +(avgMonthlyCost / avgRevenue * 100).toFixed(1))
        : null;
  // Nivel de confianza
  const confLabel =
    dataCount === 0 ? null :
    dataCount === 1 ? 'Referencial' :
    dataCount <= 2  ? 'Estimada'   :
    dataCount <= 4  ? 'Moderada'   : 'Alta';
  const dotFill = (i: number) =>
    i >= dataCount   ? 'bg-white/25' :
    dataCount <= 2   ? 'bg-amber-300' :
    dataCount <= 4   ? 'bg-white'     : 'bg-emerald-300';

  // ── Guardar configuración ──────────────────────────────────────
  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      await (api as any).updateExpenseConfig(expenseConfig);
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  // ── Agregar gasto fijo ─────────────────────────────────────────
  const handleAddCost = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    try {
      await api.createFixedCost({
        description: newCost.description,
        amount: parseInt(newCost.amount) || 0,
        date: new Date().toISOString(),
      });
      setIsAddingCost(false);
      setNewCost({ description: '', amount: '' });
      setRecLoaded(false); // fuerza que el tab Config recalcule la recomendación
      onRefresh();
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteCost = async (id: string) => {
    await api.deleteFixedCost(id);
    setRecLoaded(false); // idem al eliminar
    onRefresh();
  };

  const handleAddMotive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMotive.trim()) return;
    setSavingMotive(true);
    try {
      await (api as any).createWithdrawalMotive(newMotive.trim());
      setNewMotive('');
      setAddingMotive(false);
      loadMotives();
    } finally { setSavingMotive(false); }
  };

  const handleDeleteMotive = async (id: string) => {
    await (api as any).deleteWithdrawalMotive(id);
    loadMotives();
  };

  const TABS: { id: TabKey; label: string; icon: any }[] = [
    { id: 'gastos',   label: 'Gastos Fijos',    icon: Wallet        },
    { id: 'sueldos',  label: 'Empleados',        icon: Users         },
    { id: 'destinos', label: 'Destinos Retiro',  icon: ArrowDownLeft },
    { id: 'config',   label: 'Config. Costos %', icon: Settings      },
  ];

  return (
    <div className="space-y-6 pb-20">

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-4xl font-black text-gray-800 tracking-tighter">Gastos</h2>
          <p className="text-gray-400 font-bold tracking-widest uppercase text-[10px] mt-1">Control de Costos Operativos</p>
        </div>
        {tab === 'gastos' && (
          <button onClick={() => setIsAddingCost(true)}
            className="flex items-center gap-2 bg-red-600 text-white font-black px-5 py-3 rounded-2xl hover:bg-red-700 transition-all shadow-xl shadow-red-200 text-sm">
            <Plus size={16} /> Registrar Gasto
          </button>
        )}
        {tab === 'destinos' && (
          <button onClick={() => setAddingMotive(true)}
            className="flex items-center gap-2 bg-indigo-600 text-white font-black px-5 py-3 rounded-2xl hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 text-sm">
            <Plus size={16} /> Nuevo Destino
          </button>
        )}
      </div>

      {/* ── Tarjetas resumen ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

        <div className="bg-white p-6 rounded-[30px] shadow-sm border border-gray-100">
          <div className="w-10 h-10 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-500 mb-3">
            <Users size={20} />
          </div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Sueldos / Semana</p>
          <p className="text-2xl font-black text-orange-500 tracking-tighter mt-1">{fmtGs(totalWeeklyWage)}</p>
          <p className="text-[9px] font-bold text-gray-300 mt-1">≈ {fmtGs(totalMonthly)} / mes · {employees.length} empleado{employees.length !== 1 ? 's' : ''}</p>
        </div>

        <div className="bg-white p-6 rounded-[30px] shadow-sm border border-gray-100">
          <div className="w-10 h-10 bg-red-50 rounded-2xl flex items-center justify-center text-red-500 mb-3">
            <Wallet size={20} />
          </div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Gastos Fijos Este Mes</p>
          <p className="text-2xl font-black text-red-500 tracking-tighter mt-1">{fmtGs(fixedMonthTotal)}</p>
          <p className="text-[9px] font-bold text-gray-300 mt-1">{thisMonth.length} registro{thisMonth.length !== 1 ? 's' : ''} en {now.toLocaleDateString('es-PY', { month: 'long' })}</p>
        </div>

        <div className="bg-white p-6 rounded-[30px] shadow-sm border border-gray-100">
          <div className="w-10 h-10 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-500 mb-3">
            <TrendingDown size={20} />
          </div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">% Operativo (sueldos)</p>
          <p className="text-2xl font-black text-indigo-500 tracking-tighter mt-1">{expenseConfig.operativePercent}%</p>
          <p className="text-[9px] font-bold text-gray-300 mt-1">de cada venta</p>
        </div>

        <div className="bg-white p-6 rounded-[30px] shadow-sm border border-gray-100">
          <div className="w-10 h-10 bg-violet-50 rounded-2xl flex items-center justify-center text-violet-500 mb-3">
            <Zap size={20} />
          </div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">% Fijo (luz/agua/renta)</p>
          <p className="text-2xl font-black text-violet-500 tracking-tighter mt-1">{expenseConfig.fixedPercent}%</p>
          <p className="text-[9px] font-bold text-gray-300 mt-1">de cada venta · Total: {totalPercent}%</p>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn(
              "flex items-center gap-2 px-5 py-3 rounded-2xl font-black text-sm transition-all",
              tab === t.id
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200"
                : "bg-white text-gray-500 border border-gray-100 hover:bg-gray-50"
            )}>
            <t.icon size={16} />
            {t.label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════
          TAB: GASTOS FIJOS
          ════════════════════════════ */}
      {tab === 'gastos' && (
        <div className="space-y-4">

          {/* Form nuevo gasto */}
          <AnimatePresence>
            {isAddingCost && (
              <motion.div
                initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                className="bg-white p-6 rounded-[30px] border-2 border-indigo-100 shadow-sm">
                <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-5">Nuevo Gasto Fijo</p>
                <form onSubmit={handleAddCost} className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1.5 ml-1">Descripción</label>
                    <input
                      required
                      placeholder="Ej: Luz eléctrica, Agua, Renta del local…"
                      value={newCost.description}
                      onChange={e => setNewCost({ ...newCost, description: e.target.value })}
                      className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl outline-none font-bold transition-all" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1.5 ml-1">Monto (Gs.)</label>
                    <NumericInput
                      required
                      placeholder="0"
                      value={newCost.amount}
                      onChange={raw => setNewCost({ ...newCost, amount: raw })}
                      className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl outline-none font-black text-2xl text-red-500 transition-all" />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={() => setIsAddingCost(false)}
                      className="flex-1 py-4 rounded-2xl border-2 border-gray-100 font-black text-gray-500 hover:bg-gray-50 transition-colors">
                      Cancelar
                    </button>
                    <button type="submit" disabled={adding}
                      className="flex-1 py-4 rounded-2xl bg-indigo-600 text-white font-black shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-colors disabled:opacity-50">
                      {adding ? 'Guardando…' : 'Guardar Gasto'}
                    </button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Lista de gastos fijos */}
          {fixedCosts.length === 0 && totalMonthly === 0 ? (
            <div className="text-center py-20 bg-gray-50 rounded-[30px] text-gray-300">
              <Wallet size={40} className="mx-auto mb-4" />
              <p className="font-black uppercase tracking-widest text-sm">Sin gastos registrados</p>
              <p className="text-[10px] font-bold mt-2">Hacé clic en "Registrar Gasto" para empezar</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Fila automática: sueldos de empleados */}
              {totalMonthly > 0 && (
                <div className="bg-orange-50 border border-orange-100 flex items-center justify-between p-5 rounded-[25px]">
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 bg-orange-100 rounded-2xl flex items-center justify-center text-orange-500 flex-shrink-0">
                      <Users size={18} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-black text-gray-800">Sueldo de empleados total</p>
                        <span className="text-[9px] font-black text-orange-500 bg-orange-100 px-2 py-0.5 rounded-full uppercase tracking-widest">
                          Auto · {employees.length} empl.
                        </span>
                      </div>
                      <p className="text-[10px] font-bold text-gray-400">
                        {fmtGs(totalWeeklyWage)} / sem · calculado mensualmente
                      </p>
                    </div>
                  </div>
                  <p className="font-black text-orange-600 text-lg">-{fmtGs(totalMonthly)}</p>
                </div>
              )}

              {/* Gastos manuales */}
              {[...fixedCosts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(c => (
                <motion.div key={c._id} layout
                  className="bg-white flex items-center justify-between p-5 rounded-[25px] border border-gray-100 hover:shadow-md transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 bg-red-50 rounded-2xl flex items-center justify-center text-red-500 flex-shrink-0">
                      <Wallet size={18} />
                    </div>
                    <div>
                      <p className="font-black text-gray-800">{c.description}</p>
                      <p className="text-[10px] font-bold text-gray-400">{fmtDate(c.date)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <p className="font-black text-red-600 text-lg">-{fmtGs(toNum(c.amount))}</p>
                    <button
                      onClick={() => handleDeleteCost(c._id)}
                      className="p-2 text-gray-300 hover:text-red-500 transition-colors rounded-xl hover:bg-red-50">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </motion.div>
              ))}

              {/* Total general */}
              {(fixedCosts.length > 0 || totalMonthly > 0) && (
                <div className="bg-gray-900 text-white flex items-center justify-between p-6 rounded-[25px]">
                  <div>
                    <p className="text-[10px] font-black text-white/50 uppercase tracking-widest">Total Gastos Fijos del Mes</p>
                    <p className="text-[9px] font-bold text-white/30 mt-0.5">
                      Sueldos + {thisMonth.length} gasto{thisMonth.length !== 1 ? 's' : ''} registrado{thisMonth.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <p className="text-3xl font-black tracking-tighter text-red-400">
                    -{fmtGs(totalMonthly + fixedMonthTotal)}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════
          TAB: SUELDOS EMPLEADOS
          ════════════════════════════ */}
      {tab === 'sueldos' && (
        <div className="space-y-4">
          <div className="bg-indigo-50 border border-indigo-100 rounded-[25px] p-4 flex items-start gap-3">
            <AlertCircle size={16} className="text-indigo-500 mt-0.5 flex-shrink-0" />
            <p className="text-[10px] font-bold text-indigo-600">
              Los sueldos se configuran en la sección <strong>Usuarios</strong>. Acá se muestra el resumen total para el cálculo de costos.
            </p>
          </div>

          {employees.length === 0 ? (
            <div className="text-center py-20 bg-gray-50 rounded-[30px] text-gray-300">
              <Users size={40} className="mx-auto mb-4" />
              <p className="font-black uppercase tracking-widest text-sm">Sin empleados registrados</p>
            </div>
          ) : (
            <div className="space-y-3">
              {employees.map(u => (
                <div key={u._id}
                  className="bg-white flex items-center justify-between p-5 rounded-[25px] border border-gray-100">
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-500 font-black text-sm flex-shrink-0">
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-black text-gray-800">{u.name}</p>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{u.role}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-orange-500">{fmtGs(toNum(u.weeklyWage))}</p>
                    <p className="text-[9px] font-bold text-gray-300">por semana</p>
                  </div>
                </div>
              ))}

              {/* Total */}
              <div className="bg-orange-500 text-white flex items-center justify-between p-6 rounded-[25px] shadow-xl shadow-orange-200">
                <div>
                  <p className="text-[10px] font-black text-white/70 uppercase tracking-widest">Total Sueldos</p>
                  <p className="text-[9px] font-bold text-white/50 mt-0.5">{employees.length} empleado{employees.length !== 1 ? 's' : ''}</p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-black tracking-tighter">{fmtGs(totalWeeklyWage)}</p>
                  <p className="text-[9px] font-bold text-white/60">/ semana · ≈ {fmtGs(totalMonthly)} / mes</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════
          TAB: DESTINOS RETIRO
          ════════════════════════════ */}
      {tab === 'destinos' && (
        <div className="space-y-4">

          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">
            Definí adónde va el dinero cuando se registra un retiro de caja
          </p>

          {/* Form nuevo destino */}
          <AnimatePresence>
            {addingMotive && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                className="bg-white p-6 rounded-[30px] border-2 border-indigo-100 shadow-sm">
                <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-4">Nuevo Destino de Retiro</p>
                <form onSubmit={handleAddMotive} className="space-y-4">
                  <input
                    required autoFocus
                    placeholder="Ej: Pago de alquiler, Compra de mercadería, Gastos personales…"
                    value={newMotive}
                    onChange={e => setNewMotive(e.target.value)}
                    className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl outline-none font-bold transition-all"
                  />
                  <div className="flex gap-3">
                    <button type="button" onClick={() => { setAddingMotive(false); setNewMotive(''); }}
                      className="flex-1 py-4 rounded-2xl border-2 border-gray-100 font-black text-gray-500 hover:bg-gray-50 transition-colors">
                      Cancelar
                    </button>
                    <button type="submit" disabled={savingMotive || !newMotive.trim()}
                      className="flex-1 py-4 rounded-2xl bg-indigo-600 text-white font-black shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-colors disabled:opacity-50">
                      {savingMotive ? 'Guardando…' : 'Guardar Destino'}
                    </button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Lista */}
          {motives.length === 0 ? (
            <div className="text-center py-20 bg-gray-50 rounded-[30px] text-gray-300">
              <ArrowDownLeft size={40} className="mx-auto mb-4" />
              <p className="font-black uppercase tracking-widest text-sm">Sin destinos configurados</p>
              <p className="text-[10px] font-bold mt-2">Hacé clic en "Nuevo Destino" para crear el primero</p>
            </div>
          ) : (
            <div className="space-y-3">
              {motives.map(m => (
                <motion.div key={m._id} layout
                  className="bg-white flex items-center justify-between p-5 rounded-[25px] border border-gray-100 hover:shadow-md transition-all group">
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-500 flex-shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                      <ArrowDownLeft size={18} />
                    </div>
                    <p className="font-black text-gray-800">{m.name}</p>
                  </div>
                  <button onClick={() => handleDeleteMotive(m._id)}
                    className="p-2 text-gray-300 hover:text-red-500 transition-colors rounded-xl hover:bg-red-50">
                    <Trash2 size={16} />
                  </button>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════
          TAB: CONFIGURACIÓN %
          ════════════════════════════ */}
      {tab === 'config' && (
        <div className="space-y-6 max-w-2xl">

          {/* ════════════════════════════════════════
              TARJETA DE RECOMENDACIÓN INTELIGENTE
              ════════════════════════════════════════ */}
          {loadingRec ? (
            <div className="bg-white p-8 rounded-[30px] border border-gray-100 flex items-center justify-center gap-3">
              <div className="w-5 h-5 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
              <span className="text-sm font-bold text-gray-400">Analizando historial de ventas…</span>
            </div>
          ) : (
            <div className="rounded-[30px] overflow-hidden border border-indigo-100 shadow-sm shadow-indigo-100">

              {/* ── Banner superior ── */}
              <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Lightbulb size={18} className="text-white" />
                  </div>
                  <div>
                    <p className="font-black text-white text-sm leading-tight">Recomendación Automática</p>
                    <p className="text-[10px] text-white/70 font-bold mt-0.5">
                      {dataCount === 0
                        ? 'Esperando datos de ventas'
                        : `Basado en ${dataCount} mes${dataCount !== 1 ? 'es' : ''} de historial`}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    {confLabel && (
                      <span className="text-[9px] font-black text-white/90 bg-white/20 px-2.5 py-1 rounded-full uppercase tracking-widest">
                        {confLabel}
                      </span>
                    )}
                    <button
                      title="Actualizar recomendación"
                      onClick={() => setRecLoaded(false)}
                      className="w-7 h-7 bg-white/15 hover:bg-white/30 rounded-lg flex items-center justify-center transition-colors">
                      <RefreshCw size={13} className="text-white" />
                    </button>
                  </div>
                  {/* Dots de confianza (6 = 6 meses) */}
                  <div className="flex gap-1">
                    {Array.from({ length: 6 }, (_, i) => (
                      <div key={i} className={cn('w-2 h-2 rounded-full transition-all', dotFill(i))} />
                    ))}
                  </div>
                </div>
              </div>

              {/* ── Cuerpo ── */}
              <div className="bg-gradient-to-br from-indigo-50/60 via-white to-violet-50/60 p-6 space-y-4">

                {dataCount === 0 ? (
                  /* ── Sin datos todavía ── */
                  <div className="space-y-4">
                    <div className="text-center py-4 space-y-2">
                      <TrendingUp size={32} className="mx-auto text-gray-300" />
                      <p className="font-black text-gray-600 text-sm">Aún sin historial de ventas</p>
                      <p className="text-[10px] font-bold text-gray-400 leading-relaxed max-w-xs mx-auto">
                        Cuando empieces a registrar ventas, la app calculará automáticamente
                        los porcentajes óptimos para cubrir todos tus costos.
                      </p>
                    </div>
                    {(fixedMonthTotal + totalMonthly) > 0 && (
                      <div className="bg-white border border-indigo-100 rounded-2xl p-4 space-y-2">
                        <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">
                          Lo que ya sabemos este mes
                        </p>
                        <div className="space-y-1.5">
                          {totalMonthly > 0 && (
                            <div className="flex justify-between">
                              <span className="text-xs font-bold text-gray-500">Sueldos mensuales</span>
                              <span className="text-xs font-black text-orange-500">{fmtGs(totalMonthly)}</span>
                            </div>
                          )}
                          {fixedMonthTotal > 0 && (
                            <div className="flex justify-between">
                              <span className="text-xs font-bold text-gray-500">Gastos fijos registrados</span>
                              <span className="text-xs font-black text-red-500">{fmtGs(fixedMonthTotal)}</span>
                            </div>
                          )}
                          <div className="flex justify-between pt-1.5 border-t border-gray-100">
                            <span className="text-xs font-black text-gray-700">Total a cubrir / mes</span>
                            <span className="text-xs font-black text-indigo-600">{fmtGs(fixedMonthTotal + totalMonthly)}</span>
                          </div>
                        </div>
                        <p className="text-[9px] font-bold text-gray-400 leading-relaxed">
                          Con el primer mes de ventas, calcularemos qué % de cada venta necesitás reservar para cubrir este monto.
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  /* ── Con datos: mostrar recomendaciones ── */
                  <div className="space-y-3">

                    {/* Ingreso promedio */}
                    <div className="text-center">
                      <span className="text-[10px] font-bold text-gray-400">Ingreso promedio mensual: </span>
                      <span className="text-sm font-black text-gray-700">{fmtGs(avgRevenue)}</span>
                      {dataCount < 3 && (
                        <span className="ml-2 text-[9px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                          Pocos datos — seguirá mejorando
                        </span>
                      )}
                    </div>

                    {/* Fila: Costo Operativo */}
                    <div className="bg-white border border-orange-100 rounded-2xl p-4 flex items-center gap-3">
                      <div className="w-9 h-9 bg-orange-50 rounded-xl flex items-center justify-center text-orange-500 flex-shrink-0">
                        <Users size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-gray-700 text-sm leading-tight">Costo Operativo</p>
                        <p className="text-[10px] font-bold text-gray-400 mt-0.5 truncate">
                          {totalMonthly > 0
                            ? `${fmtGs(totalMonthly)}/mes ÷ ${fmtGs(avgRevenue)} ingresos`
                            : 'Sin empleados — no necesitás reservar nada'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={cn('text-xl font-black', rawOp !== null && rawOp > 50 ? 'text-red-500' : 'text-orange-500')}>
                          {recOperative !== null ? `~${recOperative}%` : '—'}
                        </span>
                        {recOperative !== null && (
                          <button
                            type="button"
                            onClick={() => setExpenseConfig(c => ({ ...c, operativePercent: recOperative }))}
                            className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white font-black text-xs rounded-xl transition-all">
                            Aplicar
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Fila: Gasto Fijo */}
                    <div className="bg-white border border-violet-100 rounded-2xl p-4 flex items-center gap-3">
                      <div className="w-9 h-9 bg-violet-50 rounded-xl flex items-center justify-center text-violet-500 flex-shrink-0">
                        <Home size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-gray-700 text-sm leading-tight">Gasto Fijo</p>
                        <p className="text-[10px] font-bold text-gray-400 mt-0.5 truncate">
                          {costMonths.length > 0
                            ? `${costMonths.length} mes${costMonths.length !== 1 ? 'es' : ''} con gastos y ventas · ratio directo`
                            : allCostMonths.length > 0
                              ? `${fmtGs(Math.round(avgMonthlyCost))}/mes promedio · ratio estimado`
                              : 'Registrá gastos fijos para obtener recomendación'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xl font-black text-violet-500">
                          {recFixed !== null ? `~${recFixed}%` : '—'}
                        </span>
                        {recFixed !== null && (
                          <button
                            type="button"
                            onClick={() => setExpenseConfig(c => ({ ...c, fixedPercent: recFixed }))}
                            className="px-3 py-1.5 bg-violet-500 hover:bg-violet-600 text-white font-black text-xs rounded-xl transition-all">
                            Aplicar
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Advertencia si sueldos superan el 50% */}
                    {rawOp !== null && rawOp > 50 && (
                      <div className="bg-red-50 border border-red-100 rounded-2xl p-3 flex items-start gap-2">
                        <AlertCircle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
                        <p className="text-[10px] font-bold text-red-600 leading-relaxed">
                          Tus sueldos representan el <strong>{rawOp}%</strong> de tus ingresos promedio.
                          Revisá la estructura de costos — el límite del slider es 50%.
                        </p>
                      </div>
                    )}

                    {/* Botón aplicar ambas */}
                    {(recOperative !== null || recFixed !== null) && (
                      <button
                        type="button"
                        onClick={() => setExpenseConfig({
                          operativePercent: recOperative !== null ? recOperative : expenseConfig.operativePercent,
                          fixedPercent:     recFixed     !== null ? recFixed     : expenseConfig.fixedPercent,
                        })}
                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm rounded-2xl transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2">
                        <Lightbulb size={15} />
                        Aplicar ambas recomendaciones
                      </button>
                    )}

                    <p className="text-[9px] font-bold text-gray-400 text-center leading-relaxed">
                      Esto actualiza los sliders · hacé clic en <strong>"Guardar Configuración"</strong> para confirmar
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ════════════════════════════
              CONFIGURACIÓN MANUAL
              ════════════════════════════ */}
          <div className="bg-white p-8 rounded-[30px] shadow-sm border border-gray-100 space-y-8">
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">¿Para qué sirven estos porcentajes?</p>
              <p className="text-sm font-bold text-gray-500 leading-relaxed">
                Cada venta tiene un costo de mercancía (lo que pagaste por el producto). Además, tenés costos operativos
                (sueldos) y gastos fijos (luz, agua, renta) que se distribuyen entre tus ventas.
                Configurá qué porcentaje de cada venta se destina a cubrir esos gastos.
              </p>
            </div>

            {/* Operativo */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-500">
                  <Users size={18} />
                </div>
                <div>
                  <p className="font-black text-gray-800">Costo Operativo — Sueldos</p>
                  <p className="text-[10px] font-bold text-gray-400">Porcentaje de la venta destinado a cubrir sueldos de empleados</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <input
                  type="range" min={0} max={50} step={0.5}
                  value={expenseConfig.operativePercent}
                  onChange={e => setExpenseConfig(c => ({ ...c, operativePercent: parseFloat(e.target.value) }))}
                  className="flex-1 accent-orange-500" />
                <div className="flex items-center gap-1 bg-orange-50 border border-orange-100 rounded-2xl px-3 py-2 w-24">
                  <input
                    type="number" min={0} max={50} step={0.5}
                    value={expenseConfig.operativePercent}
                    onChange={e => setExpenseConfig(c => ({ ...c, operativePercent: Math.min(50, Math.max(0, parseFloat(e.target.value) || 0)) }))}
                    className="w-full text-center font-black text-orange-600 bg-transparent outline-none text-lg" />
                  <span className="font-black text-orange-400">%</span>
                </div>
              </div>
            </div>

            {/* Fijo */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-violet-50 rounded-2xl flex items-center justify-center text-violet-500">
                  <Home size={18} />
                </div>
                <div>
                  <p className="font-black text-gray-800">Gasto Fijo — Luz, Agua, Renta</p>
                  <p className="text-[10px] font-bold text-gray-400">Porcentaje de la venta destinado a cubrir gastos fijos del local</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <input
                  type="range" min={0} max={50} step={0.5}
                  value={expenseConfig.fixedPercent}
                  onChange={e => setExpenseConfig(c => ({ ...c, fixedPercent: parseFloat(e.target.value) }))}
                  className="flex-1 accent-violet-500" />
                <div className="flex items-center gap-1 bg-violet-50 border border-violet-100 rounded-2xl px-3 py-2 w-24">
                  <input
                    type="number" min={0} max={50} step={0.5}
                    value={expenseConfig.fixedPercent}
                    onChange={e => setExpenseConfig(c => ({ ...c, fixedPercent: Math.min(50, Math.max(0, parseFloat(e.target.value) || 0)) }))}
                    className="w-full text-center font-black text-violet-600 bg-transparent outline-none text-lg" />
                  <span className="font-black text-violet-400">%</span>
                </div>
              </div>
            </div>

            {/* Ejemplo en vivo */}
            <div className="bg-gray-50 rounded-2xl p-5 space-y-3 border border-gray-100">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <ChevronRight size={12} /> Ejemplo: venta de Gs. 100.000
              </p>
              {[
                { label: 'Costo stock (producto)', color: 'text-amber-600',  value: '(costo del producto vendido)' },
                { label: `Costo operativo (${expenseConfig.operativePercent}%)`, color: 'text-orange-500', value: fmtGs(100000 * expenseConfig.operativePercent / 100) },
                { label: `Gasto fijo (${expenseConfig.fixedPercent}%)`,          color: 'text-violet-500', value: fmtGs(100000 * expenseConfig.fixedPercent / 100) },
              ].map((r, i) => (
                <div key={i} className="flex justify-between items-center">
                  <span className="text-sm font-bold text-gray-600">{r.label}</span>
                  <span className={cn('font-black text-sm', r.color)}>{r.value}</span>
                </div>
              ))}
              <div className="pt-3 border-t border-gray-200 flex justify-between items-center">
                <span className="font-black text-gray-700">Total asignado a costos</span>
                <span className="font-black text-indigo-600">{fmtGs(100000 * (expenseConfig.operativePercent + expenseConfig.fixedPercent) / 100)} ({totalPercent}%)</span>
              </div>
            </div>

            {/* ── Cotización dólar ── */}
            <div className="p-6 bg-emerald-50 rounded-3xl border border-emerald-100 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-emerald-600 rounded-xl flex items-center justify-center text-white text-xs font-black">$</div>
                <div>
                  <p className="font-black text-gray-800 text-sm">Cotización del Dólar</p>
                  <p className="text-[10px] font-bold text-gray-400">Se usa para mostrar precios de costo en USD en el stock</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">1 USD =</span>
                <div className="flex items-center gap-1 bg-white border-2 border-emerald-200 focus-within:border-emerald-500 rounded-2xl px-4 py-2 flex-1">
                  <input
                    type="number" min={1} step={1}
                    value={expenseConfig.exchangeRate}
                    onChange={e => setExpenseConfig(c => ({ ...c, exchangeRate: parseInt(e.target.value) || 6300 }))}
                    className="w-full text-center font-black text-emerald-700 bg-transparent outline-none text-xl"
                  />
                  <span className="font-black text-emerald-500 text-sm">Gs.</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleSaveConfig}
              disabled={saving}
              className={cn(
                "w-full py-5 rounded-2xl font-black text-white transition-all shadow-xl text-sm flex items-center justify-center gap-2",
                savedOk
                  ? "bg-emerald-500 shadow-emerald-200"
                  : "bg-indigo-600 shadow-indigo-200 hover:bg-indigo-700",
                saving && "opacity-60"
              )}>
              {saving ? 'Guardando…' : savedOk ? '✓ Guardado correctamente' : <><Save size={16} /> Guardar Configuración</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
