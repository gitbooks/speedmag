import type { InventoryItem, InventoryTransaction } from '../types';

export interface ItemStats {
  qty: number;
  totalValue: number;
  avgCost: number;
  totalCOGS: number; // lifetime COGS for this item
}

/**
 * Compute running stats for one inventory item using average-cost method.
 * Processes ALL transactions chronologically to maintain correct avg cost,
 * but only accumulates cogsInPeriod for transactions matching the year filter.
 */
export function computeItemStats(
  itemId: string,
  transactions: InventoryTransaction[],
): ItemStats {
  const txns = transactions
    .filter((t) => t.itemId === itemId)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));

  let qty = 0;
  let totalValue = 0;
  let totalCOGS = 0;

  for (const tx of txns) {
    if (tx.type === 'purchase') {
      qty += tx.quantity;
      totalValue += tx.quantity * tx.unitCost;
    } else if (tx.type === 'sale') {
      const avgCost = qty > 0 ? totalValue / qty : 0;
      const cogs = Math.min(tx.quantity, qty) * avgCost;
      totalCOGS += cogs;
      qty = Math.max(0, qty - tx.quantity);
      totalValue = Math.max(0, totalValue - cogs);
    } else if (tx.type === 'adjustment') {
      // quantity = new absolute count
      const avgCost = qty > 0 ? totalValue / qty : tx.unitCost;
      const delta = tx.quantity - qty;
      totalValue = Math.max(0, totalValue + delta * avgCost);
      qty = tx.quantity;
    }
  }

  return {
    qty,
    totalValue,
    avgCost: qty > 0 ? totalValue / qty : 0,
    totalCOGS,
  };
}

/**
 * Compute COGS for a given period (year or 'all') across all items.
 * Must process ALL historical transactions to maintain correct avg cost,
 * but only sums COGS for sales that fall within the target period.
 */
export function computePeriodCOGS(
  items: InventoryItem[],
  transactions: InventoryTransaction[],
  year: string, // 'all' or '2024', '2025', etc.
): number {
  let total = 0;

  for (const item of items) {
    const txns = transactions
      .filter((t) => t.itemId === item.id)
      .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));

    let qty = 0;
    let totalValue = 0;

    for (const tx of txns) {
      if (tx.type === 'purchase') {
        qty += tx.quantity;
        totalValue += tx.quantity * tx.unitCost;
      } else if (tx.type === 'sale') {
        const avgCost = qty > 0 ? totalValue / qty : 0;
        const cogs = Math.min(tx.quantity, qty) * avgCost;
        if (year === 'all' || tx.date.startsWith(year)) {
          total += cogs;
        }
        qty = Math.max(0, qty - tx.quantity);
        totalValue = Math.max(0, totalValue - cogs);
      } else if (tx.type === 'adjustment') {
        const avgCost = qty > 0 ? totalValue / qty : tx.unitCost;
        const delta = tx.quantity - qty;
        totalValue = Math.max(0, totalValue + delta * avgCost);
        qty = tx.quantity;
      }
    }
  }

  return total;
}

/**
 * Compute current on-hand value of all inventory (for Balance Sheet).
 */
export function computeInventoryAssetValue(
  items: InventoryItem[],
  transactions: InventoryTransaction[],
): number {
  return items.reduce(
    (sum, item) => sum + computeItemStats(item.id, transactions).totalValue,
    0,
  );
}
