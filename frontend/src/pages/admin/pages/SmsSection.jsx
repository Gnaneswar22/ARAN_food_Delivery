import { useEffect, useState } from 'react';
import { MessageSquareText } from 'lucide-react';
import { post, put } from '../../../services/api';
import { useAction, useFetch } from '../../../hooks';
import { Button, ErrorState, Field, Skeleton } from '../../../components/common';

/** Owner-only. Chooses the SMS gateway that delivers login OTPs. Secrets are write-only and stored encrypted. */
export default function SmsSection() {
  const { data, loading, error, reload } = useFetch('/admin/sms-settings');
  const [run, busy] = useAction();
  const [f, setF] = useState({ provider: 'none', msg91AuthKey: '', msg91TemplateId: '', twSid: '', twToken: '', twFrom: '', testPhone: '' });
  const [msg, setMsg] = useState('');
  useEffect(() => { if (data) setF((x) => ({ ...x, provider: data.provider, msg91TemplateId: data.msg91.templateId, twSid: data.twilio.accountSid, twFrom: data.twilio.from, msg91AuthKey: '', twToken: '' })); }, [data]);
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading || !data) return <Skeleton className="h-60" />;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = async () => {
    const r = await run(() => put('/admin/sms-settings', { provider: f.provider, msg91: { templateId: f.msg91TemplateId, ...(f.msg91AuthKey ? { authKey: f.msg91AuthKey } : {}) }, twilio: { accountSid: f.twSid, from: f.twFrom, ...(f.twToken ? { authToken: f.twToken } : {}) } }), 'SMS settings saved');
    if (r) reload();
  };
  const test = async () => { setMsg(''); const r = await run(() => post('/admin/sms-settings/test', { phone: f.testPhone })); if (r) setMsg(r.data.devMode ? 'No provider configured — nothing was sent (dev mode).' : `Test SMS sent to ${f.testPhone}.`); };
  return (
    <section className="card mb-6 space-y-5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="flex items-center gap-2 text-lg font-bold"><MessageSquareText className="size-5 text-brand" />SMS & OTP login</h2><p className="text-sm text-muted">Customers and riders sign in with a code sent by SMS. In India your sender ID and message template must be approved on DLT first.</p></div>
        <Button loading={busy} onClick={save}>Save SMS settings</Button>
      </div>
      {f.provider === 'none' && <p className="rounded-lg bg-bad/10 p-3 text-sm text-bad">No SMS provider is set. In production, mobile login will not work until you configure one.</p>}
      <Field as="select" label="SMS provider" value={f.provider} onChange={set('provider')}><option value="none">None (not configured)</option><option value="msg91">MSG91 (recommended for India)</option><option value="twilio">Twilio</option></Field>
      {f.provider === 'msg91' && <div className="grid gap-4 sm:grid-cols-2"><Field label="MSG91 Auth key" type="password" autoComplete="new-password" placeholder={data.msg91.authKeySet ? '•••••••• saved — type to replace' : 'Paste auth key'} value={f.msg91AuthKey} onChange={set('msg91AuthKey')} /><Field label="OTP template ID" hint="DLT-approved template containing ##OTP##" value={f.msg91TemplateId} onChange={set('msg91TemplateId')} /></div>}
      {f.provider === 'twilio' && <div className="grid gap-4 sm:grid-cols-3"><Field label="Account SID" value={f.twSid} onChange={set('twSid')} /><Field label="Auth token" type="password" autoComplete="new-password" placeholder={data.twilio.authTokenSet ? '•••••••• saved' : 'Paste token'} value={f.twToken} onChange={set('twToken')} /><Field label="From number or Messaging Service SID" value={f.twFrom} onChange={set('twFrom')} /></div>}
      <div className="flex flex-wrap items-end gap-3 border-t border-sand pt-4"><Field className="w-56" label="Send a test SMS to" inputMode="numeric" maxLength={10} placeholder="10-digit mobile" value={f.testPhone} onChange={(e) => setF({ ...f, testPhone: e.target.value.replace(/\D/g, '') })} /><Button variant="outline" loading={busy} disabled={f.testPhone.length !== 10} onClick={test}>Send test</Button>{msg && <span className="text-sm font-semibold text-ok">{msg}</span>}</div>
    </section>
  );
}
