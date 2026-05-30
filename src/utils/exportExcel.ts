import * as XLSX from 'xlsx';

const METHOD_ES: Record<string, string> = {
  cash: 'Efectivo', credit_card: 'T. Crédito', debit_card: 'T. Débito',
  transfer: 'Transferencia', qr: 'QR', credit: 'Crédito', mixed: 'Múltiple',
};
const fmtMethod = (m: string) => METHOD_ES[m] ?? m;
const fmtGs = (n: number) => Math.round(n).toLocaleString('es-PY');

/** Aplica estilos de cabecera a un rango de celdas */
function styleHeader(ws: XLSX.WorkSheet, range: string, bgColor: string) {
  const ref = XLSX.utils.decode_range(range);
  for (let C = ref.s.c; C <= ref.e.c; C++) {
    const addr = XLSX.utils.encode_cell({ r: ref.s.r, c: C });
    if (!ws[addr]) continue;
    ws[addr].s = {
      font:      { bold: true, color: { rgb: 'FFFFFF' } },
      fill:      { patternType: 'solid', fgColor: { rgb: bgColor } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: {
        top:    { style: 'thin', color: { rgb: 'CCCCCC' } },
        bottom: { style: 'thin', color: { rgb: 'CCCCCC' } },
        left:   { style: 'thin', color: { rgb: 'CCCCCC' } },
        right:  { style: 'thin', color: { rgb: 'CCCCCC' } },
      },
    };
  }
}

/** Ancho de columnas automático basado en el contenido */
function autoWidth(data: any[][], extra = 2) {
  if (!data.length) return [];
  const cols = data[0].length;
  return Array.from({ length: cols }, (_, c) => {
    const max = data.reduce((m, row) => Math.max(m, String(row[c] ?? '').length), 0);
    return { wch: Math.min(Math.max(max + extra, 8), 50) };
  });
}

export interface ExportData {
  period:       { from: Date | string; to: Date | string };
  sales:        any[];
  gastos:       any[];
  retiros:      any[];
  resumenDiario: any[];
  resumenPago:  any[];
  resumen:      any;
}

export function buildExcel(data: ExportData, periodLabel: string) {
  const wb = XLSX.utils.book_new();

  // ── Hoja 1: Ventas Detalladas ─────────────────────────────────
  {
    const headers = [
      'Fecha', 'Hora', 'Producto', 'Tipo', 'Cantidad',
      'Precio Unit. (Gs.)', 'Subtotal (Gs.)', 'Costo Unit. (Gs.)', 'Ganancia (Gs.)',
      'Descuento (Gs.)', 'Método de Pago', 'Cliente', 'Reclamo Garantía', 'Nota',
    ];
    const rows = (data.sales || []).map((s: any) => [
      s.fecha, s.hora, s.producto, s.tipo, s.cantidad,
      s.precioUnitario, s.subtotal, s.costoUnitario, s.ganancia,
      s.descuento, fmtMethod(s.metodoPago), s.cliente, s.reclamoGarantia, s.nota,
    ]);
    const aoa = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = autoWidth(aoa);
    styleHeader(ws, `A1:N1`, '4338CA');
    XLSX.utils.book_append_sheet(wb, ws, 'Ventas Detalladas');
  }

  // ── Hoja 2: Retiros de Caja ───────────────────────────────────
  {
    const headers = ['Fecha', 'Hora', 'Monto (Gs.)', 'Destino', 'Nota'];
    const rows = (data.retiros || []).map((r: any) => [
      r.fecha, r.hora, r.monto, r.destino, r.nota,
    ]);
    const aoa = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = autoWidth(aoa);
    styleHeader(ws, `A1:E1`, 'EA580C');
    XLSX.utils.book_append_sheet(wb, ws, 'Retiros de Caja');
  }

  // ── Hoja 3: Gastos Fijos ──────────────────────────────────────
  {
    const headers = ['Fecha', 'Descripción', 'Monto (Gs.)'];
    const rows = (data.gastos || []).map((g: any) => [g.fecha, g.descripcion, g.monto]);
    const aoa = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = autoWidth(aoa);
    styleHeader(ws, `A1:C1`, 'DC2626');
    XLSX.utils.book_append_sheet(wb, ws, 'Gastos Fijos');
  }

  // ── Hoja 4: Resumen por Día ───────────────────────────────────
  {
    const headers = ['Fecha', 'Cant. Ventas', 'Ingresos (Gs.)', 'Costo Mercancía (Gs.)', 'Ganancia Bruta (Gs.)', 'Retiros (Gs.)'];
    const rows = (data.resumenDiario || []).map((d: any) => [
      d.fecha, d.ventas, d.ingresos, d.costo, d.ganancia, d.retiros,
    ]);
    const aoa = [headers, ...rows];
    // Fila de totales
    if (rows.length > 0) {
      const tot = rows.reduce((acc, r) => {
        acc[1] += r[1]; acc[2] += r[2]; acc[3] += r[3]; acc[4] += r[4]; acc[5] += r[5];
        return acc;
      }, ['TOTAL', 0, 0, 0, 0, 0]);
      aoa.push(tot);
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = autoWidth(aoa);
    styleHeader(ws, `A1:F1`, '059669');
    XLSX.utils.book_append_sheet(wb, ws, 'Resumen por Día');
  }

  // ── Hoja 5: Métodos de Pago ───────────────────────────────────
  {
    const headers = ['Método de Pago', 'Cantidad de Ventas', 'Total Recibido (Gs.)'];
    const rows = (data.resumenPago || []).map((p: any) => [
      fmtMethod(p.metodo), p.cantidad, p.total,
    ]);
    const aoa = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = autoWidth(aoa);
    styleHeader(ws, `A1:C1`, '7C3AED');
    XLSX.utils.book_append_sheet(wb, ws, 'Métodos de Pago');
  }

  // ── Hoja 6: Resumen General ───────────────────────────────────
  {
    const r = data.resumen || {};
    const aoa = [
      ['RESUMEN GENERAL', `Período: ${periodLabel}`],
      [],
      ['Indicador', 'Valor (Gs.)'],
      ['Total de ventas',          r.totalVentas    ?? 0],
      ['Ingresos totales',         r.ingresos       ?? 0],
      ['Costo de mercancía',       r.costoMercancia ?? 0],
      ['Ganancia bruta',           r.gananciaBruta  ?? 0],
      ['Gastos fijos registrados', r.gastosFijos    ?? 0],
      ['Total retiros de caja',    r.totalRetiros   ?? 0],
      ['Utilidad neta estimada',   r.utilidadNeta   ?? 0],
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 30 }, { wch: 20 }];
    styleHeader(ws, `A1:B1`, '1D4ED8');
    XLSX.utils.book_append_sheet(wb, ws, 'Resumen General');
  }

  XLSX.writeFile(wb, `PhoneMaster_${periodLabel.replace(/\//g, '-')}.xlsx`);
}
