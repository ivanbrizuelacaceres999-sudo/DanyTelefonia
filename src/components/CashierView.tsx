import React, { useState, useEffect, useCallback } from 'react';
import {
  Search, ShoppingCart, Trash2, Package, Wrench,
  DollarSign, Play, XCircle, ArrowRight, Tag, Plus,
  AlertTriangle, Minus, CheckCircle, Printer, ArrowDownLeft,
  X, Settings2, ShoppingBag, MapPin, Zap
} from 'lucide-react';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { AnimatePresence, motion } from 'motion/react';
import { api } from '../api';
import { Product, Repair, Wholesaler, Sale, CashSession, UserProfile, CashWithdrawal, WithdrawalMotive, ReventaItem, ReventaSupplier, Category, Manufacturer } from '../types';
import { Modal } from './ui/Modal';
import { NumericInput } from './ui/NumericInput';
import { cn } from '../lib/utils';

interface CashierViewProps {
  user: UserProfile;
  products: Product[];
  repairs: Repair[];
  wholesalers: Wholesaler[];
  reventaItems?: ReventaItem[];
  reventaSuppliers?: ReventaSupplier[];
  categories: Category[];
  manufacturers: Manufacturer[];
  onRefresh: () => void;
  scanProduct?: Product | null;
  onScanHandled?: () => void;
}

interface QuickProductForm {
  model: string;
  categoryId: string;
  manufacturerId: string;
  costPrice: string;
  salePrice: string;
  priceWholesale: string;
  priceCheap: string;
  isEspecial: boolean;
  quantity: string;
  estante: string;
  columna: string;
  fila: string;
}

interface StockCompletionForm {
  productId: string;
  model: string;
  estante: string;
  columna: string;
  fila: string;
  quantity: string;
}

const parseLocation = (loc: string) => { const p = (loc || '').split('|'); return { estante: p[0] || '', columna: p[1] || '', fila: p[2] || '' }; };
const displayLocation = (loc: string) => {
  const { estante, columna, fila } = parseLocation(loc);
  const parts: string[] = [];
  if (estante) parts.push(`Est.${estante}`);
  if (columna) parts.push(`Col.${columna}`);
  if (fila)    parts.push(`Fila ${fila}`);
  return parts.join(' · ');
};

// Convierte cualquier valor a número seguro
const n = (v: any): number => {
  if (v === null || v === undefined || v === '') return 0;
  const x = Number(v);
  return isNaN(x) ? 0 : x;
};

type PriceType = 'normal' | 'wholesale' | 'cheap' | 'especial';

interface CartItem {
  id: string;
  type: 'product' | 'repair' | 'reventa';
  name: string;
  price: number;
  cost: number;
  quantity: number;
  priceType?: PriceType;
  supplierId?: string;
  isNew?: boolean;
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
  // Número corto para buscar: últimos 5 chars (diferente al barcode que usa 8)
  const ticketNum  = sale._id.slice(-5).toUpperCase();
  const barcodeId  = `VEN-${sale._id.slice(-8).toUpperCase()}`;

  const items = sale.items.map(item =>
    `<div style="display:flex;justify-content:space-between;margin-bottom:5px;font-size:13px">
      <span style="font-weight:700">${item.name} ×${item.quantity}</span>
      <span style="font-weight:900">Gs. ${(n(item.price) * item.quantity).toLocaleString()}</span>
    </div>`
  ).join('');

  const payments = (sale.payments && sale.payments.length > 1)
    ? `<div style="margin:8px 0;padding:8px;background:#f3f4f6;border-radius:8px">
        <p style="font-size:10px;font-weight:900;color:#374151;text-transform:uppercase;margin:0 0 4px">Formas de pago</p>
        ${sale.payments.map(p =>
          `<div style="display:flex;justify-content:space-between;font-size:11px;font-weight:700">
            <span>${METHOD_LABEL[p.method] || p.method}</span>
            <span>Gs. ${n(p.amount).toLocaleString()}</span>
          </div>`
        ).join('')}
      </div>`
    : '';

