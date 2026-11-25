import { useSelector } from 'react-redux';

/**
 * PLACEHOLDER CONTENT - replace before launch.
 * Contact details saved in Admin -> Settings (brand phone / email, stall address, timings, social links) always win;
 * the values below are only shown while those fields are empty. Edit this file for the FAQ and support copy.
 */
export const DEFAULT_CONTACT = {
  phone: '+91 00000 00000',
  email: 'hello@yourdomain.com',
  address: 'Shop address, Street, City, State - PIN code',
  hours: '10:00 AM - 10:00 PM, every day',
  whatsapp: '', // e.g. 919876543210 (country code + number, no +). Leave empty to hide the WhatsApp button.
  mapsUrl: '', // optional Google Maps share link for "Get directions"
};

export const SUPPORT_TOPICS = [
  ['Order help', 'Wrong or missing item, late delivery, or anything about an order in progress.'],
  ['Payments & refunds', 'Failed payment, double charge, or the status of a refund.'],
  ['Feedback & partnerships', 'Tell us what you loved, suggest a dish, or talk about bulk and catering orders.'],
];

export const FAQS = [
  ['How long does delivery take?', 'Most orders arrive within 30-45 minutes inside our delivery radius. You can follow your rider live from the order page once the food is on its way.'],
  ['Which areas do you deliver to?', 'We deliver within the radius shown at checkout. Enter your address to see if it is covered, or choose pickup to collect it from us.'],
  ['What payment options are available?', 'UPI, cards and net banking through our secure payment partner. Cash on delivery is available when it is enabled for your area.'],
  ['Can I change or cancel my order?', 'You can cancel before the kitchen starts preparing it. After that the food is already being made, so please contact us and we will do our best to help.'],
  ['How do refunds work?', 'If an order is cancelled before preparation, or there is a quality or delivery problem, we refund to your original payment method, usually within 5-7 working days.'],
  ['I have a food allergy. What should I do?', 'Allergens are listed on every dish page. If you need more detail, call or message us before ordering and we will confirm the ingredients with the kitchen.'],
  ['Do you offer pickup?', 'Yes. Choose pickup at checkout, pick a time slot and collect your order from our counter. You will get a pickup code to show us.'],
  ['How do I track my order?', 'Open My account -> Orders, or use the tracking link you get after placing the order. Guests can track with the link saved on their device.'],
];

/** Settings from the admin panel merged over the placeholders above. */
export function useContact() {
  const s = useSelector((st) => st.settings.data);
  const b = s?.brand || {};
  const t = s?.timings;
  const to12 = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`; };
  return {
    phone: b.phone || s?.stall?.phone || DEFAULT_CONTACT.phone,
    email: b.email || DEFAULT_CONTACT.email,
    address: s?.stall?.address || DEFAULT_CONTACT.address,
    hours: t?.open && t?.close ? `${to12(t.open)} - ${to12(t.close)}, every day` : DEFAULT_CONTACT.hours,
    whatsapp: DEFAULT_CONTACT.whatsapp,
    mapsUrl: DEFAULT_CONTACT.mapsUrl,
    social: b.social || {},
  };
}
