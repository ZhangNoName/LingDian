import type { Component } from 'vue'
import {
  Bike,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Coffee,
  CircleHelp,
  Copy,
  Handbag,
  Heart,
  Home,
  MapPin,
  MapPinned,
  MessageCircle,
  Minus,
  PackageCheck,
  Plus,
  Phone,
  ReceiptText,
  Search,
  ShoppingBag,
  UserRound,
  Utensils,
} from 'lucide-vue-next'

export type AppTabKey = 'home' | 'menu' | 'orders' | 'profile'

export const BackIcon = ChevronLeft
export const ChevronRightIcon = ChevronRight
export const SearchIcon = Search
export const CartIcon = ShoppingBag
export const StoreLocationIcon = MapPinned
export const HelpIcon = CircleHelp
export const MinusIcon = Minus
export const PlusIcon = Plus
export const CopyIcon = Copy
export const PhoneIcon = Phone
export const MessageIcon = MessageCircle
export const HomeDineInIcon = Utensils
export const HomeTakeawayIcon = Handbag
export const HomeDeliveryIcon = Bike

export const TabHomeIcon = Home
export const TabMenuIcon = Coffee
export const TabOrdersIcon = ClipboardList
export const TabProfileIcon = UserRound

export const tabIcons: Record<AppTabKey, Component> = {
  home: TabHomeIcon,
  menu: TabMenuIcon,
  orders: TabOrdersIcon,
  profile: TabProfileIcon,
}

export const ManageOrdersIcon = PackageCheck
export const ManageAddressIcon = MapPin
export const ManageFavoritesIcon = Heart
export const ManageTransactionsIcon = ReceiptText
export const ManageFallbackIcon = ShoppingBag

export const manageEntryIcons: Record<string, Component> = {
  orders: ManageOrdersIcon,
  address: ManageAddressIcon,
  favorites: ManageFavoritesIcon,
  transactions: ManageTransactionsIcon,
}

export const fallbackManageIcon = ManageFallbackIcon

export const CheckoutDineInIcon = Utensils
export const CheckoutTakeawayIcon = Handbag

export const checkoutModeIcons = {
  dineIn: CheckoutDineInIcon,
  takeaway: CheckoutTakeawayIcon,
} satisfies Record<string, Component>
