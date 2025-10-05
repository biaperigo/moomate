const express = require('express');
const cors = require('cors');
const path = require('path');
const { MercadoPagoConfig, Preference } = require('mercadopago');

// Configure with your Access Token (server-side secret)
const client = new MercadoPagoConfig({
  accessToken: 'APP_USR-1427866074323098-091520-1b6505fd270447a2d31bfb4839dacaec-2695373344',
});
const preference = new Preference(client);

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files so back_urls work, e.g., pagamento-sucesso.html
const staticDir = path.join(__dirname);
app.use(express.static(staticDir));

app.post('/create-mercadopago-preference', async (req, res) => {
  try {
    const { payer, items, payment_methods, back_urls, external_reference } = req.body || {};

    // Basic validation
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Items inválidos' });
    }

    const preferenceData = {
      items,
      payer,
      payment_methods,
      back_urls,
      auto_return: 'approved',
      binary_mode: true,
      external_reference,
      expires: true,
      expiration_date_from: new Date().toISOString(),
      expiration_date_to: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };

    const response = await preference.create({ body: preferenceData });

    return res.json({
      success: true,
      preference_id: response.id,
      init_point: response.init_point,
      sandbox_init_point: response.sandbox_init_point,
    });
  } catch (error) {
    console.error('Erro ao criar preferência:', error?.message || error);
    return res.status(500).json({ success: false, message: 'Erro interno do servidor' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
