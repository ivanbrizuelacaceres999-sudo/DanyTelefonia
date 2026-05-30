// ============================================================
// src/hooks/useBarcodeScanner.ts
// ============================================================
// Este hook escucha el teclado globalmente y detecta cuándo
// un lector físico de código de barras está escaneando.
//
// ¿Cómo diferencia el lector del teclado humano?
// Un lector EAN-13 envía 13 caracteres en menos de 50ms y
// termina con Enter. Un humano tarda mucho más entre teclas.
// ============================================================

import { useEffect, useRef, useCallback } from 'react';

// ── Configuración del detector ────────────────────────────────
const MAX_MS_BETWEEN_CHARS = 50;  // ms máximo entre caracteres del lector
const MIN_BARCODE_LENGTH   = 4;   // mínimo de caracteres para considerar escaneo

// ── Tipos de código detectados ────────────────────────────────
export type BarcodeType =
  | 'product'   // EAN-13/8: solo números → buscar en stock
  | 'repair'    // Empieza con "SRV-"    → abrir reparación
  | 'sale'      // Empieza con "VEN-"    → verificar garantía
  | 'unknown';  // No reconocido

export interface ScanResult {
  raw:  string;       // El código tal cual lo leyó el lector
  type: BarcodeType;  // Tipo detectado
  id:   string;       // El ID limpio (sin prefijo SRV- o VEN-)
}

// ── Función que clasifica el código escaneado ─────────────────
function classifyBarcode(code: string): ScanResult {
  const clean = code.trim();

  if (clean.startsWith('SRV-')) {
    return { raw: clean, type: 'repair', id: clean.replace('SRV-', '') };
  }
  if (clean.startsWith('VEN-')) {
    return { raw: clean, type: 'sale', id: clean.replace('VEN-', '') };
  }
  if (/^\d+$/.test(clean)) {
    // Solo números → es un EAN-13, EAN-8 u otro código de producto
    return { raw: clean, type: 'product', id: clean };
  }
  return { raw: clean, type: 'unknown', id: clean };
}

// ── Hook principal ────────────────────────────────────────────
// Uso:
//   useBarcodeScanner((result) => {
//     if (result.type === 'product') { ... }
//   });
//
// active: si false, el listener no procesa escaneos
// (útil para desactivarlo cuando hay un input enfocado)
export function useBarcodeScanner(
  onScan: (result: ScanResult) => void,
  active: boolean = true
) {
  // Buffer acumula los caracteres que llegan rápido
  const bufferRef       = useRef<string>('');
  // Guarda el timestamp del último caracter recibido
  const lastKeyTimeRef  = useRef<number>(0);
  // Timer para limpiar el buffer si pasa mucho tiempo
  const timerRef        = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onScanRef = useRef(onScan);
  useEffect(() => { onScanRef.current = onScan; }, [onScan]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!active) return;

    // Si el usuario está escribiendo en un input/textarea, ignoramos
    // para no interferir con la carga normal de datos
    const target = e.target as HTMLElement;
    const isTyping = target.tagName === 'INPUT' ||
                     target.tagName === 'TEXTAREA' ||
                     target.isContentEditable;

    // EXCEPCIÓN: si el input tiene data-barcode="true", sí lo procesamos
    // (lo usaremos en el campo barcode del formulario de producto)
    const isBarcodeInput = (target as HTMLInputElement).dataset?.barcode === 'true';

    if (isTyping && !isBarcodeInput) return;

    const now = Date.now();

    // ── Enter → el lector terminó de enviar el código ──────────
    if (e.key === 'Enter') {
      if (timerRef.current) clearTimeout(timerRef.current);

      const code = bufferRef.current.trim();

      // Solo procesar si llegó rápido y tiene suficiente longitud
      const timeDiff    = now - lastKeyTimeRef.current;
      const arrivedFast = timeDiff < MAX_MS_BETWEEN_CHARS * 3;

      if (code.length >= MIN_BARCODE_LENGTH && arrivedFast) {
        e.preventDefault(); // Evitar que Enter dispare formularios
        const result = classifyBarcode(code);
        onScanRef.current(result);
      }

      bufferRef.current = '';
      return;
    }

    // ── Caracteres normales → acumular en buffer ───────────────
    // Solo acumulamos si el caracter llegó rápido (lector)
    // o si el buffer ya tiene algo (continuación de escaneo)
    const timeDiff = now - lastKeyTimeRef.current;
    const isFirst  = bufferRef.current.length === 0;

    if (isFirst || timeDiff < MAX_MS_BETWEEN_CHARS) {
      if (e.key.length === 1) { // Solo caracteres imprimibles
        bufferRef.current += e.key;
        lastKeyTimeRef.current = now;

        // Timer de seguridad: limpiar buffer si no llega Enter en 500ms
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          bufferRef.current = '';
        }, 500);
      }
    } else {
      // Tardó demasiado → era el teclado humano, limpiar buffer
      bufferRef.current  = e.key.length === 1 ? e.key : '';
      lastKeyTimeRef.current = now;
    }
  }, [active]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [handleKeyDown]);
}
