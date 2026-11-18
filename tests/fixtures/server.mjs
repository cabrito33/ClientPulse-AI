// Local HTTP substitutes for Auth, PostgREST and Edge Functions. Never contacts providers.
import http from 'node:http';
export const ids = {
  user: '11111111-1111-4111-8111-111111111111', agency: '22222222-2222-4222-8222-222222222222',
  client: '33333333-3333-4333-8333-333333333333', report: '44444444-4444-4444-8444-444444444444',
  token: '55555555-5555-4555-8555-555555555555', expired: '66666666-6666-4666-8666-666666666666',
  revoked: '77777777-7777-4777-8777-777777777777',
};
const timestamp = '2026-11-17T10:00:00Z';
const user = { id: ids.user, aud: 'authenticated', role: 'authenticated', email: 'manager@example.test',
  app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: { full_name: 'Test Manager' }, created_at: timestamp };
let tables, scenario;
function reset(options = {}) {
  scenario = options;
  tables = {
    agencies: [{ id: ids.agency, user_id: ids.user, name: 'Test Agency', onboarding_started_at: null }],
    github_integrations: options.connected ? [{ id: 'integration', agency_id: ids.agency, github_username: 'fixture-user', is_valid: true }] : [],
    clients: options.seed ? [makeClient()] : [], reports: options.seed ? [makeReport('sent')] : [],
    sprint_metrics: [], report_tasks: [], delivery_logs: [], portal_tokens: [], success_metrics: [],
  };
}
function makeClient() {
  return { id: ids.client, agency_id: ids.agency, name: 'Test Client', company_name: 'Test Company', email: 'client@example.test', language: 'pt', communication_tone: 'formal', github_project_id: 'PVT_fixture', github_project_title: 'Fixture Project', column_mapping: { done: ['Done'], in_progress: ['In Progress'], blocked: [] }, auto_send_enabled: false, schedule_day_of_week: 5, schedule_hour_utc: 9, portal_token: ids.token, created_at: timestamp };
}
function makeReport(status = 'draft') {
  return { id: ids.report, client_id: ids.client, agency_id: ids.agency, status, period_start: '2026-11-10', period_end: '2026-11-17', summary_done: 'Entrega de teste concluída', summary_blockers: 'Sem bloqueios registados no board.', summary_next_steps: 'Rever os resultados de teste', created_at: timestamp, sent_at: status === 'sent' ? timestamp : null, opened_at: null, raw_github_data: { tasks_completed: 1, tasks_planned: 2 }, tasks_completed: 1, tasks_planned: 2 };
}
function matches(row, params) {
  return [...params].every(([key, value]) => {
    if (['select', 'order', 'limit', 'offset', 'on_conflict'].includes(key)) return true;
    if (value.startsWith('eq.')) return String(row[key]) === value.slice(3);
    if (value.startsWith('is.')) return value === 'is.null' ? row[key] == null : true;
    if (value.startsWith('in.(')) return value.slice(4, -1).split(',').includes(String(row[key]));
    return true;
  });
}
reset();
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1:54329');
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3100');
  res.setHeader('Access-Control-Allow-Headers', 'authorization, apikey, content-type, x-client-info, x-supabase-api-version');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,HEAD,OPTIONS');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Range');
  const send = (data, status = 200) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)); };
  if (req.method === 'OPTIONS') return send({});
  let text = ''; for await (const chunk of req) text += chunk;
  const body = text ? JSON.parse(text) : {};
  if (url.pathname === '/__test/reset') { reset(body); return send({ ok: true }); }
  if (url.pathname === '/__test/state') return send({ tables });
  if (url.pathname === '/health') return send({ ok: true });
  if (url.pathname === '/auth/v1/signup') return send({ ...user, email: body.email, identities: [] });
  if (url.pathname === '/auth/v1/token') {
    if (body.password === 'wrong-password') return send({ msg: 'Invalid login credentials', code: 'invalid_credentials' }, 400);
    const encoded = value => Buffer.from(JSON.stringify(value)).toString('base64url');
    const jwt = `${encoded({ alg: 'HS256', typ: 'JWT' })}.${encoded({ sub: ids.user, role: 'authenticated', exp: Math.floor(Date.now()/1000)+3600 })}.fixture-signature`;
    return send({ access_token: jwt, token_type: 'bearer', expires_in: 3600, refresh_token: 'fixture-refresh', user });
  }
  if (url.pathname === '/auth/v1/user') return send(user);
  if (url.pathname === '/auth/v1/logout') return send({});
  if (url.pathname.startsWith('/rest/v1/rpc/')) {
    const fn = url.pathname.split('/').at(-1);
    const state = body.p_token === ids.expired ? 'expired' : body.p_token === ids.revoked ? 'revoked' : body.p_token === ids.token ? 'valid' : 'not_found';
    if (fn === 'check_portal_token_status') return send(state);
    if (fn === 'get_portal_data_by_token') return send(state === 'valid' && tables.clients.length ? { client: tables.clients[0], reports: tables.reports.filter(r => r.status === 'sent'), metrics: tables.sprint_metrics } : null);
    if (fn === 'record_portal_report_open') return send({ opened_at: timestamp });
    if (fn === 'sync_client_sprint_metrics') return send({ metrics: tables.sprint_metrics });
    return send({ error: 'Unexpected RPC' }, 500);
  }
  if (url.pathname.startsWith('/functions/v1/')) {
    const fn = url.pathname.split('/').at(-1);
    if (fn === 'onboarding-chat') {
      tables.github_integrations = [{ github_username: 'fixture-user', is_valid: true }];
      return send({ reply: 'Ligação de teste validada. Seleciona o board.', github_status: { is_connected: true, username: 'fixture-user' } });
    }
    if (fn === 'github-sync') return send(body.action === 'list-projects'
      ? { owner: 'fixture-user', projects: [{ id: 'PVT_fixture', number: 1, title: 'Fixture Project', closed: false }] }
      : scenario.columnsFail ? { error: 'Simulated column lookup failure' } : { projectTitle: 'Fixture Project', columns: [{ name: 'Todo' }, { name: 'In Progress' }, { name: 'Done' }] }, scenario.columnsFail && body.action === 'fetch-columns' ? 503 : 200);
    if (fn === 'generate-report') { tables.reports = [makeReport()]; tables.sprint_metrics = [{ client_id: ids.client, agency_id: ids.agency, sprint: 'S47', label: 'Semana 47', completed: 1, planned: 2 }]; return send({ report_id: ids.report, status: 'draft' }, 201); }
    if (fn === 'approve-and-send') {
      Object.assign(tables.reports[0], { status: 'sent', sent_at: timestamp }, body.updated_blocks ? { summary_done: body.updated_blocks.done, summary_blockers: body.updated_blocks.blockers, summary_next_steps: body.updated_blocks.next_steps } : {});
      return send({ success: true, report_id: ids.report, status: 'sent', is_mock_delivery: true });
    }
    return send({ error: 'Unexpected function' }, 500);
  }
  if (url.pathname.startsWith('/rest/v1/')) {
    const table = url.pathname.split('/').at(-1);
    if (!(table in tables)) return send({ message: 'Unexpected table' }, 500);
    let rows = tables[table].filter(r => matches(r, url.searchParams));
    if (req.method === 'POST') {
      const additions = (Array.isArray(body) ? body : [body]).map(r => table === 'clients' ? { ...makeClient(), ...r } : r);
      const conflict = url.searchParams.get('on_conflict')?.split(',');
      for (const addition of additions) {
        const existing = conflict && tables[table].find(row => conflict.every(key => row[key] === addition[key]));
        if (existing) Object.assign(existing, addition);
        else tables[table].push(addition);
      }
      rows = additions;
    }
    if (req.method === 'PATCH') for (const row of rows) Object.assign(row, body);
    if (req.method === 'DELETE') { tables[table] = tables[table].filter(r => !rows.includes(r)); rows = []; }
    res.setHeader('Content-Range', `0-${Math.max(rows.length-1, 0)}/${rows.length}`);
    if (req.method === 'HEAD') return send(null);
    const single = req.headers.accept?.includes('vnd.pgrst.object');
    return send(single ? rows[0] ?? null : rows);
  }
  return send({ error: 'Unexpected local request' }, 404);
});
server.listen(54329, '127.0.0.1');
