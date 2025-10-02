// Vercel Serverless Function: Finalizar Pagamento (credita motorista)
// Env required: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY

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
    const { corridaId, paymentId } = req.body || {};
    if (!corridaId) return res.status(400).json({ error: 'corridaId_required' });

    const agRef = db.collection('agendamentos').doc(String(corridaId));
    const agSnap = await agRef.get();
    if (!agSnap.exists) return res.status(404).json({ error: 'agendamento_not_found' });
    const ag = agSnap.data() || {};

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
      tx.set(agRef, { pagamento: { status: 'aprovado', creditado: true, paymentId: paymentId || null, atualizadoEm: now } }, { merge: true });
      const movRef = db.collection('movimentacoes').doc();
      tx.set(movRef, { tipo: 'credito_motorista', corridaId: String(corridaId), motoristaUid, valor: Number(credit), criadoEm: now });
    });

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('finalizar_pagamento error:', e);
    return res.status(500).json({ error: 'internal_error', message: e?.message || String(e) });
  }
}
