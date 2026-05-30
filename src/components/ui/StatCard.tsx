import React from 'react';
import { motion } from 'motion/react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
}

export const StatCard = ({ label, value, icon: Icon, color }: StatCardProps) => (
  <motion.div 
    whileHover={{ y: -5, scale: 1.02 }}
    className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center gap-5 transition-all hover:shadow-xl group"
  >
    <div className={`p-4 rounded-2xl ${color} shadow-lg shadow-current/10 group-hover:scale-110 transition-transform`}>
      <Icon size={28} className="text-white" />
    </div>
    <div>
      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{label}</p>
      <p className="text-3xl font-black text-gray-800 tracking-tighter">{value}</p>
    </div>
  </motion.div>
);
