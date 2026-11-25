import { useEffect, useState } from 'react';
import { CheckCircle2, Copy, ShieldCheck, XCircle } from 'lucide-react';
import { post, put } from '../../../services/api';
import { useAction, useFetch } from '../../../hooks';
import { Button, ErrorState, Field, Skeleton } from '../../../components/common';
import { Toggle } from '../../../components/admin/kit';

/** Owner-only. Secrets are write-only: the server stores them encrypted and never sends them back. */
export default function PaymentsSection() {
  const { data, loading, error, reload } = useFetch('/admin/payment-settings');
  const [run, busy] = useAction();
  const [form, setForm] = useState({ onlineEnabled: true, codEnabled: true, keyId: '', keySecret: '', webhookSecret: '' });
  const [test, setTest] = useState(null);
  useEffect(() => { if (data) setForm((f) => ({ ...f, onlineEnabled: data.onlineEnabled, codEnabled: data.codEnabled, keyId: data.razorpay.keyId, keySecret: '', webhookSecret: '' })); }, [data]);
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading || !data) return <Skeleton className="h-72" />;
  const rz = data.razorpay;
  const webhookUrl = `${(import.meta.env.VITE_API_URL || window.location.origin)}/api/v1/webhooks/razorpay`;
  const save = async () => {
    const r = await run(() => put('/admin/payment-settings', { onlineEnabled: form.onlineEnabled, codEnabled: form.codEnabled, razorpay: { keyId: form.keyId, ...(form.keySecret ? { keySecret: form.keySecret } : {}), ...(form.webhookSecret ? { webhookSecret: form.webhookSecret } : {}) } }), 'Payment settings saved');
    if (r) { setTest(null); reload(); }
  };
  const runTest = async () => { setTest(null); const r = await run(() => post('/admin/payment-settings/test')); if (r) setTest(r.data); };
  const Status = ({ ok, label }) => <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${ok ? 'text-ok' : 'text-muted'}`}>{ok ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}{label}</span>;

  return (
    <section className="card mb-6 space-y-5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="flex items-center gap-2 text-lg font-bold"><ShieldCheck className="size-5 text-brand" />Payment gateway</h2><p className="text-sm text-muted">Changes take effect immediately. Secrets are stored encrypted and can't be viewed again, only replaced.</p></div>
        <Button loading={busy} onClick={save}>Save payment settings</Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2"><Toggle label="Accept online payments (Razorpay)" checked={form.onlineEnabled} onChange={(v) => setForm({ ...form, onlineEnabled: v })} /><Toggle label="Accept cash on delivery / pickup" checked={form.codEnabled} onChange={(v) => setForm({ ...form, codEnabled: v })} /></div>
      {form.onlineEnabled && !rz.configured && <p className="rounded-lg bg-brand/10 p-3 text-sm">Online payment stays hidden from customers until a valid Key ID and Key Secret are saved.</p>}
      <div className="grid gap-4 lg:grid-cols-2">
        <Field label="Razorpay Key ID" placeholder="rzp_live_xxxxxxxxxx" value={form.keyId} onChange={(e) => setForm({ ...form, keyId: e.target.value })} hint="Dashboard → Account & Settings → API keys. Use rzp_test_… keys to try it out." autoComplete="off" />
        <Field label="Razorpay Key Secret" type="password" autoComplete="new-password" placeholder={rz.keySecretSet ? '•••••••• saved — type to replace' : 'Paste key secret'} value={form.keySecret} onChange={(e) => setForm({ ...form, keySecret: e.target.value })} />
        <Field label="Webhook secret" type="password" autoComplete="new-password" placeholder={rz.webhookSecretSet ? '•••••••• saved — type to replace' : 'Paste webhook secret'} value={form.webhookSecret} onChange={(e) => setForm({ ...form, webhookSecret: e.target.value })} hint="The secret you enter when creating the webhook in Razorpay." />
        <div>
          <span className="label">Webhook URL (add this in Razorpay → Webhooks)</span>
          <div className="flex gap-2"><input readOnly className="field font-mono text-xs" value={webhookUrl} onFocus={(e) => e.target.select()} /><Button type="button" variant="outline" aria-label="Copy webhook URL" onClick={() => navigator.clipboard?.writeText(webhookUrl)}><Copy className="size-4" /></Button></div>
          <p className="mt-1 text-xs text-muted">Events: payment.captured, payment.failed, refund.processed, refund.failed</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-sand pt-4">
        <Status ok={rz.keyId && rz.keySecretSet} label={rz.configured ? 'Keys saved' : 'Keys missing'} /><Status ok={rz.webhookSecretSet} label={rz.webhookSecretSet ? 'Webhook secret saved' : 'Webhook secret missing'} />
        <Button variant="outline" size="sm" loading={busy} disabled={!rz.configured} onClick={runTest}>Test connection</Button>
        {test && <span className="text-sm font-semibold text-ok">Connected · {test.mode} mode{!test.webhookSecretSet && ' · add the webhook secret to confirm payments automatically'}</span>}
      </div>
    </section>
  );
}
