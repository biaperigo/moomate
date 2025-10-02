// Simple health check to validate envs and Firebase Admin init
const admin = require('firebase-admin');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const result = {
    ok: true,
    envs: {
      MP_ACCESS_TOKEN: !!process.env.MP_ACCESS_TOKEN,
      FIREBASE_PROJECT_ID: !!process.env.FIREBASE_PROJECT_ID,
      FIREBASE_CLIENT_EMAIL: !!process.env.FIREBASE_CLIENT_EMAIL,
      FIREBASE_PRIVATE_KEY: !!process.env.FIREBASE_PRIVATE_KEY
    },
    adminInitialized: false
  };

  try {
    if (!admin.apps || !admin.apps.length) {
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey: (privateKeyRaw || '').replace(/\\n/g, '\n')
        })
      });
    }
    result.adminInitialized = true;
    // Try a lightweight call: just return success
    return res.status(200).json(result);
  } catch (e) {
    result.ok = false;
    result.error = String(e && e.message ? e.message : e);
    return res.status(500).json(result);
  }
}
