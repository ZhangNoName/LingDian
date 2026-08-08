import type { Component } from "vue"
import {
  Bike,
  ChevronRight,
  CircleHelp,
  CircleUserRound,
  Coffee,
  Copy,
  Grid2X2,
  Heart,
  House,
  ListOrdered,
  MapPin,
  MessageCircle,
  Minus,
  Phone,
  Plus,
  Search,
  ShoppingBag,
  Soup,
  WalletCards,
} from "lucide-vue-next"

export type AppTabKey = "home" | "menu" | "orders" | "profile"

export type MiniappIcon = Component

export const BackIcon = "‹"
export const ChevronRightIcon = ChevronRight
export const SearchIcon = Search
export const CartIcon = ShoppingBag
export const StoreLocationIcon = MapPin
export const HelpIcon = CircleHelp
export const MinusIcon = Minus
export const PlusIcon = Plus
export const CopyIcon = Copy
export const PhoneIcon = Phone
export const MessageIcon = MessageCircle
export const HomeDineInIcon = Soup
export const HomeTakeawayIcon = ShoppingBag
export const HomeDeliveryIcon = Bike

export const TabHomeIcon = House
export const TabMenuIcon = Coffee
export const TabOrdersIcon = ListOrdered
export const TabProfileIcon = CircleUserRound

export const tabIcons: Record<AppTabKey, MiniappIcon> = {
  home: TabHomeIcon,
  menu: TabMenuIcon,
  orders: TabOrdersIcon,
  profile: TabProfileIcon,
}

export const ManageOrdersIcon = ListOrdered
export const ManageAddressIcon = MapPin
export const ManageFavoritesIcon = Heart
export const ManageTransactionsIcon = WalletCards
export const ManageFallbackIcon = Grid2X2

export const manageEntryIcons: Record<string, MiniappIcon> = {
  orders: ManageOrdersIcon,
  address: ManageAddressIcon,
  favorites: ManageFavoritesIcon,
  transactions: ManageTransactionsIcon,
}

export const fallbackManageIcon = ManageFallbackIcon

export const CheckoutDineInIcon = HomeDineInIcon
export const CheckoutTakeawayIcon = HomeTakeawayIcon

export const checkoutModeIcons = {
  dineIn: CheckoutDineInIcon,
  takeaway: CheckoutTakeawayIcon,
} satisfies Record<string, MiniappIcon>
