import { getStore, connectLambda } from '@netlify/blobs';

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

const KEYS = ['transactions', 'debts', 'fixedBills', 'goals'];

export const handler = async (event, context) => {
  const user = context.clientContext && context.clientContext.user;
  if (!user) return json(401, { error: 'Não autenticado' });

  // Opcional: restringir a e-mails específicos (variável ALLOWED_EMAILS="a@x.com,b@y.com")
  const allowed = (process.env.ALLOWED_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  if (allowed.length && !allowed.includes(String(user.email || '').toLowerCase())) {
    return json(403, { error: 'E-mail não autorizado' });
  }

  connectLambda(event);
  const store = getStore('family-finance');
  const current = (await store.get('data', { type: 'json' })) || { version: 0, data: {} };

  if (event.httpMethod === 'GET') return json(200, { version: current.version, data: current.data });

  if (event.httpMethod === 'PUT') {
    if ((event.body || '').length > 2_000_000) return json(413, { error: 'Dados grandes demais' });
    let body;
    try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'JSON inválido' }); }

    if (Number(body.version) !== current.version) {
      return json(409, { error: 'conflict', version: current.version });
    }
    const data = {};
    for (const k of KEYS) {
      if (!Array.isArray(body[k])) return json(400, { error: `Campo inválido: ${k}` });
      data[k] = body[k];
    }
    data.budgetCaps = body.budgetCaps && typeof body.budgetCaps === 'object' && !Array.isArray(body.budgetCaps) ? body.budgetCaps : {};

    const next = { version: current.version + 1, data, updatedBy: user.email, updatedAt: new Date().toISOString() };
    await store.setJSON('data', next);
    return json(200, { version: next.version });
  }

  return json(405, { error: 'Método não permitido' });
};
