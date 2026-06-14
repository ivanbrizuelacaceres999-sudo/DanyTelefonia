import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api } from './api';
import { supabase, toClient } from './lib/supabase';
import {
  requestPermission, initKnownIds, getSettings,
  checkWarranty, checkSales10, checkOldRepairs, checkWithdrawal,
} from './utils/notifications';
import { UserProfile, Category, Manufacturer, Wholesaler, FixedCost, Product, Repair, Sale, ReventaItem, ReventaSupplier } from './types';
import { Sidebar } from './components/Sidebar';
import { LoginScreen } from './components/LoginScreen';
import { DashboardView } from './components/DashboardView';
import { StockView } from './components/StockView';
import { RepairsView } from './components/RepairsView';
import { CashierView } from './components/CashierView';
import { WholesaleView } from './components/WholesaleView';
import { HistoryView } from './components/HistoryView';
import { StatisticsView } from './components/StatisticsView';
import { WarrantyView } from './components/WarrantyView';
import { UsersView } from './components/UsersView';
import { GastosView } from './components/GastosView';
import { ConfiguracionesView } from './components/ConfiguracionesView';
import { ReventasView } from './components/ReventasView';
import { motion, AnimatePresence } from 'motion/react';
import { socket, connectSocket, disconnectSocket, UpdateEvent } from './socket';
import { useBarcodeScanner, ScanResult } from './hooks/useBarcodeScanner';
import { Package, Wrench, ShieldCheck, AlertCircle, X, Plus, Minus } from 'lucide-react';
import { NumericInput } from './components/ui/NumericInput';

// ── Tipos para los modales del escáner ────────────────────────
interface RestockModal {
  product: Product;
  barcode: string;
}
interface WarrantyModal {
  sale: Sale;
  warrantyInfo: {
    productName: string;
    expiresAt:   string;
    status:      string;
    daysLeft:    number;
    isValid:     boolean;
  }[];
}
interface RepairModal {
  repair: Repair;
}

