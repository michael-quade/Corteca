import { recordCall, addReceivedBytes } from './apiStats';

export async function cortecaFetch(url: string, init?: RequestInit): Promise<Response> {
  const sent = url.length + (init?.body ? String(init.body).length : 0);
  let res: Response;
  try { res = await fetch(url, init); } catch (e) { recordCall(sent, 0, false); throw e; }
  const isRl = res.status === 429;
  const cl = res.headers.get('content-length');
  if (cl !== null) {
    recordCall(sent, parseInt(cl, 10) || 0, isRl);
  } else {
    recordCall(sent, 0, isRl);
    res.clone().text().then((t) => addReceivedBytes(t.length)).catch(() => {});
  }
  return res;
}
