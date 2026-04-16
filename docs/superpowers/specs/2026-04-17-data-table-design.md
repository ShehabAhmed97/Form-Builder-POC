# Dynamic Data Table Element

## Overview

Transform the existing `data_table` layout element from a static container into a dynamic repeatable-row table. Admin defines columns by dropping child elements into the table. Users fill the table by adding/removing rows, each row containing values for every column. Submission data is stored as a JSON array.

## Seed Changes

Replace unused `columns` and `rows` properties with `min_rows`:

| Property | Required | Default | Purpose |
|----------|----------|---------|---------|
| `label` | yes | -- | Table heading |
| `min_rows` | no | `0` | Minimum rows the user must fill (0 = table is optional) |
| `css_class` | no | -- | Optional styling hook |

Migration: update `seed.js` to replace the two old property rows with `min_rows`. Existing forms with the old properties are unaffected since they were never used.

## Builder Canvas

The builder canvas currently renders `data_table` the same as `section` (vertical stack of children). Change to a table preview:

- Render a `<table>` inside the builder element card.
- Column headers: each child element's `values.label` (or `element_key` as fallback).
- One placeholder row showing the field type name per column (e.g., "Text", "Number", "Select").
- Drop zone: a single horizontal drop area below the header row. Dropping an element adds it as a new column. Layout and content elements (row, section, heading, etc.) are not droppable into a data_table.
- Reordering columns: reorder child elements via drag handles on the column headers.
- Removing columns: existing remove button on each child element.

## Renderer (User-Facing Form)

Renders inside `RelationalFormRenderer` when `el.type_name === 'data_table'`:

- HTML `<table>` with `<thead>` showing column headers from child element labels.
- Each `<tbody>` row: one input cell per column, rendered using the same field-type logic already in `renderField` (text, number, select, radio, checkbox, date, etc.).
- Cell inputs keyed as `table_key.ROW_INDEX.column_key` in local state for uniqueness, but submitted as a nested structure.
- "Add Row" button below the table. Appends an empty row object.
- Delete button (trash icon) as the last cell of each row. Hidden when row count equals `min_rows`.
- On mount: if `min_rows > 0`, pre-populate that many empty rows.

### State Shape

```js
// Local component state for a table with key "expenses"
{
  expenses: [
    { item: "Flight", cost: "500", date: "2026-01-15" },
    { item: "Hotel",  cost: "300", date: "2026-01-15" },
  ]
}
```

### Validation

- Check `min_rows`: if set and row count is less, show error on the table element.
- Per-cell validation: apply each column element's validation properties (`required`, `min_length`, `max_length`, `pattern`) to every cell in that column across all rows.
- Cell errors keyed as `table_key.ROW_INDEX.column_key` to highlight individual cells.

## Backend (Submissions)

### Storing

When processing submission values, detect data_table elements:

- The value for a data_table element_key is a JSON-stringified array of row objects.
- Store as a single row in `submission_values` with `value = JSON.stringify(rows)`.
- Skip child elements of a data_table from flat field processing (they define columns, not standalone inputs).

### Validation

On `POST /api/sub-apps/:subAppId/submissions`:

1. Identify data_table elements and their children.
2. Parse the submitted value as a JSON array.
3. Check `min_rows` against array length.
4. For each row, validate each cell against the column element's properties (required, min_length, max_length, pattern).
5. Return cell-level errors keyed as `table_key.ROW_INDEX.column_key`.

### Reading

On `GET /api/submissions/:id`:

- When building the values object, detect JSON array strings for data_table elements and parse them back into arrays so the response contains actual arrays, not stringified JSON.

## Submission Viewer

When rendering a submitted data_table value:

- Render a read-only HTML `<table>` with column headers and row data.
- No inputs, no add/remove buttons.
- Reuse the same column header logic from the renderer.

## Scope Boundaries

- No column reordering by the end user at fill-time (only admin in builder).
- No row reordering by the end user (rows stay in insertion order).
- No nested tables (a data_table cannot contain another data_table).
- No column-level conditions inside the table (conditions on the table element itself still work: show/hide/require the entire table).
- Maximum rows: no hard cap enforced, but the UI doesn't need pagination for the POC.