function App() {
  const [user, setUser]               = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab]     = useState('dashboard');
  const [collapsed, setCollapsed]     = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const notifInitialized              = useRef(false);

  const [products,         setProducts]         = useState<Product[]>([]);
  const [repairs,          setRepairs]          = useState<Repair[]>([]);
  const [sales,            setSales]            = useState<Sale[]>([]);
  const [categories,       setCategories]       = useState<Category[]>([]);
  const [manufacturers,    setManufacturers]    = useState<Manufacturer[]>([]);
  const [wholesalers,      setWholesalers]      = useState<Wholesaler[]>([]);
  const [fixedCosts,       setFixedCosts]       = useState<FixedCost[]>([]);
  const [users,            setUsers]            = useState<UserProfile[]>([]);
  const [reventaItems,     setReventaItems]     = useState<ReventaItem[]>([]);
  const [reventaSuppliers, setReventaSuppliers] = useState<ReventaSupplier[]>([]);
  const [exchangeRate,     setExchangeRate]     = useState<number>(6300);

  // ── Estados de los modales del escáner ───────────────────────
  const [restockModal,  setRestockModal]  = useState<RestockModal | null>(null);
  // Producto para agregar al carrito en caja (Flujo A cuando activeTab === 'cashier')
  const [scanCartProduct, setScanCartProduct] = useState<Product | null>(null);
  // Notificación flotante de stock bajo
  const [lowStockAlert, setLowStockAlert] = useState<string | null>(null);
  const [warrantyModal, setWarrantyModal] = useState<WarrantyModal | null>(null);
  const [repairModal,   setRepairModal]   = useState<RepairModal | null>(null);
  const [scanError,     setScanError]     = useState<string | null>(null);

  // Campos del modal de restock
  const [restockQty,   setRestockQty]   = useState('1');
  const [restockCost,  setRestockCost]  = useState('');
  const [restockSaving, setRestockSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const { data: profile } = await supabase.from('users').select('*').eq('auth_id', session.user.id).single();
        if (profile) setUser(toClient(profile));
      }
      setIsAuthReady(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') { setUser(null); setActiveTab('dashboard'); }
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.user) {
        const { data: profile } = await supabase.from('users').select('*').eq('auth_id', session.user.id).single();
        if (profile) setUser(toClient(profile));
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const fetchData = async () => {
    if (!user) return;
    try {
      const [p, r, s, c, w, fc, u, ri, rs, mfr, expCfg] = await Promise.all([
        api.getProducts(), api.getRepairs(), api.getSales(),
        api.getCategories(), api.getWholesalers(),
        api.getFixedCosts(), api.getUsers(),
        (api as any).getReventaItems(), (api as any).getReventaSuppliers(),
        (api as any).getManufacturers(),
        (api as any).getExpenseConfig(),
      ]);
      const repairs_     = Array.isArray(r)  ? r  : [];
      const sales_       = Array.isArray(s)  ? s  : [];
      const wholesalers_ = Array.isArray(w)  ? w  : [];

      setProducts(Array.isArray(p)   ? p   : []);
      setRepairs(repairs_);
      setSales(sales_);
      setCategories(Array.isArray(c) ? c   : []);
      setWholesalers(wholesalers_);
      setFixedCosts(Array.isArray(fc)? fc  : []);
      setUsers(Array.isArray(u)      ? u   : []);
      setReventaItems(Array.isArray(ri)  ? ri  : []);
      setReventaSuppliers(Array.isArray(rs) ? rs : []);
      setManufacturers(Array.isArray(mfr) ? mfr : []);
      if (expCfg?.exchangeRate) setExchangeRate(expCfg.exchangeRate);

      // ── Notificaciones ─────────────────────────────────────────
      const settings = getSettings();
      // Obtener retiros para check de notificaciones
      const withdrawals_ = await (api as any).getCashWithdrawals().catch(() => []);
      const withdrawalsArr = Array.isArray(withdrawals_) ? withdrawals_ : [];
      // Primera carga: marcar existentes como "ya vistos"
      if (!notifInitialized.current) {
        notifInitialized.current = true;
        initKnownIds(repairs_, withdrawalsArr);
      }
      // Chequear condiciones (los sets internos evitan repetición)
      checkWarranty(repairs_, settings);
      checkSales10(sales_, settings);
      checkOldRepairs(repairs_, settings);
      checkWithdrawal(withdrawalsArr, settings);
    } catch { /* silent */ }
  };

  useEffect(() => {
    if (user) {
      fetchData();
      connectSocket();
      const handleUpdate = ({ event }: { event: UpdateEvent }) => {
        switch (event) {
          case 'products':
            api.getProducts().then(p => {
              const updated = Array.isArray(p) ? p : [];
              setProducts(updated);
              // Detectar productos que llegaron a stock bajo después de una venta
              const justLowStock = updated.filter(prod => prod.quantity === 0);
              if (justLowStock.length > 0) {
                setLowStockAlert(`⚠️ Sin stock: ${justLowStock.slice(0, 2).map(p => p.model).join(', ')}${justLowStock.length > 2 ? ` y ${justLowStock.length - 2} más` : ''}`);
                setTimeout(() => setLowStockAlert(null), 5000);
              }
            });
            break;
          case 'repairs':     api.getRepairs().then(r => setRepairs(Array.isArray(r) ? r : [])); break;
          case 'sales':       api.getSales().then(s => setSales(Array.isArray(s) ? s : [])); break;
          case 'categories':  api.getCategories().then(c => setCategories(Array.isArray(c) ? c : [])); break;
          case 'wholesalers': api.getWholesalers().then(w => setWholesalers(Array.isArray(w) ? w : [])); break;
          case 'fixed-costs': api.getFixedCosts().then(fc => setFixedCosts(Array.isArray(fc) ? fc : [])); break;
          case 'users':             api.getUsers().then(u => setUsers(Array.isArray(u) ? u : [])); break;
          case 'reventa-items':     (api as any).getReventaItems().then((ri: any) => setReventaItems(Array.isArray(ri) ? ri : [])); break;
          case 'reventa-suppliers': (api as any).getReventaSuppliers().then((rs: any) => setReventaSuppliers(Array.isArray(rs) ? rs : [])); break;
          case 'manufacturers':     (api as any).getManufacturers().then((m: any) => setManufacturers(Array.isArray(m) ? m : [])); break;
          default:            fetchData();
        }
      };
      socket.on('data_update', handleUpdate);
      return () => { socket.off('data_update', handleUpdate); disconnectSocket(); };
    }
  }, [user]);

  // ============================================================
  // LÓGICA DEL ESCÁNER DE CÓDIGO DE BARRAS
  // ============================================================
  const handleScan = useCallback(async (result: ScanResult) => {
    if (!user) return;

    // Limpiar error anterior
    setScanError(null);

    try {
      // ── Flujo A: EAN-13/8 → comportamiento según pantalla activa ─
      if (result.type === 'product') {
        const data = await api.getProductByBarcode(result.id);

        if (data.found) {
          if (activeTab === 'cashier') {
            // En caja: agregar al carrito directamente
            setScanCartProduct(data.product);
          } else {
            // En otra pantalla: abrir modal para agregar lote al stock
            setRestockCost(String(data.product.costPrice || ''));
            setRestockQty('1');
            setRestockModal({ product: data.product, barcode: result.id });
          }
        } else {
          // Producto no existe → ir a Stock con el código precargado
          sessionStorage.setItem('newProductBarcode', result.id);
          setActiveTab('stock');
          setScanError(`Producto no encontrado. Creá uno nuevo con el código ${result.id}`);
        }
        return;
      }

      // ── Flujo B: SRV-{code} → abrir reparación ─────────────────
      if (result.type === 'repair') {
        const fullTicket = `SRV-${result.id}`;
        const repair = repairs.find(r =>
          (r as any).ticketId === fullTicket ||
          (r as any).ticketId?.replace('SRV-', '') === result.id
        );
        if (repair) {
          setActiveTab('repairs');
          setRepairModal({ repair });
        } else {
          setScanError(`Reparación #${result.id} no encontrada`);
        }
        return;
      }

      // ── Flujo C: VEN-{id} → ir al historial y abrir la venta ──
      if (result.type === 'sale') {
        const data = await api.checkWarranty(result.id);
        if (data.sale) {
          // Guardar el ID de la venta para que HistoryView la abra
          sessionStorage.setItem('openSaleId', data.sale._id);
          setActiveTab('history');
          setScanError(null);
        } else {
          setScanError(`Venta no encontrada`);
        }
        return;
      }

      setScanError(`Código desconocido: ${result.raw}`);
    } catch {
      setScanError('Error al procesar el código. ¿El servidor está corriendo?');
    }
  }, [user, repairs]);

  // Activar el hook — solo cuando hay usuario logueado
  // y no hay ningún modal abierto (para no interferir)
  const scannerActive = !!user && !restockModal && !warrantyModal && !repairModal;
  useBarcodeScanner(handleScan, scannerActive);

  // ── Guardar nuevo lote (Flujo A confirmado) ───────────────────
  const handleRestockSave = async () => {
    if (!restockModal) return;
    setRestockSaving(true);
    try {
      await api.restockProduct(restockModal.product._id, {
        quantity:  parseInt(restockQty)  || 1,
        costPrice: parseInt(restockCost) || restockModal.product.costPrice,
      });
      await fetchData();
      setRestockModal(null);
    } catch {
      setScanError('Error al guardar el lote');
    } finally {
      setRestockSaving(false);
    }
  };

  const handleLogin  = (u: UserProfile) => {
    setUser(u);
    requestPermission();
  };
  const handleLogout = async () => { await api.logout(); };

  const lowStockCount = products.filter(p => p.quantity <= 3).length;
  if (!isAuthReady) return null;
  if (!user) return <LoginScreen onLogin={handleLogin} />;

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':     return <DashboardView products={products} repairs={repairs} sales={sales} onNavigate={setActiveTab} />;
      case 'stock':         return <StockView products={products} categories={categories} manufacturers={manufacturers} onRefresh={fetchData} exchangeRate={exchangeRate} />;
      case 'repairs':       return <RepairsView repairs={repairs} products={products} onRefresh={fetchData} users={users} />;
      case 'cashier':       return <CashierView user={user} products={products} repairs={repairs} wholesalers={wholesalers} reventaItems={reventaItems} reventaSuppliers={reventaSuppliers} onRefresh={fetchData} scanProduct={scanCartProduct} onScanHandled={() => setScanCartProduct(null)} />;
      case 'reventas':      return <ReventasView reventaItems={reventaItems} reventaSuppliers={reventaSuppliers} onRefresh={fetchData} />;
      case 'wholesale':     return <WholesaleView wholesalers={wholesalers} onRefresh={fetchData} user={user ?? undefined} />;
      case 'history':       return <HistoryView sales={sales} fixedCosts={fixedCosts} repairs={repairs} products={products} manufacturers={manufacturers} users={users} user={user} onRefresh={fetchData} />;
      case 'stats':         return <StatisticsView />;
      case 'gastos':        return <GastosView fixedCosts={fixedCosts} users={users} onRefresh={fetchData} />;
      case 'warranty':      return <WarrantyView sales={sales} products={products} onRefresh={fetchData} />;
      case 'users':         return <UsersView users={users} onRefresh={fetchData} />;
      case 'configuraciones': return <ConfiguracionesView />;
      default:              return <DashboardView products={products} repairs={repairs} sales={sales} onNavigate={setActiveTab} />;
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <Sidebar user={user} activeTab={activeTab} setActiveTab={setActiveTab}
        collapsed={collapsed} setCollapsed={setCollapsed} onLogout={handleLogout}
        lowStockCount={lowStockCount} />

      <main className="flex-1 p-4 md:p-8 lg:p-12 overflow-x-hidden pb-20 md:pb-8 lg:pb-12">
        <AnimatePresence mode="wait">
          <motion.div key={activeTab}
            initial={{ opacity: 1, y: 0 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3, ease: 'easeOut' }}>
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* ── Alerta flotante de stock bajo ───────────────────────── */}
      <AnimatePresence>
        {lowStockAlert && (
          <motion.div initial={{ opacity: 0, y: -40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -40 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-amber-500 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 max-w-md">
            <AlertCircle size={20} className="flex-shrink-0" />
            <p className="font-bold text-sm">{lowStockAlert}</p>
            <button onClick={() => setLowStockAlert(null)} className="ml-2 hover:opacity-70"><X size={18} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Notificación de error del escáner ─────────────────── */}
      <AnimatePresence>
        {scanError && (
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
            className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-50 bg-red-500 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 max-w-md">
            <AlertCircle size={20} className="flex-shrink-0" />
            <p className="font-bold text-sm">{scanError}</p>
            <button onClick={() => setScanError(null)} className="ml-2 hover:opacity-70"><X size={18} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modal Flujo A: Agregar lote al stock ──────────────── */}
      <AnimatePresence>
        {restockModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setRestockModal(null)}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-[40px] p-8 shadow-2xl w-full max-w-md"
              onClick={e => e.stopPropagation()}>

              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600">
                  <Package size={28} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Producto encontrado</p>
                  <h3 className="text-xl font-black text-gray-800">{restockModal.product.model}</h3>
                  <p className="text-xs text-gray-400 font-mono">EAN: {restockModal.barcode}</p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-2xl p-4 mb-6 grid grid-cols-2 gap-3 text-center">
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Stock actual</p>
                  <p className="text-2xl font-black text-gray-800">{restockModal.product.quantity}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Último costo</p>
                  <p className="text-2xl font-black text-emerald-600">
                    Gs. {(restockModal.product.costPrice || 0).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1 block">
                    Cantidad a agregar
                  </label>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setRestockQty(q => String(Math.max(1, parseInt(q) - 1)))}
                      className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center hover:bg-gray-200 transition-colors">
                      <Minus size={18} />
                    </button>
                    <NumericInput value={restockQty}
                      onChange={raw => setRestockQty(raw)}
                      className="flex-1 text-center text-3xl font-black bg-gray-50 border-2 border-transparent focus:border-indigo-600 rounded-2xl py-3 outline-none" />
                    <button onClick={() => setRestockQty(q => String(parseInt(q) + 1))}
                      className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 hover:bg-indigo-200 transition-colors">
                      <Plus size={18} />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1 block">
                    Precio de costo (Gs.)
                  </label>
                  <NumericInput value={restockCost} placeholder="Dejar vacío para mantener anterior"
                    onChange={raw => setRestockCost(raw)}
                    className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-indigo-600 rounded-2xl outline-none font-bold text-lg" />
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setRestockModal(null)}
                  className="flex-1 py-4 rounded-2xl border-2 border-gray-100 font-black text-gray-500 hover:bg-gray-50 transition-colors">
                  Cancelar
                </button>
                <button onClick={handleRestockSave} disabled={restockSaving}
                  className="flex-1 py-4 rounded-2xl bg-indigo-600 text-white font-black shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-colors disabled:opacity-50">
                  {restockSaving ? 'Guardando...' : `Agregar ${restockQty} al stock`}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modal Flujo C: Verificar garantía (VEN-) ──────────── */}
      <AnimatePresence>
        {warrantyModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setWarrantyModal(null)}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-[40px] p-8 shadow-2xl w-full max-w-md"
              onClick={e => e.stopPropagation()}>

              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600">
                  <ShieldCheck size={28} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Verificación de Garantía</p>
                  <h3 className="text-xl font-black text-gray-800">{warrantyModal.sale.customerName}</h3>
                  <p className="text-xs text-gray-400">
                    Venta: {new Date(warrantyModal.sale.date).toLocaleDateString('es-PY')}
                    {' · '}Gs. {(warrantyModal.sale.total || 0).toLocaleString()}
                  </p>
                </div>
              </div>

              {warrantyModal.warrantyInfo.length === 0 ? (
                <div className="bg-gray-50 rounded-2xl p-6 text-center">
                  <p className="font-black text-gray-500">Sin garantías registradas para esta venta</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {warrantyModal.warrantyInfo.map((w, i) => (
                    <div key={i} className={`p-4 rounded-2xl border-2 ${
                      w.isValid ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
                    }`}>
                      <div className="flex items-center justify-between">
                        <p className="font-black text-gray-800">{w.productName}</p>
                        <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${
                          w.isValid ? 'bg-emerald-600 text-white' : 'bg-red-500 text-white'
                        }`}>
                          {w.isValid ? '✓ Vigente' : '✕ Vencida'}
                        </span>
                      </div>
                      <p className={`text-sm font-bold mt-1 ${w.isValid ? 'text-emerald-600' : 'text-red-500'}`}>
                        {w.isValid
                          ? `Vence en ${w.daysLeft} día${w.daysLeft !== 1 ? 's' : ''} · ${new Date(w.expiresAt).toLocaleDateString('es-PY')}`
                          : `Venció el ${new Date(w.expiresAt).toLocaleDateString('es-PY')}`
                        }
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <button onClick={() => setWarrantyModal(null)}
                className="w-full mt-6 py-4 rounded-2xl bg-indigo-600 text-white font-black shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-colors">
                Cerrar
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modal Flujo B: Reparación encontrada (SRV-) ───────── */}
      <AnimatePresence>
        {repairModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setRepairModal(null)}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-[40px] p-8 shadow-2xl w-full max-w-md"
              onClick={e => e.stopPropagation()}>

              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600">
                  <Wrench size={28} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Ticket de Servicio</p>
                  <h3 className="text-xl font-black text-gray-800">{repairModal.repair.deviceModel}</h3>
                  <p className="text-xs text-gray-400">{repairModal.repair.customerName} · {repairModal.repair.customerPhone}</p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-2xl p-4 mb-6 space-y-3">
                <div className="flex justify-between">
                  <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Estado</span>
                  <span className={`text-xs font-black px-3 py-1 rounded-full uppercase tracking-widest ${
                    repairModal.repair.status === 'ready'       ? 'bg-emerald-100 text-emerald-700' :
                    repairModal.repair.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                    repairModal.repair.status === 'delivered'   ? 'bg-gray-100 text-gray-600' :
                    'bg-amber-100 text-amber-700'
                  }`}>
                    {repairModal.repair.status === 'pending'     ? 'Pendiente' :
                     repairModal.repair.status === 'in_progress' ? 'En proceso' :
                     repairModal.repair.status === 'ready'       ? '✓ Listo para entregar' :
                     'Entregado'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Problema</span>
                  <span className="text-xs font-bold text-gray-700 text-right max-w-[60%]">{repairModal.repair.problemDescription}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Costo</span>
                  <span className="text-xs font-black text-emerald-600">
                    Gs. {(repairModal.repair.totalCost || 0).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setRepairModal(null)}
                  className="flex-1 py-4 rounded-2xl border-2 border-gray-100 font-black text-gray-500 hover:bg-gray-50 transition-colors">
                  Cerrar
                </button>
                <button onClick={() => { setActiveTab('repairs'); setRepairModal(null); }}
                  className="flex-1 py-4 rounded-2xl bg-amber-500 text-white font-black shadow-xl shadow-amber-200 hover:bg-amber-600 transition-colors">
                  Ir a Reparaciones
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
