// Vercel Serverless Function: Create Mercado Pago Preference (CommonJS)
// Env required: MP_ACCESS_TOKEN, FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY

const admin = require('firebase-admin');

function getDbOrThrow() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;
  if (!projectId || !clientEmail || !privateKeyRaw) {
    throw new Error('Missing Firebase Admin envs');
  }
  if (!admin.apps || !admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey: (privateKeyRaw || '').replace(/\\n/g, '\n')
      })
    });
  }
  return admin.firestore();
}

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  try {
    const db = getDbOrThrow();
    const { corridaId, items, back_urls, auto_return } = req.body || {};
    if (!corridaId) return res.status(400).json({ error: 'corridaId_required' });

    // Try in 'agendamentos', fallback to 'corridas'
    let collName = 'agendamentos';
    let ref = db.collection(collName).doc(String(corridaId));
    let snap = await ref.get();
    if (!snap.exists) {
      collName = 'corridas';
      ref = db.collection(collName).doc(String(corridaId));
      snap = await ref.get();
    }
    if (!snap.exists) return res.status(404).json({ error: 'document_not_found', collectionTried: ['agendamentos','corridas'] });
    const ag = snap.data() || {};

    // Determine price to charge the client
    let precoCliente = Number(ag?.propostaAceita?.preco || ag?.precoFinal || ag?.valor || ag?.preco || 0);
    if (!Number.isFinite(precoCliente) || precoCliente <= 0) {
      // Try to read proposta from common locations
      const motoristaUid = ag?.motoristaId || ag?.propostaAceita?.motoristaUid || null;
      const candidates = [collName, 'agendamentos', 'corridas', 'entregas', 'orcamentos'];
      let proposta = null;
      if (motoristaUid) {
        for (const c of candidates) {
          try {
            const pRef = db.collection(c).doc(String(corridaId)).collection('propostas').doc(String(motoristaUid));
            const pSnap = await pRef.get();
            if (pSnap.exists) { proposta = pSnap.data() || null; break; }
          } catch {}
        }
      }
      if (proposta) {
        // preço cobrado do cliente: proposta.preco (já inclui ajudantes + 10%)
        if (typeof proposta.preco === 'number') {
          precoCliente = Number(proposta.preco);
        } else if (proposta.precoOriginal && typeof proposta.precoOriginal.total === 'number') {
          // fallback: total do motorista + 10%
          precoCliente = Number((proposta.precoOriginal.total * 1.10).toFixed(2));
        }
      }
    }
    if (!Number.isFinite(precoCliente) || precoCliente <= 0) {
      return res.status(400).json({ error: 'invalid_price', hint: 'sem preco em documento/proposta' });
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
    await ref.set({
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

// Ensure Node.js runtime on Vercel
module.exports.config = { runtime: 'nodejs22.x' };
