import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Plus, Search, Edit2, Trash2, Printer, Wrench,
  Phone, Smartphone, Package, Settings, ChevronDown, X,
  MessageSquare, Clock, History, MapPin, Layers, UserCheck,
  ShieldCheck, ShieldAlert, AlertTriangle, CheckCircle
} from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import JsBarcode from 'jsbarcode';
import { api } from '../api';
import { Repair, RepairType, Product, RepairShelf, RepairWorkbench } from '../types';
import { Modal } from './ui/Modal';
import { NumericInput as NumInput } from './ui/NumericInput';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { cn } from '../lib/utils';

interface RepairsViewProps {
  repairs: Repair[];
  products: Product[];
  onRefresh: () => void;
  users?: { _id: string; name: string; role: string }[];
}

const toNum = (v: any) => { const n = Number(v); return isNaN(n) ? 0 : n; };

interface PartSearchProps {
  products: Product[];
  onSelect: (p: Product) => void;
}
const PartSearch = ({ products, onSelect }: PartSearchProps) => {
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const filtered = products.filter(p => toNum(p.quantity) > 0 && p.model.toLowerCase().includes(term.toLowerCase())).slice(0, 8);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
        <input type="text" placeholder="Buscar repuesto en stock..." value={term}
          onChange={e => { setTerm(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
          className="w-full pl-9 pr-9 py-3 bg-white border-2 border-gray-100 focus:border-indigo-500 rounded-2xl outline-none font-bold text-sm transition-all" />
        <ChevronDown size={16} className={cn('absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition-transform', open && 'rotate-180')} />
      </div>
      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-100 rounded-2xl shadow-xl overflow-hidden">
          {filtered.length === 0 ? (
            <p className="text-center py-4 text-gray-400 font-bold text-sm">{term ? `Sin resultados para "${term}"` : 'Sin stock disponible'}</p>
          ) : filtered.map(p => (
            <button key={p._id} type="button" onMouseDown={() => { onSelect(p); setTerm(''); setOpen(false); }}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-indigo-50 transition-colors text-left border-b border-gray-50 last:border-0">
              <div>
                <p className="font-black text-gray-800 text-sm">{p.model}</p>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Stock: {p.quantity}</p>
              </div>
              <span className="font-black text-emerald-600 text-sm">Gs. {toNum(p.salePrice).toLocaleString()}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

interface RepairFormData {
  customerName: string; customerPhone: string; deviceModel: string;
  problemDescription: string; repairType: string;
  status: 'pending' | 'in_progress' | 'ready' | 'no_solution' | 'delivered';
  totalCost: string;
  partsUsed: { id: string; name: string; price: number; cost?: number; quantity: number }[];
  technicianId?: string;
  workbenchId?: string;
  shelfId?: string;
  newNote?: string;
}
const emptyForm = (): RepairFormData => ({
  customerName: '', customerPhone: '', deviceModel: '', problemDescription: '',
  repairType: '', status: 'pending', totalCost: '', partsUsed: [],
  technicianId: '', workbenchId: '', shelfId: '', newNote: '',
});

interface RepairFormComponentProps {
  isEdit: boolean;
  initialData: RepairFormData;
  repairTypes: RepairType[];
  products: Product[];
  editingRepair?: Repair | null;
  onSubmit: (data: RepairFormData) => void;
  users?: { _id: string; name: string; role: string }[];
  shelves: RepairShelf[];
  workbenches: RepairWorkbench[];
}

const RepairFormComponent = ({
  isEdit, initialData, repairTypes, products, editingRepair, onSubmit,
  users = [], shelves, workbenches,
}: RepairFormComponentProps) => {
  const [f, setF] = useState<RepairFormData>(initialData);
  const [pendingPart, setPendingPart] = useState<Product | null>(null);
  const rt = repairTypes.find(t => t._id === f.repairType);
  const fixed = toNum(rt?.fixedCost);
  const parts = f.partsUsed.reduce((a, p) => a + toNum(p.price) * p.quantity, 0);
  const labor = parseInt(f.totalCost) || 0;

  const techUsers = users.filter(u => u.role === 'technician' || u.role === 'admin');

  const addPartWithPrice = (price: number) => {
    if (!pendingPart) return;
    setF(prev => ({ ...prev, partsUsed: [...prev.partsUsed, {
      id: pendingPart._id, name: pendingPart.model,
      price, cost: toNum(pendingPart.costPrice), quantity: 1,
    }]}));
    setPendingPart(null);
  };

  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(f); }} className="space-y-5">

      {/* ── MODO CREACIÓN: todos los campos ── */}
      {!isEdit && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-3">Cliente</label>
              <input required value={f.customerName} onChange={e => setF(p => ({ ...p, customerName: e.target.value }))}
                className="w-full p-3 bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl outline-none font-bold" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-3">Teléfono</label>
              <input required value={f.customerPhone} onChange={e => setF(p => ({ ...p, customerPhone: e.target.value }))}
                className="w-full p-3 bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl outline-none font-bold" />
            </div>
            <div className="col-span-2 space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-3">Modelo del equipo</label>
              <input required value={f.deviceModel} onChange={e => setF(p => ({ ...p, deviceModel: e.target.value }))}
                className="w-full p-3 bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl outline-none font-bold" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-3">Tipo de Reparación</label>
            <select value={f.repairType} onChange={e => setF(p => ({ ...p, repairType: e.target.value }))}
              className="w-full p-3 bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl outline-none font-bold">
              <option value="">Sin tipo predefinido</option>
              {repairTypes.map(t => (
                <option key={t._id} value={t._id}>{t.name}{toNum(t.fixedCost) > 0 ? ` · Gs. ${toNum(t.fixedCost).toLocaleString()}` : ''}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-3">Descripción del Problema</label>
            <textarea required value={f.problemDescription} onChange={e => setF(p => ({ ...p, problemDescription: e.target.value }))}
              className="w-full p-3 bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl outline-none font-bold h-24 resize-none" />
          </div>
        </>
      )}

      {/* ── MODO EDICIÓN: info bloqueada + estado + ubicación ── */}
      {isEdit && (
        <>
          <div className="p-4 bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl space-y-3">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
              <span>🔒</span> Datos del equipo (no editables)
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-0.5">Cliente</p>
                <p className="font-black text-gray-800 text-sm">{editingRepair?.customerName}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-0.5">Teléfono</p>
                <p className="font-black text-gray-800 text-sm">{editingRepair?.customerPhone}</p>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase mb-0.5">Equipo</p>
              <p className="font-black text-gray-800 text-sm">{editingRepair?.deviceModel}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase mb-0.5">Problema</p>
              <p className="text-sm font-bold text-gray-600 leading-snug">{editingRepair?.problemDescription}</p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-3">Estado</label>
            <select value={f.status} onChange={e => setF(p => ({ ...p, status: e.target.value as any }))}
              className="w-full p-3 bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl outline-none font-bold">
              <option value="pending">⏳ Pendiente</option>
              <option value="in_progress">🔧 En Proceso</option>
              <option value="ready">✅ Listo</option>
              <option value="no_solution">❌ Sin Solución</option>
              <option value="delivered">📦 Entregado</option>
            </select>
          </div>

          {/* Mesa de reparación — visible cuando el estado es En Proceso */}
          {f.status === 'in_progress' && workbenches.length > 0 && (
            <div className="space-y-2">
              <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest ml-3 flex items-center gap-1.5">
                <Wrench size={10} /> Mesa de Reparación
              </label>
              <select
                value={f.workbenchId || ''}
                onChange={e => setF(p => ({ ...p, workbenchId: e.target.value }))}
                className="w-full p-3 bg-blue-50 border-2 border-blue-100 focus:border-blue-500 focus:bg-white rounded-2xl outline-none font-bold text-blue-800"
              >
                <option value="">Sin asignar</option>
                {workbenches.map(w => <option key={w._id} value={w._id}>{w.name}</option>)}
              </select>
            </div>
          )}

          {/* Estante de reparados — visible cuando el estado es Listo */}
          {f.status === 'ready' && shelves.length > 0 && (
            <div className="space-y-2">
              <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest ml-3 flex items-center gap-1.5">
                <Layers size={10} /> Estante de Reparados
              </label>
              <select
                value={f.shelfId || ''}
                onChange={e => setF(p => ({ ...p, shelfId: e.target.value }))}
                className="w-full p-3 bg-emerald-50 border-2 border-emerald-100 focus:border-emerald-500 focus:bg-white rounded-2xl outline-none font-bold text-emerald-800"
              >
                <option value="">Sin asignar</option>
                {shelves.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
              </select>
            </div>
          )}
        </>
      )}

      {/* ── Mesa y Estante en modo creación ── */}
      {!isEdit && (
        <div className="grid grid-cols-2 gap-4">
          {workbenches.length > 0 && (
            <div className="space-y-2">
              <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest ml-3 flex items-center gap-1.5">
                <Wrench size={10} /> Mesa de Reparación
              </label>
              <select value={f.workbenchId || ''} onChange={e => setF(p => ({ ...p, workbenchId: e.target.value }))}
                className="w-full p-3 bg-blue-50 border-2 border-blue-100 focus:border-blue-500 rounded-2xl outline-none font-bold text-blue-800">
                <option value="">Sin asignar</option>
                {workbenches.map(w => <option key={w._id} value={w._id}>{w.name}</option>)}
              </select>
            </div>
          )}
          {shelves.length > 0 && (
            <div className="space-y-2">
              <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest ml-3 flex items-center gap-1.5">
                <Layers size={10} /> Estante (si ya está listo)
              </label>
              <select value={f.shelfId || ''} onChange={e => setF(p => ({ ...p, shelfId: e.target.value }))}
                className="w-full p-3 bg-emerald-50 border-2 border-emerald-100 focus:border-emerald-500 rounded-2xl outline-none font-bold text-emerald-800">
                <option value="">Sin asignar</option>
                {shelves.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
              </select>
            </div>
          )}
        </div>
      )}

      {/* ── Repuestos: siempre editable ── */}
      <div className="space-y-3">
        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-3">Repuestos del Stock</label>
        <PartSearch products={products} onSelect={p => setPendingPart(p)} />

        {/* ── Selector de precio ── */}
        {pendingPart && (
          <div className="p-4 bg-indigo-50 border-2 border-indigo-200 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">¿Qué precio usás?</p>
                <p className="font-black text-gray-800 text-sm mt-0.5">{pendingPart.model}</p>
              </div>
              <button type="button" onClick={() => setPendingPart(null)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-white transition-all">
                <X size={16} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Normal', price: toNum(pendingPart.salePrice), color: 'bg-indigo-600 text-white shadow-indigo-200' },
                { label: 'Mayorista', price: toNum(pendingPart.priceWholesale), color: 'bg-emerald-600 text-white shadow-emerald-200' },
                { label: 'Económico', price: toNum(pendingPart.priceCheap), color: 'bg-amber-500 text-white shadow-amber-200' },
              ].map(opt => (
                <button key={opt.label} type="button"
                  onClick={() => addPartWithPrice(opt.price)}
                  disabled={opt.price === 0}
                  className={cn('flex flex-col items-center py-3 px-2 rounded-2xl font-black text-center shadow-lg transition-all hover:scale-105 disabled:opacity-30 disabled:cursor-not-allowed disabled:scale-100', opt.color)}>
                  <span className="text-[10px] uppercase tracking-widest">{opt.label}</span>
                  <span className="text-sm mt-1">Gs. {opt.price.toLocaleString()}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {f.partsUsed.length > 0 && (
          <div className="space-y-2">
            {f.partsUsed.map((p, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-indigo-50 border border-indigo-100 rounded-2xl">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center text-white"><Package size={13} /></div>
                  <div>
                    <p className="font-black text-gray-800 text-sm">{p.name}</p>
                    <p className="text-[10px] font-bold text-gray-400">x{p.quantity} · Gs. {toNum(p.price).toLocaleString()} c/u</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-black text-emerald-600 text-sm">Gs. {(toNum(p.price) * p.quantity).toLocaleString()}</span>
                  <button type="button" onClick={() => setF(prev => ({ ...prev, partsUsed: prev.partsUsed.filter((_, i) => i !== idx) }))}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"><X size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Mano de obra: siempre editable ── */}
      <div className="space-y-2">
        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-3">Mano de Obra / Costo Adicional (Gs.)</label>
        <NumInput value={f.totalCost} onChange={(v: string) => setF(p => ({ ...p, totalCost: v }))}
          className="w-full p-3 bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl outline-none font-black text-xl text-emerald-600" />
      </div>

      {/* Resumen solo en creación */}
      {!isEdit && (
        <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl space-y-1.5 text-sm">
          <div className="flex justify-between text-gray-600 font-bold"><span>Costo fijo del tipo</span><span>Gs. {fixed.toLocaleString()}</span></div>
          <div className="flex justify-between text-gray-600 font-bold"><span>Repuestos ({f.partsUsed.length})</span><span>Gs. {parts.toLocaleString()}</span></div>
          <div className="flex justify-between text-gray-600 font-bold"><span>Mano de obra</span><span>Gs. {labor.toLocaleString()}</span></div>
          <div className="flex justify-between text-emerald-700 font-black border-t border-emerald-200 pt-1.5"><span>TOTAL</span><span>Gs. {(fixed + parts + labor).toLocaleString()}</span></div>
        </div>
      )}

      {/* ── Técnico: siempre visible (registra historial si cambia) ── */}
      {techUsers.length > 0 && (
        <div className="space-y-2">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-3">
            Técnico Asignado {isEdit && <span className="text-amber-500">(se registra el cambio)</span>}
          </label>
          <select value={f.technicianId} onChange={e => setF(p => ({ ...p, technicianId: e.target.value }))}
            className="w-full p-3 bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl outline-none font-bold">
            <option value="">Sin asignar</option>
            {techUsers.map(u => (
              <option key={u._id} value={u._id}>{u.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* ── Historial de técnicos (solo edición) ── */}
      {isEdit && editingRepair?.technicianHistory && editingRepair.technicianHistory.length > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl space-y-2">
          <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest flex items-center gap-1.5">
            <History size={12} /> Historial de técnicos
          </p>
          {editingRepair.technicianHistory.map((h, i) => (
            <div key={i} className="flex items-center justify-between text-xs font-bold text-amber-700 bg-amber-100 px-3 py-2 rounded-xl">
              <span>🔧 {h.technicianName || 'Desconocido'}</span>
              <span className="text-amber-500 font-bold">
                hasta {h.removedAt ? new Date(h.removedAt).toLocaleDateString('es-PY') : '—'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── Notas (solo edición) ── */}
      {isEdit && (
        <div className="space-y-3">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-3 flex items-center gap-1.5">
            <MessageSquare size={12} /> Notas
          </label>

          {editingRepair?.notes && editingRepair.notes.length > 0 && (
            <div className="space-y-2">
              {editingRepair.notes.map((note, i) => (
                <div key={i} className="p-3 bg-gray-50 border-l-4 border-indigo-300 rounded-r-2xl">
                  <p className="text-sm font-bold text-gray-700 leading-snug">{note.text}</p>
                  <p className="text-[10px] font-black text-gray-400 mt-1.5 flex items-center gap-1">
                    <Clock size={9} />
                    {new Date(note.createdAt).toLocaleString('es-PY', {
                      day: '2-digit', month: '2-digit', year: '2-digit',
                      hour: '2-digit', minute: '2-digit'
                    })}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-1.5">
            <textarea
              value={f.newNote || ''}
              onChange={e => setF(p => ({ ...p, newNote: e.target.value }))}
              placeholder="Agregar nueva nota... (no se puede editar después)"
              className="w-full p-3 bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl outline-none font-bold text-sm h-20 resize-none"
            />
            <p className="text-[10px] font-bold text-gray-400 ml-3">La nota se guarda con fecha y hora al actualizar</p>
          </div>
        </div>
      )}

      <button type="submit" className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all">
        {isEdit ? 'Guardar Cambios' : 'Crear Reparación'}
      </button>
    </form>
  );
};

export const RepairsView = ({ repairs, products, onRefresh, users = [] }: RepairsViewProps) => {
  const [repairTypes, setRepairTypes] = useState<RepairType[]>([]);
  const [shelves, setShelves] = useState<RepairShelf[]>([]);
  const [workbenches, setWorkbenches] = useState<RepairWorkbench[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingRepair, setEditingRepair] = useState<Repair | null>(null);
  const [showTypeManager, setShowTypeManager] = useState(false);
  const [showLocationConfig, setShowLocationConfig] = useState(false);
  // Garantía
  const [warrantyRepair, setWarrantyRepair] = useState<Repair | null>(null);
  const [warrantyType, setWarrantyType] = useState<'labor' | 'part' | null>(null);
  const [warrantyPart, setWarrantyPart] = useState('');
  const [applyingWarranty, setApplyingWarranty] = useState(false);
  const [resolvingWarranty, setResolvingWarranty] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('active');
  const [newType, setNewType] = useState({ name: '', description: '', fixedCost: '' });
  const [editingType, setEditingType] = useState<RepairType | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [printRepair, setPrintRepair] = useState<Repair | null>(null);

  // Location config state
  const [newWorkbenchName, setNewWorkbenchName] = useState('');
  const [newShelfName, setNewShelfName] = useState('');
  const [genWorkbenchCount, setGenWorkbenchCount] = useState('');
  const [genShelfCount, setGenShelfCount] = useState('');

  const printRef    = useRef<HTMLDivElement>(null);
  const barcodeRef  = useRef<SVGSVGElement>(null);
  const barcodeRef2 = useRef<SVGSVGElement>(null);
  const handlePrint = useReactToPrint({ contentRef: printRef });

  useEffect(() => {
    if (printRepair && barcodeRef.current && barcodeRef2.current) {
      const shortId = printRepair._id.slice(-8).toUpperCase();
      const opts = { format: 'CODE128', width: 1.8, height: 45, displayValue: false, margin: 4, lineColor: '#4f46e5' };
      try { JsBarcode(barcodeRef.current,  `SRV-${shortId}`, opts); } catch (e) { console.error(e); }
      try { JsBarcode(barcodeRef2.current, `SRV-${shortId}`, opts); } catch (e) { console.error(e); }
    }
  }, [printRepair]);

  useEffect(() => { fetchTypes(); fetchShelves(); fetchWorkbenches(); }, []);

  const fetchTypes      = async () => { const t = await api.getRepairTypes();      setRepairTypes(Array.isArray(t) ? t : []); };
  const fetchShelves    = async () => { const s = await api.getRepairShelves();    setShelves(Array.isArray(s) ? s : []); };
  const fetchWorkbenches = async () => { const w = await api.getRepairWorkbenches(); setWorkbenches(Array.isArray(w) ? w : []); };

  const getTicketNumber = (repair: Repair) => repair._id.slice(-4).toUpperCase();

  const handleAdd = async (formData: RepairFormData) => {
    const rt = repairTypes.find(t => t._id === formData.repairType);
    const fixedCost = toNum(rt?.fixedCost);
    const partsCost = formData.partsUsed.reduce((a, p) => a + toNum(p.price) * p.quantity, 0);
    const labor = parseInt(formData.totalCost) || 0;
    const data = { ...formData, totalCost: fixedCost + partsCost + labor };
    if (!data.technicianId) data.technicianId = null as any;
    await api.createRepair(data);
    setIsAdding(false);
    onRefresh();
  };

  const handleUpdate = async (formData: RepairFormData) => {
    if (!editingRepair) return;
    const rt = repairTypes.find(t => t._id === formData.repairType);
    const fixedCost = toNum(rt?.fixedCost);
    const partsCost = formData.partsUsed.reduce((a, p) => a + toNum(p.price) * p.quantity, 0);
    const labor = parseInt(formData.totalCost) || 0;
    const { newNote, ...rest } = formData;
    const data: any = { ...rest, totalCost: fixedCost + partsCost + labor };
    if (!data.technicianId) data.technicianId = null;
    if (!data.workbenchId)  data.workbenchId  = null;
    if (!data.shelfId)      data.shelfId      = null;
    if (newNote && newNote.trim()) data.newNote = newNote.trim();
    await api.updateRepair(editingRepair._id, data);
    setEditingRepair(null);
    onRefresh();
  };

  const handleApplyWarranty = async () => {
    if (!warrantyRepair || !warrantyType) return;
    if (warrantyType === 'part' && !warrantyPart) return;
    setApplyingWarranty(true);
    try {
      await api.applyRepairWarranty(warrantyRepair._id, {
        type: warrantyType,
        defectivePart: warrantyType === 'part' ? warrantyPart : undefined,
      });
      // Cerrar modal y resetear estado
      setWarrantyRepair(null);
      setWarrantyType(null);
      setWarrantyPart('');
      // Mostrar reparaciones activas para que se vea la nueva reparación de garantía
      setFilterStatus('active');
      setSearchTerm('');
      onRefresh();
    } catch (err: any) {
      alert(`Error al aplicar garantía: ${err?.message ?? 'Error desconocido'}`);
    } finally { setApplyingWarranty(false); }
  };

  const handleResolveWarranty = async (repairId: string, resolution: 'loss' | 'provider_replenishment') => {
    setResolvingWarranty(repairId);
    try {
      await api.resolveRepairWarranty(repairId, resolution);
      onRefresh();
    } finally { setResolvingWarranty(null); }
  };

  const handleDelete = (id: string) => {
    setPendingConfirm({
      message: '¿Eliminar esta reparación? Esta acción no se puede deshacer.',
      onConfirm: async () => { await api.deleteRepair(id); onRefresh(); },
    });
  };

  const handleStatusChange = async (repair: Repair, status: string) => {
    await api.updateRepair(repair._id, { ...repair, status });
    onRefresh();
  };

  const handleWorkbenchChange = async (repair: Repair, workbenchId: string) => {
    await api.updateRepair(repair._id, { ...repair, workbenchId: workbenchId || null });
    onRefresh();
  };

  const handleShelfChange = async (repair: Repair, shelfId: string) => {
    await api.updateRepair(repair._id, { ...repair, shelfId: shelfId || null });
    onRefresh();
  };

  const handleCreateType = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.createRepairType({ ...newType, fixedCost: parseInt(newType.fixedCost) || 0 });
    setNewType({ name: '', description: '', fixedCost: '' });
    fetchTypes();
  };
  const handleUpdateType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingType) return;
    await api.updateRepairType(editingType._id, editingType);
    setEditingType(null);
    fetchTypes();
  };
  const handleDeleteType = (id: string) => {
    setPendingConfirm({
      message: '¿Eliminar este tipo de reparación?',
      onConfirm: async () => { await api.deleteRepairType(id); fetchTypes(); },
    });
  };

  // ── Location config handlers ────────────────────────────────────────────────
  const handleAddWorkbench = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkbenchName.trim()) return;
    await api.createRepairWorkbench(newWorkbenchName.trim());
    setNewWorkbenchName('');
    fetchWorkbenches();
  };

  const handleAddShelf = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShelfName.trim()) return;
    await api.createRepairShelf(newShelfName.trim());
    setNewShelfName('');
    fetchShelves();
  };

  const handleGenerateWorkbenches = async () => {
    const count = parseInt(genWorkbenchCount);
    if (!count || count < 1 || count > 50) return;
    const existing = new Set(workbenches.map(w => w.name));
    for (let i = 1; i <= count; i++) {
      const name = `Mesa ${i}`;
      if (!existing.has(name)) await api.createRepairWorkbench(name);
    }
    setGenWorkbenchCount('');
    fetchWorkbenches();
  };

  const handleGenerateShelves = async () => {
    const count = parseInt(genShelfCount);
    if (!count || count < 1 || count > 50) return;
    const existing = new Set(shelves.map(s => s.name));
    for (let i = 1; i <= count; i++) {
      const name = `Estante ${i}`;
      if (!existing.has(name)) await api.createRepairShelf(name);
    }
    setGenShelfCount('');
    fetchShelves();
  };

  const handleDeleteWorkbench = (id: string) => {
    setPendingConfirm({
      message: '¿Eliminar esta mesa de reparación?',
      onConfirm: async () => { await api.deleteRepairWorkbench(id); fetchWorkbenches(); },
    });
  };

  const handleDeleteShelf = (id: string) => {
    setPendingConfirm({
      message: '¿Eliminar este estante?',
      onConfirm: async () => { await api.deleteRepairShelf(id); fetchShelves(); },
    });
  };

  const filteredRepairs = repairs.filter(r => {
    const ms = r.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
               r.deviceModel.toLowerCase().includes(searchTerm.toLowerCase());
    const mf = filterStatus === 'active'
      ? r.status !== 'delivered'
      : filterStatus === 'all' || r.status === filterStatus;
    return ms && mf;
  });

  const getEditInitialData = (r: Repair): RepairFormData => ({
    customerName: r.customerName, customerPhone: r.customerPhone, deviceModel: r.deviceModel,
    problemDescription: r.problemDescription, repairType: r.repairType || '',
    status: r.status, totalCost: String(r.totalCost || ''),
    partsUsed: r.partsUsed ? [...r.partsUsed] : [],
    technicianId: (r as any).technicianId || '',
    workbenchId: r.workbenchId || '',
    shelfId: r.shelfId || '',
    newNote: '',
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-4xl font-black text-gray-800 tracking-tighter">Reparaciones</h2>
          <p className="text-gray-400 font-bold tracking-widest uppercase text-[10px] mt-1">Servicio Técnico</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowLocationConfig(true)}
            className="bg-gray-50 text-gray-600 font-black px-4 py-3 rounded-2xl hover:bg-gray-100 transition-all flex items-center gap-2 border border-gray-200 text-sm"
            title="Configurar mesas y estantes">
            <MapPin size={16} />
          </button>
          <button onClick={() => setShowTypeManager(true)}
            className="bg-gray-50 text-gray-600 font-black px-4 md:px-5 py-3 rounded-2xl hover:bg-gray-100 transition-all flex items-center gap-2 border border-gray-200 text-sm">
            <Settings size={16} /> Tipos
          </button>
          <button onClick={() => setIsAdding(true)}
            className="bg-indigo-600 text-white font-black px-4 md:px-6 py-3 rounded-2xl hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 flex items-center gap-2 text-sm">
            <Plus size={16} /> <span className="hidden sm:inline">Nueva </span>Reparación
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input type="text" placeholder="Buscar por cliente o modelo..." value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-gray-100 rounded-[20px] py-3.5 pl-12 pr-4 outline-none shadow-sm focus:shadow-xl focus:border-indigo-100 transition-all font-bold text-gray-700 text-sm" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="bg-white border border-gray-100 rounded-[20px] py-3.5 px-3 md:px-5 outline-none font-bold text-gray-600 shadow-sm text-sm shrink-0">
          <option value="active">Activos</option>
          <option value="all">Todos</option>
          <option value="pending">Pendientes</option>
          <option value="in_progress">En Proceso</option>
          <option value="ready">Listos</option>
          <option value="delivered">Entregados</option>
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredRepairs.map(r => {
          const daysAgo = Math.floor((Date.now() - new Date(r.createdAt).getTime()) / 86400000);
          const rt = repairTypes.find(t => t._id === r.repairType);
          const techName = users.find(u => u._id === (r as any).technicianId)?.name;
          const workbenchName = workbenches.find(w => w._id === r.workbenchId)?.name;
          const shelfName = shelves.find(s => s._id === r.shelfId)?.name;
          return (
            <motion.div layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} key={r._id}
              className={cn(
                "p-6 rounded-[35px] shadow-sm border hover:shadow-xl transition-all group relative overflow-hidden",
                r.isWarranty
                  ? "bg-red-50 border-red-200"
                  : "bg-white border-gray-100"
              )}>
              <div className="flex justify-between items-start mb-5">
                <div className="flex gap-3">
                  <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                    <Smartphone size={28} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-xl font-black text-gray-800 group-hover:text-indigo-600 transition-colors">{r.deviceModel}</h3>
                      {r.isWarranty && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 bg-red-500 text-white rounded-full uppercase tracking-widest">
                          <ShieldAlert size={9} /> GARANTÍA
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-bold text-gray-400">{r.customerName}</p>
                    <p className="text-[10px] font-bold text-gray-300 mt-0.5">
                      Ticket #{getTicketNumber(r)} · {daysAgo === 0 ? 'Hoy' : `Hace ${daysAgo}d`}
                      {rt && ` · ${rt.name}`}
                      {techName && ` · 🔧 ${techName}`}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setPrintRepair(r); setTimeout(() => handlePrint(), 200); }}
                    className="p-2.5 bg-gray-50 text-gray-400 hover:bg-emerald-50 hover:text-emerald-600 rounded-xl transition-all" title="Imprimir 2 copias">
                    <Printer size={16} />
                  </button>
                  <button onClick={() => setEditingRepair(r)}
                    className="p-2.5 bg-gray-50 text-gray-400 hover:bg-indigo-50 hover:text-indigo-600 rounded-xl transition-all" title="Editar">
                    <Edit2 size={16} />
                  </button>
                  <button onClick={() => handleDelete(r._id)}
                    className="p-2.5 bg-gray-50 text-gray-400 hover:bg-red-50 hover:text-red-500 rounded-xl transition-all" title="Eliminar">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* ── Chips: mesa · días · técnico ── */}
              <div className="flex flex-wrap gap-2 mb-4">
                {/* Días en taller */}
                <span className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-black',
                  daysAgo === 0 ? 'bg-gray-100 text-gray-500' :
                  daysAgo <= 3  ? 'bg-blue-100 text-blue-700' :
                  daysAgo <= 7  ? 'bg-amber-100 text-amber-700' :
                  'bg-red-100 text-red-700'
                )}>
                  <Clock size={11} />
                  {daysAgo === 0 ? 'Hoy' : daysAgo === 1 ? '1 día' : `${daysAgo} días`}
                </span>

                {/* Técnico */}
                {techName && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-black bg-indigo-100 text-indigo-700">
                    <Wrench size={11} />
                    {techName}
                  </span>
                )}

                {/* Mesa */}
                {workbenchName && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-black bg-blue-100 text-blue-700">
                    <MapPin size={11} />
                    {workbenchName}
                  </span>
                )}

                {/* Estante */}
                {shelfName && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-700">
                    <Layers size={11} />
                    {shelfName}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Problema</p>
                  <p className="text-sm font-bold text-gray-600 bg-gray-50 p-2.5 rounded-xl leading-snug">{r.problemDescription}</p>
                  <div className="flex items-center gap-1.5 mt-2">
                    <Phone size={13} className="text-indigo-600" />
                    <span className="text-sm font-black text-gray-800">{r.customerPhone}</span>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Estado</p>
                  <select value={r.status} onChange={e => handleStatusChange(r, e.target.value)}
                    className={cn('text-[10px] font-black px-3 py-2 rounded-xl w-full border-0 outline-none cursor-pointer uppercase tracking-widest',
                      r.status === 'pending'     ? 'bg-amber-100 text-amber-700'    :
                      r.status === 'in_progress' ? 'bg-blue-100 text-blue-700'      :
                      r.status === 'ready'       ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600')}>
                    <option value="pending">⏳ Pendiente</option>
                    <option value="in_progress">🔧 En Proceso</option>
                    <option value="ready">✅ Listo</option>
                  </select>

                  {/* Mesa de reparación — select directo */}
                  {workbenches.length > 0 && (
                    <select value={r.workbenchId || ''} onChange={e => handleWorkbenchChange(r, e.target.value)}
                      className="mt-2 text-[10px] font-black px-3 py-2 rounded-xl w-full border-0 outline-none cursor-pointer uppercase tracking-widest bg-blue-50 text-blue-700">
                      <option value="">🔧 Sin mesa</option>
                      {workbenches.map(w => <option key={w._id} value={w._id}>{w.name}</option>)}
                    </select>
                  )}

                  {/* Estante — select directo */}
                  {shelves.length > 0 && (
                    <select value={r.shelfId || ''} onChange={e => handleShelfChange(r, e.target.value)}
                      className="mt-2 text-[10px] font-black px-3 py-2 rounded-xl w-full border-0 outline-none cursor-pointer uppercase tracking-widest bg-emerald-50 text-emerald-700">
                      <option value="">📦 Sin estante</option>
                      {shelves.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                    </select>
                  )}

                  <div className="mt-3">
                    <p className="text-[10px] font-black text-gray-400 uppercase">Presupuesto</p>
                    <p className="text-2xl font-black text-emerald-500 tracking-tighter">Gs. {toNum(r.totalCost).toLocaleString()}</p>
                  </div>
                </div>
              </div>

              {r.partsUsed && r.partsUsed.length > 0 && (
                <div className="pt-3 border-t border-gray-50">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Repuestos</p>
                  <div className="flex flex-wrap gap-1.5">
                    {r.partsUsed.map((p, idx) => (
                      <span key={idx} className="text-[10px] font-bold px-2 py-1 bg-gray-50 text-gray-600 rounded-lg border border-gray-100 flex items-center gap-1">
                        <Package size={9} /> {p.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {r.notes && r.notes.length > 0 && (
                <div className="pt-2 mt-2 border-t border-gray-50 flex items-center gap-1.5">
                  <MessageSquare size={11} className="text-indigo-400" />
                  <span className="text-[10px] font-bold text-indigo-400">{r.notes.length} nota{r.notes.length > 1 ? 's' : ''}</span>
                </div>
              )}

              {/* ── Botón aplicar garantía (solo entregadas, no garantía ya) ── */}
              {r.status === 'delivered' && !r.isWarranty && (
                <div className="pt-3 mt-3 border-t border-gray-100">
                  <button onClick={() => { setWarrantyRepair(r); setWarrantyType(null); setWarrantyPart(''); }}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl border-2 border-red-200 text-red-500 font-black text-xs hover:bg-red-50 transition-all">
                    <ShieldAlert size={14} /> Aplicar Garantía
                  </button>
                </div>
              )}

              {/* ── Resolución pérdida/empate (garantía de repuesto, entregada, sin resolver) ── */}
              {r.isWarranty && r.warrantyDefectivePart && !r.warrantyResolution && r.status === 'delivered' && (
                <div className="pt-3 mt-3 border-t border-red-200 space-y-2">
                  <p className="text-[10px] font-black text-red-500 uppercase tracking-widest">
                    Repuesto: {r.warrantyDefectivePart} — ¿Cómo se resolvió?
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => handleResolveWarranty(r._id, 'provider_replenishment')}
                      disabled={resolvingWarranty === r._id}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl bg-emerald-600 text-white font-black text-xs hover:bg-emerald-700 transition-all disabled:opacity-50">
                      <CheckCircle size={13} /> 🟡 Empate
                    </button>
                    <button onClick={() => handleResolveWarranty(r._id, 'loss')}
                      disabled={resolvingWarranty === r._id}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl bg-red-600 text-white font-black text-xs hover:bg-red-700 transition-all disabled:opacity-50">
                      <X size={13} /> 🔴 Pérdida
                    </button>
                  </div>
                </div>
              )}

              {/* ── Badge resolución ya aplicada ── */}
              {r.isWarranty && r.warrantyResolution && (
                <div className={cn('mt-3 pt-3 border-t flex items-center gap-2',
                  r.warrantyResolution === 'loss' ? 'border-red-200' : 'border-emerald-200')}>
                  <span className={cn('text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest',
                    r.warrantyResolution === 'loss'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-emerald-100 text-emerald-700')}>
                    {r.warrantyResolution === 'loss' ? '🔴 Pérdida registrada' : '🟡 Empate — proveedor repuso'}
                  </span>
                </div>
              )}
            </motion.div>
          );
        })}
        {filteredRepairs.length === 0 && (
          <div className="col-span-2 text-center py-20 text-gray-300">
            <Wrench size={48} className="mx-auto mb-4" />
            <p className="font-black uppercase tracking-widest">Sin reparaciones</p>
          </div>
        )}
      </div>

      {isAdding && (
        <Modal title="Nueva Reparación" onClose={() => setIsAdding(false)}>
          <RepairFormComponent isEdit={false} initialData={emptyForm()} repairTypes={repairTypes} products={products}
            onSubmit={handleAdd} users={users} shelves={shelves} workbenches={workbenches} />
        </Modal>
      )}
      {editingRepair && (
        <Modal title={`Editar · ${editingRepair.deviceModel}`} onClose={() => setEditingRepair(null)}>
          <RepairFormComponent isEdit={true} users={users} initialData={getEditInitialData(editingRepair)} repairTypes={repairTypes}
            products={products} editingRepair={editingRepair} onSubmit={handleUpdate} shelves={shelves} workbenches={workbenches} />
        </Modal>
      )}

      {/* ── Modal: Tipos de Reparación ── */}
      {showTypeManager && (
        <Modal title="Tipos de Reparación" onClose={() => setShowTypeManager(false)}>
          <div className="space-y-6">
            <form onSubmit={handleCreateType} className="space-y-3 p-4 bg-gray-50 rounded-2xl">
              <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Nuevo Tipo</h4>
              <div className="grid grid-cols-2 gap-3">
                <input required value={newType.name} onChange={e => setNewType({ ...newType, name: e.target.value })}
                  placeholder="Nombre del tipo" className="p-3 bg-white border-2 border-transparent focus:border-indigo-600 rounded-xl outline-none font-bold text-sm" />
                <NumInput value={newType.fixedCost} onChange={(v: string) => setNewType({ ...newType, fixedCost: v })}
                  placeholder="Costo fijo Gs." className="p-3 bg-white border-2 border-transparent focus:border-indigo-600 rounded-xl outline-none font-bold text-sm" />
              </div>
              <input value={newType.description} onChange={e => setNewType({ ...newType, description: e.target.value })}
                placeholder="Descripción (opcional)" className="w-full p-3 bg-white border-2 border-transparent focus:border-indigo-600 rounded-xl outline-none font-bold text-sm" />
              <button type="submit" className="w-full bg-indigo-600 text-white font-black py-3 rounded-xl hover:bg-indigo-700 transition-all">Agregar Tipo</button>
            </form>
            <div className="space-y-2">
              {repairTypes.length === 0 && <p className="text-center text-gray-400 py-6 font-bold">No hay tipos creados aún</p>}
              {repairTypes.map(rt => (
                <div key={rt._id}>
                  {editingType?._id === rt._id ? (
                    <form onSubmit={handleUpdateType} className="flex gap-2 p-3 bg-indigo-50 rounded-2xl items-center">
                      <input value={editingType.name} onChange={e => setEditingType({ ...editingType, name: e.target.value })}
                        className="flex-1 p-2 bg-white rounded-xl outline-none font-bold text-sm border-2 border-indigo-200" />
                      <NumInput value={String(editingType.fixedCost)} onChange={(v: string) => setEditingType({ ...editingType, fixedCost: parseInt(v) || 0 })}
                        className="w-28 p-2 bg-white rounded-xl outline-none font-bold text-sm border-2 border-indigo-200" />
                      <button type="submit" className="px-3 py-2 bg-indigo-600 text-white font-black rounded-xl text-xs">✓</button>
                      <button type="button" onClick={() => setEditingType(null)} className="px-3 py-2 bg-gray-200 text-gray-600 font-black rounded-xl text-xs">✕</button>
                    </form>
                  ) : (
                    <div className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-2xl hover:border-indigo-100 transition-all">
                      <div>
                        <p className="font-black text-gray-800 text-sm">{rt.name}</p>
                        <p className="text-[10px] font-bold text-emerald-600">Costo fijo: Gs. {toNum(rt.fixedCost).toLocaleString()}{rt.description && ` · ${rt.description}`}</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setEditingType(rt)} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"><Edit2 size={14} /></button>
                        <button onClick={() => handleDeleteType(rt._id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Modal>
      )}

      {/* ── Modal: Configurar Ubicaciones ── */}
      {showLocationConfig && (
        <Modal title="Configurar Ubicaciones" onClose={() => setShowLocationConfig(false)}>
          <div className="space-y-6">

            {/* ── Mesas de Reparación ── */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Wrench size={13} className="text-blue-600" />
                </div>
                <h4 className="font-black text-gray-800">Mesas de Reparación</h4>
                <span className="ml-auto text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded-full">{workbenches.length} mesa{workbenches.length !== 1 ? 's' : ''}</span>
              </div>

              {/* Generar cantidad */}
              <div className="flex gap-2 p-3 bg-blue-50 rounded-2xl items-center">
                <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest shrink-0">Generar hasta</span>
                <input
                  type="number" min="1" max="50" value={genWorkbenchCount}
                  onChange={e => setGenWorkbenchCount(e.target.value)}
                  placeholder="N°"
                  className="w-16 p-2 bg-white border-2 border-blue-100 focus:border-blue-400 rounded-xl outline-none font-black text-center text-blue-800 text-sm"
                />
                <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest shrink-0">mesas</span>
                <button type="button" onClick={handleGenerateWorkbenches}
                  className="ml-auto px-3 py-2 bg-blue-600 text-white font-black rounded-xl text-xs hover:bg-blue-700 transition-all">
                  Generar
                </button>
              </div>

              {/* Agregar manual */}
              <form onSubmit={handleAddWorkbench} className="flex gap-2">
                <input value={newWorkbenchName} onChange={e => setNewWorkbenchName(e.target.value)}
                  placeholder="Nombre personalizado (ej: Mesa Grande)"
                  className="flex-1 p-3 bg-gray-50 border-2 border-transparent focus:border-blue-400 rounded-2xl outline-none font-bold text-sm" />
                <button type="submit" className="p-3 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-all">
                  <Plus size={16} />
                </button>
              </form>

              {/* Lista */}
              {workbenches.length === 0 ? (
                <p className="text-center text-gray-400 py-4 font-bold text-sm">No hay mesas configuradas</p>
              ) : (
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {workbenches.map(w => (
                    <div key={w._id} className="flex items-center justify-between px-3 py-2.5 bg-white border border-gray-100 rounded-xl hover:border-blue-100 transition-all">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 bg-blue-100 rounded-md flex items-center justify-center">
                          <Wrench size={10} className="text-blue-600" />
                        </div>
                        <span className="font-bold text-gray-800 text-sm">{w.name}</span>
                      </div>
                      <button onClick={() => handleDeleteWorkbench(w._id)}
                        className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-gray-100" />

            {/* ── Estantes de Reparados ── */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <Layers size={13} className="text-emerald-600" />
                </div>
                <h4 className="font-black text-gray-800">Estantes de Reparados</h4>
                <span className="ml-auto text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded-full">{shelves.length} estante{shelves.length !== 1 ? 's' : ''}</span>
              </div>

              {/* Generar cantidad */}
              <div className="flex gap-2 p-3 bg-emerald-50 rounded-2xl items-center">
                <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest shrink-0">Generar hasta</span>
                <input
                  type="number" min="1" max="50" value={genShelfCount}
                  onChange={e => setGenShelfCount(e.target.value)}
                  placeholder="N°"
                  className="w-16 p-2 bg-white border-2 border-emerald-100 focus:border-emerald-400 rounded-xl outline-none font-black text-center text-emerald-800 text-sm"
                />
                <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest shrink-0">estantes</span>
                <button type="button" onClick={handleGenerateShelves}
                  className="ml-auto px-3 py-2 bg-emerald-600 text-white font-black rounded-xl text-xs hover:bg-emerald-700 transition-all">
                  Generar
                </button>
              </div>

              {/* Agregar manual */}
              <form onSubmit={handleAddShelf} className="flex gap-2">
                <input value={newShelfName} onChange={e => setNewShelfName(e.target.value)}
                  placeholder="Nombre personalizado (ej: Estante Alto)"
                  className="flex-1 p-3 bg-gray-50 border-2 border-transparent focus:border-emerald-400 rounded-2xl outline-none font-bold text-sm" />
                <button type="submit" className="p-3 bg-emerald-600 text-white rounded-2xl hover:bg-emerald-700 transition-all">
                  <Plus size={16} />
                </button>
              </form>

              {/* Lista */}
              {shelves.length === 0 ? (
                <p className="text-center text-gray-400 py-4 font-bold text-sm">No hay estantes configurados</p>
              ) : (
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {shelves.map(s => (
                    <div key={s._id} className="flex items-center justify-between px-3 py-2.5 bg-white border border-gray-100 rounded-xl hover:border-emerald-100 transition-all">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 bg-emerald-100 rounded-md flex items-center justify-center">
                          <Layers size={10} className="text-emerald-600" />
                        </div>
                        <span className="font-bold text-gray-800 text-sm">{s.name}</span>
                      </div>
                      <button onClick={() => handleDeleteShelf(s._id)}
                        className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </Modal>
      )}

      {/* ══════════════════════════════════════════════════════
          TICKET DE REPARACIÓN — Dos copias: CLIENTE + LOCAL
          Se imprime una seguida de la otra en la misma hoja
      ══════════════════════════════════════════════════════ */}
      <div className="hidden">
        <div ref={printRef} style={{ width: '320px', fontFamily: 'Arial, sans-serif', color: '#1f2937' }}>
          {printRepair && (() => {
            const techName = users.find(u => u._id === (printRepair as any).technicianId)?.name || '';
            const ticketDate = new Date(printRepair.createdAt).toLocaleDateString('es-PY');
            const ticketTime = new Date(printRepair.createdAt).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' });
            const ticketNum  = getTicketNumber(printRepair);
            const srvCode    = `SRV-${printRepair._id.slice(-8).toUpperCase()}`;

            return (
              <>
                {/* ─── COPIA CLIENTE ─────────────────────────── */}
                <div style={{ padding: '20px 16px' }}>
                  <div style={{ textAlign: 'center', borderBottom: '2px dashed #d1d5db', paddingBottom: '14px', marginBottom: '14px' }}>
                    <p style={{ fontSize: '18px', fontWeight: 900, margin: '0 0 2px', letterSpacing: '-0.5px' }}>Dany Telefonía</p>
                    <p style={{ fontSize: '9px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '2px', margin: '0 0 10px' }}>Servicio Técnico</p>
                    <div style={{ background: '#f3f4f6', borderRadius: '10px', padding: '6px 14px', display: 'inline-block' }}>
                      <p style={{ fontSize: '8px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '2px', margin: '0 0 2px' }}>N° Turno</p>
                      <p style={{ fontSize: '28px', fontWeight: 900, color: '#4f46e5', margin: 0, letterSpacing: '-1px' }}>#{ticketNum}</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <span style={{ fontSize: '9px', fontWeight: 900, color: '#9ca3af', textTransform: 'uppercase' }}>Fecha ingreso</span>
                    <span style={{ fontWeight: 700, fontSize: '12px' }}>{ticketDate}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ fontSize: '9px', fontWeight: 900, color: '#9ca3af', textTransform: 'uppercase' }}>Hora</span>
                    <span style={{ fontWeight: 700, fontSize: '12px' }}>{ticketTime}</span>
                  </div>
                  <div style={{ borderTop: '1px dashed #e5e7eb', paddingTop: '10px', marginBottom: '10px' }}>
                    <p style={{ fontSize: '8px', fontWeight: 900, color: '#9ca3af', textTransform: 'uppercase', margin: '0 0 3px', letterSpacing: '1px' }}>Cliente</p>
                    <p style={{ fontSize: '15px', fontWeight: 900, margin: '0 0 2px' }}>{printRepair.customerName}</p>
                    <p style={{ fontWeight: 700, color: '#6b7280', margin: 0, fontSize: '12px' }}>{printRepair.customerPhone}</p>
                  </div>
                  <div style={{ borderTop: '1px dashed #e5e7eb', paddingTop: '10px', marginBottom: '10px' }}>
                    <p style={{ fontSize: '8px', fontWeight: 900, color: '#9ca3af', textTransform: 'uppercase', margin: '0 0 3px', letterSpacing: '1px' }}>Equipo</p>
                    <p style={{ fontSize: '15px', fontWeight: 900, margin: 0 }}>{printRepair.deviceModel}</p>
                  </div>
                  <div style={{ borderTop: '1px dashed #e5e7eb', paddingTop: '10px', marginBottom: '14px' }}>
                    <p style={{ fontSize: '8px', fontWeight: 900, color: '#9ca3af', textTransform: 'uppercase', margin: '0 0 3px', letterSpacing: '1px' }}>Problema declarado</p>
                    <p style={{ fontWeight: 700, color: '#4b5563', fontSize: '12px', lineHeight: '1.4', margin: 0 }}>{printRepair.problemDescription}</p>
                  </div>
                  <div style={{ borderTop: '2px dashed #d1d5db', paddingTop: '12px', textAlign: 'center', marginBottom: '12px' }}>
                    <p style={{ fontSize: '8px', fontWeight: 900, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '2px', margin: '0 0 6px' }}>Ticket de servicio</p>
                    <svg ref={barcodeRef} style={{ display: 'block', margin: '0 auto' }} />
                    <p style={{ fontSize: '10px', fontWeight: 900, color: '#4f46e5', margin: '4px 0 2px', letterSpacing: '2px' }}>{srvCode}</p>
                    <p style={{ fontSize: '8px', color: '#d1d5db', margin: 0 }}>Escaneá para ver el estado del servicio</p>
                  </div>
                  <div style={{ borderTop: '2px dashed #d1d5db', paddingTop: '12px', textAlign: 'center' }}>
                    <p style={{ fontSize: '8px', fontWeight: 900, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '2px', margin: '0 0 6px' }}>Conserve este comprobante</p>
                    <p style={{ fontSize: '10px', fontWeight: 700, color: '#9ca3af', fontStyle: 'italic', margin: 0 }}>
                      El equipo quedó a cargo de Dany Telefonía.<br />Lo contactaremos cuando esté listo.
                    </p>
                  </div>
                </div>

                {/* ─── SEPARADOR ENTRE COPIAS ────────────────── */}
                <div style={{ borderTop: '3px solid #374151', margin: '4px 8px', padding: '6px 0', textAlign: 'center' }}>
                  <span style={{ fontSize: '8px', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '3px' }}>
                    ✂ — COPIA LOCAL — ✂
                  </span>
                </div>

                {/* ─── COPIA LOCAL ───────────────────────────── */}
                <div style={{ padding: '20px 16px' }}>
                  <div style={{ textAlign: 'center', borderBottom: '2px dashed #d1d5db', paddingBottom: '14px', marginBottom: '14px' }}>
                    <p style={{ fontSize: '18px', fontWeight: 900, margin: '0 0 2px', letterSpacing: '-0.5px' }}>Dany Telefonía</p>
                    <p style={{ fontSize: '9px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '2px', margin: '0 0 10px' }}>Servicio Técnico</p>
                    <div style={{ background: '#f3f4f6', borderRadius: '10px', padding: '6px 14px', display: 'inline-block' }}>
                      <p style={{ fontSize: '8px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '2px', margin: '0 0 2px' }}>N° Turno</p>
                      <p style={{ fontSize: '28px', fontWeight: 900, color: '#4f46e5', margin: 0, letterSpacing: '-1px' }}>#{ticketNum}</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <span style={{ fontSize: '9px', fontWeight: 900, color: '#9ca3af', textTransform: 'uppercase' }}>Fecha ingreso</span>
                    <span style={{ fontWeight: 700, fontSize: '12px' }}>{ticketDate}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ fontSize: '9px', fontWeight: 900, color: '#9ca3af', textTransform: 'uppercase' }}>Hora</span>
                    <span style={{ fontWeight: 700, fontSize: '12px' }}>{ticketTime}</span>
                  </div>
                  <div style={{ borderTop: '1px dashed #e5e7eb', paddingTop: '10px', marginBottom: '10px' }}>
                    <p style={{ fontSize: '8px', fontWeight: 900, color: '#9ca3af', textTransform: 'uppercase', margin: '0 0 3px', letterSpacing: '1px' }}>Cliente</p>
                    <p style={{ fontSize: '15px', fontWeight: 900, margin: '0 0 2px' }}>{printRepair.customerName}</p>
                    <p style={{ fontWeight: 700, color: '#6b7280', margin: 0, fontSize: '12px' }}>{printRepair.customerPhone}</p>
                  </div>
                  <div style={{ borderTop: '1px dashed #e5e7eb', paddingTop: '10px', marginBottom: '10px' }}>
                    <p style={{ fontSize: '8px', fontWeight: 900, color: '#9ca3af', textTransform: 'uppercase', margin: '0 0 3px', letterSpacing: '1px' }}>Equipo</p>
                    <p style={{ fontSize: '15px', fontWeight: 900, margin: 0 }}>{printRepair.deviceModel}</p>
                  </div>
                  <div style={{ borderTop: '1px dashed #e5e7eb', paddingTop: '10px', marginBottom: '14px' }}>
                    <p style={{ fontSize: '8px', fontWeight: 900, color: '#9ca3af', textTransform: 'uppercase', margin: '0 0 3px', letterSpacing: '1px' }}>Problema declarado</p>
                    <p style={{ fontWeight: 700, color: '#4b5563', fontSize: '12px', lineHeight: '1.4', margin: 0 }}>{printRepair.problemDescription}</p>
                  </div>
                  <div style={{ borderTop: '2px dashed #d1d5db', paddingTop: '12px', textAlign: 'center', marginBottom: '12px' }}>
                    <p style={{ fontSize: '8px', fontWeight: 900, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '2px', margin: '0 0 6px' }}>Ticket de servicio</p>
                    <svg ref={barcodeRef2} style={{ display: 'block', margin: '0 auto' }} />
                    <p style={{ fontSize: '10px', fontWeight: 900, color: '#4f46e5', margin: '4px 0 2px', letterSpacing: '2px' }}>{srvCode}</p>
                    <p style={{ fontSize: '8px', color: '#d1d5db', margin: 0 }}>Escaneá para ver el estado del servicio</p>
                  </div>
                  <div style={{ borderTop: '2px dashed #d1d5db', paddingTop: '12px', textAlign: 'center' }}>
                    <p style={{ fontSize: '9px', fontWeight: 900, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '2px', margin: '0 0 6px' }}>— Registro del local —</p>
                    <p style={{ fontSize: '10px', fontWeight: 700, color: '#9ca3af', fontStyle: 'italic', margin: '0 0 14px' }}>
                      El equipo quedó a cargo de Dany Telefonía.<br />Lo contactaremos cuando esté listo.
                    </p>
                    <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '10px' }}>
                      <p style={{ fontSize: '8px', fontWeight: 900, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '2px', margin: '0 0 5px' }}>
                        Técnico asignado
                      </p>
                      {techName
                        ? <p style={{ fontSize: '14px', fontWeight: 900, color: '#1f2937', margin: 0 }}>{techName}</p>
                        : <p style={{ fontSize: '11px', color: '#d1d5db', fontStyle: 'italic', margin: 0 }}>Sin asignar</p>
                      }
                    </div>
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      </div>

      {pendingConfirm && (
        <ConfirmDialog
          message={pendingConfirm.message}
          onConfirm={() => { pendingConfirm.onConfirm(); setPendingConfirm(null); }}
          onCancel={() => setPendingConfirm(null)}
        />
      )}

      {/* ── Modal Aplicar Garantía ── */}
      {warrantyRepair && (
        <Modal title="Aplicar Garantía" onClose={() => { setWarrantyRepair(null); setWarrantyType(null); setWarrantyPart(''); }}>
          <div className="space-y-5">

            {/* Info de la reparación original */}
            <div className="p-4 bg-gray-50 rounded-2xl space-y-1">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Reparación original</p>
              <p className="font-black text-gray-800">{warrantyRepair.deviceModel} — {warrantyRepair.customerName}</p>
              <p className="text-xs font-bold text-gray-500">{warrantyRepair.problemDescription}</p>
            </div>

            {/* Paso 1: tipo de garantía */}
            {!warrantyType && (
              <div className="space-y-3">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">¿Por qué vuelve?</p>
                <button onClick={() => setWarrantyType('labor')}
                  className="w-full flex items-start gap-4 p-4 bg-amber-50 border-2 border-amber-200 rounded-2xl hover:border-amber-400 transition-all text-left">
                  <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600 flex-shrink-0">
                    <Wrench size={20} />
                  </div>
                  <div>
                    <p className="font-black text-gray-800">El problema volvió</p>
                    <p className="text-[10px] font-bold text-gray-500 mt-0.5">Falla de mano de obra. Se reabre sin costo.</p>
                  </div>
                </button>
                <button onClick={() => setWarrantyType('part')}
                  className="w-full flex items-start gap-4 p-4 bg-red-50 border-2 border-red-200 rounded-2xl hover:border-red-400 transition-all text-left">
                  <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center text-red-600 flex-shrink-0">
                    <Package size={20} />
                  </div>
                  <div>
                    <p className="font-black text-gray-800">Un repuesto falló</p>
                    <p className="text-[10px] font-bold text-gray-500 mt-0.5">Seleccionás el repuesto defectuoso o lo escribís.</p>
                  </div>
                </button>
              </div>
            )}

            {/* Paso 2a: mano de obra — confirmar */}
            {warrantyType === 'labor' && (
              <div className="space-y-4">
                <button onClick={() => setWarrantyType(null)} className="text-[10px] font-black text-indigo-500 hover:text-indigo-700">← Cambiar</button>
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                  <p className="font-black text-amber-700 text-sm">Se creará una nueva reparación:</p>
                  <ul className="mt-2 space-y-1 text-[11px] font-bold text-amber-600">
                    <li>• Mismo cliente y equipo</li>
                    <li>• Costo: <span className="font-black">Gs. 0</span></li>
                    <li>• Marcada como 🔴 GARANTÍA</li>
                  </ul>
                </div>
                <button onClick={handleApplyWarranty} disabled={applyingWarranty}
                  className="w-full py-4 rounded-2xl bg-amber-500 text-white font-black hover:bg-amber-600 transition-all disabled:opacity-50">
                  {applyingWarranty ? 'Creando…' : 'Confirmar — Reabrir sin costo'}
                </button>
              </div>
            )}

            {/* Paso 2b: repuesto — elegir cuál o escribir */}
            {warrantyType === 'part' && (
              <div className="space-y-4">
                <button onClick={() => { setWarrantyType(null); setWarrantyPart(''); }} className="text-[10px] font-black text-indigo-500 hover:text-indigo-700">← Cambiar</button>

                {/* Si la reparación tenía repuestos guardados, mostrarlos */}
                {warrantyRepair.partsUsed && warrantyRepair.partsUsed.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Repuestos de esta reparación</p>
                    {warrantyRepair.partsUsed.map((p, i) => (
                      <button key={i} onClick={() => setWarrantyPart(p.name)}
                        className={cn('w-full flex items-center justify-between p-3 rounded-2xl border-2 transition-all text-left',
                          warrantyPart === p.name
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

                {/* Buscar en inventario completo */}
                <div className="space-y-1.5">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    Buscar repuesto en inventario
                  </p>
                  <PartSearch products={products} onSelect={p => setWarrantyPart(p.model)} />
                </div>

                {/* Input manual como fallback */}
                <div className="space-y-1.5">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    O escribir manualmente
                  </p>
                  <input
                    type="text"
                    value={warrantyPart}
                    onChange={e => setWarrantyPart(e.target.value)}
                    placeholder="Ej: Pantalla iPhone 13, Batería Samsung A15…"
                    className="w-full p-3 bg-gray-50 border-2 border-transparent focus:border-red-400 focus:bg-white rounded-2xl outline-none font-bold text-sm transition-all"
                  />
                </div>

                {warrantyPart && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-2xl">
                    <p className="font-black text-red-700 text-sm">Repuesto defectuoso: <span className="text-red-600">{warrantyPart}</span></p>
                    <p className="text-[10px] font-bold text-red-400 mt-0.5">Se reabre sin costo. Después marcás pérdida o empate.</p>
                  </div>
                )}

                <button onClick={handleApplyWarranty} disabled={applyingWarranty || !warrantyPart}
                  className="w-full py-4 rounded-2xl bg-red-600 text-white font-black hover:bg-red-700 transition-all disabled:opacity-50">
                  {applyingWarranty ? 'Creando…' : 'Confirmar — Garantía de repuesto'}
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};
