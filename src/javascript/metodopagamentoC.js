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

  metodoSelect.addEventListener('change', () => {
    if(metodoSelect.value === 'credito' || metodoSelect.value === 'debito'){
      cartaoFields.style.display = 'block';
    } else {
      cartaoFields.style.display = 'none';
    }
  });

  const form = document.getElementById('form-pagamento');
  const resultado = document.getElementById('resultado');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const metodo = metodoSelect.value;
    const params = new URLSearchParams(location.search);
    const corridaId = params.get('corrida') || localStorage.getItem('ultimaCorridaCliente') || undefined;

    // Busca 100% do valor direto do Firestore
    function parseNumeroBR(v){
      if (v === null || v === undefined) return NaN;
      if (typeof v === 'number') return v;
      const s = String(v).trim();
      if (!s) return NaN;
      // remove separador de milhar e troca vírgula por ponto
      const norm = s.replace(/\./g, '').replace(',', '.');
      const n = Number(norm);
      return Number.isFinite(n) ? n : NaN;
    }
    function pickValor(data){
      if (!data || typeof data !== 'object') return NaN;
      // Prioridade: usar 'preco' (ou 'preço') como valor da corrida
      const cand = [
        data.preco,
        data['preço'],
        data.valor,
        data.precoFinal,
        data.total,
        data.valorTotal,
        data.precoTotal,
        data.valorCorrida,
        data.precoEstimado,
        data.valorEstimado,
        data?.pagamento?.valor,
        data?.orcamento?.valor,
        data?.custo?.total,
      ];
      for (const v of cand){
        const n = parseNumeroBR(v);
        if (Number.isFinite(n) && n > 0) return n;
      }
      return NaN;
    }

    let valor = NaN;
    if (corridaId){
      try {
        let doc = await db.collection('corridas').doc(corridaId).get();
        if (!doc.exists) doc = await db.collection('descartes').doc(corridaId).get();
        const data = doc.exists ? (doc.data()||{}) : {};
        valor = pickValor(data);
      } catch {}
    }

    if (!Number.isFinite(valor) || valor <= 0) {
      // fallback: tenta por querystring/localStorage, senão avisa o usuário
      const qValor = params.get('valor') || localStorage.getItem('valorCorrida') || localStorage.getItem('valor');
      valor = parseNumeroBR(qValor);
    }

    if (!Number.isFinite(valor) || valor <= 0) {
      resultado.textContent = 'Não foi possível determinar o valor da corrida.';
      return;
    }
    // normaliza para 2 casas
    valor = Math.round(valor * 100) / 100;
    
    // Monta itens da preferência
    const items = [{
      title: 'Corrida Moomate',
      quantity: 1,
      unit_price: Number(valor),
      currency_id: 'BRL',
    }];
    
    // Restrições por método selecionado
    let payment_methods = {};
    if (metodo === 'pix') {
      payment_methods = { excluded_payment_types: [{ id: 'credit_card' }, { id: 'debit_card' }] };
    } else if (metodo === 'credito' || metodo === 'debito') {
      payment_methods = { excluded_payment_types: [{ id: 'ticket' }], installments: 12, default_installments: 1 };
    }
    
    const base = location.origin && location.origin.startsWith('http') ? location.origin : 'http://localhost:3000';
    const back_urls = {
      success: `${base}/pagamento-sucesso.html`,
      failure: `${base}/pagamento-erro.html`,
      pending: `${base}/pagamento-sucesso.html`
    };

    try {
      resultado.textContent = 'Criando preferência de pagamento...';
      const baseApi = base; // servidor Express exposto no mesmo host
      const resp = await fetch(`${baseApi}/create-mercadopago-preference`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          payment_methods,
          back_urls,
          external_reference: corridaId,
        })
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.message || 'Falha ao criar preferência');
      }
      const data = await resp.json();
      if (!data || !data.init_point) {
        throw new Error('Resposta inválida da API');
      }
      // Registro simples no Firestore (opcional)
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
      // Salva dados para crédito na carteira após retorno
      try {
        localStorage.setItem('lastPayment', JSON.stringify({ valor, corridaId }));
      } catch {}
      // Redireciona para o checkout do Mercado Pago
      window.location.href = data.init_point;
    } catch (err) {
      console.error(err);
      resultado.textContent = `Erro ao iniciar pagamento: ${err.message || err}`;
    }
  });
