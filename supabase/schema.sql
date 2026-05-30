-- ============================================================
-- PhoneMaster — Schema SQL para Supabase (PostgreSQL)
-- Ejecutar en: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ─── Usuarios / Empleados ────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL UNIQUE,
  password     TEXT NOT NULL,
  role         TEXT NOT NULL DEFAULT 'cashier', -- 'admin' | 'cashier' | 'technician'
  weekly_wage  NUMERIC DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Categorías de Productos ─────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  warranty_days INTEGER DEFAULT 2
);

-- ─── Productos / Inventario ───────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT,
  model               TEXT,
  brand               TEXT,
  barcode             TEXT,
  quantity            INTEGER DEFAULT 0,
  purchased_quantity  INTEGER DEFAULT 0,
  cost_price          NUMERIC DEFAULT 0,
  sale_price          NUMERIC DEFAULT 0,
  price_wholesale     NUMERIC DEFAULT 0,
  price_cheap         NUMERIC DEFAULT 0,
  location            TEXT,
  category_id         UUID REFERENCES categories(id) ON DELETE SET NULL,
  batches             JSONB DEFAULT '[]',    -- [{ quantity, costPrice, date }]
  low_stock_alert     INTEGER DEFAULT 5,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Sesiones de Caja ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cash_sessions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opened_by            UUID REFERENCES users(id),
  opened_at            TIMESTAMPTZ DEFAULT NOW(),
  closed_at            TIMESTAMPTZ,
  status               TEXT DEFAULT 'open',  -- 'open' | 'closed'
  initial_cash         NUMERIC DEFAULT 0,
  sales_count          INTEGER DEFAULT 0,
  totals               JSONB DEFAULT '{"cash":0,"transfer":0,"card":0,"qr":0,"credit_card":0,"debit_card":0}',
  warranty_adjustments JSONB DEFAULT '[]'
);

-- ─── Ventas ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date                 TIMESTAMPTZ DEFAULT NOW(),
  items                JSONB DEFAULT '[]',   -- [{ id, type, name, price, cost, quantity }]
  payments             JSONB DEFAULT '[]',   -- [{ method, amount }]
  total                NUMERIC DEFAULT 0,
  cost_total           NUMERIC DEFAULT 0,
  discount             NUMERIC DEFAULT 0,
  customer_name        TEXT DEFAULT 'Consumidor Final',
  session_id           UUID REFERENCES cash_sessions(id),
  payment_method       TEXT DEFAULT 'cash',
  note                 TEXT,
  warranty_adjustments JSONB DEFAULT '[]'
);

-- ─── Tipos de Reparación ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS repair_types (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  base_price  NUMERIC DEFAULT 0,
  fixed_cost  NUMERIC DEFAULT 0
);

-- ─── Repisas de Reparación ────────────────────────────────────
CREATE TABLE IF NOT EXISTS repair_shelves (
  id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL
);

-- ─── Mesas de Reparación ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS repair_workbenches (
  id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL
);

-- ─── Reparaciones ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS repairs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id           TEXT UNIQUE,            -- ej: SRV-AB12CD
  status              TEXT DEFAULT 'pending', -- pending | in_progress | ready | no_solution | delivered
  customer_name       TEXT,
  customer_phone      TEXT,
  device_model        TEXT,
  device_brand        TEXT,
  problem_description TEXT,
  repair_type         TEXT,
  total_cost          NUMERIC DEFAULT 0,
  price               NUMERIC DEFAULT 0,
  notes               JSONB DEFAULT '[]',     -- [{ text, createdAt }]
  parts_used          JSONB DEFAULT '[]',     -- [{ id, name, price, cost, quantity }]
  technician_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  technician_history  JSONB DEFAULT '[]',     -- [{ technicianId, technicianName, assignedAt, removedAt }]
  shelf_id            UUID REFERENCES repair_shelves(id) ON DELETE SET NULL,
  workbench_id        UUID REFERENCES repair_workbenches(id) ON DELETE SET NULL,
  end_time            TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Mayoristas / Proveedores ─────────────────────────────────
CREATE TABLE IF NOT EXISTS wholesalers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  business_name   TEXT,
  contact         TEXT,
  debt            NUMERIC DEFAULT 0,
  payment_history JSONB DEFAULT '[]'  -- [{ date, amount, remainingDebt, note }]
);

