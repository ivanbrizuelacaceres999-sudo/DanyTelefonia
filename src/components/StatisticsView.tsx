import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
  LineChart, Line, Area, AreaChart
} from 'recharts';
import {
  TrendingUp, AlertCircle, PieChart as PieChartIcon,
  BarChart as BarChartIcon, Clock, Package, ShieldCheck,
  Users, TrendingDown, Download, RefreshCw
} from 'lucide-react';
import { api } from '../api';
import { socket } from '../socket';
import { cn } from '../lib/utils';
import * as XLSX from 'xlsx';

const COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316'];

interface StatsData {
  totalStockValue:       number;
  averageRepairTime:     number;
  mostSoldProducts:      { name: string; count: number }[];
  leastSoldProducts:     { name: string; count: number }[];
  profitByProduct:       { name: string; profit: number }[];
  mostSoldCategories:    { name: string; count: number }[];
  ticketPromedio:        number;
  warrantyReturnRate:    string;
  monthlyCashflow:       { month: string; revenue: number; stockCosts: number; costs: number; profit: number }[];
  hourlyMap:             { hour: number; count: number; revenue: number }[];
  salesProjection:       number;
  technicianPerformance: { name: string; count: number; avgTime: number }[];
  totalSalesCount:       number;
}

// ── Componente de tarjeta métrica ─────────────────────────────
const MetricCard = ({ title, subtitle, value, sub, color = 'indigo', icon: Icon }: any) => (
  <div className="bg-white p-6 rounded-[30px] shadow-sm border border-gray-100">
    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center mb-3 bg-${color}-50 text-${color}-600`}>
      <Icon size={20} />
    </div>
    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">{title}</p>
    {subtitle && <p className="text-[9px] font-bold text-gray-300 mb-1">{subtitle}</p>}
    <p className={`text-3xl font-black tracking-tighter text-${color}-600`}>{value}</p>
    {sub && <p className="text-[9px] font-bold text-gray-400 mt-1">{sub}</p>}
  </div>
);

export const StatisticsView = () => {
  const [stats, setStats]         = useState<StatsData | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(false);
  const [exporting, setExporting] = useState(false);
  const [expConfig, setExpConfig] = useState({ operativePercent: 0, fixedPercent: 0 });
  const [exportFrom, setExportFrom] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  );
  const [exportTo, setExportTo] = useState(new Date().toISOString().split('T')[0]);

  const loadStats = () => {
    setLoading(true);
    setError(false);
    api.getStats()
      .then(s => { setStats(s); })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadStats();
    (api as any).getExpenseConfig().then((c: any) => {
      if (c && !c.error) setExpConfig({ operativePercent: c.operativePercent ?? 0, fixedPercent: c.fixedPercent ?? 0 });
    });

    // Recargar automáticamente cuando cambian gastos, ventas o productos
    const handleUpdate = ({ event }: { event: string }) => {
      if (['fixed-costs', 'sales', 'products', 'repairs'].includes(event)) {
        loadStats();
      }
    };
    socket.on('data_update', handleUpdate);
    return () => { socket.off('data_update', handleUpdate); };
  }, []);

  // ── Exportar a Excel ─────────────────────────────────────────
  const handleExport = async () => {
    setExporting(true);
    try {
      const data = await fetch(`/api/export?from=${exportFrom}&to=${exportTo}`).then(r => r.json());

      const wb = XLSX.utils.book_new();

      // Hoja 1: Ventas
      const ventasData = [
        ['Fecha', 'Hora', 'Cliente', 'Productos', 'Total (Gs.)', 'Costo (Gs.)', 'Ganancia (Gs.)', 'Método de Pago'],
        ...data.sales.map((s: any) => [s.fecha, s.hora, s.cliente, s.items, s.total, s.costo, s.ganancia, s.metodoPago])
      ];
      const wsVentas = XLSX.utils.aoa_to_sheet(ventasData);
      wsVentas['!cols'] = [{ wch: 12 }, { wch: 8 }, { wch: 20 }, { wch: 40 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(wb, wsVentas, 'Ventas');

      // Hoja 2: Gastos fijos
      const gastosData = [
        ['Fecha', 'Descripción', 'Monto (Gs.)'],
        ...data.gastos.map((g: any) => [g.fecha, g.descripcion, g.monto])
      ];
      const wsGastos = XLSX.utils.aoa_to_sheet(gastosData);
      wsGastos['!cols'] = [{ wch: 12 }, { wch: 30 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(wb, wsGastos, 'Gastos Fijos');

      // Hoja 3: Resumen
      const r = data.resumen;
      const resumenData = [
        ['Resumen del Período'],
        ['Desde:', exportFrom, 'Hasta:', exportTo],
        [],
        ['Concepto', 'Monto (Gs.)'],
        ['Total de Ventas (cantidad)', r.totalVentas],
        ['Ingresos Totales', r.ingresos],
        ['Costo de Mercancía', r.costoMercancia],
        ['Ganancia Bruta', r.gananciaBruta],
        ['Gastos Fijos', r.gastosFijos],
        ['Utilidad Neta', r.utilidadNeta],
        [],
        ['Generado por Dany Telefonía', new Date().toLocaleDateString('es-PY')],
      ];
      const wsResumen = XLSX.utils.aoa_to_sheet(resumenData);
      wsResumen['!cols'] = [{ wch: 30 }, { wch: 20 }];
      XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen');

      // Descargar
      XLSX.writeFile(wb, `DanyTelefonia_${exportFrom}_${exportTo}.xlsx`);
    } catch {
      setError(true);
    } finally {
      setExporting(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-96">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
    </div>
  );

  if (error || !stats) return (
    <div className="flex items-center justify-center h-96">
      <div className="text-center space-y-3">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
        <p className="text-red-500 font-semibold">No se pudieron cargar las estadísticas</p>
        <button onClick={loadStats} className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700">
          Reintentar
        </button>
      </div>
    </div>
  );

  const maxHour = stats.hourlyMap.reduce((max, h) => h.count > max.count ? h : max, stats.hourlyMap[0]);

  // Calcular ganancia real = profit - (revenue * operativePercent / 100)
  const totalPercent = expConfig.operativePercent + expConfig.fixedPercent;
  const cashflowWithReal = (stats.monthlyCashflow ?? []).map(m => ({
    ...m,
    realProfit: Math.round(m.profit - m.revenue * expConfig.operativePercent / 100),
  }));

  // ── Datos supervivencia: mes actual (último del array) ──────
  const currentMonthStats  = cashflowWithReal.length > 0 ? cashflowWithReal[cashflowWithReal.length - 1] : null;
  const revenueMes         = currentMonthStats?.revenue    ?? 0;
  const stockCostsMes      = currentMonthStats?.stockCosts ?? 0;
  const costosFijosMes     = currentMonthStats?.costs      ?? 0;
  const operativoMes       = Math.round(revenueMes * expConfig.operativePercent / 100);
  // Ganancia bruta = ingresos − costo de la mercancía
  const gananciaBrutaMes   = revenueMes - stockCostsMes;
  // Gastos de operación totales = gastos fijos registrados + asignación sueldos
  const totalOverheadsMes  = costosFijosMes + operativoMes;
  // Ganancia real = ganancia bruta − todos los gastos de operación
  const gananciaRealMes    = currentMonthStats?.realProfit ?? 0;
  // Sobrante/faltante = gananciaReal (ya tiene todo descontado)
  const sobranteMes        = gananciaRealMes;
  // Barra: ¿cuánto de los gastos de operación cubre la ganancia bruta?
  const pctCubierto        = totalOverheadsMes > 0
    ? Math.min(100, Math.max(0, Math.round((gananciaBrutaMes / totalOverheadsMes) * 100)))
    : (gananciaBrutaMes > 0 ? 100 : 0);
  const statusSup          = pctCubierto >= 100 ? 'CUBIERTO' : pctCubierto >= 50 ? 'EN RIESGO' : 'SIN CUBRIR';

  return (
    <div className="space-y-10 pb-20">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-4xl font-black text-gray-800 tracking-tighter">Estadísticas</h2>
          <p className="text-gray-400 font-bold tracking-widest uppercase text-[10px] mt-1">Panel de análisis completo</p>
        </div>
        <button onClick={loadStats}
          className="flex items-center gap-2 px-5 py-3 bg-gray-50 text-gray-600 font-black rounded-2xl hover:bg-gray-100 transition-all border border-gray-100">
          <RefreshCw size={16} /> Actualizar
        </button>
      </div>

      {/* ── INDICADOR DE SUPERVIVENCIA ── */}
      <section>
        <div className="relative overflow-hidden rounded-[40px] bg-gradient-to-br from-indigo-700 to-indigo-900 p-8 shadow-2xl shadow-indigo-200">
          {/* Glow decorativo */}
          <div className="absolute top-0 right-0 w-72 h-72 bg-white/5 rounded-full -mr-36 -mt-36 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-56 h-56 bg-indigo-400/10 rounded-full -ml-28 -mb-28 blur-3xl pointer-events-none" />

          <div className="relative space-y-6">
            {/* Título + badge */}
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <p className="text-[10px] font-black text-indigo-300/60 uppercase tracking-widest mb-1">
                  Análisis Financiero · {currentMonthStats?.month ?? 'Mes Actual'}
                </p>
                <h3 className="text-2xl font-black text-white tracking-tight">
                  INDICADOR DE SUPERVIVENCIA
                </h3>
              </div>
              <div className={cn(
                "px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest border",
                statusSup === 'CUBIERTO'    ? "bg-white/20 text-white border-white/30"
                : statusSup === 'EN RIESGO' ? "bg-amber-400/20 text-amber-300 border-amber-400/40"
                : "bg-red-400/20 text-red-300 border-red-400/40"
              )}>
                {statusSup === 'CUBIERTO' ? '✅' : statusSup === 'EN RIESGO' ? '⚠️' : '🔴'} {statusSup}
              </div>
            </div>

            {/* Barra de progreso */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <p className="text-[10px] font-bold text-indigo-300/60">
                  Tu ganancia bruta cubre los gastos de operación
                </p>
                <p className="text-3xl font-black text-white tracking-tighter">{pctCubierto}%</p>
              </div>
              <div className="h-5 bg-indigo-950/50 rounded-full overflow-hidden border border-white/10">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pctCubierto}%` }}
                  transition={{ duration: 1.2, ease: 'easeOut' }}
                  className={cn(
                    "h-full rounded-full",
                    pctCubierto >= 100 ? "bg-gradient-to-r from-indigo-300 to-white"
                    : pctCubierto >= 50  ? "bg-gradient-to-r from-amber-500 to-amber-300"
                    : "bg-gradient-to-r from-red-700 to-red-500"
                  )}
                />
              </div>
              <div className="flex justify-between text-[9px] font-bold text-indigo-300/50">
                <span>0%</span>
                <span>
                  META: 100% {totalOverheadsMes > 0 ? `· Gs. ${totalOverheadsMes.toLocaleString()} en gastos` : ''}
                </span>
                <span>100%+</span>
              </div>
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Ganancia bruta = lo que queda después de pagar la mercancía */}
              <div className="bg-white/10 border border-white/10 rounded-2xl p-5">
                <p className="text-[9px] font-black text-indigo-300/60 uppercase tracking-widest mb-2">Ganancia Bruta</p>
                <p className={cn("text-2xl font-black tracking-tighter",
                  gananciaBrutaMes >= 0 ? "text-white" : "text-red-300")}>
                  Gs. {gananciaBrutaMes.toLocaleString()}
                </p>
                <p className="text-[9px] font-bold text-indigo-300/50 mt-1">
                  Ventas − costo mercancía
                  {revenueMes > 0 && ` · ${Math.round(gananciaBrutaMes / revenueMes * 100)}% de margen`}
                </p>
              </div>
              {/* Gastos de operación totales */}
              <div className="bg-white/10 border border-white/10 rounded-2xl p-5">
                <p className="text-[9px] font-black text-indigo-300/60 uppercase tracking-widest mb-2">Gastos Operación</p>
                <p className="text-2xl font-black text-red-300 tracking-tighter">
                  Gs. {totalOverheadsMes.toLocaleString()}
                </p>
                <div className="mt-1 space-y-0.5">
                  {costosFijosMes > 0 && (
                    <p className="text-[9px] font-bold text-indigo-300/40">
                      Fijos: Gs. {costosFijosMes.toLocaleString()}
                    </p>
                  )}
                  {operativoMes > 0 && (
                    <p className="text-[9px] font-bold text-indigo-300/40">
                      Sueldos ({expConfig.operativePercent}%): Gs. {operativoMes.toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
              {/* Sobrante/Faltante = gananciaReal (ya con todo descontado) */}
              <div className={cn(
                "border rounded-2xl p-5",
                sobranteMes >= 0 ? "bg-white/15 border-white/20" : "bg-red-500/15 border-red-400/30"
              )}>
                <p className="text-[9px] font-black text-indigo-300/60 uppercase tracking-widest mb-2">
                  {sobranteMes >= 0 ? 'Para el Local' : 'Pérdida Neta'}
                </p>
                <p className={cn("text-2xl font-black tracking-tighter",
                  sobranteMes >= 0 ? "text-white" : "text-red-300")}>
                  {sobranteMes >= 0 ? '+' : ''}Gs. {sobranteMes.toLocaleString()}
                </p>
                <p className="text-[9px] font-bold text-indigo-300/50 mt-1">
                  {sobranteMes >= 0 ? 'Después de cubrir todo ✓' : 'No cubriste los costos ⚠️'}
                </p>
              </div>
            </div>

            {/* Aviso si no hay gastos registrados */}
            {totalOverheadsMes === 0 && (
              <p className="text-[10px] font-bold text-indigo-300/50 text-center border border-white/10 rounded-xl p-3">
                ℹ️ Sin gastos fijos ni % de sueldos configurados. Registrá tus gastos en Historial y configurá los porcentajes en Gastos para ver el indicador completo.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ── Sección 1: Métricas clave ── */}
      <section>
        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Métricas Clave</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <MetricCard icon={Package} title="Valor en Stock" subtitle="Suma costo × cantidad"
            value={`Gs. ${(stats.totalStockValue ?? 0).toLocaleString()}`} color="indigo" />
          <MetricCard icon={TrendingUp} title="Ticket Promedio" subtitle="Ingreso por venta"
            value={`Gs. ${(stats.ticketPromedio ?? 0).toLocaleString()}`}
            sub={`Basado en ${stats.totalSalesCount} ventas`} color="emerald" />
          <MetricCard icon={Clock} title="Tiempo Promedio" subtitle="Por reparación"
            value={`${(stats.averageRepairTime ?? 0).toFixed(1)}h`} color="amber" />
          <MetricCard icon={ShieldCheck} title="Tasa de Garantía" subtitle="Ventas que volvieron"
            value={`${stats.warrantyReturnRate ?? 0}%`}
            sub={parseFloat(stats.warrantyReturnRate ?? '0') > 5 ? '⚠️ Alta — revisar calidad' : '✓ Normal'}
            color={parseFloat(stats.warrantyReturnRate ?? '0') > 5 ? 'red' : 'emerald'} />
          <MetricCard icon={TrendingUp} title="Proyección Mes" subtitle="Basado en últimos 3 meses"
            value={`Gs. ${(stats.salesProjection ?? 0).toLocaleString()}`} color="purple" />
          <MetricCard icon={BarChartIcon} title="Categorías Activas"
            value={`${(stats.mostSoldCategories ?? []).length}`} color="blue" />
          <MetricCard icon={AlertCircle} title="Hora Pico"
            value={`${maxHour?.hour}:00`}
            sub={`${maxHour?.count} ventas en ese horario`} color="orange" />
          <MetricCard icon={Users} title="Técnicos Activos"
            value={`${(stats.technicianPerformance ?? []).length}`} color="pink" />
        </div>
      </section>

      {/* ── Sección 2: Flujo de caja mensual ── */}
      <section>
        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Flujo de Caja — Últimos 6 Meses</h3>
        <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100">
          {totalPercent > 0 && (
            <p className="text-[9px] font-bold text-gray-400 mb-4">
              Ganancia Real incluye deducción de {expConfig.operativePercent}% operativo (sueldos)
              {expConfig.fixedPercent > 0 ? ` + ${expConfig.fixedPercent}% fijo ya incluido en Gastos` : ''}
            </p>
          )}
          {cashflowWithReal.every(m => m.revenue === 0) ? (
            <p className="text-gray-300 text-center py-10 font-black uppercase text-sm">Sin datos suficientes</p>
          ) : (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cashflowWithReal}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 'bold' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }}
                    tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    formatter={(v: any) => [`Gs. ${Number(v).toLocaleString()}`, '']} />
                  <Legend />
                  <Bar dataKey="revenue"    name="Ingresos"       fill="#6366f1" radius={[6,6,0,0]} />
                  <Bar dataKey="costs"      name="Gastos Fijos"   fill="#ef4444" radius={[6,6,0,0]} />
                  <Bar dataKey="profit"     name="Ganancia Bruta" fill="#10b981" radius={[6,6,0,0]} />
                  {totalPercent > 0 && (
                    <Bar dataKey="realProfit" name="Ganancia Real"  fill="#f59e0b" radius={[6,6,0,0]} />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </section>

      {/* ── Sección 3: Productos + Categorías ── */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100">
          <h3 className="text-xl font-black text-gray-800 mb-6 flex items-center gap-3">
            <BarChartIcon size={20} className="text-indigo-600" /> Productos Más Vendidos
          </h3>
          {(stats.mostSoldProducts ?? []).length === 0
            ? <p className="text-gray-300 text-center py-10 font-black text-sm uppercase">Sin ventas</p>
            : <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.mostSoldProducts} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="name" axisLine={false} tickLine={false}
                      tick={{ fontSize: 10, fontWeight: 'bold' }} width={100} />
                    <Tooltip contentStyle={{ borderRadius: '16px', border: 'none' }} />
                    <Bar dataKey="count" name="Unidades" fill="#6366f1" radius={[0,6,6,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
          }
        </div>

        <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100">
          <h3 className="text-xl font-black text-gray-800 mb-6 flex items-center gap-3">
            <PieChartIcon size={20} className="text-emerald-600" /> Ventas por Categoría
          </h3>
          {(stats.mostSoldCategories ?? []).length === 0
            ? <p className="text-gray-300 text-center py-10 font-black text-sm uppercase">Sin datos</p>
            : <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={stats.mostSoldCategories} cx="50%" cy="50%"
                      innerRadius={60} outerRadius={90} paddingAngle={4} dataKey="count" nameKey="name">
                      {stats.mostSoldCategories.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '16px', border: 'none' }} />
                    <Legend iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              </div>
          }
        </div>
      </section>

      {/* ── Sección 4: Mapa de calor horario ── */}
      <section>
        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">
          Horarios con Más Ventas — Mapa de Calor
        </h3>
        <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100">
          <div className="grid grid-cols-12 gap-1.5">
            {(stats.hourlyMap ?? []).map(h => {
              const maxCount = Math.max(...(stats.hourlyMap ?? []).map(x => x.count), 1);
              const intensity = maxCount > 0 ? h.count / maxCount : 0;
              const bg = intensity === 0 ? 'bg-gray-50'
                : intensity < 0.25 ? 'bg-indigo-100'
                : intensity < 0.5  ? 'bg-indigo-300'
                : intensity < 0.75 ? 'bg-indigo-500'
                : 'bg-indigo-700';
              const text = intensity > 0.5 ? 'text-white' : 'text-gray-600';
              return (
                <div key={h.hour} className={`${bg} rounded-xl p-2 text-center`} title={`${h.hour}:00 — ${h.count} ventas`}>
                  <p className={`text-[9px] font-black ${text}`}>{h.hour}h</p>
                  <p className={`text-[10px] font-black ${text}`}>{h.count}</p>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-3 mt-4 justify-end">
            <p className="text-[9px] font-bold text-gray-400">Menos ventas</p>
            {['bg-gray-50','bg-indigo-100','bg-indigo-300','bg-indigo-500','bg-indigo-700'].map(c => (
              <div key={c} className={`w-5 h-5 rounded-md ${c} border border-gray-100`} />
            ))}
            <p className="text-[9px] font-bold text-gray-400">Más ventas</p>
          </div>
          {maxHour && (
            <p className="text-sm font-black text-indigo-600 mt-3 text-center">
              🔥 Tu hora pico es las <span className="underline">{maxHour.hour}:00</span> con {maxHour.count} ventas
            </p>
          )}
        </div>
      </section>

      {/* ── Sección 5: Rendimiento por técnico ── */}
      {(stats.technicianPerformance ?? []).length > 0 && (
        <section>
          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Rendimiento por Técnico</h3>
          <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100">
            <div className="space-y-4">
              {stats.technicianPerformance.map((t, i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-700 font-black text-sm">
                      {t.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-black text-gray-800">{t.name}</p>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                        {t.count} reparaciones · Promedio: {t.avgTime}h
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-indigo-600">{t.count}</p>
                    <p className="text-[9px] font-bold text-gray-400 uppercase">servicios</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Sección 6: Ganancia por producto ── */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100">
          <h3 className="text-xl font-black text-gray-800 mb-6 flex items-center gap-3">
            <TrendingUp size={20} className="text-emerald-600" /> Mayor Ganancia por Producto
          </h3>
          {(stats.profitByProduct ?? []).length === 0
            ? <p className="text-gray-300 text-center py-10 font-black text-sm uppercase">Sin datos</p>
            : <div className="space-y-3">
                {stats.profitByProduct.slice(0, 5).map((p, i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center text-emerald-600 shadow-sm font-black text-sm">{i+1}</div>
                      <p className="font-bold text-gray-800">{p.name}</p>
                    </div>
                    <p className="font-black text-emerald-600">Gs. {(p.profit ?? 0).toLocaleString()}</p>
                  </div>
                ))}
              </div>
          }
        </div>

        <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100">
          <h3 className="text-xl font-black text-gray-800 mb-6 flex items-center gap-3">
            <TrendingDown size={20} className="text-red-500" /> Menos Vendidos
          </h3>
          {(stats.leastSoldProducts ?? []).length === 0
            ? <p className="text-gray-300 text-center py-10 font-black text-sm uppercase">Sin datos</p>
            : <div className="space-y-3">
                {stats.leastSoldProducts.slice(0, 5).map((p, i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center text-red-500 shadow-sm font-black text-sm">{i+1}</div>
                      <p className="font-bold text-gray-800">{p.name}</p>
                    </div>
                    <p className="font-black text-gray-400">{p.count ?? 0} ventas</p>
                  </div>
                ))}
              </div>
          }
        </div>
      </section>

      {/* ── Sección 7: Exportar para contador ── */}
      <section>
        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Exportar para el Contador</h3>
        <div className="bg-white p-8 rounded-[40px] shadow-sm border border-gray-100">
          <div className="flex flex-col md:flex-row items-end gap-4">
            <div className="space-y-2 flex-1">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Desde</label>
              <input type="date" value={exportFrom} onChange={e => setExportFrom(e.target.value)}
                className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-indigo-600 rounded-2xl outline-none font-bold" />
            </div>
            <div className="space-y-2 flex-1">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Hasta</label>
              <input type="date" value={exportTo} onChange={e => setExportTo(e.target.value)}
                className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-indigo-600 rounded-2xl outline-none font-bold" />
            </div>
            <button onClick={handleExport} disabled={exporting}
              className="flex items-center gap-3 px-8 py-4 bg-emerald-600 text-white font-black rounded-2xl shadow-xl shadow-emerald-200 hover:bg-emerald-700 transition-all disabled:opacity-50 whitespace-nowrap">
              <Download size={18} />
              {exporting ? 'Generando...' : 'Descargar Excel'}
            </button>
          </div>
          <p className="text-[10px] font-bold text-gray-400 mt-4">
            Genera un archivo Excel con 3 hojas: Ventas detalladas · Gastos Fijos · Resumen del período
          </p>
        </div>
      </section>

    </div>
  );
};
