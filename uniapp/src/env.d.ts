/// <reference types="vite/client" />

declare const __LINGDIAN_API_BASE__: string

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string
  readonly VITE_API_TIMEOUT_MS?: string
}

declare module '*.vue' {
  import { DefineComponent } from 'vue'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/ban-types
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module 'virtual:lingdian-miniapp-icons' {
  type Name = import('@lingdian/icons/miniapp').MiniappGlyphName
  const images: Record<Name, Record<'text' | 'muted' | 'primary' | 'white', string>>
  export default images
}
