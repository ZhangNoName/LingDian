export type AppTabKey = 'home' | 'menu' | 'orders' | 'profile'

export type MiniappIcon = string

export const BackIcon = '‹'
export const ChevronRightIcon = '›'
export const SearchIcon = '⌕'
export const CartIcon = '▣'
export const StoreLocationIcon = '⌖'
export const HelpIcon = '?'
export const MinusIcon = '−'
export const PlusIcon = '+'
export const CopyIcon = '⧉'
export const PhoneIcon = '☎'
export const MessageIcon = '✉'
export const HomeDineInIcon = '♨'
export const HomeTakeawayIcon = '▣'
export const HomeDeliveryIcon = '↗'

export const TabHomeIcon = '⌂'
export const TabMenuIcon = '☕'
export const TabOrdersIcon = '☷'
export const TabProfileIcon = '◉'

export const tabIcons: Record<AppTabKey, MiniappIcon> = {
  home: TabHomeIcon,
  menu: TabMenuIcon,
  orders: TabOrdersIcon,
  profile: TabProfileIcon,
}

export const ManageOrdersIcon = '☷'
export const ManageAddressIcon = '⌖'
export const ManageFavoritesIcon = '♡'
export const ManageTransactionsIcon = '¥'
export const ManageFallbackIcon = '▣'

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
