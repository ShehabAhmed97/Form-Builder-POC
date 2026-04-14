const BASE = '/api/sub-apps';

export async function getSubApps() {
  const res = await fetch(BASE);
  return res.json();
}

export async function getSubApp(id) {
  const res = await fetch(`${BASE}/${id}`);
  return res.json();
}

export async function createSubApp(data) {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function updateSubApp(id, data) {
  const res = await fetch(`${BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}
