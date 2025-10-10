// saldoM.js – Solicitar saque do saldo do motorista
// Requer Firebase compat (app, auth, firestore) carregado em saldoM.html

(function(){
  // Menu toggle (se existir na página)
  try {
    const menuToggle = document.getElementById('menuToggle');
    const navMenu = document.getElementById('navMenu');
    menuToggle?.addEventListener('click', ()=> navMenu?.classList.toggle('show'));
  } catch{}

  // Firebase init (compat)
  const firebaseConfig = {
    apiKey: "AIzaSyB9ZuAW1F9rBfOtg3hgGpA6H7JFUoiTlhE",
    authDomain: "moomate-39239.firebaseapp.com",
    projectId: "moomate-39239",
    storageBucket: "moomate-39239.appspot.com",
    messagingSenderId: "637968714747",
    appId: "1:637968714747:web:ad15dc3571c22f046b595e",
    measurementId: "G-62J7Q8CKP4"
  };
  try { if (!firebase.apps.length) firebase.initializeApp(firebaseConfig); } catch{}
  const db = firebase.firestore();

  const form = document.getElementById('form-saque');
  const valorInput = document.getElementById('valor');
  const metodoSel = document.getElementById('metodo');
  const resultado = document.getElementById('resultado');
  const saldoEl = document.getElementById('saldoDisponivel');

  function formatBRL(n){
    try { return Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); } catch { return `R$ ${Number(n||0).toFixed(2)}`; }
  }

  function getUid(){
    // Tenta auth, ou fallback no localStorage
    try { const u = firebase.auth?.().currentUser; if (u?.uid) return u.uid; } catch{}
    return localStorage.getItem('motoristaUid') || localStorage.getItem('uid') || null;
  }

  async function getIdToken(){
    try { const u = firebase.auth?.().currentUser; if (u) return await u.getIdToken(); } catch{}
    return null;
  }

  async function obterWithdrawEndpoint(){
    try { if (window.MP_WITHDRAW_ENDPOINT) return String(window.MP_WITHDRAW_ENDPOINT); } catch{}
    try {
      const snap = await db.collection('config').doc('mercadopago').get();
      const d = snap.exists ? (snap.data()||{}) : {};
      if (d.withdrawEndpoint) return String(d.withdrawEndpoint);
    } catch{}
    return null;
  }

  async function carregarSaldo(uid){
    try{
      const snap = await db.collection('motoristas').doc(uid).get();
      const saldo = Number(snap.exists ? (snap.data().saldo||0) : 0) || 0;
      return saldo;
    }catch{ return 0; }
  }

  async function solicitarSaque(evt){
    evt?.preventDefault?.();
    resultado.style.display = 'none';
    const uid = getUid();
    if (!uid){
      mostrar('Falha ao identificar motorista. Faça login novamente.', true);
      return;
    }

    const valor = Number(valorInput.value);
    const metodo = (metodoSel.value||'').toLowerCase();
    if (!Number.isFinite(valor) || valor <= 0){
      mostrar('Informe um valor válido para saque.', true); return;
    }
    if (!metodo){ mostrar('Selecione o método de saque.', true); return; }

    // Debitar saldo via transação e registrar solicitações/histórico
    const motRef = db.collection('motoristas').doc(uid);
    try{
      // Se método for conta, garantir que dados bancários existem
      let dadosBancarios = null;
      if (metodo === 'conta') {
        const mSnap = await motRef.get();
        dadosBancarios = mSnap.exists ? (mSnap.data().dadosBancarios||null) : null;
        if (!dadosBancarios || !dadosBancarios.banco || !dadosBancarios.conta) {
          mostrar('Complete sua conta bancária em Conta Bancária antes de solicitar por conta.', true);
          return;
        }
      }

      let provider = null, providerId = null, providerStatus = 'pendente', providerInfo = {};
      if (metodo === 'pix'){
        const endpoint = await obterWithdrawEndpoint();
        const token = await getIdToken();
        if (!endpoint || !token){ mostrar('Saque PIX indisponível no momento.', true); return; }
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ valor })
        });
        if (!res.ok){
          const txt = await res.text().catch(()=> '');
          console.warn('Withdraw PIX falhou:', res.status, txt);
          mostrar('Falha ao iniciar saque PIX. Tente novamente mais tarde.', true);
          return;
        }
        const data = await res.json().catch(()=>({}));
        provider = 'mercado_pago';
        providerId = data.id || data.transfer_id || null;
        providerStatus = data.status || 'processando';
        providerInfo = { pix_copy_paste: data.pix_copy_paste||null, pix_qr_base64: data.pix_qr_base64||null };
      }

      // Executa débito do saldo somente após iniciar a ordem externa (no caso PIX)
      await db.runTransaction(async (tx)=>{
        const snap = await tx.get(motRef);
        const saldoAtual = Number(snap.exists ? (snap.data().saldo||0) : 0) || 0;
        if (valor > saldoAtual) throw new Error('Saldo insuficiente');
        tx.update(motRef, {
          saldo: saldoAtual - valor,
          saldoAtualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
        });
      });

      // Criar registro da solicitação de saque
      const payloadSaque = {
        motoristaId: uid,
        valor,
        metodo, // 'pix' ou 'conta'
        dadosBancarios: metodo==='conta' ? dadosBancarios : null,
        status: metodo==='pix' ? (providerStatus||'processando') : 'pendente',
        provider: provider,
        providerId: providerId,
        providerInfo: providerInfo,
        criadoEm: firebase.firestore.FieldValue.serverTimestamp()
      };
      const saqueRef = await db.collection('saques').add(payloadSaque);

      // Histórico do motorista
      await db.collection('motoristas').doc(uid).collection('historico').add({
        tipo: 'solicitacao_saque',
        valor,
        metodo,
        status: payloadSaque.status,
        saqueId: saqueRef.id,
        ts: firebase.firestore.FieldValue.serverTimestamp()
      });

      mostrar(`Saque ${metodo.toUpperCase()} iniciado no valor de ${formatBRL(valor)}.`, false);
      // Atualiza saldo exibido
      const novoSaldo = await carregarSaldo(uid);
      if (saldoEl) saldoEl.textContent = `Saldo disponível: ${formatBRL(novoSaldo)}`;
    } catch (e){
      console.error('Erro no saque:', e);
      mostrar(e?.message === 'Saldo insuficiente' ? 'Saldo insuficiente.' : 'Falha ao solicitar saque.', true);
    }
  }

  function mostrar(msg, erro=false){
    resultado.textContent = msg;
    resultado.style.display = 'block';
    resultado.style.color = erro ? '#b00020' : '#1f7a1f';
  }

  form?.addEventListener('submit', solicitarSaque);

  (async ()=>{
    const uid = getUid();
    if (uid){
      const saldo = await carregarSaldo(uid);
      if (saldoEl) saldoEl.textContent = `Saldo disponível: ${formatBRL(saldo)}`;
    } else if (saldoEl) {
      saldoEl.textContent = 'Não autenticado';
    }
  })();
}());