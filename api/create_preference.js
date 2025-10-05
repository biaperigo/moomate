const { MercadoPagoConfig, Preference } = require('mercadopago');

// Vercel serverless function
// Set MP_ACCESS_TOKEN in the Vercel project environment variables
module.exports = async (req, res) => {
  // CORS basic
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method Not Allowed' });

  try {
    const accessToken = process.env.MP_ACCESS_TOKEN;
    if (!accessToken) {
      return res.status(500).json({ success: false, message: 'Missing MP_ACCESS_TOKEN env' });
    }

    const client = new MercadoPagoConfig({ accessToken });
    const preference = new Preference(client);

    const { items, payer, payment_methods, back_urls, external_reference } = req.body || {};

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

    return res.status(200).json({
      success: true,
      preference_id: response.id,
      init_point: response.init_point,
      sandbox_init_point: response.sandbox_init_point,
    });
  } catch (error) {
    console.error('Vercel create_preference error:', error?.message || error);
    return res.status(500).json({ success: false, message: 'Erro interno do servidor' });
  }
};
