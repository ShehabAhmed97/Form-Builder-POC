# Phase 1: Database Schema, Registry & Form.io Isolation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 4-table JSON-blob schema with a 17-table fully normalized schema, seed all registry data, expose registry API endpoints, and isolate Form.io code from active UI paths.

**Architecture:** The database is restructured into 3 layers: Registry (7 tables defining what element types/properties exist), Form Structure (7 tables storing how forms are composed), and Runtime (3 tables for sub-apps/submissions). Registry data is seeded on DB initialization. Existing form/submission routes are adapted to not crash but won't fully function until Phase 2 rebuilds them. Form.io components are moved to an isolated `formio/` directory.

**Tech Stack:** Node.js + Express, SQLite via `node:sqlite` (built-in `DatabaseSync`), React 18 + Vite, Vitest + Supertest for testing.

**Spec:** `docs/superpowers/specs/2026-04-16-form-builder-redesign-design.md`

**Phases overview:** This plan covers Phase 1 only. Phases 2-5 will be planned separately after Phase 1 is validated.
- Phase 1: DB + Registry + Form.io isolation (this plan)
- Phase 2: Form Builder Core (DnD, sidebars, basic types)
- Phase 3: Complete Elements + Layout nesting
- Phase 4: Conditional Logic
- Phase 5: Polish & Completion

---

## File Structure

### Files to Create
- `server/db/schema.sql` — full 17-table schema (replaces old 4-table schema)
- `server/db/seed.js` — registry seed data (categories, types, properties, junction, conditions)
- `server/routes/registry.js` — read-only registry API endpoints
- `server/tests/registry.test.js` — tests for registry API
- `client/src/components/formio/FormioBuilder.jsx` — extracted Form.io builder component
- `client/src/components/formio/FormioRenderer.jsx` — extracted Form.io renderer component

### Files to Move
- `client/src/components/FormPreview.jsx` → `client/src/components/formio/FormPreview.jsx`

### Files to Modify
- `server/db/database.js` — add seed execution after schema init
- `server/app.js` — mount registry routes, remove old form/submission routes temporarily
- `server/routes/forms.js` — adapt to new schema (no schema JSON column)
- `server/routes/submissions.js` — adapt to new schema (no data JSON column)
- `client/src/main.jsx` — remove Form.io CSS import
- `client/src/pages/admin/FormBuilder.jsx` — remove Form.io toggle, keep only SimpleBuilder
- `client/src/pages/user/CreateRequest.jsx` — remove Form.io toggle, keep only FormRenderer

### Files to Delete
- `server/tests/forms.test.js` — will be rewritten in Phase 2
- `server/tests/submissions.test.js` — will be rewritten in Phase 2

---

## Task 1: New Database Schema

**Files:**
- Replace: `server/db/schema.sql`

- [ ] **Step 1: Write the new 17-table schema**

Replace the entire contents of `server/db/schema.sql` with:

```sql
-- ============================================================
-- LAYER 1: REGISTRY — What CAN exist (seeded, rarely changes)
-- ============================================================

CREATE TABLE IF NOT EXISTS element_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  icon TEXT,
  display_order INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS element_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL REFERENCES element_categories(id),
  name TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  icon TEXT,
  is_layout INTEGER NOT NULL DEFAULT 0,
  display_order INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS property_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  display_order INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS property_definitions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  property_group_id INTEGER NOT NULL REFERENCES property_groups(id),
  name TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  data_type TEXT NOT NULL,
  input_type TEXT NOT NULL,
  description TEXT DEFAULT '',
  default_value TEXT
);

CREATE TABLE IF NOT EXISTS element_type_properties (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  element_type_id INTEGER NOT NULL REFERENCES element_types(id),
  property_definition_id INTEGER NOT NULL REFERENCES property_definitions(id),
  is_required INTEGER NOT NULL DEFAULT 0,
  display_order INTEGER NOT NULL,
  override_default TEXT,
  UNIQUE(element_type_id, property_definition_id)
);

CREATE TABLE IF NOT EXISTS condition_action_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  display_order INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS condition_operators (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  display_order INTEGER NOT NULL
);

-- ============================================================
-- LAYER 2: FORM STRUCTURE — What DOES exist in a form
-- ============================================================

CREATE TABLE IF NOT EXISTS forms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  current_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS form_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  form_id INTEGER NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  version_num INTEGER NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(form_id, version_num)
);

CREATE TABLE IF NOT EXISTS form_elements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  form_version_id INTEGER NOT NULL REFERENCES form_versions(id) ON DELETE CASCADE,
  element_type_id INTEGER NOT NULL REFERENCES element_types(id),
  element_key TEXT NOT NULL,
  position INTEGER NOT NULL,
  parent_id INTEGER REFERENCES form_elements(id),
  UNIQUE(form_version_id, element_key)
);

CREATE TABLE IF NOT EXISTS form_element_values (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  form_element_id INTEGER NOT NULL REFERENCES form_elements(id) ON DELETE CASCADE,
  property_definition_id INTEGER NOT NULL REFERENCES property_definitions(id),
  value TEXT,
  UNIQUE(form_element_id, property_definition_id)
);

CREATE TABLE IF NOT EXISTS form_element_options (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  form_element_id INTEGER NOT NULL REFERENCES form_elements(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  value TEXT NOT NULL,
  display_order INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS form_element_conditions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  form_element_id INTEGER NOT NULL REFERENCES form_elements(id) ON DELETE CASCADE,
  action_type_id INTEGER NOT NULL REFERENCES condition_action_types(id),
  action_value TEXT,
  logic_operator TEXT NOT NULL DEFAULT 'AND',
  display_order INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS form_element_condition_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  condition_id INTEGER NOT NULL REFERENCES form_element_conditions(id) ON DELETE CASCADE,
  source_element_id INTEGER NOT NULL REFERENCES form_elements(id),
  operator_id INTEGER NOT NULL REFERENCES condition_operators(id),
  value TEXT,
  display_order INTEGER NOT NULL
);

-- ============================================================
-- LAYER 3: RUNTIME — What users DO with forms
-- ============================================================

CREATE TABLE IF NOT EXISTS sub_apps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  form_id INTEGER NOT NULL REFERENCES forms(id),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sub_app_id INTEGER NOT NULL REFERENCES sub_apps(id),
  form_version_id INTEGER NOT NULL REFERENCES form_versions(id),
  user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'submitted',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS submission_values (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  form_element_id INTEGER NOT NULL REFERENCES form_elements(id),
  value TEXT
);
```

- [ ] **Step 2: Delete the old database file so it gets recreated**

```bash
rm -f server/poc.db server/poc.db-shm server/poc.db-wal
```

- [ ] **Step 3: Verify schema creates without errors**

