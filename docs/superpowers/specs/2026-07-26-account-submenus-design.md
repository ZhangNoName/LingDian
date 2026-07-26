# Account Management Submenus Design

## Goal

Split platform account administration into administrator, merchant, and ordinary-user submenus while keeping one reusable schema-table page and a compact layout without a redundant page heading.

## Navigation and routes

The sidebar contains a parent item named `账号管理` with three children:

- `/accounts/admins` — 管理员账号
- `/accounts/merchants` — 商家账号
- `/accounts/users` — 普通用户

The old `/users` route redirects to `/accounts/admins`. All three routes retain the existing `users:read` permission and list layout. `firstAccessibleRoute` returns `/accounts/admins` for authorized administrators.

Navigation configuration becomes a typed tree. Parent visibility is derived from visible children, and the sidebar renders leaf items with `ElMenuItem` and groups with `ElSubMenu`.

## Exclusive account classification

The shared contract adds `PlatformAccountType = 'ADMINISTRATOR' | 'MERCHANT' | 'USER'` and an optional `accountType` field to `PlatformUserQuery`.

Classification is exclusive and uses this precedence:

1. `ADMINISTRATOR`: at least one active `ADMIN` or `SUPER_ADMIN` role.
2. `MERCHANT`: no active administrator role and at least one active `MERCHANT` role.
3. `USER`: no active administrator or merchant role and at least one active `USER` role.

The backend adds the classification predicate to the Prisma `where` used by both `count` and `findMany`. Existing explicit role filters remain available for callers that do not pass `accountType`, but the account pages use only `accountType` so totals and pages remain correct.

## Reusable page configuration

`UserManagementView` reads `route.meta.accountType` and derives a focused configuration:

- label and create-button text;
- fixed query account type;
- allowed base roles;
- whether store search and the store column are visible;
- default role for account creation.

Administrator pages list both `ADMIN` and `SUPER_ADMIN` accounts, but create and edit forms only assign the delegable `ADMIN` role under the existing privilege policy. Merchant pages use `MERCHANT` and require at least one store. Ordinary-user pages use `USER`. Editing preserves the selected account category and prevents changing it into a different category from the wrong submenu.

The column factory accepts the account type. Merchant columns include store scope; ordinary-user and administrator columns omit irrelevant store search/columns. The generic schema table remains domain-independent.

## Compact list layout

List pages no longer render `PageHeader`. `SchemaSearchForm` gains a `search-actions` slot inside the existing button row. Account pages place `新建管理员`, `新建商家`, or `新建用户` after search and reset. The system-log refresh action moves into the same slot, so list pages use one consistent control row.

The filter heading and collapse control remain. Table scrolling, fixed action columns, pagination, mobile wrapping, and error states remain unchanged.

## Testing

- Contract/backend tests cover all exclusive classification predicates and shared count/findMany filters.
- Navigation tests cover the nested tree, child visibility, and first accessible route.
- Route tests cover the three list routes and `/users` compatibility redirect.
- Column/config tests cover account-specific fields, allowed roles, default roles, and button labels.
- Component tests prove `search-actions` renders beside search/reset.
- Full contracts build, backend tests/build, and admin tests/build must pass.
