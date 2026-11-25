import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { get, errMsg } from '../services/api';
import { toast } from '../store';

/** Fetch with loading / error / reload. `deps` re-trigger. Ignores stale responses. */
export function useFetch(url, params, { enabled = true, deps = [] } = {}) {
  const [state, setState] = useState({ data: null, meta: null, loading: enabled, error: null });
  const seq = useRef(0);
  const key = JSON.stringify(params || {});
  const load = useCallback(async () => {
    if (!enabled || !url) return;
    const id = ++seq.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const r = await get(url, JSON.parse(key));
      if (id === seq.current) setState({ data: r.data, meta: r.meta || null, loading: false, error: null });
    } catch (e) {
      if (id === seq.current) setState((s) => ({ ...s, loading: false, error: errMsg(e) }));
    }
  }, [url, key, enabled]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
  return { ...state, reload: load, setData: (updater) => setState((s) => ({ ...s, data: typeof updater === 'function' ? updater(s.data) : updater })) };
}

/** Wrap an async action: loading flag + toast on error. */
export function useAction() {
  const dispatch = useDispatch();
  const [busy, setBusy] = useState(false);
  const run = useCallback(async (fn, successMsg) => {
    setBusy(true);
    try {
      const r = await fn();
      if (successMsg) dispatch(toast(successMsg));
      return r;
    } catch (e) {
      dispatch(toast(errMsg(e), 'error'));
      return undefined;
    } finally { setBusy(false); }
  }, [dispatch]);
  return [run, busy];
}

export function useDocumentTitle(title) {
  useEffect(() => { document.title = title ? `${title} · ARAN.co` : 'ARAN.co – Good Food. Great Moments.'; }, [title]);
}

export function useScrolled(offset = 12) {
  const [s, setS] = useState(false);
  useEffect(() => {
    const on = () => setS(window.scrollY > offset);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, [offset]);
  return s;
}

export function useDebounced(value, ms = 350) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

/** Server-validated cart pricing (items, coupon, fulfillment) — never trust local totals. */
export function useQuote(items, { orderType = 'delivery', address, couponCode, redeemPoints } = {}) {
  const [state, setState] = useState({ quote: null, loading: false, error: null });
  const payload = JSON.stringify({ items: items.map((i) => ({ productId: i.productId, quantity: i.quantity, options: (i.options || []).map((o) => ({ groupId: o.groupId, choiceId: o.choiceId })), note: i.note || undefined })), orderType, address: address && { pincode: address.pincode, lat: address.lat, lng: address.lng }, couponCode: couponCode || undefined, redeemPoints: redeemPoints || undefined });
  const seq = useRef(0);
  const reload = useCallback(async () => {
    const body = JSON.parse(payload);
    if (!body.items.length) { setState({ quote: null, loading: false, error: null }); return; }
    const id = ++seq.current;
    setState((s) => ({ ...s, loading: true }));
    try {
      const { post } = await import('../services/api');
      const r = await post('/cart/quote', body);
      if (id === seq.current) setState({ quote: r.data, loading: false, error: null });
    } catch (e) { if (id === seq.current) setState({ quote: null, loading: false, error: errMsg(e) }); }
  }, [payload]);
  useEffect(() => { const t = setTimeout(reload, 150); return () => clearTimeout(t); }, [reload]);
  return { ...state, reload };
}
