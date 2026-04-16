# Form Builder Redesign — Design Spec

## Overview

Redesign the dynamic forms platform to replace Form.io with a custom form builder, migrate from JSON-blob storage to a fully normalized relational database, and significantly improve the builder UX with drag-and-drop, dual sidebars, layout elements, and conditional field logic.

## Goals

1. Remove dependency on Form.io for form building and rendering (preserve code, isolate in `formio/` directory)
2. Normalize the database — single source of truth for element types, properties, validations, and form structure
3. Build a professional form builder with drag-and-drop, element palette sidebar, and property editor sidebar
4. Support layout elements (rows, sections, data tables) with nested drag-and-drop
5. Support conditional field logic (show/hide, require/unrequire, set value, disable/enable)
6. Support form copy/duplicate
7. Lay the foundation for a large-scale application — organized, structured, dynamic, handling every corner case

## Database Schema — 17 Tables in 3 Layers

### Layer 1: Registry (7 tables) — What CAN Exist

Seeded once, rarely changes. Drives the builder UI.

#### `element_categories`

Groups element types in the left sidebar.

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | Auto-increment |
| name | TEXT NOT NULL UNIQUE | e.g., `basic_input`, `selection`, `layout`, `content`, `advanced` |
| label | TEXT NOT NULL | Display label |
| icon | TEXT | Icon identifier |
| display_order | INTEGER NOT NULL | Sort order in sidebar |

**Seed data**: basic_input, selection, layout, content, advanced

#### `element_types`

Individual element types available in the builder.

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | Auto-increment |
| category_id | INTEGER FK | References `element_categories.id` |
| name | TEXT NOT NULL UNIQUE | e.g., `textfield`, `select`, `row` |
| label | TEXT NOT NULL | Display label |
| icon | TEXT | Icon identifier |
| is_layout | BOOLEAN NOT NULL DEFAULT false | Whether this element can contain children |
| display_order | INTEGER NOT NULL | Sort order within category |

**Seed data (20 types)**:
- **Basic Input**: textfield, textarea, number, email, phone, date, time, datetime
- **Selection**: select, radio, checkbox, checkbox_group, toggle
- **Layout**: row, section, data_table
- **Content**: heading, subheading, text
- **Advanced**: file_upload

#### `property_groups`

Sections/tabs in the right sidebar property editor.

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | Auto-increment |
| name | TEXT NOT NULL UNIQUE | e.g., `general`, `validation`, `display`, `data` |
| label | TEXT NOT NULL | Display label |
| display_order | INTEGER NOT NULL | Sort order |

**Seed data**: general, validation, display, data

#### `property_definitions`

All possible properties any element type can have.

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | Auto-increment |
| property_group_id | INTEGER FK | References `property_groups.id` |
| name | TEXT NOT NULL UNIQUE | e.g., `label`, `required`, `max_length` |
| label | TEXT NOT NULL | Display label |
| data_type | TEXT NOT NULL | `string`, `number`, `boolean` |
| input_type | TEXT NOT NULL | How to render in sidebar: `text`, `textarea`, `number`, `checkbox`, `select` |
| description | TEXT DEFAULT '' | Help text for the property |
| default_value | TEXT | Default value when property is not set |

**Seed data**: label, placeholder, description, default_value, required, min_length, max_length, min_value, max_value, pattern, custom_error, hidden, disabled, css_class, multiple, rows, columns, min_rows

#### `element_type_properties`

Junction table: which properties belong to which element types.

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | Auto-increment |
| element_type_id | INTEGER FK | References `element_types.id` |
| property_definition_id | INTEGER FK | References `property_definitions.id` |
| is_required | BOOLEAN NOT NULL DEFAULT false | Whether this property must be set for this type |
| display_order | INTEGER NOT NULL | Sort order within the type's property list |
| override_default | TEXT | Type-specific default (overrides property_definitions.default_value) |

**UNIQUE constraint**: (element_type_id, property_definition_id)

Example: `textfield` gets label (required), placeholder, description, default_value, required, min_length, max_length, pattern, custom_error, hidden, disabled, css_class. `select` gets label (required), placeholder, required, multiple, hidden, disabled, css_class — but NOT min_length/max_length. `row` only gets columns (required), css_class.

