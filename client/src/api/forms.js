const API_BASE = '/api/forms';

export async function getForms() {
  const res = await fetch(API_BASE);
  if (!res.ok) throw new Error('Failed to fetch forms');
  return res.json();
}

export async function getForm(id) {
  const res = await fetch(`${API_BASE}/${id}`);
  if (!res.ok) throw new Error('Failed to fetch form');
  return res.json();
}

export async function createForm(data) {
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create form');
  return res.json();
}

export async function updateForm(id, data) {
  const res = await fetch(`${API_BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update form');
  return res.json();
}

export async function duplicateForm(id) {
  const res = await fetch(`${API_BASE}/${id}/duplicate`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to duplicate form');
  return res.json();
}

export async function getFormVersions(id) {
  const res = await fetch(`${API_BASE}/${id}/versions`);
  if (!res.ok) throw new Error('Failed to fetch versions');
  return res.json();
}

export async function getFormVersion(formId, versionId) {
  const res = await fetch(`${API_BASE}/${formId}/versions/${versionId}`);
  if (!res.ok) throw new Error('Failed to fetch version');
  return res.json();
}
