import { useLocale } from '@/i18n/locale'
const zh = {
  detail: '原料详情',
  back: '返回原料',
  close: '关闭',
  read: '重新读取',
  failure: '无法读取当前门店的原料，请重试或返回清单。',
  stockHint: '可用库存 = 账面库存 − 已预占；未收采购不计入现货。',
  archivedHint: '已停用原料保留历史，恢复启用后才能新增日常业务。',
  lifecycle: '原料状态',
  refreshed: '已读取最新原料信息',
  history: '近 30 天记录',
  report: '近 30 天收支',
  related: '关联业务',
  more: '查看详情',
  showFilters: '筛选',
  hideFilters: '收起筛选',
  summary: '全店启用原料，不受列表筛选影响',
} as const
const en: Record<keyof typeof zh, string> = {
  detail: 'Material details',
  back: 'Back to material',
  close: 'Close',
  read: 'Reload material',
  failure: 'Could not read this store’s material. Retry or return to the list.',
  stockHint: 'Available = on hand − reserved. Outstanding purchases are not stock on hand.',
  archivedHint: 'Archived materials keep their history. Restore the material before starting new operations.',
  lifecycle: 'Material status',
  refreshed: 'Latest material loaded',
  history: 'Last 30 days · history',
  report: 'Last 30 days · report',
  related: 'Related records',
  more: 'View details',
  showFilters: 'Filters',
  hideFilters: 'Hide filters',
  summary: 'Active materials across this store, regardless of list filters',
}
export function useMaterialLocale() {
  const { locale } = useLocale()
  return { t: (key: keyof typeof zh) => (locale.value === 'en-US' ? en : zh)[key] }
}
