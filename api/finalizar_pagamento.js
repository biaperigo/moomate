// Vercel Serverless Function: Finalizar Pagamento (credita motorista) - CommonJS
// Env required: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY

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
    const { corridaId, paymentId } = req.body || {};
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

    // idempotência
    if (ag?.pagamento?.status === 'aprovado' && ag?.pagamento?.creditado === true) {
      return res.status(200).json({ ok: true, alreadyCredited: true });
    }

    const motoristaUid = ag?.motoristaId || ag?.propostaAceita?.motoristaUid || null;
    if (!motoristaUid) return res.status(400).json({ error: 'motorista_missing' });

    const credit = Number(ag?.propostaAceita?.precoOriginal?.totalMotorista || 0);
    if (!Number.isFinite(credit) || credit <= 0) return res.status(400).json({ error: 'invalid_credit' });

    await db.runTransaction(async (tx) => {
      const now = admin.firestore.FieldValue.serverTimestamp();
      tx.set(ref, { pagamento: { status: 'aprovado', creditado: true, paymentId: paymentId || null, atualizadoEm: now } }, { merge: true });
      const movRef = db.collection('movimentacoes').doc();
      tx.set(movRef, { tipo: 'credito_motorista', corridaId: String(corridaId), motoristaUid, valor: Number(credit), criadoEm: now });
    });

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('finalizar_pagamento error:', e);
    return res.status(500).json({ error: 'internal_error', message: e?.message || String(e) });
  }
}
module.exports.config = { runtime: 'nodejs22.x' };