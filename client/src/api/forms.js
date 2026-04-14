const BASE = '/api/forms';

export async function getForms() {
  const res = await fetch(BASE);
  return res.json();
}

export async function getForm(id) {
  const res = await fetch(`${BASE}/${id}`);
  return res.json();
}

export async function createForm(data) {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function updateForm(id, data) {
  const res = await fetch(`${BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function getFormVersions(id) {
  const res = await fetch(`${BASE}/${id}/versions`);
  return res.json();
}
