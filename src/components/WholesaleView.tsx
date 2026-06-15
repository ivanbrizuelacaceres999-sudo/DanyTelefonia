import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Plus, Search, Edit2, Trash2, Phone, Building2, Wallet, DollarSign, CheckCircle, Printer, History, X, ShoppingBag, RefreshCw, Sparkles } from 'lucide-react';
import { api } from '../api';
import { Wholesaler, UserProfile } from '../types';
import { Modal } from './ui/Modal';
import { NumericInput as NumInput } from './ui/NumericInput';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { cn } from '../lib/utils';

interface WholesaleViewProps {
  wholesalers: Wholesaler[];
  onRefresh: () => void;
  user?: UserProfile;
}


// ── Imprime el comprobante de pago del mayorista ─────────────
// Abre una ventana nueva con el ticket, igual que CashierView
const printPaymentTicket = (
  wholesaler: { name: string; businessName?: string; contact?: string; debt: number },
  amountPaid: number,
  previousDebt: number,
  collectedBy?: string
) => {
  const newDebt     = Math.max(0, previousDebt - amountPaid);
  const isPaidOff   = newDebt === 0;
  const now         = new Date();
  const dateStr     = now.toLocaleDateString('es-PY');
  const timeStr     = now.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' });

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Comprobante de Pago - ${wholesaler.name}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; width: 320px; padding: 24px; color: #1f2937; }
    @media print { body { width: 100%; } }
  </style>
</head>
<body>
  <div style="text-align:center;border-bottom:2px solid #e5e7eb;padding-bottom:16px;margin-bottom:16px">
    <h1 style="font-size:22px;font-weight:900;letter-spacing:-1px">Dany Telefonía</h1>
    <p style="font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:2px;margin-top:4px">Comprobante de Pago</p>
  </div>

  <div style="display:flex;justify-content:space-between;font-size:10px;color:#9ca3af;margin-bottom:16px">
    <span>Fecha: ${dateStr}</span>
    <span>Hora: ${timeStr}</span>
  </div>

  <div style="margin-bottom:16px;padding:12px;background:#f9fafb;border-radius:12px">
    <p style="font-size:10px;font-weight:900;color:#6b7280;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Mayorista</p>
    <p style="font-size:16px;font-weight:900;color:#111827">${wholesaler.name}</p>
    ${wholesaler.businessName ? `<p style="font-size:12px;color:#6b7280;font-weight:700">${wholesaler.businessName}</p>` : ''}
    ${wholesaler.contact ? `<p style="font-size:11px;color:#9ca3af">${wholesaler.contact}</p>` : ''}
  </div>

  <div style="border-top:2px solid #e5e7eb;padding-top:12px;space-y:8px">
    <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:13px">
      <span style="font-weight:700;color:#6b7280">Deuda anterior</span>
      <span style="font-weight:900;color:#ef4444">Gs. ${previousDebt.toLocaleString()}</span>
    </div>
    <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:13px">
      <span style="font-weight:700;color:#6b7280">Monto abonado</span>
      <span style="font-weight:900;color:#10b981">Gs. ${amountPaid.toLocaleString()}</span>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;padding-top:12px;border-top:2px dashed #e5e7eb">
      <span style="font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:1px">Deuda restante</span>
      <span style="font-size:24px;font-weight:900;color:${isPaidOff ? '#10b981' : '#ef4444'}">Gs. ${newDebt.toLocaleString()}</span>
    </div>
    ${isPaidOff ? `
    <div style="margin-top:12px;padding:10px;background:#f0fdf4;border-radius:10px;text-align:center">
      <p style="font-size:12px;font-weight:900;color:#16a34a">✓ DEUDA SALDADA COMPLETAMENTE</p>
    </div>` : ''}
    ${collectedBy ? `
    <div style="margin-top:12px;padding:10px;background:#eff6ff;border-radius:10px;display:flex;justify-content:space-between;align-items:center">
      <p style="font-size:10px;font-weight:900;color:#93c5fd;text-transform:uppercase;letter-spacing:1px">Cobrado por</p>
      <p style="font-size:12px;font-weight:900;color:#1d4ed8">👤 ${collectedBy}</p>
    </div>` : ''}
  </div>

  <div style="margin-top:20px;padding-top:16px;border-top:2px dashed #e5e7eb;text-align:center">
    <p style="font-size:10px;color:#9ca3af;font-style:italic">Conserve este comprobante como respaldo del pago realizado.</p>
    <div style="margin-top:24px;border-top:1px solid #e5e7eb;padding-top:12px">
      <p style="font-size:10px;font-weight:900;color:#d1d5db;text-transform:uppercase;letter-spacing:1px">Firma / Sello</p>
      <div style="height:36px;margin-top:8px"></div>
    </div>
  </div>

  <script>window.onload=function(){window.print();window.onafterprint=function(){window.close();};};</script>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=400,height=600');
  if (win) { win.document.write(html); win.document.close(); }
};



