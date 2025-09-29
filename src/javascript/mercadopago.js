const express = require('express');
const mercadopago = require('mercadopago');
const admin = require('firebase-admin');
const cors = require('cors');

const app = express();

// Configurações
app.use(cors());
app.use(express.json());

// Inicializar Firebase Admin (coloque suas credenciais)
admin.initializeApp({
  credential: admin.credential.cert({
    // Suas credenciais do Firebase Admin SDK aqui
  })
});

// Configurar Mercado Pago (coloque seu Access Token)
mercadopago.configure({ 
  access_token: process.env.MERCADO_PAGO_ACCESS_TOKEN 
});

// Middleware para verificar autenticação
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

// Endpoint para criar preferência
app.post('/api/mercadopago/create-preference', verifyAuth, async (req, res) => {
  try {
    const { corridaId, valor, clienteId, items, back_urls } = req.body;
    
    // Validações
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

// Webhook para receber notificações
app.post('/api/mercadopago/webhook', async (req, res) => {
  try {
    const { id, topic } = req.body;
    
    if (topic === 'payment') {
      const payment = await mercadopago.payment.findById(id);
      const corridaId = payment.body.external_reference;
      
      // Determinar coleção (corridas ou descartes)
      let collection = 'corridas';
      
      // Atualizar no Firebase
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
      
      // Tentar atualizar em ambas as coleções
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

// =======================
// 4. CRIAR PÁGINAS DE RETORNO
// =======================

// Arquivo: pagamento-sucesso.html
/*
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pagamento Aprovado - Moomate</title>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            text-align: center; 
            padding: 50px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        .container {
            background: white;
            color: #333;
            padding: 40px;
            border-radius: 15px;
            max-width: 500px;
            margin: 0 auto;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
        }
        .success-icon { font-size: 60px; color: #28a745; margin-bottom: 20px; }
        .btn {
            background: #ff6c0c;
            color: white;
            padding: 15px 30px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 16px;
            margin: 10px;
            text-decoration: none;
            display: inline-block;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="success-icon">✅</div>
        <h1>Pagamento Aprovado!</h1>
        <p>Seu pagamento foi processado com sucesso.</p>
        <p>Obrigado por usar o Moomate!</p>
        <a href="homeC.html" class="btn">Voltar ao Início</a>
        <a href="historicoC.html" class="btn">Ver Histórico</a>
    </div>
</body>
</html>
*/

// Arquivo: pagamento-erro.html
/*

*/

// =======================
// 5. PACKAGE.JSON PARA O BACKEND
// =======================
/*
{
  "name": "moomate-backend",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "mercadopago": "^1.5.17",
    "firebase-admin": "^11.5.0",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "nodemon": "^2.0.20"
  }
}
*/

// =======================
// 6. VARIÁVEIS DE AMBIENTE (.env)
// =======================
/*
MERCADO_PAGO_ACCESS_TOKEN=
APP_USR-1427866074323098-091520-1b6505fd270447a2d31bfb4839dacaec-2695373344

BASE_URL=https://seu-dominio.com
PORT=3000
*/