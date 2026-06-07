export interface UserProfile {
  _id: string;
  name: string;
  role: 'admin' | 'cashier' | 'technician';
  password?: string;
  weeklyWage?: number;
}

export interface CashWithdrawal {
  _id: string;
  amount: number;
  motive: string;
  note?: string;
  sessionId?: string;
  date: string;
}

export interface WithdrawalMotive {
  _id: string;
  name: string;
}

export interface ExpenseConfig {
  _id?: string;
  operativePercent: number;
  fixedPercent: number;
}

export interface Category {
  _id: string;
  name: string;
}

export interface Wholesaler {
  _id: string;
  code?: string;
  name: string;
  businessName?: string;
  contact?: string;
  debt: number;
}

export interface FixedCost {
  _id: string;
  description: string;
  amount: number;
  date: string;
}

export interface Product {
  _id: string;
  model: string;
  categoryId?: string;
  quantity: number;
  purchasedQuantity: number;
  costPrice: number;
  salePrice: number;        // Precio cliente normal
  priceWholesale?: number;  // Precio mayorista
  priceCheap?: number;      // Precio tacaño
  location?: string;
  isWholesale?: boolean;
  barcode?: string;
  batches?: { quantity: number; costPrice: number; date: string; }[];
}

export interface RepairType {
  _id: string;
  name: string;
  description: string;
  fixedCost: number;
}

export interface RepairShelf {
  _id: string;
  name: string;
}

export interface RepairWorkbench {
  _id: string;
  name: string;
}

export interface RepairNote {
  _id?: string;
  text: string;
  createdAt: string;
}

export interface TechnicianHistoryEntry {
  technicianId?: string;
  technicianName?: string;
  assignedAt: string;
  removedAt?: string;
}

export interface Repair {
  _id: string;
  customerName: string;
  customerPhone: string;
  deviceModel: string;
  problemDescription: string;
  repairType: string;
  status: 'pending' | 'in_progress' | 'ready' | 'no_solution' | 'delivered';
  totalCost: number;
  partsUsed: { id: string; name: string; price: number; cost?: number; quantity: number; }[];
  technicianId?: string;
  shelfId?: string;
  workbenchId?: string;
  technicianHistory?: TechnicianHistoryEntry[];
  notes?: RepairNote[];
  wholesalerId?: string;
  createdAt: string;
  endTime?: string;
  // Garantía
  isWarranty?: boolean;
  originalRepairId?: string;
  warrantyDays?: number;
  warrantyDefectivePart?: string;
  warrantyResolution?: 'loss' | 'provider_replenishment' | null;
}

export interface Sale {
  _id: string;
  items: {
    id: string;
    type: 'product' | 'repair';
    name: string;
    price: number;
    cost: number;
    quantity: number;
  }[];
  total: number;
  costTotal: number;
  discount: number;
  paymentMethod: string;
  payments?: { method: string; amount: number; }[];
  wholesalerId?: string;
  sessionId?: string;
  customerName?: string;
  date: string;
  note?: string;
}

export interface Warranty {
  _id: string;
  saleId: string;
  productId: string;
  productName: string;
  customerName: string;
  date: string;
  expiresAt: string;
  warrantyDays: number;
  reason: string;
  status: 'active' | 'expired' | 'defective' | 'resolved_by_provider' | 'loss';
  amount: number;
}

export interface WarrantyConfig {
  _id: string;
  defaultDays: number;
  productOverrides: { productId: string; days: number; }[];
}

export interface CashSession {
  _id: string;
  openedBy: UserProfile;
  openedAt: string;
  closedAt?: string;
  initialCash: number;
  finalCash: number;
  status: 'open' | 'closed';
  totals: {
    cash: number;
    credit_card: number;
    debit_card: number;
    transfer: number;
    qr: number;
  };
  salesCount: number;
  repairsCount: number;
}

export interface Stats {
  mostSoldProducts: { name: string; count: number }[];
  leastSoldProducts: { name: string; count: number }[];
  mostSoldCategories: { name: string; count: number }[];
  averageRepairTime: number;
  totalStockValue: number;
  profitByProduct: { name: string; profit: number }[];
}
