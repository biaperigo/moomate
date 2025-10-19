const express = require('express');
const cors = require('cors');
const path = require('path');
const { MercadoPagoConfig, Preference } = require('mercadopago');

const client = new MercadoPagoConfig({
  accessToken: 'APP_USR-7882839633515337-101914-30042a2edb609bc7ff571c7cfd6b8e06-2932784581',
});
const preference = new Preference(client);

const app = express();
app.use(cors());
app.use(express.json());

const staticDir = path.join(__dirname);
app.use(express.static(staticDir));

function getBaseUrl(req){
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
  return `${proto}://${host}`;
}

async function createPreferenceHandler(req, res){
  try {
    const { payer, items, payment_methods, back_urls, external_reference, metadata } = req.body || {};

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Items inválidos' });
    }

    const corridaId = (external_reference || req.query.corrida || items?.[0]?.id || metadata?.corridaId || '').toString();
    const unitPrice = Number(items?.[0]?.unit_price || items?.[0]?.unitPrice || 0);
    const quantity = Number(items?.[0]?.quantity || 1);
    const valor = Number.isFinite(unitPrice*quantity) ? unitPrice*quantity : unitPrice;

    const baseUrl = getBaseUrl(req);
    const defaultBackUrls = {
      success: `${baseUrl}/pagamento-sucesso.html?status=approved${corridaId?`&corrida=${encodeURIComponent(corridaId)}`:''}${Number(valor)>0?`&valor=${encodeURIComponent(String(valor))}`:''}`,
      failure: `${baseUrl}/pagamento-erro.html` ,
      pending: `${baseUrl}/pagamento-erro.html`
    };

    const preferenceData = {
      items,
      payer,
      payment_methods,
      back_urls: back_urls || defaultBackUrls,
      auto_return: 'approved',
      binary_mode: true,
      external_reference: corridaId || external_reference,
      metadata: { ...(metadata||{}), corridaId, valor },
      expires: true,
      expiration_date_from: new Date().toISOString(),
      expiration_date_to: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };

    try {
      console.log('[MP][create] items recebidos:', JSON.stringify(items));
      console.log('[MP][create] valor calculado:', valor, 'external_reference:', corridaId || external_reference);
      console.log('[MP][create] back_urls usadas:', preferenceData.back_urls);
    } catch {}

    const response = await preference.create({ body: preferenceData });

    return res.json({
      success: true,
      preference_id: response.id,
      init_point: response.init_point,
      sandbox_init_point: response.sandbox_init_point,
      back_urls: preferenceData.back_urls,
    });
  } catch (error) {
    console.error('Erro ao criar preferência:', error?.message || error);
    return res.status(500).json({ success: false, message: 'Erro interno do servidor' });
  }
}

app.post('/create-mercadopago-preference', createPreferenceHandler);
app.post('/api/create-mercadopago-preference', createPreferenceHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
