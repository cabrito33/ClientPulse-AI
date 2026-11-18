import assert from 'node:assert/strict';
import test from 'node:test';
import { loadTypeScript, fakeDatabase } from '../tests/helpers/load-typescript.mjs';
import { safeLoginDestination } from '../src/lib/navigation.ts';
import { getIsoWeekYear, findExistingWeekReport } from '../supabase/functions/_shared/idempotency.ts';

test('Login preserves protected local routes and rejects executable/external destinations', () => {
  for (const url of ['javascript:alert(1)', '//evil.example', '/\\evil.example', '/login', '/dashboard/../../login', '/%2f%2fevil.example', '/dashboard\n', null]) {
    assert.equal(safeLoginDestination(url), '/dashboard');
  }
  assert.equal(safeLoginDestination('/dashboard/reports/123?view=edit#done'), '/dashboard/reports/123?view=edit#done');
  assert.equal(safeLoginDestination('/onboarding'), '/onboarding');
});

test('ISO week follows UTC at year and timezone boundaries', () => {
  assert.deepEqual(getIsoWeekYear(new Date('2027-01-01T00:30:00Z')), { year: 2026, week: 53 });
  const original = process.env.TZ;
  try {
    process.env.TZ = 'America/Los_Angeles';
    assert.deepEqual(getIsoWeekYear(new Date('2026-11-16T00:30:00Z')), { year: 2026, week: 47 });
    assert.equal(findExistingWeekReport([{ id: 'existing', period_end: '2026-11-16' }], new Date('2026-11-16T00:30:00Z'))?.id, 'existing');
  } finally { if (original === undefined) delete process.env.TZ; else process.env.TZ = original; }
});

