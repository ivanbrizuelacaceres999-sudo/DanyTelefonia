import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus, Edit2, Trash2, User, Lock, Shield, UserCheck,
  Wallet, ChevronRight, X, DollarSign, FileText,
  TrendingUp, Clock, CheckCircle, AlertCircle, Minus, Scissors
} from 'lucide-react';
import { api } from '../api';
import { UserProfile } from '../types';
import { Modal } from './ui/Modal';
import { NumericInput } from './ui/NumericInput';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { cn } from '../lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Advance {
  amount: number;
  description: string;
  type?: 'advance' | 'discount';
  date?: string;
}

interface Payment {
  _id: string;
  weekStart: string;
  weekEnd: string;
  grossWage: number;
  advances: Advance[];
  totalAdvances: number;
  netWage: number;
  note: string;
  paidAt: string;
}

interface UsersViewProps {
  users: UserProfile[];
  onRefresh: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat('es-PY', { style: 'currency', currency: 'PYG', maximumFractionDigits: 0 }).format(n);

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('es-PY', { day: '2-digit', month: 'short', year: 'numeric' });

const roleColor = (role: string) =>
  role === 'admin' ? 'bg-purple-100 text-purple-600' :
  role === 'cashier' ? 'bg-blue-100 text-blue-600' :
  'bg-amber-100 text-amber-600';

// ─── Payment History Modal ────────────────────────────────────────────────────
const PaymentsModal = ({ user, onClose }: { user: UserProfile; onClose: () => void }) => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'history' | 'new'>('history');

  // New payment form state
  const [advances,    setAdvances]    = useState<Advance[]>([]);
  const [discounts,   setDiscounts]   = useState<Advance[]>([]);
  const [newAdvance,  setNewAdvance]  = useState({ amount: '', description: '' });
  const [newDiscount, setNewDiscount] = useState({ amount: '', description: '' });
  const [note,        setNote]        = useState('');
  const [submitting,  setSubmitting]  = useState(false);
  const [success,     setSuccess]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getUserPayments((user as any)._id);
      setPayments(data);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const addAdvance = () => {
    const amount = parseFloat(newAdvance.amount);
    if (!amount || !newAdvance.description.trim()) return;
    setAdvances(prev => [...prev, { amount, description: newAdvance.description.trim(), type: 'advance' }]);
    setNewAdvance({ amount: '', description: '' });
  };

  const addDiscount = () => {
    const amount = parseFloat(newDiscount.amount);
    if (!amount || !newDiscount.description.trim()) return;
    setDiscounts(prev => [...prev, { amount, description: newDiscount.description.trim(), type: 'discount' }]);
    setNewDiscount({ amount: '', description: '' });
  };

  const removeAdvance  = (i: number) => setAdvances(prev => prev.filter((_, idx) => idx !== i));
  const removeDiscount = (i: number) => setDiscounts(prev => prev.filter((_, idx) => idx !== i));