#### `condition_action_types`

Actions that a condition can trigger on a target element.

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | Auto-increment |
| name | TEXT NOT NULL UNIQUE | e.g., `show`, `hide`, `require` |
| label | TEXT NOT NULL | Display label |
| display_order | INTEGER NOT NULL | Sort order |

**Seed data**: show, hide, require, unrequire, set_value, disable, enable

#### `condition_operators`

Comparison operators for condition rules.

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | Auto-increment |
| name | TEXT NOT NULL UNIQUE | e.g., `equals`, `not_equals` |
| label | TEXT NOT NULL | Display label |
| display_order | INTEGER NOT NULL | Sort order |

**Seed data**: equals, not_equals, contains, not_contains, greater_than, less_than, is_empty, is_not_empty

### Layer 2: Form Structure (7 tables) — What DOES Exist in a Form

Created by admins in the form builder.

#### `forms`

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | Auto-increment |
| name | TEXT NOT NULL | Form template name |
| description | TEXT DEFAULT '' | |
| current_version | INTEGER NOT NULL DEFAULT 1 | Points to latest version_num |
| created_at | TEXT DEFAULT CURRENT_TIMESTAMP | |
| updated_at | TEXT DEFAULT CURRENT_TIMESTAMP | |

#### `form_versions`

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | Auto-increment |
| form_id | INTEGER FK | References `forms.id` ON DELETE CASCADE |
| version_num | INTEGER NOT NULL | |
| created_at | TEXT DEFAULT CURRENT_TIMESTAMP | |

**UNIQUE constraint**: (form_id, version_num)

No more `schema` JSON column. The form structure is fully described by `form_elements` + `form_element_values` + `form_element_options` + conditions.

#### `form_elements`

Elements placed in a form version, forming a tree via `parent_id`.

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | Auto-increment |
| form_version_id | INTEGER FK | References `form_versions.id` ON DELETE CASCADE |
| element_type_id | INTEGER FK | References `element_types.id` |
| element_key | TEXT NOT NULL | Unique identifier within form version (e.g., `first_name`) |
| position | INTEGER NOT NULL | Sort order among siblings |
| parent_id | INTEGER FK NULL | Self-reference for nesting. NULL = root level |

**UNIQUE constraint**: (form_version_id, element_key)

#### `form_element_values`

Configured property values for each placed element.

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | Auto-increment |
| form_element_id | INTEGER FK | References `form_elements.id` ON DELETE CASCADE |
| property_definition_id | INTEGER FK | References `property_definitions.id` |
| value | TEXT | The configured value (cast by property_definitions.data_type) |

**UNIQUE constraint**: (form_element_id, property_definition_id)

#### `form_element_options`

Choices for select/radio/checkbox_group elements. Fully relational, not JSON.

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | Auto-increment |
| form_element_id | INTEGER FK | References `form_elements.id` ON DELETE CASCADE |
| label | TEXT NOT NULL | Display label |
| value | TEXT NOT NULL | Stored value |
| display_order | INTEGER NOT NULL | Sort order |

#### `form_element_conditions`

Condition groups: "When these rules are met, do this action on this element."

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | Auto-increment |
| form_element_id | INTEGER FK | References `form_elements.id` ON DELETE CASCADE (target element) |
| action_type_id | INTEGER FK | References `condition_action_types.id` |
| action_value | TEXT NULL | For `set_value` action: the value to set. NULL for others. |
| logic_operator | TEXT NOT NULL DEFAULT 'AND' | How rules within this group combine: `AND` or `OR` |
| display_order | INTEGER NOT NULL | Sort order of condition groups on this element |

#### `form_element_condition_rules`

Individual rules within a condition group.

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | Auto-increment |
| condition_id | INTEGER FK | References `form_element_conditions.id` ON DELETE CASCADE |
| source_element_id | INTEGER FK | References `form_elements.id` (which field to check) |
| operator_id | INTEGER FK | References `condition_operators.id` |
| value | TEXT | The value to compare against. NULL for is_empty/is_not_empty. |
| display_order | INTEGER NOT NULL | Sort order within the condition group |

### Layer 3: Runtime (3 tables) — What Users DO with Forms

