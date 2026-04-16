const API_BASE = '/api/registry';

export async function getElementTypes() {
  const res = await fetch(`${API_BASE}/element-types`);
  if (!res.ok) throw new Error('Failed to fetch element types');
  return res.json();
}

export async function getElementTypeProperties(typeId) {
  const res = await fetch(`${API_BASE}/element-types/${typeId}/properties`);
  if (!res.ok) throw new Error('Failed to fetch element type properties');
  return res.json();
}

export async function getConditionActions() {
  const res = await fetch(`${API_BASE}/condition-actions`);
  if (!res.ok) throw new Error('Failed to fetch condition actions');
  return res.json();
}

export async function getConditionOperators() {
  const res = await fetch(`${API_BASE}/condition-operators`);
  if (!res.ok) throw new Error('Failed to fetch condition operators');
  return res.json();
}
