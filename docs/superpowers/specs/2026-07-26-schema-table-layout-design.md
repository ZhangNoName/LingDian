# Schema-driven Admin Table Layout Design

## Goal

Rework every list page in the admin application so the application shell never scrolls as one document. List content must use an internally scrolling table with a fixed action column, collapsible filters, real pagination, and reusable schema-driven rendering.

## Scope

- Convert the user-management and system-log list pages.
- Constrain the admin shell to the viewport and provide a separate scroll container for non-list pages.
- Introduce a reusable schema table page, search form, icon action list, and pagination footer.
- Introduce an independent dictionary module for reusable select options and value labels.
- Change system-log querying from cursor-based loading to page/page-size pagination with a total count.
- Preserve existing user drawers, password dialogs, permission rules, route structure, themes, and responsive mobile drawer.

## Architecture

### Application shell

`AdminLayout` owns the viewport. Its outer containers use `height: 100%` and `min-height: 0`; `el-main` uses `overflow: hidden`. A route-meta flag selects either a `list-page-viewport` container, which delegates scrolling to the table, or a `standard-page-scroll` container for ordinary settings pages.

The desktop sidebar remains collapsible. The mobile sidebar remains a drawer. Neither sidebar state changes page scroll ownership.

### Schema table components

The reusable feature lives under `admin/src/components/schema-table/` and is independent of user and log domain types.

- `SchemaTablePage.vue` composes the collapsible search area, toolbar, table, error/empty states, and pagination.
- `SchemaSearchForm.vue` renders fields whose column schema has `isSearch: true` and emits search/reset events.
- `SchemaTableActions.vue` renders icon-only actions with accessible labels and tooltips.
- `types.ts` defines generic column, action, option-source, pagination, and slot contracts.
- `schema.ts` contains framework-light normalization and cell-value helpers.

`SchemaColumn<Row>` supports `dataIndex`, `key`, `label`, `width`, `minWidth`, `fixed`, `formatter`, the compatibility alias `formater`, `slot`, overflow tooltip behavior, search metadata, dictionary codes, and direct/async option sources. `formatter` takes precedence over `formater`.

Cell resolution order is: named slot, formatter, dictionary label, then raw `dataIndex` value. Named slots use `cell-{key}` and `search-{key}`. Page-level slots include `toolbar`, `actions`, and `empty`.

The table fills the remaining vertical space. Element Plus owns vertical and horizontal table scrolling. The action column is fixed on the right by default. Pagination stays outside the scrolling table body but inside the list page viewport.

### Dictionary module

The dictionary service lives in `admin/src/dictionaries/` and has no imports from table components, views, router, auth, or business services.

- `types.ts` declares dictionary option and loader types.
- `registry.ts` implements registration, lookup, label resolution, caching, invalidation, and async loader support.
- `catalog.ts` registers built-in dictionaries for user role, user status, log source, and log level.
- `index.ts` exports the public API only.

Each option has a stable `value`, a future-facing `labelKey`, and a current `fallbackLabel`. UI consumers provide an optional translator function; without one, the fallback is rendered. Dynamic domain data such as stores is supplied as a direct or async option source and is not registered as a global dictionary.

The schema table depends only on the dictionary module's public resolver interface. The dictionary module never depends on the schema table, preventing circular coupling and allowing future use by drawers and ordinary forms.

### Page migration

User management defines columns and search metadata in a focused schema file. Complex user identity and role cells use slots. The action slot supplies edit, password reset, enable, and disable actions through `SchemaTableActions`. Search and reset preserve current semantics; page-size choices are 10, 20, 50, and 100.

System logs define columns and filters through the same schema. Level/source labels come from global dictionaries, detail uses an icon action, and the detail drawer remains domain-specific. The endpoint accepts `page` and `pageSize` and returns `{ items, total, page, pageSize }`.

## Data flow

1. A page owns its query object and data-fetching function.
2. `SchemaTablePage` renders query controls from column metadata.
3. Search resets the page to 1; reset clears only configured search fields and then reloads.
4. Page/page-size changes update the page query and trigger one reload.
5. The page passes response items and total back to the generic component.
6. Dictionary values are resolved through the independent registry, with async sources cached by dictionary code.

The generic component never calls user or log APIs directly.

## Error and empty states

API failures remain visible in the table page and expose a retry action. Loading preserves the table shell. Empty results render an explicit empty state without collapsing the available table height. Failed dictionary loaders fall back to an empty option set and expose the error to the caller rather than silently substituting stale localized values.

## Accessibility and responsive behavior

- Icon actions have both `aria-label` and tooltip text.
- Filter collapse controls expose expanded state.
- Keyboard focus remains on native Element Plus controls.
- On narrow screens the filter grid becomes one column, the header actions wrap, and the table scrolls horizontally without forcing document overflow.
- Reduced-height desktop windows retain reachable pagination because the table body shrinks before outer layout elements.

## Testing

- Unit-test dictionary registration, fallback/translated labels, loader caching, and invalidation without mounting table components.
- Unit-test schema normalization, `dataIndex` resolution, formatter precedence, and reset-value construction.
- Component-test search/reset, collapse, pagination events, named slots, fixed action column configuration, and accessible icon actions.
- Test the paginated system-log service/query contract and backend skip/take/count behavior.
- Test user and log page schemas for the intended search, dictionary, formatter, slot, and fixed-action behavior.
- Run the complete admin and backend focused tests, type checks/builds, and `git diff --check`.

## Non-goals

- A visual form builder or runtime administration UI for schemas.
- Persisting user-specific column order or visibility.
- Replacing business drawers and dialogs with schema-generated CRUD forms.
- Adding a full i18n library in this change; dictionary `labelKey` values only make that adoption non-breaking later.
