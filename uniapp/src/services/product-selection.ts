import type { OptionGroup } from "@/types/menu";

export type ProductSelectionState = Record<string, string[]>;

function maximumFor(group: OptionGroup): number {
  return group.selectionMode === "SINGLE" ? Math.min(1, group.max) : group.max;
}

function minimumFor(group: OptionGroup): number {
  return Math.max(group.min, group.required ? 1 : 0);
}

export function initializeProductSelections(groups: OptionGroup[]): ProductSelectionState {
  return Object.fromEntries(groups.map((group) => {
    const maximum = maximumFor(group);
    const minimum = Math.min(minimumFor(group), maximum);
    const defaults = group.options.filter((option) => option.isDefault).map((option) => option.id);
    const selected = [...new Set(defaults)].slice(0, maximum);

    for (const option of group.options) {
      if (selected.length >= minimum) break;
      if (!selected.includes(option.id)) selected.push(option.id);
    }
    return [group.id, selected];
  }));
}

export function toggleProductSelection(
  group: OptionGroup,
  current: readonly string[],
  optionId: string,
): { selected: string[]; limitReached: boolean } {
  if (!group.options.some((option) => option.id === optionId)) {
    return { selected: [...current], limitReached: false };
  }
  if (current.includes(optionId)) {
    return { selected: current.filter((id) => id !== optionId), limitReached: false };
  }
  if (group.selectionMode === "SINGLE") {
    return { selected: [optionId], limitReached: false };
  }
  if (current.length >= maximumFor(group)) {
    return { selected: [...current], limitReached: true };
  }
  return { selected: [...current, optionId], limitReached: false };
}

export function validateProductSelections(
  groups: OptionGroup[],
  selections: ProductSelectionState,
): string | undefined {
  for (const group of groups) {
    const selected = [...new Set(selections[group.id] ?? [])];
    const minimum = minimumFor(group);
    const maximum = maximumFor(group);
    if (selected.length < minimum) return `${group.name}至少选择 ${minimum} 项`;
    if (selected.length > maximum) return `${group.name}最多选择 ${maximum} 项`;
    if (selected.some((id) => !group.options.some((option) => option.id === id))) {
      return `${group.name}包含不可用选项`;
    }
  }
  return undefined;
}
