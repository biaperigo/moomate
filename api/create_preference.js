// Vercel Serverless Function: Create Mercado Pago Preference
// Env required: MP_ACCESS_TOKEN, FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY

import admin from 'firebase-admin';

let app;
try {
  if (!admin.apps?.length) {
    app = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n')
      })
    });
  }
} catch {}

const db = admin.firestore();

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  try {
    const { corridaId, items, back_urls, auto_return } = req.body || {};
    if (!corridaId) return res.status(400).json({ error: 'corridaId_required' });

    const agRef = db.collection('agendamentos').doc(String(corridaId));
    const agSnap = await agRef.get();
    if (!agSnap.exists) return res.status(404).json({ error: 'agendamento_not_found' });
    const ag = agSnap.data() || {};

    const precoCliente = Number(ag?.propostaAceita?.preco || 0);
    if (!Number.isFinite(precoCliente) || precoCliente <= 0) {
      return res.status(400).json({ error: 'invalid_price' });
    }

    const desc = (ag?.tipo === 'descarte' ? 'Serviço de Descarte' : 'Corrida de Mudança') + ` - ${String(corridaId).slice(0,8)}`;

    const baseUrl = req.headers['x-forwarded-proto'] + '://' + req.headers['x-forwarded-host'];
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
        clienteUid: ag?.clienteId || null
      }
    };

    // Call Mercado Pago REST API
    const mpResp = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(preference)
    });
    if (!mpResp.ok) {
      const t = await mpResp.text();
      throw new Error(`MP HTTP ${mpResp.status} ${t}`);
    }
    const pref = await mpResp.json();

    // Save status
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
}
