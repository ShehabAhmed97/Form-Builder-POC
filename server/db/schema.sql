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