Start the server briefly to confirm:

```bash
cd server && node -e "import('./db/database.js').then(m => { m.getDb(); console.log('Schema OK'); })"
```

Expected: `Schema OK` printed, no errors.

- [ ] **Step 4: Commit**

```bash
git add server/db/schema.sql
git commit -m "feat: replace 4-table schema with 17-table normalized schema

Three-layer design: Registry (7), Form Structure (7), Runtime (3).
Registry tables store element type definitions, property definitions,
condition operators/actions. Form structure tables use relational
elements instead of JSON blobs. Submission values are individual rows."
```

---

## Task 2: Registry Seed Script

**Files:**
- Create: `server/db/seed.js`

This is the largest single file in Phase 1. It seeds all registry data: 5 categories, 20 element types, 4 property groups, 17 property definitions, ~139 element-type-property junction rows, 7 condition action types, and 8 condition operators.

- [ ] **Step 1: Create the seed script**

Create `server/db/seed.js`:

```js
// Registry seed data — the single source of truth for what element types,
// properties, and conditions the form builder supports.
//
// Called once during DB initialization. Uses INSERT OR IGNORE so it's
// safe to call multiple times (idempotent).

export function seedRegistry(db) {
  // ── Element Categories ──
  const categories = [
    { name: 'basic_input', label: 'Basic Input', icon: 'type', display_order: 1 },
    { name: 'selection', label: 'Selection', icon: 'list', display_order: 2 },
    { name: 'layout', label: 'Layout', icon: 'grid_view', display_order: 3 },
    { name: 'content', label: 'Content', icon: 'text_fields', display_order: 4 },
    { name: 'advanced', label: 'Advanced', icon: 'tune', display_order: 5 },
  ];

  const insertCategory = db.prepare(
    'INSERT OR IGNORE INTO element_categories (name, label, icon, display_order) VALUES (?, ?, ?, ?)'
  );
  for (const c of categories) {
    insertCategory.run(c.name, c.label, c.icon, c.display_order);
  }

  // Helper: get category ID by name
  const getCatId = (name) =>
    db.prepare('SELECT id FROM element_categories WHERE name = ?').get(name).id;

  // ── Element Types ──
  const types = [
    // Basic Input
    { category: 'basic_input', name: 'textfield', label: 'Text Field', icon: 'text_fields', is_layout: 0, display_order: 1 },
    { category: 'basic_input', name: 'textarea', label: 'Text Area', icon: 'notes', is_layout: 0, display_order: 2 },
    { category: 'basic_input', name: 'number', label: 'Number', icon: 'pin', is_layout: 0, display_order: 3 },
    { category: 'basic_input', name: 'email', label: 'Email', icon: 'mail', is_layout: 0, display_order: 4 },
    { category: 'basic_input', name: 'phone', label: 'Phone', icon: 'phone', is_layout: 0, display_order: 5 },
    { category: 'basic_input', name: 'date', label: 'Date', icon: 'calendar_today', is_layout: 0, display_order: 6 },
    { category: 'basic_input', name: 'time', label: 'Time', icon: 'schedule', is_layout: 0, display_order: 7 },
    { category: 'basic_input', name: 'datetime', label: 'Date & Time', icon: 'event', is_layout: 0, display_order: 8 },
    // Selection
    { category: 'selection', name: 'select', label: 'Dropdown', icon: 'arrow_drop_down', is_layout: 0, display_order: 1 },
    { category: 'selection', name: 'radio', label: 'Radio Group', icon: 'radio_button_checked', is_layout: 0, display_order: 2 },
    { category: 'selection', name: 'checkbox', label: 'Checkbox', icon: 'check_box', is_layout: 0, display_order: 3 },
    { category: 'selection', name: 'checkbox_group', label: 'Checkbox Group', icon: 'checklist', is_layout: 0, display_order: 4 },
    { category: 'selection', name: 'toggle', label: 'Toggle/Switch', icon: 'toggle_on', is_layout: 0, display_order: 5 },
    // Layout
    { category: 'layout', name: 'row', label: 'Row', icon: 'view_column', is_layout: 1, display_order: 1 },
    { category: 'layout', name: 'section', label: 'Section', icon: 'folder', is_layout: 1, display_order: 2 },
    { category: 'layout', name: 'data_table', label: 'Data Table', icon: 'table_chart', is_layout: 1, display_order: 3 },
    // Content
    { category: 'content', name: 'heading', label: 'Heading', icon: 'title', is_layout: 0, display_order: 1 },
    { category: 'content', name: 'subheading', label: 'Sub Heading', icon: 'text_fields', is_layout: 0, display_order: 2 },
    { category: 'content', name: 'text', label: 'Text', icon: 'notes', is_layout: 0, display_order: 3 },
    // Advanced
    { category: 'advanced', name: 'file_upload', label: 'File Upload', icon: 'upload_file', is_layout: 0, display_order: 1 },
  ];

  const insertType = db.prepare(
    'INSERT OR IGNORE INTO element_types (category_id, name, label, icon, is_layout, display_order) VALUES (?, ?, ?, ?, ?, ?)'
  );
  for (const t of types) {
    insertType.run(getCatId(t.category), t.name, t.label, t.icon, t.is_layout, t.display_order);
  }

  // Helper: get type ID by name
  const getTypeId = (name) =>
    db.prepare('SELECT id FROM element_types WHERE name = ?').get(name).id;

  // ── Property Groups ──
  const groups = [
    { name: 'general', label: 'General', display_order: 1 },
    { name: 'validation', label: 'Validation', display_order: 2 },
    { name: 'display', label: 'Display', display_order: 3 },
    { name: 'data', label: 'Data', display_order: 4 },
  ];

  const insertGroup = db.prepare(
    'INSERT OR IGNORE INTO property_groups (name, label, display_order) VALUES (?, ?, ?)'
  );
  for (const g of groups) {
    insertGroup.run(g.name, g.label, g.display_order);
  }

  const getGroupId = (name) =>
    db.prepare('SELECT id FROM property_groups WHERE name = ?').get(name).id;

  // ── Property Definitions ──
  const props = [
    // General
    { group: 'general', name: 'label', label: 'Label', data_type: 'string', input_type: 'text', description: 'Display label for the field', default_value: null },
    { group: 'general', name: 'placeholder', label: 'Placeholder', data_type: 'string', input_type: 'text', description: 'Placeholder text shown when empty', default_value: null },
    { group: 'general', name: 'description', label: 'Help Text', data_type: 'string', input_type: 'textarea', description: 'Helper text shown below the field', default_value: null },
    { group: 'general', name: 'default_value', label: 'Default Value', data_type: 'string', input_type: 'text', description: 'Initial value when form loads', default_value: null },
    // Validation
    { group: 'validation', name: 'required', label: 'Required', data_type: 'boolean', input_type: 'checkbox', description: 'Whether this field must be filled', default_value: 'false' },
    { group: 'validation', name: 'min_length', label: 'Min Length', data_type: 'number', input_type: 'number', description: 'Minimum character length', default_value: null },
    { group: 'validation', name: 'max_length', label: 'Max Length', data_type: 'number', input_type: 'number', description: 'Maximum character length', default_value: null },
    { group: 'validation', name: 'min_value', label: 'Min Value', data_type: 'number', input_type: 'number', description: 'Minimum numeric value', default_value: null },
    { group: 'validation', name: 'max_value', label: 'Max Value', data_type: 'number', input_type: 'number', description: 'Maximum numeric value', default_value: null },
    { group: 'validation', name: 'pattern', label: 'Regex Pattern', data_type: 'string', input_type: 'text', description: 'Regular expression for validation', default_value: null },
    { group: 'validation', name: 'custom_error', label: 'Custom Error Message', data_type: 'string', input_type: 'text', description: 'Error message shown when validation fails', default_value: null },
    // Display
    { group: 'display', name: 'hidden', label: 'Hidden', data_type: 'boolean', input_type: 'checkbox', description: 'Hide this field from the form', default_value: 'false' },
    { group: 'display', name: 'disabled', label: 'Disabled', data_type: 'boolean', input_type: 'checkbox', description: 'Make this field read-only', default_value: 'false' },
    { group: 'display', name: 'css_class', label: 'CSS Class', data_type: 'string', input_type: 'text', description: 'Custom CSS class name', default_value: null },
    { group: 'display', name: 'rows', label: 'Rows', data_type: 'number', input_type: 'number', description: 'Number of visible text rows', default_value: '3' },
    { group: 'display', name: 'columns', label: 'Columns', data_type: 'number', input_type: 'number', description: 'Number of columns', default_value: '2' },
    // Data
    { group: 'data', name: 'multiple', label: 'Allow Multiple', data_type: 'boolean', input_type: 'checkbox', description: 'Allow selecting multiple values', default_value: 'false' },
  ];

  const insertProp = db.prepare(
    'INSERT OR IGNORE INTO property_definitions (property_group_id, name, label, data_type, input_type, description, default_value) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  for (const p of props) {
    insertProp.run(getGroupId(p.group), p.name, p.label, p.data_type, p.input_type, p.description, p.default_value);
  }

  const getPropId = (name) =>
    db.prepare('SELECT id FROM property_definitions WHERE name = ?').get(name).id;

  // ── Element Type Properties (junction table) ──
  // Maps which properties each element type supports.
  // Format: [typeName, propName, isRequired, displayOrder, overrideDefault]

  const typeProps = [
    // textfield (12 props)
    ['textfield', 'label', 1, 1, null],
    ['textfield', 'placeholder', 0, 2, null],
    ['textfield', 'description', 0, 3, null],
    ['textfield', 'default_value', 0, 4, null],
    ['textfield', 'required', 0, 5, null],
    ['textfield', 'min_length', 0, 6, null],
    ['textfield', 'max_length', 0, 7, null],
    ['textfield', 'pattern', 0, 8, null],
    ['textfield', 'custom_error', 0, 9, null],
    ['textfield', 'hidden', 0, 10, null],
    ['textfield', 'disabled', 0, 11, null],
    ['textfield', 'css_class', 0, 12, null],

    // textarea (12 props)
    ['textarea', 'label', 1, 1, null],
    ['textarea', 'placeholder', 0, 2, null],
    ['textarea', 'description', 0, 3, null],
    ['textarea', 'default_value', 0, 4, null],
    ['textarea', 'required', 0, 5, null],
    ['textarea', 'min_length', 0, 6, null],
    ['textarea', 'max_length', 0, 7, null],
    ['textarea', 'rows', 0, 8, null],
    ['textarea', 'custom_error', 0, 9, null],
    ['textarea', 'hidden', 0, 10, null],
    ['textarea', 'disabled', 0, 11, null],
    ['textarea', 'css_class', 0, 12, null],

    // number (11 props)
    ['number', 'label', 1, 1, null],
    ['number', 'placeholder', 0, 2, null],
    ['number', 'description', 0, 3, null],
    ['number', 'default_value', 0, 4, null],
    ['number', 'required', 0, 5, null],
    ['number', 'min_value', 0, 6, null],
    ['number', 'max_value', 0, 7, null],
    ['number', 'custom_error', 0, 8, null],
    ['number', 'hidden', 0, 9, null],
    ['number', 'disabled', 0, 10, null],
    ['number', 'css_class', 0, 11, null],

    // email (10 props)
    ['email', 'label', 1, 1, null],
    ['email', 'placeholder', 0, 2, null],
    ['email', 'description', 0, 3, null],
    ['email', 'default_value', 0, 4, null],
    ['email', 'required', 0, 5, null],
    ['email', 'pattern', 0, 6, null],
    ['email', 'custom_error', 0, 7, null],
    ['email', 'hidden', 0, 8, null],
    ['email', 'disabled', 0, 9, null],
    ['email', 'css_class', 0, 10, null],

    // phone (10 props)
    ['phone', 'label', 1, 1, null],
    ['phone', 'placeholder', 0, 2, null],
    ['phone', 'description', 0, 3, null],
    ['phone', 'default_value', 0, 4, null],
    ['phone', 'required', 0, 5, null],
    ['phone', 'pattern', 0, 6, null],
    ['phone', 'custom_error', 0, 7, null],
    ['phone', 'hidden', 0, 8, null],
    ['phone', 'disabled', 0, 9, null],
    ['phone', 'css_class', 0, 10, null],

    // date (8 props)
    ['date', 'label', 1, 1, null],
    ['date', 'description', 0, 2, null],
    ['date', 'default_value', 0, 3, null],
    ['date', 'required', 0, 4, null],
    ['date', 'custom_error', 0, 5, null],
    ['date', 'hidden', 0, 6, null],
    ['date', 'disabled', 0, 7, null],
    ['date', 'css_class', 0, 8, null],

    // time (8 props)
    ['time', 'label', 1, 1, null],
    ['time', 'description', 0, 2, null],
    ['time', 'default_value', 0, 3, null],
    ['time', 'required', 0, 4, null],
    ['time', 'custom_error', 0, 5, null],
    ['time', 'hidden', 0, 6, null],
    ['time', 'disabled', 0, 7, null],
    ['time', 'css_class', 0, 8, null],

    // datetime (8 props)
    ['datetime', 'label', 1, 1, null],
    ['datetime', 'description', 0, 2, null],
    ['datetime', 'default_value', 0, 3, null],
    ['datetime', 'required', 0, 4, null],
    ['datetime', 'custom_error', 0, 5, null],
    ['datetime', 'hidden', 0, 6, null],
    ['datetime', 'disabled', 0, 7, null],
    ['datetime', 'css_class', 0, 8, null],

    // select (10 props — options are separate via form_element_options)
    ['select', 'label', 1, 1, null],
    ['select', 'placeholder', 0, 2, 'Select...'],
    ['select', 'description', 0, 3, null],
    ['select', 'default_value', 0, 4, null],
    ['select', 'required', 0, 5, null],
    ['select', 'multiple', 0, 6, null],
    ['select', 'custom_error', 0, 7, null],
    ['select', 'hidden', 0, 8, null],
    ['select', 'disabled', 0, 9, null],
    ['select', 'css_class', 0, 10, null],

    // radio (8 props)
    ['radio', 'label', 1, 1, null],
    ['radio', 'description', 0, 2, null],
    ['radio', 'default_value', 0, 3, null],
    ['radio', 'required', 0, 4, null],
    ['radio', 'custom_error', 0, 5, null],
    ['radio', 'hidden', 0, 6, null],
    ['radio', 'disabled', 0, 7, null],
    ['radio', 'css_class', 0, 8, null],

    // checkbox (8 props)
    ['checkbox', 'label', 1, 1, null],
    ['checkbox', 'description', 0, 2, null],
    ['checkbox', 'default_value', 0, 3, null],
    ['checkbox', 'required', 0, 4, null],
    ['checkbox', 'custom_error', 0, 5, null],
    ['checkbox', 'hidden', 0, 6, null],
    ['checkbox', 'disabled', 0, 7, null],
    ['checkbox', 'css_class', 0, 8, null],

    // checkbox_group (7 props)
    ['checkbox_group', 'label', 1, 1, null],
    ['checkbox_group', 'description', 0, 2, null],
    ['checkbox_group', 'required', 0, 3, null],
    ['checkbox_group', 'custom_error', 0, 4, null],
    ['checkbox_group', 'hidden', 0, 5, null],
    ['checkbox_group', 'disabled', 0, 6, null],
    ['checkbox_group', 'css_class', 0, 7, null],

    // toggle (6 props)
    ['toggle', 'label', 1, 1, null],
    ['toggle', 'description', 0, 2, null],
    ['toggle', 'default_value', 0, 3, null],
    ['toggle', 'hidden', 0, 4, null],
    ['toggle', 'disabled', 0, 5, null],
    ['toggle', 'css_class', 0, 6, null],

    // row (2 props)
    ['row', 'columns', 1, 1, '2'],
    ['row', 'css_class', 0, 2, null],

    // section (3 props)
    ['section', 'label', 1, 1, null],
    ['section', 'description', 0, 2, null],
    ['section', 'css_class', 0, 3, null],

    // data_table (4 props)
    ['data_table', 'label', 1, 1, null],
    ['data_table', 'columns', 1, 2, '2'],
    ['data_table', 'rows', 0, 3, '3'],
    ['data_table', 'css_class', 0, 4, null],

    // heading (2 props)
    ['heading', 'label', 1, 1, null],
    ['heading', 'css_class', 0, 2, null],

    // subheading (2 props)
    ['subheading', 'label', 1, 1, null],
    ['subheading', 'css_class', 0, 2, null],

    // text (2 props — uses description as the text content)
    ['text', 'description', 1, 1, null],
    ['text', 'css_class', 0, 2, null],

    // file_upload (8 props)
    ['file_upload', 'label', 1, 1, null],
    ['file_upload', 'description', 0, 2, null],
    ['file_upload', 'required', 0, 3, null],
    ['file_upload', 'multiple', 0, 4, null],
    ['file_upload', 'custom_error', 0, 5, null],
    ['file_upload', 'hidden', 0, 6, null],
    ['file_upload', 'disabled', 0, 7, null],
    ['file_upload', 'css_class', 0, 8, null],
  ];

  const insertTypeProp = db.prepare(
    'INSERT OR IGNORE INTO element_type_properties (element_type_id, property_definition_id, is_required, display_order, override_default) VALUES (?, ?, ?, ?, ?)'
  );
  for (const [typeName, propName, isReq, order, override] of typeProps) {
    insertTypeProp.run(getTypeId(typeName), getPropId(propName), isReq, order, override);
  }

  // ── Condition Action Types ──
  const actions = [
    { name: 'show', label: 'Show', display_order: 1 },
    { name: 'hide', label: 'Hide', display_order: 2 },
    { name: 'require', label: 'Make Required', display_order: 3 },
    { name: 'unrequire', label: 'Make Optional', display_order: 4 },
    { name: 'set_value', label: 'Set Value', display_order: 5 },
    { name: 'disable', label: 'Disable', display_order: 6 },
    { name: 'enable', label: 'Enable', display_order: 7 },
  ];

  const insertAction = db.prepare(
    'INSERT OR IGNORE INTO condition_action_types (name, label, display_order) VALUES (?, ?, ?)'
  );
  for (const a of actions) {
    insertAction.run(a.name, a.label, a.display_order);
  }

  // ── Condition Operators ──
  const operators = [
    { name: 'equals', label: 'Equals', display_order: 1 },
    { name: 'not_equals', label: 'Does Not Equal', display_order: 2 },
    { name: 'contains', label: 'Contains', display_order: 3 },
    { name: 'not_contains', label: 'Does Not Contain', display_order: 4 },
    { name: 'greater_than', label: 'Greater Than', display_order: 5 },
    { name: 'less_than', label: 'Less Than', display_order: 6 },
    { name: 'is_empty', label: 'Is Empty', display_order: 7 },
    { name: 'is_not_empty', label: 'Is Not Empty', display_order: 8 },
  ];

  const insertOp = db.prepare(
    'INSERT OR IGNORE INTO condition_operators (name, label, display_order) VALUES (?, ?, ?)'
  );
  for (const o of operators) {
    insertOp.run(o.name, o.label, o.display_order);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add server/db/seed.js
git commit -m "feat: add registry seed script with all element types, properties, and conditions"
```

