import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Package, User, Lock, ArrowRight } from 'lucide-react';
import { api } from '../api';
import { UserProfile } from '../types';

interface LoginScreenProps {
  onLogin: (user: UserProfile) => void;
}

export const LoginScreen = ({ onLogin }: LoginScreenProps) => {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !password) return;
    setIsLoggingIn(true);
    setError('');
    try {
      const user = await api.login({ name, password });
      onLogin(user);
    } catch (error) {
      console.error("Login error:", error);
      setError("Credenciales inválidas. Intenta de nuevo.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 1, scale: 1 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md"
      >
        <div className="bg-white rounded-[40px] shadow-2xl p-10 relative overflow-hidden border border-gray-100">
          <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-50 rounded-full -mr-20 -mt-20 blur-3xl opacity-50" />
          <div className="absolute bottom-0 left-0 w-40 h-40 bg-purple-50 rounded-full -ml-20 -mb-20 blur-3xl opacity-50" />

          <div className="relative text-center mb-10">
            <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-indigo-200 rotate-6 hover:rotate-12 transition-transform duration-500">
              <Package className="text-white" size={40} />
            </div>
            <h1 className="text-4xl font-black text-gray-800 tracking-tighter mb-2">PhoneMaster</h1>
            <p className="text-gray-400 font-bold tracking-widest uppercase text-[10px]">Gestión de Telefonía</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6 relative">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Usuario</label>
              <div className="relative group">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-600 transition-colors" size={20} />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl py-4 pl-12 pr-4 outline-none transition-all font-bold text-gray-700"
                  placeholder="Tu nombre de usuario"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Contraseña</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-600 transition-colors" size={20} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl py-4 pl-12 pr-4 outline-none transition-all font-bold text-gray-700"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <motion.p 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-red-500 text-xs font-bold text-center bg-red-50 py-3 rounded-xl border border-red-100"
              >
                {error}
              </motion.p>
            )}

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-2xl shadow-xl shadow-indigo-200 transition-all flex items-center justify-center gap-3 group disabled:opacity-50"
            >
              {isLoggingIn ? "Iniciando sesión..." : "Entrar al Sistema"}
              <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
};