  const discount = n(sale.discount) > 0
    ? `<div style="display:flex;justify-content:space-between;font-size:11px;color:#374151;font-weight:700">
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
    body { font-family: Arial, sans-serif; width: 300px; padding: 20px 16px; color: #111; }
    @media print { body { width: 100%; } }
  </style>
</head>
<body>
  <!-- ENCABEZADO -->
  <div style="text-align:center;padding-bottom:14px;margin-bottom:14px;border-bottom:2px solid #d1d5db">
    <h1 style="font-size:20px;font-weight:900;letter-spacing:-0.5px;color:#111">Dany Telefonía</h1>
    <p style="font-size:9px;color:#9ca3af;text-transform:uppercase;letter-spacing:2px;margin:3px 0 10px">Ticket de Venta</p>
    <!-- Número de ticket corto para búsqueda -->
    <div style="background:#f3f4f6;border-radius:8px;padding:5px 14px;display:inline-block">
      <p style="font-size:8px;color:#9ca3af;text-transform:uppercase;letter-spacing:2px;margin:0 0 2px">N° Ticket</p>
      <p style="font-size:22px;font-weight:900;color:#111;margin:0;letter-spacing:-1px">#${ticketNum}</p>
    </div>
  </div>

  <!-- FECHA / HORA -->
  <div style="display:flex;justify-content:space-between;font-size:10px;color:#9ca3af;margin-bottom:10px">
    <span>Fecha: ${new Date(sale.date).toLocaleDateString('es-PY')}</span>
    <span>Hora: ${new Date(sale.date).toLocaleTimeString('es-PY',{hour:'2-digit',minute:'2-digit'})}</span>
  </div>

  <!-- CLIENTE -->
  ${sale.customerName && sale.customerName !== 'Consumidor Final'
    ? `<p style="font-size:12px;font-weight:700;margin-bottom:8px;color:#111">Cliente: ${sale.customerName}</p>`
    : ''}

  <!-- ITEMS -->
  <div style="margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid #e5e7eb">${items}</div>

  <!-- TOTALES -->
  <div>
    ${discount}
    ${payments}
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px;padding-top:6px;border-top:2px solid #111">
      <span style="font-size:13px;font-weight:900;text-transform:uppercase;letter-spacing:1px;color:#111">TOTAL</span>
      <span style="font-size:26px;font-weight:900;color:#111">Gs. ${n(sale.total).toLocaleString()}</span>
    </div>
    <p style="font-size:10px;color:#9ca3af;text-align:center;margin-top:16px;font-style:italic">¡Gracias por su compra! · Garantía incluida</p>
  </div>

  <!-- CÓDIGO DE BARRAS (solo para escanear, más pequeño) -->
  <div style="text-align:center;margin-top:16px;padding-top:12px;border-top:2px dashed #d1d5db">
    <p style="font-size:8px;font-weight:900;color:#9ca3af;text-transform:uppercase;letter-spacing:2px;margin-bottom:6px">Código de garantía</p>
    <svg id="ven-barcode" style="display:block;margin:0 auto"></svg>
    <p style="font-size:9px;font-weight:900;color:#374151;margin-top:3px;letter-spacing:1px">${barcodeId}</p>
    <p style="font-size:8px;color:#d1d5db;margin-top:1px">Escaneá para verificar garantía</p>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
  <script>
    window.onload = function(){
      try {
        JsBarcode("#ven-barcode", "${barcodeId}", {
          format: "CODE128", width: 1.3, height: 30,
          displayValue: false, margin: 2,
          lineColor: "#111"
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

export const CashierView = ({ user, products, repairs, wholesalers, reventaItems = [], reventaSuppliers = [], categories, manufacturers, onRefresh, scanProduct, onScanHandled }: CashierViewProps) => {
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

  // ── Nuevo diseño ────────────────────────────────────────────────
  const [catalogFilter, setCatalogFilter] = useState<'all' | 'products' | 'repairs' | 'reventas'>('all');
  const [mobileView,    setMobileView]    = useState<'catalog' | 'ticket'>('catalog');
  const [discountType,  setDiscountType]  = useState<'gs' | 'pct'>('gs');
  const [addModal, setAddModal] = useState<{
    type: 'product'; product: Product;
    qty: string; priceType: PriceType; pendingPrice: string;
  } | { type: 'repair'; repair: Repair } | { type: 'reventa'; item: ReventaItem; qty: string }
    | { type: 'new-reventa'; name: string; salePrice: string; costPrice: string; supplierId: string; qty: string } | null>(null);

  // ── Producto rápido desde caja ────────────────────────────────
  const [quickModal, setQuickModal] = useState<QuickProductForm | null>(null);
  const [quickCreating, setQuickCreating] = useState(false);
  const [quickCreatedIds, setQuickCreatedIds] = useState<string[]>([]);

  // ── Completar stock post-venta ────────────────────────────────
  const [stockCompletion, setStockCompletion]       = useState<StockCompletionForm | null>(null);
  const [pendingCompletions, setPendingCompletions] = useState<{ id: string; model: string }[]>([]);
  const [stockSaving, setStockSaving]               = useState(false);

  const handleQuickCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickModal) return;
    const sp = parseInt(quickModal.salePrice.replace(/\D/g, '')) || 0;
    const pw = parseInt(quickModal.priceWholesale.replace(/\D/g, '')) || 0;
    const pc = parseInt(quickModal.priceCheap.replace(/\D/g, '')) || 0;
    if (!quickModal.model.trim() || (!quickModal.isEspecial && sp === 0 && pw === 0 && pc === 0)) {
      setErrorMsg('Completá el nombre y al menos un precio de venta (o marcá Precio Especial).');
      return;
    }
    const qty = Math.max(1, parseInt(quickModal.quantity) || 1);
    setQuickCreating(true);
    try {
      const created = await api.createProduct({
        model: quickModal.model.trim().toUpperCase(),
        categoryId: quickModal.categoryId || null,
        manufacturerId: quickModal.manufacturerId || undefined,
        costPrice: parseInt(quickModal.costPrice.replace(/\D/g, '')) || 0,
        salePrice: sp,
        priceWholesale: pw,
        priceCheap: pc,
        quantity: qty,
        purchasedQuantity: qty,
        location: [quickModal.estante, quickModal.columna, quickModal.fila].join('|'),
        isWholesale: false,
        barcode: '',
      });
      const cartPrice = quickModal.isEspecial ? 0 : (sp > 0 ? sp : pw > 0 ? pw : pc);
      const priceType: PriceType = quickModal.isEspecial ? 'especial' : (sp > 0 ? 'normal' : pw > 0 ? 'wholesale' : 'cheap');
      setCart(prev => [...prev, {
        id: created._id,
        type: 'product' as const,
        name: created.model,
        price: cartPrice,
        cost: parseInt(quickModal.costPrice.replace(/\D/g, '')) || 0,
        quantity: 1,
        priceType,
      }]);
      setQuickCreatedIds(prev => [...prev, created._id]);
      setQuickModal(null);
      setErrorMsg('');
      onRefresh();
      if (window.innerWidth < 768) setMobileView('ticket');
    } catch (err: any) {
      setErrorMsg('Error al crear producto: ' + (err?.message ?? 'Error desconocido'));
    } finally {
      setQuickCreating(false);
    }
  };

  const openNextStockCompletion = (remaining: { id: string; model: string }[]) => {
    if (remaining.length === 0) { setStockCompletion(null); return; }
    const [next, ...rest] = remaining;
    setStockCompletion({ productId: next.id, model: next.model, estante: '', columna: '', fila: '', quantity: '' });
    setPendingCompletions(rest);
  };

  const handleStockCompletion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockCompletion) return;
    setStockSaving(true);
    try {
      const loc = [stockCompletion.estante, stockCompletion.columna, stockCompletion.fila].join('|');
      await api.updateProduct(stockCompletion.productId, {
        location: loc,
        quantity: parseInt(stockCompletion.quantity) || 0,
      });
      onRefresh();
      openNextStockCompletion(pendingCompletions);
    } catch (err: any) {
      alert('Error al guardar: ' + (err?.message ?? 'Error'));
    } finally {
      setStockSaving(false);
    }
  };

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
  const discountN = discountType === 'pct'
    ? Math.round(subtotal * (parseFloat(discount) || 0) / 100)
    : parseInt(discount) || 0;
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
    setPayments(prev => {
      const updated = prev.map((p, i) => i === idx ? { ...p, [field]: value } : p);
      if (field === 'method' && value === 'credit') {
        const otherPaid = updated.filter((_, i) => i !== idx).reduce((s, p) => s + (parseInt(p.amount) || 0), 0);
        const remaining = Math.max(0, total - otherPaid);
        return updated.map((p, i) => i === idx ? { ...p, amount: String(remaining) } : p);
      }
      return updated;
    });

  const hasPendingSpecial = cart.some(i => i.priceType === 'especial' && i.price === 0);

  const checkout = async () => {
    if (cart.length === 0) { setErrorMsg('El carrito está vacío.'); return; }
    if (!hasPendingSpecial && totalPaid < total) { setErrorMsg(`Falta cubrir Gs. ${resta.toLocaleString()} para completar el pago.`); return; }

    // Capturar productos rápidos de este carrito ANTES de vaciarlo
    const quickSold = cart.filter(i => quickCreatedIds.includes(i.id));

    setIsProcessing(true); setErrorMsg(''); setSuccessMsg('');
    try {
      let paymentsData: { method: string; amount: number }[];
      if (hasPendingSpecial && total === 0) {
        paymentsData = wholesalerId
          ? [{ method: 'credit', amount: 0 }]
          : [{ method: 'cash', amount: 0 }];
      } else {
        paymentsData = payments
          .filter(p => parseInt(p.amount) > 0)
          .map(p => ({ method: p.method, amount: parseInt(p.amount) }));
      }

      const paymentMethod = paymentsData.length === 1 ? paymentsData[0].method : 'mixed';

      const sale = await api.createSale({
        items: cart.map(i => ({ id: i.isNew ? '' : i.id, type: i.type, name: i.name, price: i.price, cost: i.cost, quantity: i.quantity, supplierId: i.supplierId })),
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

      // ── Registrar ítems de precio especial (todos, con o sin precio) ──
      const specialItemsInCart = cart.filter(i => i.priceType === 'especial');
      if (specialItemsInCart.length > 0) {
        const wsName = wholesalerId ? wholesalers.find(w => w._id === wholesalerId)?.name : undefined;
        for (const si of specialItemsInCart) {
          try {
            await (api as any).createSpecialPriceItem({
              saleId: sale._id,
              productId: si.type === 'product' ? si.id : undefined,
              productName: si.name,
              quantity: si.quantity,
              specialPrice: si.price > 0 ? si.price : undefined,
              wholesalerId: wholesalerId || undefined,
              wholesalerName: wsName,
              saleDate: sale.date,
            });
          } catch { /* non-fatal */ }
        }
      }

      setCart([]); setDiscount(''); setWholesalerId(''); setCustomerName('');
      setPayments([{ method: 'cash', amount: '' }]);
      setSuccessMsg(`✓ Venta registrada · Gs. ${n(sale.total).toLocaleString()}`);
      onRefresh(); loadSession();
      printTicket(sale);

      // ── Lanzar completar stock para productos rápidos ──
      if (quickSold.length > 0) {
        setQuickCreatedIds([]);
        const [first, ...rest] = quickSold;
        setStockCompletion({ productId: first.id, model: first.name, estante: '', columna: '', fila: '', quantity: '' });
        setPendingCompletions(rest.map(i => ({ id: i.id, model: i.name })));
      }
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
    try {
      await (api as any).deleteCashWithdrawal(id);
      if (session?._id) loadWithdrawals(String(session._id));
    } catch (err: any) {
      alert('Error al eliminar el retiro: ' + (err?.message ?? 'Error desconocido'));
    }
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
    try {
      await (api as any).deleteWithdrawalMotive(id);
      loadMotives();
    } catch (err: any) {
      alert('Error al eliminar el motivo: ' + (err?.message ?? 'Error desconocido'));
    }
  };

  const allMotives = customMotives.map(m => ({ id: m._id, name: m.name }));

  const hasLocation = (p: Product) =>
    (p.location || '').replace(/\|/g, '').trim().length > 0;

  const filteredProducts = products.filter(p =>
    n(p.quantity) > 0 &&
    hasLocation(p) &&
    (!searchTerm || p.model.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  // Solo reparaciones con estado 'listo' — se entregan al cobrar
  const readyRepairs = repairs.filter(r =>
    r.status === 'ready' &&
    (!searchTerm || r.deviceModel.toLowerCase().includes(searchTerm.toLowerCase()) ||
     r.customerName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredReventa = reventaItems.filter(r =>
    n(r.quantity) > 0 && (!searchTerm || r.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // ── Catálogo unificado según filtro ─────────────────────────────
  const catalogItems: ({ kind: 'product'; data: Product } | { kind: 'repair'; data: Repair } | { kind: 'reventa'; data: ReventaItem })[] = [
    ...(catalogFilter !== 'repairs' && catalogFilter !== 'reventas' ? filteredProducts.map(p => ({ kind: 'product' as const, data: p })) : []),
    ...(catalogFilter !== 'products' && catalogFilter !== 'reventas' ? readyRepairs.map(r => ({ kind: 'repair' as const, data: r })) : []),
    ...(catalogFilter !== 'products' && catalogFilter !== 'repairs' ? filteredReventa.map(r => ({ kind: 'reventa' as const, data: r })) : []),
  ];

  // ── Agregar producto desde modal ─────────────────────────────────
  const addFromModal = async () => {
    if (!addModal) return;
    if (addModal.type === 'new-reventa') {
      const qty = Math.max(1, parseInt(addModal.qty) || 1);
      const salePrice = parseInt(addModal.salePrice.replace(/\D/g, '')) || 0;
      if (!addModal.name.trim() || salePrice === 0) return;
      const costPrice = parseInt(addModal.costPrice.replace(/\D/g, '')) || 0;
      setCart(prev => [...prev, {
        id: `__rev__${Date.now()}`,
        type: 'reventa' as const,
        name: addModal.name.trim(),
        price: salePrice,
        cost: costPrice,
        quantity: qty,
        supplierId: addModal.supplierId || undefined,
        isNew: true,
      }]);
      setAddModal(null); setErrorMsg('');
      if (window.innerWidth < 768) setMobileView('ticket');
      return;
    }
    if (addModal.type === 'reventa') {
      const r = addModal.item;
      const quantity = Math.max(1, parseInt(addModal.qty) || 1);
      if (cart.find(i => i.id === r._id)) { setAddModal(null); return; }
      if (n(r.quantity) < quantity) { setErrorMsg(`Stock insuficiente: solo ${r.quantity} unidades.`); return; }
      setCart(prev => [...prev, {
        id: r._id, type: 'reventa' as const,
        name: r.name, price: n(r.salePrice), cost: n(r.costPrice), quantity,
      }]);
      setAddModal(null); setErrorMsg('');
      if (window.innerWidth < 768) setMobileView('ticket');
      return;
    }
    if (addModal.type === 'repair') {
      const r = addModal.repair;
      if (cart.find(i => i.id === r._id)) { setAddModal(null); return; }
      const partsCost = (r.partsUsed || []).reduce((s: number, p: any) => s + (n(p.cost || 0) * (p.quantity || 1)), 0);
      setCart(prev => [...prev, { id: r._id, type: 'repair', name: `${r.deviceModel} — ${r.customerName}`, price: n(r.totalCost), cost: partsCost, quantity: 1 }]);
      setAddModal(null);
      return;
    }
    const p = addModal.product;
    const quantity = Math.max(1, parseInt(addModal.qty) || 1);
    const stock = n(p.quantity);
    const hasNoPrice = n(p.salePrice) === 0 && n(p.priceWholesale) === 0 && n(p.priceCheap) === 0;

    // Precio Especial: agregar con precio a definir (no guarda en DB)
    if (addModal.priceType === 'especial') {
      const price = parseInt((addModal.pendingPrice || '').replace(/\D/g, '')) || 0;
      if (stock < quantity) { setErrorMsg(`Stock insuficiente: solo ${stock} unidades.`); return; }
      setCart(prev => {
        const ex = prev.find(i => i.id === p._id && i.type === 'product');
        if (ex) {
          if (stock < ex.quantity + quantity) { setErrorMsg('Stock insuficiente'); return prev; }
          return prev.map(i => i.id === p._id ? { ...i, quantity: i.quantity + quantity } : i);
        }
        return [...prev, { id: p._id, type: 'product', name: p.model, price, cost: n(p.costPrice), quantity, priceType: 'especial' as PriceType }];
      });
      setAddModal(null); setErrorMsg('');
      if (window.innerWidth < 768) setMobileView('ticket');
      return;
    }

    // Si no tiene precio, guardar el precio ingresado en la DB
    if (hasNoPrice) {
      const newPrice = parseInt((addModal.pendingPrice || '').replace(/\D/g, '')) || 0;
      if (newPrice === 0) { setErrorMsg('Ingresá un precio de venta para continuar.'); return; }
      const priceField = addModal.priceType === 'wholesale' ? { priceWholesale: newPrice }
        : addModal.priceType === 'cheap'     ? { priceCheap: newPrice }
        : { salePrice: newPrice };
      try {
        await api.updateProduct(p._id, priceField);
        onRefresh();
        // Actualizar p localmente para el carrito
        Object.assign(p, priceField);
      } catch { setErrorMsg('Error al guardar el precio.'); return; }
    }

    const price =
      addModal.priceType === 'wholesale' && n(p.priceWholesale) > 0 ? n(p.priceWholesale) :
      addModal.priceType === 'cheap'     && n(p.priceCheap)     > 0 ? n(p.priceCheap)     :
      n(p.salePrice);
    if (price === 0) { setErrorMsg('Este producto no tiene precio configurado. Establecé un precio antes de vender.'); return; }
    if (stock < quantity) { setErrorMsg(`Stock insuficiente: solo ${stock} unidades.`); return; }
    setCart(prev => {
      const ex = prev.find(i => i.id === p._id && i.type === 'product');
      if (ex) {
        if (stock < ex.quantity + quantity) { setErrorMsg(`Stock insuficiente`); return prev; }
        return prev.map(i => i.id === p._id ? { ...i, quantity: i.quantity + quantity } : i);
      }
      return [...prev, { id: p._id, type: 'product', name: p.model, price, cost: n(p.costPrice), quantity, priceType: addModal.priceType }];
    });
    setAddModal(null);
    setErrorMsg('');
    // En mobile, ir al ticket automáticamente al agregar
    if (window.innerWidth < 768) setMobileView('ticket');
  };

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
    {/* NUEVO DISEÑO POS */}
    <div className="flex flex-col -m-4 md:-m-8 lg:-m-12" style={{height:'calc(100dvh - 5rem)'}}>

      {/* ── HEADER DESKTOP ── */}
      <div className="hidden md:flex items-center justify-between px-6 py-3.5 border-b border-gray-100 shrink-0 bg-white">
        <div className="flex items-center gap-3">
          <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse shrink-0" />
          <div>
            <h2 className="text-lg font-black text-gray-800 tracking-tighter leading-none">Caja Abierta</h2>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
              {session.openedBy?.name} · {new Date(session.openedAt).toLocaleDateString('es-PY', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="bg-emerald-50 px-4 py-2 rounded-2xl text-right">
            <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Efectivo en Caja</p>
            <p className="font-black text-emerald-700 text-sm">Gs. {cashInBox.toLocaleString()}</p>
            {totalWithdrawn > 0 && <p className="text-[8px] font-bold text-red-400">-Gs. {totalWithdrawn.toLocaleString()} retirado</p>}
          </div>
          <button onClick={() => { setShowWithdrawal(true); setErrorMsg(''); }}
            className="bg-orange-50 text-orange-600 font-black px-4 py-2.5 rounded-2xl hover:bg-orange-500 hover:text-white transition-all flex items-center gap-2 border border-orange-100 text-sm cursor-pointer">
            <ArrowDownLeft size={15} /> Retiro
          </button>
          <button onClick={closeSession}
            className="bg-red-50 text-red-500 font-black px-4 py-2.5 rounded-2xl hover:bg-red-500 hover:text-white transition-all flex items-center gap-2 text-sm cursor-pointer">
            <XCircle size={15} /> Cerrar Caja
          </button>
        </div>
      </div>

      {/* ── HEADER MOBILE (compacto) ── */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0 bg-white">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shrink-0" />
          <div>
            <h2 className="text-base font-black text-gray-800 tracking-tighter leading-none">Caja Abierta</h2>
            <p className="text-[9px] font-bold text-emerald-600 mt-0.5">
              Gs. {cashInBox.toLocaleString()} en caja
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setShowWithdrawal(true); setErrorMsg(''); }}
            className="w-9 h-9 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center border border-orange-100 cursor-pointer active:scale-95 transition-all"
            title="Retiro">
            <ArrowDownLeft size={17} />
          </button>
          <button onClick={closeSession}
            className="w-9 h-9 bg-red-50 text-red-500 rounded-xl flex items-center justify-center cursor-pointer active:scale-95 transition-all"
            title="Cerrar Caja">
            <XCircle size={17} />
          </button>
        </div>
      </div>

      {/* ── BUSCADOR + TABS ── */}
      <div className="px-4 md:px-6 py-3 border-b border-gray-100 shrink-0 bg-white flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
          <input type="text" placeholder="Buscar producto o reparacion..." value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); setErrorMsg(''); }}
            className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-2.5 pl-9 pr-4 outline-none font-bold text-gray-700 text-sm focus:bg-white focus:border-indigo-300 transition-all" />
        </div>
        <div className="flex gap-1 md:gap-1.5 shrink-0">
          {(['all', 'products', 'repairs', 'reventas'] as const).map(f => (
            <button key={f} onClick={() => setCatalogFilter(f)}
              className={cn('flex-1 md:flex-none px-3 md:px-4 py-2 rounded-2xl font-black text-xs transition-all cursor-pointer',
                catalogFilter === f ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200')}>
              {f === 'all' ? 'Todo' : f === 'products' ? 'Prod.' : f === 'repairs' ? 'Rep.' : 'Rev.'}
              <span className="hidden md:inline">{f === 'products' ? 'uctos' : f === 'repairs' ? 'araciones' : f === 'reventas' ? 'entas' : ''}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── TABS MOBILE: Catálogo / Ticket ── */}
      <div className="md:hidden flex shrink-0 bg-white border-b border-gray-100">
        <button onClick={() => setMobileView('catalog')}
          className={cn('flex-1 py-2.5 text-xs font-black transition-colors border-b-2',
            mobileView === 'catalog'
              ? 'text-indigo-600 border-indigo-600'
              : 'text-gray-400 border-transparent')}>
          Catálogo <span className="text-[10px] font-bold text-gray-400">({catalogItems.length})</span>
        </button>
        <button onClick={() => setMobileView('ticket')}
          className={cn('flex-1 py-2.5 text-xs font-black transition-colors border-b-2 flex items-center justify-center gap-1.5',
            mobileView === 'ticket'
              ? 'text-indigo-600 border-indigo-600'
              : 'text-gray-400 border-transparent')}>
          Ticket
          {cart.length > 0 && (
            <span className="w-5 h-5 bg-indigo-600 text-white text-[10px] font-black rounded-full flex items-center justify-center">
              {cart.length}
            </span>
          )}
        </button>
      </div>

      {/* MAIN: CATALOGO + TICKET */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* CATALOGO */}
        <div className={cn(
          'border-r border-gray-100 flex-col min-h-0 bg-gray-50/40',
          // Desktop: siempre visible, 42%
          'md:flex md:w-[42%]',
          // Mobile: visible solo si mobileView === catalog
          mobileView === 'catalog' ? 'flex flex-1' : 'hidden',
        )}>
          <div className="px-5 py-3 flex items-center justify-between shrink-0">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Catalogo</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setQuickModal({ model: '', categoryId: '', manufacturerId: '', costPrice: '', salePrice: '', priceWholesale: '', priceCheap: '', isEspecial: false, quantity: '1', estante: '', columna: '', fila: '' })}
                className="text-[10px] font-black text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-xl flex items-center gap-1 transition-colors cursor-pointer border border-indigo-200">
                <Zap size={10} /> Nuevo Prod.
              </button>
              <button
                onClick={() => setAddModal({ type: 'new-reventa', name: '', salePrice: '', costPrice: '', supplierId: '', qty: '1' })}
                className="text-[10px] font-black text-orange-500 bg-orange-50 hover:bg-orange-100 px-2.5 py-1 rounded-xl flex items-center gap-1 transition-colors cursor-pointer border border-orange-200">
                <Plus size={10} /> Reventa
              </button>
              <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{catalogItems.length}</span>
            </div>
          </div>
          <div className="overflow-y-auto flex-1 px-4 pb-4">
            {catalogItems.length === 0 ? (
              <div className="text-center py-16 text-gray-300">
                <Package size={32} className="mx-auto mb-2" />
                <p className="font-bold text-xs uppercase tracking-widest">Sin resultados</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {catalogItems.map(item => {
                  if (item.kind === 'product') {
                    const p = item.data;
                    const inCart = !!cart.find(c => c.id === p._id);
                    return (
                      <button key={p._id}
                        onClick={() => setAddModal({ type: 'product', product: p, qty: '1', priceType: 'normal', pendingPrice: '' })}
                        className={cn('flex flex-col p-4 rounded-2xl border text-left transition-all cursor-pointer active:scale-[0.98] hover:shadow-md',
                          inCart ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-gray-200 hover:border-indigo-200')}>
                        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center mb-3',
                          inCart ? 'bg-indigo-600 text-white' : 'bg-indigo-100 text-indigo-600')}>
                          <Package size={18} />
                        </div>
                        <p className="font-black text-gray-800 text-sm leading-snug">{p.model}</p>
                        <p className="text-[10px] font-bold text-gray-400 mt-0.5">Stock: {p.quantity}</p>
                        {displayLocation(p.location || '') && (
                          <p className="text-[9px] font-bold text-indigo-400 mt-0.5 flex items-center gap-0.5 truncate">
                            <MapPin size={8} className="shrink-0" />{displayLocation(p.location || '')}
                          </p>
                        )}
                        <p className="font-black text-emerald-600 mt-2 text-sm">Gs. {n(p.salePrice).toLocaleString()}</p>
                      </button>
                    );
                  } else if (item.kind === 'repair') {
                    const r = item.data;
                    const inCart = !!cart.find(c => c.id === r._id);
                    return (
                      <button key={r._id}
                        onClick={() => { if (!inCart) setAddModal({ type: 'repair', repair: r }); }}
                        disabled={inCart}
                        className={cn('flex flex-col p-4 rounded-2xl border text-left transition-all active:scale-[0.98] hover:shadow-md',
                          inCart ? 'bg-emerald-50 border-emerald-200 cursor-default opacity-70' : 'bg-white border-gray-200 hover:border-amber-200 cursor-pointer')}>
                        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center mb-3',
                          inCart ? 'bg-emerald-500 text-white' : 'bg-amber-100 text-amber-600')}>
                          <Wrench size={18} />
                        </div>
                        <p className="font-black text-gray-800 text-sm leading-snug truncate">{r.deviceModel}</p>
                        <p className="text-[10px] font-bold text-gray-400 mt-0.5 truncate">{r.customerName}</p>
                        {(r.shelfId || r.workbenchId) && (
                          <p className="text-[9px] font-bold text-amber-500 mt-0.5 flex items-center gap-0.5">
                            <MapPin size={8} className="shrink-0" />{r.shelfId ? 'En estante' : 'En mesa de trabajo'}
                          </p>
                        )}
                        <p className="font-black text-emerald-600 mt-2 text-sm">Gs. {n(r.totalCost).toLocaleString()}</p>
                        {inCart && <span className="mt-1 text-[9px] font-black text-emerald-600">En ticket</span>}
                      </button>
                    );
                  } else {
                    const r = item.data;
                    const inCart = !!cart.find(c => c.id === r._id);
                    return (
                      <button key={r._id}
                        onClick={() => setAddModal({ type: 'reventa', item: r, qty: '1' })}
                        className={cn('flex flex-col p-4 rounded-2xl border text-left transition-all active:scale-[0.98] hover:shadow-md cursor-pointer',
                          inCart ? 'bg-orange-50 border-orange-200' : 'bg-white border-gray-200 hover:border-orange-200')}>
                        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center mb-3',
                          inCart ? 'bg-orange-500 text-white' : 'bg-orange-100 text-orange-600')}>
                          <ShoppingBag size={18} />
                        </div>
                        <p className="font-black text-gray-800 text-sm leading-snug">{r.name}</p>
                        <p className="text-[10px] font-bold text-gray-400 mt-0.5">Stock: {r.quantity}</p>
                        <p className="font-black text-orange-600 mt-2 text-sm">Gs. {n(r.salePrice).toLocaleString()}</p>
                        {inCart && <span className="mt-1 text-[9px] font-black text-orange-600">En ticket</span>}
                      </button>
                    );
                  }
                })}
              </div>
            )}
          </div>
        </div>

        {/* TICKET DE VENTA */}
        <div className={cn(
          'flex-col min-h-0 bg-white',
          // Desktop: siempre visible, flex-1
          'md:flex md:flex-1',
          // Mobile: visible solo si mobileView === ticket
          mobileView === 'ticket' ? 'flex flex-1' : 'hidden',
        )}>
          <div className="px-6 py-3 flex items-center justify-between shrink-0 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <ShoppingCart size={15} className="text-indigo-600" />
              <p className="font-black text-gray-800 text-sm">Ticket de venta</p>
              <span className="text-[10px] font-bold text-gray-400">{cart.length} items · {cart.reduce((a,i)=>a+i.quantity,0)} u.</span>
            </div>
            {cart.length > 0 && (
              <button onClick={() => setCart([])}
                className="text-[11px] font-black text-red-400 hover:text-red-600 px-3 py-1 rounded-xl hover:bg-red-50 transition-colors cursor-pointer">
                Vaciar
              </button>
            )}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-6">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-300 py-12">
                <ShoppingCart size={40} />
                <p className="font-black text-sm uppercase tracking-widest">Ticket vacio</p>
                <p className="text-xs font-bold">Selecciona del catalogo</p>
              </div>
            ) : cart.map(item => (
              <div key={item.id} className="py-4 border-b border-gray-100 last:border-0">
                <div className="flex items-center gap-2">
                  <p className="font-black text-gray-900 text-[15px] flex-1 truncate leading-snug">{item.name}</p>
                  {item.priceType && item.priceType !== 'normal' && (
                    <span className={cn('text-[9px] font-black px-2 py-0.5 rounded-full uppercase shrink-0',
                      item.priceType === 'wholesale' ? 'bg-purple-100 text-purple-600'
                      : item.priceType === 'especial' ? 'bg-pink-100 text-pink-600'
                      : 'bg-orange-100 text-orange-600')}>
                      {item.priceType === 'wholesale' ? 'MAYORISTA' : item.priceType === 'especial' ? 'ESPECIAL' : 'ECONOMICO'}
                    </span>
                  )}
                  <div className="flex-1 mx-2 border-b border-dashed border-gray-200 min-w-[16px]" />
                  <p className="font-black text-emerald-600 text-[15px] shrink-0">Gs. {(n(item.price) * item.quantity).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-3 mt-2">
                  {item.type !== 'repair' ? (
                    <div className="flex items-center gap-2">
                      <button onClick={() => changeQty(item.id, -1)}
                        className="w-6 h-6 bg-gray-100 hover:bg-red-100 hover:text-red-600 rounded-lg flex items-center justify-center text-gray-500 font-black text-sm transition-colors cursor-pointer">
                        -
                      </button>
                      <span className="font-black text-gray-900 w-5 text-center text-sm">{item.quantity}</span>
                      <button onClick={() => changeQty(item.id, 1)}
                        className="w-6 h-6 bg-gray-100 hover:bg-indigo-100 hover:text-indigo-600 rounded-lg flex items-center justify-center text-gray-500 font-black text-sm transition-colors cursor-pointer">
                        +
                      </button>
                    </div>
                  ) : (
                    <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg">Servicio</span>
                  )}
                  {item.type === 'reventa' && (
                    <span className="text-[9px] font-black bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">REVENTA</span>
                  )}
                  <p className="text-[11px] font-bold text-gray-400">Gs. {n(item.price).toLocaleString()} c/u</p>
                  <div className="flex-1" />
                  <button onClick={() => removeItem(item.id)}
                    className="text-gray-300 hover:text-red-500 transition-colors cursor-pointer">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {errorMsg && (
            <div className="mx-5 mb-2 flex items-center gap-2 p-2.5 bg-red-50 border border-red-100 rounded-xl text-red-600 font-bold text-xs shrink-0">
              <AlertTriangle size={13} /> {errorMsg}
            </div>
          )}
          {successMsg && (
            <div className="mx-5 mb-2 flex items-center gap-2 p-2.5 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-700 font-bold text-xs shrink-0">
              <CheckCircle size={13} /> {successMsg}
            </div>
          )}
        </div>
      </div>

      {/* ── BARRA INFERIOR MOBILE ── */}
      <div className="md:hidden shrink-0 border-t-2 border-gray-100 bg-white px-4 py-3 space-y-3">

        {/* Fila 1: Cliente + Descuento */}
        <div className="flex gap-3">
          <div className="flex-1 space-y-1">
            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block">Cliente</label>
            <select value={wholesalerId || ''}
              onChange={e => { setWholesalerId(e.target.value); if (e.target.value) setCustomerName(''); }}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-2.5 outline-none font-bold text-xs text-gray-700 focus:border-indigo-400 cursor-pointer">
              <option value="">Consumidor Final</option>
              {wholesalers.map(w => <option key={w._id} value={w._id}>{w.name}</option>)}
            </select>
          </div>
          <div className="space-y-1 shrink-0">
            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block">Descuento</label>
            <div className="flex items-center gap-1">
              <NumericInput value={discount} onChange={raw => setDiscount(raw)}
                className="w-14 bg-gray-50 border border-gray-200 rounded-xl py-2 px-2 text-sm font-black text-center text-gray-700 outline-none focus:border-indigo-400" />
              <div className="flex rounded-xl overflow-hidden border border-gray-200">
                <button onClick={() => setDiscountType('pct')}
                  className={cn('px-2 py-2 text-[10px] font-black cursor-pointer', discountType === 'pct' ? 'bg-indigo-600 text-white' : 'bg-gray-50 text-gray-500')}>%</button>
                <button onClick={() => setDiscountType('gs')}
                  className={cn('px-2 py-2 text-[10px] font-black cursor-pointer border-l border-gray-200', discountType === 'gs' ? 'bg-indigo-600 text-white' : 'bg-gray-50 text-gray-500')}>Gs</button>
              </div>
            </div>
          </div>
        </div>

        {/* Fila 2: Forma de pago */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Forma de Pago</label>
            <button onClick={addPaymentRow} className="text-[9px] font-black text-indigo-500 cursor-pointer">+ pago</button>
          </div>
          {payments.map((p, idx) => (
            <div key={idx} className="flex gap-1.5 items-center">
              <select value={p.method} onChange={e => updatePayment(idx, 'method', e.target.value)}
                className="flex-1 bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-2 text-xs font-bold text-gray-700 outline-none cursor-pointer">
                <option value="cash">Efectivo</option>
                <option value="credit_card">T. Crédito</option>
                <option value="debit_card">T. Débito</option>
                <option value="transfer">Transferencia</option>
                <option value="qr">QR</option>
                <option value="credit">Cta. May.</option>
              </select>
              {p.method === 'credit' ? (
                <div className="w-28 bg-red-50 border border-red-100 rounded-xl py-2.5 px-2 text-sm font-black text-red-500 text-center">
                  Gs. {n(p.amount).toLocaleString()}
                </div>
              ) : (
                <NumericInput value={p.amount} placeholder="Monto"
                  onChange={raw => updatePayment(idx, 'amount', raw)}
                  className="w-28 bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-2 text-base font-black text-gray-700 outline-none text-center focus:border-indigo-400" />
              )}
              {payments.length > 1 && (
                <button onClick={() => removePaymentRow(idx)} className="text-gray-300 hover:text-red-500 cursor-pointer"><Trash2 size={13} /></button>
              )}
            </div>
          ))}
          {total > 0 && totalPaid > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                <div className={cn('h-1.5 rounded-full transition-all', totalPaid >= total ? 'bg-emerald-500' : 'bg-indigo-400')}
                  style={{width:`${Math.min(100,(totalPaid/total)*100)}%`}} />
              </div>
              <span className="text-[10px] font-black shrink-0">
                {resta > 0 ? <span className="text-amber-600">Falta Gs. {resta.toLocaleString()}</span>
                  : vuelto > 0 ? <span className="text-emerald-600">Vuelto Gs. {vuelto.toLocaleString()}</span>
                  : <span className="text-emerald-600">✓ Completo</span>}
              </span>
            </div>
          )}
        </div>

        {/* Fila 3: Total + Finalizar */}
        <div className="flex items-center gap-3">
          <div>
            <p className={cn("text-[10px] text-gray-400 font-bold line-through leading-none", discountN === 0 && "invisible")}>
              Gs. {subtotal.toLocaleString()}
            </p>
            <p className="text-2xl font-black text-gray-900 tracking-tighter leading-none">Gs. {total.toLocaleString()}</p>
          </div>
          <button onClick={checkout}
            disabled={cart.length === 0 || isProcessing || (!hasPendingSpecial && (totalPaid < total || total === 0))}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-black py-3.5 rounded-2xl shadow-lg shadow-indigo-200 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:shadow-none cursor-pointer text-sm">
            {isProcessing
              ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Procesando...</>
              : <><Printer size={15} /> Finalizar Venta</>
            }
          </button>
        </div>
      </div>

      {/* ── BARRA INFERIOR DESKTOP (sin cambios) ── */}
      <div className="hidden md:flex shrink-0 border-t-2 border-gray-100 bg-white px-6 py-4 items-end gap-5">

        {/* Cliente */}
        <div className="space-y-1.5 w-36 shrink-0">
          <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block">Cliente</label>
          <select value={wholesalerId || ''}
            onChange={e => { setWholesalerId(e.target.value); if (e.target.value) setCustomerName(''); }}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-2.5 outline-none font-bold text-xs text-gray-700 focus:border-indigo-400 cursor-pointer">
            <option value="">Consumidor Final</option>
            {wholesalers.map(w => <option key={w._id} value={w._id}>{w.name}</option>)}
          </select>
        </div>

        {/* Forma de pago */}
        <div className="space-y-1.5 shrink-0 w-56">
          <div className="flex items-center gap-2">
            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Forma de Pago</label>
            <button onClick={addPaymentRow} className="text-[9px] font-black text-indigo-500 hover:text-indigo-700 cursor-pointer">+ pago</button>
          </div>
          <div className="space-y-2">
            {payments.map((p, idx) => (
              <div key={idx} className="flex flex-col gap-1">
                <div className="flex gap-1 items-center">
                  <select value={p.method} onChange={e => updatePayment(idx, 'method', e.target.value)}
                    className="flex-1 bg-gray-50 border border-gray-200 rounded-xl py-2 px-2 text-xs font-bold text-gray-700 outline-none focus:border-indigo-400 cursor-pointer">
                    <option value="cash">Efectivo</option>
                    <option value="credit_card">T. Crédito</option>
                    <option value="debit_card">T. Débito</option>
                    <option value="transfer">Transfer.</option>
                    <option value="qr">QR</option>
                    <option value="credit">Cta. May.</option>
                  </select>
                  {payments.length > 1 && (
                    <button onClick={() => removePaymentRow(idx)} className="text-gray-300 hover:text-red-500 cursor-pointer shrink-0"><Trash2 size={11} /></button>
                  )}
                </div>
                {p.method === 'credit' ? (
                  <div className="w-full bg-red-50 border border-red-100 rounded-xl py-2 px-2 text-sm font-black text-red-500 text-center">
                    Gs. {n(p.amount).toLocaleString()}
                  </div>
                ) : (
                  <NumericInput value={p.amount} placeholder="Monto"
                    onChange={raw => updatePayment(idx, 'amount', raw)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 px-2 text-sm font-black text-gray-700 outline-none text-center focus:border-indigo-400" />
                )}
              </div>
            ))}
          </div>
          {total > 0 && totalPaid > 0 && (
            <div className="flex items-center gap-2 pt-0.5">
              <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                <div className={cn('h-1.5 rounded-full transition-all', totalPaid >= total ? 'bg-emerald-500' : 'bg-indigo-400')}
                  style={{width:`${Math.min(100,(totalPaid/total)*100)}%`}} />
              </div>
              <span className="text-[9px] font-black shrink-0">
                {resta > 0 ? <span className="text-amber-600">Falta Gs. {resta.toLocaleString()}</span>
                  : vuelto > 0 ? <span className="text-emerald-600">Vuelto Gs. {vuelto.toLocaleString()}</span>
                  : <span className="text-emerald-600">Completo</span>}
              </span>
            </div>
          )}
        </div>

        {/* Descuento */}
        <div className="shrink-0">
          <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1.5">Descuento</label>
          <div className="flex items-center gap-1.5">
            <NumericInput value={discount} onChange={raw => setDiscount(raw)}
              className="w-16 bg-gray-50 border border-gray-200 rounded-xl py-2 px-2 text-sm font-black text-center text-gray-700 outline-none focus:border-indigo-400" />
            <div className="flex rounded-xl overflow-hidden border border-gray-200">
              <button onClick={() => setDiscountType('pct')}
                className={cn('px-2.5 py-2 text-[10px] font-black transition-colors cursor-pointer',
                  discountType === 'pct' ? 'bg-indigo-600 text-white' : 'bg-gray-50 text-gray-500 hover:bg-gray-100')}>
                %
              </button>
              <button onClick={() => setDiscountType('gs')}
                className={cn('px-2.5 py-2 text-[10px] font-black transition-colors cursor-pointer border-l border-gray-200',
                  discountType === 'gs' ? 'bg-indigo-600 text-white' : 'bg-gray-50 text-gray-500 hover:bg-gray-100')}>
                Gs
              </button>
            </div>
          </div>
          {/* Espacio fijo para evitar layout shift — siempre ocupa altura */}
          <p className={cn("text-[9px] font-bold text-red-500 text-center mt-1.5 h-3 leading-3", discountN === 0 && "invisible")}>
            -{discountN > 0 ? `Gs. ${discountN.toLocaleString()}` : '—'}
          </p>
        </div>

        {/* Total + Finalizar */}
        <div className="ml-auto flex items-center gap-5 shrink-0">
          <div className="text-right">
            {/* Espacio fijo para evitar layout shift en el total */}
            <p className={cn("text-xs text-gray-400 font-bold line-through h-4 leading-4", discountN === 0 && "invisible")}>
              Gs. {subtotal.toLocaleString()}
            </p>
            <p className="text-3xl font-black text-gray-900 tracking-tighter leading-none">Gs. {total.toLocaleString()}</p>
          </div>
          <button onClick={checkout}
            disabled={cart.length === 0 || isProcessing || (!hasPendingSpecial && (totalPaid < total || total === 0))}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-7 py-4 rounded-2xl shadow-xl shadow-indigo-200 active:scale-[0.98] transition-all flex items-center gap-2.5 disabled:opacity-40 disabled:shadow-none disabled:cursor-not-allowed cursor-pointer text-sm whitespace-nowrap">
            {isProcessing
              ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Procesando...</>
              : <><Printer size={16} /> Finalizar Venta <ArrowRight size={16} /></>
            }
          </button>
        </div>
      </div>
    </div>

    {/* MODAL: Agregar item */}
    <AnimatePresence>
      {addModal && (
        <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setAddModal(null)}>
          <motion.div initial={{scale:0.9,y:20}} animate={{scale:1,y:0}} exit={{scale:0.9,y:20}}
            className="bg-white rounded-[40px] p-8 shadow-2xl w-full max-w-md"
            onClick={e => e.stopPropagation()}>

            {addModal.type === 'new-reventa' ? (
              <div className="space-y-5">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-orange-100 rounded-2xl flex items-center justify-center text-orange-600"><ShoppingBag size={28} /></div>
                  <div>
                    <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest">Agregar al ticket</p>
                    <h3 className="text-xl font-black text-gray-800">Nueva Reventa</h3>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1.5">Nombre <span className="text-red-400">*</span></label>
                  <input type="text" value={addModal.name} placeholder="Nombre del producto"
                    autoFocus
                    onChange={e => setAddModal(prev => prev?.type === 'new-reventa' ? { ...prev, name: e.target.value } : prev)}
                    className="w-full p-3 bg-gray-50 border-2 border-transparent focus:border-orange-400 focus:bg-white rounded-2xl outline-none font-bold text-sm transition-all" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1.5">Precio Venta <span className="text-red-400">*</span></label>
                    <NumericInput value={addModal.salePrice} placeholder="0"
                      onChange={raw => setAddModal(prev => prev?.type === 'new-reventa' ? { ...prev, salePrice: raw } : prev)}
                      className="w-full p-3 bg-gray-50 border-2 border-transparent focus:border-orange-400 focus:bg-white rounded-2xl outline-none font-black text-sm transition-all" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1.5">Costo (opc.)</label>
                    <NumericInput value={addModal.costPrice} placeholder="0"
                      onChange={raw => setAddModal(prev => prev?.type === 'new-reventa' ? { ...prev, costPrice: raw } : prev)}
                      className="w-full p-3 bg-gray-50 border-2 border-transparent focus:border-gray-300 focus:bg-white rounded-2xl outline-none font-black text-sm transition-all" />
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Cantidad</p>
                  <div className="flex items-center justify-center gap-4 bg-gray-50 rounded-2xl py-3">
                    <button onClick={() => setAddModal(prev => prev?.type === 'new-reventa' ? { ...prev, qty: String(Math.max(1, parseInt(prev.qty || '1') - 1)) } : prev)}
                      className="w-10 h-10 bg-white rounded-xl flex items-center justify-center font-black text-gray-500 hover:text-red-500 hover:bg-red-50 shadow-sm transition-all cursor-pointer text-lg">-</button>
                    <span className="text-4xl font-black text-gray-800 w-12 text-center">{addModal.qty || '1'}</span>
                    <button onClick={() => setAddModal(prev => prev?.type === 'new-reventa' ? { ...prev, qty: String(parseInt(prev.qty || '1') + 1) } : prev)}
                      className="w-10 h-10 bg-white rounded-xl flex items-center justify-center font-black text-gray-500 hover:text-orange-500 hover:bg-orange-50 shadow-sm transition-all cursor-pointer text-lg">+</button>
                  </div>
                </div>
                {reventaSuppliers.length > 0 && (
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1.5">Proveedor (opc.)</label>
                    <select value={addModal.supplierId}
                      onChange={e => setAddModal(prev => prev?.type === 'new-reventa' ? { ...prev, supplierId: e.target.value } : prev)}
                      className="w-full p-3 bg-gray-50 border-2 border-transparent focus:border-orange-400 focus:bg-white rounded-2xl outline-none font-bold text-sm transition-all cursor-pointer">
                      <option value="">Sin proveedor</option>
                      {reventaSuppliers.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                    </select>
                  </div>
                )}
                <div className="flex gap-3">
                  <button onClick={() => setAddModal(null)} className="flex-1 py-3 rounded-2xl border-2 border-gray-100 font-black text-gray-500 hover:bg-gray-50 cursor-pointer">Cancelar</button>
                  <button onClick={addFromModal}
                    disabled={!addModal.name.trim() || !(parseInt(addModal.salePrice.replace(/\D/g, '')) > 0)}
                    className="flex-1 py-3 rounded-2xl bg-orange-500 text-white font-black hover:bg-orange-600 shadow-xl shadow-orange-200 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
                    <Plus size={16} /> Agregar al ticket
                  </button>
                </div>
              </div>
            ) : addModal.type === 'reventa' ? (
              <div className="space-y-5">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-orange-100 rounded-2xl flex items-center justify-center text-orange-600"><ShoppingBag size={28} /></div>
                  <div>
                    <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest">Reventa — Agregar al ticket</p>
                    <h3 className="text-xl font-black text-gray-800">{addModal.item.name}</h3>
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Stock: {addModal.item.quantity}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Cantidad</p>
                  <div className="flex items-center justify-center gap-4 bg-gray-50 rounded-2xl py-4">
                    <button onClick={() => setAddModal(prev => prev?.type === 'reventa' ? { ...prev, qty: String(Math.max(1, parseInt(prev.qty || '1') - 1)) } : prev)}
                      className="w-10 h-10 bg-white rounded-xl flex items-center justify-center font-black text-gray-500 hover:text-red-500 hover:bg-red-50 shadow-sm transition-all cursor-pointer text-lg">-</button>
                    <span className="text-4xl font-black text-gray-800 w-12 text-center">{addModal.qty || '1'}</span>
                    <button onClick={() => setAddModal(prev => prev?.type === 'reventa' ? { ...prev, qty: String(Math.min(n(prev.item.quantity), parseInt(prev.qty || '1') + 1)) } : prev)}
                      className="w-10 h-10 bg-white rounded-xl flex items-center justify-center font-black text-gray-500 hover:text-orange-500 hover:bg-orange-50 shadow-sm transition-all cursor-pointer text-lg">+</button>
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 bg-orange-50 rounded-2xl">
                  <span className="font-black text-gray-700">{addModal.qty || 1} × {addModal.item.name}</span>
                  <span className="font-black text-orange-700 text-xl">Gs. {(n(addModal.item.salePrice) * parseInt(addModal.qty || '1')).toLocaleString()}</span>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setAddModal(null)} className="flex-1 py-3 rounded-2xl border-2 border-gray-100 font-black text-gray-500 hover:bg-gray-50 cursor-pointer">Cancelar</button>
                  <button onClick={addFromModal} className="flex-1 py-3 rounded-2xl bg-orange-500 text-white font-black hover:bg-orange-600 shadow-xl shadow-orange-200 cursor-pointer flex items-center justify-center gap-2">
                    <Plus size={16} /> Agregar al ticket
                  </button>
                </div>
              </div>
            ) : addModal.type === 'repair' ? (
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600"><Wrench size={28} /></div>
                  <div>
                    <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Agregar al ticket</p>
                    <h3 className="text-xl font-black text-gray-800">{addModal.repair.deviceModel}</h3>
                    <p className="text-sm text-gray-400 font-bold">{addModal.repair.customerName}</p>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-2xl p-4 flex items-center justify-between">
                  <span className="font-bold text-gray-600">Servicio de reparacion</span>
                  <span className="font-black text-emerald-600 text-xl">Gs. {n(addModal.repair.totalCost).toLocaleString()}</span>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setAddModal(null)} className="flex-1 py-3 rounded-2xl border-2 border-gray-100 font-black text-gray-500 hover:bg-gray-50 cursor-pointer">Cancelar</button>
                  <button onClick={addFromModal} className="flex-1 py-3 rounded-2xl bg-amber-500 text-white font-black hover:bg-amber-600 shadow-lg shadow-amber-200 cursor-pointer flex items-center justify-center gap-2">
                    <Plus size={16} /> Agregar
                  </button>
                </div>
              </div>
            ) : (
              (() => {
                const p = addModal.product;
                const hasNoPrice = n(p.salePrice) === 0 && n(p.priceWholesale) === 0 && n(p.priceCheap) === 0;
                const pendingAmt = parseInt((addModal.pendingPrice || '').replace(/\D/g, '')) || 0;
                const cartTotal = (addModal.priceType === 'especial' || hasNoPrice)
                  ? pendingAmt * parseInt(addModal.qty || '1')
                  : n(addModal.priceType === 'wholesale' ? p.priceWholesale : addModal.priceType === 'cheap' ? p.priceCheap : p.salePrice) * parseInt(addModal.qty || '1');
                return (
                  <div className="space-y-5">
                    <div className="flex items-center gap-4">
                      <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center", hasNoPrice ? 'bg-amber-100 text-amber-600' : 'bg-indigo-100 text-indigo-600')}>
                        <Package size={28} />
                      </div>
                      <div>
                        <p className={cn("text-[10px] font-black uppercase tracking-widest", hasNoPrice ? 'text-amber-500' : 'text-indigo-500')}>
                          {hasNoPrice ? 'Sin precio — asignar ahora' : 'Agregar al ticket'}
                        </p>
                        <h3 className="text-xl font-black text-gray-800">{p.model}</h3>
                        <p className="text-[10px] font-bold text-gray-400 uppercase">Stock: {p.quantity}</p>
                      </div>
                    </div>

                    {hasNoPrice ? (
                      /* ── Producto sin precio: ingresar y elegir tipo ── */
                      <div className="space-y-3">
                        <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest">
                          Precio de venta <span className="text-red-400">*</span>
                        </p>
                        <NumericInput
                          value={addModal.pendingPrice}
                          onChange={raw => setAddModal(prev => prev?.type === 'product' ? { ...prev, pendingPrice: raw } : prev)}
                          placeholder="0"
                          className="w-full p-4 bg-amber-50 border-2 border-amber-200 focus:border-amber-500 focus:bg-white rounded-2xl outline-none font-black text-2xl text-center transition-all"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          {([
                            { key: 'normal'    as PriceType, label: 'Normal',    emoji: '🏷️' },
                            { key: 'wholesale' as PriceType, label: 'Mayorista', emoji: '🏪' },
                            { key: 'cheap'     as PriceType, label: 'Tacaño',    emoji: '💸' },
                            { key: 'especial'  as PriceType, label: 'Especial',  emoji: '✨' },
                          ]).map(opt => (
                            <button key={opt.key}
                              onClick={() => setAddModal(prev => prev?.type === 'product' ? { ...prev, priceType: opt.key } : prev)}
                              className={cn('flex flex-col items-center py-3 px-2 rounded-2xl font-black text-center transition-all cursor-pointer text-sm',
                                addModal.priceType === opt.key
                                  ? opt.key === 'especial'
                                    ? 'bg-pink-500 text-white shadow-lg shadow-pink-200'
                                    : 'bg-amber-500 text-white shadow-lg shadow-amber-200'
                                  : 'bg-gray-50 text-gray-500 hover:bg-amber-50 hover:text-amber-700')}>
                              <span className="text-base">{opt.emoji}</span>
                              <span className="text-[9px] uppercase tracking-widest mt-0.5">{opt.label}</span>
                            </button>
                          ))}
                        </div>
                        <p className="text-[9px] font-bold text-gray-400 text-center">
                          {addModal.priceType === 'especial'
                            ? 'Precio a definir luego — no se guarda en el producto'
                            : <>Se guarda como precio <span className="font-black text-gray-600">{addModal.priceType === 'wholesale' ? 'Mayorista' : addModal.priceType === 'cheap' ? 'Tacaño' : 'Normal'}</span> del producto</>
                          }
                        </p>
                      </div>
                    ) : (
                      /* ── Producto con precio: selector normal ── */
                      <div className="space-y-2">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Precio</p>
                        <div className="grid grid-cols-2 gap-2">
                          {([
                            { key: 'normal'    as PriceType, label: 'Normal',    price: n(p.salePrice) },
                            { key: 'wholesale' as PriceType, label: 'Mayorista', price: n(p.priceWholesale) },
                            { key: 'cheap'     as PriceType, label: 'Economico', price: n(p.priceCheap) },
                          ].filter(o => o.price > 0)).map(opt => (
                            <button key={opt.key}
                              onClick={() => setAddModal(prev => prev?.type === 'product' ? { ...prev, priceType: opt.key, pendingPrice: '' } : prev)}
                              className={cn('flex flex-col items-center py-3 px-2 rounded-2xl font-black text-center transition-all cursor-pointer',
                                addModal.priceType === opt.key
                                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                                  : 'bg-gray-50 text-gray-600 hover:bg-indigo-50 hover:text-indigo-700')}>
                              <span className="text-[9px] uppercase tracking-widest">{opt.label}</span>
                              <span className="text-sm mt-1">Gs. {opt.price.toLocaleString()}</span>
                            </button>
                          ))}
                          <button
                            onClick={() => setAddModal(prev => prev?.type === 'product' ? { ...prev, priceType: 'especial', pendingPrice: '' } : prev)}
                            className={cn('flex flex-col items-center py-3 px-2 rounded-2xl font-black text-center transition-all cursor-pointer',
                              addModal.priceType === 'especial'
                                ? 'bg-pink-500 text-white shadow-lg shadow-pink-200'
                                : 'bg-gray-50 text-gray-600 hover:bg-pink-50 hover:text-pink-700')}>
                            <span className="text-base">✨</span>
                            <span className="text-[9px] uppercase tracking-widest mt-0.5">Especial</span>
                          </button>
                        </div>
                        {addModal.priceType === 'especial' && (
                          <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Precio especial (opcional)</p>
                            <NumericInput
                              value={addModal.pendingPrice}
                              onChange={raw => setAddModal(prev => prev?.type === 'product' ? { ...prev, pendingPrice: raw } : prev)}
                              placeholder="0 = definir después"
                              className="w-full p-3 bg-pink-50 border-2 border-pink-200 focus:border-pink-500 focus:bg-white rounded-2xl outline-none font-black text-lg text-center transition-all"
                            />
                          </div>
                        )}
                      </div>
                    )}

                    <div className="space-y-2">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Cantidad</p>
                      <div className="flex items-center justify-center gap-4 bg-gray-50 rounded-2xl py-4">
                        <button onClick={() => setAddModal(prev => prev?.type === 'product' ? { ...prev, qty: String(Math.max(1, parseInt(prev.qty || '1') - 1)) } : prev)}
                          className="w-10 h-10 bg-white rounded-xl flex items-center justify-center font-black text-gray-500 hover:text-red-500 hover:bg-red-50 shadow-sm transition-all cursor-pointer text-lg">-</button>
                        <span className="text-4xl font-black text-gray-800 w-12 text-center">{addModal.qty || '1'}</span>
                        <button onClick={() => setAddModal(prev => prev?.type === 'product' ? { ...prev, qty: String(Math.min(n(prev.product.quantity), parseInt(prev.qty || '1') + 1)) } : prev)}
                          className="w-10 h-10 bg-white rounded-xl flex items-center justify-center font-black text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 shadow-sm transition-all cursor-pointer text-lg">+</button>
                      </div>
                    </div>

                    {cartTotal > 0 && (
                      <div className={cn("flex items-center justify-between p-4 rounded-2xl", hasNoPrice ? 'bg-amber-50' : 'bg-indigo-50')}>
                        <span className="font-black text-gray-700">{addModal.qty || 1} × {p.model}</span>
                        <span className={cn("font-black text-xl", hasNoPrice ? 'text-amber-700' : 'text-indigo-700')}>
                          Gs. {cartTotal.toLocaleString()}
                        </span>
                      </div>
                    )}

                    <div className="flex gap-3">
                      <button onClick={() => setAddModal(null)} className="flex-1 py-3 rounded-2xl border-2 border-gray-100 font-black text-gray-500 hover:bg-gray-50 cursor-pointer">Cancelar</button>
                      <button onClick={addFromModal}
                        disabled={hasNoPrice && addModal.priceType !== 'especial' && pendingAmt === 0}
                        className={cn("flex-1 py-3 rounded-2xl text-white font-black shadow-xl cursor-pointer flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-all",
                          addModal.priceType === 'especial'
                            ? 'bg-pink-500 hover:bg-pink-600 shadow-pink-200'
                            : hasNoPrice
                              ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-200'
                              : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200')}>
                        <Plus size={16} /> {addModal.priceType === 'especial' ? 'Agregar (precio a definir)' : hasNoPrice ? 'Guardar precio y agregar' : 'Agregar al ticket'}
                      </button>
                    </div>
                  </div>
                );
              })()
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

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

    {/* ── MODAL: Nuevo Producto Rápido ── */}
    <AnimatePresence>
      {quickModal && (
        <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div initial={{scale:0.9,y:20}} animate={{scale:1,y:0}} exit={{scale:0.9,y:20}}
            className="bg-white rounded-[40px] p-8 shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600">
                <Zap size={28} />
              </div>
              <div>
                <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Carga rápida</p>
                <h3 className="text-xl font-black text-gray-800">Nuevo Producto</h3>
              </div>
              <button onClick={() => setQuickModal(null)} className="ml-auto text-gray-300 hover:text-gray-600 transition-colors">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleQuickCreate} className="space-y-5">
              {/* Nombre */}
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1.5">
                  Nombre <span className="text-red-400">*</span>
                </label>
                <input
                  required autoFocus
                  value={quickModal.model}
                  onChange={e => setQuickModal(p => p ? { ...p, model: e.target.value.toUpperCase() } : p)}
                  placeholder="EJ: IPHONE 13 128GB"
                  className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl outline-none font-black text-sm transition-all uppercase"
                />
              </div>

              {/* Precios */}
              <div className="space-y-2">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Precio de Venta <span className="text-red-400">* (al menos uno)</span>
                </p>
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="text-[9px] font-black text-emerald-600 uppercase tracking-widest ml-1 block mb-1">Normal (Gs.)</label>
                    <NumericInput
                      value={quickModal.salePrice}
                      onChange={raw => setQuickModal(p => p ? { ...p, salePrice: raw } : p)}
                      placeholder="0"
                      className="w-full p-3 bg-emerald-50 border-2 border-transparent focus:border-emerald-500 focus:bg-white rounded-2xl outline-none font-black text-sm transition-all"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[9px] font-black text-purple-500 uppercase tracking-widest ml-1 block mb-1">🏪 Mayorista (Gs.)</label>
                      <NumericInput
                        value={quickModal.priceWholesale}
                        onChange={raw => setQuickModal(p => p ? { ...p, priceWholesale: raw } : p)}
                        placeholder="0"
                        className="w-full p-3 bg-purple-50 border-2 border-transparent focus:border-purple-400 focus:bg-white rounded-2xl outline-none font-black text-sm transition-all"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-orange-500 uppercase tracking-widest ml-1 block mb-1">💸 Tacaño (Gs.)</label>
                      <NumericInput
                        value={quickModal.priceCheap}
                        onChange={raw => setQuickModal(p => p ? { ...p, priceCheap: raw } : p)}
                        placeholder="0"
                        className="w-full p-3 bg-orange-50 border-2 border-transparent focus:border-orange-400 focus:bg-white rounded-2xl outline-none font-black text-sm transition-all"
                      />
                    </div>
                  </div>
                  {/* Especial toggle */}
                  <button
                    type="button"
                    onClick={() => setQuickModal(p => p ? { ...p, isEspecial: !p.isEspecial } : p)}
                    className={`w-full p-3 rounded-2xl border-2 font-black text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      quickModal.isEspecial
                        ? 'bg-pink-500 border-pink-500 text-white'
                        : 'bg-pink-50 border-transparent text-pink-500 hover:border-pink-300'
                    }`}
                  >
                    ✨ {quickModal.isEspecial ? 'Precio Especial activado — se asigna luego' : 'Precio Especial (asignar después)'}
                  </button>
                </div>
              </div>

              {/* Costo */}
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1.5">Costo (opc.)</label>
                <NumericInput
                  value={quickModal.costPrice}
                  onChange={raw => setQuickModal(p => p ? { ...p, costPrice: raw } : p)}
                  placeholder="0"
                  className="w-full p-3 bg-gray-50 border-2 border-transparent focus:border-gray-300 focus:bg-white rounded-2xl outline-none font-black text-sm transition-all"
                />
              </div>

              {/* Cantidad */}
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1.5">Cantidad en Stock</label>
                <div className="flex items-center gap-3 bg-gray-50 rounded-2xl p-3">
                  <button type="button"
                    onClick={() => setQuickModal(p => p ? { ...p, quantity: String(Math.max(1, parseInt(p.quantity||'1') - 1)) } : p)}
                    className="w-9 h-9 bg-white rounded-xl flex items-center justify-center font-black text-gray-500 hover:text-red-500 hover:bg-red-50 shadow-sm transition-all cursor-pointer text-xl">-</button>
                  <span className="flex-1 text-3xl font-black text-gray-800 text-center">{quickModal.quantity || '1'}</span>
                  <button type="button"
                    onClick={() => setQuickModal(p => p ? { ...p, quantity: String(parseInt(p.quantity||'1') + 1) } : p)}
                    className="w-9 h-9 bg-white rounded-xl flex items-center justify-center font-black text-gray-500 hover:text-indigo-500 hover:bg-indigo-50 shadow-sm transition-all cursor-pointer text-xl">+</button>
                </div>
              </div>

              {/* Categoría + Fabricante */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1.5">Categoría (opc.)</label>
                  <select
                    value={quickModal.categoryId}
                    onChange={e => setQuickModal(p => p ? { ...p, categoryId: e.target.value } : p)}
                    className="w-full p-3 bg-gray-50 border-2 border-transparent focus:border-indigo-400 focus:bg-white rounded-2xl outline-none font-bold text-sm transition-all cursor-pointer">
                    <option value="">Sin categoría</option>
                    {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1.5">Fabricante (opc.)</label>
                  <select
                    value={quickModal.manufacturerId}
                    onChange={e => setQuickModal(p => p ? { ...p, manufacturerId: e.target.value } : p)}
                    className="w-full p-3 bg-gray-50 border-2 border-transparent focus:border-indigo-400 focus:bg-white rounded-2xl outline-none font-bold text-sm transition-all cursor-pointer">
                    <option value="">Sin fabricante</option>
                    {manufacturers.map(m => <option key={m._id} value={m._id}>{m.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Ubicación */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                  <MapPin size={11} className="text-indigo-400" /> Ubicación en Estante (opc.)
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Estante</p>
                    <input
                      value={quickModal.estante}
                      onChange={e => setQuickModal(p => p ? { ...p, estante: e.target.value } : p)}
                      placeholder="1"
                      className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl outline-none transition-all font-black text-center text-lg"
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Columna</p>
                    <input
                      value={quickModal.columna}
                      onChange={e => setQuickModal(p => p ? { ...p, columna: e.target.value } : p)}
                      placeholder="A"
                      className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl outline-none transition-all font-black text-center text-lg"
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Fila</p>
                    <input
                      value={quickModal.fila}
                      onChange={e => setQuickModal(p => p ? { ...p, fila: e.target.value } : p)}
                      placeholder="3"
                      className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl outline-none transition-all font-black text-center text-lg"
                    />
                  </div>
                </div>
              </div>

              {errorMsg && (
                <p className="text-sm font-black text-red-500 bg-red-50 p-3 rounded-2xl">{errorMsg}</p>
              )}

              <button type="submit" disabled={quickCreating}
                className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                {quickCreating
                  ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Creando…</>
                  : <><Zap size={18} /> Crear y agregar al ticket</>
                }
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* ── MODAL: Completar Stock post-venta ── */}
    <AnimatePresence>
      {stockCompletion && (
        <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div initial={{scale:0.9,y:20}} animate={{scale:1,y:0}} exit={{scale:0.9,y:20}}
            className="bg-white rounded-[40px] p-8 shadow-2xl w-full max-w-sm">
            <div className="flex items-center gap-4 mb-2">
              <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600">
                <MapPin size={28} />
              </div>
              <div>
                <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest">¡Producto vendido!</p>
                <h3 className="text-lg font-black text-gray-800 leading-snug">Completar stock</h3>
              </div>
            </div>
            <p className="text-sm font-bold text-gray-500 mb-6 ml-1">
              <span className="font-black text-gray-700">{stockCompletion.model}</span> — indicá dónde está y cuántos tenés.
              {pendingCompletions.length > 0 && (
                <span className="ml-1 text-[10px] font-black text-indigo-400 bg-indigo-50 px-2 py-0.5 rounded-full">
                  +{pendingCompletions.length} más
                </span>
              )}
            </p>
            <form onSubmit={handleStockCompletion} className="space-y-5">
              {/* Ubicación */}
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1 mb-2">
                  <MapPin size={10} className="text-indigo-400" /> Ubicación <span className="text-red-400">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['estante','columna','fila'] as const).map((field, i) => (
                    <div key={field} className="space-y-1">
                      <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest text-center">
                        {field === 'estante' ? 'Estante' : field === 'columna' ? 'Columna' : 'Fila'}
                      </p>
                      <input
                        required
                        value={stockCompletion[field]}
                        onChange={e => setStockCompletion(p => p ? { ...p, [field]: e.target.value } : p)}
                        placeholder={i === 0 ? '1' : i === 1 ? 'A' : '3'}
                        className="w-full p-3 bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl outline-none font-black text-center text-lg transition-all"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Cantidad actual */}
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">
                  Cantidad actual en stock <span className="text-red-400">*</span>
                </label>
                <NumericInput
                  required
                  value={stockCompletion.quantity}
                  onChange={raw => setStockCompletion(p => p ? { ...p, quantity: raw } : p)}
                  placeholder="0"
                  className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl outline-none font-black text-2xl text-center transition-all"
                />
              </div>

              <button type="submit" disabled={stockSaving}
                className="w-full bg-emerald-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-emerald-200 hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                {stockSaving
                  ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Guardando…</>
                  : <><CheckCircle size={18} /> Guardar y continuar</>
                }
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  );
};
