# Icon Button Design

## Goal

Provide one reusable wrapper for buttons that combine an icon and text, with consistent spacing and alignment across the admin application.

## Component

`AppIconButton` wraps `el-button`, requires an `icon` Vue component, renders text through the default slot, and forwards normal button attributes and listeners. Its own `icon-button` class owns a six-pixel gap and vertical centering.

Icon-only circular actions continue to use `el-button` directly because they do not need text spacing. Existing text-only buttons also remain unchanged.

## Migration

- Search and reset in `SchemaTablePage` use `AppIconButton`.
- Collapse and expand in `SchemaSearchForm` use `AppIconButton` with a dynamic arrow icon.

## Testing

Component tests verify icon/text structure, forwarded button props and click events. Existing schema-table tests continue to cover search, reset, and collapse behavior.

