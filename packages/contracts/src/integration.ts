import type { OrderSource } from './order';

/** Stable provider identifiers shared by API, management UI and connectors. */
export const INTEGRATION_PROVIDERS = [
  'CASHIER',
  'RECEIPT_PRINTER',
  'MEITUAN_WAIMAI',
  'JD_DAOJIA',
] as const;

export type IntegrationProvider = (typeof INTEGRATION_PROVIDERS)[number];

export type IntegrationCapabilityContract = {
  provider: IntegrationProvider;
  display_name: string;
  category: 'CASHIER' | 'PRINTING' | 'DELIVERY';
  /** The server has a connector URL and signing secret for this provider. */
  available: boolean;
  /** Both the deployment kill switch and the store-level switch are on. */
  enabled: boolean;
  store_id: string;
  reason: string | null;
};

export type SetIntegrationEnabledRequest = {
  enabled: boolean;
};

/**
 * Versioned protocol emitted to connector gateways. Gateways translate this
 * neutral event into a POS, printer, Meituan or JD-specific official protocol.
 */
export type OrderCreatedIntegrationEvent = {
  event_id: string;
  event_type: 'order.created';
  schema_version: 1;
  occurred_at: string;
  store_id: string;
  order: {
    id: string;
    order_no: string;
    /** Internal source used to route and visually distinguish fulfilment work. */
    order_source?: OrderSource;
    /** Store-facing pickup code. Older version-1 events may omit it. */
    pickup_code?: string | null;
    pickup_business_date?: string | null;
    order_type: string;
    status: string;
    payment_channel: string;
    total_amount: number;
    payable_amount: number;
    customer_name: string;
    customer_mobile: string;
    delivery_address: string | null;
    remark: string | null;
    items: Array<{
      product_id: string;
      sku_id: string | null;
      product_name: string;
      sku_name: string | null;
      unit_price: number;
      quantity: number;
      subtotal: number;
      selections: Array<{
        group_name: string;
        option_name: string;
        quantity: number;
        price_delta: number;
      }>;
    }>;
  };
};
