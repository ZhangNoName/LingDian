import type { SelectedOption } from "./menu";

export type CartItem = {
  id: string;
  productId: string;
  skuId: string;
  productName: string;
  imageUrl: string;
  quantity: number;
  unitPrice: number;
  selectedOptions: SelectedOption[];
};

export type CartSummary = {
  itemCount: number;
  totalAmount: number;
  discountAmount: number;
  items: CartItem[];
};

export type PricePreview = {
  payableAmount: number;
  originalAmount?: number;
  discountAmount?: number;
};
