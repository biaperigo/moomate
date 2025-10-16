const express = require('express');
const mercadopago = require('mercadopago');
const admin = require('firebase-admin');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

admin.initializeApp({
  credential: admin.credential.cert({
  })
});

mercadopago.configure({ 
  access_token: process.env.MERCADO_PAGO_ACCESS_TOKEN 
});

async function verifyAuth(req, res, next) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }
    
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Token inválido' });
  }
}

app.post('/api/mercadopago/create-preference', verifyAuth, async (req, res) => {
  try {
    const { corridaId, valor, clienteId, items, back_urls } = req.body;

    if (!corridaId || !valor || valor <= 0) {
      return res.status(400).json({ error: 'Dados inválidos' });
    }
    
    const preference = {
      items,
      back_urls,
      auto_return: 'approved',
      external_reference: corridaId,
      payment_methods: {
        excluded_payment_methods: [],
        installments: 12,
        default_installments: 1
      },
      payer: {
        email: req.user.email || `${clienteId}@moomateapp.com`
      },
      notification_url: `${process.env.BASE_URL}/api/mercadopago/webhook`
    };
    
    const response = await mercadopago.preferences.create(preference);
    
    res.json({ 
      init_point: response.body.init_point, 
      preference_id: response.body.id 
    });
    
  } catch (error) {
    console.error('Erro ao criar preferência:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.post('/api/mercadopago/webhook', async (req, res) => {
  try {
    const { id, topic } = req.body;
    
    if (topic === 'payment') {
      const payment = await mercadopago.payment.findById(id);
      const corridaId = payment.body.external_reference;
      
      let collection = 'corridas';
     
      const updateData = {
        'pagamento.status': payment.body.status,
        'pagamento.paymentId': payment.body.id,
        'pagamento.atualizadoEm': admin.firestore.FieldValue.serverTimestamp()
      };
      
      if (payment.body.status === 'approved') {
        updateData.status = 'finalizada';
      } else if (payment.body.status === 'rejected') {
        updateData.status = 'pagamento_rejeitado';
      }
 
      try {
        await admin.firestore().collection('corridas').doc(corridaId).update(updateData);
      } catch (e) {
        await admin.firestore().collection('descartes').doc(corridaId).update(updateData);
      }
    }
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).send('Error');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

