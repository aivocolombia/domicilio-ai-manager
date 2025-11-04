import { supabase } from '@/lib/supabase';
import { createLogger } from '@/utils/logger';

export type CRMOrderItemType = 'plato' | 'bebida' | 'topping';

export interface CRMOrderItemSummary {
  id: number;
  orden_item_id: number;
  name: string;
  type: CRMOrderItemType;
  quantity: number;
}

export interface CRMCustomerFavoriteProductSummary {
  id: number;
  name: string;
  type: CRMOrderItemType;
  count: number;
}

export interface CRMOrderItemsResult {
  itemsByOrder: Record<string, CRMOrderItemSummary[]>;
  countsByOrder: Record<string, { platos: number; bebidas: number }>;
  favoriteProduct?: CRMCustomerFavoriteProductSummary;
}

const log = createLogger('CRMOrderItems');

type RawItem = {
  orden_id: number;
  producto_id: number | null;
  orden_item_id: number;
  name: string;
  type: CRMOrderItemType;
};

export const getOrderItemsSummary = async (
  orderIds: Array<string | number>
): Promise<CRMOrderItemsResult> => {
  try {
    if (!orderIds || orderIds.length === 0) {
      return { itemsByOrder: {}, countsByOrder: {} };
    }

    const idPairs = orderIds
      .map((id) => {
        const numeric = typeof id === 'number' ? id : Number(id);
        return Number.isFinite(numeric) ? { key: String(id), numeric: Number(numeric) } : null;
      })
      .filter((value): value is { key: string; numeric: number } => value !== null);

    if (idPairs.length === 0) {
      return { itemsByOrder: {}, countsByOrder: {} };
    }

    const numericIds = [...new Set(idPairs.map((pair) => pair.numeric))];
    const numericToKey = new Map<number, string>();
    idPairs.forEach((pair) => {
      if (!numericToKey.has(pair.numeric)) {
        numericToKey.set(pair.numeric, pair.key);
      }
    });

    const rawItemsByOrder: Record<string, RawItem[]> = {};
    const registerRawItem = (ordenId: number, rawItem: RawItem) => {
      const key = numericToKey.get(ordenId);
      if (!key) {
        return;
      }
      if (!rawItemsByOrder[key]) {
        rawItemsByOrder[key] = [];
      }
      rawItemsByOrder[key].push(rawItem);
    };

    const { data: platosData, error: platosError } = await supabase
      .from('ordenes_platos')
      .select(`
        id,
        orden_id,
        plato_id,
        platos!plato_id(id, name)
      `)
      .in('orden_id', numericIds);

    if (platosError) {
      log.warn('[CRM] Error fetching order dishes:', platosError);
    } else {
      (platosData || []).forEach((item) => {
        const ordenId = Number(item.orden_id);
        if (!Number.isFinite(ordenId)) {
          return;
        }
        registerRawItem(ordenId, {
          orden_id: ordenId,
          producto_id: item.plato_id ?? item.platos?.id ?? null,
          orden_item_id: item.id,
          name: item.platos?.name || 'Plato',
          type: 'plato'
        });
      });
    }

    const { data: bebidasData, error: bebidasError } = await supabase
      .from('ordenes_bebidas')
      .select(`
        id,
        orden_id,
        bebidas_id,
        bebidas!bebidas_id(id, name)
      `)
      .in('orden_id', numericIds);

    if (bebidasError) {
      log.warn('[CRM] Error fetching order drinks:', bebidasError);
    } else {
      (bebidasData || []).forEach((item) => {
        const ordenId = Number(item.orden_id);
        if (!Number.isFinite(ordenId)) {
          return;
        }
        registerRawItem(ordenId, {
          orden_id: ordenId,
          producto_id: item.bebidas_id ?? item.bebidas?.id ?? null,
          orden_item_id: item.id,
          name: item.bebidas?.name || 'Bebida',
          type: 'bebida'
        });
      });
    }

    const { data: toppingsData, error: toppingsError } = await supabase
      .from('ordenes_toppings')
      .select(`
        id,
        orden_id,
        topping_id,
        toppings!topping_id(id, name)
      `)
      .in('orden_id', numericIds);

    if (toppingsError) {
      log.warn('[CRM] Error fetching order toppings:', toppingsError);
    } else {
      (toppingsData || []).forEach((item) => {
        const ordenId = Number(item.orden_id);
        if (!Number.isFinite(ordenId)) {
          return;
        }
        registerRawItem(ordenId, {
          orden_id: ordenId,
          producto_id: item.topping_id ?? item.toppings?.id ?? null,
          orden_item_id: item.id,
          name: item.toppings?.name || 'Topping',
          type: 'topping'
        });
      });
    }

    const itemsByOrder: Record<string, CRMOrderItemSummary[]> = {};
    const countsByOrder: Record<string, { platos: number; bebidas: number }> = {};
    const favoriteCounter: Record<string, CRMCustomerFavoriteProductSummary> = {};

    numericToKey.forEach((key) => {
      const rawItems = rawItemsByOrder[key] || [];

      let platos = 0;
      let bebidas = 0;

      const aggregatedMap = new Map<string, CRMOrderItemSummary>();

      rawItems.forEach((rawItem) => {
        if (rawItem.type === 'plato') {
          platos += 1;
        }
        if (rawItem.type === 'bebida') {
          bebidas += 1;
        }

        const productKey = rawItem.producto_id ?? rawItem.orden_item_id;
        const aggregateKey = `${rawItem.type}-${productKey}`;
        const parsedId = typeof productKey === 'number' ? productKey : Number(productKey);
        const itemId = Number.isFinite(parsedId) ? parsedId : rawItem.orden_item_id;

        if (!aggregatedMap.has(aggregateKey)) {
          aggregatedMap.set(aggregateKey, {
            id: itemId,
            orden_item_id: rawItem.orden_item_id,
            name: rawItem.name,
            type: rawItem.type,
            quantity: 0
          });
        }

        const aggregatedItem = aggregatedMap.get(aggregateKey)!;
        aggregatedItem.quantity += 1;
      });

      const items = Array.from(aggregatedMap.values()).sort((a, b) => a.name.localeCompare(b.name));

      itemsByOrder[key] = items;
      countsByOrder[key] = { platos, bebidas };

      items.forEach((item) => {
        const favoriteKey = `${item.type}-${item.id}`;
        if (!favoriteCounter[favoriteKey]) {
          favoriteCounter[favoriteKey] = {
            id: item.id,
            name: item.name,
            type: item.type,
            count: 0
          };
        }
        favoriteCounter[favoriteKey].count += item.quantity;
      });
    });

    const favoriteProduct = Object.values(favoriteCounter).sort((a, b) => b.count - a.count)[0];

    return {
      itemsByOrder,
      countsByOrder,
      favoriteProduct
    };
  } catch (error) {
    log.error('[CRM] Error building order items summary:', error);
    return { itemsByOrder: {}, countsByOrder: {} };
  }
};