---

## Task 3: Update Database Module

**Files:**
- Modify: `server/db/database.js`

- [ ] **Step 1: Write the failing test**

Create `server/tests/database.test.js`:

```js
import { describe, it, expect, beforeAll } from 'vitest';
import { getDb } from '../db/database.js';

describe('database initialization', () => {
  let db;

  beforeAll(() => {
    db = getDb(':memory:');
  });

  it('creates all 17 tables', () => {
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    ).all();
    const tableNames = tables.map(t => t.name);
    expect(tableNames).toEqual([
      'condition_action_types',
      'condition_operators',
      'element_categories',
      'element_type_properties',
      'element_types',
      'form_element_condition_rules',
      'form_element_conditions',
      'form_element_options',
      'form_element_values',
      'form_elements',
      'form_versions',
      'forms',
      'property_definitions',
      'property_groups',
      'sub_apps',
      'submission_values',
      'submissions',
    ]);
  });

  it('seeds element categories', () => {
    const count = db.prepare('SELECT COUNT(*) as n FROM element_categories').get().n;
    expect(count).toBe(5);
  });

  it('seeds element types', () => {
    const count = db.prepare('SELECT COUNT(*) as n FROM element_types').get().n;
    expect(count).toBe(20);
  });

  it('seeds property groups', () => {
    const count = db.prepare('SELECT COUNT(*) as n FROM property_groups').get().n;
    expect(count).toBe(4);
  });

  it('seeds property definitions', () => {
    const count = db.prepare('SELECT COUNT(*) as n FROM property_definitions').get().n;
    expect(count).toBe(17);
  });

  it('seeds element type properties junction', () => {
    const count = db.prepare('SELECT COUNT(*) as n FROM element_type_properties').get().n;
    // 12+12+11+10+10+8+8+8+10+8+8+7+6+2+3+4+2+2+2+8 = 141
    expect(count).toBe(141);
  });

  it('seeds condition action types', () => {
    const count = db.prepare('SELECT COUNT(*) as n FROM condition_action_types').get().n;
    expect(count).toBe(7);
  });

  it('seeds condition operators', () => {
    const count = db.prepare('SELECT COUNT(*) as n FROM condition_operators').get().n;
    expect(count).toBe(8);
  });

  it('textfield has 12 properties', () => {
    const count = db.prepare(`
      SELECT COUNT(*) as n FROM element_type_properties etp
      JOIN element_types et ON etp.element_type_id = et.id
      WHERE et.name = 'textfield'
    `).get().n;
    expect(count).toBe(12);
  });

  it('row has 2 properties with columns required', () => {
    const props = db.prepare(`
      SELECT pd.name, etp.is_required FROM element_type_properties etp
      JOIN element_types et ON etp.element_type_id = et.id
      JOIN property_definitions pd ON etp.property_definition_id = pd.id
      WHERE et.name = 'row'
      ORDER BY etp.display_order
    `).all();
    expect(props).toEqual([
      { name: 'columns', is_required: 1 },
      { name: 'css_class', is_required: 0 },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run tests/database.test.js`
