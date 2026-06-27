export type ProductSummary = {
  id: string;
  categoryId: string;
  skuId?: string;
  name: string;
  imageUrl: string;
  price: number;
  originalPrice?: number;
  tags: string[];
  hasSpec: boolean;
};

export type MenuCategory = {
  id: string;
  name: string;
};

export type ProductOption = {
  id: string;
  name: string;
  imageUrl?: string;
  priceDelta?: number;
};

export type OptionGroup = {
  id: string;
  name: string;
  required: boolean;
  min: number;
  max: number;
  options: ProductOption[];
};

export type ProductDetail = ProductSummary & {
  skuId: string;
  optionGroups: OptionGroup[];
  comboImages: string[];
  description?: string;
};

export type SelectedOption = {
  groupId: string;
  optionId: string;
  name: string;
  imageUrl?: string;
  priceDelta?: number;
};
