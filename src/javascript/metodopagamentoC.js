// --- Inicializa Firebase ---
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

// --- Inicializa Mercado Pago ---
const mp = new MercadoPago('SEU_PUBLIC_KEY_AQUI', {locale: 'pt-BR'});

// --- Mostra campos de cartão se necessário ---
const metodoSelect = document.getElementById('metodo');
const cartaoFields = document.getElementById('cartao-fields');

metodoSelect.addEventListener('change', () => {
  if(metodoSelect.value === 'credito' || metodoSelect.value === 'debito'){
    cartaoFields.style.display = 'block';
  } else {
    cartaoFields.style.display = 'none';
  }
});

// --- Formulário de pagamento ---
const form = document.getElementById('form-pagamento');
const resultado = document.getElementById('resultado');

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const metodo = metodoSelect.value;

  if(metodo === 'pix'){
    resultado.innerHTML = 'Gerando QR Code PIX...';

    // Criar pagamento PIX via Mercado Pago
    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer SEU_ACCESS_TOKEN',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        items: [{title: "Corrida Moomate", quantity: 1, unit_price: 10}],
        payment_methods: {excluded_payment_types:[{id:"credit_card"}]}
      })
    });
    const data = await response.json();
    resultado.innerHTML = `<a href="${data.init_point}" target="_blank">Pagar com PIX</a>`;

    // Salvar no Firebase
    db.collection('pagamentos').add({
      metodo,
      valor: 10,
      status: 'pendente',
      data: new Date()
    });
  } else {
    // Salvar cartão (apenas info segura)
    const nome = document.getElementById('nome-cartao').value;
    const numero = document.getElementById('numero-cartao').value;
    const validade = document.getElementById('validade-cartao').value;

    db.collection('cartoes').add({
      metodo,
      nome,
      numeroFinal: numero.slice(-4),
      validade,
      data: new Date()
    });

    resultado.innerHTML = 'Cartão cadastrado com sucesso! O pagamento será processado via Mercado Pago.';
  }
});
