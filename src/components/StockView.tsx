import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Minus, Search, Edit2, Trash2, Package, MapPin, Tag, ArrowLeft, AlertTriangle, RefreshCw, ShieldCheck, Scan, Printer, BarChart2, TrendingUp, TrendingDown, Clock, DollarSign, ShoppingCart, History, User, StickyNote } from 'lucide-react';
import { api } from '../api';
import { Product, Category, Manufacturer, UserProfile, StockMovement } from '../types';
import { Modal } from './ui/Modal';
import { NumericInput } from './ui/NumericInput';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { cn } from '../lib/utils';

interface StockViewProps {
  products: Product[];
  categories: Category[];
  manufacturers: Manufacturer[];
  onRefresh: () => void;
  exchangeRate?: number;
  user?: UserProfile | null;
}

function printProductLabels(
  product: { barcode?: string; model: string; salePrice: number },
  qty: number,
  withBarcode: boolean
) {
  const win = window.open('', '_blank', 'width=960,height=700');
  if (!win) return;
  const safeModel   = product.model.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const priceStr    = Math.round(product.salePrice).toLocaleString('es-PY');
  const barcode     = product.barcode || '';
  const showBarcode = withBarcode && !!barcode;
  const format      = barcode.length === 8 ? 'EAN8' : barcode.length === 13 ? 'EAN13' : 'CODE128';

  const labelHtml = Array.from({ length: Math.max(1, qty) }).map(() =>
    `<div class="label">
      <p class="model">${safeModel}</p>
      <p class="price">Gs. ${priceStr}</p>
      ${showBarcode ? '<svg class="bc"></svg>' : ''}
    </div>`
  ).join('');

  win.document.write(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Etiquetas — ${safeModel}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,sans-serif;background:#fff}
  .wrap{display:flex;flex-wrap:wrap;gap:2mm;padding:5mm}
  .label{
    width:55mm;border:.4pt dashed #bbb;padding:2.5mm;
    display:flex;flex-direction:column;align-items:center;
    justify-content:center;text-align:center;
    page-break-inside:avoid;break-inside:avoid
  }
  .model{
    font-size:8pt;font-weight:900;line-height:1.3;
    overflow:hidden;display:-webkit-box;
    -webkit-line-clamp:2;-webkit-box-orient:vertical;
    word-break:break-word;margin-bottom:1mm;max-width:100%
  }
  .price{font-size:8.5pt;font-weight:bold;color:#111;margin-bottom:${showBarcode?'1mm':'0'}}
  .bc{max-width:100%}
  @media print{body{padding:0}@page{margin:5mm}}
</style>
</head>
<body>
  <div class="wrap">${labelHtml}</div>
  ${showBarcode ? `<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"><\/script>` : ''}
  <script>
    ${showBarcode
      ? `window.onload=function(){
          document.querySelectorAll('.bc').forEach(function(el){
            JsBarcode(el,'${barcode}',{format:'${format}',width:1.5,height:40,displayValue:true,fontSize:9,margin:2});
          });
          setTimeout(function(){window.print();},500);
        };`
      : `setTimeout(function(){window.print();},120);`
    }
  <\/script>
</body>
</html>`);
  win.document.close();
}

// ── Helpers de ubicación estructurada ───────────────────────────────────────
const parseLocation = (loc: string): { estante: string; columna: string; fila: string } => {
  const parts = (loc || '').split('|');
  return { estante: parts[0] || '', columna: parts[1] || '', fila: parts[2] || '' };
};
const formatLocation = (e: string, c: string, f: string) => `${e}|${c}|${f}`;
const displayLocation = (loc: string) => {
  const { estante, columna, fila } = parseLocation(loc);
  const parts: string[] = [];
  if (estante) parts.push(`Est. ${estante}`);
  if (columna) parts.push(`Col. ${columna}`);
  if (fila)    parts.push(`Fila ${fila}`);
  return parts.join(' · ');
};

export const StockView = ({ products, categories, manufacturers, onRefresh, exchangeRate = 6300, user }: StockViewProps) => {
  const [isAdding, setIsAdding] = useState(false);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [restockingProduct, setRestockingProduct] = useState<Product | null>(null);
  const [restockData, setRestockData] = useState({ quantity: '', costPrice: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedManufacturerId, setSelectedManufacturerId] = useState<string | null>(null);
  const [selectedEstante, setSelectedEstante] = useState('');
  const [selectedColumna, setSelectedColumna] = useState('');
  const [selectedFila, setSelectedFila]   = useState('');
  
  const [newProduct, setNewProduct] = useState({
    model: '', categoryId: '', manufacturerId: undefined as string | undefined, quantity: 0, purchasedQuantity: 0, costPrice: 0, salePrice: 0, priceWholesale: 0, priceCheap: 0, location: '', isWholesale: false, barcode: ''
  });
  const [newCategory, setNewCategory] = useState({ name: '', warrantyDays: '2', minStock: '5', isLocal: false });
  const [editingCategory, setEditingCategory] = useState<{ _id: string; name: string; warrantyDays: string; minStock: string; isLocal: boolean } | null>(null);
  const [isManagingManufacturers, setIsManagingManufacturers] = useState(false);
  const [newManufacturerName, setNewManufacturerName] = useState('');
  const [editingManufacturer, setEditingManufacturer] = useState<{ _id: string; name: string } | null>(null);
  // ── Modal de categoría para productos nuevos escaneados ───
  const [scanCategoryModal, setScanCategoryModal] = useState<{ barcode: string } | null>(null);
  const [generatingBarcode, setGeneratingBarcode] = useState<string | null>(null);
  const [scanSelectedCategory, setScanSelectedCategory] = useState('');
  // ── Modal imprimir etiquetas ────────────────────────────────
  const [printModal,       setPrintModal]       = useState<Product | null>(null);
  const [printQty,         setPrintQty]         = useState('1');
  const [printWithBarcode, setPrintWithBarcode] = useState(true);
  const [warranties, setWarranties] = useState<any[]>([]);
  const [pendingConfirm, setPendingConfirm] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [barcodeError, setBarcodeError] = useState(false);
  const [newLoc,  setNewLoc]  = useState({ estante: '', columna: '', fila: '' });
  const [editLoc, setEditLoc] = useState({ estante: '', columna: '', fila: '' });
  const [newCostUsd,  setNewCostUsd]  = useState('');
  const [editCostUsd, setEditCostUsd] = useState('');

  // ── Analítica de productos ───────────────────────────────────
  type StatsSort = 'units' | 'revenue' | 'margin' | 'idle';
  const [mainTab,      setMainTab]      = useState<'stock' | 'analytics' | 'history'>('stock');
  const [productStats, setProductStats] = useState<any[]>([]);
  const [loadingStats, setLoadingStats] = useState(false);
  const [statsSort,    setStatsSort]    = useState<StatsSort>('units');

  // ── Historial de reposiciones ────────────────────────────────
  const [stockMovements,    setStockMovements]    = useState<StockMovement[]>([]);
  const [loadingMovements,  setLoadingMovements]  = useState(false);
  const [historySearch,     setHistorySearch]     = useState('');
  const [historyDateFrom,   setHistoryDateFrom]   = useState('');
  const [historyDateTo,     setHistoryDateTo]     = useState('');

  React.useEffect(() => {
    fetchWarranties();
  }, []);

  // Detectar si el escáner redirigió acá con un código nuevo
  useEffect(() => {
    const barcode = sessionStorage.getItem('newProductBarcode');
    if (barcode) {
      sessionStorage.removeItem('newProductBarcode');
      // Abrir primero el modal de categoría, luego el formulario
      setScanCategoryModal({ barcode });
      setScanSelectedCategory('');
    }
  }, []);

  const fetchWarranties = async () => {
    const data = await api.getWarranties();
    setWarranties(data.filter((w: any) => w.status === 'pending'));
  };

  // Cargar estadísticas cuando el usuario abre la pestaña analítica
  useEffect(() => {
    if (mainTab !== 'analytics') return;
    setLoadingStats(true);
    (api as any).getProductStats()
      .then((data: any[]) => { if (Array.isArray(data)) setProductStats(data); })
      .catch(() => {})
      .finally(() => setLoadingStats(false));
  }, [mainTab]);

  // Cargar historial de reposiciones
  useEffect(() => {
    if (mainTab !== 'history') return;
    setLoadingMovements(true);
    (api as any).getStockMovements()
      .then((data: StockMovement[]) => { if (Array.isArray(data)) setStockMovements(data); })
      .catch(() => {})
      .finally(() => setLoadingMovements(false));
  }, [mainTab]);

  const getLowStockCount = (catId: string) => {
    const cat = categories.find(c => c._id === catId);
    const threshold = cat?.minStock ?? 5;
    return products.filter(p => p.categoryId === catId && p.quantity > 0 && p.quantity <= threshold).length;
  };

  const filteredCategories = categories.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const allEstantes = Array.from(new Set(products.map(p => parseLocation(p.location || '').estante).filter(Boolean))).sort();
  const allColumnas = Array.from(new Set(
    products
      .filter(p => !selectedEstante || parseLocation(p.location || '').estante === selectedEstante)
      .map(p => parseLocation(p.location || '').columna).filter(Boolean)
  )).sort();
  const allFilas = Array.from(new Set(
    products
      .filter(p => {
        const loc = parseLocation(p.location || '');
        return (!selectedEstante || loc.estante === selectedEstante) && (!selectedColumna || loc.columna === selectedColumna);
      })
      .map(p => parseLocation(p.location || '').fila).filter(Boolean)
  )).sort();

  const filteredProducts = products.filter(p => {
    const q = searchTerm.toLowerCase();
    const { estante, columna, fila } = parseLocation(p.location || '');
    const matchesSearch = !q
      || p.model.toLowerCase().includes(q)
      || (manufacturers.find(m => m._id === p.manufacturerId)?.name ?? '').toLowerCase().includes(q)
      || displayLocation(p.location || '').toLowerCase().includes(q)
      || estante.toLowerCase().includes(q)
      || columna.toLowerCase().includes(q)
      || fila.toLowerCase().includes(q);
    const matchesCategory = selectedCategoryId
      ? selectedCategoryId === 'UNASSIGNED'
        ? !p.categoryId
        : p.categoryId === selectedCategoryId
      : true;
    const matchesMfr = selectedManufacturerId ? p.manufacturerId === selectedManufacturerId : true;
    const matchesEstante = selectedEstante ? estante === selectedEstante : true;
    const matchesColumna = selectedColumna ? columna === selectedColumna : true;
    const matchesFila    = selectedFila    ? fila    === selectedFila    : true;
    return matchesSearch && matchesCategory && matchesMfr && matchesEstante && matchesColumna && matchesFila;
  });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await api.createProduct({
        ...newProduct,
        categoryId: newProduct.categoryId || null,
        location: formatLocation(newLoc.estante, newLoc.columna, newLoc.fila),
      });
      setIsAdding(false);
      setNewProduct({ model: '', categoryId: selectedCategoryId || '', manufacturerId: undefined, quantity: 0, purchasedQuantity: 0, costPrice: 0, salePrice: 0, priceWholesale: 0, priceCheap: 0, location: '', isWholesale: false, barcode: '' });
      setNewLoc({ estante: '', columna: '', fila: '' });
      setNewCostUsd('');
      onRefresh();

      // ── Si la categoría es "del local", generar código e imprimir etiqueta ──
      const cat = categories.find(c => c._id === newProduct.categoryId);
      if ((cat as any)?.isLocal && created?._id) {
        try {
          const data = await api.generateBarcode(created._id);
          if (data.barcode) {
            setTimeout(() => {
              setPrintModal({ ...created, barcode: data.barcode, model: newProduct.model, salePrice: newProduct.salePrice } as Product);
              setPrintQty(String(newProduct.purchasedQuantity || 1));
              setPrintWithBarcode(true);
            }, 350);
          }
        } catch { /* Si falla la generación no interrumpimos el flujo */ }
      }
    } catch (err: any) {
      alert('Error al guardar el producto: ' + (err?.message ?? 'Error desconocido'));
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.createCategory({
      name:         newCategory.name,
      warrantyDays: parseInt(newCategory.warrantyDays) || 2,
      minStock:     parseInt(newCategory.minStock) || 5,
      isLocal:      newCategory.isLocal,
    });
    setIsAddingCategory(false);
    setNewCategory({ name: '', warrantyDays: '2', minStock: '5', isLocal: false });
    onRefresh();
  };

  const handleUpdateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory) return;
    await api.updateCategory(editingCategory._id, {
      name:         editingCategory.name,
      warrantyDays: parseInt(editingCategory.warrantyDays) || 2,
      minStock:     parseInt(editingCategory.minStock) || 5,
      isLocal:      editingCategory.isLocal,
    });
    setEditingCategory(null);
    onRefresh();
  };

  const handleAddManufacturer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newManufacturerName.trim()) return;
    try {
      await (api as any).createManufacturer(newManufacturerName.trim());
      setNewManufacturerName('');
      onRefresh();
    } catch (err: any) {
      alert('Error al crear fabricante: ' + (err?.message ?? 'Error desconocido'));
    }
  };

  const handleUpdateManufacturer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingManufacturer) return;
    try {
      await (api as any).updateManufacturer(editingManufacturer._id, editingManufacturer.name);
      setEditingManufacturer(null);
      onRefresh();
    } catch (err: any) {
      alert('Error al actualizar fabricante: ' + (err?.message ?? 'Error desconocido'));
    }
  };

  const handleDeleteManufacturer = async (id: string) => {
    try {
      await (api as any).deleteManufacturer(id);
      onRefresh();
    } catch (err: any) {
      alert('Error al eliminar fabricante: ' + (err?.message ?? 'Error desconocido'));
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProduct) {
      await api.updateProduct(editingProduct._id, {
        ...editingProduct,
        location: formatLocation(editLoc.estante, editLoc.columna, editLoc.fila),
      });
      setEditingProduct(null);
      onRefresh();
    }
  };

  const handleRestock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (restockingProduct) {
      await api.restockProduct(restockingProduct._id, { quantity: parseInt(restockData.quantity) || 0, costPrice: parseInt(restockData.costPrice) || 0, userId: user?._id });
      setRestockingProduct(null);
      setRestockData({ quantity: '', costPrice: '' });
      onRefresh();
    }
  };

  const handleDelete = (id: string) => {
    setPendingConfirm({
      message: '¿Eliminar este producto? Se perderá del inventario.',
      onConfirm: async () => { await api.deleteProduct(id); onRefresh(); },
    });
  };

  const handleGenerateBarcode = async (product: Product) => {
    setGeneratingBarcode(product._id);
    try {
      const data = await api.generateBarcode(product._id);
      if (data.barcode) {
        onRefresh();
        setTimeout(() => {
          setPrintModal({ ...product, barcode: data.barcode });
          setPrintQty(String(product.quantity || 1));
          setPrintWithBarcode(true);
        }, 300);
      }
    } catch { setBarcodeError(true); }
    finally { setGeneratingBarcode(null); }
  };

  const handleDeleteCategory = (id: string) => {
    setPendingConfirm({
      message: '¿Eliminar esta categoría? Los productos de esta categoría quedarán sin categoría.',
      onConfirm: async () => { await api.deleteCategory(id); onRefresh(); },
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          {mainTab === 'stock' && (selectedCategoryId || selectedManufacturerId || selectedEstante || selectedColumna || selectedFila) && (
            <button
              onClick={() => { setSelectedCategoryId(null); setSelectedManufacturerId(null); setSelectedEstante(''); setSelectedColumna(''); setSelectedFila(''); }}
              className="p-3 bg-white border border-gray-100 rounded-2xl text-gray-400 hover:text-indigo-600 hover:border-indigo-100 transition-all shadow-sm"
            >
              <ArrowLeft size={24} />
            </button>
          )}
          <div>
            <h2 className="text-4xl font-black text-gray-800 tracking-tighter">
              {mainTab === 'analytics'
                ? 'Analítica'
                : mainTab === 'history'
                  ? 'Reposiciones'
                  : selectedCategoryId
                    ? selectedCategoryId === 'UNASSIGNED'
                      ? 'Sin Asignar'
                      : categories.find(c => c._id === selectedCategoryId)?.name
                    : selectedManufacturerId
                      ? manufacturers.find(m => m._id === selectedManufacturerId)?.name ?? 'Proveedor'
                      : (selectedEstante || selectedColumna || selectedFila)
                        ? [selectedEstante && `Est. ${selectedEstante}`, selectedColumna && `Col. ${selectedColumna}`, selectedFila && `Fila ${selectedFila}`].filter(Boolean).join(' · ')
                        : 'Stock'}
            </h2>
            <p className="text-gray-400 font-bold tracking-widest uppercase text-[10px] mt-1">
              {mainTab === 'analytics'
                ? 'Rendimiento por Producto'
                : mainTab === 'history'
                  ? 'Historial de ingresos al stock'
                  : selectedCategoryId
                    ? selectedCategoryId === 'UNASSIGNED'
                      ? 'Productos sin categoría asignada'
                      : 'Productos en esta categoría'
                    : selectedManufacturerId
                      ? 'Productos de este proveedor'
                      : (selectedEstante || selectedColumna || selectedFila)
                        ? 'Productos en esta ubicación'
                        : 'Inventario por Categorías'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-3">
          {mainTab === 'stock' && (
            <>
              <button
                onClick={() => setIsManagingManufacturers(true)}
                className="bg-white border border-gray-200 text-gray-600 font-black px-3 md:px-6 py-3 rounded-2xl hover:bg-gray-50 transition-all shadow-sm flex items-center gap-2 group text-sm"
              >
                <Package size={16} className="group-hover:scale-110 transition-transform" />
                <span className="hidden sm:inline">Fabricantes</span>
              </button>
              <button
                onClick={() => setIsAddingCategory(true)}
                className="bg-white border border-gray-200 text-gray-600 font-black px-3 md:px-6 py-3 rounded-2xl hover:bg-gray-50 transition-all shadow-sm flex items-center gap-2 group text-sm"
              >
                <Tag size={16} className="group-hover:rotate-12 transition-transform" />
                <span className="hidden sm:inline">Gestionar </span>Categorías
              </button>
              <button
                onClick={() => {
                  setNewProduct(prev => ({ ...prev, categoryId: selectedCategoryId || '' }));
                  setIsAdding(true);
                }}
                className="bg-indigo-600 text-white font-black px-4 md:px-8 py-3 rounded-2xl hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 flex items-center gap-2 group text-sm"
              >
                <Plus size={18} className="group-hover:rotate-90 transition-transform duration-500" />
                <span className="hidden sm:inline">Nuevo </span>Producto
              </button>
            </>
          )}
          {mainTab === 'analytics' && (
            <button
              onClick={() => {
                setLoadingStats(true);
                (api as any).getProductStats()
                  .then((data: any[]) => { if (Array.isArray(data)) setProductStats(data); })
                  .catch(() => {})
                  .finally(() => setLoadingStats(false));
              }}
              className="bg-white border border-gray-200 text-gray-600 font-black px-6 py-3 rounded-2xl hover:bg-gray-50 transition-all shadow-sm flex items-center gap-2">
              <RefreshCw size={18} className={loadingStats ? 'animate-spin' : ''} />
              Actualizar
            </button>
          )}
          {mainTab === 'history' && (
            <button
              onClick={() => {
                setLoadingMovements(true);
                (api as any).getStockMovements()
                  .then((data: StockMovement[]) => { if (Array.isArray(data)) setStockMovements(data); })
                  .catch(() => {})
                  .finally(() => setLoadingMovements(false));
              }}
              className="bg-white border border-gray-200 text-gray-600 font-black px-6 py-3 rounded-2xl hover:bg-gray-50 transition-all shadow-sm flex items-center gap-2">
              <RefreshCw size={18} className={loadingMovements ? 'animate-spin' : ''} />
              Actualizar
            </button>
          )}
        </div>
      </div>

      {/* ── Pestañas Stock / Analítica / Reposiciones ── */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setMainTab('stock')}
          className={cn("px-6 py-3 rounded-2xl font-black text-sm transition-all flex items-center gap-2",
            mainTab === 'stock'
              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200"
              : "bg-white text-gray-500 border border-gray-100 hover:bg-gray-50")}>
          <Package size={16} /> Inventario
        </button>
        <button
          onClick={() => setMainTab('analytics')}
          className={cn("px-6 py-3 rounded-2xl font-black text-sm transition-all flex items-center gap-2",
            mainTab === 'analytics'
              ? "bg-violet-600 text-white shadow-lg shadow-violet-200"
              : "bg-white text-gray-500 border border-gray-100 hover:bg-gray-50")}>
          <BarChart2 size={16} /> Analítica
        </button>
        <button
          onClick={() => setMainTab('history')}
          className={cn("px-6 py-3 rounded-2xl font-black text-sm transition-all flex items-center gap-2",
            mainTab === 'history'
              ? "bg-emerald-600 text-white shadow-lg shadow-emerald-200"
              : "bg-white text-gray-500 border border-gray-100 hover:bg-gray-50")}>
          <History size={16} /> Reposiciones
        </button>
      </div>

      {/* ════════════════════════════════════════════════════════
          PESTAÑA ANALÍTICA
          ════════════════════════════════════════════════════════ */}
      {mainTab === 'analytics' && (
        <div className="space-y-6">
          {/* Ordenar por */}
          <div className="flex gap-2 flex-wrap">
            {([
              { key: 'units',   label: 'Más vendidos',   icon: <ShoppingCart size={14} /> },
              { key: 'revenue', label: 'Mayor ingreso',  icon: <DollarSign   size={14} /> },
              { key: 'margin',  label: 'Mayor margen',   icon: <TrendingUp   size={14} /> },
              { key: 'idle',    label: 'Sin movimiento', icon: <Clock        size={14} /> },
            ] as { key: StatsSort; label: string; icon: React.ReactNode }[]).map(opt => (
              <button key={opt.key} onClick={() => setStatsSort(opt.key)}
                className={cn("px-4 py-2 rounded-2xl font-black text-xs transition-all flex items-center gap-1.5",
                  statsSort === opt.key
                    ? "bg-violet-600 text-white shadow-lg shadow-violet-200"
                    : "bg-white text-gray-500 border border-gray-100 hover:bg-gray-50")}>
                {opt.icon} {opt.label}
              </button>
            ))}
          </div>

          {loadingStats ? (
            <div className="flex items-center justify-center py-24">
              <div className="text-center space-y-3">
                <RefreshCw size={32} className="animate-spin text-violet-400 mx-auto" />
                <p className="text-sm font-bold text-gray-400">Cargando estadísticas…</p>
              </div>
            </div>
          ) : (() => {
            // Enriquecer: unir productos sin ventas con los que tienen stats
            const statsMap = new Map(productStats.map(s => [String(s.productId), s]));
            const allEntries = products.map(p => {
              const s = statsMap.get(String(p._id));
              return s ? { ...(s as Record<string, any>), _product: p } : {
                productId: p._id, name: p.model, totalUnits: 0, totalRevenue: 0,
                totalCost: 0, profit: 0, margin: 0, prices: [],
                lastSaleDate: null, daysSinceLastSale: null, isRentable: true,
                _product: p,
              };
            });

            // Ordenar
            const sorted = [...allEntries].sort((a, b) => {
              if (statsSort === 'units')   return b.totalUnits - a.totalUnits;
              if (statsSort === 'revenue') return b.totalRevenue - a.totalRevenue;
              if (statsSort === 'margin')  return b.margin - a.margin;
              if (statsSort === 'idle') {
                // Los nunca vendidos primero, luego los más inactivos
                if (a.daysSinceLastSale === null && b.daysSinceLastSale === null) return 0;
                if (a.daysSinceLastSale === null) return -1;
                if (b.daysSinceLastSale === null) return 1;
                return b.daysSinceLastSale - a.daysSinceLastSale;
              }
              return 0;
            });

            const hasSales = sorted.some(e => e.totalUnits > 0);

            if (!hasSales && sorted.length === 0) return (
              <div className="text-center py-20">
                <BarChart2 size={40} className="mx-auto text-gray-200 mb-4" />
                <p className="font-black text-gray-400">Sin productos registrados</p>
              </div>
            );

            return (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sorted.map(entry => {
                  const p = entry._product as Product;
                  const cat = categories.find(c => c._id === p.categoryId);
                  const hasSaleData = entry.totalUnits > 0;
                  const isIdle = entry.daysSinceLastSale !== null && entry.daysSinceLastSale > 30;
                  const isNeverSold = !hasSaleData;
                  const isLowMargin = hasSaleData && entry.margin < 10;
                  const statusColor = !hasSaleData
                    ? 'bg-gray-50 border-gray-100'
                    : !entry.isRentable || isLowMargin
                      ? 'bg-red-50 border-red-100'
                      : isIdle
                        ? 'bg-amber-50 border-amber-100'
                        : 'bg-emerald-50 border-emerald-100';
                  const dotColor  = !hasSaleData ? 'bg-gray-300'
                    : !entry.isRentable || isLowMargin ? 'bg-red-500'
                    : isIdle ? 'bg-amber-500'
                    : 'bg-emerald-500';

                  return (
                    <motion.div
                      key={String(entry.productId)}
                      layout
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white rounded-[32px] border border-gray-100 shadow-sm hover:shadow-xl transition-all overflow-hidden"
                    >
                      {/* Cabecera */}
                      <div className={cn("px-6 pt-6 pb-4 flex items-start gap-3", hasSaleData ? '' : 'opacity-60')}>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-black text-gray-800 text-base leading-snug truncate">{entry.name}</h3>
                          {cat && <p className="text-[10px] font-bold text-gray-400 mt-0.5 uppercase tracking-widest">{cat.name}</p>}
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className={cn("w-2.5 h-2.5 rounded-full flex-shrink-0", dotColor)} />
                          <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">
                            {isNeverSold ? 'Sin ventas' : !entry.isRentable || isLowMargin ? 'Bajo margen' : isIdle ? 'Inactivo' : 'Activo'}
                          </span>
                        </div>
                      </div>

                      {/* Stats grid */}
                      {hasSaleData ? (
                        <div className="px-6 pb-6 space-y-4">
                          <div className="grid grid-cols-3 gap-3">
                            <div className="bg-gray-50 rounded-2xl p-3 text-center">
                              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Vendidos</p>
                              <p className="text-xl font-black text-gray-800 tracking-tighter">{entry.totalUnits}</p>
                              <p className="text-[9px] text-gray-400 font-bold">unidades</p>
                            </div>
                            <div className="bg-emerald-50 rounded-2xl p-3 text-center">
                              <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-1">Ganancia</p>
                              <p className="text-xl font-black text-emerald-600 tracking-tighter">
                                {entry.profit >= 1_000_000
                                  ? `${(entry.profit / 1_000_000).toFixed(1)}M`
                                  : entry.profit >= 1_000
                                    ? `${Math.round(entry.profit / 1_000)}K`
                                    : Math.round(entry.profit).toLocaleString('es-PY')}
                              </p>
                              <p className="text-[9px] text-emerald-400 font-bold">Gs.</p>
                            </div>
                            <div className={cn("rounded-2xl p-3 text-center", entry.margin >= 20 ? 'bg-indigo-50' : entry.margin >= 10 ? 'bg-amber-50' : 'bg-red-50')}>
                              <p className={cn("text-[9px] font-black uppercase tracking-widest mb-1", entry.margin >= 20 ? 'text-indigo-500' : entry.margin >= 10 ? 'text-amber-500' : 'text-red-500')}>Margen</p>
                              <p className={cn("text-xl font-black tracking-tighter", entry.margin >= 20 ? 'text-indigo-600' : entry.margin >= 10 ? 'text-amber-600' : 'text-red-600')}>
                                {entry.margin.toFixed(1)}%
                              </p>
                              <div className="mt-0.5">
                                {entry.margin >= 20
                                  ? <TrendingUp size={12} className="mx-auto text-indigo-400" />
                                  : entry.margin >= 10
                                    ? <TrendingUp size={12} className="mx-auto text-amber-400" />
                                    : <TrendingDown size={12} className="mx-auto text-red-400" />}
                              </div>
                            </div>
                          </div>

                          {/* Ingresos */}
                          <div className="flex items-center justify-between bg-gray-50 rounded-2xl px-4 py-2.5">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Ingresos totales</p>
                            <p className="font-black text-gray-700">
                              Gs. {entry.totalRevenue >= 1_000_000
                                ? `${(entry.totalRevenue / 1_000_000).toFixed(2)}M`
                                : entry.totalRevenue.toLocaleString('es-PY')}
                            </p>
                          </div>

                          {/* Precios vendidos */}
                          {entry.prices && entry.prices.length > 1 && (
                            <div className="space-y-1.5">
                              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Precios a los que se vendió</p>
                              <div className="flex flex-wrap gap-1.5">
                                {(entry.prices as number[]).map((pr: number, i: number) => (
                                  <span key={i} className="text-[10px] font-black bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-xl">
                                    Gs. {pr.toLocaleString('es-PY')}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Última venta */}
                          <div className="flex items-center gap-2">
                            <Clock size={12} className={isIdle ? 'text-amber-500' : 'text-gray-300'} />
                            <p className={cn("text-[10px] font-bold", isIdle ? 'text-amber-600' : 'text-gray-400')}>
                              {entry.daysSinceLastSale === 0
                                ? 'Vendido hoy'
                                : entry.daysSinceLastSale === 1
                                  ? 'Última venta: ayer'
                                  : `Última venta hace ${entry.daysSinceLastSale} días`}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="px-6 pb-6">
                          <div className="bg-gray-50 rounded-2xl p-4 text-center">
                            <p className="text-[10px] font-bold text-gray-400">Este producto nunca ha sido vendido</p>
                            <p className="text-[10px] font-bold text-gray-400 mt-0.5">
                              Stock actual: <span className="font-black text-gray-600">{p.quantity} unidades</span>
                            </p>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          PESTAÑA HISTORIAL DE REPOSICIONES
          ════════════════════════════════════════════════════════ */}
      {mainTab === 'history' && (() => {
        const filtered = stockMovements.filter(m => {
          const matchSearch = !historySearch ||
            (m.productModel ?? '').toLowerCase().includes(historySearch.toLowerCase()) ||
            (m.userName ?? '').toLowerCase().includes(historySearch.toLowerCase()) ||
            (m.categoryName ?? '').toLowerCase().includes(historySearch.toLowerCase()) ||
            (m.note ?? '').toLowerCase().includes(historySearch.toLowerCase());
          const d = new Date(m.createdAt);
          const matchFrom = !historyDateFrom || d >= new Date(historyDateFrom);
          const matchTo   = !historyDateTo   || d <= new Date(historyDateTo + 'T23:59:59');
          return matchSearch && matchFrom && matchTo;
        });

        const totalUnits    = filtered.reduce((s, m) => s + m.quantity, 0);
        const totalInvested = filtered.reduce((s, m) => s + m.quantity * m.costPrice, 0);
        const totalMovs     = filtered.length;

        return (
          <div className="space-y-6">
            {/* Filtros */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Buscar por producto, categoría, usuario o nota..."
                  value={historySearch}
                  onChange={e => setHistorySearch(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-2xl outline-none focus:border-emerald-400 font-medium text-sm"
                />
              </div>
              <input
                type="date"
                value={historyDateFrom}
                onChange={e => setHistoryDateFrom(e.target.value)}
                className="px-4 py-3 bg-white border border-gray-200 rounded-2xl outline-none focus:border-emerald-400 font-medium text-sm text-gray-600"
              />
              <input
                type="date"
                value={historyDateTo}
                onChange={e => setHistoryDateTo(e.target.value)}
                className="px-4 py-3 bg-white border border-gray-200 rounded-2xl outline-none focus:border-emerald-400 font-medium text-sm text-gray-600"
              />
              {(historySearch || historyDateFrom || historyDateTo) && (
                <button
                  onClick={() => { setHistorySearch(''); setHistoryDateFrom(''); setHistoryDateTo(''); }}
                  className="px-4 py-3 bg-gray-100 rounded-2xl text-gray-500 font-bold text-sm hover:bg-gray-200 transition-colors">
                  Limpiar
                </button>
              )}
            </div>

            {/* Estadísticas resumen */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white rounded-3xl p-5 border border-gray-100 text-center">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Reposiciones</p>
                <p className="text-3xl font-black text-gray-800">{totalMovs}</p>
              </div>
              <div className="bg-white rounded-3xl p-5 border border-gray-100 text-center">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Unidades ingresadas</p>
                <p className="text-3xl font-black text-emerald-600">{totalUnits.toLocaleString()}</p>
              </div>
              <div className="bg-white rounded-3xl p-5 border border-gray-100 text-center">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total invertido</p>
                <p className="text-2xl font-black text-indigo-600">Gs. {totalInvested.toLocaleString()}</p>
              </div>
            </div>

            {/* Lista de movimientos */}
            {loadingMovements ? (
              <div className="flex items-center justify-center py-20">
                <RefreshCw className="animate-spin text-emerald-500" size={32} />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-20 text-gray-400">
                <History size={48} className="mx-auto mb-3 opacity-30" />
                <p className="font-black text-lg">Sin reposiciones registradas</p>
                <p className="text-sm mt-1">Las próximas aparecerán acá automáticamente</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map(m => {
                  const d    = new Date(m.createdAt);
                  const date = d.toLocaleDateString('es-PY', { day: '2-digit', month: 'short', year: '2-digit' });
                  const time = d.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' });
                  const total = m.quantity * m.costPrice;
                  return (
                    <motion.div
                      key={m._id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white rounded-3xl border border-gray-100 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                      {/* Fecha */}
                      <div className="w-20 shrink-0 text-center bg-emerald-50 rounded-2xl py-3">
                        <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">{date.split(' ')[1]}</p>
                        <p className="text-xl font-black text-gray-800 leading-none">{date.split(' ')[0]}</p>
                        <p className="text-[10px] text-gray-400 font-bold">{date.split(' ')[2]}</p>
                        <p className="text-[10px] text-gray-400 font-mono mt-1">{time}</p>
                      </div>

                      {/* Producto */}
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-gray-800 text-base truncate">{m.productModel || '—'}</p>
                        {m.categoryName && (
                          <span className="inline-block text-[10px] font-black bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full uppercase tracking-widest mt-1">
                            {m.categoryName}
                          </span>
                        )}
                        {m.note && (
                          <p className="text-xs text-gray-400 font-medium mt-1 flex items-center gap-1">
                            <StickyNote size={11} />
                            {m.note}
                          </p>
                        )}
                      </div>

                      {/* Quién */}
                      {m.userName ? (
                        <div className="flex items-center gap-2 text-sm text-gray-500 shrink-0">
                          <div className="w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center">
                            <User size={13} />
                          </div>
                          <span className="font-bold">{m.userName}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-sm text-gray-300 shrink-0">
                          <div className="w-7 h-7 bg-gray-50 rounded-full flex items-center justify-center">
                            <User size={13} />
                          </div>
                          <span className="font-bold text-xs">Historial</span>
                        </div>
                      )}

                      {/* Métricas */}
                      <div className="flex gap-4 shrink-0">
                        <div className="text-center">
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Unidades</p>
                          <p className="text-xl font-black text-emerald-600">+{m.quantity}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Costo/u</p>
                          <p className="text-sm font-black text-gray-700">Gs. {m.costPrice.toLocaleString()}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total</p>
                          <p className="text-sm font-black text-indigo-600">Gs. {total.toLocaleString()}</p>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {mainTab === 'stock' && (<>

      <div className="relative group">
        <Search className="absolute left-4 sm:left-6 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-600 transition-colors" size={20} />
        <input
          type="text"
          placeholder="Buscar por modelo, fabricante o estante (ej: 'Samsung', 'Est. A1')..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full bg-white border border-gray-100 rounded-[30px] py-4 sm:py-6 pl-12 sm:pl-16 pr-6 sm:pr-8 outline-none shadow-sm focus:shadow-xl focus:border-indigo-100 transition-all font-bold text-gray-700"
        />
      </div>

      {/* ── Filtro por fabricante / proveedor ── */}
      {manufacturers.length > 0 && (
        <div className="flex gap-2 flex-wrap items-center">
          <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex-shrink-0">Proveedor:</span>
          <button
            onClick={() => setSelectedManufacturerId(null)}
            className={cn(
              "px-3 py-1.5 rounded-2xl font-black text-xs transition-all",
              !selectedManufacturerId
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
                : "bg-white text-gray-500 border border-gray-100 hover:bg-gray-50"
            )}>
            Todos
          </button>
          {manufacturers.map(m => (
            <button
              key={m._id}
              onClick={() => setSelectedManufacturerId(prev => prev === m._id ? null : m._id)}
              className={cn(
                "px-3 py-1.5 rounded-2xl font-black text-xs transition-all",
                selectedManufacturerId === m._id
                  ? "bg-sky-500 text-white shadow-md shadow-sky-200"
                  : "bg-white text-gray-500 border border-gray-100 hover:bg-sky-50 hover:text-sky-600 hover:border-sky-100"
              )}>
              {m.name}
            </button>
          ))}
        </div>
      )}

      {/* ── Filtro por ubicación: Estante / Columna / Fila ── */}
      {allEstantes.length > 0 && (
        <div className="flex gap-3 flex-wrap items-center bg-white border border-gray-100 rounded-2xl px-4 py-3 shadow-sm">
          <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1 flex-shrink-0">
            <MapPin size={10} className="text-indigo-400" /> Ubicación:
          </span>

          {/* Estante */}
          <div className="flex flex-col gap-0.5">
            <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest ml-1">Estante</span>
            <select
              value={selectedEstante}
              onChange={e => { setSelectedEstante(e.target.value); setSelectedColumna(''); setSelectedFila(''); }}
              className={cn(
                "px-3 py-2 rounded-xl font-black text-xs border-2 outline-none transition-all cursor-pointer",
                selectedEstante
                  ? "border-indigo-400 bg-indigo-50 text-indigo-700"
                  : "border-gray-100 bg-gray-50 text-gray-600 hover:border-indigo-200"
              )}
            >
              <option value="">Todos</option>
              {allEstantes.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>

          {/* Columna — solo si hay estante o hay columnas disponibles */}
          <div className="flex flex-col gap-0.5">
            <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest ml-1">Columna</span>
            <select
              value={selectedColumna}
              onChange={e => { setSelectedColumna(e.target.value); setSelectedFila(''); }}
              disabled={allColumnas.length === 0}
              className={cn(
                "px-3 py-2 rounded-xl font-black text-xs border-2 outline-none transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed",
                selectedColumna
                  ? "border-indigo-400 bg-indigo-50 text-indigo-700"
                  : "border-gray-100 bg-gray-50 text-gray-600 hover:border-indigo-200"
              )}
            >
              <option value="">Todas</option>
              {allColumnas.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Fila */}
          <div className="flex flex-col gap-0.5">
            <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest ml-1">Fila</span>
            <select
              value={selectedFila}
              onChange={e => setSelectedFila(e.target.value)}
              disabled={allFilas.length === 0}
              className={cn(
                "px-3 py-2 rounded-xl font-black text-xs border-2 outline-none transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed",
                selectedFila
                  ? "border-indigo-400 bg-indigo-50 text-indigo-700"
                  : "border-gray-100 bg-gray-50 text-gray-600 hover:border-indigo-200"
              )}
            >
              <option value="">Todas</option>
              {allFilas.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>

          {/* Limpiar filtro */}
          {(selectedEstante || selectedColumna || selectedFila) && (
            <button
              onClick={() => { setSelectedEstante(''); setSelectedColumna(''); setSelectedFila(''); }}
              className="mt-4 px-3 py-2 rounded-xl font-black text-xs text-gray-400 border border-gray-100 hover:bg-red-50 hover:text-red-500 hover:border-red-100 transition-all"
            >
              ✕ Limpiar
            </button>
          )}
        </div>
      )}

      {/* Warranties Section */}
      {warranties.length > 0 && (
        <div className="mb-12">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center shadow-inner">
              <ShieldCheck size={28} />
            </div>
            <div>
              <h2 className="text-3xl font-black text-gray-800 tracking-tight italic">Productos en Garantía</h2>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Pendientes de resolución / Fallas detectadas</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {warranties.map((w) => (
              <div key={w._id} className="bg-white p-6 rounded-[40px] border-2 border-amber-100 shadow-sm flex items-center justify-between hover:shadow-xl transition-all group">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition-all">
                    <Package size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-gray-800 tracking-tight">{w.productName}</h3>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">{w.reason}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-amber-600 tracking-tighter">Gs. {w.amount.toLocaleString()}</p>
                  <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest leading-none">PENDIENTE</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <AnimatePresence mode="wait">
        {!selectedCategoryId && !searchTerm && !selectedManufacturerId && !selectedEstante && !selectedColumna && !selectedFila ? (
          <motion.div
            key="categories"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            {filteredCategories.map((c) => {
              const lowStock = getLowStockCount(c._id);
              const totalItems = products.filter(p => p.categoryId === c._id).length;
              return (
                <motion.div
                  whileHover={{ y: -5 }}
                  key={c._id}
                  onClick={() => setSelectedCategoryId(c._id)}
                  className="bg-white p-5 sm:p-8 rounded-[28px] sm:rounded-[40px] shadow-sm border border-gray-100 hover:shadow-2xl transition-all cursor-pointer group relative overflow-hidden"
                >
                  <div className="flex justify-between items-start mb-6">
                    <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                      <Tag size={32} />
                    </div>
                    <span className="text-[10px] font-black px-3 py-1 bg-gray-50 text-gray-400 rounded-full uppercase tracking-widest">
                      {totalItems} Modelos
                    </span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black text-gray-800 mb-3 sm:mb-4 tracking-tight">{c.name}</h3>

                  {lowStock > 0 && (
                    <div className="flex items-center gap-2 text-red-500 bg-red-50 p-3 rounded-xl border border-red-100">
                      <AlertTriangle size={16} />
                      <span className="text-xs font-black uppercase tracking-tight">
                        {lowStock} productos en falta
                      </span>
                    </div>
                  )}
                </motion.div>
              );
            })}

            {/* ── Tarjeta virtual "Sin Asignar" ── */}
            {(() => {
              const unassigned = products.filter(p => !p.categoryId);
              if (unassigned.length === 0) return null;
              return (
                <motion.div
                  whileHover={{ y: -5 }}
                  key="UNASSIGNED"
                  onClick={() => setSelectedCategoryId('UNASSIGNED')}
                  className="bg-white p-5 sm:p-8 rounded-[28px] sm:rounded-[40px] shadow-sm border-2 border-dashed border-amber-200 hover:shadow-2xl hover:border-amber-400 transition-all cursor-pointer group relative overflow-hidden"
                >
                  <div className="flex justify-between items-start mb-6">
                    <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-500 group-hover:bg-amber-500 group-hover:text-white transition-all">
                      <AlertTriangle size={32} />
                    </div>
                    <span className="text-[10px] font-black px-3 py-1 bg-amber-50 text-amber-500 rounded-full uppercase tracking-widest">
                      {unassigned.length} Modelos
                    </span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black text-amber-600 mb-3 sm:mb-4 tracking-tight">Sin Asignar</h3>
                  <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest">
                    Productos sin categoría
                  </p>
                </motion.div>
              );
            })()}
          </motion.div>
        ) : (
          <motion.div 
            key="products"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            {filteredProducts.map((p) => {
              const isLowStock = p.quantity <= p.purchasedQuantity * 0.1;
              return (
                <motion.div 
                  layout
                  key={p._id} 
                  className="bg-white p-4 sm:p-7 rounded-[28px] sm:rounded-[40px] shadow-sm border border-gray-100 hover:shadow-2xl transition-all group relative overflow-hidden"
                >
                  <div className="relative">
                    <div className="flex justify-between items-start mb-6">
                      <div className={cn(
                        "w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-inner",
                        isLowStock ? "bg-red-50 text-red-500" : "bg-gray-50 text-gray-400 group-hover:bg-indigo-600 group-hover:text-white"
                      )}>
                        <Package size={28} />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setRestockingProduct(p);
                            setRestockData({ quantity: '', costPrice: String(p.costPrice) });
                          }}
                          className="p-2 sm:p-3 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-xl transition-all shadow-sm"
                          title="Reponer Stock"
                        >
                          <RefreshCw size={18} />
                        </button>
                        <button
                          onClick={() => { setPrintModal(p); setPrintQty(String(p.quantity || 1)); setPrintWithBarcode(!!p.barcode); }}
                          className="p-2 sm:p-3 bg-gray-50 text-gray-400 hover:bg-emerald-50 hover:text-emerald-600 rounded-xl transition-all shadow-sm"
                          title="Imprimir etiquetas">
                          <Printer size={18} />
                        </button>
                        <button onClick={() => { setEditingProduct(p); setEditLoc(parseLocation(p.location || '')); setEditCostUsd(p.costPrice > 0 ? (p.costPrice / (exchangeRate || 6300)).toFixed(2) : ''); }} className="p-2 sm:p-3 bg-gray-50 text-gray-400 hover:bg-indigo-50 hover:text-indigo-600 rounded-xl transition-all shadow-sm"><Edit2 size={16} /></button>
                        <button onClick={() => handleDelete(p._id)} className="p-2 sm:p-3 bg-gray-50 text-gray-400 hover:bg-red-50 hover:text-red-500 rounded-xl transition-all shadow-sm"><Trash2 size={16} /></button>
                      </div>
                    </div>

                    <h3 className="text-lg sm:text-2xl font-black text-gray-800 mb-2 tracking-tight group-hover:text-indigo-600 transition-colors">{p.model}</h3>
                    <div className="flex items-center gap-2 mb-6 flex-wrap">
                      {/* Categoría — solo visible en búsqueda global */}
                      {!selectedCategoryId && searchTerm && (
                        <span className="text-[10px] font-black px-3 py-1 bg-violet-50 text-violet-600 rounded-full uppercase tracking-widest flex items-center gap-1">
                          <Tag size={10} /> {categories.find(c => c._id === p.categoryId)?.name ?? 'Sin Asignar'}
                        </span>
                      )}
                      {isLowStock && (
                        <span className="text-[10px] font-black px-3 py-1 bg-red-100 text-red-600 rounded-full uppercase tracking-widest flex items-center gap-1">
                          <AlertTriangle size={10} /> En Falta
                        </span>
                      )}
                      {p.location && displayLocation(p.location) && (
                        <span className="text-[10px] font-black px-3 py-1 bg-indigo-50 text-indigo-500 rounded-full uppercase tracking-widest flex items-center gap-1">
                          <MapPin size={10} /> {displayLocation(p.location)}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 group-hover:bg-white transition-colors">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Stock</p>
                        <p className={cn("text-2xl font-black tracking-tighter", isLowStock ? "text-red-500" : "text-gray-800")}>
                          {p.quantity} <span className="text-xs text-gray-400 font-bold">/ {p.purchasedQuantity}</span>
                        </p>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 group-hover:bg-white transition-colors">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Precio Normal</p>
                        <p className="text-2xl font-black text-emerald-500 tracking-tighter">Gs. {p.salePrice.toLocaleString()}</p>
                        {((p.priceWholesale ?? 0) > 0 || (p.priceCheap ?? 0) > 0) && (
                          <div className="flex gap-1 mt-1.5 flex-wrap">
                            {(p.priceWholesale ?? 0) > 0 && (
                              <span className="text-[9px] font-black text-purple-600 bg-purple-50 px-2 py-0.5 rounded-lg">
                                🏪 {(p.priceWholesale!).toLocaleString()}
                              </span>
                            )}
                            {(p.priceCheap ?? 0) > 0 && (
                              <span className="text-[9px] font-black text-orange-600 bg-orange-50 px-2 py-0.5 rounded-lg">
                                💸 {(p.priceCheap!).toLocaleString()}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-gray-50 space-y-2">
                      {/* Fabricante */}
                      {p.manufacturerId && manufacturers.find(m => m._id === p.manufacturerId) && (
                        <div>
                          <span className="text-[9px] font-black px-2.5 py-1 bg-sky-50 text-sky-600 rounded-full uppercase tracking-widest border border-sky-100">
                            {manufacturers.find(m => m._id === p.manufacturerId)?.name}
                          </span>
                        </div>
                      )}
                      {/* Costo en verde con Gs + USD */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2 flex-1">
                          <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest leading-none">Costo</p>
                          <p className="text-sm font-black text-emerald-700 tracking-tight mt-0.5 leading-none">
                            Gs. {p.costPrice.toLocaleString()}
                          </p>
                          {p.costPrice > 0 && (
                            <p className="text-[9px] font-bold text-emerald-400 mt-1 leading-none">
                              USD {(p.costPrice / (exchangeRate || 6300)).toFixed(2)}
                            </p>
                          )}
                        </div>
                        {p.isWholesale && (
                          <span className="text-[9px] font-black text-purple-500 bg-purple-50 px-2.5 py-1.5 rounded-full uppercase tracking-widest border border-purple-100 flex-shrink-0">
                            Mayorista
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      </>)} {/* end mainTab === 'stock' */}

      {isAdding && (
        <Modal title="Nuevo Producto" onClose={() => setIsAdding(false)}>
          <form onSubmit={handleAdd} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Modelo</label>
                <input required value={newProduct.model} onChange={e => setNewProduct({...newProduct, model: e.target.value.toUpperCase()})} className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl outline-none transition-all font-bold" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Categoría</label>
                <select value={newProduct.categoryId} onChange={e => setNewProduct({...newProduct, categoryId: e.target.value})} className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl outline-none transition-all font-bold">
                  <option value="">Sin categoría</option>
                  {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Fabricante</label>
                <select value={newProduct.manufacturerId ?? ''} onChange={e => setNewProduct({...newProduct, manufacturerId: e.target.value || undefined})} className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl outline-none transition-all font-bold">
                  <option value="">Sin fabricante</option>
                  {manufacturers.map(m => <option key={m._id} value={m._id}>{m.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Cantidad Inicial</label>
                <NumericInput value={String(newProduct.purchasedQuantity ?? '')} onChange={raw => setNewProduct({...newProduct, purchasedQuantity: Number(raw) || 0, quantity: Number(raw) || 0})} className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl outline-none transition-all font-bold" />
              </div>
              <div className="col-span-full space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Precio Costo</label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest ml-1">Guaraníes (Gs.)</p>
                    <NumericInput
                      value={String(newProduct.costPrice || '')}
                      onChange={raw => {
                        const gs = Number(raw) || 0;
                        setNewProduct({ ...newProduct, costPrice: gs });
                        setNewCostUsd(gs > 0 ? (gs / (exchangeRate || 6300)).toFixed(2) : '');
                      }}
                      className="w-full p-4 bg-emerald-50 border-2 border-transparent focus:border-emerald-500 focus:bg-white rounded-2xl outline-none transition-all font-bold"
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest ml-1">Dólares (USD)</p>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={newCostUsd}
                      onChange={e => {
                        const v = e.target.value;
                        setNewCostUsd(v);
                        const usd = parseFloat(v.replace(',', '.'));
                        if (!isNaN(usd)) setNewProduct(prev => ({ ...prev, costPrice: Math.round(usd * (exchangeRate || 6300)) }));
                      }}
                      className="w-full p-4 bg-blue-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl outline-none transition-all font-bold"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Precio Normal · Cliente (Gs.)</label>
                <NumericInput value={String(newProduct.salePrice ?? '')} onChange={raw => setNewProduct({...newProduct, salePrice: Number(raw) || 0})} className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl outline-none transition-all font-bold" />
              </div>

              {/* ── Precios adicionales ── */}
              <div className="col-span-full space-y-3 bg-gray-50 rounded-2xl p-4 border border-gray-100">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Precios adicionales <span className="font-bold normal-case text-gray-300">(opcionales — dejá en 0 si no usás)</span>
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-purple-500 uppercase tracking-widest ml-1 flex items-center gap-1">
                      🏪 Precio Mayorista (Gs.)
                    </label>
                    <NumericInput value={String(newProduct.priceWholesale ?? '')} onChange={raw => setNewProduct({...newProduct, priceWholesale: Number(raw) || 0})} className="w-full p-4 bg-white border-2 border-transparent focus:border-purple-500 focus:bg-white rounded-2xl outline-none transition-all font-bold" placeholder="0" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-orange-500 uppercase tracking-widest ml-1 flex items-center gap-1">
                      💸 Precio Tacaño (Gs.)
                    </label>
                    <NumericInput value={String(newProduct.priceCheap ?? '')} onChange={raw => setNewProduct({...newProduct, priceCheap: Number(raw) || 0})} className="w-full p-4 bg-white border-2 border-transparent focus:border-orange-400 focus:bg-white rounded-2xl outline-none transition-all font-bold" placeholder="0" />
                  </div>
                </div>
              </div>

              <div className="col-span-full space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4 flex items-center gap-1.5">
                  <MapPin size={11} className="text-indigo-400" /> Ubicación en Estante
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Estante</p>
                    <input
                      value={newLoc.estante}
                      onChange={e => setNewLoc({ ...newLoc, estante: e.target.value })}
                      placeholder="1"
                      className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl outline-none transition-all font-black text-center text-lg"
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Columna</p>
                    <input
                      value={newLoc.columna}
                      onChange={e => setNewLoc({ ...newLoc, columna: e.target.value })}
                      placeholder="A"
                      className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl outline-none transition-all font-black text-center text-lg"
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Fila</p>
                    <input
                      value={newLoc.fila}
                      onChange={e => setNewLoc({ ...newLoc, fila: e.target.value })}
                      placeholder="3"
                      className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl outline-none transition-all font-black text-center text-lg"
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-2 col-span-full">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Código de Barras (EAN-13)</label>
                <div className="relative">
                  <Scan className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    data-barcode="true"
                    value={newProduct.barcode}
                    onChange={e => setNewProduct({...newProduct, barcode: e.target.value})}
                    placeholder="Escaneá o escribí el código"
                    className="w-full pl-12 p-4 bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl outline-none transition-all font-bold font-mono"
                  />
                </div>
              </div>
            </div>
            <button type="submit" className="w-full bg-indigo-600 text-white font-black py-5 rounded-2xl shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all">Guardar Producto</button>
          </form>
        </Modal>
      )}

      {isAddingCategory && (
        <Modal title="Gestionar Categorías" onClose={() => setIsAddingCategory(false)}>
          <div className="space-y-6">

            {/* Formulario nueva categoría */}
            <form onSubmit={handleAddCategory} className="space-y-4 p-5 bg-indigo-50 rounded-3xl border border-indigo-100">
              <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Nueva Categoría</p>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nombre</label>
                <input
                  required
                  placeholder="Ej: Celulares, Accesorios..."
                  value={newCategory.name}
                  onChange={e => setNewCategory({ ...newCategory, name: e.target.value })}
                  className="w-full p-4 bg-white border-2 border-transparent focus:border-indigo-600 rounded-2xl outline-none transition-all font-bold"
                />
              </div>
              {/* Tipo de categoría */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                  Tipo de Categoría
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button"
                    onClick={() => setNewCategory(p => ({ ...p, isLocal: false }))}
                    className={cn(
                      "p-4 rounded-2xl border-2 text-left transition-all",
                      !newCategory.isLocal
                        ? "border-indigo-600 bg-indigo-50"
                        : "border-gray-100 bg-gray-50 hover:border-gray-200"
                    )}>
                    <p className="text-sm font-black text-gray-800">📦 Producto Común</p>
                    <p className="text-[10px] font-bold text-gray-400 mt-1 leading-tight">
                      Mercadería para revender. Usa el código EAN del fabricante.
                    </p>
                  </button>
                  <button type="button"
                    onClick={() => setNewCategory(p => ({ ...p, isLocal: true }))}
                    className={cn(
                      "p-4 rounded-2xl border-2 text-left transition-all",
                      newCategory.isLocal
                        ? "border-emerald-600 bg-emerald-50"
                        : "border-gray-100 bg-gray-50 hover:border-gray-200"
                    )}>
                    <p className="text-sm font-black text-gray-800">🏪 Producto del Local</p>
                    <p className="text-[10px] font-bold text-gray-400 mt-1 leading-tight">
                      Artículos propios (usados, reparados). Se genera código interno.
                    </p>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                    Días de Garantía
                  </label>
                  <div className="flex items-center gap-2">
                    <NumericInput
                      placeholder="2"
                      value={newCategory.warrantyDays}
                      onChange={raw => setNewCategory({ ...newCategory, warrantyDays: raw })}
                      className="w-24 p-4 bg-white border-2 border-transparent focus:border-indigo-600 rounded-2xl outline-none transition-all font-black text-2xl text-center"
                    />
                    <span className="font-bold text-gray-500 text-sm">días</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-amber-500 uppercase tracking-widest ml-1">
                    Stock Mínimo
                  </label>
                  <div className="flex items-center gap-2">
                    <NumericInput
                      placeholder="5"
                      value={newCategory.minStock}
                      onChange={raw => setNewCategory({ ...newCategory, minStock: raw })}
                      className="w-24 p-4 bg-amber-50 border-2 border-transparent focus:border-amber-400 rounded-2xl outline-none transition-all font-black text-2xl text-center"
                    />
                    <span className="font-bold text-gray-500 text-sm">unidades</span>
                  </div>
                </div>
              </div>
              <button type="submit" className="w-full bg-indigo-600 text-white font-black py-3 rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200">
                Agregar Categoría
              </button>
            </form>

            {/* Lista de categorías existentes */}
            <div className="space-y-3">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Categorías Existentes</p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {categories.map(c => (
                  editingCategory?._id === c._id ? (
                    // ── Editar categoría inline ──
                    <form key={c._id} onSubmit={handleUpdateCategory} className="p-4 bg-indigo-50 border-2 border-indigo-200 rounded-2xl space-y-3">
                      <input
                        required
                        value={editingCategory.name}
                        onChange={e => setEditingCategory({ ...editingCategory, name: e.target.value })}
                        className="w-full p-3 bg-white border-2 border-transparent focus:border-indigo-600 rounded-xl outline-none font-bold text-sm"
                      />
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <NumericInput
                            value={editingCategory.warrantyDays}
                            onChange={raw => setEditingCategory({ ...editingCategory, warrantyDays: raw })}
                            className="w-16 p-3 bg-white border-2 border-transparent focus:border-indigo-600 rounded-xl outline-none font-black text-center text-lg"
                          />
                          <span className="text-xs font-bold text-gray-500">días garantía</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <NumericInput
                            value={editingCategory.minStock}
                            onChange={raw => setEditingCategory({ ...editingCategory, minStock: raw })}
                            className="w-16 p-3 bg-amber-50 border-2 border-transparent focus:border-amber-400 rounded-xl outline-none font-black text-center text-lg"
                          />
                          <span className="text-xs font-bold text-amber-600">stock mín.</span>
                        </div>
                      </div>
                      <button type="button"
                        onClick={() => setEditingCategory({ ...editingCategory, isLocal: !editingCategory.isLocal })}
                        className={cn(
                          "w-full mt-2 py-2 rounded-xl font-black text-xs transition-all border-2",
                          editingCategory.isLocal
                            ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                            : "bg-gray-50 border-gray-200 text-gray-600"
                        )}>
                        {editingCategory.isLocal ? '🏪 Producto del Local' : '📦 Producto Común'} — clic para cambiar
                      </button>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setEditingCategory(null)}
                          className="flex-1 py-2 rounded-xl border-2 border-gray-200 font-black text-gray-500 text-sm hover:bg-gray-50">
                          Cancelar
                        </button>
                        <button type="submit"
                          className="flex-1 py-2 rounded-xl bg-indigo-600 text-white font-black text-sm hover:bg-indigo-700">
                          Guardar
                        </button>
                      </div>
                    </form>
                  ) : (
                    // ── Vista normal de categoría ──
                    <div key={c._id} className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-2xl hover:border-indigo-100 transition-all group">
                      <div>
                        <span className="font-bold text-gray-700">{c.name}</span>
                        <span className="ml-2 text-[10px] font-black text-indigo-400 bg-indigo-50 px-2 py-0.5 rounded-full">
                          {(c as any).warrantyDays ?? 2}d garantía
                        </span>
                        {(c as any).isLocal && (
                          <span className="ml-1 text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                            🏪 Local
                          </span>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => setEditingCategory({ _id: c._id, name: c.name, warrantyDays: String((c as any).warrantyDays ?? 2), minStock: String(c.minStock ?? 5), isLocal: (c as any).isLocal ?? false })}
                          className="p-2 text-gray-300 hover:text-indigo-500 transition-colors"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button onClick={() => handleDeleteCategory(c._id)} className="p-2 text-gray-300 hover:text-red-500 transition-colors">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  )
                ))}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {editingProduct && (
        <Modal title="Editar Producto" onClose={() => setEditingProduct(null)}>
          <form onSubmit={handleUpdate} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Modelo</label>
                <input required value={editingProduct.model} onChange={e => setEditingProduct({...editingProduct, model: e.target.value.toUpperCase()})} className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl outline-none transition-all font-bold" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Categoría</label>
                <select value={editingProduct.categoryId ?? ''} onChange={e => setEditingProduct({...editingProduct, categoryId: e.target.value})} className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl outline-none transition-all font-bold">
                  <option value="">Sin categoría</option>
                  {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Fabricante</label>
                <select value={editingProduct.manufacturerId ?? ''} onChange={e => setEditingProduct({...editingProduct, manufacturerId: e.target.value || undefined})} className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl outline-none transition-all font-bold">
                  <option value="">Sin fabricante</option>
                  {manufacturers.map(m => <option key={m._id} value={m._id}>{m.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Cantidad Actual</label>
                <NumericInput required value={String(editingProduct.quantity ?? '')} onChange={raw => setEditingProduct({...editingProduct, quantity: Number(raw) || 0})} className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl outline-none transition-all font-bold" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Cantidad Total Comprada</label>
                <NumericInput required value={String(editingProduct.purchasedQuantity ?? '')} onChange={raw => setEditingProduct({...editingProduct, purchasedQuantity: Number(raw) || 0})} className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl outline-none transition-all font-bold" />
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
                        setEditCostUsd(gs > 0 ? (gs / (exchangeRate || 6300)).toFixed(2) : '');
                      }}
                      className="w-full p-4 bg-emerald-50 border-2 border-transparent focus:border-emerald-500 focus:bg-white rounded-2xl outline-none transition-all font-bold"
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest ml-1">Dólares (USD)</p>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={editCostUsd}
                      onChange={e => {
                        const v = e.target.value;
                        setEditCostUsd(v);
                        const usd = parseFloat(v.replace(',', '.'));
                        if (!isNaN(usd)) setEditingProduct(prev => prev ? { ...prev, costPrice: Math.round(usd * (exchangeRate || 6300)) } : prev);
                      }}
                      className="w-full p-4 bg-blue-50 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-2xl outline-none transition-all font-bold"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Precio Normal · Cliente (Gs.)</label>
                <NumericInput required value={String(editingProduct.salePrice ?? '')} onChange={raw => setEditingProduct({...editingProduct, salePrice: Number(raw) || 0})} className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl outline-none transition-all font-bold" />
              </div>

              {/* ── Precios adicionales ── */}
              <div className="col-span-full space-y-3 bg-gray-50 rounded-2xl p-4 border border-gray-100">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Precios adicionales <span className="font-bold normal-case text-gray-300">(opcionales)</span>
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-purple-500 uppercase tracking-widest ml-1">
                      🏪 Precio Mayorista (Gs.)
                    </label>
                    <NumericInput value={String((editingProduct as any).priceWholesale ?? '')} onChange={raw => setEditingProduct({...editingProduct, priceWholesale: Number(raw) || 0} as any)} className="w-full p-4 bg-white border-2 border-transparent focus:border-purple-500 rounded-2xl outline-none transition-all font-bold" placeholder="0" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-orange-500 uppercase tracking-widest ml-1">
                      💸 Precio Tacaño (Gs.)
                    </label>
                    <NumericInput value={String((editingProduct as any).priceCheap ?? '')} onChange={raw => setEditingProduct({...editingProduct, priceCheap: Number(raw) || 0} as any)} className="w-full p-4 bg-white border-2 border-transparent focus:border-orange-400 rounded-2xl outline-none transition-all font-bold" placeholder="0" />
                  </div>
                </div>
              </div>

              <div className="col-span-full space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4 flex items-center gap-1.5">
                  <MapPin size={11} className="text-indigo-400" /> Ubicación en Estante
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Estante</p>
                    <input
                      value={editLoc.estante}
                      onChange={e => setEditLoc({ ...editLoc, estante: e.target.value })}
                      placeholder="1"
                      className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl outline-none transition-all font-black text-center text-lg"
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Columna</p>
                    <input
                      value={editLoc.columna}
                      onChange={e => setEditLoc({ ...editLoc, columna: e.target.value })}
                      placeholder="A"
                      className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl outline-none transition-all font-black text-center text-lg"
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Fila</p>
                    <input
                      value={editLoc.fila}
                      onChange={e => setEditLoc({ ...editLoc, fila: e.target.value })}
                      placeholder="3"
                      className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl outline-none transition-all font-black text-center text-lg"
                    />
                  </div>
                </div>
              </div>
            </div>
            <button type="submit" className="w-full bg-indigo-600 text-white font-black py-5 rounded-2xl shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all">Actualizar Producto</button>
          </form>
        </Modal>
      )}

      {/* ── Modal: elegir categoría para producto nuevo escaneado ── */}
      {scanCategoryModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
            className="bg-white rounded-[40px] p-8 shadow-2xl w-full max-w-sm"
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600">
                <Scan size={28} />
              </div>
              <div>
                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Producto nuevo</p>
                <h3 className="text-lg font-black text-gray-800">Código escaneado</h3>
                <p className="text-xs font-mono text-gray-500">{scanCategoryModal.barcode}</p>
              </div>
            </div>

            <p className="text-sm font-bold text-gray-600 mb-4">
              Este código no está registrado. ¿A qué categoría pertenece el producto?
            </p>

            <div className="space-y-2 mb-6">
              {categories.map(c => (
                <button
                  key={c._id}
                  onClick={() => setScanSelectedCategory(c._id)}
                  className={cn(
                    "w-full p-4 rounded-2xl text-left font-bold text-sm transition-all border-2",
                    scanSelectedCategory === c._id
                      ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                      : "border-gray-100 bg-gray-50 text-gray-700 hover:border-indigo-200"
                  )}
                >
                  {c.name}
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setScanCategoryModal(null)}
                className="flex-1 py-4 rounded-2xl border-2 border-gray-100 font-black text-gray-500 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                disabled={!scanSelectedCategory}
                onClick={() => {
                  // Precargar el formulario con el barcode y la categoría elegida
                  setNewProduct(prev => ({
                    ...prev,
                    barcode:    scanCategoryModal.barcode,
                    categoryId: scanSelectedCategory,
                  }));
                  setScanCategoryModal(null);
                  setIsAdding(true);
                }}
                className="flex-1 py-4 rounded-2xl bg-indigo-600 text-white font-black shadow-xl shadow-indigo-200 hover:bg-indigo-700 disabled:opacity-40 transition-all"
              >
                Continuar →
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {restockingProduct && (
        <Modal title={`Reponer Stock: ${restockingProduct.model}`} onClose={() => setRestockingProduct(null)}>
          <form onSubmit={handleRestock} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Cantidad a Agregar</label>
                <NumericInput
                  required
                  value={restockData.quantity}
                  onChange={raw => setRestockData({...restockData, quantity: raw})}
                  className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl outline-none transition-all font-bold"
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Nuevo Precio Costo (Gs.)</label>
                <NumericInput
                  required
                  value={restockData.costPrice}
                  onChange={raw => setRestockData({...restockData, costPrice: raw})}
                  className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl outline-none transition-all font-bold"
                />
              </div>
            </div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">
              El stock actual es de {restockingProduct.quantity} unidades.
            </p>
            <button type="submit" className="w-full bg-indigo-600 text-white font-black py-5 rounded-2xl shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all">Confirmar Reposición</button>
          </form>
        </Modal>
      )}

      {/* ════════════════════════════════════════════════
          MODAL: IMPRIMIR ETIQUETAS
          ════════════════════════════════════════════════ */}
      {printModal && (
        <Modal title="Imprimir Etiquetas" onClose={() => setPrintModal(null)}>
          <div className="space-y-6">

            {/* Info del producto */}
            <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 flex-shrink-0">
                <Package size={22} />
              </div>
              <div className="min-w-0">
                <p className="font-black text-gray-800 leading-tight truncate">{printModal.model}</p>
                <p className="text-[10px] font-bold text-gray-400 mt-0.5">
                  Stock: {printModal.quantity} u · Gs. {printModal.salePrice.toLocaleString('es-PY')}
                </p>
              </div>
            </div>

            {/* Cantidad de etiquetas */}
            <div className="space-y-3">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 block">
                ¿Cuántas etiquetas imprimir?
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setPrintQty(q => String(Math.max(1, (parseInt(q) || 1) - 1)))}
                  className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center hover:bg-gray-200 transition-colors text-gray-600 flex-shrink-0">
                  <Minus size={18} />
                </button>
                <NumericInput
                  value={printQty}
                  onChange={raw => setPrintQty(raw || '1')}
                  className="flex-1 text-center text-3xl font-black bg-gray-50 border-2 border-transparent focus:border-indigo-600 rounded-2xl py-3 outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setPrintQty(q => String((parseInt(q) || 0) + 1))}
                  className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center hover:bg-gray-200 transition-colors text-gray-600 flex-shrink-0">
                  <Plus size={18} />
                </button>
              </div>
              {/* Atajos rápidos */}
              <div className="flex gap-2 flex-wrap">
                {printModal.quantity > 0 && (
                  <button
                    type="button"
                    onClick={() => setPrintQty(String(printModal.quantity))}
                    className="text-[10px] font-black text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1">
                    <Package size={10} /> Stock completo ({printModal.quantity})
                  </button>
                )}
                {[1, 5, 10].map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPrintQty(String(n))}
                    className="text-[10px] font-black text-gray-500 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-xl transition-colors">
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Toggle código de barras */}
            <div className="space-y-2">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Código de Barras</p>
              {printModal.barcode ? (
                <button
                  type="button"
                  onClick={() => setPrintWithBarcode(b => !b)}
                  className={cn(
                    'w-full p-4 rounded-2xl border-2 font-black text-sm transition-all flex items-center justify-between',
                    printWithBarcode
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-gray-200 bg-gray-50 text-gray-500'
                  )}>
                  <span className="flex items-center gap-2">
                    <span className={cn('w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0',
                      printWithBarcode ? 'border-indigo-500 bg-indigo-500' : 'border-gray-300'
                    )}>
                      {printWithBarcode && <span className="w-1.5 h-1.5 bg-white rounded-full" />}
                    </span>
                    {printWithBarcode ? 'Incluir código de barras' : 'Sin código de barras'}
                  </span>
                  <span className="text-[9px] font-mono text-gray-400 opacity-70 truncate ml-2 max-w-[120px]">
                    {printModal.barcode}
                  </span>
                </button>
              ) : (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100 flex items-start gap-2">
                  <AlertTriangle size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
                  <p className="text-[10px] font-bold text-amber-700 leading-relaxed">
                    Este producto no tiene código de barras. Solo se imprimirá nombre y precio.
                  </p>
                </div>
              )}
            </div>

            {/* Vista previa */}
            <div className="space-y-2">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Vista previa de la etiqueta</p>
              <div className="flex justify-center py-2">
                <div className="border border-dashed border-gray-300 rounded-xl p-3 bg-white text-center" style={{ width: '140px', minHeight: '64px' }}>
                  <p className="text-[9px] font-black text-gray-800 leading-snug"
                    style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as React.CSSProperties}>
                    {printModal.model}
                  </p>
                  <p className="text-[8px] text-gray-600 font-bold mt-1">
                    Gs. {printModal.salePrice.toLocaleString('es-PY')}
                  </p>
                  {(printWithBarcode && printModal.barcode) ? (
                    <div className="mt-1.5 border-t border-gray-100 pt-1">
                      <p className="text-[6px] font-mono text-gray-400 tracking-widest">▌▌▌ ▌▌ ▌▌▌ ▌▌</p>
                      <p className="text-[6px] text-gray-400 font-mono">{printModal.barcode}</p>
                    </div>
                  ) : (
                    <p className="text-[7px] text-gray-300 mt-1 italic">sin código</p>
                  )}
                </div>
              </div>
              <p className="text-[9px] font-bold text-gray-400 text-center">Tamaño real: 55 × ~30 mm · Se imprimen {parseInt(printQty) || 1} etiqueta{(parseInt(printQty) || 1) !== 1 ? 's' : ''} en grilla</p>
            </div>

            {/* Botón imprimir */}
            <button
              type="button"
              onClick={() => {
                const qty = Math.max(1, parseInt(printQty) || 1);
                printProductLabels(printModal, qty, printWithBarcode && !!printModal.barcode);
              }}
              className="w-full bg-indigo-600 text-white font-black py-5 rounded-2xl shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2">
              <Printer size={18} />
              Imprimir {parseInt(printQty) || 1} etiqueta{(parseInt(printQty) || 1) !== 1 ? 's' : ''}
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

      {isManagingManufacturers && (
        <Modal title="Gestionar Fabricantes" onClose={() => { setIsManagingManufacturers(false); setEditingManufacturer(null); setNewManufacturerName(''); }}>
          <div className="space-y-6">
            <form onSubmit={handleAddManufacturer} className="space-y-3 p-5 bg-indigo-50 rounded-3xl border border-indigo-100">
              <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Nuevo Fabricante</p>
              <div className="flex gap-3">
                <input
                  required
                  placeholder="Ej: Samsung, Xiaomi, Motorola..."
                  value={newManufacturerName}
                  onChange={e => setNewManufacturerName(e.target.value)}
                  className="flex-1 p-4 bg-white border-2 border-transparent focus:border-indigo-600 rounded-2xl outline-none transition-all font-bold"
                />
                <button type="submit" className="px-6 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 text-sm">
                  Agregar
                </button>
              </div>
            </form>

            <div className="space-y-3">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Fabricantes Existentes</p>
              {manufacturers.length === 0 ? (
                <p className="text-center py-8 text-gray-300 font-bold text-sm">Sin fabricantes aún</p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {manufacturers.map(m => (
                    editingManufacturer?._id === m._id ? (
                      <form key={m._id} onSubmit={handleUpdateManufacturer} className="flex gap-2">
                        <input
                          required
                          value={editingManufacturer.name}
                          onChange={e => setEditingManufacturer({ ...editingManufacturer, name: e.target.value })}
                          className="flex-1 p-3 bg-gray-50 border-2 border-indigo-400 rounded-2xl outline-none font-bold text-sm"
                        />
                        <button type="submit" className="px-4 bg-indigo-600 text-white font-black rounded-2xl text-sm hover:bg-indigo-700">Guardar</button>
                        <button type="button" onClick={() => setEditingManufacturer(null)} className="px-4 bg-gray-100 text-gray-600 font-black rounded-2xl text-sm hover:bg-gray-200">✕</button>
                      </form>
                    ) : (
                      <div key={m._id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100 group">
                        <span className="font-black text-gray-800">{m.name}</span>
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setEditingManufacturer({ _id: m._id, name: m.name })}
                            className="p-2 text-indigo-500 hover:bg-indigo-50 rounded-xl transition-colors">
                            <Edit2 size={15} />
                          </button>
                          <button onClick={() => handleDeleteManufacturer(m._id)}
                            className="p-2 text-red-400 hover:bg-red-50 rounded-xl transition-colors">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    )
                  ))}
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
