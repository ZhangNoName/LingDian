export function isPlannedModulesEnabled(value: string | undefined): boolean {
  return value === 'true'
}

export const plannedModulesEnabled = isPlannedModulesEnabled(
  import.meta.env.VITE_ENABLE_PLANNED_MODULES,
)
