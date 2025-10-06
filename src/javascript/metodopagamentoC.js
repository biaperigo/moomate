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
    
    // Busca o valor do preço do Firebase
    let valor = 10; // valor padrão
    try {
      if (corridaId) {
        resultado && (resultado.textContent = 'Buscando informações da corrida...');
        console.log('[Pagamento] Buscando corrida com ID:', corridaId);
        let doc = await db.collection('corridas').doc(corridaId).get();
        if (!doc.exists) {
          console.log('[Pagamento] Documento não está em corridas, tentando descartes...');
          doc = await db.collection('descartes').doc(corridaId).get();
        }
        if (doc.exists) {
          const data = doc.data() || {};
          const preco = data.preco ?? data['preço'];
          let v;
          if (typeof preco === 'number') {
            v = preco;
          } else if (typeof preco === 'string') {
            const s = preco.trim();
            if (s.includes(',')) {
              const norm = s.replace(/\./g, '').replace(',', '.');
              v = parseFloat(norm);
            } else {
              v = parseFloat(s);
            }
          } else {
            v = Number(preco);
          }
          if (Number.isFinite(v) && v > 0) {
            valor = Math.round(v * 100) / 100;
          }
          console.log('[Pagamento] Documento encontrado. preco bruto=', preco, 'valor usado=', valor);
        } else {
          console.warn('[Pagamento] Documento de corrida/descartes não encontrado para', corridaId);
        }
      } else {
        console.warn('[Pagamento] corridaId não encontrado');
      }
    } catch (err) {
      console.error('[Pagamento] Erro ao buscar preço:', err);
      // Mantém valor padrão em caso de erro
    }
    
    // Monta itens da preferência
    console.log('[Pagamento] Enviando items para MP com valor:', valor);
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
    // back_urls serão definidos no servidor para incluir parametros úteis

    try {
      resultado.textContent = 'Criando preferência de pagamento...';
      const baseApi = base; // servidor Express exposto no mesmo host
      const resp = await fetch(`${baseApi}/create-mercadopago-preference`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          payment_methods,
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