#### `sub_apps`

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | Auto-increment |
| name | TEXT NOT NULL | |
| description | TEXT DEFAULT '' | |
| form_id | INTEGER FK | References `forms.id` |
| created_at | TEXT DEFAULT CURRENT_TIMESTAMP | |
| updated_at | TEXT DEFAULT CURRENT_TIMESTAMP | |

#### `submissions`

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | Auto-increment |
| sub_app_id | INTEGER FK | References `sub_apps.id` |
| form_version_id | INTEGER FK | References `form_versions.id` (pinned at submission time) |
| user_id | TEXT NOT NULL | Simple identifier (no auth in POC) |
| status | TEXT NOT NULL DEFAULT 'submitted' | draft/submitted/pending/approved/rejected |
| created_at | TEXT DEFAULT CURRENT_TIMESTAMP | |
| updated_at | TEXT DEFAULT CURRENT_TIMESTAMP | |

No more `data` JSON column.

#### `submission_values`

Each field answer is its own row.

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | Auto-increment |
| submission_id | INTEGER FK | References `submissions.id` ON DELETE CASCADE |
| form_element_id | INTEGER FK | References `form_elements.id` |
| value | TEXT | The submitted value |

Layout and content elements have no submission values — only input elements.

## Element Types — Full Catalog

### Basic Input (8)
| Name | Label | Layout | Properties |
|------|-------|--------|------------|
| textfield | Text Field | No | label*, placeholder, description, default_value, required, min_length, max_length, pattern, custom_error, hidden, disabled, css_class |
| textarea | Text Area | No | label*, placeholder, description, default_value, required, min_length, max_length, rows, custom_error, hidden, disabled, css_class |
| number | Number | No | label*, placeholder, description, default_value, required, min_value, max_value, custom_error, hidden, disabled, css_class |
| email | Email | No | label*, placeholder, description, default_value, required, pattern, custom_error, hidden, disabled, css_class |
| phone | Phone | No | label*, placeholder, description, default_value, required, pattern, custom_error, hidden, disabled, css_class |
| date | Date | No | label*, description, default_value, required, custom_error, hidden, disabled, css_class |
| time | Time | No | label*, description, default_value, required, custom_error, hidden, disabled, css_class |
| datetime | Date & Time | No | label*, description, default_value, required, custom_error, hidden, disabled, css_class |

### Selection (5)
| Name | Label | Layout | Properties |
|------|-------|--------|------------|
| select | Dropdown | No | label*, placeholder, description, default_value, required, multiple, custom_error, hidden, disabled, css_class + **options** |
| radio | Radio Group | No | label*, description, default_value, required, custom_error, hidden, disabled, css_class + **options** |
| checkbox | Checkbox | No | label*, description, default_value, required, custom_error, hidden, disabled, css_class |
| checkbox_group | Checkbox Group | No | label*, description, required, custom_error, hidden, disabled, css_class + **options** |
| toggle | Toggle/Switch | No | label*, description, default_value, hidden, disabled, css_class |

### Layout (3)
| Name | Label | Layout | Properties |
|------|-------|--------|------------|
| row | Row | Yes | columns*, css_class |
| section | Section | Yes | label*, description, css_class |
| data_table | Data Table | Yes | label*, min_rows, css_class. Child elements define table columns. Users add/remove rows at fill-time. Submission data stored as JSON array in `submission_values`. See `2026-04-17-data-table-design.md` for full spec. |

### Content (3)
| Name | Label | Layout | Properties |
|------|-------|--------|------------|
| heading | Heading | No | label* (the heading text), css_class |
| subheading | Sub Heading | No | label* (the text), css_class |
| text | Text | No | description* (the text content), css_class |

### Advanced (1)
| Name | Label | Layout | Properties |
|------|-------|--------|------------|
| file_upload | File Upload | No | label*, description, required, multiple, custom_error, hidden, disabled, css_class |

## Form Builder UI

### Three-Panel Layout
- **Left sidebar** (~250px): Element palette from DB, grouped by category. Draggable chips. Collapsible categories.
- **Center canvas** (fluid): Form being built. Elements as editable blocks with hover toolbar (drag handle, duplicate, delete). Selected element has blue highlight. Drop zones appear during drag.
- **Right sidebar** (~300px): Property editor for selected element. Sections from `property_groups`. Options editor for select/radio/checkbox_group. Conditions section with inline rule builder.

