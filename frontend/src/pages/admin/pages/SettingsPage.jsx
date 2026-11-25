import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import PaymentsSection from './PaymentsSection';
import SmsSection from './SmsSection';
import { put } from '../../../services/api';
import { fetchSettings } from '../../../store';
import { useAction, useDocumentTitle, useFetch } from '../../../hooks';
import { Button, ErrorState, Field, Skeleton } from '../../../components/common';
import { ImageUpload, PageHeader, Toggle } from '../../../components/admin/kit';
import { toPaise, toRupees } from '../../../utils';

const Section = ({ title, children, hint }) => <section className="card space-y-4 p-5"><div><h2 className="text-lg font-bold">{title}</h2>{hint && <p className="text-sm text-muted">{hint}</p>}</div>{children}</section>;
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function SettingsPage() {
  useDocumentTitle('Settings');
  const dispatch = useDispatch();
  const role = useSelector((st) => st.auth.user?.role);
  const { data, loading, error, reload } = useFetch('/admin/settings');
  const [s, setS] = useState(null);
  const [run, busy] = useAction();
  useEffect(() => { if (data) setS({ ...data, _pins: (data.delivery?.pincodes || []).join(', '), _slots: (data.pickup?.slots || []).join(', ') }); }, [data]);
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading || !s) return <div className="space-y-4">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-40" />)}</div>;
  const set = (path, v) => setS((p) => { const n = structuredClone(p); const k = path.split('.'); let o = n; k.slice(0, -1).forEach((x) => (o = o[x] ??= {})); o[k.at(-1)] = v; return n; });
  const bind = (path, get) => ({ value: path.split('.').reduce((o, k) => o?.[k], s) ?? '', onChange: (e) => set(path, get ? get(e.target.value) : e.target.value) });
  const num = (v) => (v === '' ? undefined : Number(v));
  const csv = (x) => x.split(',').map((i) => i.trim()).filter(Boolean);
  const save = () => run(async () => {
    const { _pins, _slots, ...rest } = s;
    const body = { brand: rest.brand, stall: { ...rest.stall, lat: num(rest.stall?.lat), lng: num(rest.stall?.lng) }, timings: rest.timings, delivery: { ...rest.delivery, pincodes: csv(_pins) }, pickup: { ...rest.pickup, slots: csv(_slots) }, tax: rest.tax, loyalty: rest.loyalty, notifications: rest.notifications, guestCheckout: rest.guestCheckout };
    await put('/admin/settings', body);
    dispatch(fetchSettings());
  }, 'Settings saved');
  const holidays = s.timings?.weeklyHolidays || [];
  return (
    <>
      <PageHeader title="Business settings" subtitle="Changes apply to the storefront immediately" actions={<Button loading={busy} onClick={save}>Save changes</Button>} />
      {role === 'owner' && <PaymentsSection />}
      {role === 'owner' && <SmsSection />}
      <div className="grid gap-6 xl:grid-cols-2">
        <Section title="Brand & footer contact" hint="Logo, phone and support email appear in the storefront header, footer and Contact page.">
          <ImageUpload folder="categories" label="Logo (leave empty to use default ARAN.co logo)" value={s.brand?.logo ? { url: s.brand.logo } : null} onChange={(v) => set('brand.logo', v?.url)} />
          <Field label="Brand name" {...bind('brand.name')} /><Field label="Contact phone" {...bind('brand.phone')} /><Field label="Support / contact email" type="email" {...bind('brand.email')} />
          <Field as="textarea" rows={3} label="Brand story (shown on the homepage)" {...bind('brand.story')} />
          <div className="grid gap-3 sm:grid-cols-2"><Field label="Instagram URL" {...bind('brand.social.instagram')} /><Field label="Facebook URL" {...bind('brand.social.facebook')} /></div>
          <Field label="Promo banner title" {...bind('brand.promo.title')} /><Field label="Promo banner subtitle" {...bind('brand.promo.subtitle')} /><Field label="Promo button label" {...bind('brand.promo.ctaLabel')} />
        </Section>
        <div className="space-y-6">
          <Section title="Stall information"><Field label="Stall address" {...bind('stall.address')} /><Field label="Contact number" {...bind('stall.phone')} /><div className="grid grid-cols-2 gap-3"><Field label="Latitude" type="number" step="any" {...bind('stall.lat')} /><Field label="Longitude" type="number" step="any" {...bind('stall.lng')} /></div></Section>
          <Section title="Business timings" hint="Times use the business time zone (Asia/Kolkata by default).">
            <div className="grid grid-cols-2 gap-3"><Field label="Opens" type="time" {...bind('timings.open')} /><Field label="Closes" type="time" {...bind('timings.close')} /></div>
            <div><span className="label">Weekly holidays</span><div className="flex flex-wrap gap-2">{DAYS.map((d, i) => <button key={d} type="button" aria-pressed={holidays.includes(i)} onClick={() => set('timings.weeklyHolidays', holidays.includes(i) ? holidays.filter((x) => x !== i) : [...holidays, i])} className={`h-9 rounded-full border px-3.5 text-sm font-semibold ${holidays.includes(i) ? 'border-bad bg-bad text-white' : 'border-sand bg-white'}`}>{d}</button>)}</div></div>
            <Toggle label="Accepting orders" checked={s.timings?.acceptingOrders !== false} onChange={(v) => set('timings.acceptingOrders', v)} /><Toggle label="Temporary closure" checked={!!s.timings?.temporaryClosure} onChange={(v) => set('timings.temporaryClosure', v)} />
          </Section>
        </div>
        <Section title="Delivery" hint="A delivery address is serviceable if its PIN code is listed, or it lies within the radius of the stall coordinates.">
          <Toggle label="Home delivery enabled" checked={s.delivery?.enabled !== false} onChange={(v) => set('delivery.enabled', v)} />
          <div className="grid gap-3 sm:grid-cols-2"><Field label="Delivery radius (km)" type="number" step="0.1" min="0" {...bind('delivery.radiusKm', Number)} /><Field label="Delivery fee (₹)" type="number" min="0" value={toRupees(s.delivery?.feePaise)} onChange={(e) => set('delivery.feePaise', toPaise(e.target.value))} /><Field label="Minimum order (₹)" type="number" min="0" value={toRupees(s.delivery?.minOrderPaise)} onChange={(e) => set('delivery.minOrderPaise', toPaise(e.target.value))} /><Field label="Free delivery above (₹)" type="number" min="0" value={toRupees(s.delivery?.freeDeliveryThresholdPaise)} onChange={(e) => set('delivery.freeDeliveryThresholdPaise', toPaise(e.target.value))} /></div>
          <Toggle label="Auto-assign riders when an order is accepted (needs riders on duty)" checked={!!s.delivery?.autoAssign} onChange={(v) => set('delivery.autoAssign', v)} />
          <Field label="Serviceable PIN codes (comma separated)" value={s._pins} onChange={(e) => set('_pins', e.target.value)} />
        </Section>
        <div className="space-y-6">
          <Section title="Pickup"><Toggle label="Pickup enabled" checked={s.pickup?.enabled !== false} onChange={(v) => set('pickup.enabled', v)} /><Field label="Pickup address" {...bind('pickup.address')} /><Field label="Preparation time (min)" type="number" min="0" {...bind('pickup.prepMinutes', Number)} /><Field label="Pickup slots (comma separated)" placeholder="12:00-12:30, 12:30-13:00" value={s._slots} onChange={(e) => set('_slots', e.target.value)} /></Section>
          <Section title="Tax & checkout"><Field label="Tax rate (%)" type="number" step="0.1" min="0" {...bind('tax.percent', Number)} /><Toggle label="Prices already include tax" checked={!!s.tax?.inclusive} onChange={(v) => set('tax.inclusive', v)} /><Toggle label="Allow guest checkout" checked={s.guestCheckout !== false} onChange={(v) => set('guestCheckout', v)} /></Section>
          <Section title="Rewards & referrals" hint="Customers earn points on completed orders and can pay part of an order with them."><Toggle label="Rewards programme enabled" checked={s.loyalty?.enabled !== false} onChange={(v) => set('loyalty.enabled', v)} /><div className="grid gap-3 sm:grid-cols-2"><Field label="Points earned per ₹100" type="number" min="0" step="0.5" {...bind('loyalty.earnPointsPer100Rupees', Number)} /><Field label="Value of 1 point (₹)" type="number" min="0" step="0.1" value={toRupees(s.loyalty?.pointValuePaise ?? 50)} onChange={(e) => set('loyalty.pointValuePaise', toPaise(e.target.value))} /><Field label="Max % of an order payable with points" type="number" min="0" max="100" {...bind('loyalty.maxRedeemPercent', Number)} /><Field label="Referral bonus (points, each)" type="number" min="0" {...bind('loyalty.referralBonusPoints', Number)} /></div></Section>
          <Section title="Notifications" hint="Email, WhatsApp and push also need provider credentials configured on the server."><Toggle label="New-order alerts" checked={s.notifications?.newOrderAlerts !== false} onChange={(v) => set('notifications.newOrderAlerts', v)} /><Toggle label="Customer status updates" checked={s.notifications?.customerUpdates !== false} onChange={(v) => set('notifications.customerUpdates', v)} /><Toggle label="Send emails" checked={!!s.notifications?.emailEnabled} onChange={(v) => set('notifications.emailEnabled', v)} /><Toggle label="Send WhatsApp messages" checked={!!s.notifications?.whatsappEnabled} onChange={(v) => set('notifications.whatsappEnabled', v)} /></Section>
        </div>
      </div>
    </>
  );
}
