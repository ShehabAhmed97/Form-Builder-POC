export async function getSubmissions(subAppId, userId) {
  const params = userId ? `?user_id=${encodeURIComponent(userId)}` : '';
  const res = await fetch(`/api/sub-apps/${subAppId}/submissions${params}`);
  return res.json();
}

export async function createSubmission(subAppId, data) {
  const res = await fetch(`/api/sub-apps/${subAppId}/submissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function getSubmission(id) {
  const res = await fetch(`/api/submissions/${id}`);
  return res.json();
}
