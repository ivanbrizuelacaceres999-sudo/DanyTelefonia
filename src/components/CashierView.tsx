import React, { useState, useEffect, useCallback } from 'react';
import {
  Search, ShoppingCart, Trash2, Package, Wrench,
  DollarSign, Play, XCircle, ArrowRight, Tag, Plus,
  AlertTriangle, Minus, CheckCircle, Printer, ArrowDownLeft,
  X, Settings2
} from 'lucide-react';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { AnimatePresence, motion } from 'motion/react';
import { api } from '../api';
import { Product, Repair, Wholesaler, Sale, CashSession, UserProfile, CashWithdrawal, WithdrawalMotive } from '../types';
import { Modal } from './ui/Modal';
import { NumericInput } from './ui/NumericInput';
import { cn } from '../lib/utils';

interface CashierViewProps {
  user: UserProfile;
  products: Product[];
  repairs: Repair[];
  wholesalers: Wholesaler[];
  onRefresh: () => void;
  // Producto detectado por el escáner — se agrega al carrito automáticamente
  scanProduct?: Product | null;
  onScanHandled?: () => void;
}

// Convierte cualquier valor a número seguro
const n = (v: any): number => {
  if (v === null || v === undefined || v === '') return 0;
  const x = Number(v);
  return isNaN(x) ? 0 : x;
};

type PriceType = 'normal' | 'wholesale' | 'cheap';

interface CartItem {
  id: string;
  type: 'product' | 'repair';
  name: string;
  price: number;
  cost: number;
  quantity: number;
  priceType?: PriceType;
}

const METHOD_LABEL: Record<string, string> = {
  cash: 'Efectivo',
  credit_card: 'Tarjeta Crédito',
  debit_card: 'Tarjeta Débito',
  transfer: 'Transferencia',
  qr: 'QR',
  credit: 'Crédito Mayorista',
  mixed: 'Múltiple',
};

