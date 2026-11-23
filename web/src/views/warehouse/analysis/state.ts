import type { AnalysisOrder, AnalysisSubset } from './model'
export interface AnalysisState {
  subset: AnalysisSubset
  order: AnalysisOrder
  itemId: string
}
export function parseAnalysisState(query: Record<string, unknown>): AnalysisState {
  return {
    subset: query.analysisSubset === 'LOSS' || query.analysisSubset === 'COUNT' ? query.analysisSubset : 'ALL',
    order: query.analysisOrder === 'LOSS_RATE' ? 'LOSS_RATE' : 'CODE',
    itemId:
      typeof query.analysisItem === 'string' && query.analysisItem.trim().length <= 191
        ? query.analysisItem.trim()
        : '',
  }
}
export function analysisQuery(state: AnalysisState): Record<string, string> {
  return {
    reportView: 'analysis',
    ...(state.subset !== 'ALL' ? { analysisSubset: state.subset } : {}),
    ...(state.order !== 'CODE' ? { analysisOrder: state.order } : {}),
    ...(state.itemId ? { analysisItem: state.itemId } : {}),
  }
}
