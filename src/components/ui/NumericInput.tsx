import React from 'react';

/**
 * Input numérico con formato de puntos de miles automático.
 * El estado interno siempre guarda el número SIN puntos (dígitos crudos).
 * El display muestra "1.500.000". Al hacer onChange devuelve solo dígitos.
 */

const addDots = (raw: string): string => {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

interface NumericInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  /** Valor crudo (sin puntos), ej: "1500000" */
  value: string;
  /** Devuelve solo dígitos, ej: "1500000" */
  onChange: (raw: string) => void;
}

export const NumericInput = ({ value, onChange, ...props }: NumericInputProps) => (
  <input
    {...props}
    type="text"
    inputMode="numeric"
    value={addDots(String(value ?? ''))}
    onChange={e => onChange(e.target.value.replace(/\D/g, ''))}
  />
);
