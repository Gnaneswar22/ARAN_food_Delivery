import { configureStore, createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { api, get, post, put, setAccessToken, refreshSession, errMsg } from '../services/api';
import { lineKey, uid } from '../utils';

/* ---------------- UI (toasts, drawers) ---------------- */
const ui = createSlice({
  name: 'ui',
  initialState: { toasts: [], cartOpen: false, menuOpen: false },
  reducers: {
    toast: { reducer: (s, a) => { s.toasts.push(a.payload); }, prepare: (message, type = 'success') => ({ payload: { id: uid(), message, type } }) },
    dismissToast: (s, a) => { s.toasts = s.toasts.filter((t) => t.id !== a.payload); },
    setCartOpen: (s, a) => { s.cartOpen = a.payload; },
    setMenuOpen: (s, a) => { s.menuOpen = a.payload; },
  },
});
export const { toast, dismissToast, setCartOpen, setMenuOpen } = ui.actions;

/* ---------------- Settings ---------------- */
export const fetchSettings = createAsyncThunk('settings/fetch', async () => (await get('/settings')).data);
const settings = createSlice({
  name: 'settings',
  initialState: { data: null, loading: true },
  reducers: {},
  extraReducers: (b) => b.addCase(fetchSettings.fulfilled, (s, a) => { s.data = a.payload; s.loading = false; }).addCase(fetchSettings.rejected, (s) => { s.loading = false; }),
});

/* ---------------- Auth ---------------- */
export const bootstrapAuth = createAsyncThunk('auth/bootstrap', async (_, { dispatch }) => {
  try {
    const d = await refreshSession();
    dispatch(syncCartOnLogin());
    return d.user;
  } catch { return null; }
});
export const loginThunk = createAsyncThunk('auth/login', async ({ identifier, password, admin }, { dispatch, rejectWithValue }) => {
  try {
    const { data } = await post(admin ? '/auth/admin/login' : '/auth/login', { identifier, password });
    setAccessToken(data.accessToken);
    dispatch(syncCartOnLogin());
    return data.user;
  } catch (e) { return rejectWithValue(errMsg(e)); }
});
/** Called after OTP verification: stores the access token, merges the guest cart, sets the user. */
export const completeLogin = createAsyncThunk('auth/complete', async ({ user, accessToken }, { dispatch }) => {
  setAccessToken(accessToken);
  dispatch(syncCartOnLogin());
  return user;
});
export const logoutThunk = createAsyncThunk('auth/logout', async () => {
  try { await post('/auth/logout', null, { headers: { 'X-Requested-With': 'aran' } }); } catch { /* ignore */ }
  setAccessToken(null);
});
const auth = createSlice({
  name: 'auth',
  initialState: { user: null, ready: false },
  reducers: { setUser: (s, a) => { s.user = a.payload; }, clearUser: (s) => { s.user = null; } },
  extraReducers: (b) => b
    .addCase(bootstrapAuth.fulfilled, (s, a) => { s.user = a.payload; s.ready = true; })
    .addCase(loginThunk.fulfilled, (s, a) => { s.user = a.payload; })
    .addCase(completeLogin.fulfilled, (s, a) => { s.user = a.payload; })
    .addCase(logoutThunk.fulfilled, (s) => { s.user = null; }),
});
export const { setUser, clearUser } = auth.actions;

/* ---------------- Cart ---------------- */
const STORAGE_KEY = 'aran_cart_v1';
const loadCart = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { return []; } };
const strip = (i) => ({ ...i }); // all fields are display cache; backend recomputes everything

// Merge guest cart into server cart after login. Same line => keep the larger quantity (idempotent across reloads).
export const syncCartOnLogin = createAsyncThunk('cart/sync', async (_, { getState }) => {
  const server = (await get('/account/cart')).data || [];
  const local = getState().cart.items;
  const map = new Map();
  [...server, ...local].forEach((i) => {
    const k = lineKey(i.productId, i.options);
    const prev = map.get(k);
    map.set(k, prev ? { ...prev, ...i, key: k, quantity: Math.max(prev.quantity, i.quantity) } : { ...i, key: k });
  });
  const merged = [...map.values()];
  await put('/account/cart', { items: merged.map(strip) });
  return merged;
});

const cart = createSlice({
  name: 'cart',
  initialState: { items: loadCart() },
  reducers: {
    addItem: (s, a) => {
      const { productId, quantity = 1, options = [] } = a.payload;
      const key = lineKey(productId, options);
      const ex = s.items.find((i) => i.key === key);
      if (ex) ex.quantity = Math.min(50, ex.quantity + quantity);
      else s.items.push({ ...a.payload, key, quantity });
    },
    setQty: (s, a) => {
      const i = s.items.find((x) => x.key === a.payload.key);
      if (i) i.quantity = Math.max(1, Math.min(50, a.payload.quantity));
    },
    removeItem: (s, a) => { s.items = s.items.filter((i) => i.key !== a.payload); },
    clearCart: (s) => { s.items = []; },
    setCartItems: (s, a) => { s.items = a.payload; },
  },
  extraReducers: (b) => b.addCase(syncCartOnLogin.fulfilled, (s, a) => { s.items = a.payload; }),
});
export const { addItem, setQty, removeItem, clearCart, setCartItems } = cart.actions;

/* ---------------- Store ---------------- */
export const store = configureStore({
  reducer: { ui: ui.reducer, settings: settings.reducer, auth: auth.reducer, cart: cart.reducer },
});

let lastSaved = '';
store.subscribe(() => {
  const { items } = store.getState().cart;
  const json = JSON.stringify(items);
  if (json === lastSaved) return;
  lastSaved = json;
  try { localStorage.setItem(STORAGE_KEY, json); } catch { /* storage full/private mode */ }
  if (store.getState().auth.user) {
    clearTimeout(store._cartTimer);
    store._cartTimer = setTimeout(() => put('/account/cart', { items }).catch(() => {}), 800);
  }
});

export const selectCartCount = (s) => s.cart.items.reduce((a, i) => a + i.quantity, 0);