// Imprime el ticket abriendo una ventana nueva — evita el bug de removeChild de react-to-print
const printTicket = (sale: Sale) => {
  const items = sale.items.map(item =>
    `<div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:13px">
      <span style="font-weight:700">${item.name} ×${item.quantity}</span>
      <span style="font-weight:900">Gs. ${(n(item.price) * item.quantity).toLocaleString()}</span>
    </div>`
  ).join('');

  const payments = (sale.payments && sale.payments.length > 1)
    ? `<div style="margin:8px 0;padding:8px;background:#eef2ff;border-radius:8px">
        <p style="font-size:10px;font-weight:900;color:#6366f1;text-transform:uppercase;margin:0 0 4px">Formas de pago</p>
        ${sale.payments.map(p =>
          `<div style="display:flex;justify-content:space-between;font-size:11px;font-weight:700">
            <span>${METHOD_LABEL[p.method] || p.method}</span>
            <span>Gs. ${n(p.amount).toLocaleString()}</span>
          </div>`
        ).join('')}
      </div>`
    : '';

  const discount = n(sale.discount) > 0
    ? `<div style="display:flex;justify-content:space-between;font-size:11px;color:#ef4444;font-weight:700">
        <span>Descuento</span><span>-Gs. ${n(sale.discount).toLocaleString()}</span>
      </div>`
    : '';

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Ticket - Dany Telefonía</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; width: 320px; padding: 24px; color: #1f2937; }
    @media print { body { width: 100%; } }
  </style>
</head>
<body>
  <div style="text-align:center;border-bottom:2px solid #e5e7eb;padding-bottom:16px;margin-bottom:16px">
    <h1 style="font-size:22px;font-weight:900;letter-spacing:-1px">Dany Telefonía</h1>
    <p style="font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:2px;margin-top:4px">Ticket de Venta</p>
  </div>
  <div style="display:flex;justify-content:space-between;font-size:10px;color:#9ca3af;margin-bottom:12px">
    <span>Fecha: ${new Date(sale.date).toLocaleDateString('es-PY')}</span>
    <span>Hora: ${new Date(sale.date).toLocaleTimeString('es-PY',{hour:'2-digit',minute:'2-digit'})}</span>
  </div>
  ${sale.customerName && sale.customerName !== 'Consumidor Final'
    ? `<p style="font-size:13px;font-weight:700;margin-bottom:10px">Cliente: ${sale.customerName}</p>`
    : ''}
  <div style="margin-bottom:12px">${items}</div>
  <div style="border-top:2px solid #e5e7eb;padding-top:12px">
    ${discount}
    ${payments}
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px">
      <span style="font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:1px">TOTAL</span>
      <span style="font-size:28px;font-weight:900;color:#4f46e5">Gs. ${n(sale.total).toLocaleString()}</span>
    </div>
    <p style="font-size:10px;color:#9ca3af;text-align:center;margin-top:20px;font-style:italic">¡Gracias por su compra! · Garantía incluida</p>
  </div>
  <!-- Código de barras VEN- para escanear en garantías -->
  <!-- Usamos solo los últimos 8 caracteres del ID para que entre en 80mm -->
  <div style="text-align:center;margin-top:20px;padding-top:16px;border-top:2px dashed #e5e7eb">
    <p style="font-size:9px;font-weight:900;color:#9ca3af;text-transform:uppercase;letter-spacing:2px;margin-bottom:8px">Código de garantía</p>
    <svg id="ven-barcode" style="max-width:100%"></svg>
    <p style="font-size:10px;font-weight:900;color:#6366f1;margin-top:4px;letter-spacing:1px">VEN-${sale._id.slice(-8).toUpperCase()}</p>
    <p style="font-size:9px;color:#9ca3af;margin-top:2px">Escaneá para verificar garantía</p>
  </div>
  <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
  <script>
    window.onload = function(){
      try {
        JsBarcode("#ven-barcode", "VEN-${sale._id.slice(-8).toUpperCase()}", {
          format: "CODE128", width: 1.8, height: 45,
          displayValue: false, margin: 4,
          lineColor: "#4f46e5"
        });
      } catch(e){}
      window.print();
      window.onafterprint = function(){ window.close(); };
    };
  </script>
</body>
</html>`;

  // ── Imprime dos copias: una para el cliente, una para el local ──
  // Abrimos dos ventanas separadas con un pequeño delay para que
  // el navegador no bloquee el segundo popup.
  const win1 = window.open('', '_blank', 'width=400,height=600');
  if (win1) {
    win1.document.write(html.replace('Ticket de Venta', 'Ticket de Venta — CLIENTE'));
    win1.document.close();
  }
  setTimeout(() => {
    const win2 = window.open('', '_blank', 'width=400,height=600');
    if (win2) {
      win2.document.write(html.replace('Ticket de Venta', 'Ticket de Venta — LOCAL'));
      win2.document.close();
    }
  }, 400);
};

export const CashierView = ({ user, products, repairs, wholesalers, onRefresh, scanProduct, onScanHandled }: CashierViewProps) => {
  const [session, setSession] = useState<CashSession | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [isOpeningSession, setIsOpeningSession] = useState(false);

  // ── Escáner: agregar producto al carrito automáticamente ──
  // Cuando App.tsx detecta un EAN-13 en la pantalla de caja,
  // pasa el producto aquí y lo agregamos al carrito con 1 unidad.
  useEffect(() => {
    if (!scanProduct || !session) return;
    const price = n(scanProduct.salePrice);
    const cost  = n(scanProduct.costPrice);
    setCart(prev => {
      const existing = prev.find(i => i.id === scanProduct._id && i.type === 'product');
      if (existing) {
        // Si ya está en el carrito, sumar 1
        return prev.map(i =>
          i.id === scanProduct._id && i.type === 'product'
            ? { ...i, quantity: i.quantity + 1 }
            : i
        );
      }
      // Si no está, agregar nuevo
      return [...prev, {
        id:       scanProduct._id,
        type:     'product' as const,
        name:     scanProduct.model,
        price,
        cost,
        quantity: 1,
      }];
    });
    // Avisar a App.tsx que ya procesamos el producto
    onScanHandled?.();
  }, [scanProduct]);

  const [initialCash, setInitialCash] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [qty, setQty] = useState('1');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedRepair,  setSelectedRepair]  = useState<Repair | null>(null);
  const [selectedPriceType, setSelectedPriceType] = useState<PriceType>('normal');

  // Resetear precio a "normal" cada vez que se elige otro producto
  useEffect(() => {
    setSelectedPriceType('normal');
  }, [selectedProduct?._id]);
  const [discount, setDiscount] = useState('');
  const [wholesalerId, setWholesalerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  // Pagos parciales — siempre se usan, sin necesidad de "Múltiple"
  const [payments, setPayments] = useState<{ method: string; amount: string }[]>([
    { method: 'cash', amount: '' }
  ]);

  // ── Estado de retiros ─────────────────────────────────────────
  const [withdrawals,      setWithdrawals]      = useState<CashWithdrawal[]>([]);
  const [customMotives,    setCustomMotives]    = useState<WithdrawalMotive[]>([]);
  const [showWithdrawal,   setShowWithdrawal]   = useState(false);
  const [wAmount,          setWAmount]          = useState('');
  const [wMotive,          setWMotive]          = useState('');
  const [wNote,            setWNote]            = useState('');
  const [wSaving,          setWSaving]          = useState(false);
  const [managingMotives,  setManagingMotives]  = useState(false);
  const [newMotiveName,    setNewMotiveName]    = useState('');
  const [addingMotive,     setAddingMotive]     = useState(false);
  const [pendingConfirm,   setPendingConfirm]   = useState<{ message: string; onConfirm: () => void } | null>(null);

  const loadSession = async () => {
    setLoadingSession(true);
    try { const s = await api.getCurrentSession(); setSession(s ?? null); }
    catch { setSession(null); }
    finally { setLoadingSession(false); }
  };

  const loadWithdrawals = async (sessionId?: string) => {
    const data = await (api as any).getCashWithdrawals(sessionId);
    if (Array.isArray(data)) setWithdrawals(data);
  };

  const loadMotives = async () => {
    const data = await (api as any).getWithdrawalMotives();
    if (Array.isArray(data)) setCustomMotives(data);
  };

  useEffect(() => { loadSession(); loadMotives(); }, []);

  // Cargar retiros cada vez que cambia la sesión
  useEffect(() => {
    if (session?._id) loadWithdrawals(String(session._id));
  }, [session?._id]);

  const openSession = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.openSession({ openedBy: user._id, initialCash: parseInt(initialCash) || 0 });
    setIsOpeningSession(false); setInitialCash(''); loadSession();
  };

  const closeSession = () => {
    setPendingConfirm({
      message: '¿Cerrar la caja? El día operativo quedará registrado.',
      onConfirm: async () => { await api.closeSession(); loadSession(); onRefresh(); },
    });
  };

  const addProduct = () => {
    if (!selectedProduct) return;
    const quantity = Math.max(1, parseInt(qty) || 1);
    const cost  = n(selectedProduct.costPrice);
    const stock = n(selectedProduct.quantity);
    // Elegir precio según tipo seleccionado
    const price =
      selectedPriceType === 'wholesale' && n(selectedProduct.priceWholesale) > 0
        ? n(selectedProduct.priceWholesale)
        : selectedPriceType === 'cheap' && n(selectedProduct.priceCheap) > 0
          ? n(selectedProduct.priceCheap)
          : n(selectedProduct.salePrice);
    if (stock < quantity) { setErrorMsg(`Stock insuficiente: solo ${stock} unidades.`); return; }
    setCart(prev => {
      const ex = prev.find(i => i.id === selectedProduct._id && i.type === 'product');
      if (ex) {
        if (stock < ex.quantity + quantity) { setErrorMsg(`Stock insuficiente: solo ${stock} unidades.`); return prev; }
        return prev.map(i => i.id === selectedProduct._id ? { ...i, quantity: i.quantity + quantity } : i);
      }
      return [...prev, { id: selectedProduct._id, type: 'product', name: selectedProduct.model, price, cost, quantity, priceType: selectedPriceType }];
    });
    setSelectedProduct(null); setSearchTerm(''); setQty('1'); setErrorMsg(''); setSelectedPriceType('normal');
  };

  // Seleccionar reparación (igual que selectedProduct para productos)
  const selectRepair = (r: Repair) => {
    if (cart.find(i => i.id === r._id)) return;
    setSelectedRepair(r);
    setSelectedProduct(null); // limpiar producto seleccionado
  };

  // Agregar reparación al carrito — se llama desde el mismo btn "Agregar"
  const addRepair = () => {
    if (!selectedRepair) return;
    if (cart.find(i => i.id === selectedRepair._id)) return;
    const partsCost = (selectedRepair.partsUsed || []).reduce(
      (sum: number, p: any) => sum + (n(p.cost || 0) * (p.quantity || 1)), 0
    );
    setCart(prev => [...prev, {
      id: selectedRepair._id, type: 'repair',
      name: `${selectedRepair.deviceModel} — ${selectedRepair.customerName}`,
      price: n(selectedRepair.totalCost), cost: partsCost, quantity: 1
    }]);
    setSelectedRepair(null);
  };

  const changeQty = (id: string, delta: number) =>
    setCart(prev => prev.map(i => i.id === id ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i));

  const removeItem = (id: string) => setCart(prev => prev.filter(i => i.id !== id));

  const subtotal  = cart.reduce((acc, i) => acc + n(i.price) * i.quantity, 0);
  const discountN = parseInt(discount) || 0;
  const total     = Math.max(0, subtotal - discountN);
  const totalPaid = payments.reduce((acc, p) => acc + (parseInt(p.amount) || 0), 0);
  const resta     = Math.max(0, total - totalPaid);
  const vuelto    = totalPaid > total && total > 0 ? totalPaid - total : 0;
  const totalWithdrawn = withdrawals.reduce((s, w) => s + n(w.amount), 0);
  const cashInBox = session ? n(session.initialCash) + n(session.totals?.cash) - totalWithdrawn : 0;

  const addPaymentRow = () =>
    setPayments(prev => [...prev, { method: 'cash', amount: '' }]);

  const removePaymentRow = (idx: number) =>
    setPayments(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev);

  const updatePayment = (idx: number, field: 'method' | 'amount', value: string) =>
    setPayments(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p));

  const checkout = async () => {
    if (cart.length === 0) { setErrorMsg('El carrito está vacío.'); return; }
    if (totalPaid < total) { setErrorMsg(`Falta cubrir Gs. ${resta.toLocaleString()} para completar el pago.`); return; }
    if (totalPaid > total) { setErrorMsg(`El monto pagado excede el total en Gs. ${vuelto.toLocaleString()}.`); return; }

    setIsProcessing(true); setErrorMsg(''); setSuccessMsg('');
    try {
      const paymentsData = payments
        .filter(p => parseInt(p.amount) > 0)
        .map(p => ({ method: p.method, amount: parseInt(p.amount) }));

      const paymentMethod = paymentsData.length === 1 ? paymentsData[0].method : 'mixed';

      const sale = await api.createSale({
        items: cart.map(i => ({ id: i.id, type: i.type, name: i.name, price: i.price, cost: i.cost, quantity: i.quantity })),
        total,
        costTotal: cart.reduce((acc, i) => acc + n(i.cost) * i.quantity, 0),
        discount: discountN,
        paymentMethod,
        payments: paymentsData,
        wholesalerId: wholesalerId || undefined,
        customerName: customerName ||
          (wholesalerId ? wholesalers.find(w => w._id === wholesalerId)?.name : undefined) ||
          'Consumidor Final',
        sessionId: session?._id,
      });

      setCart([]); setDiscount(''); setWholesalerId(''); setCustomerName('');
      setPayments([{ method: 'cash', amount: '' }]);
      setSuccessMsg(`✓ Venta registrada · Gs. ${n(sale.total).toLocaleString()}`);
      onRefresh(); loadSession();
      printTicket(sale);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al procesar la venta');
    } finally { setIsProcessing(false); }
  };

  // ── Guardar retiro ────────────────────────────────────────────
  const handleWithdrawal = async () => {
    if (!wMotive) { setErrorMsg('Seleccioná un motivo para el retiro.'); return; }
    const amt = parseInt(wAmount.replace(/\D/g, '')) || 0;
    if (amt <= 0) { setErrorMsg('Ingresá un monto válido.'); return; }
    setWSaving(true);
    try {
      await (api as any).createCashWithdrawal({
        amount: amt, motive: wMotive, note: wNote,
        sessionId: session?._id ? String(session._id) : '',
      });
      setShowWithdrawal(false);
      setWAmount(''); setWMotive(''); setWNote('');
      if (session?._id) loadWithdrawals(String(session._id));
    } catch {
      setErrorMsg('Error al registrar el retiro.');
    } finally {
      setWSaving(false);
    }
  };

  const handleDeleteWithdrawal = async (id: string) => {
    await (api as any).deleteCashWithdrawal(id);
    if (session?._id) loadWithdrawals(String(session._id));
  };

  const handleAddMotive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMotiveName.trim()) return;
    setAddingMotive(true);
    try {
      await (api as any).createWithdrawalMotive(newMotiveName.trim());
      setNewMotiveName('');
      loadMotives();
    } finally {
      setAddingMotive(false);
    }
  };

  const handleDeleteMotive = async (id: string) => {
    await (api as any).deleteWithdrawalMotive(id);
    loadMotives();
  };

  const allMotives = customMotives.map(m => ({ id: m._id, name: m.name }));

  const filteredProducts = products.filter(p =>
    n(p.quantity) > 0 && (!searchTerm || p.model.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  // Solo reparaciones con estado 'listo' — se entregan al cobrar
  const readyRepairs = repairs.filter(r =>
    r.status === 'ready' &&
    (!searchTerm || r.deviceModel.toLowerCase().includes(searchTerm.toLowerCase()) ||
     r.customerName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loadingSession) return (
    <div className="h-full flex items-center justify-center">
      <div className="text-gray-400 font-bold animate-pulse">Cargando caja...</div>
    </div>
  );

  if (!session) return (
    <div className="h-full flex flex-col items-center justify-center space-y-8">
      <div className="bg-white p-12 rounded-[50px] shadow-2xl border border-gray-100 text-center max-w-md w-full">
        <div className="w-24 h-24 bg-indigo-50 rounded-[30px] flex items-center justify-center text-indigo-600 mx-auto mb-8">
          <DollarSign size={48} />
        </div>
        <h2 className="text-4xl font-black text-gray-800 tracking-tighter mb-4">Caja Cerrada</h2>
        <p className="text-gray-400 font-bold mb-8">Iniciá el día operativo abriendo la caja.</p>
        <button onClick={() => setIsOpeningSession(true)}
          className="w-full bg-indigo-600 text-white font-black py-5 rounded-3xl shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center justify-center gap-3">
          <Play size={20} /> Abrir Caja del Día
        </button>
      </div>
      {isOpeningSession && (
        <Modal title="Abrir Caja" onClose={() => setIsOpeningSession(false)}>
          <form onSubmit={openSession} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Monto Inicial en Efectivo (Gs.)</label>
              <NumericInput value={initialCash}
                onChange={raw => setInitialCash(raw)}
                className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl outline-none font-black text-2xl" />
            </div>
            <button type="submit" className="w-full bg-indigo-600 text-white font-black py-5 rounded-2xl shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all">
              Comenzar Operaciones
            </button>
          </form>
        </Modal>
      )}
    </div>
  );

  return (
    <>
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:h-[calc(100vh-7rem)]">

      {/* ── COLUMNA IZQUIERDA: productos ── */}
      <div className="lg:col-span-3 flex flex-col gap-4 min-h-0">

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-gray-800 tracking-tighter">Caja Abierta</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <p className="text-gray-400 font-bold text-[10px] uppercase tracking-widest">
                {session.openedBy?.name} · {new Date(session.openedAt).toLocaleDateString('es-PY', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="bg-emerald-50 px-3 py-2 rounded-2xl text-right">
              <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Efectivo en Caja</p>
              <p className="font-black text-emerald-700 text-base md:text-lg">Gs. {cashInBox.toLocaleString()}</p>
              {totalWithdrawn > 0 && (
                <p className="text-[8px] font-bold text-red-400">−Gs. {totalWithdrawn.toLocaleString()} retirado</p>
              )}
            </div>
            <button
              onClick={() => { setShowWithdrawal(true); setErrorMsg(''); }}
              className="bg-orange-50 text-orange-600 font-black px-3 md:px-5 py-2.5 md:py-3 rounded-2xl hover:bg-orange-500 hover:text-white transition-all flex items-center gap-2 border border-orange-100 text-sm">
              <ArrowDownLeft size={16} /> Retiro
            </button>
            <button onClick={closeSession}
              className="bg-red-50 text-red-500 font-black px-3 md:px-5 py-2.5 md:py-3 rounded-2xl hover:bg-red-500 hover:text-white transition-all flex items-center gap-2 text-sm">
              <XCircle size={16} /> Cerrar Caja
            </button>
          </div>
        </div>

        <div className="flex gap-2 shrink-0">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input type="text" placeholder="Buscar producto o reparación..." value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setSelectedProduct(null); setSelectedRepair(null); setErrorMsg(''); }}
              className="w-full bg-white border border-gray-100 rounded-2xl py-2.5 pl-9 pr-3 outline-none shadow-sm focus:shadow-md focus:border-indigo-200 transition-all font-bold text-gray-700 text-sm" />
          </div>
          <div className="relative w-14 md:w-20 shrink-0">
            <NumericInput value={qty} placeholder="1"
              onChange={raw => setQty(raw)}
              className="w-full bg-white border border-gray-100 rounded-2xl py-2.5 px-2 outline-none shadow-sm font-bold text-gray-700 text-center text-sm" />
            <label className="absolute -top-2 left-2 bg-white px-1 text-[9px] font-black text-gray-400 uppercase tracking-widest">Cant.</label>
          </div>
          <button
            onClick={() => { if (selectedProduct) addProduct(); else if (selectedRepair) addRepair(); }}
            disabled={!selectedProduct && !selectedRepair}
            className="bg-indigo-600 text-white font-black px-4 md:px-5 py-2.5 rounded-2xl hover:bg-indigo-700 disabled:opacity-40 flex items-center gap-1.5 shadow-lg shadow-indigo-200 shrink-0 transition-all text-sm">
            <Plus size={16} /> <span className="hidden sm:inline">{selectedRepair && !selectedProduct ? 'Agregar' : 'Agregar'}</span>
            <span className="sm:hidden">+</span>
          </button>
        </div>

        {/* ── Selector de precio — aparece al elegir un producto ── */}
        {selectedProduct && (
          <div className="flex items-center gap-2 shrink-0 bg-white rounded-2xl border border-gray-100 p-2 shadow-sm">
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1 mr-1 whitespace-nowrap hidden sm:block">
              Precio:
            </p>
            {([
              { key: 'normal'    as PriceType, emoji: '👤', label: 'Cliente',    price: n(selectedProduct.salePrice) },
              { key: 'wholesale' as PriceType, emoji: '🏪', label: 'Mayorista',  price: n(selectedProduct.priceWholesale) },
              { key: 'cheap'     as PriceType, emoji: '💸', label: 'Tacaño',     price: n(selectedProduct.priceCheap) },
            ] as { key: PriceType; emoji: string; label: string; price: number }[])
              .filter(opt => opt.price > 0)
              .map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setSelectedPriceType(opt.key)}
                  className={cn(
                    'flex-1 flex flex-col items-center py-2 px-3 rounded-xl transition-all',
                    selectedPriceType === opt.key
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                      : 'bg-gray-50 text-gray-600 hover:bg-indigo-50 hover:text-indigo-700'
                  )}
                >
                  <span className="text-[9px] font-black uppercase tracking-widest leading-none mb-0.5">
                    {opt.emoji} {opt.label}
                  </span>
                  <span className="font-black text-sm leading-none">
                    Gs. {opt.price.toLocaleString()}
                  </span>
                </button>
              ))
            }
          </div>
        )}

        {errorMsg && (
          <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 font-bold text-sm shrink-0">
            <AlertTriangle size={18} /> {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-700 font-bold text-sm shrink-0">
            <CheckCircle size={18} /> {successMsg}
          </div>
        )}

        <div className="flex-1 overflow-y-auto pr-1 space-y-6 min-h-0">
          <section>
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-2">Productos en Stock</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredProducts.map(p => {
                const sel = selectedProduct?._id === p._id;
                return (
                  <button key={p._id}
                    onClick={() => { setSelectedProduct(prev => prev?._id === p._id ? null : p); setErrorMsg(''); }}
                    className={cn('flex items-center justify-between p-5 rounded-[25px] border transition-all text-left',
                      sel ? 'bg-indigo-600 border-indigo-600 shadow-xl shadow-indigo-200'
                          : 'bg-white hover:bg-indigo-50 border-gray-100 hover:border-indigo-100 hover:shadow-xl')}>
                    <div className="flex items-center gap-3">
                      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center',
                        sel ? 'bg-indigo-500 text-white' : 'bg-gray-50 text-gray-400')}>
                        <Package size={20} />
                      </div>
                      <div>
                        <p className={cn('font-black', sel ? 'text-white' : 'text-gray-800')}>{p.model}</p>
                        <p className={cn('text-[10px] font-bold uppercase tracking-widest', sel ? 'text-indigo-200' : 'text-gray-400')}>
                          Stock: {p.quantity}
                        </p>
                      </div>
                    </div>
                    <p className={cn('font-black text-lg', sel ? 'text-white' : 'text-emerald-500')}>
                      Gs. {n(p.salePrice).toLocaleString()}
                    </p>
                  </button>
                );
              })}
              {filteredProducts.length === 0 && (
                <p className="col-span-2 text-center text-gray-300 py-6 font-bold text-sm">
                  {searchTerm ? `Sin productos para "${searchTerm}"` : 'Sin stock disponible'}
                </p>
              )}
            </div>
          </section>

          <section>
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 ml-2 flex items-center gap-2">
              <Wrench size={12} /> Reparaciones Listas para Cobrar
              {repairs.filter(r => r.status === 'ready').length > 0 && (
                <span className="bg-amber-100 text-amber-700 text-[9px] font-black px-2 py-0.5 rounded-full">
                  {repairs.filter(r => r.status === 'ready').length}
                </span>
              )}
            </h3>
            {readyRepairs.length === 0 ? (
              <div className="text-center py-6 bg-gray-50 rounded-2xl text-gray-300">
                <Wrench size={24} className="mx-auto mb-2" />
                <p className="font-bold text-xs uppercase tracking-widest">No hay reparaciones listas para cobrar</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {readyRepairs.map(r => {
                  const inCart = !!cart.find(i => i.id === r._id);
                  return (
                    <button key={r._id} onClick={() => selectRepair(r)} disabled={inCart}
                      className={cn('flex items-center justify-between p-5 rounded-[25px] border transition-all text-left',
                        inCart                          ? 'bg-emerald-600 border-emerald-600 shadow-xl cursor-default'
                        : selectedRepair?._id === r._id ? 'bg-amber-50 border-amber-400 shadow-xl'
                        :                                 'bg-white hover:bg-amber-50 border-gray-100 hover:border-amber-200 hover:shadow-xl')}>
                      <div className="flex items-center gap-3">
                        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center',
                          inCart ? 'bg-emerald-500 text-white' : 'bg-amber-50 text-amber-500')}>
                          <Wrench size={20} />
                        </div>
                        <div>
                          <p className={cn('font-black', inCart ? 'text-white' : 'text-gray-800')}>{r.deviceModel}</p>
                          <p className={cn('text-[10px] font-bold uppercase', inCart ? 'text-emerald-200' : 'text-gray-400')}>
                            {r.customerName}{inCart ? ' · ✓ En carrito' : ''}
                          </p>
                          {!inCart && (
                            <span className={cn('text-[9px] font-black px-1.5 py-0.5 rounded-full',
                              r.status === 'ready' ? 'bg-emerald-100 text-emerald-700'
                              : r.status === 'in_progress' ? 'bg-blue-100 text-blue-700'
                              : 'bg-amber-100 text-amber-700')}>
                              {r.status === 'ready' ? '✓ Listo' : r.status === 'in_progress' ? 'En proceso' : 'Pendiente'}
                            </span>
                          )}
                        </div>
                      </div>
                      <p className={cn('font-black text-lg', inCart ? 'text-white' : 'text-emerald-500')}>
                        Gs. {n(r.totalCost).toLocaleString()}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
          {/* Retiros del día */}
          {withdrawals.length > 0 && (
            <section>
              <h3 className="text-[10px] font-black text-orange-500 uppercase tracking-widest mb-3 ml-2 flex items-center gap-2">
                <ArrowDownLeft size={12} /> Retiros del día ({withdrawals.length})
              </h3>
              <div className="space-y-2">
                {withdrawals.map(w => (
                  <div key={w._id}
                    className="flex items-center justify-between bg-orange-50 border border-orange-100 rounded-2xl px-4 py-3">
                    <div>
                      <p className="font-black text-gray-800 text-sm">{w.motive}</p>
                      {w.note && <p className="text-[10px] font-bold text-gray-400">{w.note}</p>}
                      <p className="text-[9px] font-bold text-gray-300">
                        {new Date(w.date).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="font-black text-orange-600">-Gs. {n(w.amount).toLocaleString()}</p>
                      <button
                        onClick={() => handleDeleteWithdrawal(w._id)}
                        className="p-1.5 text-gray-300 hover:text-red-500 transition-colors rounded-xl hover:bg-red-50">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      {/* ── COLUMNA DERECHA: CARRITO (diseño oscuro POS) ── */}
      <div className="lg:col-span-2 bg-slate-900 rounded-[32px] shadow-2xl flex flex-col overflow-hidden min-h-0">

        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-700/60 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-500 rounded-xl flex items-center justify-center text-white">
              <ShoppingCart size={17} />
            </div>
            <div>
              <h3 className="text-base font-black text-white tracking-tight leading-none">Pedido</h3>
              <p className="text-[10px] font-bold text-slate-400 leading-none mt-0.5 uppercase tracking-widest">
                {cart.length} ítem{cart.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          {cart.length > 0 && (
            <button onClick={() => { setCart([]); setErrorMsg(''); }}
              className="text-[10px] font-black text-slate-500 hover:text-red-400 transition-colors cursor-pointer uppercase tracking-widest">
              Limpiar
            </button>
          )}
        </div>

        {/* ── LISTA DE ITEMS ── flex-1 scrolleable */}
        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-2">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 py-12">
              <div className="w-16 h-16 bg-slate-800 rounded-3xl flex items-center justify-center">
                <ShoppingCart size={26} className="text-slate-600" />
              </div>
              <p className="text-slate-500 font-black text-xs uppercase tracking-widest">Sin ítems</p>
              <p className="text-slate-600 font-bold text-[10px]">Seleccioná productos o reparaciones</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.id} className="bg-slate-800 rounded-2xl px-4 py-3 flex items-center gap-3 hover:bg-slate-750 transition-colors group">

                {/* Ícono tipo */}
                <div className={cn(
                  'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white',
                  item.type === 'product' ? 'bg-indigo-500/80' : 'bg-amber-500/80'
                )}>
                  {item.type === 'product' ? <Package size={17} /> : <Wrench size={17} />}
                </div>

                {/* Nombre + precio unitario */}
                <div className="flex-1 min-w-0">
                  <p className="font-black text-white text-sm truncate leading-snug">{item.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] font-bold text-slate-400">
                      Gs. {n(item.price).toLocaleString()} c/u
                    </span>
                    {item.priceType && item.priceType !== 'normal' && (
                      <span className={cn(
                        'text-[9px] font-black px-1.5 py-0.5 rounded-full',
                        item.priceType === 'wholesale' ? 'bg-purple-500/20 text-purple-300' : 'bg-orange-500/20 text-orange-300'
                      )}>
                        {item.priceType === 'wholesale' ? 'Mayor.' : 'Econ.'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Cantidad (solo productos) */}
                {item.type === 'product' ? (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => changeQty(item.id, -1)}
                      className="w-7 h-7 bg-slate-700 hover:bg-red-500/30 hover:text-red-400 text-slate-400 rounded-lg flex items-center justify-center transition-all cursor-pointer">
                      <Minus size={12} />
                    </button>
                    <span className="w-6 text-center font-black text-white text-sm">{item.quantity}</span>
                    <button onClick={() => changeQty(item.id, 1)}
                      className="w-7 h-7 bg-slate-700 hover:bg-indigo-500/30 hover:text-indigo-400 text-slate-400 rounded-lg flex items-center justify-center transition-all cursor-pointer">
                      <Plus size={12} />
                    </button>
                  </div>
                ) : (
                  <span className="text-[10px] font-black text-amber-400 bg-amber-500/10 px-2 py-1 rounded-lg shrink-0">
                    ×1
                  </span>
                )}

                {/* Subtotal */}
                <div className="text-right shrink-0 min-w-[72px]">
                  <p className="font-black text-emerald-400 text-sm leading-none">
                    Gs. {(n(item.price) * item.quantity).toLocaleString()}
                  </p>
                  <button onClick={() => removeItem(item.id)}
                    className="text-slate-600 hover:text-red-400 transition-colors mt-1 cursor-pointer">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* ── PANEL DE COBRO — shrink-0, nunca desaparece ── */}
        <div className="shrink-0 border-t border-slate-700/60 flex flex-col bg-slate-800/50">

          {/* Scrollable interno: campos + pagos */}
          <div className="overflow-y-auto px-4 py-3 space-y-3 max-h-[310px] lg:max-h-[350px]">

            {/* Total grande */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Total</p>
                <p className="text-3xl font-black text-white tracking-tighter leading-none">
                  Gs. {total.toLocaleString()}
                </p>
              </div>
              {discountN > 0 && (
                <div className="text-right">
                  <p className="text-[10px] text-slate-500 font-bold line-through">Gs. {subtotal.toLocaleString()}</p>
                  <p className="text-[10px] text-red-400 font-black">−Gs. {discountN.toLocaleString()}</p>
                </div>
              )}
            </div>

            {/* Cliente + Descuento */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Cliente</label>
                <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)}
                  placeholder="Consumidor Final"
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl py-2 px-3 outline-none font-bold text-xs text-white placeholder-slate-500 focus:border-indigo-500 transition-colors" />
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Descuento</label>
                <div className="relative">
                  <Tag className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" size={10} />
                  <NumericInput value={discount} onChange={raw => setDiscount(raw)}
                    className="w-full bg-slate-700 border border-slate-600 rounded-xl py-2 pl-7 pr-2 outline-none font-bold text-xs text-white focus:border-indigo-500 transition-colors" />
                </div>
              </div>
            </div>

            {/* Mayorista */}
            <div>
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Mayorista</label>
              <select value={wholesalerId} onChange={e => setWholesalerId(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-xl py-2 px-3 outline-none font-bold text-xs text-white focus:border-indigo-500 cursor-pointer transition-colors">
                <option value="">— Consumidor Final —</option>
                {wholesalers.map(w => (
                  <option key={w._id} value={w._id}>
                    {w.name}{n(w.debt) > 0 ? ` · Deuda: Gs. ${n(w.debt).toLocaleString()}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Pagos */}
            <div className="bg-slate-700/50 rounded-2xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Forma de Pago</p>
                <button onClick={addPaymentRow}
                  className="bg-indigo-500 text-white font-black text-[9px] px-2.5 py-1 rounded-lg hover:bg-indigo-400 transition-colors flex items-center gap-1 cursor-pointer">
                  <Plus size={9} /> Agregar
                </button>
              </div>
              {payments.map((p, idx) => (
                <div key={idx} className="flex gap-1.5 items-center">
                  <select value={p.method} onChange={e => updatePayment(idx, 'method', e.target.value)}
                    className="flex-1 bg-slate-700 border border-slate-600 rounded-xl py-2 px-2 text-xs font-bold text-white outline-none focus:border-indigo-500 cursor-pointer">
                    <option value="cash">Efectivo</option>
                    <option value="credit_card">T. Crédito</option>
                    <option value="debit_card">T. Débito</option>
                    <option value="transfer">Transferencia</option>
                    <option value="qr">QR</option>
                    <option value="credit">Cta. May.</option>
                  </select>
                  <NumericInput value={p.amount} placeholder="Monto"
                    onChange={raw => updatePayment(idx, 'amount', raw)}
                    className="w-24 bg-slate-700 border border-slate-600 rounded-xl py-2 px-2 text-sm font-black text-white outline-none text-center focus:border-indigo-500" />
                  {payments.length > 1 && (
                    <button onClick={() => removePaymentRow(idx)}
                      className="text-slate-600 hover:text-red-400 p-1 shrink-0 transition-colors cursor-pointer">
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              ))}
              {total > 0 && (
                <div className="pt-2 border-t border-slate-600 space-y-1.5">
                  <div className="w-full bg-slate-600 rounded-full h-1.5">
                    <div className={cn('h-1.5 rounded-full transition-all duration-300', totalPaid >= total ? 'bg-emerald-500' : 'bg-indigo-500')}
                      style={{ width: `${Math.min(100, (totalPaid / total) * 100)}%` }} />
                  </div>
                  <div className="flex justify-between text-[10px] font-black">
                    <span className="text-slate-500">Gs. {totalPaid.toLocaleString()}</span>
                    {resta > 0 && <span className="text-amber-400">Falta Gs. {resta.toLocaleString()}</span>}
                    {vuelto > 0 && <span className="text-emerald-400">Vuelto Gs. {vuelto.toLocaleString()}</span>}
                    {totalPaid === total && total > 0 && (
                      <span className="text-emerald-400 flex items-center gap-1"><CheckCircle size={9} /> Completo</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* BOTÓN FINALIZAR — fijo siempre al fondo */}
          <div className="px-4 pb-4 pt-2 shrink-0">
            <button
              onClick={checkout}
              disabled={cart.length === 0 || isProcessing || totalPaid !== total || total === 0}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-black py-4 rounded-2xl shadow-xl shadow-emerald-900/40 active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 disabled:opacity-30 disabled:shadow-none disabled:cursor-not-allowed text-sm cursor-pointer">
              {isProcessing
                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Procesando...</>
                : <><CheckCircle size={18} /> Cobrar · Gs. {total.toLocaleString()}</>
              }
            </button>
          </div>
        </div>
      </div>
    </div>

    {/* ══════════════════════════════════════════
        MODAL: REGISTRAR RETIRO DE CAJA
        ══════════════════════════════════════════ */}
    <AnimatePresence>
      {showWithdrawal && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => !wSaving && setShowWithdrawal(false)}>
          <motion.div
            initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
            className="bg-white rounded-[40px] p-8 shadow-2xl w-full max-w-lg"
            onClick={e => e.stopPropagation()}>

            {/* Header del modal */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-orange-100 rounded-2xl flex items-center justify-center text-orange-600">
                  <ArrowDownLeft size={28} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest">Caja</p>
                  <h3 className="text-xl font-black text-gray-800">Registrar Retiro</h3>
                </div>
              </div>
              <button onClick={() => setShowWithdrawal(false)}
                className="p-2 text-gray-300 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all">
                <X size={20} />
              </button>
            </div>

            {/* Tabs: Retiro | Administrar motivos */}
            <div className="flex gap-2 mb-6">
              <button onClick={() => setManagingMotives(false)}
                className={cn('flex-1 py-2.5 rounded-2xl font-black text-sm transition-all',
                  !managingMotives ? 'bg-orange-500 text-white shadow-lg shadow-orange-200' : 'bg-gray-50 text-gray-500 hover:bg-gray-100')}>
                Nuevo Retiro
              </button>
              <button onClick={() => setManagingMotives(true)}
                className={cn('flex-1 py-2.5 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2',
                  managingMotives ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-gray-50 text-gray-500 hover:bg-gray-100')}>
                <Settings2 size={14} /> Motivos
              </button>
            </div>

            {/* ── Tab: Nuevo Retiro ── */}
            {!managingMotives && (
              <div className="space-y-5">
                {/* Monto */}
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2 ml-1">
                    Monto a retirar (Gs.)
                  </label>
                  <NumericInput
                    value={wAmount}
                    placeholder="0"
                    onChange={raw => setWAmount(raw)}
                    className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-orange-500 focus:bg-white rounded-2xl outline-none font-black text-3xl text-orange-600 text-center transition-all"
                    autoFocus
                  />
                </div>

                {/* Motivo */}
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2 ml-1">
                    Motivo del retiro
                  </label>
                  {allMotives.length === 0 ? (
                    <div className="text-center py-6 bg-gray-50 rounded-2xl">
                      <p className="text-xs font-bold text-gray-400">Sin motivos configurados</p>
                      <p className="text-[10px] text-gray-300 mt-1">Agregá uno en la pestaña "Motivos"</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {allMotives.map(m => (
                        <button key={m.id} onClick={() => setWMotive(m.name)}
                          className={cn(
                            'p-3 rounded-2xl border-2 font-bold text-sm text-left transition-all',
                            wMotive === m.name
                              ? 'bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-200'
                              : 'bg-gray-50 border-gray-100 text-gray-600 hover:border-orange-200 hover:bg-orange-50'
                          )}>
                          {m.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Nota opcional */}
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2 ml-1">
                    Nota (opcional)
                  </label>
                  <input
                    type="text"
                    value={wNote}
                    placeholder="Ej: Factura N° 001, nombre del banco…"
                    onChange={e => setWNote(e.target.value)}
                    className="w-full p-3 bg-gray-50 border-2 border-transparent focus:border-orange-400 focus:bg-white rounded-2xl outline-none font-bold text-sm transition-all"
                  />
                </div>

                {/* Resumen */}
                {wMotive && parseInt(wAmount) > 0 && (
                  <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 flex items-center justify-between">
                    <div>
                      <p className="font-black text-gray-800 text-sm">{wMotive}</p>
                      {wNote && <p className="text-[10px] font-bold text-gray-400">{wNote}</p>}
                    </div>
                    <p className="font-black text-orange-600 text-xl">-Gs. {parseInt(wAmount).toLocaleString()}</p>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button onClick={() => setShowWithdrawal(false)} disabled={wSaving}
                    className="flex-1 py-4 rounded-2xl border-2 border-gray-100 font-black text-gray-500 hover:bg-gray-50 transition-colors">
                    Cancelar
                  </button>
                  <button onClick={handleWithdrawal} disabled={wSaving || !wMotive || !parseInt(wAmount)}
                    className="flex-1 py-4 rounded-2xl bg-orange-500 text-white font-black shadow-xl shadow-orange-200 hover:bg-orange-600 transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
                    {wSaving
                      ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Registrando…</>
                      : <><ArrowDownLeft size={16} /> Confirmar Retiro</>
                    }
                  </button>
                </div>
              </div>
            )}

            {/* ── Tab: Administrar Motivos ── */}
            {managingMotives && (
              <div className="space-y-4">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Motivos configurados ({customMotives.length})
                </p>

                {customMotives.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 rounded-2xl">
                    <p className="text-sm font-black text-gray-300">Sin motivos todavía</p>
                    <p className="text-[10px] text-gray-300 mt-1">Agregá el primero abajo</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {customMotives.map(m => (
                      <div key={m._id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl border border-gray-100">
                        <span className="font-bold text-gray-700 text-sm">{m.name}</span>
                        <button onClick={() => handleDeleteMotive(m._id)}
                          className="p-1.5 text-gray-300 hover:text-red-500 transition-colors rounded-xl hover:bg-red-50">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Agregar nuevo motivo */}
                <form onSubmit={handleAddMotive} className="flex gap-2">
                  <input
                    type="text"
                    value={newMotiveName}
                    placeholder="Nuevo motivo…"
                    onChange={e => setNewMotiveName(e.target.value)}
                    className="flex-1 p-3 bg-gray-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl outline-none font-bold text-sm transition-all"
                  />
                  <button type="submit" disabled={addingMotive || !newMotiveName.trim()}
                    className="px-4 py-3 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-700 disabled:opacity-40 transition-colors flex items-center gap-1.5 text-sm">
                    <Plus size={14} /> {addingMotive ? '…' : 'Agregar'}
                  </button>
                </form>

                <button onClick={() => setManagingMotives(false)}
                  className="w-full py-3 rounded-2xl border-2 border-gray-100 font-black text-gray-500 hover:bg-gray-50 transition-colors text-sm">
                  ← Volver al retiro
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* ── Confirm Dialog ── */}
    {pendingConfirm && (
      <ConfirmDialog
        message={pendingConfirm.message}
        confirmLabel="Cerrar Caja"
        danger={false}
        onConfirm={() => { pendingConfirm.onConfirm(); setPendingConfirm(null); }}
        onCancel={() => setPendingConfirm(null)}
      />
    )}
    </>
  );
};
