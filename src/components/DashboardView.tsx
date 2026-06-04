import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { TrendingUp, ShoppingBag, Wrench, AlertCircle, DollarSign, CreditCard, Smartphone, Clock, CheckCircle, ShieldAlert, ChevronRight, ShieldCheck } from 'lucide-react';
import { Product, Repair, Sale, CashSession } from '../types';
import { api } from '../api';
import { cn } from '../lib/utils';

interface DashboardViewProps {
  products:   Product[];
  repairs:    Repair[];
  sales:      Sale[];
  onNavigate: (tab: string) => void;
}

export const DashboardView = ({ products, repairs, sales, onNavigate }: DashboardViewProps) => {
  const [session, setSession]               = useState<CashSession | null>(null);
  const [todaySales, setTodaySales]         = useState<Sale[]>([]);
  const [totalWithdrawn, setTotalWithdrawn] = useState(0);
  const [defectiveWarranties, setDefectiveWarranties] = useState<any[]>([]);

  useEffect(() => {
    api.getCurrentSession().then((s: any) => {
      setSession(s);
      if (s?._id) {
        (api as any).getCashWithdrawals(String(s._id)).then((ws: any[]) => {
          if (Array.isArray(ws)) setTotalWithdrawn(ws.reduce((sum, w) => sum + (Number(w.amount) || 0), 0));
        });
      }
    });
    // GarantÃ­as defectuosas en espera de respuesta del fabricante
    api.getWarranties().then((ws: any[]) => {
      setDefectiveWarranties(ws.filter((w: any) => w.status === 'defective'));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    api.getSales({ date: today }).then(setTodaySales);
  }, [sales]);

  const todayRevenue   = todaySales.reduce((a, s) => a + s.total, 0);
  const todayOps       = todaySales.length;
  const pendingRepairs = repairs.filter(r => r.status === 'pending' || r.status === 'in_progress');
  const lowStockProducts = products.filter(p => p.quantity <= 3 && p.quantity > 0);
  const outOfStock       = products.filter(p => p.quantity === 0);
  const cashInBox        = session ? session.initialCash + session.totals.cash - totalWithdrawn : 0;

  const todayStr       = new Date().toDateString();
  const todayDelivered = repairs.filter(r => {
    if (r.status !== 'delivered') return false;
    const end = (r as any).endTime ? new Date((r as any).endTime) : null;
    return end && end.toDateString() === todayStr;
  });

  const delayedRepairs = pendingRepairs.filter(r =>
    Math.floor((Date.now() - new Date(r.createdAt).getTime()) / 86400000) >= 2
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black text-gray-800 tracking-tighter">Dashboard</h2>
          <p className="text-gray-400 font-bold tracking-widest uppercase text-[10px] mt-1">
            Resumen Operativo Â· {new Date().toLocaleDateString('es-PY', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        {session && (
          <div className="flex items-center gap-4 bg-white p-4 rounded-3xl shadow-sm border border-gray-100">
            <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
              <DollarSign size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Efectivo en Caja</p>
              <p className="text-xl font-black text-emerald-600 tracking-tighter">Gs. {cashInBox.toLocaleString()}</p>
              {totalWithdrawn > 0 && (
                <p className="text-[9px] font-bold text-orange-400">âˆ’Gs. {totalWithdrawn.toLocaleString()} retirado</p>
              )}
            </div>
            <div className="h-10 w-px bg-gray-100 mx-2" />
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-[9px] font-bold text-gray-400 uppercase">
                <CreditCard size={10} /> Tarjetas: Gs. {(session.totals.credit_card + session.totals.debit_card).toLocaleString()}
              </div>
              <div className="flex items-center gap-2 text-[9px] font-bold text-gray-400 uppercase">
                <Smartphone size={10} /> QR/Trans: Gs. {(session.totals.qr + session.totals.transfer).toLocaleString()}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* â”€â”€ Banners de alerta rÃ¡pida â”€â”€ */}
      <AnimatePresence>
        {(defectiveWarranties.length > 0 || delayedRepairs.length > 0) && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-3"
          >
            {/* Banner garantÃ­as defectuosas */}
            {defectiveWarranties.length > 0 && (
              <button
                onClick={() => () => { sessionStorage.setItem('openWarrantyTab', 'true'); onNavigate('history'); }}
                className="w-full flex items-center justify-between gap-4 bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-[22px] hover:bg-red-100 hover:shadow-lg hover:shadow-red-100 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-red-100 group-hover:bg-red-200 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors">
                    <ShieldAlert size={18} className="text-red-600" />
                  </div>
                  <div className="text-left">
                    <p className="font-black text-sm">
                      {defectiveWarranties.length} producto{defectiveWarranties.length !== 1 ? 's' : ''} esperando respuesta del fabricante
                    </p>
                    <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest mt-0.5">
                      {defectiveWarranties.map((w: any) => w.productName).slice(0, 3).join(' Â· ')}
                      {defectiveWarranties.length > 3 ? ` Â· +${defectiveWarranties.length - 3} mÃ¡s` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 font-black text-sm flex-shrink-0">
                  Ir a GarantÃ­as <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </button>
            )}

            {/* Banner reparaciones demoradas */}
            {delayedRepairs.length > 0 && (
              <button
                onClick={() => onNavigate('repairs')}
                className="w-full flex items-center justify-between gap-4 bg-amber-50 border border-amber-200 text-amber-700 px-6 py-4 rounded-[22px] hover:bg-amber-100 hover:shadow-lg hover:shadow-amber-100 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-amber-100 group-hover:bg-amber-200 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors">
                    <Clock size={18} className="text-amber-600" />
                  </div>
                  <div className="text-left">
                    <p className="font-black text-sm">
                      {delayedRepairs.length} reparaciÃ³n{delayedRepairs.length !== 1 ? 'es' : ''} con mÃ¡s de 2 dÃ­as sin resoluciÃ³n
                    </p>
                    <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mt-0.5">
                      {delayedRepairs.map((r: any) => r.customerName).slice(0, 3).join(' Â· ')}
                      {delayedRepairs.length > 3 ? ` Â· +${delayedRepairs.length - 3} mÃ¡s` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 font-black text-sm flex-shrink-0">
                  Ver Reparaciones <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* â”€â”€ Stats grid â€” 4 tarjetas clickeables â”€â”€ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

        {/* 1. Ventas del dÃ­a */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}
          className="bg-indigo-600 p-6 rounded-[30px] text-white shadow-xl shadow-indigo-200">
          <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center mb-4">
            <ShoppingBag size={22} />
          </div>
          <p className="text-3xl font-black tracking-tighter">Gs. {todayRevenue.toLocaleString()}</p>
          <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mt-1">Ventas de Hoy</p>
          <p className="text-[9px] text-indigo-300 mt-0.5">{todayOps} operaciÃ³n{todayOps !== 1 ? 'es' : ''}</p>
        </motion.div>

        {/* 2. Reparaciones pendientes â€” CLICKEABLE */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          onClick={() => onNavigate('repairs')}
          className={cn(
            "p-6 rounded-[30px] border shadow-sm cursor-pointer transition-all hover:shadow-xl group",
            pendingRepairs.length > 0 ? "bg-amber-50 border-amber-200 hover:border-amber-400" : "bg-white border-gray-100 hover:border-gray-200"
          )}>
          <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center mb-4 transition-all",
            pendingRepairs.length > 0
              ? "bg-amber-500 text-white group-hover:bg-amber-600"
              : "bg-gray-50 text-gray-400 group-hover:bg-gray-100")}>
            <Wrench size={22} />
          </div>
          <p className="text-3xl font-black text-gray-800 tracking-tighter">{pendingRepairs.length}</p>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Reparaciones Pendientes</p>
          <div className="flex items-center justify-between mt-1">
            {delayedRepairs.length > 0 ? (
              <p className="text-[9px] text-red-500 font-bold">
                âš ï¸ {delayedRepairs.length} demorada{delayedRepairs.length !== 1 ? 's' : ''}
              </p>
            ) : <span />}
            <ChevronRight size={13} className="text-gray-300 group-hover:text-amber-500 group-hover:translate-x-0.5 transition-all" />
          </div>
        </motion.div>

        {/* 3. Reparaciones cobradas hoy */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className={cn("p-6 rounded-[30px] border shadow-sm",
            todayDelivered.length > 0 ? "bg-emerald-50 border-emerald-100" : "bg-white border-gray-100")}>
          <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center mb-4",
            todayDelivered.length > 0 ? "bg-emerald-500 text-white" : "bg-gray-50 text-gray-400")}>
            <CheckCircle size={22} />
          </div>
          <p className="text-3xl font-black text-gray-800 tracking-tighter">{todayDelivered.length}</p>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Reparaciones Cobradas Hoy</p>
        </motion.div>

        {/* 4. GarantÃ­as defectuosas / Stock bajo â€” CLICKEABLE */}
        {defectiveWarranties.length > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            onClick={() => () => { sessionStorage.setItem('openWarrantyTab', 'true'); onNavigate('history'); }}
            className="p-6 rounded-[30px] border bg-red-50 border-red-200 shadow-sm cursor-pointer hover:shadow-xl hover:border-red-400 transition-all group">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center mb-4 bg-red-500 text-white group-hover:bg-red-600 transition-colors">
              <ShieldAlert size={22} />
            </div>
            <p className="text-3xl font-black text-gray-800 tracking-tighter">{defectiveWarranties.length}</p>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">GarantÃ­as Defectuosas</p>
            <div className="flex items-center justify-between mt-1">
              <p className="text-[9px] text-red-500 font-bold">Esperando fabricante</p>
              <ChevronRight size={13} className="text-gray-300 group-hover:text-red-500 group-hover:translate-x-0.5 transition-all" />
            </div>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className={cn("p-6 rounded-[30px] border shadow-sm",
              lowStockProducts.length > 0 ? "bg-red-50 border-red-100" : "bg-white border-gray-100")}>
            <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center mb-4",
              lowStockProducts.length > 0 ? "bg-red-500 text-white" : "bg-gray-50 text-gray-400")}>
              <AlertCircle size={22} />
            </div>
            <p className="text-3xl font-black text-gray-800 tracking-tighter">{lowStockProducts.length}</p>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Stock Bajo (â‰¤3)</p>
            {outOfStock.length > 0 && (
              <p className="text-[9px] text-red-500 font-bold mt-0.5">{outOfStock.length} sin stock</p>
            )}
          </motion.div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* Ventas de hoy */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100">
          <h3 className="text-xl font-black text-gray-800 mb-6 flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600">
              <ShoppingBag size={18} />
            </div>
            Ventas de Hoy ({todaySales.length})
          </h3>
          <div className="space-y-3">
            {todaySales.slice(0, 6).map(sale => (
              <div key={sale._id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-2xl transition-colors">
                <div>
                  <p className="font-bold text-gray-800 text-sm">{sale.customerName || 'Consumidor Final'}</p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    {new Date(sale.date).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })} Â· {sale.paymentMethod}
                    {sale.items?.some((i: any) => i.type === 'repair') && (
                      <span className="ml-2 text-amber-500">ðŸ”§</span>
                    )}
                  </p>
                </div>
                <p className="font-black text-indigo-600">Gs. {sale.total.toLocaleString()}</p>
              </div>
            ))}
            {todaySales.length === 0 && (
              <div className="text-center py-10 text-gray-300">
                <ShoppingBag size={36} className="mx-auto mb-3" />
                <p className="font-black uppercase tracking-widest text-sm">Sin ventas hoy</p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Reparaciones pendientes â€” clickeables */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-black text-gray-800 flex items-center gap-3">
              <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center text-amber-600">
                <Wrench size={18} />
              </div>
              Reparaciones Pendientes
            </h3>
            {pendingRepairs.length > 0 && (
              <button
                onClick={() => onNavigate('repairs')}
                className="flex items-center gap-1 text-[11px] font-black text-indigo-600 hover:text-indigo-800 transition-colors group"
              >
                Ver todas <ChevronRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
              </button>
            )}
          </div>
          <div className="space-y-3">
            {pendingRepairs.slice(0, 6).map(r => {
              const daysAgo = Math.floor((Date.now() - new Date(r.createdAt).getTime()) / 86400000);
              return (
                <button
                  key={r._id}
                  onClick={() => onNavigate('repairs')}
                  className={cn(
                    "w-full flex items-center justify-between p-3 rounded-2xl border transition-all hover:shadow-md text-left group",
                    daysAgo >= 2 ? "bg-red-50 border-red-100 hover:border-red-300" : "border-transparent hover:bg-gray-50 hover:border-gray-100"
                  )}>
                  <div className="flex items-center gap-3">
                    <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center",
                      r.status === 'in_progress' ? "bg-blue-100 text-blue-600" : "bg-amber-100 text-amber-600")}>
                      {r.status === 'in_progress' ? <Clock size={14} /> : <AlertCircle size={14} />}
                    </div>
                    <div>
                      <p className="font-bold text-gray-800 text-sm">{r.deviceModel}</p>
                      <p className="text-[10px] font-bold text-gray-400 uppercase">
                        {r.customerName} Â· {daysAgo === 0 ? 'Hoy' : `${daysAgo}d atrÃ¡s`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {daysAgo >= 2 && (
                      <span className="text-[9px] font-black px-2 py-1 bg-red-100 text-red-600 rounded-full uppercase">Demorado</span>
                    )}
                    <ChevronRight size={14} className="text-gray-200 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </button>
              );
            })}
            {pendingRepairs.length === 0 && (
              <div className="text-center py-10 text-gray-300">
                <CheckCircle size={36} className="mx-auto mb-3" />
                <p className="font-black uppercase tracking-widest text-sm">Todo al dÃ­a</p>
              </div>
            )}
          </div>
        </motion.div>

        {/* â”€â”€ GarantÃ­as defectuosas esperando fabricante â”€â”€ */}
        {defectiveWarranties.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="bg-white p-8 rounded-[40px] shadow-sm border border-red-100 lg:col-span-2"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black text-gray-800 flex items-center gap-3">
                <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center text-red-600">
                  <ShieldAlert size={18} />
                </div>
                GarantÃ­as â€” Esperando Fabricante
                <span className="text-[10px] font-black px-3 py-1 bg-red-100 text-red-600 rounded-full uppercase tracking-widest">
                  {defectiveWarranties.length} pendiente{defectiveWarranties.length !== 1 ? 's' : ''}
                </span>
              </h3>
              <button
                onClick={() => () => { sessionStorage.setItem('openWarrantyTab', 'true'); onNavigate('history'); }}
                className="flex items-center gap-1 text-[11px] font-black text-indigo-600 hover:text-indigo-800 transition-colors group"
              >
                Gestionar <ChevronRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {defectiveWarranties.map((w: any) => (
                <button
                  key={w._id}
                  onClick={() => () => { sessionStorage.setItem('openWarrantyTab', 'true'); onNavigate('history'); }}
                  className="flex items-center gap-4 p-4 bg-red-50 border border-red-100 rounded-[24px] hover:bg-red-100 hover:border-red-300 hover:shadow-lg hover:shadow-red-50 transition-all text-left group"
                >
                  <div className="w-11 h-11 bg-red-100 group-hover:bg-red-200 rounded-2xl flex items-center justify-center flex-shrink-0 transition-colors">
                    <ShieldCheck size={20} className="text-red-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-gray-800 text-sm truncate">{w.productName}</p>
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest truncate">{w.customerName}</p>
                    <p className="text-[10px] font-black text-red-500 mt-0.5 uppercase tracking-widest">ðŸ”´ Defectuoso Â· Esperando respuesta</p>
                  </div>
                  <ChevronRight size={15} className="text-red-300 group-hover:text-red-500 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                </button>
              ))}
            </div>

            {/* CTA prominente */}
            <button
              onClick={() => () => { sessionStorage.setItem('openWarrantyTab', 'true'); onNavigate('history'); }}
              className="mt-5 w-full flex items-center justify-center gap-2 py-3.5 bg-red-600 text-white font-black rounded-2xl hover:bg-red-700 shadow-lg shadow-red-200 transition-all group text-sm"
            >
              <ShieldAlert size={16} />
              Resolver garantÃ­as ahora
              <ChevronRight size={15} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </motion.div>
        )}

        {/* Stock bajo â€” solo si hay productos y no hay garantÃ­as defectuosas ocupando el espacio */}
        {(lowStockProducts.length > 0 || outOfStock.length > 0) && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className={cn(
              "bg-white p-8 rounded-[40px] shadow-sm border border-gray-100",
              defectiveWarranties.length === 0 ? "lg:col-span-2" : ""
            )}>
            <h3 className="text-xl font-black text-gray-800 mb-6 flex items-center gap-3">
              <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center text-red-600">
                <AlertCircle size={18} />
              </div>
              Productos con Poco Stock
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[...outOfStock, ...lowStockProducts].slice(0, 8).map(p => (
                <div key={p._id} className={cn("p-4 rounded-2xl border",
                  p.quantity === 0 ? "bg-red-50 border-red-100" : "bg-amber-50 border-amber-100")}>
                  <p className="font-bold text-gray-800 text-sm truncate">{p.model}</p>
                  <p className={cn("text-2xl font-black tracking-tighter",
                    p.quantity === 0 ? "text-red-600" : "text-amber-600")}>{p.quantity}</p>
                  <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">
                    {p.quantity === 0 ? 'Sin Stock' : 'Bajo Stock'}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};
