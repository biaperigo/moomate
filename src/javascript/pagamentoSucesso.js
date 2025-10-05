// Credita saldo do motorista após pagamento aprovado
// Requer Firebase compat (app, auth, firestore) carregado na página

(function(){
  const firebaseConfig = {
    apiKey: "AIzaSyB9ZuAW1F9rBfOtg3hgGpA6H7JFUoiTlhE",
    authDomain: "moomate-39239.firebaseapp.com",
    projectId: "moomate-39239",
    storageBucket: "moomate-39239.appspot.com",
    messagingSenderId: "637968714747",
    appId: "1:637968714747:web:ad15dc3571c22f046b595e",
    measurementId: "G-62J7Q8CKP4"
  };
  try{ if (!firebase.apps.length) firebase.initializeApp(firebaseConfig); }catch{}
  const db = firebase.firestore();

  const qs = new URLSearchParams(location.search);
  const status = qs.get('status') || qs.get('collection_status');
  const isTest = qs.get('test') === '1';

  const ui = {
    container: document.querySelector('.content') || document.body,
    append(msg){
      const p = document.createElement('p');
      p.textContent = msg;
      this.container && this.container.appendChild(p);
    }
  };

  async function executarCredito({ forcar=false }={}){
    try {
      if (!forcar && status && status.toLowerCase() !== 'approved') {
        ui.append('Pagamento não está aprovado. Nenhum crédito aplicado.');
        return;
      }
      const qs2 = new URLSearchParams(location.search);
      const last = JSON.parse(localStorage.getItem('lastPayment')||'{}');
      const valor = Number(last.valor ?? qs2.get('valor') ?? 0);
      const corridaId = last.corridaId || qs2.get('corrida');
      if (!valor || valor <= 0) {
        ui.append('Valor do pagamento ausente.');
        return;
      }
      if (!corridaId) {
        ui.append('Corrida não encontrada para atribuir motorista.');
        return;
      }

      // Buscar corrida em 'corridas' e, se não houver, em 'descartes'
      let corridaDoc = await db.collection('corridas').doc(corridaId).get();
      let origemColecao = 'corridas';
      if (!corridaDoc.exists) {
        corridaDoc = await db.collection('descartes').doc(corridaId).get();
        origemColecao = corridaDoc.exists ? 'descartes' : origemColecao;
      }
      if (!corridaDoc.exists) {
        ui.append('Documento da corrida não encontrado.');
        return;
      }
      const corrida = corridaDoc.data()||{};
      // Inferir tipo do serviço
      const tipoInferido = (()=>{
        const t = (corrida?.tipo||'').toString().toLowerCase();
        if (t) return t; // 'descarte' | 'mudanca' | 'agendamento' (se já existir)
        if (origemColecao === 'descartes') return 'descarte';
        if (corrida?.agendamento === true) return 'agendamento';
        return 'mudanca';
      })();
      const motoristaId = corrida.motoristaId || corrida.propostaAceita?.motoristaUid;
      if (!motoristaId) {
        ui.append('Motorista da corrida não definido.');
        return;
      }

      // Transação idempotente: só credita se a corrida ainda não estiver marcada como creditada
      const motRef = db.collection('motoristas').doc(motoristaId);
      const corridaRef = db.collection(origemColecao).doc(corridaId);
      const txResult = await db.runTransaction(async (tx)=>{
        const [motSnap, corridaSnap] = await Promise.all([ tx.get(motRef), tx.get(corridaRef) ]);
        const ja = !!(corridaSnap.exists && corridaSnap.data()?.pagamento?.creditado === true);
        if (ja) return { already:true };
        const saldoAtual = Number((motSnap.exists? (motSnap.data().saldo||0):0)) || 0;
        const novo = saldoAtual + valor;
        tx.set(motRef, { saldo: novo, saldoAtualizadoEm: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
        tx.set(corridaRef, { pagamento: { ...(corridaSnap.data()?.pagamento||{}), creditado: true, creditadoEm: firebase.firestore.FieldValue.serverTimestamp() } }, { merge: true });
        return { already:false };
      });

      // Registrar histórico apenas se acabou de creditar
      if (!txResult?.already) {
        try {
          await db.collection('motoristas').doc(motoristaId)
            .collection('historico').add({
              tipo: 'credito_pagamento',
              origem: 'mercado_pago',
              corridaId,
              valor,
              moeda: 'BRL',
              status: 'aprovado',
              tipoServico: tipoInferido,
              ts: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (e) { console.warn('Falha ao registrar histórico:', e); }

        try {
          await db.collection('historicotransacoesM').add({
            motoristaId,
            corridaId,
            valor,
            moeda: 'BRL',
            status: 'aprovado',
            origem: 'mercado_pago',
            tipo: 'recebimento',
            tipoServico: tipoInferido,
            criadoEm: firebase.firestore.FieldValue.serverTimestamp()
          });
        } catch(e) { console.warn('Falha ao registrar na coleção global:', e); }
      }

      ui.append(`Saldo do motorista (${motoristaId}) creditado: R$ ${valor.toFixed(2)}.`);
      try { localStorage.removeItem('lastPayment'); } catch{}
    } catch (e) {
      console.error(e);
      ui.append('Falha ao creditar saldo.');
    }
  }

  // expõe função global para ser chamada pelo botão "Voltar ao início"
  window.PagamentoSucesso = {
    creditarAgora: () => executarCredito({ forcar:true })
  };

  // dispara no load apenas se aprovado e não for aba de teste
  document.addEventListener('DOMContentLoaded', ()=>{
    if (!isTest) executarCredito({ forcar:false });
  });
})();
