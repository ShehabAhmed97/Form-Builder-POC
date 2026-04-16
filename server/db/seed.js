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
