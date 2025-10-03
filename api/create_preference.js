// api/create_preference.js
const mercadopago = require('mercadopago');
const admin = require('firebase-admin');

function getDbOrThrow() {
  if (!admin.apps.length) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
    
    if (!projectId || !clientEmail || !privateKey) {
      throw new Error('Missing Firebase credentials');
    }

    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey })
    });
  }
  return admin.firestore();
}

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const db = getDbOrThrow();
    
    // Aceita tanto GET (com query) quanto POST (com body)
    const corridaId = req.query.corridaId || (req.body && req.body.corridaId);
    if (!corridaId) return res.status(400).json({ error: 'corridaId_required' });

    // Busca a corrida
    const corridaRef = db.collection('corridas').doc(String(corridaId));
    const corridaSnap = await corridaRef.get();
    if (!corridaSnap.exists) return res.status(404).json({ error: 'corrida_not_found' });
    const corrida = corridaSnap.data() || {};

    // Tenta pegar o preço da proposta aceita
    let precoCliente = 0;
    const motoristaUid = corrida.motoristaId || (corrida.propostaAceita && corrida.propostaAceita.motoristaUid);
    
    // Busca a proposta
    let proposta = null;
    if (motoristaUid) {
      const propostaRef = corridaRef.collection('propostas').doc(String(motoristaUid));
      const propostaSnap = await propostaRef.get();
      if (propostaSnap.exists) proposta = propostaSnap.data();
    }
    
    // Se não achou, pega a primeira proposta disponível
    if (!proposta) {
      const propostasSnap = await corridaRef.collection('propostas').limit(1).get();
      if (!propostasSnap.empty) proposta = propostasSnap.docs[0].data();
    }

    // Define o preço
    if (proposta) {
      if (typeof proposta.preco === 'number') {
        precoCliente = proposta.preco;
      } else if (proposta.precoOriginal && typeof proposta.precoOriginal.total === 'number') {
        precoCliente = Number((proposta.precoOriginal.total * 1.10).toFixed(2));
      }
    }

    if (!precoCliente) {
      return res.status(400).json({ 
        error: 'invalid_price', 
        hint: 'Não foi possível determinar o preço da corrida' 
      });
    }

    // Configura o Mercado Pago
    mercadopago.configure({
      access_token: process.env.MP_ACCESS_TOKEN
    });

    // Cria a preferência
    const preference = {
      items: [{
        title: `Corrida #${corridaId}`,
        quantity: 1,
        currency_id: 'BRL',
        unit_price: precoCliente
      }],
      back_urls: {
        success: 'https://moomate-omrw.vercel.app/pagamento_sucesso.html',
        pending: 'https://moomate-omrw.vercel.app/pagamento_pendente.html',
        failure: 'https://moomate-omrw.vercel.app/pagamento_erro.html'
      },
      auto_return: 'approved',
      external_reference: corridaId
    };

    const response = await mercadopago.preferences.create(preference);
    
    // Salva o ID da preferência na corrida
    await corridaRef.update({
      'pagamento.preferenceId': response.body.id,
      'pagamento.status': 'pending',
      'pagamento.atualizadoEm': admin.firestore.FieldValue.serverTimestamp()
    });

    // Retorna o link de pagamento
    return res.status(200).json({
      init_point: response.body.init_point,
      preference_id: response.body.id
    });

  } catch (error) {
    console.error('Erro no create_preference:', error);
    return res.status(500).json({ 
      error: 'internal_error',
      message: error.message 
    });
  }
};

// Força o Node.js 22.x
module.exports.config = { runtime: 'nodejs22.x' };