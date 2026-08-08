export type MenuViewState = "loading" | "ready" | "empty" | "error";

export function resolveMenuViewState(input: {
  loading: boolean;
  failed: boolean;
  sectionCount: number;
}): MenuViewState {
  if (input.loading) {
    return "loading";
  }

  if (input.failed) {
    return "error";
  }

  if (input.sectionCount === 0) {
    return "empty";
  }

  return "ready";
}
