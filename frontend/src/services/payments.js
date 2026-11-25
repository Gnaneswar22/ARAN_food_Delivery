import { post, errMsg } from './api';

let scriptPromise;
function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve();
  scriptPromise ||= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = resolve;
    s.onerror = () => { scriptPromise = null; reject(new Error('Could not load the payment window. Check your connection.')); };
    document.body.appendChild(s);
  });
  return scriptPromise;
}

export const guestHeaders = (orderId) => {
  const t = guestTokens()[orderId];
  return t ? { headers: { 'x-guest-token': t } } : undefined;
};
export const guestTokens = () => { try { return JSON.parse(localStorage.getItem('aran_guest_orders')) || {}; } catch { return {}; } };
export const saveGuestToken = (id, token) => { if (token) localStorage.setItem('aran_guest_orders', JSON.stringify({ ...guestTokens(), [id]: token })); };

/**
 * Opens Razorpay Checkout for an existing order awaiting payment.
 * Resolves { status: 'paid' | 'cancelled' | 'failed', message }. Payment success is only ever
 * reported after the backend verifies the signature — never from the client callback alone.
 */
export async function payForOrder(order, { user } = {}) {
  const cfg = guestHeaders(order._id);
  let intent;
  try { intent = (await post(`/orders/${order._id}/payment`, null, cfg)).data; }
  catch (e) { return { status: 'failed', message: errMsg(e) }; }
  try { await loadRazorpay(); } catch (e) { return { status: 'failed', message: e.message }; }

  return new Promise((resolve) => {
    const rzp = new window.Razorpay({
      key: intent.keyId,
      order_id: intent.razorpayOrderId,
      amount: intent.amountPaise,
      currency: intent.currency,
      name: 'ARAN.co',
      description: `Order ${intent.orderNumber}`,
      prefill: { name: intent.prefill?.name || user?.name, email: intent.prefill?.email, contact: intent.prefill?.contact },
      theme: { color: '#E87535' },
      modal: { ondismiss: () => { post(`/orders/${order._id}/payment/failed`, { reason: 'Checkout closed by customer' }, cfg).catch(() => {}); resolve({ status: 'cancelled', message: 'Payment was cancelled.' }); } },
      handler: async (resp) => {
        try { await post(`/orders/${order._id}/payment/verify`, resp, cfg); resolve({ status: 'paid' }); }
        catch (e) { resolve({ status: 'failed', message: errMsg(e) }); }
      },
    });
    rzp.on('payment.failed', (r) => { post(`/orders/${order._id}/payment/failed`, { reason: r.error?.description }, cfg).catch(() => {}); });
    rzp.open();
  });
}
