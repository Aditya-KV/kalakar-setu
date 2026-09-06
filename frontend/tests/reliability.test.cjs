const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

// Run pure TypeScript logic with Node's test runner, without adding a test framework.
require.extensions['.ts'] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  module._compile(outputText, filename);
};
const { createDraftStore, emptyDraft, hasDraftContent } = require('../features/catalog/draft-store.ts');
const { sellerSummary } = require('../lib/seller-summary.ts');
const { productText, mediaUrl } = require('../lib/product-text.ts');
const { validateAddress } = require('../lib/address-validation.ts');

const memoryAdapter = () => {
  const data = new Map();
  return { data, getItem: async (key) => data.get(key) || null, setItem: async (key, value) => { data.set(key, value); } };
};

test('draft survives a new store instance with photo, text, recording, price and stock', async () => {
  const adapter = memoryAdapter();
  const draft = { ...emptyDraft(), mediaId: 'photo-1', photoUri: '/uploads/photo.jpg',
    transcript: 'हाताने बनवलेले भांडे', sourceLanguage: 'mr', recordingUri: 'file:///documents/audio.m4a', price: '1500', quantity: '3' };
  await createDraftStore(adapter).save('artisan-a', draft);
  assert.deepEqual(await createDraftStore(adapter).load('artisan-a'), draft);
  assert.equal(hasDraftContent(draft), true);
});

test('drafts are isolated by account and reset does not clear another account', async () => {
  const store = createDraftStore(memoryAdapter());
  await store.save('a', { ...emptyDraft(), transcript: 'A' });
  assert.deepEqual(await store.load('b'), emptyDraft());
  await store.save('b', { ...emptyDraft(), transcript: 'B' });
  await store.save('a', emptyDraft());
  assert.equal((await store.load('b')).transcript, 'B');
  assert.equal(hasDraftContent(await store.load('a')), false);
});

test('rapid saves are ordered, and restore waits for pending writes', async () => {
  const adapter = memoryAdapter();
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  let writes = 0;
  const store = createDraftStore({ ...adapter, setItem: async (key, value) => {
    if (++writes === 1) await gate;
    await adapter.setItem(key, value);
  } });
  const first = store.save('a', { ...emptyDraft(), price: '1' });
  const second = store.save('a', { ...emptyDraft(), price: '1500' });
  const restored = store.load('a');
  release();
  await Promise.all([first, second]);
  assert.equal((await restored).price, '1500');
});

test('failed storage writes remain visible to callers and can be retried', async () => {
  const adapter = memoryAdapter();
  let fail = true;
  const store = createDraftStore({ ...adapter, setItem: async (...args) => {
    if (fail) throw new Error('Storage full');
    return adapter.setItem(...args);
  } });
  await assert.rejects(store.save('a', { ...emptyDraft(), price: '400' }), /Storage full/);
  fail = false;
  await store.save('a', { ...emptyDraft(), price: '400' });
  assert.equal((await store.load('a')).price, '400');
});

test('corrupt saved drafts are not silently overwritten by an empty draft', async () => {
  const adapter = memoryAdapter();
  adapter.data.set('kalakar_product_draft_v1:a', '{broken');
  await assert.rejects(createDraftStore(adapter).load('a'));
  assert.equal(adapter.data.get('kalakar_product_draft_v1:a'), '{broken');
});

test('dashboard reports paid sales separately from pending orders', () => {
  assert.deepEqual(sellerSummary([
    { fulfillment_status: 1, payment_status: 'pending', total_price: 300 },
    { fulfillment_status: 2, payment_status: 'pending', total_price: 400 },
    { fulfillment_status: 4, payment_status: 'paid', total_price: 1200 },
    { fulfillment_status: 4, payment_status: 'pending', total_price: 900 },
  ]), { pending: 2, toPack: 1, paidSales: 1200, delivered: 2 });
  assert.deepEqual(sellerSummary([]), { pending: 0, toPack: 0, paidSales: 0, delivered: 0 });
});

test('Marathi selects Marathi, while legacy products fall back to available English', () => {
  const text = { en: 'Pot', hi: 'घड़ा', mr: 'मडके' };
  assert.equal(productText(text, 'mr-IN'), 'मडके');
  assert.equal(productText(text, 'hi'), 'घड़ा');
  assert.equal(productText({ ...text, mr: null }, 'mr'), 'Pot');
  assert.equal(productText({ ...text, mr: ' ' }, 'mr'), 'Pot');
});

test('hosted product photos stay valid and relative photos use the API host', () => {
  const api = 'https://api.example.com/api/v1/';
  assert.equal(mediaUrl('https://cdn.example.com/photo.jpg', api), 'https://cdn.example.com/photo.jpg');
  assert.equal(mediaUrl('/uploads/photo.jpg', api), 'https://api.example.com/uploads/photo.jpg');
  assert.equal(mediaUrl('/uploads/a.jpg', 'http://10.0.2.2:8000/api/v1'), 'http://10.0.2.2:8000/uploads/a.jpg');
  assert.equal(mediaUrl(null, api), null);
});

test('checkout reports field errors for incomplete addresses and accepts valid Indian details', () => {
  const valid = { label: 'Home', recipient_name: 'Test Buyer', phone_number: '9876543210',
    line1: '1 Test Street', line2: '', city: 'Pune', state_code: 'mh', pincode: '411001' };
  assert.deepEqual(validateAddress(valid), {});
  const errors = validateAddress({ ...valid, recipient_name: ' ', phone_number: '123', pincode: '000000', state_code: 'Maharashtra' });
  assert.deepEqual(Object.keys(errors).sort(), ['phone_number', 'pincode', 'recipient_name', 'state_code']);
});
