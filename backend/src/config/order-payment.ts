export function orderPaymentRequired(): boolean {
  return process.env.ORDER_PAYMENT_REQUIRED !== 'false';
}
