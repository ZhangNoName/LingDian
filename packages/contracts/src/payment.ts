export type PaymentProvider = 'WECHAT_PAY' | 'ALIPAY' | 'UNIONPAY' | 'STRIPE' | 'PAYPAL';
export type OnlinePaymentChannel = 'WECHAT' | 'ALIPAY' | 'UNIONPAY' | 'STRIPE' | 'PAYPAL';
export type PaymentIntentStatus =
  | 'CREATED' | 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'EXPIRED';

export type PaymentIntentContract = {
  payment_no: string;
  order_id: string;
  provider: PaymentProvider;
  channel: OnlinePaymentChannel;
  status: PaymentIntentStatus;
  amount_minor: number;
  currency: string;
  client_action: Record<string, unknown> | null;
  expires_at: string;
  paid_at: string | null;
};