  const grossWage      = (user as any).weeklyWage ?? 0;
  const totalAdvances  = advances.reduce((s, a) => s + a.amount, 0);
  const totalDiscounts = discounts.reduce((s, d) => s + d.amount, 0);
  const totalDeductions = totalAdvances + totalDiscounts;
  const netWage = Math.max(grossWage - totalDeductions, 0);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await api.createPayment((user as any)._id, { advances: [...advances, ...discounts], note });
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setAdvances([]);
        setDiscounts([]);
        setNote('');
        setView('history');
        load();
      }, 1500);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (paymentId: string) => {
    await api.deletePayment(paymentId);
    load();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.97 }}
        className="bg-white rounded-[32px] shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center">
                <Wallet size={20} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-200">Pagos semanales</p>
                <p className="text-lg font-black tracking-tight">{user.name}</p>
              </div>
            </div>
            <button onClick={onClose} className="w-9 h-9 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center transition-colors">
              <X size={18} />
            </button>
          </div>

          {/* Sueldo bruto badge */}
          <div className="bg-white/10 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-200">Sueldo semanal</p>
              <p className="text-2xl font-black">{fmt(grossWage)}</p>
            </div>
            <TrendingUp size={32} className="text-white/30" />
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mt-4">
            {(['history', 'new'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setView(tab)}
                className={cn(
                  "flex-1 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all",
                  view === tab ? "bg-white text-indigo-700" : "text-indigo-200 hover:bg-white/10"
                )}
              >
                {tab === 'history' ? '📋 Historial' : '➕ Nuevo Pago'}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            {view === 'history' ? (
              <motion.div key="history" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="p-6 space-y-4">
                {loading ? (
                  <div className="text-center py-12 text-gray-400">
                    <Clock size={32} className="mx-auto mb-2 animate-spin opacity-40" />
                    <p className="text-sm font-bold">Cargando pagos...</p>
                  </div>
                ) : payments.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText size={40} className="mx-auto mb-3 text-gray-200" />
                    <p className="text-gray-400 font-black text-sm">Sin pagos registrados</p>
                    <p className="text-gray-300 text-xs mt-1">El historial aparecerá aquí cada sábado</p>
                  </div>
                ) : (
                  payments.map((p, i) => (
                    <motion.div
                      key={p._id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="bg-gray-50 rounded-2xl p-4 border border-gray-100 relative group"
                    >
                      {/* Date range */}
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500">
                          {fmtDate(p.weekStart)} → {fmtDate(p.weekEnd)}
                        </p>
                        <button
                          onClick={() => handleDelete(p._id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-300 hover:text-red-400"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      {/* Wage breakdown */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-gray-500 font-bold">Sueldo bruto</span>
                          <span className="text-sm font-black text-gray-700">{fmt(p.grossWage)}</span>
                        </div>

                        {/* Adelantos */}
                        {p.advances.filter((a: any) => a.type !== 'discount').length > 0 && (
                          <div className="bg-red-50 rounded-xl p-3 space-y-1">
                            <p className="text-[9px] font-black uppercase tracking-widest text-red-400 mb-2">Adelantos</p>
                            {p.advances.filter((a: any) => a.type !== 'discount').map((a: any, j: number) => (
                              <div key={j} className="flex justify-between items-start">
                                <span className="text-xs text-red-500 font-bold max-w-[60%]">{a.description}</span>
                                <span className="text-xs font-black text-red-500">-{fmt(a.amount)}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Descuentos */}
                        {p.advances.filter((a: any) => a.type === 'discount').length > 0 && (
                          <div className="bg-amber-50 rounded-xl p-3 space-y-1">
                            <p className="text-[9px] font-black uppercase tracking-widest text-amber-500 mb-2">✂️ Descuentos</p>
                            {p.advances.filter((a: any) => a.type === 'discount').map((a: any, j: number) => (
                              <div key={j} className="flex justify-between items-start">
                                <span className="text-xs text-amber-600 font-bold max-w-[60%]">{a.description}</span>
                                <span className="text-xs font-black text-amber-600">-{fmt(a.amount)}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {p.totalAdvances > 0 && (
                          <div className="flex justify-between items-center text-[10px] text-gray-400 font-bold px-1">
                            <span>Total descontado</span>
                            <span className="text-red-400">-{fmt(p.totalAdvances)}</span>
                          </div>
                        )}

                        <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                          <span className="text-xs text-gray-700 font-black">Neto a cobrar</span>
                          <span className="text-base font-black text-emerald-600">{fmt(p.netWage)}</span>
                        </div>
                      </div>

                      {p.note && (
                        <p className="mt-3 text-[10px] text-gray-400 italic bg-white rounded-xl px-3 py-2 border border-gray-100">
                          📝 {p.note}
                        </p>
                      )}

                      <p className="text-[9px] text-gray-300 font-bold mt-2 text-right">
                        Pagado: {fmtDate(p.paidAt)}
                      </p>
                    </motion.div>
                  ))
                )}
              </motion.div>
            ) : (
              <motion.div key="new" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="p-6 space-y-5">
                {success ? (
                  <div className="text-center py-12">
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <CheckCircle size={32} className="text-emerald-500" />
                    </motion.div>
                    <p className="font-black text-gray-700">¡Pago registrado!</p>
                  </div>
                ) : (
                  <>
                    {/* Resumen */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { label: 'Bruto',       value: fmt(grossWage),      color: 'text-gray-700'    },
                        { label: 'Adelantos',   value: `-${fmt(totalAdvances)}`,  color: 'text-red-500'     },
                        { label: 'Descuentos',  value: `-${fmt(totalDiscounts)}`, color: 'text-amber-500'   },
                        { label: 'Neto',        value: fmt(netWage),        color: 'text-emerald-600' },
                      ].map(({ label, value, color }) => (
                        <div key={label} className="bg-gray-50 rounded-2xl p-3 text-center border border-gray-100">
                          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{label}</p>
                          <p className={cn("text-sm font-black mt-1", color)}>{value}</p>
                        </div>
                      ))}
                    </div>

                    {/* Registrar adelanto */}
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Agregar adelanto en efectivo</p>
                      <div className="bg-red-50/60 rounded-2xl p-4 space-y-3 border border-red-100">
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <DollarSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <NumericInput
                              placeholder="Monto"
                              value={newAdvance.amount}
                              onChange={raw => setNewAdvance(p => ({ ...p, amount: raw }))}
                              className="w-full pl-8 pr-3 py-2.5 bg-white border-2 border-transparent focus:border-red-400 rounded-xl outline-none text-sm font-bold transition-all"
                            />
                          </div>
                          <input
                            placeholder="Descripción"
                            value={newAdvance.description}
                            onChange={e => setNewAdvance(p => ({ ...p, description: e.target.value }))}
                            className="flex-[2] px-3 py-2.5 bg-white border-2 border-transparent focus:border-red-400 rounded-xl outline-none text-sm font-bold transition-all"
                          />
                          <button
                            onClick={addAdvance}
                            className="px-3 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors font-black"
                          >
                            +
                          </button>
                        </div>

                        {advances.length > 0 && (
                          <div className="space-y-2 mt-2">
                            {advances.map((a, i) => (
                              <div key={i} className="flex items-center justify-between bg-white rounded-xl px-3 py-2 border border-red-100">
                                <span className="text-xs font-bold text-gray-600">{a.description}</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-black text-red-500">-{fmt(a.amount)}</span>
                                  <button onClick={() => removeAdvance(i)} className="text-gray-300 hover:text-red-400 transition-colors">
                                    <Minus size={14} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Registrar descuento */}
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1 flex items-center gap-1.5">
                        <Scissors size={11} /> Agregar descuento (daño o compra del local)
                      </p>
                      <div className="bg-amber-50/60 rounded-2xl p-4 space-y-3 border border-amber-100">
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <DollarSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <NumericInput
                              placeholder="Monto"
                              value={newDiscount.amount}
                              onChange={raw => setNewDiscount(p => ({ ...p, amount: raw }))}
                              className="w-full pl-8 pr-3 py-2.5 bg-white border-2 border-transparent focus:border-amber-400 rounded-xl outline-none text-sm font-bold transition-all"
                            />
                          </div>
                          <input
                            placeholder="Producto roto o comprado…"
                            value={newDiscount.description}
                            onChange={e => setNewDiscount(p => ({ ...p, description: e.target.value }))}
                            className="flex-[2] px-3 py-2.5 bg-white border-2 border-transparent focus:border-amber-400 rounded-xl outline-none text-sm font-bold transition-all"
                          />
                          <button
                            onClick={addDiscount}
                            className="px-3 bg-amber-500 text-white rounded-xl hover:bg-amber-600 transition-colors font-black"
                          >
                            +
                          </button>
                        </div>

                        {discounts.length > 0 && (
                          <div className="space-y-2 mt-2">
                            {discounts.map((d, i) => (
                              <div key={i} className="flex items-center justify-between bg-white rounded-xl px-3 py-2 border border-amber-100">
                                <span className="text-xs font-bold text-gray-600">{d.description}</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-black text-amber-600">-{fmt(d.amount)}</span>
                                  <button onClick={() => removeDiscount(i)} className="text-gray-300 hover:text-amber-500 transition-colors">
                                    <Minus size={14} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Nota */}
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Nota del pago (opcional)</p>
                      <textarea
                        placeholder="Ej: Semana completa, llegó tarde el martes..."
                        value={note}
                        onChange={e => setNote(e.target.value)}
                        rows={2}
                        className="w-full px-4 py-3 bg-gray-50 border-2 border-transparent focus:border-indigo-400 focus:bg-white rounded-2xl outline-none text-sm font-bold transition-all resize-none"
                      />
                    </div>

                    {/* Warning si los descuentos superan el sueldo */}
                    {totalDeductions > grossWage && (
                      <div className="flex items-center gap-2 bg-red-50 text-red-600 rounded-2xl px-4 py-3">
                        <AlertCircle size={16} />
                        <p className="text-xs font-black">Los adelantos y descuentos superan el sueldo semanal</p>
                      </div>
                    )}

                    <button
                      onClick={handleSubmit}
                      disabled={submitting || grossWage === 0}
                      className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      {submitting ? 'Registrando...' : `Registrar pago — ${fmt(netWage)}`}
                    </button>

                    {grossWage === 0 && (
                      <p className="text-center text-xs text-gray-400 font-bold">
                        ⚠️ Primero asigná un sueldo semanal al empleado
                      </p>
                    )}
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};

// ─── Wage Edit Modal ──────────────────────────────────────────────────────────
const WageModal = ({ user, onClose, onSaved }: { user: UserProfile; onClose: () => void; onSaved: () => void }) => {
  const [wage, setWage] = useState(String((user as any).weeklyWage ?? ''));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateUserWage((user as any)._id, parseFloat(wage));
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Sueldo Semanal" onClose={onClose}>
      <div className="space-y-6">
        <div className="p-5 bg-indigo-50 rounded-2xl border border-indigo-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600">
            <User size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Empleado</p>
            <p className="text-xl font-black text-gray-800 tracking-tight">{user.name}</p>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Sueldo semanal</label>
          <div className="relative group">
            <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-600 transition-colors" size={20} />
            <NumericInput
              required
              value={wage}
              onChange={raw => setWage(raw)}
              placeholder="0"
              className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl outline-none transition-all font-black text-lg pl-12"
            />
          </div>
          <p className="text-[10px] text-gray-400 ml-4">Se cobra cada sábado. Podés actualizarlo cuando suba el sueldo.</p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving || !wage || parseFloat(wage) < 0}
          className="w-full bg-indigo-600 text-white font-black py-5 rounded-2xl shadow-xl shadow-indigo-200 hover:bg-indigo-700 disabled:opacity-50 transition-all"
        >
          {saving ? 'Guardando...' : 'Guardar Sueldo'}
        </button>
      </div>
    </Modal>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
export const UsersView = ({ users, onRefresh }: UsersViewProps) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [wageUser, setWageUser] = useState<UserProfile | null>(null);
  const [paymentsUser, setPaymentsUser] = useState<UserProfile | null>(null);
  const [newUser, setNewUser] = useState({ name: '', password: '', role: 'cashier' as const, weeklyWage: '' });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = { name: newUser.name, password: newUser.password, role: newUser.role };
    if (newUser.role !== 'admin' && newUser.weeklyWage) payload.weeklyWage = parseFloat(newUser.weeklyWage);
    await api.createUser(payload);
    setIsAdding(false);
    setNewUser({ name: '', password: '', role: 'cashier', weeklyWage: '' });
    onRefresh();
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUser) {
      await api.updateUser((editingUser as any)._id, editingUser);
      setEditingUser(null);
      onRefresh();
    }
  };

  const handleDelete = (id: string) => {
    setPendingConfirm({
      message: '¿Eliminar este usuario? Se perderán sus datos y historial de pagos.',
      onConfirm: async () => { await api.deleteUser(id); onRefresh(); },
    });
  };

  const nonAdminUsers = users.filter(u => u.role !== 'admin');
  const adminUsers = users.filter(u => u.role === 'admin');

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black text-gray-800 tracking-tighter">Usuarios</h2>
          <p className="text-gray-400 font-bold tracking-widest uppercase text-[10px] mt-1">Gestión de Personal</p>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="bg-indigo-600 text-white font-black px-8 py-3 rounded-2xl hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 flex items-center gap-2 group"
        >
          <Plus size={20} className="group-hover:rotate-90 transition-transform duration-500" />
          Nuevo Usuario
        </button>
      </div>

      {/* Empleados con sueldo (no admin) */}
      {nonAdminUsers.length > 0 && (
        <div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 ml-1">Empleados</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {nonAdminUsers.map(u => (
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                key={(u as any)._id}
                className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100 hover:shadow-xl transition-all group relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full -mr-16 -mt-16 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />

                <div className="relative">
                  <div className="flex justify-between items-start mb-5">
                    <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                      <User size={24} />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setEditingUser(u)} className="p-2.5 bg-gray-50 text-gray-400 hover:bg-indigo-50 hover:text-indigo-600 rounded-xl transition-all">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => handleDelete((u as any)._id)} className="p-2.5 bg-gray-50 text-gray-400 hover:bg-red-50 hover:text-red-500 rounded-xl transition-all">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <h3 className="text-xl font-black text-gray-800 mb-2 tracking-tight group-hover:text-indigo-600 transition-colors">{u.name}</h3>
                  <span className={cn("text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest inline-flex items-center gap-1.5 mb-5", roleColor(u.role))}>
                    <UserCheck size={11} /> {u.role}
                  </span>

                  {/* Sueldo */}
                  <div className="bg-gray-50 rounded-2xl p-4 mb-4 border border-gray-100">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Sueldo semanal</p>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-lg font-black text-gray-800">
                        {(u as any).weeklyWage
                          ? fmt((u as any).weeklyWage)
                          : <span className="text-gray-300 text-sm font-bold">Sin asignar</span>
                        }
                      </p>
                      <button
                        onClick={() => setWageUser(u)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-indigo-200 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-xl text-[11px] font-black transition-all shadow-sm shrink-0"
                      >
                        <Edit2 size={13} />
                        Editar sueldo
                      </button>
                    </div>
                  </div>

                  {/* Ver pagos button */}
                  <button
                    onClick={() => setPaymentsUser(u)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white rounded-2xl transition-all group/btn font-black text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <Wallet size={16} />
                      <span>Ver Pagos</span>
                    </div>
                    <ChevronRight size={16} className="group-hover/btn:translate-x-1 transition-transform" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Admins */}
      {adminUsers.length > 0 && (
        <div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 ml-1">Administradores</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {adminUsers.map(u => (
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                key={(u as any)._id}
                className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100 hover:shadow-xl transition-all group relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-purple-50 rounded-full -mr-16 -mt-16 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative">
                  <div className="flex justify-between items-start mb-5">
                    <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-400 group-hover:bg-purple-600 group-hover:text-white transition-all">
                      <Shield size={22} />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setEditingUser(u)} className="p-2.5 bg-gray-50 text-gray-400 hover:bg-indigo-50 hover:text-indigo-600 rounded-xl transition-all">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => handleDelete((u as any)._id)} className="p-2.5 bg-gray-50 text-gray-400 hover:bg-red-50 hover:text-red-500 rounded-xl transition-all">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <h3 className="text-xl font-black text-gray-800 mb-2 tracking-tight">{u.name}</h3>
                  <span className="text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest inline-flex items-center gap-1.5 bg-purple-100 text-purple-600">
                    <Shield size={11} /> admin
                  </span>
                  <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">ID: {(u as any)._id.slice(-6).toUpperCase()}</p>
                    <div className="w-2 h-2 bg-emerald-500 rounded-full shadow-lg shadow-emerald-200" />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Modal: Nuevo usuario */}
      {isAdding && (
        <Modal title="Nuevo Usuario" onClose={() => setIsAdding(false)}>
          <form onSubmit={handleAdd} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Nombre de Usuario</label>
              <div className="relative group">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-600 transition-colors" size={20} />
                <input required value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })} className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl outline-none transition-all font-bold pl-12" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Contraseña</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-600 transition-colors" size={20} />
                <input type="password" required value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl outline-none transition-all font-bold pl-12" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Rol</label>
              <select required value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value as any })} className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl outline-none transition-all font-bold">
                <option value="admin">Administrador</option>
                <option value="cashier">Cajero</option>
                <option value="technician">Técnico</option>
              </select>
            </div>
            {newUser.role !== 'admin' && (
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Sueldo Semanal</label>
                <div className="relative group">
                  <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-600 transition-colors" size={20} />
                  <NumericInput
                    placeholder="0"
                    value={newUser.weeklyWage}
                    onChange={raw => setNewUser({ ...newUser, weeklyWage: raw })}
                    className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl outline-none transition-all font-bold pl-12"
                  />
                </div>
                <p className="text-[10px] text-gray-400 ml-4">Se cobra cada sábado. Podés cambiarlo después.</p>
              </div>
            )}
            <button type="submit" className="w-full bg-indigo-600 text-white font-black py-5 rounded-2xl shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all">Crear Usuario</button>
          </form>
        </Modal>
      )}

      {/* Modal: Editar usuario */}
      {editingUser && (
        <Modal title="Editar Usuario" onClose={() => setEditingUser(null)}>
          <form onSubmit={handleUpdate} className="space-y-6">
            <div className="p-6 bg-gray-50 rounded-3xl border border-gray-100 flex items-center gap-4">
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm">
                <User size={24} />
              </div>
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Usuario</p>
                <p className="text-xl font-black text-gray-800 tracking-tight">{editingUser.name}</p>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Rol</label>
              <select required value={editingUser.role} onChange={e => setEditingUser({ ...editingUser, role: e.target.value as any })} className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl outline-none transition-all font-bold">
                <option value="admin">Administrador</option>
                <option value="cashier">Cajero</option>
                <option value="technician">Técnico</option>
              </select>
            </div>
            <button type="submit" className="w-full bg-indigo-600 text-white font-black py-5 rounded-2xl shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all">Actualizar Usuario</button>
          </form>
        </Modal>
      )}

      {/* Modal: Sueldo */}
      {wageUser && <WageModal user={wageUser} onClose={() => setWageUser(null)} onSaved={onRefresh} />}

      {/* Modal: Pagos */}
      <AnimatePresence>
        {paymentsUser && <PaymentsModal user={paymentsUser} onClose={() => setPaymentsUser(null)} />}
      </AnimatePresence>

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