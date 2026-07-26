export function mandatoryPasswordRoute(user: { mustChangePassword?: boolean } | undefined, path: string): string | null {
  return user?.mustChangePassword && path !== '/password-change' ? '/password-change' : null
}