Expected: FAIL — `getDb` doesn't accept a path argument and doesn't call `seedRegistry`.

- [ ] **Step 3: Update database.js to support in-memory DB and run seed**

Replace `server/db/database.js`:

```js
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedRegistry } from './seed.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

let db;

export function getDb(dbPath) {
  if (db) return db;

  const resolvedPath = dbPath || join(__dirname, '..', 'poc.db');
  db = new DatabaseSync(resolvedPath);

  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');

  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
  db.exec(schema);

  seedRegistry(db);

  return db;
}

// For tests: reset the singleton so each test suite gets a fresh DB
export function resetDb() {
  if (db) {
    db.close();
    db = undefined;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx vitest run tests/database.test.js`
Expected: All 9 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add server/db/database.js server/tests/database.test.js
git commit -m "feat: update database module with seed support and in-memory testing"
```

---

## Task 4: Registry Routes — Element Types

**Files:**
- Create: `server/routes/registry.js`
- Test: `server/tests/registry.test.js`

- [ ] **Step 1: Write the failing tests**

Create `server/tests/registry.test.js`:

```js
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';

describe('Registry API', () => {
  let app;

  beforeAll(() => {
    app = createApp(':memory:');
  });

  describe('GET /api/registry/element-types', () => {
    it('returns element types grouped by category', async () => {
      const res = await request(app).get('/api/registry/element-types');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(5); // 5 categories
      expect(res.body[0].name).toBe('basic_input');
      expect(res.body[0].types).toHaveLength(8);
      expect(res.body[0].types[0]).toMatchObject({
        name: 'textfield',
        label: 'Text Field',
        icon: 'text_fields',
        is_layout: 0,
      });
    });

    it('returns categories in display_order', async () => {
      const res = await request(app).get('/api/registry/element-types');
      const names = res.body.map(c => c.name);
      expect(names).toEqual(['basic_input', 'selection', 'layout', 'content', 'advanced']);
    });

    it('layout types have is_layout = 1', async () => {
      const res = await request(app).get('/api/registry/element-types');
      const layoutCat = res.body.find(c => c.name === 'layout');
      for (const t of layoutCat.types) {
        expect(t.is_layout).toBe(1);
      }
    });
  });

  describe('GET /api/registry/element-types/:id/properties', () => {
    it('returns properties for textfield grouped by property group', async () => {
      // First get the textfield ID
      const typesRes = await request(app).get('/api/registry/element-types');
      const textfieldId = typesRes.body[0].types[0].id;

      const res = await request(app).get(`/api/registry/element-types/${textfieldId}/properties`);
      expect(res.status).toBe(200);

      // Should have groups: general, validation, display
      const groupNames = res.body.map(g => g.name);
      expect(groupNames).toContain('general');
      expect(groupNames).toContain('validation');
      expect(groupNames).toContain('display');

      // General group should have label (required), placeholder, description, default_value
      const general = res.body.find(g => g.name === 'general');
      expect(general.properties[0]).toMatchObject({
        name: 'label',
        is_required: 1,
        data_type: 'string',
        input_type: 'text',
      });
    });

    it('returns 404 for non-existent type', async () => {
      const res = await request(app).get('/api/registry/element-types/9999/properties');
      expect(res.status).toBe(404);
    });

    it('row type has only columns and css_class', async () => {
      const typesRes = await request(app).get('/api/registry/element-types');
      const layoutCat = typesRes.body.find(c => c.name === 'layout');
      const rowId = layoutCat.types.find(t => t.name === 'row').id;

      const res = await request(app).get(`/api/registry/element-types/${rowId}/properties`);
      const allProps = res.body.flatMap(g => g.properties);
      expect(allProps).toHaveLength(2);
      expect(allProps.map(p => p.name)).toEqual(['columns', 'css_class']);
    });
  });

  describe('GET /api/registry/condition-actions', () => {
    it('returns all condition action types', async () => {
      const res = await request(app).get('/api/registry/condition-actions');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(7);
      expect(res.body[0]).toMatchObject({ name: 'show', label: 'Show' });
    });
  });

  describe('GET /api/registry/condition-operators', () => {
    it('returns all condition operators', async () => {
      const res = await request(app).get('/api/registry/condition-operators');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(8);
      expect(res.body[0]).toMatchObject({ name: 'equals', label: 'Equals' });
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && npx vitest run tests/registry.test.js`
Expected: FAIL — `createApp` doesn't exist yet (app.js exports `app` directly), and no registry routes.

- [ ] **Step 3: Update app.js to export a factory function**

Replace `server/app.js`:

```js
import express from 'express';
import cors from 'cors';
import { getDb } from './db/database.js';
import { createFormsRoutes } from './routes/forms.js';
import { createSubAppsRoutes } from './routes/subApps.js';
import { createSubmissionsRoutes, createSingleSubmissionRoutes } from './routes/submissions.js';
import { createRegistryRoutes } from './routes/registry.js';

export function createApp(dbPath) {
  const app = express();
  const db = getDb(dbPath);

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Registry routes (new — read-only)
  app.use('/api/registry', createRegistryRoutes(db));

  // Form routes (adapted for new schema)
  app.use('/api/forms', createFormsRoutes(db));

  // Sub-app routes
  app.use('/api/sub-apps', createSubAppsRoutes(db));

  // Submission routes
  app.use('/api/sub-apps/:subAppId/submissions', createSubmissionsRoutes(db));
  app.use('/api/submissions', createSingleSubmissionRoutes(db));

  return app;
}

// Default export for server startup (index.js)
const app = createApp();
export default app;
```

- [ ] **Step 4: Create the registry routes**

Create `server/routes/registry.js`:

```js
import { Router } from 'express';

export function createRegistryRoutes(db) {
  const router = Router();

  // GET /api/registry/element-types
  // Returns all element types grouped by category, ordered by display_order
  router.get('/element-types', (req, res) => {
    const categories = db.prepare(
      'SELECT id, name, label, icon, display_order FROM element_categories ORDER BY display_order'
    ).all();

    const types = db.prepare(
      'SELECT id, category_id, name, label, icon, is_layout, display_order FROM element_types ORDER BY display_order'
    ).all();

    const grouped = categories.map(cat => ({
      ...cat,
      types: types.filter(t => t.category_id === cat.id),
    }));

    res.json(grouped);
  });

  // GET /api/registry/element-types/:id/properties
  // Returns properties for a specific element type, grouped by property group
  router.get('/element-types/:id/properties', (req, res) => {
    const typeId = req.params.id;

    const type = db.prepare('SELECT id FROM element_types WHERE id = ?').get(typeId);
    if (!type) {
      return res.status(404).json({ error: 'Element type not found' });
    }

    const rows = db.prepare(`
      SELECT
        pg.id as group_id, pg.name as group_name, pg.label as group_label, pg.display_order as group_order,
        pd.id as prop_id, pd.name, pd.label, pd.data_type, pd.input_type, pd.description, pd.default_value,
        etp.is_required, etp.display_order, etp.override_default
      FROM element_type_properties etp
      JOIN property_definitions pd ON etp.property_definition_id = pd.id
      JOIN property_groups pg ON pd.property_group_id = pg.id
      WHERE etp.element_type_id = ?
      ORDER BY pg.display_order, etp.display_order
    `).all(typeId);

    // Group by property group
    const groupMap = new Map();
    for (const row of rows) {
      if (!groupMap.has(row.group_id)) {
        groupMap.set(row.group_id, {
          id: row.group_id,
          name: row.group_name,
          label: row.group_label,
          display_order: row.group_order,
          properties: [],
        });
      }
      groupMap.get(row.group_id).properties.push({
        id: row.prop_id,
        name: row.name,
        label: row.label,
        data_type: row.data_type,
        input_type: row.input_type,
        description: row.description,
        default_value: row.override_default ?? row.default_value,
        is_required: row.is_required,
        display_order: row.display_order,
      });
    }

    res.json([...groupMap.values()]);
  });

  // GET /api/registry/condition-actions
  router.get('/condition-actions', (req, res) => {
    const actions = db.prepare(
      'SELECT id, name, label, display_order FROM condition_action_types ORDER BY display_order'
    ).all();
    res.json(actions);
  });

  // GET /api/registry/condition-operators
  router.get('/condition-operators', (req, res) => {
    const operators = db.prepare(
      'SELECT id, name, label, display_order FROM condition_operators ORDER BY display_order'
    ).all();
    res.json(operators);
  });

  return router;
}
```

- [ ] **Step 5: Adapt existing route files to use factory pattern**

Update `server/routes/forms.js` — change to factory function and adapt queries for new schema (remove `schema` column references):

```js
import { Router } from 'express';

export function createFormsRoutes(db) {
  const router = Router();

  // GET /api/forms — list all forms
  router.get('/', (req, res) => {
    const forms = db.prepare(
      'SELECT id, name, description, current_version, created_at, updated_at FROM forms ORDER BY created_at DESC'
    ).all();
    res.json(forms);
  });

  // POST /api/forms — create new form (empty, with version 1)
  router.post('/', (req, res) => {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    db.exec('BEGIN');
    try {
      const formResult = db.prepare(
        'INSERT INTO forms (name, description) VALUES (?, ?)'
      ).run(name, description || '');

      const formId = Number(formResult.lastInsertRowid);

      db.prepare(
        'INSERT INTO form_versions (form_id, version_num) VALUES (?, 1)'
      ).run(formId);

      db.exec('COMMIT');

      const form = db.prepare('SELECT * FROM forms WHERE id = ?').get(formId);
      res.status(201).json(form);
    } catch (err) {
      db.exec('ROLLBACK');
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/forms/:id — get form metadata
  router.get('/:id', (req, res) => {
    const form = db.prepare('SELECT * FROM forms WHERE id = ?').get(req.params.id);
    if (!form) return res.status(404).json({ error: 'Form not found' });
    res.json(form);
  });

  // PUT /api/forms/:id — update form metadata (name/description only in Phase 1)
  router.put('/:id', (req, res) => {
    const form = db.prepare('SELECT * FROM forms WHERE id = ?').get(req.params.id);
    if (!form) return res.status(404).json({ error: 'Form not found' });

    const { name, description } = req.body;
    db.prepare(
      'UPDATE forms SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(name || form.name, description ?? form.description, req.params.id);

    const updated = db.prepare('SELECT * FROM forms WHERE id = ?').get(req.params.id);
    res.json(updated);
  });

  // GET /api/forms/:id/versions — list versions
  router.get('/:id/versions', (req, res) => {
    const versions = db.prepare(
      'SELECT id, form_id, version_num, created_at FROM form_versions WHERE form_id = ? ORDER BY version_num DESC'
    ).all(req.params.id);
    res.json(versions);
  });

  return router;
}
```

Update `server/routes/subApps.js` — change to factory function:

```js
import { Router } from 'express';

export function createSubAppsRoutes(db) {
  const router = Router();

  router.get('/', (req, res) => {
    const subApps = db.prepare(`
      SELECT sa.*, f.name as form_name,
        (SELECT COUNT(*) FROM submissions s WHERE s.sub_app_id = sa.id) as submission_count
      FROM sub_apps sa
      LEFT JOIN forms f ON sa.form_id = f.id
      ORDER BY sa.created_at DESC
    `).all();
    res.json(subApps);
  });

  router.post('/', (req, res) => {
    const { name, description, form_id } = req.body;
    if (!name || !form_id) return res.status(400).json({ error: 'Name and form_id are required' });

    const result = db.prepare(
      'INSERT INTO sub_apps (name, description, form_id) VALUES (?, ?, ?)'
    ).run(name, description || '', form_id);

    const subApp = db.prepare('SELECT * FROM sub_apps WHERE id = ?').get(Number(result.lastInsertRowid));
    res.status(201).json(subApp);
  });

  router.get('/:id', (req, res) => {
    const subApp = db.prepare(`
      SELECT sa.*, f.name as form_name, f.current_version as form_current_version
      FROM sub_apps sa
      LEFT JOIN forms f ON sa.form_id = f.id
      WHERE sa.id = ?
    `).get(req.params.id);

    if (!subApp) return res.status(404).json({ error: 'Sub-app not found' });
    res.json(subApp);
  });

  router.put('/:id', (req, res) => {
    const { name, description, form_id } = req.body;
    db.prepare(
      'UPDATE sub_apps SET name = ?, description = ?, form_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(name, description, form_id, req.params.id);

    const subApp = db.prepare('SELECT * FROM sub_apps WHERE id = ?').get(req.params.id);
    res.json(subApp);
  });

  return router;
}
```

Update `server/routes/submissions.js` — change to factory function, adapt for no `data` column:

```js
import { Router } from 'express';

export function createSubmissionsRoutes(db) {
  const router = Router({ mergeParams: true });

  router.get('/', (req, res) => {
    const { subAppId } = req.params;
    const { user_id } = req.query;

    let query = `
      SELECT s.id, s.sub_app_id, s.form_version_id, s.user_id, s.status,
             s.created_at, s.updated_at, fv.version_num
      FROM submissions s
      JOIN form_versions fv ON s.form_version_id = fv.id
      WHERE s.sub_app_id = ?
    `;
    const params = [subAppId];

    if (user_id) {
      query += ' AND s.user_id = ?';
      params.push(user_id);
    }

    query += ' ORDER BY s.created_at DESC';
    const submissions = db.prepare(query).all(...params);
    res.json(submissions);
  });

  router.post('/', (req, res) => {
    const { subAppId } = req.params;
    const { user_id, data } = req.body;

    if (!user_id) return res.status(400).json({ error: 'user_id is required' });

    // Get the current form version for this sub-app
    const subApp = db.prepare('SELECT form_id FROM sub_apps WHERE id = ?').get(subAppId);
    if (!subApp) return res.status(404).json({ error: 'Sub-app not found' });

    const form = db.prepare('SELECT current_version FROM forms WHERE id = ?').get(subApp.form_id);
    const version = db.prepare(
      'SELECT id FROM form_versions WHERE form_id = ? AND version_num = ?'
    ).get(subApp.form_id, form.current_version);

    const result = db.prepare(
      'INSERT INTO submissions (sub_app_id, form_version_id, user_id, status) VALUES (?, ?, ?, ?)'
    ).run(subAppId, version.id, user_id, 'submitted');

    const submission = db.prepare('SELECT * FROM submissions WHERE id = ?').get(Number(result.lastInsertRowid));
    res.status(201).json(submission);
  });

  return router;
}

export function createSingleSubmissionRoutes(db) {
  const router = Router();

  router.get('/:id', (req, res) => {
    const submission = db.prepare(`
      SELECT s.*, fv.version_num
      FROM submissions s
      JOIN form_versions fv ON s.form_version_id = fv.id
      WHERE s.id = ?
    `).get(req.params.id);

    if (!submission) return res.status(404).json({ error: 'Submission not found' });
    res.json(submission);
  });

  return router;
}
```

- [ ] **Step 6: Update server/index.js to use createApp**

Replace `server/index.js`:

```js
import { createApp } from './app.js';

const app = createApp();
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

- [ ] **Step 7: Run registry tests to verify they pass**

Run: `cd server && npx vitest run tests/registry.test.js`
Expected: All 7 tests PASS.

- [ ] **Step 8: Run all server tests**

Run: `cd server && npx vitest run`
Expected: database.test.js (9 PASS) + registry.test.js (7 PASS) = 16 tests PASS. Old forms/submissions tests should be deleted at this point since they test the old schema.

- [ ] **Step 9: Delete old test files**

```bash
rm server/tests/forms.test.js server/tests/submissions.test.js
```

- [ ] **Step 10: Run tests again to confirm clean state**

Run: `cd server && npx vitest run`
Expected: 16 tests PASS (database + registry).

- [ ] **Step 11: Commit**

```bash
git add server/routes/registry.js server/routes/forms.js server/routes/subApps.js server/routes/submissions.js server/app.js server/index.js server/tests/registry.test.js server/tests/database.test.js
git rm server/tests/forms.test.js server/tests/submissions.test.js
git commit -m "feat: add registry API endpoints and adapt existing routes for new schema

- GET /api/registry/element-types (grouped by category)
- GET /api/registry/element-types/:id/properties (grouped by property group)
- GET /api/registry/condition-actions
- GET /api/registry/condition-operators
- Refactored all routes to factory pattern for testability
- Adapted forms/submissions routes for schema without JSON columns
- 16 tests covering DB init, seed data, and all registry endpoints"
```

---

## Task 5: Form.io Frontend Isolation

**Files:**
- Create: `client/src/components/formio/FormioBuilder.jsx`
- Create: `client/src/components/formio/FormioRenderer.jsx`
- Move: `client/src/components/FormPreview.jsx` → `client/src/components/formio/FormPreview.jsx`
- Modify: `client/src/main.jsx`
- Modify: `client/src/pages/admin/FormBuilder.jsx`
- Modify: `client/src/pages/user/CreateRequest.jsx`

- [ ] **Step 1: Create the formio directory and move FormPreview**

```bash
mkdir -p client/src/components/formio
mv client/src/components/FormPreview.jsx client/src/components/formio/FormPreview.jsx
```

- [ ] **Step 2: Extract FormioBuilder component**

Create `client/src/components/formio/FormioBuilder.jsx`:

```jsx
// PRESERVED: Form.io drag-and-drop builder integration.
// Not currently active — isolated for potential future use.
import { FormBuilder } from '@formio/react';

export default function FormioBuilder({ schema, onChange }) {
  return (
    <FormBuilder
      form={schema || { display: 'form', components: [] }}
      onChange={(newSchema) => onChange(newSchema)}
    />
  );
}
```

- [ ] **Step 3: Extract FormioRenderer component**

Create `client/src/components/formio/FormioRenderer.jsx`:

```jsx
// PRESERVED: Form.io form renderer integration.
// Not currently active — isolated for potential future use.
import { Form } from '@formio/react';

export default function FormioRenderer({ schema, onSubmit }) {
  return (
    <Form
      form={schema}
      onSubmit={(submission) => onSubmit(submission.data)}
    />
  );
}
```

- [ ] **Step 4: Remove Form.io CSS import from main.jsx**

In `client/src/main.jsx`, remove the line:

```js
import 'formiojs/dist/formio.full.min.css';
```

Keep all other imports and code unchanged.

- [ ] **Step 5: Update FormBuilder page — remove Form.io toggle**

Replace `client/src/pages/admin/FormBuilder.jsx` to use only SimpleBuilder (remove the drag-drop/simple toggle and Form.io FormBuilder import):

```jsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getForm, createForm, updateForm } from '../../api/forms';
import SimpleBuilder from '../../components/SimpleBuilder';

export default function FormBuilderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEditing = Boolean(id);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [schema, setSchema] = useState({ display: 'form', components: [] });

  const { data: form } = useQuery({
    queryKey: ['form', id],
    queryFn: () => getForm(id),
    enabled: isEditing,
  });

  useEffect(() => {
    if (form) {
      setName(form.name);
      setDescription(form.description || '');
      if (form.schema) {
        setSchema(typeof form.schema === 'string' ? JSON.parse(form.schema) : form.schema);
      }
    }
  }, [form]);

  const saveMutation = useMutation({
    mutationFn: (data) => isEditing ? updateForm(id, data) : createForm(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forms'] });
      navigate('/admin/forms');
    },
  });

  const handleSave = () => {
    saveMutation.mutate({ name, description, schema });
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">
          {isEditing ? 'Edit Form Template' : 'New Form Template'}
        </h1>
        <button
          onClick={handleSave}
          disabled={saveMutation.isPending || !name.trim()}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {saveMutation.isPending ? 'Saving...' : 'Save'}
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Form Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
              placeholder="Enter form name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
              placeholder="Enter description"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <SimpleBuilder
          schema={schema}
          onChange={setSchema}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Update CreateRequest page — remove Form.io toggle**

Replace `client/src/pages/user/CreateRequest.jsx` to use only the custom FormRenderer (remove the Simple/Form.io toggle and Form.io Form import):

```jsx
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { getSubApp } from '../../api/subApps';
import { createSubmission } from '../../api/submissions';
import { useAuth } from '../../components/AuthContext';
import FormRenderer from '../../components/FormRenderer';

export default function CreateRequest() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { userId } = useAuth();
  const [submitError, setSubmitError] = useState(null);

  const { data: subApp, isLoading } = useQuery({
    queryKey: ['subApp', id],
    queryFn: () => getSubApp(id),
  });

  const submitMutation = useMutation({
    mutationFn: (data) => createSubmission(id, { user_id: userId, data }),
    onSuccess: () => navigate(`/sub-apps/${id}`),
    onError: (err) => setSubmitError(err.message),
  });

  if (isLoading) return <div className="p-6">Loading...</div>;
  if (!subApp) return <div className="p-6">Sub-app not found</div>;

  const schema = subApp.schema ? (typeof subApp.schema === 'string' ? JSON.parse(subApp.schema) : subApp.schema) : null;

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">{subApp.name}</h1>
      <p className="text-gray-600 mb-6">{subApp.description}</p>

      {submitError && (
        <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4">{submitError}</div>
      )}

      {schema ? (
        <div className="bg-white rounded-lg shadow p-6">
          <FormRenderer
            schema={schema}
            onSubmit={(data) => submitMutation.mutate(data)}
          />
        </div>
      ) : (
        <div className="bg-yellow-50 text-yellow-700 p-4 rounded-lg">
          No form schema available. The admin needs to configure this form.
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 7: Verify the frontend builds**

```bash
cd client && npx vite build
```

Expected: Build succeeds. There may be warnings about unused Form.io packages (that's fine — they're still in package.json but no active code imports them).

- [ ] **Step 8: Commit**

```bash
git add client/src/components/formio/ client/src/main.jsx client/src/pages/admin/FormBuilder.jsx client/src/pages/user/CreateRequest.jsx
git rm client/src/components/FormPreview.jsx
git commit -m "feat: isolate Form.io into formio/ directory, remove from active UI

- Moved FormPreview.jsx to components/formio/
- Extracted FormioBuilder.jsx and FormioRenderer.jsx
- Removed formiojs CSS import from main.jsx
- Removed Form.io toggle from FormBuilder page (SimpleBuilder only)
- Removed Form.io toggle from CreateRequest page (FormRenderer only)
- Form.io packages remain in package.json but are not imported by active code"
```

---

## Task 6: Smoke Test — Full Stack Verification

**Files:** None (verification only)

- [ ] **Step 1: Run all server tests**

```bash
cd server && npx vitest run
```

Expected: 16 tests PASS (database: 9, registry: 7).

- [ ] **Step 2: Start the full stack and verify**

```bash
npm run dev
```

Open browser and verify:
1. `http://localhost:3001/api/health` returns `{"status":"ok"}`
2. `http://localhost:3001/api/registry/element-types` returns 5 categories with 20 types
3. `http://localhost:3001/api/registry/element-types/1/properties` returns property groups for textfield
4. `http://localhost:3001/api/registry/condition-actions` returns 7 actions
5. `http://localhost:3001/api/registry/condition-operators` returns 8 operators
6. Frontend loads without errors (no Form.io CSS, no Form.io toggles visible)
7. Admin form builder shows SimpleBuilder only (no drag-drop/simple toggle)

- [ ] **Step 3: Final commit with any fixups**

If everything works, no commit needed. If there were fixups, commit them.

---

## Summary

**Phase 1 delivers:**
- 17-table normalized schema replacing the 4-table JSON-blob schema
- Full registry seed data: 5 categories, 20 element types, 4 property groups, 17 property definitions, 141 element-type-property mappings, 7 condition action types, 8 condition operators
- 4 registry API endpoints serving data that will drive the form builder UI
- Form.io isolated into `client/src/components/formio/` — no active imports
- Existing routes adapted to not crash on the new schema
- 16 tests covering database initialization, seed data correctness, and all registry endpoints

**What Phase 2 will build on this:**
- Left sidebar component consuming `GET /api/registry/element-types`
- Right sidebar consuming `GET /api/registry/element-types/:id/properties`
- Canvas with HTML5 drag-and-drop
- Forms API rewrite for saving/loading relational form structure
- Replace SimpleBuilder with the new three-panel builder
