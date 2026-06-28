# 📱 PhoneMaster — Sistema de Gestión para Tiendas de Telefonía

**PhoneMaster** es una aplicación web full-stack (PWA) para la administración integral de un negocio de telefonía: ventas, inventario, reparaciones, garantías, ventas mayoristas y control de gastos, todo en tiempo real.

> Proyecto real en producción, desarrollado para una tienda de repuestos y servicio técnico de celulares.

## ✨ Funcionalidades

- 🛒 **Caja / Punto de venta** — registro de ventas con generación de tickets e impresión
- 📊 **Dashboard y estadísticas** — métricas de ventas y rendimiento con gráficos interactivos
- 📦 **Control de stock** — inventario con importación/exportación desde Excel y códigos de barras
- 🔧 **Reparaciones** — seguimiento de órdenes de servicio técnico
- 🛡️ **Garantías** — gestión y consulta de garantías con código QR
- 🤝 **Mayorista / Reventas** — módulo de ventas a revendedores
- 💸 **Gastos** — registro y control de egresos
- 👥 **Usuarios y roles** — autenticación y permisos por tipo de usuario
- 📱 **PWA** — instalable como app, funciona en escritorio y móvil

## 🛠️ Stack Tecnológico

| Categoría | Tecnologías |
|-----------|-------------|
| **Frontend** | React 19, TypeScript, Vite 6 |
| **Estilos** | Tailwind CSS 4, Motion (animaciones) |
| **Backend / DB** | Supabase (PostgreSQL, Auth, Realtime) |
| **Gráficos** | Recharts |
| **Utilidades** | jsBarcode, qrcode.react, react-to-print, xlsx, date-fns |
| **IA** | Google Gemini (`@google/genai`) |
| **Deploy** | Vercel + PWA (vite-plugin-pwa) |

## 🚀 Instalación local

**Requisitos:** Node.js 18+ y una cuenta de [Supabase](https://supabase.com).

```bash
# 1. Clonar
git clone https://github.com/ivanbrizuelacaceres999-sudo/DanyTelefonia.git
cd DanyTelefonia

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env   # y completá tus credenciales de Supabase

# 4. Ejecutar en desarrollo
npm run dev
```

## 🔐 Variables de entorno

Ver [`.env.example`](.env.example). Se necesitan las claves del proyecto de Supabase
(`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) y, opcionalmente, una clave de Gemini.

## 📂 Estructura

```
src/
├── components/     # Vistas: Caja, Stock, Reparaciones, Garantías, etc.
│   └── ui/         # Componentes reutilizables
├── lib/            # Cliente de Supabase
├── types/          # Tipos TypeScript
└── api.ts          # Capa de acceso a datos
```

## 📸 Módulos principales

| Módulo | Descripción |
|--------|-------------|
| `CashierView` | Punto de venta y caja |
| `StockView` | Gestión de inventario |
| `RepairsView` | Órdenes de reparación |
| `WarrantyView` | Garantías con QR |
| `WholesaleView` | Ventas mayoristas |
| `DashboardView` / `StatisticsView` | Métricas y reportes |

---

Desarrollado con ❤️ por [Iván Brizuela](https://github.com/ivanbrizuelacaceres999-sudo)
