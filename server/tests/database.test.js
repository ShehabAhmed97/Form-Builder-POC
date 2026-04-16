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
