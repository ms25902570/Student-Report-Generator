// Browser-side helper for calling the backend. Requests go to /api/... on the
// frontend's own origin and Next.js forwards them to backend/server.js.
export async function api(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(path, {
      method,
      cache: 'no-store',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Could not reach the server. Please check that the app is still running.');
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    // A 5xx without a JSON body comes from the proxy, not from the backend itself.
    if (!data && res.status >= 500) {
      throw new Error('The backend server is not responding. Make sure it is running (npm run dev starts it).');
    }
    throw new Error(data?.error || `Request failed (${res.status}).`);
  }
  return data || {};
}
