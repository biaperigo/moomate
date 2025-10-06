const firebaseConfig = {
    apiKey: "AIzaSyB9ZuAW1F9rBfOtg3hgGpA6H7JFUoiTlhE",
    authDomain: "moomate-39239.firebaseapp.com",
    projectId: "moomate-39239",
    storageBucket: "moomate-39239.appspot.com",
    messagingSenderId: "637968714747",
    appId: "1:637968714747:web:ad15dc3571c22f046b595e",
    measurementId: "G-62J7Q8CKP4"
  };
  firebase.initializeApp(firebaseConfig);
  const db = firebase.firestore();
 
// Inicializa SDK Mercado Pago no front com sua Public Key
const mp = new MercadoPago('APP_USR-411b4926-6fcf-4838-8db8-4c4ae88da3c4', { locale: 'pt-BR' });

  const metodoSelect = document.getElementById('metodo');
  const cartaoFields = document.getElementById('cartao-fields');

  metodoSelect.addEventListener('change', async () => {
    if(metodoSelect.value === 'credito' || metodoSelect.value === 'debito'){
      cartaoFields.style.display = 'block';
    } else {
      cartaoFields.style.display = 'none';
    }

    const metodo = metodoSelect.value;
    const params = new URLSearchParams(location.search);
    const corridaId = params.get('corrida') || localStorage.getItem('ultimaCorridaCliente') || undefined;

    // Helpers
    function parseNumeroBR(v){
      if (v === null || v === undefined) return NaN;
      if (typeof v === 'number') return v;
      const s = String(v).trim();
      if (!s) return NaN;
      const norm = s.replace(/\./g, '').replace(',', '.');
      const n = Number(norm);
      return Number.isFinite(n) ? n : NaN;
    }
    function pickValor(data){
      if (!data || typeof data !== 'object') return NaN;
      const p1 = parseNumeroBR(data?.preco);
      if (Number.isFinite(p1) && p1 > 0) return p1;
      const p2 = parseNumeroBR(data?.['preço']);
      if (Number.isFinite(p2) && p2 > 0) return p2;
      return NaN;
    }

    // 1) Buscar documento e obter PRECO
    let valor = NaN;
    try {
      let doc = await db.collection('corridas').doc(corridaId).get();
      if (!doc.exists) doc = await db.collection('descartes').doc(corridaId).get();
      const data = doc.exists ? (doc.data()||{}) : {};
      valor = pickValor(data);
      console.log('[MP] corridaId=', corridaId, 'preco=', data?.preco, 'preço=', data?.['preço'], 'valorUsado=', valor);
    } catch {}

    if (!Number.isFinite(valor) || valor <= 0) {
      resultado.textContent = 'Preço da corrida não encontrado no documento.';
      return;
    }

    // 2) Montar items com 100% do PRECO
    const items = [{
      title: 'Corrida Moomate',
      quantity: 1,
      unit_price: Number(valor),
      currency_id: 'BRL',
    }];

    // 3) Restrições por método selecionado
    let payment_methods = {};
    if (metodo === 'pix') {
      payment_methods = { excluded_payment_types: [{ id: 'credit_card' }, { id: 'debit_card' }] };
    } else if (metodo === 'credito' || metodo === 'debito') {
      payment_methods = { excluded_payment_types: [{ id: 'ticket' }], installments: 12, default_installments: 1 };
    }

    // 4) back_urls e chamada ao backend
    const base = location.origin && location.origin.startsWith('http') ? location.origin : 'http://localhost:3000';
    const back_urls = {
      success: `${base}/pagamento-sucesso.html`,
      failure: `${base}/pagamento-erro.html`,
      pending: `${base}/pagamento-sucesso.html`
    };

    try {
      resultado.textContent = 'Criando preferência de pagamento...';
      const baseApi = base;
      const resp = await fetch(`${baseApi}/create-mercadopago-preference`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, payment_methods, back_urls, external_reference: corridaId })
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.message || 'Falha ao criar preferência');
      }
      const data = await resp.json();
      if (!data || !data.init_point) throw new Error('Resposta inválida da API');

      try {
        await db.collection('pagamentos').add({
          metodo,
          valor,
          status: 'pendente',
          createdAt: new Date(),
          corridaId: corridaId || null,
          preferenceId: data.preference_id || null,
        });
      } catch {}
      try { localStorage.setItem('lastPayment', JSON.stringify({ valor, corridaId })); } catch {}
      window.location.href = data.init_point;
    } catch (err) {
      console.error(err);
      resultado.textContent = `Erro ao iniciar pagamento: ${err.message || err}`;
    }
  });
