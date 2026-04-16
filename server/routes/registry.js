import { Router } from 'express';

export function createRegistryRoutes(db) {
  const router = Router();

  // GET /api/registry/element-types
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
