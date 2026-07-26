# Admin Console Redesign Design

## Goal

Rebuild the complete admin experience, including login, as a comfortable-density classic enterprise administration system. Use Element Plus for the interface foundation, replace in-memory page switching with routed modules, generate navigation from permissions, and support light, dark, and system themes.

## Scope

This redesign covers:

- The admin login page and authenticated application shell.
- Route-based navigation and permission-aware menus.
- Platform-wide user administration, including administrators, merchants, and ordinary users.
- System logs and personal profile settings.
- Theme selection, responsive behavior, common loading and error states, and accessibility-minded component usage.
- Backend capabilities required for platform-wide user queries and account administration.

Account deletion is explicitly excluded. Accounts remain associated with historical orders, logs, and audit records and can only be disabled.

## Technology and Architecture

The admin remains a Vue 3, Vite, and TypeScript application. It will add Element Plus and Vue Router, matching the repository's documented admin stack and reusing libraries already adopted by the web application.

The authenticated interface will use a shared `AdminLayout` composed of:

- A fixed, collapsible sidebar for primary navigation.
- A top header containing the sidebar control, breadcrumbs, theme selection, and the current-user menu.
- A scrollable content area with a light gray surface in light mode and layered dark surfaces in dark mode.
- A mobile drawer that replaces the fixed sidebar at narrow widths.

Each module receives a stable URL. Initial routes include `/users`, `/system/logs`, and `/profile`. Browser refresh, forward, and back navigation must preserve the active module.

## Permissions and Navigation

Navigation is defined in one typed configuration. Each entry declares its route, label, icon, group, and required permissions or roles. The visible sidebar is derived from the authenticated user's effective permissions instead of being hard-coded in the template.

The router uses the same permission model as the menu. A route guard checks access before entering protected pages. If a user requests an inaccessible route, the application redirects to the first accessible module and displays a permission warning. Hiding a menu item alone is not treated as access control.

High-risk user-management rules include:

- Only authorized roles can change roles, reset passwords, or enable and disable accounts.
- A non-super-admin cannot grant the super-admin role.
- An administrator cannot manage an account with higher authority than their own.
- Self-escalation and equivalent privilege bypasses are rejected by both frontend affordances and backend authorization.

The current user's profile and logout actions live in the header user menu rather than in the primary navigation.

## Theme System

The header theme control provides three choices: light, dark, and system.

- The selection is persisted in `localStorage`.
- System mode follows `prefers-color-scheme` and updates immediately when the operating-system preference changes.
- Element Plus theme variables and its official dark-mode styles provide the component baseline.
- Application-level tokens define layout surfaces, borders, text hierarchy, sidebar states, and brand accents without duplicating component internals.

The existing warm red remains the restrained brand accent for primary actions, active navigation, and important emphasis. Success, warning, and danger states use Element Plus semantic colors. The light theme retains a dark brand sidebar; the dark theme uses layered charcoal surfaces rather than pure black.

## Visual System

The interface uses comfortable rather than compact density:

- Main content spacing is approximately 24 pixels.
- Cards use 20 to 24 pixels of internal padding.
- Data-table rows are approximately 52 pixels high.
- Forms use normal or large Element Plus controls and clear vertical grouping.
- Page structure consistently follows title and actions, optional filters, then the primary data or form card.

Element Plus provides the standard containers, menus, dropdowns, breadcrumbs, cards, tables, forms, inputs, selects, tags, dialogs, drawers, alerts, empty states, skeletons, messages, and confirmation prompts. Custom CSS is limited to layout, branding, responsive behavior, and module-specific composition.

## Login Experience

The login page uses a branded split layout on wide screens and a centered single-card layout on narrow screens. The brand area introduces the LingDian platform, while the form area uses Element Plus form validation, password visibility controls, loading states, and accessible error feedback.

The page supports all three theme modes and avoids a theme flash during startup by applying the stored or system-resolved theme before the Vue application mounts.

## Platform User Management

The former merchant-only module becomes `Users and Permissions`, with `User Management` as its initial page. It covers super administrators, administrators, merchants, and ordinary platform users.

