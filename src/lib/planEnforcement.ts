import {
  UPGRADE_GROWTH_TOOLS_COPY,
  monthlyOrderCapForPlan,
  platformFeeBpsForPlan,
  platformFeeForTotal,
  productCapForPlan,
  sellerNetForTotal,
  type Plan,
} from './plans';
import type { CollectionMode } from './checkout-orders';

export type PlanGateFailure = {
  status: 'error';
  message: string;
  field?: string;
};

export type OrderFeeSnapshot = {
  planSnapshot: Plan;
  platformFeeBps: number;
  platformFeeQar: number;
  sellerNetQar: number;
  collectionMode: CollectionMode;
  platformProvider: string | null;
};

export type CheckoutOrderFeeSnapshot = OrderFeeSnapshot & {
  buyerTotalQar: number;
  feeBaseQar: number;
};

export function productCapFailure(
  plan: Plan,
  existingCount: number,
  incomingCount: number,
): PlanGateFailure | null {
  const cap = productCapForPlan(plan);
  if (!Number.isFinite(cap)) return null;
  if (existingCount + incomingCount <= cap) return null;
  return {
    status: 'error',
    message: `Free allows ${cap} products. ${UPGRADE_GROWTH_TOOLS_COPY}.`,
    field: 'title',
  };
}

export function monthlyOrderCapFailure(
  plan: Plan,
  currentMonthOrders: number,
): PlanGateFailure | null {
  const cap = monthlyOrderCapForPlan(plan);
  if (!Number.isFinite(cap)) return null;
  if (currentMonthOrders < cap) return null;
  return {
    status: 'error',
    message: `Free allows ${cap} checkout orders per month. ${UPGRADE_GROWTH_TOOLS_COPY}.`,
    field: 'items',
  };
}

export function checkoutCollectionSnapshot(
  paymentMethod: string,
  options: { platformSkipCash?: boolean } = {},
): Pick<OrderFeeSnapshot, 'collectionMode' | 'platformProvider'> {
  if (paymentMethod === 'skipcash') {
    return {
      collectionMode: options.platformSkipCash === false ? 'seller_direct' : 'platform_skipcash',
      platformProvider: 'skipcash',
    };
  }
  if (paymentMethod === 'sadad') {
    return { collectionMode: 'seller_direct', platformProvider: 'sadad' };
  }
  if (paymentMethod === 'pay_link') {
    return { collectionMode: 'offline', platformProvider: 'seller_pay_link' };
  }
  return { collectionMode: 'offline', platformProvider: null };
}

export function orderFeeSnapshot(
  plan: Plan,
  totalQar: number,
  paymentMethod: string,
  options: { platformSkipCash?: boolean } = {},
): OrderFeeSnapshot {
  const collection = checkoutCollectionSnapshot(paymentMethod, options);
  const codFeeWaived = paymentMethod === 'cod';
  const safeTotal = Math.max(0, Math.round(totalQar));
  const platformFeeBps = codFeeWaived ? 0 : platformFeeBpsForPlan(plan);
  const platformFeeQar = codFeeWaived ? 0 : platformFeeForTotal(safeTotal, plan);
  return {
    planSnapshot: plan,
    platformFeeBps,
    platformFeeQar,
    sellerNetQar: codFeeWaived ? safeTotal : sellerNetForTotal(safeTotal, plan),
    ...collection,
  };
}

export function checkoutOrderFeeSnapshot(
  _plan: Plan,
  feeBaseQar: number,
  paymentMethod: string,
  options: { platformSkipCash?: boolean } = {},
): CheckoutOrderFeeSnapshot {
  const collection = checkoutCollectionSnapshot(paymentMethod, options);
  const safeBase = Math.max(0, Math.round(feeBaseQar));
  return {
    planSnapshot: _plan,
    platformFeeBps: 0,
    platformFeeQar: 0,
    sellerNetQar: safeBase,
    collectionMode: collection.collectionMode,
    platformProvider: collection.platformProvider,
    buyerTotalQar: safeBase,
    feeBaseQar: safeBase,
  };
}
