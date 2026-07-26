export const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:9000/api'
export const ASSET_BASE = API_BASE.replace(/\/api$/, '')