const input = { clientName: 'Test client', clientEmail: 'client@example.test', projectId: 'PVT_test', projectOwner: 'test', tone: 'formal', language: 'pt', columnMapping: { done: 'Done', in_progress: 'In Progress', blocked: '' } };
function onboarding(db, invoke = async () => ({ columns: [] })) {
  return loadTypeScript('src/app/actions/onboarding.ts', {
    '@/lib/supabase/server': { createClient: async () => db },
    '@/lib/edge': { invokeEdgeFunction: invoke },
  });
}
test('Onboarding never invents columns for an empty board', async () => {
  const result = await onboarding(null).fetchProjectColumnsAction('PVT_test');
  assert.equal(result.success, false);
  assert.match(result.error, /Status/);
});
test('Onboarding validates names/emails before database writes', async () => {
  const db = fakeDatabase(() => { throw Error('Must not query'); });
  assert.equal((await onboarding(db).completeOnboardingAction({ ...input, clientEmail: 'invalid' })).success, false);
  assert.equal((await onboarding(db).completeOnboardingAction({ ...input, clientName: ' ' })).success, false);
  assert.equal(db.calls.length, 0);
});
for (const failure of ['lookup', 'update', 'token']) {
  test(`Onboarding stops before generation on ${failure} failure`, async () => {
    let generated = false;
    const db = fakeDatabase(c => {
      if (c.table === 'agencies') return { data: { id: 'agency' }, error: null };
      const fail = (failure === 'lookup' && c.table === 'clients' && c.operation === 'select') ||
        (failure === 'update' && c.operation === 'update') || (failure === 'token' && c.table === 'portal_tokens');
      return { data: fail ? null : { id: 'client', portal_token: 'token' }, error: fail ? { message: 'Simulated storage failure' } : null };
    });
    const result = await onboarding(db, async () => { generated = true; }).completeOnboardingAction(input);
    assert.equal(result.success, false);
    assert.equal(generated, false);
  });
}
test('Failed revocation cannot report successful renewal or insert a new token', async () => {
  const db = fakeDatabase(c => c.table === 'clients'
    ? { data: { id: 'client', agency_id: 'agency', portal_token: 'old' }, error: null }
    : { data: null, error: { message: 'Denied' } });
  const api = loadTypeScript('src/lib/api.ts', {
    '@/lib/supabase/server': { createClient: async () => db }, '@/lib/edge': {}, '@/lib/report-utils': {},
  });
  await assert.rejects(() => api.renewClientPortalToken('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), /revogar/);
  assert.equal(db.calls.some(c => c.operation === 'insert'), false);
});
test('Reading existing sprint metrics preserves historical rows and never deletes data', async () => {
  const db = fakeDatabase(() => ({ data: [{ sprint: 'S53', label: 'Historical', completed: 3, planned: 4 }], error: null }));
  const api = loadTypeScript('src/lib/api.ts', {
    '@/lib/supabase/server': { createClient: async () => db }, '@/lib/edge': {}, '@/lib/report-utils': {},
  });
  const rows = await api.getSprintMetrics('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  assert.equal(rows[0].sprint, 'S53');
  assert.equal(db.calls.every(c => c.operation === 'select'), true);
});

for (const aiFails of [false, true]) {
  test(`Actual generate-report handler: bypass false overrides auto-send with ${aiFails ? 'AI fallback' : 'AI output'}`, async () => {
    let handler; let sends = 0; let networkCalls = 0;
    const task = { id: 'task', title: 'Test task', statusCategory: 'done', labels: [] };
    const db = fakeDatabase(c => {
      if (c.table === 'clients') return { data: { id: 'client', agency_id: 'agency', name: 'Test client', email: 'client@example.test', auto_send_enabled: true }, error: null };
      if (c.table === 'github_integrations') return { data: { pat_token_encrypted: 'encrypted-fixture' }, error: null };
      if (c.table === 'reports') return { data: c.operation === 'select' ? [] : { id: 'report' }, error: null };
      return { data: [], error: null };
    });
    loadTypeScript('supabase/functions/generate-report/index.ts', {
      '../_shared/cors.ts': { corsHeaders: {}, handleCors: () => null },
      '../_shared/supabaseClient.ts': { createUserClient: () => db, createAdminClient: () => db, getAuthenticatedUser: async () => ({ id: 'user' }) },
      '../_shared/github.ts': { fetchBoardTasks: async () => ({ all: [task], done: [task], blocked: [], inProgress: [] }), GitHubRateLimitError: class extends Error {} },
      '../_shared/gemini.ts': { generateExecutiveReport: async () => { if (aiFails) throw Error('Simulated AI outage'); return { done: 'Test task', blockers: '', next_steps: '', modelUsed: 'test' }; } },
      '../_shared/crypto.ts': { decryptPat: async () => 'fixture-only' },
      '../_shared/resend.ts': { sendReportEmail: async () => { sends++; throw Error('Unexpected send'); } },
      '../_shared/idempotency.ts': { getIsoWeekYear, findExistingWeekReport },
    }, {
      Deno: { serve: fn => { handler = fn; }, env: { get: key => key === 'GEMINI_API_KEY' ? 'test-only' : undefined } },
      fetch: async () => { networkCalls++; throw Error('Network is forbidden in this controlled test'); },
    });
    const response = await handler(new Request('http://localhost/generate-report', { method: 'POST', body: JSON.stringify({ client_id: 'client', bypass: false }) }));
    const body = await response.json();
    assert.equal(response.status, 201, JSON.stringify(body));
    assert.equal(body.status, 'draft');
    assert.equal(body.auto_sent, false);
    assert.equal(body.generated_without_ai, aiFails);
    assert.match(body.sprint_metric.sprint, /^S\d+$/);
    assert.equal(body.sprint_metric.sprint, `S${getIsoWeekYear(new Date(body.period.end)).week}`);
    assert.ok(db.calls.some(c => c.table === 'reports' && c.operation === 'insert' && c.payload.status === 'draft'));
    assert.ok(db.calls.some(c => c.table === 'sprint_metrics' && c.operation === 'upsert'));
    assert.equal(db.calls.some(c => c.table === 'sprint_metrics' && c.operation === 'delete'), false);
    assert.equal(sends, 0);
    assert.equal(networkCalls, 0);
  });
}
