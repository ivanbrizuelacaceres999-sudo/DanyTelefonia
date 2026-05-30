import React from 'react';
import { motion } from 'motion/react';
import { AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ConfirmDialogProps {
  message:       string;
  onConfirm:     () => void;
  onCancel:      () => void;
  confirmLabel?: string;
  danger?:       boolean;
}

export const ConfirmDialog = ({
  message,
  onConfirm,
  onCancel,
  confirmLabel = 'Eliminar',
  danger = true,
}: ConfirmDialogProps) => (
  <div
    className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
    onClick={onCancel}
  >
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: 12 }}
      transition={{ duration: 0.15 }}
      className="bg-white rounded-[28px] p-6 shadow-2xl w-full max-w-sm"
      onClick={e => e.stopPropagation()}
    >
      <div className="flex items-start gap-4 mb-6">
        <div className={cn(
          'w-11 h-11 rounded-2xl flex items-center justify-center shrink-0',
          danger ? 'bg-red-50 text-red-500' : 'bg-amber-50 text-amber-500',
        )}>
          <AlertTriangle size={20} />
        </div>
        <p className="font-bold text-gray-700 text-sm leading-relaxed pt-2">{message}</p>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onCancel}
          className="flex-1 py-3 rounded-2xl border-2 border-gray-100 font-black text-gray-500 hover:bg-gray-50 transition-colors text-sm"
        >
          Cancelar
        </button>
        <button
          onClick={onConfirm}
          className={cn(
            'flex-1 py-3 rounded-2xl font-black text-white text-sm transition-all',
            danger
              ? 'bg-red-500 hover:bg-red-600 shadow-lg shadow-red-200'
              : 'bg-amber-500 hover:bg-amber-600 shadow-lg shadow-amber-200',
          )}
        >
          {confirmLabel}
        </button>
      </div>
    </motion.div>
  </div>
);
