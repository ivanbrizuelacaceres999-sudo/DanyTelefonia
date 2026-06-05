import React from 'react';
import { Settings } from 'lucide-react';

export const ConfiguracionesView = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-4xl font-black text-gray-800 tracking-tighter">Configuraciones</h2>
        <p className="text-gray-400 font-bold tracking-widest uppercase text-[10px] mt-1">Ajustes del sistema</p>
      </div>
      <div className="text-center py-32 bg-white rounded-[40px] border border-gray-100">
        <Settings size={48} className="mx-auto mb-4 text-gray-200" />
        <p className="font-black text-gray-300 uppercase tracking-widest text-sm">Próximamente</p>
      </div>
    </div>
  );
};