### Drag and Drop (HTML5 native, no library)
- Drag from palette to canvas: creates new element
- Drag within canvas: reorders (updates position)
- Drag into layout container: nests (sets parent_id)
- Row auto-scaffolds N empty column drop zones when dropped (based on columns property, default 2)
- Elements can be dragged out of containers back to root
- Visual indicators: drop zone highlights, insertion lines, container highlights

### Right Sidebar — Property Editor
- Dynamic: loads properties for the selected element's type from `GET /api/registry/element-types/:id/properties`
- Renders appropriate input for each property based on `input_type`: text, textarea, number, checkbox, select
- Groups properties by `property_groups` with collapsible sections
- Shows required indicator on properties where `element_type_properties.is_required = true`
- Changes are tracked in builder state, saved on form save

### Right Sidebar — Options Editor (for select/radio/checkbox_group)
- List of label + value rows
- Add/remove buttons
- Drag to reorder
- Value auto-generated from label (editable)

### Right Sidebar — Conditions (inline rule builder)
- Section at bottom of property editor: "Conditions"
- Each condition group: action dropdown (Show, Hide, Make Required, etc.) + rule rows
- Each rule row: [source field dropdown] [operator dropdown] [value input] with +/- buttons
- AND/OR toggle between rules within a group
- Add condition group button
- Visual: compact, each rule is a single row

### Top Bar
- Editable form name
- Save button
- Preview toggle
- Undo/Redo

## Form Renderer

### Structure
- Receives form structure from API (elements tree + values + options + conditions)
- Builds component tree from flat list using parent_id
- Each element type has a corresponding renderer component
- Layout elements render children in appropriate layout
- Content elements render static HTML (not collected in submission)

### Conditional Logic Engine (client-side)
- Evaluates on every field value change
- For each condition group referencing the changed source field:
  - Evaluate all rules against current values
  - Combine with logic_operator (AND/OR)
  - Apply action to target element (show/hide/require/unrequire/set_value/disable/enable)
- Evaluation order: by display_order. Conflicting actions on same element: last wins.
- Circular dependency: builder warns at configuration time

### Server-Side Validation
- On submission POST, server loads form version structure + conditions
- Re-evaluates conditions against submitted values to determine visible/required fields
- Validates only visible fields against their property definitions
- Returns structured errors: `{ element_key: "error message" }`

## Form Copy & Versioning

### Form Copy
- Available at form creation ("Copy from existing" option) and as "Duplicate" action on form list
- Deep copies latest version: all form_elements, form_element_values, form_element_options, form_element_conditions, form_element_condition_rules
- New form entity with version 1, fully independent from source

### Form Versioning
- Every save creates a new version
- New version = deep copy current + apply changes, all in one transaction
- Submissions pinned to form_version_id — always reconstructable
- Version history page: list of versions with timestamps, click to preview read-only

## API Endpoints

### Registry (read-only)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/registry/element-types` | All types grouped by category (left sidebar) |
| GET | `/api/registry/element-types/:id/properties` | Properties for a type (right sidebar) |
| GET | `/api/registry/condition-actions` | Condition action types |
| GET | `/api/registry/condition-operators` | Condition operators |

### Forms
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/forms` | List all forms |
| POST | `/api/forms` | Create form (blank or copy from source_form_id) |
| GET | `/api/forms/:id` | Get form with current version structure |
| PUT | `/api/forms/:id` | Save form (creates new version) |
| POST | `/api/forms/:id/duplicate` | Duplicate as new form |
| GET | `/api/forms/:id/versions` | List versions |
| GET | `/api/forms/:id/versions/:versionId` | Get specific version structure |

### Sub-Apps & Submissions
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/sub-apps` | List sub-apps |
| POST | `/api/sub-apps` | Create sub-app |
| GET | `/api/sub-apps/:id` | Get sub-app with form structure |
| PUT | `/api/sub-apps/:id` | Update sub-app |
| GET | `/api/sub-apps/:subAppId/submissions` | List submissions |
| POST | `/api/sub-apps/:subAppId/submissions` | Create submission (server validates) |
| GET | `/api/submissions/:id` | Get submission with form structure |

