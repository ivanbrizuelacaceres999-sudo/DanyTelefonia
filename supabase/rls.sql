-- ============================================================
-- PhoneMaster — Row Level Security (RLS)
-- Ejecutar en Supabase Dashboard → SQL Editor
-- ============================================================
-- Estrategia: usamos una función que verifica si el request
-- viene con el header correcto (app secret). Simple y efectivo
-- para una app de negocio sin auth de Supabase.
-- ============================================================

-- 1. Habilitar RLS en todas las tablas
ALTER TABLE users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories         ENABLE ROW LEVEL SECURITY;
ALTER TABLE products           ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_sessions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales              ENABLE ROW LEVEL SECURITY;
ALTER TABLE repair_types       ENABLE ROW LEVEL SECURITY;
ALTER TABLE repair_shelves     ENABLE ROW LEVEL SECURITY;
ALTER TABLE repair_workbenches ENABLE ROW LEVEL SECURITY;
ALTER TABLE repairs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE wholesalers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE fixed_costs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments           ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_withdrawals   ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawal_motives ENABLE ROW LEVEL SECURITY;
ALTER TABLE warranties         ENABLE ROW LEVEL SECURITY;
ALTER TABLE warranty_config    ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_config     ENABLE ROW LEVEL SECURITY;

-- 2. Crear una función que verifica el app secret
-- Cambiá 'PHONEMASTER_SECRET_2024' por cualquier contraseña larga
CREATE OR REPLACE FUNCTION app_authenticated()
RETURNS boolean AS $$
BEGIN
  RETURN current_setting('request.headers', true)::json->>'x-app-secret'
         = current_setting('app.secret', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Setear el secret (cambiá este valor por uno tuyo)
ALTER DATABASE postgres SET app.secret = 'PHONEMASTER_SECRET_2024';

-- 4. Políticas: permitir todo si viene con el secret correcto
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'users','categories','products','cash_sessions','sales',
    'repair_types','repair_shelves','repair_workbenches','repairs',
    'wholesalers','fixed_costs','payments','cash_withdrawals',
    'withdrawal_motives','warranties','warranty_config','expense_config'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('
      CREATE POLICY "app_access" ON %I
      FOR ALL TO anon
      USING (app_authenticated())
      WITH CHECK (app_authenticated());
    ', t);
  END LOOP;
END $$;
