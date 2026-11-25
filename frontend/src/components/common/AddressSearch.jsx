import { useEffect, useRef, useState } from 'react';
import { LocateFixed, MapPin, Search } from 'lucide-react';
import { get, errMsg } from '../../services/api';
import { useDebounced } from '../../hooks';

/** Type-ahead address search + "use my current location". Calls onPick({line1, city, pincode, lat, lng}). */
export default function AddressSearch({ onPick }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const dq = useDebounced(q, 450);
  const box = useRef(null);
  const skip = useRef(false);

  useEffect(() => {
    if (skip.current) { skip.current = false; return undefined; }
    if (dq.trim().length < 3) { setResults([]); return undefined; }
    let live = true;
    setBusy(true); setErr('');
    get('/geo/search', { q: dq }).then((r) => { if (live) { setResults(r.data); setOpen(true); } }).catch((e) => live && setErr(errMsg(e))).finally(() => live && setBusy(false));
    return () => { live = false; };
  }, [dq]);
  useEffect(() => { const h = (e) => { if (!box.current?.contains(e.target)) setOpen(false); }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, []);

  const pick = (r) => { skip.current = true; setQ(r.label); setOpen(false); onPick(r); };
  const locate = () => {
    if (!navigator.geolocation) return setErr('Your browser does not support location.');
    setBusy(true); setErr('');
    navigator.geolocation.getCurrentPosition(
      async (pos) => { try { const { data } = await get('/geo/reverse', { lat: pos.coords.latitude, lng: pos.coords.longitude }); pick({ ...data, label: data.label || 'Current location', lat: pos.coords.latitude, lng: pos.coords.longitude }); } catch (e) { setErr(errMsg(e)); onPick({ lat: pos.coords.latitude, lng: pos.coords.longitude }); } finally { setBusy(false); } },
      (e) => { setBusy(false); setErr(e.code === 1 ? 'Location permission was denied. You can still search or type your address.' : 'Could not get your location.'); },
      { enableHighAccuracy: true, timeout: 15000 });
  };

  return (
    <div ref={box} className="relative">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => results.length && setOpen(true)} className="field pl-10" placeholder="Search your area or street…" aria-label="Search address" role="combobox" aria-expanded={open} aria-autocomplete="list" />
        </div>
        <button type="button" onClick={locate} disabled={busy} className="inline-flex h-[46px] items-center gap-2 rounded-[10px] border border-sand bg-white px-3.5 text-sm font-semibold hover:border-brand hover:text-brand disabled:opacity-60" aria-label="Use my current location"><LocateFixed className="size-4" /><span className="hidden sm:inline">Use my location</span></button>
      </div>
      {open && results.length > 0 && (
        <ul role="listbox" className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-sand bg-white shadow-lift">
          {results.map((r, i) => <li key={i} role="option" aria-selected="false"><button type="button" onClick={() => pick(r)} className="flex w-full items-start gap-2 px-3.5 py-2.5 text-left text-sm hover:bg-cream"><MapPin className="mt-0.5 size-4 shrink-0 text-brand" /><span>{r.label}</span></button></li>)}
        </ul>
      )}
      {open && !busy && dq.trim().length >= 3 && results.length === 0 && !err && <p className="mt-1 text-xs text-muted">No matches — type your address below.</p>}
      {err && <p role="alert" className="mt-1 text-xs text-bad">{err}</p>}
    </div>
  );
}
