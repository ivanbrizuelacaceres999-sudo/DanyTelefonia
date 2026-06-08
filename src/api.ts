// ============================================================
// src/api.ts — Todas las operaciones de datos via Supabase
// Sin Express: el frontend habla directo con Supabase
// ============================================================

import { supabase, toClient, toDB, generateTicketId, broadcast } from './lib/supabase';

export const api = {

  // ─── Autenticación ──────────────────────────────────────────
  login: async (credentials: { name: string; password: string }) => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('name', credentials.name)
      .eq('password', credentials.password)
      .single();
    if (error || !data) throw new Error('Credenciales inválidas');
    return toClient(data);
  },

  // ─── Usuarios ───────────────────────────────────────────────
  getUsers: async () => {
    const { data } = await supabase.from('users').select('*').order('name');
    return toClient(data ?? []);
  },
  createUser: async (body: any) => {
    const { data, error } = await supabase.from('users').insert(toDB(body)).select().single();
    if (error) throw new Error(error.message);
    await broadcast('users');
    return toClient(data);
  },
  updateUser: async (id: string, body: any) => {
    const { data } = await supabase.from('users').update(toDB(body)).eq('id', id).select().single();
    await broadcast('users');
    return toClient(data);
  },
  deleteUser: async (id: string) => {
    await supabase.from('users').delete().eq('id', id);
    await broadcast('users');
    return { ok: true };
  },
  updateUserWage: async (id: string, weeklyWage: number) => {
    const { data } = await supabase.from('users').update({ weekly_wage: weeklyWage }).eq('id', id).select().single();
    await broadcast('users');
    return toClient(data);
  },
  getUserPayments: async (userId: string) => {
    const { data } = await supabase.from('payments').select('*').eq('user_id', userId).order('paid_at', { ascending: false });
    return toClient(data ?? []);
  },
  createPayment: async (userId: string, body: { advances?: { amount: number; description: string }[]; note?: string }) => {
    const { data: user } = await supabase.from('users').select('*').eq('id', userId).single();
    if (!user) throw new Error('Usuario no encontrado');
    if (user.role === 'admin') throw new Error('Los admins no tienen pagos semanales');

    const advances = body.advances ?? [];
    const grossWage: number = user.weekly_wage ?? 0;
    const totalAdvances: number = advances.reduce((s: number, a: { amount: number }) => s + (a.amount ?? 0), 0);
    const netWage = Math.max(grossWage - totalAdvances, 0);

    const now = new Date();
    const day = now.getDay();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - day + (day === 0 ? -6 : 1));
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 5);
    weekEnd.setHours(23, 59, 59, 999);

    const { data } = await supabase.from('payments').insert({
      user_id: userId, week_start: weekStart, week_end: weekEnd,
      gross_wage: grossWage, advances, total_advances: totalAdvances, net_wage: netWage,
      note: body.note ?? '',
    }).select().single();
    return toClient(data);
  },
  deletePayment: async (paymentId: string) => {
    await supabase.from('payments').delete().eq('id', paymentId);
    return { ok: true };
  },

  // ─── Categorías ─────────────────────────────────────────────
  getCategories: async () => {
    const { data } = await supabase.from('categories').select('*').order('name');
    return toClient(data ?? []);
  },
  createCategory: async (body: any) => {
    const { data } = await supabase.from('categories').insert(toDB(body)).select().single();
    await broadcast('categories');
    return toClient(data);
  },
  updateCategory: async (id: string, body: any) => {
    const { data } = await supabase.from('categories').update(toDB(body)).eq('id', id).select().single();
    await broadcast('categories');
    return toClient(data);
  },
  deleteCategory: async (id: string) => {
    await supabase.from('categories').delete().eq('id', id);
    await broadcast('categories');
    return { ok: true };
  },

  // ─── Mayoristas ─────────────────────────────────────────────
  getWholesalers: async () => {
    const { data } = await supabase.from('wholesalers').select('*').order('name');
    return toClient(data ?? []);
  },
  createWholesaler: async (body: any) => {
    const { data } = await supabase.from('wholesalers').insert(toDB(body)).select().single();
    await broadcast('wholesalers');
    return toClient(data);
  },
  updateWholesaler: async (id: string, body: any) => {
    const { data } = await supabase.from('wholesalers').update(toDB(body)).eq('id', id).select().single();
    await broadcast('wholesalers');
    return toClient(data);
  },
  deleteWholesaler: async (id: string) => {
    await supabase.from('wholesalers').delete().eq('id', id);
    await broadcast('wholesalers');
    return { ok: true };
  },
  payWholesaler: async (id: string, amount: number, note?: string, collectedBy?: string) => {
    const { data: w } = await supabase.from('wholesalers').select('*').eq('id', id).single();
    if (!w) throw new Error('Mayorista no encontrado');
    const previousDebt = w.debt;
    const remainingDebt = Math.max(0, previousDebt - amount);
    const history = [...(w.payment_history ?? []), {
      date: new Date().toISOString(), amount, remainingDebt, note: note ?? '', collectedBy: collectedBy ?? '',
    }];
    const { data } = await supabase.from('wholesalers')
      .update({ debt: remainingDebt, payment_history: history })
      .eq('id', id).select().single();
    await broadcast('wholesalers');
    return { wholesaler: toClient(data), previousDebt, remainingDebt };
  },

  // ─── Gastos Fijos ────────────────────────────────────────────
  getFixedCosts: async () => {
    const { data } = await supabase.from('fixed_costs').select('*').order('date', { ascending: false });
    return toClient(data ?? []);
  },
  createFixedCost: async (body: any) => {
    const { data } = await supabase.from('fixed_costs').insert(toDB(body)).select().single();
    await broadcast('fixed-costs');
    return toClient(data);
  },
  deleteFixedCost: async (id: string) => {
    await supabase.from('fixed_costs').delete().eq('id', id);
    await broadcast('fixed-costs');
    return { ok: true };
  },

  // ─── Config Gastos ───────────────────────────────────────────
  getExpenseConfig: async () => {
    let { data } = await supabase.from('expense_config').select('*').maybeSingle();
    if (!data) {
      const res = await supabase.from('expense_config').insert({ operative_percent: 0, fixed_percent: 0 }).select().single();
      data = res.data;
    }
    return toClient(data);
  },
  updateExpenseConfig: async (body: { operativePercent: number; fixedPercent: number }) => {
    let { data: existing } = await supabase.from('expense_config').select('id').maybeSingle();
    let data;
    if (existing) {
      const res = await supabase.from('expense_config')
        .update({ operative_percent: body.operativePercent, fixed_percent: body.fixedPercent })
        .eq('id', existing.id).select().single();
      data = res.data;
    } else {
      const res = await supabase.from('expense_config')
        .insert({ operative_percent: body.operativePercent, fixed_percent: body.fixedPercent })
        .select().single();
      data = res.data;
    }
    return toClient(data);
  },

  // ─── Tipos de Reparación ────────────────────────────────────
  getRepairTypes: async () => {
    const { data } = await supabase.from('repair_types').select('*').order('name');
    return toClient(data ?? []);
  },
  createRepairType: async (body: any) => {
    const { data } = await supabase.from('repair_types').insert(toDB(body)).select().single();
    await broadcast('repair-types');
    return toClient(data);
  },
  updateRepairType: async (id: string, body: any) => {
    const { data } = await supabase.from('repair_types').update(toDB(body)).eq('id', id).select().single();
    await broadcast('repair-types');
    return toClient(data);
  },
  deleteRepairType: async (id: string) => {
    await supabase.from('repair_types').delete().eq('id', id);
    await broadcast('repair-types');
    return { ok: true };
  },

  // ─── Repisas ────────────────────────────────────────────────
  getRepairShelves: async () => {
    const { data } = await supabase.from('repair_shelves').select('*').order('name');
    return toClient(data ?? []);
  },
  createRepairShelf: async (name: string) => {
    const { data } = await supabase.from('repair_shelves').insert({ name }).select().single();
    await broadcast('repair-shelves');
    return toClient(data);
  },
  deleteRepairShelf: async (id: string) => {
    await supabase.from('repair_shelves').delete().eq('id', id);
    await broadcast('repair-shelves');
    return { ok: true };
  },

  // ─── Mesas ──────────────────────────────────────────────────
  getRepairWorkbenches: async () => {
    const { data } = await supabase.from('repair_workbenches').select('*').order('name');
    return toClient(data ?? []);
  },
  createRepairWorkbench: async (name: string) => {
    const { data } = await supabase.from('repair_workbenches').insert({ name }).select().single();
    await broadcast('repair-workbenches');
    return toClient(data);
  },
  deleteRepairWorkbench: async (id: string) => {
    await supabase.from('repair_workbenches').delete().eq('id', id);
    await broadcast('repair-workbenches');
    return { ok: true };
  },

  // ─── Config Garantía ─────────────────────────────────────────
  getWarrantyConfig: async () => {
    let { data } = await supabase.from('warranty_config').select('*').maybeSingle();
    if (!data) {
      const res = await supabase.from('warranty_config').insert({ default_days: 30 }).select().single();
      data = res.data;
    }
    return toClient(data);
  },
  updateWarrantyConfig: async (body: any) => {
    let { data: existing } = await supabase.from('warranty_config').select('id').maybeSingle();
    let data;
    if (existing) {
      const res = await supabase.from('warranty_config').update(toDB(body)).eq('id', existing.id).select().single();
      data = res.data;
    } else {
      const res = await supabase.from('warranty_config').insert(toDB(body)).select().single();
      data = res.data;
    }
    return toClient(data);
  },
  updateProductWarranty: async (_productId: string, _days: number) => ({ ok: true }),

  // ─── Productos ──────────────────────────────────────────────
  getProducts: async () => {
    const { data } = await supabase.from('products').select('*');
    return toClient(data ?? []);
  },
  createProduct: async (body: any) => {
    const { data, error } = await supabase.from('products').insert(toDB(body)).select().single();
    if (error) throw new Error(error.message);
    await broadcast('products');
    return toClient(data);
  },
  updateProduct: async (id: string, body: any) => {
    const { data } = await supabase.from('products').update(toDB(body)).eq('id', id).select().single();
    await broadcast('products');
    return toClient(data);
  },
  restockProduct: async (id: string, body: { quantity: number; costPrice: number }) => {
    const { data: prod } = await supabase.from('products').select('*').eq('id', id).single();
    if (!prod) throw new Error('Producto no encontrado');
    const batches = [...(prod.batches ?? []), { quantity: body.quantity, costPrice: body.costPrice, date: new Date().toISOString() }];
    const { data } = await supabase.from('products').update({
      quantity: (prod.quantity ?? 0) + body.quantity,
      purchased_quantity: (prod.purchased_quantity ?? 0) + body.quantity,
      cost_price: body.costPrice,
      batches,
    }).eq('id', id).select().single();
    await broadcast('products');
    return toClient(data);
  },
  deleteProduct: async (id: string) => {
    await supabase.from('products').delete().eq('id', id);
    await broadcast('products');
    return { ok: true };
  },
  generateBarcode: async (id: string) => {
    const { data: prod } = await supabase.from('products').select('barcode').eq('id', id).single();
    if (prod?.barcode) return { barcode: prod.barcode };
    let barcode = '';
    for (let attempt = 0; attempt < 10; attempt++) {
      const random5 = Math.floor(10000 + Math.random() * 90000).toString();
      const base = '20' + random5;
      let sum = 0;
      for (let i = 0; i < 7; i++) sum += parseInt(base[i]) * (i % 2 === 0 ? 3 : 1);
      barcode = base + ((10 - (sum % 10)) % 10);
      const { data: exists } = await supabase.from('products').select('id').eq('barcode', barcode).maybeSingle();
      if (!exists) break;
    }
    await supabase.from('products').update({ barcode }).eq('id', id);
    await broadcast('products');
    return { barcode };
  },

  // ─── Búsqueda de producto por código de barras ───────────────
  getProductByBarcode: async (code: string) => {
    const { data } = await supabase.from('products').select('*').eq('barcode', code).maybeSingle();
    if (!data) return { found: false, barcode: code };
    return { found: true, product: toClient(data) };
  },

  // ─── Reparaciones ────────────────────────────────────────────
  getRepairs: async () => {
    const { data } = await supabase.from('repairs').select('*').order('created_at', { ascending: false });
    return toClient(data ?? []);
  },
  createRepair: async (body: any) => {
    // Generar ticket_id único
    let ticketId = generateTicketId();
    for (let i = 0; i < 10; i++) {
      const { data: exists } = await supabase.from('repairs').select('id').eq('ticket_id', ticketId).maybeSingle();
      if (!exists) break;
      ticketId = generateTicketId();
    }
    // newNote no es una columna — se descarta en la creación
    const { newNote: _nn, technicianHistory: _th, notes: _n, ...cleanBody } = body;
    const dbBody = { ...toDB(cleanBody), ticket_id: ticketId };
    // Campos UUID vacíos deben ser null, no ""
    if (!dbBody.technician_id) dbBody.technician_id = null;
    if (!dbBody.shelf_id)      dbBody.shelf_id      = null;
    if (!dbBody.workbench_id)  dbBody.workbench_id  = null;
    const { data, error } = await supabase.from('repairs').insert(dbBody).select().single();
    if (error) throw new Error(error.message);
    await broadcast('repairs');
    return toClient(data);
  },
  updateRepair: async (id: string, body: any) => {
    const { newNote, technicianHistory: _th, notes: _n, ...updateBody } = body;
    const { data: current } = await supabase.from('repairs').select('*').eq('id', id).single();
    if (!current) throw new Error('Reparación no encontrada');

    const updateFields = toDB(updateBody);

    // Historial de técnico
    const oldTechId = current.technician_id ?? null;
    const newTechId = updateFields.technician_id ?? null;
    if (oldTechId && oldTechId !== newTechId) {
      const { data: oldUser } = await supabase.from('users').select('name').eq('id', oldTechId).single();
      updateFields.technician_history = [...(current.technician_history ?? []), {
        technicianId: oldTechId,
        technicianName: oldUser?.name ?? 'Desconocido',
        assignedAt: current.created_at,
        removedAt: new Date().toISOString(),
      }];
    }

    // Nueva nota
    if (newNote?.trim()) {
      updateFields.notes = [...(current.notes ?? []), { text: newNote.trim(), createdAt: new Date().toISOString() }];
    }

    const { data } = await supabase.from('repairs').update(updateFields).eq('id', id).select().single();
    await broadcast('repairs');
    return toClient(data);
  },
  deleteRepair: async (id: string) => {
    await supabase.from('repairs').delete().eq('id', id);
    await broadcast('repairs');
    return { ok: true };
  },

  // ─── Aplicar garantía de reparación ─────────────────────────
  applyRepairWarranty: async (repairId: string, opts: {
    type: 'labor' | 'part';
    defectivePart?: string;
  }) => {
    const { data: original, error: fetchErr } = await supabase
      .from('repairs').select('*').eq('id', repairId).single();
    if (fetchErr || !original) throw new Error('Reparación no encontrada');

    // Generar nuevo ticket
    let ticketId = generateTicketId();
    for (let i = 0; i < 10; i++) {
      const { data: exists } = await supabase.from('repairs').select('id').eq('ticket_id', ticketId).maybeSingle();
      if (!exists) break;
      ticketId = generateTicketId();
    }

    const desc = opts.type === 'part'
      ? `[GARANTÍA] Repuesto defectuoso: ${opts.defectivePart}. Problema original: ${original.problem_description}`
      : `[GARANTÍA] Problema recurrente. Problema original: ${original.problem_description}`;

    const insertData: any = {
      ticket_id:           ticketId,
      customer_name:       original.customer_name,
      customer_phone:      original.customer_phone,
      device_model:        original.device_model,
      device_brand:        original.device_brand ?? null,
      problem_description: desc,
      repair_type:         original.repair_type ?? null,
      technician_id:       original.technician_id ?? null,
      status:              'pending',
      total_cost:          0,
      parts_used:          [],
      notes:               [],
      is_warranty:         true,
      original_repair_id:  repairId,
    };
    if (opts.defectivePart) insertData.warranty_defective_part = opts.defectivePart;

    const { data: newRepair, error } = await supabase
      .from('repairs').insert(insertData).select().single();

    if (error) throw new Error(error.message);
    await broadcast('repairs');
    return toClient(newRepair);
  },

  // ─── Resolver garantía (pérdida o empate) ────────────────────
  resolveRepairWarranty: async (repairId: string, resolution: 'loss' | 'provider_replenishment') => {
    const { data } = await supabase.from('repairs')
      .update({ warranty_resolution: resolution })
      .eq('id', repairId).select().single();
    await broadcast('repairs');
    return toClient(data);
  },

  // ─── Ventas ──────────────────────────────────────────────────
  getSales: async (params?: { sessionId?: string; date?: string }) => {
    let query = supabase.from('sales').select('*').order('date', { ascending: false });
    if (params?.sessionId) query = query.eq('session_id', params.sessionId);
    if (params?.date) {
      const start = new Date(params.date);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      query = query.gte('date', start.toISOString()).lt('date', end.toISOString());
    }
    const { data } = await query;
    return toClient((data ?? []).map((s: any) => ({ ...s, warranty_adjustments: s.warranty_adjustments ?? [] })));
  },

  createSale: async (body: any) => {
    const { data: sale, error } = await supabase.from('sales').insert(toDB(body)).select().single();
    if (error) throw new Error(error.message);

    // Procesar cada ítem de la venta
    for (const item of body.items ?? []) {
      if (item.type === 'product' && item.id) {
        const { data: prod } = await supabase.from('products').select('quantity').eq('id', item.id).single();
        if (prod) await supabase.from('products').update({ quantity: (prod.quantity ?? 0) - (item.quantity ?? 1) }).eq('id', item.id);
      }

      if (item.type === 'reventa') {
        if (item.id) {
          const { data: ritem } = await supabase.from('reventa_items').select('quantity').eq('id', item.id).single();
          if (ritem) {
            await supabase.from('reventa_items').update({
              quantity: Math.max(0, (ritem.quantity ?? 0) - (item.quantity ?? 1)),
            }).eq('id', item.id);
          }
        } else {
          await supabase.from('reventa_items').insert({
            name: item.name,
            sale_price: item.price,
            cost_price: item.cost || null,
            quantity: 0,
            initial_quantity: item.quantity ?? 1,
            supplier_id: item.supplierId || null,
          });
        }
      }

      if (item.type === 'repair' && item.id) {
        const { data: repair } = await supabase.from('repairs').select('*').eq('id', item.id).single();
        if (repair) {
          // Marcar como entregado al cobrar
          await supabase.from('repairs').update({ status: 'delivered' }).eq('id', item.id);
          try { await supabase.from('repairs').update({ end_time: new Date().toISOString() }).eq('id', item.id); } catch { /* columna opcional */ }

          let repairCost = 0;
          for (const part of (repair.parts_used ?? []) as any[]) {
            if (part.id) {
              const { data: partProd } = await supabase.from('products').select('quantity, cost_price').eq('id', part.id).single();
              if (partProd) {
                await supabase.from('products').update({ quantity: (partProd.quantity ?? 0) - (part.quantity ?? 1) }).eq('id', part.id);
                repairCost += (partProd.cost_price ?? part.cost ?? 0) * (part.quantity ?? 1);
              }
            }
          }

          if (repairCost > 0) {
            const { data: saleNow } = await supabase.from('sales').select('cost_total').eq('id', sale.id).single();
            await supabase.from('sales').update({ cost_total: (saleNow?.cost_total ?? 0) + repairCost }).eq('id', sale.id);
          }

          // Garantía de reparación
          try {
            const warrantyDays = item.warrantyDays ?? 2;
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + warrantyDays);
            await supabase.from('warranties').insert({
              sale_id: sale.id,
              product_name: `Reparación: ${repair.device_model}`,
              customer_name: repair.customer_name,
              date: new Date().toISOString(),
              expires_at: expiresAt.toISOString(),
              warranty_days: warrantyDays,
              status: 'active',
              amount: item.price,
            });
          } catch { /* no interrumpir la venta */ }
        }
      }
    }

    // Actualizar sesión activa
    const { data: session } = await supabase.from('cash_sessions').select('*').eq('status', 'open').maybeSingle();
    if (session) {
      const totals = { ...(session.totals ?? {}) };
      for (const payment of body.payments ?? []) {
        totals[payment.method] = (totals[payment.method] ?? 0) + payment.amount;
      }
      await supabase.from('cash_sessions').update({
        sales_count: (session.sales_count ?? 0) + 1,
        totals,
      }).eq('id', session.id);
    }

    // Garantías automáticas por categoría / tipo
    for (const item of body.items ?? []) {
      if (item.type === 'product' && item.id) {
        try {
          const { data: product } = await supabase.from('products').select('*, categories(warranty_days)').eq('id', item.id).single();
          if (product) {
            const warrantyDays = (product as any).categories?.warranty_days ?? 2;
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + warrantyDays);
            await supabase.from('warranties').insert({
              sale_id: sale.id,
              product_id: product.id,
              product_name: product.model ?? product.name,
              customer_name: body.customerName ?? 'Consumidor Final',
              date: new Date().toISOString(),
              expires_at: expiresAt.toISOString(),
              warranty_days: warrantyDays,
              status: 'active',
              amount: item.price * (item.quantity ?? 1),
            });
          }
        } catch { /* no interrumpir la venta */ }
      }

      if (item.type === 'reventa') {
        try {
          const warrantyDays = 2;
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + warrantyDays);
          await supabase.from('warranties').insert({
            sale_id: sale.id,
            product_name: item.name,
            customer_name: body.customerName ?? 'Consumidor Final',
            date: new Date().toISOString(),
            expires_at: expiresAt.toISOString(),
            warranty_days: warrantyDays,
            status: 'active',
            amount: item.price * (item.quantity ?? 1),
          });
        } catch { /* no interrumpir la venta */ }
      }
    }

    await broadcast('sales');
    await broadcast('products');
    await broadcast('warranties');
    await broadcast('reventa-items');
    return toClient(sale);
  },

  // ─── Sesiones de caja ────────────────────────────────────────
  getCurrentSession: async () => {
    const { data } = await supabase.from('cash_sessions').select('*, users(name, role)').eq('status', 'open').maybeSingle();
    return data ? toClient(data) : null;
  },
  openSession: async (body: { openedBy: string; initialCash: number }) => {
    const { data: existing } = await supabase.from('cash_sessions').select('id').eq('status', 'open').maybeSingle();
    if (existing) throw new Error('Ya hay una sesión abierta');

    let userId = body.openedBy;
    if (userId && !/^[0-9a-f]{8}-/.test(userId)) {
      const { data: user } = await supabase.from('users').select('id').eq('name', userId).single();
      if (!user) throw new Error('Usuario no encontrado');
      userId = user.id;
    }

    const { data } = await supabase.from('cash_sessions').insert({
      opened_by: userId,
      initial_cash: body.initialCash,
      status: 'open',
      totals: { cash: 0, transfer: 0, card: 0, qr: 0, credit_card: 0, debit_card: 0 },
    }).select('*, users(name, role)').single();
    await broadcast('sessions');
    return toClient(data);
  },
  closeSession: async () => {
    const { data: session } = await supabase.from('cash_sessions').select('id').eq('status', 'open').maybeSingle();
    if (!session) throw new Error('No hay sesión abierta');
    const { data } = await supabase.from('cash_sessions').update({
      status: 'closed', closed_at: new Date().toISOString(),
    }).eq('id', session.id).select().single();
    await broadcast('sessions');
    return toClient(data);
  },
  getSessions: async () => {
    const { data } = await supabase.from('cash_sessions').select('*, users(name, role)').order('opened_at', { ascending: false });
    return toClient(data ?? []);
  },

  // ─── Garantías ───────────────────────────────────────────────
  getWarranties: async () => {
    const { data } = await supabase.from('warranties').select('*').order('created_at', { ascending: false });
    return toClient(data ?? []);
  },
  createWarranty: async (body: any) => {
    const { data } = await supabase.from('warranties').insert(toDB(body)).select().single();
    await broadcast('warranties');
    return toClient(data);
  },
  updateWarranty: async (id: string, body: any) => {
    const { data } = await supabase.from('warranties').update(toDB(body)).eq('id', id).select().single();
    await broadcast('warranties');
    return toClient(data);
  },
  deleteWarranty: async (id: string) => {
    await supabase.from('warranties').delete().eq('id', id);
    await broadcast('warranties');
    return { ok: true };
  },
  applyWarranty: async (id: string, status: string) => {
    const { data: warranty } = await supabase.from('warranties').select('*').eq('id', id).single();
    if (!warranty) throw new Error('Garantía no encontrada');

    if (status === 'defective') {
      await supabase.from('warranties').update({ status: 'defective' }).eq('id', id);
      await broadcast('warranties');
      return { ok: true };
    }

    if (status === 'resolved_by_provider') {
      if (warranty.product_id) {
        const { data: prod } = await supabase.from('products').select('quantity').eq('id', warranty.product_id).single();
        if (prod) await supabase.from('products').update({ quantity: (prod.quantity ?? 0) + 1 }).eq('id', warranty.product_id);
        await broadcast('products');
      }
      if (warranty.sale_id) {
        const { data: sale } = await supabase.from('sales').select('warranty_adjustments').eq('id', warranty.sale_id).single();
        if (sale) {
          const adj = [...(sale.warranty_adjustments ?? []), {
            warrantyId: id, productName: warranty.product_name,
            amount: 0, type: 'provider_replenishment', date: new Date().toISOString(),
          }];
          await supabase.from('sales').update({ warranty_adjustments: adj }).eq('id', warranty.sale_id);
          await broadcast('sales');
        }
      }
      await supabase.from('warranties').update({ status: 'resolved_by_provider' }).eq('id', id);
      await broadcast('warranties');
      return { ok: true };
    }

    if (status === 'loss') {
      if (warranty.sale_id) {
        const { data: sale } = await supabase.from('sales').select('warranty_adjustments, session_id').eq('id', warranty.sale_id).single();
        if (sale) {
          const adj = [...(sale.warranty_adjustments ?? []), {
            warrantyId: id, productName: warranty.product_name,
            amount: -(warranty.amount ?? 0), type: 'loss', date: new Date().toISOString(),
          }];
          await supabase.from('sales').update({ warranty_adjustments: adj }).eq('id', warranty.sale_id);

          if (sale.session_id) {
            const { data: sess } = await supabase.from('cash_sessions').select('warranty_adjustments').eq('id', sale.session_id).single();
            if (sess) {
              const sessAdj = [...(sess.warranty_adjustments ?? []), {
                warrantyId: id, productName: warranty.product_name,
                amount: -(warranty.amount ?? 0), saleId: warranty.sale_id,
                type: 'loss', date: new Date().toISOString(),
              }];
              await supabase.from('cash_sessions').update({ warranty_adjustments: sessAdj }).eq('id', sale.session_id);
              await broadcast('sessions');
            }
          }
          await broadcast('sales');
        }
      }
      await supabase.from('warranties').update({ status: 'loss' }).eq('id', id);
      await broadcast('warranties');
      return { ok: true };
    }

    throw new Error('Estado no válido');
  },

  // ─── Verificación de garantía por código de venta ────────────
  checkWarranty: async (shortId: string) => {
    let sale = null;
    if (/^[0-9a-f-]{36}$/i.test(shortId)) {
      const { data } = await supabase.from('sales').select('*').eq('id', shortId).single();
      sale = data;
    } else {
      const { data: allSales } = await supabase.from('sales').select('id, date').order('date', { ascending: false }).limit(500);
      const found = (allSales ?? []).find((s: any) => s.id.slice(-8).toUpperCase() === shortId.toUpperCase());
      if (found) {
        const { data } = await supabase.from('sales').select('*').eq('id', found.id).single();
        sale = data;
      }
    }
    if (!sale) return { sale: null };

    const { data: warranties } = await supabase.from('warranties').select('*').eq('sale_id', sale.id);
    const now = new Date();
    const warrantyInfo = (warranties ?? []).map((w: any) => ({
      productName: w.product_name,
      expiresAt: w.expires_at,
      status: w.status,
      daysLeft: Math.ceil((new Date(w.expires_at).getTime() - now.getTime()) / 86400000),
      isValid: new Date(w.expires_at) > now && w.status === 'active',
    }));
    return { sale: toClient(sale), warrantyInfo };
  },

  // ─── Retiros de Caja ─────────────────────────────────────────
  getCashWithdrawals: async (sessionId?: string) => {
    let query = supabase.from('cash_withdrawals').select('*').order('date', { ascending: false });
    if (sessionId) query = query.eq('session_id', sessionId);
    const { data } = await query;
    return toClient(data ?? []);
  },
  createCashWithdrawal: async (body: { amount: number; motive: string; note?: string; sessionId?: string }) => {
    const { data } = await supabase.from('cash_withdrawals').insert(toDB(body)).select().single();
    await broadcast('cash-withdrawals');
    return toClient(data);
  },
  deleteCashWithdrawal: async (id: string) => {
    await supabase.from('cash_withdrawals').delete().eq('id', id);
    await broadcast('cash-withdrawals');
    return { ok: true };
  },

  // ─── Motivos de Retiro ───────────────────────────────────────
  getWithdrawalMotives: async () => {
    const { data } = await supabase.from('withdrawal_motives').select('*').order('name');
    return toClient(data ?? []);
  },
  createWithdrawalMotive: async (name: string) => {
    const { data } = await supabase.from('withdrawal_motives').insert({ name }).select().single();
    await broadcast('withdrawal-motives');
    return toClient(data);
  },
  deleteWithdrawalMotive: async (id: string) => {
    await supabase.from('withdrawal_motives').delete().eq('id', id);
    await broadcast('withdrawal-motives');
    return { ok: true };
  },

  // ─── Reventa Suppliers ───────────────────────────────────────
  getReventaSuppliers: async () => {
    const { data } = await supabase.from('reventa_suppliers').select('*').order('name');
    return toClient(data ?? []);
  },
  createReventaSupplier: async (body: { name: string; contact?: string }) => {
    const { data, error } = await supabase.from('reventa_suppliers').insert(toDB(body)).select().single();
    if (error) throw new Error(error.message);
    await broadcast('reventa-suppliers');
    return toClient(data);
  },
  deleteReventaSupplier: async (id: string) => {
    await supabase.from('reventa_suppliers').delete().eq('id', id);
    await broadcast('reventa-suppliers');
    return { ok: true };
  },

  // ─── Reventa Items ────────────────────────────────────────────
  getReventaItems: async () => {
    const { data } = await supabase.from('reventa_items').select('*').order('created_at', { ascending: false });
    return toClient(data ?? []);
  },
  createReventaItem: async (body: { name: string; salePrice: number; costPrice?: number | null; quantity: number; supplierId?: string }) => {
    const { data, error } = await supabase.from('reventa_items').insert({
      name: body.name,
      sale_price: body.salePrice,
      cost_price: body.costPrice ?? null,
      quantity: body.quantity,
      initial_quantity: body.quantity,
      supplier_id: body.supplierId || null,
    }).select().single();
    if (error) throw new Error(error.message);
    await broadcast('reventa-items');
    return toClient(data);
  },
  updateReventaItem: async (id: string, body: any) => {
    const { data } = await supabase.from('reventa_items').update(toDB(body)).eq('id', id).select().single();
    await broadcast('reventa-items');
    return toClient(data);
  },
  deleteReventaItem: async (id: string) => {
    await supabase.from('reventa_items').delete().eq('id', id);
    await broadcast('reventa-items');
    return { ok: true };
  },

  // ─── Estadísticas ────────────────────────────────────────────
  getStats: async () => {
    const [
      { data: sales },
      { data: repairs },
      { data: products },
      { data: warranties },
      { data: fixedCosts },
    ] = await Promise.all([
      supabase.from('sales').select('*').order('date'),
      supabase.from('repairs').select('*, users(name)'),
      supabase.from('products').select('*, categories(name, warranty_days)'),
      supabase.from('warranties').select('*'),
      supabase.from('fixed_costs').select('*'),
    ]);

    const salesList = sales ?? [];
    const repairsList = repairs ?? [];
    const productsList = products ?? [];
    const warrantiesList = warranties ?? [];
    const fixedCostsList = fixedCosts ?? [];

    const totalStockValue = productsList.reduce((s: number, p: any) => s + (p.cost_price ?? 0) * (p.quantity ?? 0), 0);

    const delivered = repairsList.filter((r: any) => r.end_time && r.created_at);
    const averageRepairTime = delivered.length > 0
      ? delivered.reduce((s: number, r: any) => s + (new Date(r.end_time).getTime() - new Date(r.created_at).getTime()) / 3600000, 0) / delivered.length
      : 0;

    const productCount: Record<string, { name: string; count: number; profit: number }> = {};
    for (const sale of salesList as any[]) {
      for (const item of (sale.items ?? [])) {
        if (item.type === 'product' && item.id) {
          if (!productCount[item.id]) productCount[item.id] = { name: item.name ?? '', count: 0, profit: 0 };
          productCount[item.id].count += item.quantity ?? 1;
          productCount[item.id].profit += ((item.price ?? 0) - (item.cost ?? 0)) * (item.quantity ?? 1);
        }
      }
    }
    const productList = Object.values(productCount);
    const mostSoldProducts = [...productList].sort((a, b) => b.count - a.count).slice(0, 10);
    const leastSoldProducts = [...productList].sort((a, b) => a.count - b.count).slice(0, 10);
    const profitByProduct = [...productList].sort((a, b) => b.profit - a.profit).slice(0, 10);

    const categoryCount: Record<string, { name: string; count: number }> = {};
    for (const sale of salesList as any[]) {
      for (const item of (sale.items ?? [])) {
        if (item.type === 'product' && item.id) {
          const product = productsList.find((p: any) => p.id === item.id);
          const catName = (product as any)?.categories?.name ?? 'Sin categoría';
          if (!categoryCount[catName]) categoryCount[catName] = { name: catName, count: 0 };
          categoryCount[catName].count += item.quantity ?? 1;
        }
      }
    }
    const mostSoldCategories = Object.values(categoryCount).sort((a, b) => b.count - a.count);

    const totalRevenue = salesList.reduce((s: number, sale: any) => s + (sale.total ?? 0), 0);
    const ticketPromedio = salesList.length > 0 ? Math.round(totalRevenue / salesList.length) : 0;
    const warrantyReturns = warrantiesList.filter((w: any) => w.status === 'defective' || w.status === 'loss').length;
    const warrantyReturnRate = salesList.length > 0 ? ((warrantyReturns / salesList.length) * 100).toFixed(1) : '0';

    const monthlyCashflow = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i);
      const year = d.getFullYear(); const month = d.getMonth();
      const label = d.toLocaleDateString('es-PY', { month: 'short', year: '2-digit' });
      const monthSales = salesList.filter((s: any) => { const sd = new Date(s.date); return sd.getFullYear() === year && sd.getMonth() === month; });
      const monthCosts = fixedCostsList.filter((c: any) => { const cd = new Date(c.date); return cd.getFullYear() === year && cd.getMonth() === month; });
      const revenue = monthSales.reduce((s: number, sale: any) => s + (sale.total ?? 0), 0);
      const stockCosts = monthSales.reduce((s: number, sale: any) => s + (sale.cost_total ?? 0), 0);
      const costs = monthCosts.reduce((s: number, c: any) => s + (c.amount ?? 0), 0);
      monthlyCashflow.push({ month: label, revenue, stockCosts, costs, profit: revenue - stockCosts - costs });
    }

    const hourlyMap = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0, revenue: 0 }));
    for (const sale of salesList as any[]) {
      const hour = new Date(sale.date).getHours();
      hourlyMap[hour].count++;
      hourlyMap[hour].revenue += sale.total ?? 0;
    }

    const last3 = monthlyCashflow.slice(-3);
    const salesProjection = last3.length > 0 ? Math.round(last3.reduce((s, m) => s + m.revenue, 0) / last3.length) : 0;

    const techMap: Record<string, any> = {};
    for (const repair of repairsList as any[]) {
      const tech = repair.users;
      if (!tech || !repair.technician_id) continue;
      const id = repair.technician_id;
      if (!techMap[id]) techMap[id] = { name: tech.name ?? 'Sin nombre', count: 0, avgTime: 0, totalTime: 0 };
      techMap[id].count++;
      if (repair.end_time) {
        techMap[id].totalTime += (new Date(repair.end_time).getTime() - new Date(repair.created_at).getTime()) / 3600000;
      }
    }
    const technicianPerformance = Object.values(techMap).map((t: any) => ({
      ...t, avgTime: t.count > 0 ? +(t.totalTime / t.count).toFixed(1) : 0,
    })).sort((a: any, b: any) => b.count - a.count);

    return {
      totalStockValue, averageRepairTime, mostSoldProducts, leastSoldProducts,
      profitByProduct, mostSoldCategories, ticketPromedio, warrantyReturnRate,
      monthlyCashflow, hourlyMap, salesProjection, technicianPerformance,
      totalSalesCount: salesList.length,
    };
  },

  // ─── Exportar datos ──────────────────────────────────────────
  getExportData: async (from?: string, to?: string) => {
    const start = from ? new Date(from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = to ? new Date(to) : new Date();
    end.setHours(23, 59, 59, 999);

    const [{ data: sales }, { data: fixedCosts }, { data: withdrawals }, { data: warranties }] = await Promise.all([
      supabase.from('sales').select('*').gte('date', start.toISOString()).lte('date', end.toISOString()).order('date'),
      supabase.from('fixed_costs').select('*').gte('date', start.toISOString()).lte('date', end.toISOString()).order('date'),
      supabase.from('cash_withdrawals').select('*').gte('date', start.toISOString()).lte('date', end.toISOString()).order('date'),
      supabase.from('warranties').select('*').gte('date', start.toISOString()).lte('date', end.toISOString()),
    ]);

    const warrantySaleIds = new Set((warranties ?? []).map((w: any) => String(w.sale_id)));
    const saleItems: any[] = [];
    for (const sale of (sales ?? []) as any[]) {
      const hasWarrantyClaim = warrantySaleIds.has(String(sale.id));
      const mainMethod = sale.payments?.length > 0
        ? sale.payments.map((p: any) => `${p.method}(${p.amount})`).join(' + ')
        : (sale.payment_method ?? 'cash');
      for (const item of (sale.items ?? [])) {
        const qty = item.quantity ?? 1;
        const sub = (item.price ?? 0) * qty;
        const cost = (item.cost ?? 0) * qty;
        saleItems.push({
          fecha: new Date(sale.date).toLocaleDateString('es-PY'),
          hora: new Date(sale.date).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' }),
          producto: item.name ?? '', tipo: item.type === 'repair' ? 'Reparación' : 'Producto',
          cantidad: qty, precioUnitario: item.price ?? 0, subtotal: sub,
          costoUnitario: item.cost ?? 0, ganancia: sub - cost,
          descuento: sale.discount ?? 0, metodoPago: mainMethod,
          cliente: sale.customer_name ?? 'Consumidor Final',
          reclamoGarantia: hasWarrantyClaim ? 'Sí' : 'No', nota: sale.note ?? '',
        });
      }
    }

    const revenue = (sales ?? []).reduce((s: number, sale: any) => s + (sale.total ?? 0), 0);
    const costTotal = (sales ?? []).reduce((s: number, sale: any) => s + (sale.cost_total ?? 0), 0);
    const fixedTotal = (fixedCosts ?? []).reduce((s: number, c: any) => s + (c.amount ?? 0), 0);
    const retirTotal = (withdrawals ?? []).reduce((s: number, w: any) => s + (w.amount ?? 0), 0);

    return {
      period: { from: start, to: end },
      sales: saleItems,
      gastos: (fixedCosts ?? []).map((c: any) => ({
        fecha: new Date(c.date).toLocaleDateString('es-PY'), descripcion: c.description, monto: c.amount,
      })),
      retiros: (withdrawals ?? []).map((w: any) => ({
        fecha: new Date(w.date).toLocaleDateString('es-PY'),
        hora: new Date(w.date).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' }),
        monto: w.amount, destino: w.motive ?? '', nota: w.note ?? '',
      })),
      resumen: {
        totalVentas: (sales ?? []).length, ingresos: revenue, costoMercancia: costTotal,
        gananciaBruta: revenue - costTotal, gastosFijos: fixedTotal,
        totalRetiros: retirTotal, utilidadNeta: revenue - costTotal - fixedTotal,
      },
    };
  },

  getProductStats: async () => {
    const { data: sales } = await supabase.from('sales').select('*').order('date', { ascending: false });
    const map: Record<string, any> = {};
    for (const sale of (sales ?? []) as any[]) {
      for (const item of (sale.items ?? [])) {
        if (item.type === 'repair') continue;
        const key = item.id ?? item.name;
        if (!map[key]) map[key] = { productId: item.id ?? '', name: item.name ?? '', totalUnits: 0, totalRevenue: 0, totalCost: 0, prices: new Set<number>(), lastSaleDate: new Date(sale.date), firstSaleDate: new Date(sale.date) };
        const qty = item.quantity ?? 1;
        map[key].totalUnits += qty;
        map[key].totalRevenue += (item.price ?? 0) * qty;
        map[key].totalCost += (item.cost ?? 0) * qty;
        map[key].prices.add(item.price ?? 0);
        const d = new Date(sale.date);
        if (d > map[key].lastSaleDate) map[key].lastSaleDate = d;
        if (d < map[key].firstSaleDate) map[key].firstSaleDate = d;
      }
    }
    const now = Date.now();
    return Object.values(map).map((p: any) => ({
      productId: p.productId, name: p.name, totalUnits: p.totalUnits,
      totalRevenue: Math.round(p.totalRevenue), totalCost: Math.round(p.totalCost),
      profit: Math.round(p.totalRevenue - p.totalCost),
      margin: p.totalRevenue > 0 ? +((p.totalRevenue - p.totalCost) / p.totalRevenue * 100).toFixed(1) : 0,
      prices: Array.from(p.prices as Set<number>).sort((a: number, b: number) => a - b),
      lastSaleDate: p.lastSaleDate.toISOString(),
      daysSinceLastSale: Math.floor((now - p.lastSaleDate.getTime()) / 86400000),
      isRentable: (p.totalRevenue - p.totalCost) > 0,
    })).sort((a: any, b: any) => b.totalUnits - a.totalUnits);
  },
};
