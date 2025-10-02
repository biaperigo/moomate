const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({ origin: true });

try { admin.initializeApp(); } catch {}
const db = admin.firestore();

function getAccessToken() {
  const fromEnv = process.env.MP_ACCESS_TOKEN || process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (fromEnv) return fromEnv;
  const fromConfig = functions.config()?.mercadopago?.token;
  if (fromConfig) return fromConfig;
  throw new Error('Mercado Pago Access Token not configured');
}

function getBaseUrls(req) {
  const origin = req.headers['x-forwarded-host'] || req.headers.host || '';
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const base = `${proto}://${origin}`;
  return base;
}

exports.create_preference = functions.https.onRequest(async (req, res) => {
  return cors(req, res, async () => {
    try {
      if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

      const auth = req.headers.authorization || '';
      if (!auth.startsWith('Bearer ')) return res.status(401).send('Unauthorized');
      const idToken = auth.substring(7);
      await admin.auth().verifyIdToken(idToken);

      const accessToken = getAccessToken();

      const { corridaId, valor, clienteId, items, back_urls, auto_return } = req.body || {};
      if (!corridaId) return res.status(400).json({ error: 'corridaId required' });

      const agRef = db.collection('agendamentos').doc(String(corridaId));
      const agSnap = await agRef.get();
      if (!agSnap.exists) return res.status(404).json({ error: 'agendamento not found' });
      const ag = agSnap.data() || {};

      const precoCliente = Number(ag?.propostaAceita?.preco || valor || 0);
      if (!Number.isFinite(precoCliente) || precoCliente <= 0) {
        return res.status(400).json({ error: 'invalid price' });
      }

      const desc = (ag?.tipo === 'descarte' ? 'Serviço de Descarte' : 'Corrida de Mudança') + ` - ${String(corridaId).slice(0, 8)}`;

      const baseUrl = getBaseUrls(req);
      const successUrl = back_urls?.success || `${baseUrl}/pagamento_sucesso.html?corrida=${encodeURIComponent(corridaId)}`;
      const failureUrl = back_urls?.failure || `${baseUrl}/pagamentoC.html?corrida=${encodeURIComponent(corridaId)}`;
      const pendingUrl = back_urls?.pending || `${baseUrl}/pagamentoC.html?corrida=${encodeURIComponent(corridaId)}`;

      const preference = {
        items: items && Array.isArray(items) && items.length ? items : [{
          title: desc,
          quantity: 1,
          unit_price: Number(precoCliente),
          currency_id: 'BRL'
        }],
        back_urls: { success: successUrl, failure: failureUrl, pending: pendingUrl },
        auto_return: auto_return || 'approved',
        metadata: {
          corridaId: String(corridaId),
          motoristaUid: ag?.motoristaId || ag?.propostaAceita?.motoristaUid || null,
          clienteUid: ag?.clienteId || clienteId || null
        }
      };

      // Create preference via Mercado Pago REST API
      const resp = await fetch('https://api.mercadopago.com/checkout/preferences', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(preference)
      });
      if (!resp.ok) throw new Error(`MP HTTP ${resp.status}`);
      const pref = await resp.json();

      await agRef.set({
        pagamento: {
          preferenceId: pref?.id || null,
          valor: Number(precoCliente),
          status: 'pendente',
          criadoEm: admin.firestore.FieldValue.serverTimestamp()
        },
        status: 'pagamento_pendente'
      }, { merge: true });

      return res.status(200).json({ init_point: pref?.init_point || pref?.sandbox_init_point, preference_id: pref?.id });
    } catch (e) {
      console.error('create_preference error:', e);
      return res.status(500).json({ error: 'internal_error', message: e?.message || String(e) });
    }
  });
});

exports.finalizar_pagamento = functions.https.onRequest(async (req, res) => {
  return cors(req, res, async () => {
    try {
      if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
      const { corridaId, paymentId } = req.body || {};
      if (!corridaId) return res.status(400).json({ error: 'corridaId required' });

      const agRef = db.collection('agendamentos').doc(String(corridaId));
      const agSnap = await agRef.get();
      if (!agSnap.exists) return res.status(404).json({ error: 'agendamento not found' });
      const ag = agSnap.data() || {};

      if (ag?.pagamento?.status === 'aprovado' && ag?.pagamento?.creditado === true) {
        return res.status(200).json({ ok: true, alreadyCredited: true });
      }

      const motoristaUid = ag?.motoristaId || ag?.propostaAceita?.motoristaUid || null;
      if (!motoristaUid) return res.status(400).json({ error: 'motoristaUid missing' });

      const credit = Number(ag?.propostaAceita?.precoOriginal?.totalMotorista || 0);
      if (!Number.isFinite(credit) || credit <= 0) return res.status(400).json({ error: 'invalid credit amount' });

      await db.runTransaction(async (tx) => {
        const now = admin.firestore.FieldValue.serverTimestamp();
        tx.set(agRef, { pagamento: { status: 'aprovado', creditado: true, paymentId: paymentId || null, atualizadoEm: now } }, { merge: true });

        const movRef = db.collection('movimentacoes').doc();
        tx.set(movRef, {
          tipo: 'credito_motorista',
          corridaId: String(corridaId),
          motoristaUid,
          valor: Number(credit),
          criadoEm: now
        });
      });

      return res.status(200).json({ ok: true });
    } catch (e) {
      console.error('finalizar_pagamento error:', e);
      return res.status(500).json({ error: 'internal_error', message: e?.message || String(e) });
    }
  });
});