The user table includes, where available:

- Avatar and nickname.
- Username and phone number.
- Role or roles.
- Merchant store scope.
- Enabled or disabled status.
- Last login time.
- Creation time.

Users can be filtered by keyword, role, status, and store. The backend performs filtering and pagination so the page remains usable as the platform grows.

Authorized administrators can:

- Create an account.
- Edit basic profile information.
- Change roles within their authority.
- Configure store scope when the merchant role applies.
- Enable or disable an account.
- Reset a password.

Create and edit flows use a drawer form. Fields change according to selected roles; for example, merchant users require at least one store. Disabling an account requires confirmation, prevents future login, and invalidates active sessions. Password reset either accepts an administrator-provided policy-compliant password or generates a temporary password, and marks the account to require a password change at next login.

The UI does not expose account deletion, and the backend does not add a delete endpoint.

## System Logs

The system-log page uses a card-based filter bar followed by a paginated Element Plus table. Log levels render as semantic tags. Selecting a record opens a detail drawer containing structured metadata without forcing wide rows into the primary table.

Role changes, account enable and disable operations, password resets, and store-scope changes must generate audit records containing the operator, target user, action, result, and relevant non-secret metadata. Passwords and tokens are never logged.

## Personal Settings

Personal settings use a constrained-width card layout. Nickname editing is an independent form section with consistent validation, pending, success, and failure states. The module is available to every authenticated admin user even if they cannot access platform-wide user management.

## Common States and Error Handling

- Page and table fetches display Element Plus loading or skeleton states.
- Empty results use `ElEmpty` with context-appropriate copy.
- Recoverable page-level failures use `ElAlert` with a retry action.
- Successful mutations use `ElMessage`; destructive or security-sensitive state changes use `ElMessageBox` confirmation first.
- Authentication expiration returns the user to login while preserving only a safe intended route.
- Permission failures never reveal protected record contents.

## Responsive Behavior

The sidebar is fixed on desktop, collapsible on tablet-sized layouts, and rendered as a drawer on mobile. Tables may scroll horizontally when their essential columns cannot be reduced. Drawer forms become full-width on small screens, and multi-column forms collapse to one column.

## Backend and Data Changes

The backend will expose permission-protected endpoints for paginated platform user listing, profile editing, role assignment, store-scope assignment, account enable and disable, and password reset. Existing merchant behavior is migrated into this broader user-management surface rather than maintained as a separate competing workflow.

Account status is enforced during login and authenticated request validation. Disabling an account revokes or invalidates its sessions. All backend mutations validate the operator's authority independently from the frontend.

If the current schema does not retain last-login time or mandatory-password-change state, focused schema fields and migrations will be added. Existing user and role relationships remain authoritative; the redesign does not introduce a second identity model.

## Testing and Verification

Frontend tests cover:

- Permission-based menu generation.
- Route-guard behavior for authorized and unauthorized navigation.
- Light, dark, and system theme resolution, persistence, and live system changes.
- Conditional user form fields and action visibility.
- Login, loading, empty, error, and responsive-critical rendering states.

Backend tests cover:

- Platform user filtering and pagination.
- Role hierarchy and privilege-escalation rejection.
- Profile, role, store-scope, enable, disable, and password-reset mutations.
- Session invalidation for disabled accounts.
- Required audit-log creation without sensitive data.

Verification includes the admin and backend type checks, relevant unit tests, production builds, and a manual visual pass in both themes at desktop and mobile widths.

## Success Criteria

- Login and all authenticated pages present one coherent Element Plus-based admin experience.
- Navigation uses URLs and is generated from permissions; page switching no longer relies on a local `page` variable.
- Users cannot access protected routes or operations beyond their authority.
- Authorized administrators can manage all platform account types without deleting them.
- Disabled users cannot log in or continue using an existing authenticated session.
- Theme selection supports light, dark, and system modes without startup flashing and persists across visits.
- The interface remains comfortable, legible, and operational across desktop, tablet, and mobile widths.
