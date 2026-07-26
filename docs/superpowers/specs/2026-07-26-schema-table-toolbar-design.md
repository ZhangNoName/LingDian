# Schema Table Toolbar Design

## Goal

Place a dedicated action toolbar between the optional search form and the table. Business actions appear on the left, while search and reset appear on the right only when searchable columns exist.

## Component responsibilities

`SchemaSearchForm` renders only the heading, collapse control, and fields derived from columns with `isSearch: true`. It does not render search, reset, create, import, refresh, or other action buttons.

`SchemaTablePage` computes whether searchable columns exist and owns the action toolbar:

- `toolbar-actions` renders on the left for page-specific actions such as create, batch import, batch delete, or refresh.
- Search and reset buttons render on the right and emit the existing `search` and `reset` events.
- The toolbar renders when either `toolbar-actions` content exists or searchable columns exist.
- When no columns have `isSearch: true`, the search form and search/reset buttons are omitted.
- When no searchable columns and no toolbar content exist, the complete toolbar is omitted.

The existing `toolbar` slot remains a compatibility alias for the left action area. The temporary `search-actions` slot is removed from page usage.

## Layout

The toolbar is a fixed-height row with a subtle bottom border. Its left and right groups use flex layout and wrap on narrow screens. Business actions remain left aligned; search and reset remain right aligned. The table keeps ownership of vertical scrolling and pagination remains fixed below it.

## Page migration

- Account pages place their category-specific create button in `toolbar-actions`.
- System logs place refresh in `toolbar-actions`.

## Testing

Component tests cover:

1. searchable columns render the form and right-side search/reset controls;
2. business slots render in the left group;
3. no searchable columns omit the form and search/reset controls;
4. a toolbar with only business actions still renders;
5. no search and no actions omit the toolbar entirely.