export const WholesaleView = ({ wholesalers, onRefresh, user }: WholesaleViewProps) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingWholesaler, setEditingWholesaler] = useState<Wholesaler | null>(null);
  const [payingWholesaler, setPayingWholesaler] = useState<Wholesaler | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [historyWholesaler, setHistoryWholesaler] = useState<Wholesaler | null>(null);
  const [historyTab, setHistoryTab] = useState<'compras' | 'pagos'>('compras');
  const [wholesalerSales, setWholesalerSales] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [newWholesaler, setNewWholesaler] = useState({ code: '', name: '', businessName: '', contact: '', debt: '' });
  const [pendingConfirm, setPendingConfirm] = useState<{ message: string; onConfirm: () => void } | null>(null);

  const filteredWholesalers = wholesalers.filter(w => {
    const q = searchTerm.toLowerCase();
    return (
      w.name.toLowerCase().includes(q) ||
      w.businessName?.toLowerCase().includes(q) ||
      w.code?.toLowerCase().includes(q)
    );
  });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createWholesaler({ ...newWholesaler, code: newWholesaler.code.trim().toUpperCase() || null, debt: parseInt(newWholesaler.debt) || 0 });
      setIsAdding(false);
      setNewWholesaler({ code: '', name: '', businessName: '', contact: '', debt: '' });
      onRefresh();
    } catch (err: any) {
      alert('Error al guardar el mayorista: ' + (err?.message ?? 'Error desconocido'));
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWholesaler) return;
    try {
      await api.updateWholesaler(editingWholesaler._id, editingWholesaler);
      setEditingWholesaler(null);
      onRefresh();
    } catch (err: any) {
      alert('Error al actualizar el mayorista: ' + (err?.message ?? 'Error desconocido'));
    }
  };

  const handleDelete = (id: string) => {
    setPendingConfirm({
      message: '¿Eliminar este mayorista? Se perderán sus datos y deuda registrada.',
      onConfirm: async () => { await api.deleteWholesaler(id); onRefresh(); },
    });
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingWholesaler) return;
    const amount       = parseInt(paymentAmount) || 0;
    const previousDebt = payingWholesaler.debt;
    const collectedBy  = user?.name;
    await (api as any).payWholesaler(payingWholesaler._id, amount, paymentNote, collectedBy);
    printPaymentTicket(payingWholesaler, amount, previousDebt, collectedBy);
    setPayingWholesaler(null);
    setPaymentAmount('');
    setPaymentNote('');
    onRefresh();
  };

  const totalDebt = wholesalers.reduce((a, w) => a + w.debt, 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black text-gray-800 tracking-tighter">Mayoristas</h2>
          <p className="text-gray-400 font-bold tracking-widest uppercase text-[10px] mt-1">Clientes Especiales · Cuentas Corrientes</p>
        </div>
        <button onClick={() => setIsAdding(true)}
          className="bg-indigo-600 text-white font-black px-8 py-3 rounded-2xl hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 flex items-center gap-2 group">
          <Plus size={20} className="group-hover:rotate-90 transition-transform duration-500" />
          Nuevo Mayorista
        </button>
      </div>

      {/* Total debt banner */}
      {totalDebt > 0 && (
        <div className="bg-red-50 border border-red-100 rounded-3xl p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-2xl flex items-center justify-center text-red-600">
              <Wallet size={20} />
            </div>
            <div>
              <p className="text-[10px] font-black text-red-400 uppercase tracking-widest">Deuda Total Pendiente</p>
              <p className="text-2xl font-black text-red-600 tracking-tighter">Gs. {totalDebt.toLocaleString()}</p>
            </div>
          </div>
          <p className="text-[10px] font-bold text-red-400">{wholesalers.filter(w => w.debt > 0).length} mayoristas con deuda</p>
        </div>
      )}

      <div className="relative group">
        <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-600 transition-colors" size={22} />
        <input type="text" placeholder="Buscar por nombre, local o código..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
          className="w-full bg-white border border-gray-100 rounded-[30px] py-6 pl-16 pr-8 outline-none shadow-sm focus:shadow-xl focus:border-indigo-100 transition-all font-bold text-gray-700" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredWholesalers.map(w => (
          <motion.div layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            key={w._id} className="bg-white p-7 rounded-[35px] shadow-sm border border-gray-100 hover:shadow-2xl transition-all group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full -mr-16 -mt-16 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative">
              <div className="flex justify-between items-start mb-5">
                <div className="w-13 h-13 w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-inner">
                  <Building2 size={24} />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setEditingWholesaler(w)} className="p-2.5 bg-gray-50 text-gray-400 hover:bg-indigo-50 hover:text-indigo-600 rounded-xl transition-all"><Edit2 size={16} /></button>
                  <button onClick={() => handleDelete(w._id)} className="p-2.5 bg-gray-50 text-gray-400 hover:bg-red-50 hover:text-red-500 rounded-xl transition-all"><Trash2 size={16} /></button>
                </div>
              </div>

              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h3 className="text-xl font-black text-gray-800 tracking-tight group-hover:text-indigo-600 transition-colors">{w.name}</h3>
                {w.code && (
                  <span className="text-[9px] font-black px-2 py-0.5 bg-gray-800 text-white rounded-lg tracking-widest uppercase">
                    #{w.code}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 mb-5">
                {w.businessName && (
                  <span className="text-[10px] font-black px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full uppercase tracking-widest">{w.businessName}</span>
                )}
                {w.contact && (
                  <span className="text-[10px] font-black px-3 py-1 bg-gray-50 text-gray-400 rounded-full uppercase tracking-widest flex items-center gap-1">
                    <Phone size={9} /> {w.contact}
                  </span>
                )}
              </div>

              <div className={cn("p-5 rounded-3xl border", w.debt > 0 ? "bg-red-50 border-red-100" : "bg-emerald-50 border-emerald-100")}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Deuda Pendiente</p>
                  <Wallet size={15} className={w.debt > 0 ? "text-red-500" : "text-emerald-500"} />
                </div>
                <p className={cn("text-3xl font-black tracking-tighter", w.debt > 0 ? "text-red-600" : "text-emerald-600")}>
                  Gs. {w.debt.toLocaleString()}
                </p>
              </div>

              {w.debt > 0 && (
                <button onClick={() => { setPayingWholesaler(w); setPaymentAmount(''); setPaymentNote(''); }}
                  className="mt-4 w-full py-3 bg-emerald-600 text-white font-black rounded-2xl text-xs uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 flex items-center justify-center gap-2">
                  <DollarSign size={14} /> Registrar Pago
                </button>
              )}
              <button onClick={() => {
                setHistoryWholesaler(w);
                setHistoryTab('compras');
                setWholesalerSales([]);
                setLoadingHistory(true);
                (api as any).getWholesalerSales(w._id).then((s: any[]) => { setWholesalerSales(s); setLoadingHistory(false); });
              }}
                className="mt-2 w-full text-[10px] font-black px-4 py-2 rounded-2xl bg-gray-50 text-gray-500 hover:bg-gray-100 transition-all flex items-center justify-center gap-2 border border-gray-100">
                <History size={13} /> Ver cuenta corriente
              </button>
              {w.debt === 0 && (
                <div className="mt-4 w-full py-3 bg-emerald-50 text-emerald-600 font-black rounded-2xl text-xs uppercase tracking-widest flex items-center justify-center gap-2">
                  <CheckCircle size={14} /> Al Día
                </div>
              )}
            </div>
          </motion.div>
        ))}
        {filteredWholesalers.length === 0 && (
          <div className="col-span-3 text-center py-20 text-gray-300">
            <Building2 size={48} className="mx-auto mb-4" />
            <p className="font-black uppercase tracking-widest">Sin mayoristas registrados</p>
          </div>
        )}
      </div>

      {/* Add modal */}
      {isAdding && (
        <Modal title="Nuevo Mayorista" onClose={() => setIsAdding(false)}>
          <form onSubmit={handleAdd} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Código <span className="font-bold normal-case text-gray-300">(opcional)</span></label>
                <input
                  value={newWholesaler.code}
                  onChange={e => setNewWholesaler({ ...newWholesaler, code: e.target.value })}
                  placeholder="Ej: MAY001, DIST-02…"
                  className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl outline-none font-black tracking-widest uppercase"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Nombre *</label>
                <input required value={newWholesaler.name} onChange={e => setNewWholesaler({ ...newWholesaler, name: e.target.value })}
                  className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl outline-none font-bold" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Local / Negocio</label>
                <input value={newWholesaler.businessName} onChange={e => setNewWholesaler({ ...newWholesaler, businessName: e.target.value })}
                  className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl outline-none font-bold" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Contacto / Teléfono</label>
                <input value={newWholesaler.contact} onChange={e => setNewWholesaler({ ...newWholesaler, contact: e.target.value })}
                  className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl outline-none font-bold" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Deuda Inicial (Gs.)</label>
                <NumInput value={newWholesaler.debt} onChange={(v: string) => setNewWholesaler({ ...newWholesaler, debt: v })}
                  className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl outline-none font-bold" />
              </div>
            </div>
            <button type="submit" className="w-full bg-indigo-600 text-white font-black py-5 rounded-2xl shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all">Guardar Mayorista</button>
          </form>
        </Modal>
      )}

      {/* Edit modal */}
      {editingWholesaler && (
        <Modal title="Editar Mayorista" onClose={() => setEditingWholesaler(null)}>
          <form onSubmit={handleUpdate} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Código <span className="font-bold normal-case text-gray-300">(opcional)</span></label>
                <input
                  value={editingWholesaler.code || ''}
                  onChange={e => setEditingWholesaler({ ...editingWholesaler, code: e.target.value })}
                  placeholder="Ej: MAY001, DIST-02…"
                  className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl outline-none font-black tracking-widest uppercase"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Nombre *</label>
                <input required value={editingWholesaler.name} onChange={e => setEditingWholesaler({ ...editingWholesaler, name: e.target.value })}
                  className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl outline-none font-bold" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Local / Negocio</label>
                <input value={editingWholesaler.businessName || ''} onChange={e => setEditingWholesaler({ ...editingWholesaler, businessName: e.target.value })}
                  className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl outline-none font-bold" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Contacto / Teléfono</label>
                <input value={editingWholesaler.contact || ''} onChange={e => setEditingWholesaler({ ...editingWholesaler, contact: e.target.value })}
                  className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl outline-none font-bold" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Deuda Actual (Gs.)</label>
                <NumInput value={String(editingWholesaler.debt ?? '')} onChange={(v: string) => setEditingWholesaler({ ...editingWholesaler, debt: parseInt(v) || 0 })}
                  className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl outline-none font-bold" />
              </div>
            </div>
            <button type="submit" className="w-full bg-indigo-600 text-white font-black py-5 rounded-2xl shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all">Actualizar Mayorista</button>
          </form>
        </Modal>
      )}

      {/* Payment modal */}
      {payingWholesaler && (
        <Modal title={`Registrar Pago · ${payingWholesaler.name}`} onClose={() => setPayingWholesaler(null)}>
          <form onSubmit={handlePayment} className="space-y-6">
            <div className="p-5 bg-red-50 rounded-3xl border border-red-100 text-center">
              <p className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-1">Deuda Actual</p>
              <p className="text-4xl font-black text-red-600 tracking-tighter">Gs. {payingWholesaler.debt.toLocaleString()}</p>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Monto del Pago (Gs.)</label>
              <NumInput value={paymentAmount} onChange={setPaymentAmount}
                className="w-full p-5 bg-gray-50 border-2 border-transparent focus:border-emerald-600 focus:bg-white rounded-2xl outline-none font-black text-3xl text-emerald-600" />
            </div>
            {paymentAmount && parseInt(paymentAmount) > 0 && (
              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 text-center">
                <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">Deuda Restante</p>
                <p className="text-2xl font-black text-emerald-700">Gs. {Math.max(0, payingWholesaler.debt - (parseInt(paymentAmount) || 0)).toLocaleString()}</p>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nota (opcional)</label>
              <input value={paymentNote} onChange={e => setPaymentNote(e.target.value)}
                placeholder="Ej: Pago parcial, transferencia..."
                className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-emerald-500 focus:bg-white rounded-2xl outline-none font-bold" />
            </div>
            <button type="submit" disabled={!paymentAmount || parseInt(paymentAmount) <= 0}
              className="w-full bg-emerald-600 text-white font-black py-5 rounded-2xl shadow-xl shadow-emerald-200 hover:bg-emerald-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              <Printer size={18} />
              Confirmar e Imprimir
            </button>
          </form>
        </Modal>
      )}

      {/* Modal: Historial de pagos — bottom sheet en móvil, modal centrado en desktop */}
      {historyWholesaler && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={() => setHistoryWholesaler(null)}
          />

          {/* Contenedor: anclado abajo en móvil, centrado en desktop */}
          <div className="fixed inset-x-0 bottom-0 md:inset-0 md:flex md:items-center md:justify-center md:p-4 z-50 pointer-events-none">
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              className="bg-white rounded-t-[32px] md:rounded-[32px] w-full md:max-w-md flex flex-col shadow-2xl overflow-hidden pointer-events-auto"
              style={{ maxHeight: '90vh' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Handle — solo móvil */}
              <div className="flex justify-center pt-3 pb-1 md:hidden flex-shrink-0">
                <div className="w-10 h-1 bg-gray-200 rounded-full" />
              </div>

              {/* Header */}
              <div className="px-6 pt-3 md:pt-6 pb-4 border-b border-gray-100 flex-shrink-0">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">
                      Cuenta Corriente
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-xl font-black text-gray-800 leading-tight">{historyWholesaler.name}</h3>
                      {(historyWholesaler as any).code && (
                        <span className="text-[9px] font-black px-2 py-0.5 bg-gray-800 text-white rounded-lg tracking-widest shrink-0">
                          #{(historyWholesaler as any).code}
                        </span>
                      )}
                    </div>
                    <div className={cn(
                      "inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-full text-xs font-black",
                      historyWholesaler.debt > 0 ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"
                    )}>
                      <Wallet size={11} />
                      Deuda: Gs. {historyWholesaler.debt.toLocaleString()}
                    </div>
                  </div>
                  <button
                    onClick={() => setHistoryWholesaler(null)}
                    className="p-2 text-gray-300 hover:text-gray-600 transition-colors ml-3 flex-shrink-0 mt-1"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Tabs + Recarga */}
              <div className="flex gap-2 px-4 pt-3 pb-2 flex-shrink-0">
                <button onClick={() => setHistoryTab('compras')}
                  className={cn('flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5',
                    historyTab === 'compras' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-gray-100 text-gray-400 hover:bg-gray-200')}>
                  <ShoppingBag size={11} /> Compras
                </button>
                <button onClick={() => setHistoryTab('pagos')}
                  className={cn('flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5',
                    historyTab === 'pagos' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-gray-100 text-gray-400 hover:bg-gray-200')}>
                  <DollarSign size={11} /> Pagos
                </button>
                <button
                  onClick={() => {
                    if (!historyWholesaler) return;
                    setLoadingHistory(true);
                    (api as any).getWholesalerSales(historyWholesaler._id).then((s: any[]) => { setWholesalerSales(s); setLoadingHistory(false); });
                  }}
                  className="p-2 bg-gray-100 text-gray-400 hover:bg-indigo-50 hover:text-indigo-500 rounded-xl transition-all"
                  title="Actualizar">
                  <RefreshCw size={13} className={loadingHistory ? 'animate-spin' : ''} />
                </button>
              </div>

              {/* Contenido según tab */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {historyTab === 'compras' ? (
                  loadingHistory ? (
                    <div className="text-center py-16 text-gray-300">
                      <div className="w-8 h-8 border-2 border-gray-200 border-t-indigo-500 rounded-full animate-spin mx-auto mb-3" />
                      <p className="font-black uppercase tracking-widest text-xs">Cargando...</p>
                    </div>
                  ) : wholesalerSales.length === 0 ? (
                    <div className="text-center py-16 text-gray-300">
                      <ShoppingBag size={40} className="mx-auto mb-3" />
                      <p className="font-black uppercase tracking-widest text-sm">Sin compras registradas</p>
                      <p className="text-[10px] font-bold text-gray-300 mt-1">Las ventas a crédito aparecerán aquí</p>
                    </div>
                  ) : (
                    wholesalerSales.map((sale: any) => {
                      const isPendingSpecial = sale.hasPendingSpecial || (sale.total === 0 && (sale.payments ?? []).some((p: any) => p.method === 'credit'));
                      return (
                      <div key={sale._id} className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                        <div className="flex items-center justify-between px-4 py-3">
                          <div>
                            <p className="text-[11px] font-black text-gray-700">
                              {new Date(sale.date).toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                            </p>
                            <p className="text-[10px] font-bold text-gray-400">
                              {new Date(sale.date).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {isPendingSpecial && (
                              <span className="text-[9px] font-black px-2 py-0.5 rounded-lg bg-pink-50 text-pink-500 flex items-center gap-1">
                                <Sparkles size={9} /> Precio pendiente
                              </span>
                            )}
                            <span className={cn('text-[10px] font-black px-2 py-0.5 rounded-lg uppercase tracking-widest',
                              sale.paymentMethod === 'credit' ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-600')}>
                              {sale.paymentMethod === 'credit' ? 'Crédito' : sale.paymentMethod}
                            </span>
                          </div>
                        </div>
                        {/* Ítems */}
                        <div className="border-t border-gray-50 px-4 py-3 space-y-2">
                          {(sale.items ?? []).map((item: any, i: number) => (
                            <div key={i} className="flex items-center justify-between">
                              <span className="text-xs font-bold text-gray-700 flex-1 leading-tight">
                                {item.name}{item.quantity > 1 ? <span className="text-gray-400"> ×{item.quantity}</span> : ''}
                              </span>
                              {item.price > 0
                                ? <span className="text-xs font-black text-gray-500 ml-3">Gs. {(item.price * (item.quantity ?? 1)).toLocaleString()}</span>
                                : <span className="text-xs font-black text-pink-400 ml-3">✨ Especial</span>
                              }
                            </div>
                          ))}
                        </div>
                        <div className={cn('border-t px-4 py-2.5 flex items-center justify-between',
                          isPendingSpecial ? 'bg-pink-50 border-pink-100' : 'bg-red-50 border-red-100')}>
                          <span className={cn('text-[10px] font-black uppercase tracking-widest',
                            isPendingSpecial ? 'text-pink-400' : 'text-red-400')}>Total</span>
                          {isPendingSpecial
                            ? <span className="text-sm font-black text-pink-500">Precio por asignar</span>
                            : <span className="text-sm font-black text-red-600">Gs. {sale.total.toLocaleString()}</span>
                          }
                        </div>
                      </div>
                      );
                    })
                  )
                ) : (
                  ((historyWholesaler as any).paymentHistory ?? []).length === 0 ? (
                    <div className="text-center py-16 text-gray-300">
                      <History size={40} className="mx-auto mb-3" />
                      <p className="font-black uppercase tracking-widest text-sm">Sin pagos registrados</p>
                      <p className="text-[10px] font-bold text-gray-300 mt-1">Los pagos aparecerán aquí</p>
                    </div>
                  ) : (
                    [...((historyWholesaler as any).paymentHistory ?? [])].reverse().map((p: any, i: number) => (
                      <div key={i} className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                        <div className="flex items-center justify-between p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
                              <DollarSign size={15} className="text-emerald-600" />
                            </div>
                            <div>
                              <p className="text-[11px] font-black text-gray-700">
                                {new Date(p.date).toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                              </p>
                              <p className="text-[10px] font-bold text-gray-400">
                                {new Date(p.date).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>
                          <span className="text-base font-black text-emerald-600">+Gs. {p.amount.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between bg-gray-50 border-t border-gray-100 px-4 py-2.5">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Deuda restante</span>
                          <span className={cn("text-sm font-black", p.remainingDebt > 0 ? "text-red-500" : "text-emerald-600")}>
                            Gs. {p.remainingDebt.toLocaleString()}{p.remainingDebt === 0 && ' ✓'}
                          </span>
                        </div>
                        {p.collectedBy && (
                          <div className="flex items-center justify-between bg-indigo-50 border-t border-indigo-100 px-4 py-2">
                            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Cobrado por</span>
                            <span className="text-[11px] font-black text-indigo-600">👤 {p.collectedBy}</span>
                          </div>
                        )}
                        {p.note && (
                          <div className="px-4 pb-3 pt-2 border-t border-gray-50">
                            <p className="text-[10px] font-bold text-gray-400 italic">"{p.note}"</p>
                          </div>
                        )}
                      </div>
                    ))
                  )
                )}
              </div>

              {/* Footer */}
              <div className="p-4 pb-6 border-t border-gray-100 flex-shrink-0">
                <button
                  onClick={() => setHistoryWholesaler(null)}
                  className="w-full py-4 rounded-2xl bg-indigo-600 text-white font-black shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </motion.div>
          </div>
        </>
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