### Form Save Payload (PUT /api/forms/:id)
```json
{
  "name": "Employee Onboarding",
  "description": "New hire intake form",
  "elements": [
    {
      "element_type_id": 8,
      "element_key": "name_row",
      "position": 0,
      "parent_key": null,
      "values": { "columns": "2" },
      "options": [],
      "conditions": []
    },
    {
      "element_type_id": 1,
      "element_key": "first_name",
      "position": 0,
      "parent_key": "name_row",
      "values": { "label": "First Name", "placeholder": "Enter first name", "required": "true", "max_length": "100" },
      "options": [],
      "conditions": []
    },
    {
      "element_type_id": 5,
      "element_key": "department",
      "position": 1,
      "parent_key": null,
      "values": { "label": "Department", "placeholder": "Select department...", "required": "true" },
      "options": [
        { "label": "Human Resources", "value": "hr", "display_order": 0 },
        { "label": "Engineering", "value": "eng", "display_order": 1 }
      ],
      "conditions": []
    },
    {
      "element_type_id": 1,
      "element_key": "tech_stack",
      "position": 2,
      "parent_key": null,
      "values": { "label": "Tech Stack", "placeholder": "e.g., React, Node.js" },
      "options": [],
      "conditions": [
        {
          "action": "show",
          "action_value": null,
          "logic_operator": "AND",
          "rules": [
            { "source_key": "department", "operator": "equals", "value": "eng" }
          ]
        },
        {
          "action": "require",
          "action_value": null,
          "logic_operator": "AND",
          "rules": [
            { "source_key": "department", "operator": "equals", "value": "eng" }
          ]
        }
      ]
    }
  ]
}
```

## Form.io Isolation

- Move Form.io-dependent components to `client/src/components/formio/`:
  - `FormPreview.jsx`
  - Form.io FormBuilder integration from `FormBuilder.jsx`
  - Form.io renderer toggle from `CreateRequest.jsx`
- Remove `formiojs` CSS import from `main.jsx`
- Remove all Form.io toggle switches from active UI
- Keep `formiojs` and `@formio/react` in `package.json`
- No active code path imports from `formio/` directory

## Implementation Phases (Approach B — Layered Incremental)

### Phase 1 — DB + Registry + Isolation
- New `schema.sql` with all 17 tables
- Seed script for all registry data
- Registry API endpoints (`/api/registry/*`)
- Move Form.io components to `formio/` directory
- Remove Form.io from active UI paths
- Existing sub-apps/submissions still work on old schema during transition

### Phase 2 — Form Builder Core
- Left sidebar reading from registry API
- Canvas with HTML5 drag-and-drop (flat list, no nesting)
- Right sidebar property editor reading from registry API
- Save/load forms to new schema
- Basic types only: textfield, textarea, number, email
- Replace old SimpleBuilder in routing

### Phase 3 — Complete Elements + Layout
- All remaining element types
- Options editor in right sidebar
- Layout elements: Row (auto-scaffold columns), Section
- Data Table with headings and rows
- Content elements: Heading, Subheading, Text
- Nested drag-and-drop (into/out of layout containers)

### Phase 4 — Conditional Logic
- Condition builder UI in right sidebar
- Condition evaluation engine in renderer
- Server-side condition evaluation for submission validation
- Circular dependency detection in builder

### Phase 5 — Polish & Completion
- Form copy/duplicate feature
- Version history with new schema
- Submission viewer rebuilt for relational data
- FormRenderer updated for all types + conditions
- Undo/redo in builder
- UI/UX polish

## Change Log

### 2026-04-17
- **Bug fix**: `POST /api/forms` was not saving elements — extracted `saveVersionElements` helper, used by both POST and PUT handlers.
- **Bug fix**: `loadVersionElements` API response included `parent_id` (integer FK) but not `parent_key` (string element key). Added `parent_key` resolution so both the form builder and renderer can filter by parent correctly.
- **Design update**: `data_table` element redesigned — see `2026-04-17-data-table-design.md`. Replaced unused `columns`/`rows` properties with `min_rows`. Child elements now define columns; submission data stored as JSON array.
