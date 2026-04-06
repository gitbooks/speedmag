export type TransactionType = 'deposit' | 'withdrawal';

export type TransactionCategory = 'Business' | 'Personal' | 'Transfer' | 'Uncategorized';

export type BusinessCategory = string;

export const BUSINESS_CATEGORIES: BusinessCategory[] = [
  'Business Income',
  'Advertising & Marketing',
  'Equipment',
  'Inventory Purchase',   // asset purchase — excluded from P&L expenses
  'Inventory / COGS',     // direct cost-of-goods-sold expense
  'Payment Processing',
  'Software & Subscriptions',
  'Banking & Fees',
  'Bank Dividend',
  'Professional Services',
  'Utilities',
  'Office & Supplies',
  'Travel & Transportation',
  'Meals & Entertainment',
  'Payroll & Contractors',
  'Other Business',
];

export interface Transaction {
  id: string;
  statementId: string;
  date: string; // ISO: YYYY-MM-DD
  rawDate: string; // MM-DD from statement
  description: string;
  amount: number;
  balance: number;
  type: TransactionType;
  category: TransactionCategory;
  businessCategory: BusinessCategory | null;
  accountNumber: string;
}

export interface Statement {
  id: string;
  filename: string;
  filePath: string;
  uploadedAt: string;
  transactionCount: number;
}

export interface BalanceSheetEntry {
  id: string;
  name: string;
  amount: number;
  type: 'asset' | 'liability';
  subtype: 'current_asset' | 'fixed_asset' | 'current_liability' | 'long_term_liability';
  updatedAt: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  sku?: string;
  description?: string;
  salePrice: number;
  reorderPoint: number;
  createdAt: string;
}

export interface InventoryTransaction {
  id: string;
  itemId: string;
  type: 'purchase' | 'sale' | 'adjustment';
  /** purchase/sale = units moved; adjustment = new absolute count */
  quantity: number;
  unitCost: number;
  date: string; // YYYY-MM-DD
  note?: string;
  createdAt: string;
}

export interface AppData {
  statements: Statement[];
  transactions: Transaction[];
  customBusinessCategories?: string[];
  balanceSheetEntries?: BalanceSheetEntry[];
  retainedEarnings?: number;
  inventoryItems?: InventoryItem[];
  inventoryTransactions?: InventoryTransaction[];
}

export type ActiveView = 'dashboard' | 'transactions' | 'reports' | 'upload' | 'settings' | 'profiles' | 'inventory';

export interface Profile {
  id: string;
  name: string;
  color: string;
  createdAt: string;
}

export const PROFILE_COLORS = [
  '#007AFF', '#34C759', '#FF9500', '#FF3B30',
  '#AF52DE', '#FF2D55', '#5AC8FA', '#FFCC00',
];

export interface MonthlyTotal {
  month: string; // "YYYY-MM"
  label: string; // "Jan 2025"
  income: number;
  expenses: number;
  net: number;
}