-- ─── Gastos Fijos ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fixed_costs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  description TEXT,
  amount      NUMERIC DEFAULT 0,
  date        TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Pagos de Empleados (sueldos) ────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID REFERENCES users(id) ON DELETE CASCADE,
  week_start     TIMESTAMPTZ,
  week_end       TIMESTAMPTZ,
  gross_wage     NUMERIC DEFAULT 0,
  advances       JSONB DEFAULT '[]',  -- [{ amount, description }]
  total_advances NUMERIC DEFAULT 0,
  net_wage       NUMERIC DEFAULT 0,
  note           TEXT,
  paid_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Retiros de Caja ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cash_withdrawals (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES cash_sessions(id),
  date       TIMESTAMPTZ DEFAULT NOW(),
  amount     NUMERIC DEFAULT 0,
  motive     TEXT,
  note       TEXT
);

-- ─── Motivos de Retiro ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS withdrawal_motives (
  id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL
);

-- ─── Garantías ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS warranties (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id       UUID REFERENCES sales(id) ON DELETE SET NULL,
  product_id    UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name  TEXT,
  customer_name TEXT,
  date          TIMESTAMPTZ DEFAULT NOW(),
  expires_at    TIMESTAMPTZ,
  warranty_days INTEGER DEFAULT 2,
  status        TEXT DEFAULT 'active',  -- active | expired | defective | resolved_by_provider | loss
  amount        NUMERIC DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Configuración de Garantía (singleton) ───────────────────
CREATE TABLE IF NOT EXISTS warranty_config (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  default_days INTEGER DEFAULT 30
);

-- ─── Configuración de Porcentaje de Gastos (singleton) ───────
CREATE TABLE IF NOT EXISTS expense_config (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operative_percent NUMERIC DEFAULT 0,
  fixed_percent     NUMERIC DEFAULT 0
);

-- ─── Índices para mejor performance ──────────────────────────
CREATE INDEX IF NOT EXISTS idx_products_barcode      ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_category     ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_sales_date            ON sales(date);
CREATE INDEX IF NOT EXISTS idx_sales_session         ON sales(session_id);
CREATE INDEX IF NOT EXISTS idx_repairs_status        ON repairs(status);
CREATE INDEX IF NOT EXISTS idx_repairs_ticket        ON repairs(ticket_id);
CREATE INDEX IF NOT EXISTS idx_warranties_sale       ON warranties(sale_id);
CREATE INDEX IF NOT EXISTS idx_warranties_status     ON warranties(status);
CREATE INDEX IF NOT EXISTS idx_payments_user         ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_cash_withdrawals_session ON cash_withdrawals(session_id);

-- ─── Deshabilitar RLS (app de uso privado/interno) ────────────
-- Si necesitás RLS en el futuro, comentá estas líneas y configurá políticas.
ALTER TABLE users              DISABLE ROW LEVEL SECURITY;
ALTER TABLE categories         DISABLE ROW LEVEL SECURITY;
ALTER TABLE products           DISABLE ROW LEVEL SECURITY;
ALTER TABLE cash_sessions      DISABLE ROW LEVEL SECURITY;
ALTER TABLE sales              DISABLE ROW LEVEL SECURITY;
ALTER TABLE repair_types       DISABLE ROW LEVEL SECURITY;
ALTER TABLE repair_shelves     DISABLE ROW LEVEL SECURITY;
ALTER TABLE repair_workbenches DISABLE ROW LEVEL SECURITY;
ALTER TABLE repairs            DISABLE ROW LEVEL SECURITY;
ALTER TABLE wholesalers        DISABLE ROW LEVEL SECURITY;
ALTER TABLE fixed_costs        DISABLE ROW LEVEL SECURITY;
ALTER TABLE payments           DISABLE ROW LEVEL SECURITY;
ALTER TABLE cash_withdrawals   DISABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawal_motives DISABLE ROW LEVEL SECURITY;
ALTER TABLE warranties         DISABLE ROW LEVEL SECURITY;
ALTER TABLE warranty_config    DISABLE ROW LEVEL SECURITY;
ALTER TABLE expense_config     DISABLE ROW LEVEL SECURITY;

-- ─── Datos iniciales (admin por defecto) ─────────────────────
INSERT INTO users (name, password, role)
VALUES ('Admin', 'admin123', 'admin')
ON CONFLICT (name) DO NOTHING;
