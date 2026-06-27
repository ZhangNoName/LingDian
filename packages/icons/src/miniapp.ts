import type { Component } from 'vue'
import {
  ClipboardList,
  Coffee,
  Handbag,
  Heart,
  Home,
  MapPin,
  PackageCheck,
  ReceiptText,
  ShoppingBag,
  UserRound,
  Utensils,
} from 'lucide-vue-next'

export type AppTabKey = 'home' | 'menu' | 'orders' | 'profile'

export const tabIcons: Record<AppTabKey, Component> = {
  home: Home,
  menu: Coffee,
  orders: ClipboardList,
  profile: UserRound,
}

export const manageEntryIcons: Record<string, Component> = {
  orders: PackageCheck,
  address: MapPin,
  favorites: Heart,
  transactions: ReceiptText,
}

export const fallbackManageIcon = ShoppingBag

export const checkoutModeIcons = {
  dineIn: Utensils,
  takeaway: Handbag,
} satisfies Record<string, Component>
