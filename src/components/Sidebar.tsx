import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  LayoutDashboard, Package, Wrench, ShoppingCart,
  Users, History, ShieldCheck, LogOut, ChevronLeft, ChevronRight,
  TrendingUp, Wallet, MoreHorizontal, X, Settings, ShoppingBag,
} from 'lucide-react';
import { UserProfile } from '../types';
import { cn } from '../lib/utils';

interface SidebarProps {
  user: UserProfile;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  onLogout: () => void;
  lowStockCount?: number;
}

const SHORT_LABEL: Record<string, string> = {
  dashboard:     'Inicio',
  stock:         'Stock',
  repairs:       'Reparac.',
  cashier:       'Caja',
  reventas:      'Reventas',
  wholesale:     'Mayoris.',
  history:       'Historial',
  stats:         'Estadíst.',
  gastos:        'Gastos',
  users:         'Usuarios',
  webconnection: 'Conexión',
};

// IDs que aparecen directos en la barra inferior (los 4 más usados)
const BOTTOM_IDS = ['dashboard', 'cashier', 'stock', 'repairs'];

export const Sidebar = ({ user, activeTab, setActiveTab, collapsed, setCollapsed, onLogout, lowStockCount = 0 }: SidebarProps) => {
  const [moreOpen, setMoreOpen] = useState(false);

  const menuItems = [
    { id: 'dashboard',     label: 'Dashboard',      icon: LayoutDashboard, roles: ['admin', 'cashier'] },
    { id: 'stock',         label: 'Stock',           icon: Package,         roles: ['admin', 'cashier', 'technician'] },
    { id: 'repairs',       label: 'Reparaciones',    icon: Wrench,          roles: ['admin', 'cashier', 'technician'] },
    { id: 'cashier',       label: 'Caja',            icon: ShoppingCart,    roles: ['admin', 'cashier'] },
    { id: 'reventas',      label: 'Reventas',        icon: ShoppingBag,     roles: ['admin', 'cashier'] },
    { id: 'wholesale',     label: 'Mayoristas',      icon: TrendingUp,      roles: ['admin', 'cashier'] },
    { id: 'history',       label: 'Historial',       icon: History,         roles: ['admin', 'cashier'] },
    { id: 'stats',         label: 'Estadísticas',    icon: TrendingUp,      roles: ['admin'] },
    { id: 'gastos',        label: 'Gastos',          icon: Wallet,          roles: ['admin'] },
    { id: 'users',         label: 'Usuarios',        icon: Users,           roles: ['admin'] },
    { id: 'configuraciones', label: 'Configuraciones', icon: Settings,        roles: ['admin'] },
  ];

  const filteredItems   = menuItems.filter(item => item.roles.includes(user.role));
  const bottomNavItems  = filteredItems.filter(i => BOTTOM_IDS.includes(i.id));
  const moreNavItems    = filteredItems.filter(i => !BOTTOM_IDS.includes(i.id));
  const isMoreActive    = moreNavItems.some(i => i.id === activeTab);

  const handleNavClick = (id: string) => {
    setActiveTab(id);
    setMoreOpen(false);
  };

  return (
    <>
      {/* ══════════════════════════════════════════
          SIDEBAR DESKTOP — oculto en mobile
          ══════════════════════════════════════════ */}
      <motion.div
        animate={{ width: collapsed ? 72 : 280 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="bg-white border-r border-gray-100 hidden md:flex flex-col h-screen sticky top-0 z-40 shadow-2xl shadow-gray-200/50 overflow-hidden flex-shrink-0"
      >
        {/* Header */}
        <div className="h-20 flex items-center justify-between px-4 flex-shrink-0">
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-3 overflow-hidden"
            >
              <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200 flex-shrink-0">
                <Package className="text-white" size={20} />
              </div>
              <h1 className="text-lg font-black text-gray-800 tracking-tighter whitespace-nowrap">Dany Telefonía</h1>
            </motion.div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              "p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400 hover:text-indigo-600 flex-shrink-0",
              collapsed && "mx-auto"
            )}
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        {/* Items */}
        <div className={cn(
          "flex-1 py-2 space-y-1",
          collapsed ? "overflow-hidden px-2" : "overflow-y-auto px-3"
        )}>
          {filteredItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              title={collapsed ? item.label : undefined}
              className={cn(
                "w-full flex items-center rounded-2xl transition-all duration-200 group relative",
                collapsed ? "justify-center p-3" : "gap-3 px-4 py-3",
                activeTab === item.id
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200"
                  : "text-gray-400 hover:bg-gray-50 hover:text-indigo-600"
              )}
            >
              <div className="relative flex-shrink-0">
                <item.icon
                  size={20}
                  className={cn(
                    "transition-transform duration-200",
                    activeTab === item.id ? "scale-110" : "group-hover:scale-110"
                  )}
                />
                {item.id === 'stock' && lowStockCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center leading-none">
                    {lowStockCount > 9 ? '9+' : lowStockCount}
                  </span>
                )}
              </div>
              {!collapsed && (
                <span className="font-bold text-sm whitespace-nowrap tracking-tight flex-1">
                  {item.label}
                </span>
              )}
              {!collapsed && item.id === 'stock' && lowStockCount > 0 && (
                <span className="text-[9px] font-black px-1.5 py-0.5 bg-red-100 text-red-600 rounded-full">
                  {lowStockCount}
                </span>
              )}
              {activeTab === item.id && !collapsed && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute left-0 w-1 h-7 bg-white/60 rounded-r-full"
                />
              )}
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className={cn(
          "border-t border-gray-100 flex-shrink-0",
          collapsed ? "p-2" : "p-3"
        )}>
          {!collapsed && (
            <div className="mb-2 px-3 py-2.5 bg-gray-50 rounded-2xl flex items-center gap-3">
              <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 font-black text-sm flex-shrink-0">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="overflow-hidden min-w-0">
                <p className="font-black text-sm text-gray-800 truncate">{user.name}</p>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{user.role}</p>
              </div>
            </div>
          )}
          <button
            onClick={onLogout}
            title={collapsed ? 'Cerrar Sesión' : undefined}
            className={cn(
              "w-full flex items-center rounded-2xl text-red-400 hover:bg-red-50 hover:text-red-600 transition-all duration-200 group",
              collapsed ? "justify-center p-3" : "gap-3 px-4 py-3"
            )}
          >
            <LogOut size={20} className="flex-shrink-0 group-hover:translate-x-0.5 transition-transform" />
            {!collapsed && <span className="font-bold text-sm">Cerrar Sesión</span>}
          </button>
        </div>
      </motion.div>

      {/* ══════════════════════════════════════════
          BARRA INFERIOR MOBILE — oculta en desktop
          Estilo WhatsApp: 4 tabs + botón Más
          ══════════════════════════════════════════ */}
      <nav className="fixed bottom-0 inset-x-0 z-50 md:hidden bg-white border-t border-gray-100 shadow-[0_-4px_24px_rgba(0,0,0,0.08)]">
        <div className="flex items-stretch h-16">

          {/* 4 tabs principales */}
          {bottomNavItems.map(item => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={cn(
                  'flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors active:scale-90',
                  active ? 'text-indigo-600' : 'text-gray-400'
                )}
              >
                <div className="relative">
                  <item.icon size={23} strokeWidth={active ? 2.5 : 1.8} />
                  {item.id === 'stock' && lowStockCount > 0 && (
                    <span className="absolute -top-1 -right-2 w-3.5 h-3.5 bg-red-500 text-white text-[8px] font-black rounded-full flex items-center justify-center leading-none">
                      {lowStockCount > 9 ? '9+' : lowStockCount}
                    </span>
                  )}
                </div>
                <span className={cn('text-[10px] leading-none', active ? 'font-black' : 'font-bold')}>
                  {SHORT_LABEL[item.id] ?? item.label}
                </span>
              </button>
            );
          })}

          {/* Botón Más */}
          <button
            onClick={() => setMoreOpen(true)}
            className={cn(
              'flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors active:scale-90',
              isMoreActive || moreOpen ? 'text-indigo-600' : 'text-gray-400'
            )}
          >
            <MoreHorizontal size={23} strokeWidth={isMoreActive || moreOpen ? 2.5 : 1.8} />
            <span className={cn('text-[10px] leading-none', isMoreActive || moreOpen ? 'font-black' : 'font-bold')}>
              Más
            </span>
          </button>

        </div>
      </nav>

      {/* ══════════════════════════════════════════
          DRAWER "MÁS" — slide-up como WhatsApp
          ══════════════════════════════════════════ */}
      <AnimatePresence>
        {moreOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-[55] md:hidden"
              onClick={() => setMoreOpen(false)}
            />

            {/* Panel */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              className="fixed bottom-0 inset-x-0 z-[60] md:hidden bg-white rounded-t-[32px] shadow-2xl overflow-hidden"
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 bg-gray-200 rounded-full" />
              </div>

              {/* Usuario + cerrar */}
              <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-700 font-black text-base">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-black text-gray-800 text-sm leading-tight">{user.name}</p>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{user.role}</p>
                  </div>
                </div>
                <button
                  onClick={() => setMoreOpen(false)}
                  className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center text-gray-500 active:bg-gray-200"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Grid de pestañas del "Más" */}
              {moreNavItems.length > 0 && (
                <div className="px-4 pt-4 pb-3 grid grid-cols-3 gap-3">
                  {moreNavItems.map(item => {
                    const active = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleNavClick(item.id)}
                        className={cn(
                          'flex flex-col items-center gap-2 py-4 px-2 rounded-2xl transition-all active:scale-95',
                          active
                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                            : 'bg-gray-50 text-gray-600 hover:bg-indigo-50 hover:text-indigo-700'
                        )}
                      >
                        <item.icon size={22} strokeWidth={active ? 2.5 : 1.8} />
                        <span className="text-[10px] font-black uppercase tracking-wide text-center leading-tight">
                          {item.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Cerrar sesión */}
              <div className="px-4 pb-8 pt-2">
                <button
                  onClick={() => { onLogout(); setMoreOpen(false); }}
                  className="w-full flex items-center justify-center gap-3 px-4 py-3.5 bg-red-50 text-red-500 rounded-2xl font-bold text-sm hover:bg-red-100 active:scale-98 transition-all"
                >
                  <LogOut size={18} />
                  Cerrar Sesión
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
