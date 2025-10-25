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
      const valorTotal = Number(last.valor ?? qs2.get('valor') ?? 0);
      const corridaId = last.corridaId || qs2.get('corrida');
      
      if (!valorTotal || valorTotal <= 0) {
        ui.append('Valor do pagamento ausente.');
        return;
      }
      if (!corridaId) {
        ui.append('Corrida não encontrada para atribuir motorista.');
        return;
      }

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
      
      const tipoInferido = (()=>{
        const t = (corrida?.tipo||'').toString().toLowerCase();
        if (t) return t;
        if (origemColecao === 'descartes') return 'descarte';
        if (corrida?.agendamento === true) return 'agendamento';
        return 'mudanca';
      })();
      
      const motoristaId = corrida.motoristaId || corrida.propostaAceita?.motoristaUid;
      if (!motoristaId) {
        ui.append('Motorista da corrida não definido.');
        return;
      }
      // Crédito EXATO: (base digitada) + (R$100 x ajudantes) — sem pedágio, sem percentual
      const proposta = corrida.propostaAceita || (corrida.propostas && corrida.propostas[motoristaId]) || null;
      const base = Number(proposta?.precoOriginal?.base || proposta?.precoBase || 0) || 0;
      const qtdAjud = Number(proposta?.ajudantes?.quantidade || 0) || 0;
      const valorMotorista = Math.round((base + (qtdAjud * 100)) * 100) / 100;
      if (!(valorMotorista > 0)) {
        ui.append('Não foi possível determinar base + ajudantes da proposta. Crédito não aplicado.');
        return;
      }
      // Taxa da plataforma: diferença entre o que o cliente pagou e o que o motorista recebe
      const taxaPlataforma = Math.max(0, Math.round((valorTotal - valorMotorista) * 100) / 100);

      const motRef = db.collection('motoristas').doc(motoristaId);
      const corridaRef = db.collection(origemColecao).doc(corridaId);
      
      const txResult = await db.runTransaction(async (tx)=>{
        const [motSnap, corridaSnap] = await Promise.all([tx.get(motRef), tx.get(corridaRef)]);
        const ja = !!(corridaSnap.exists && corridaSnap.data()?.pagamento?.creditado === true);
        
        if (ja) return { already:true };
        
        const saldoAtual = Number((motSnap.exists ? (motSnap.data().saldo||0) : 0)) || 0;
        const novoSaldo = saldoAtual + valorMotorista;
        
        tx.set(motRef, { 
          saldo: novoSaldo, 
          saldoAtualizadoEm: firebase.firestore.FieldValue.serverTimestamp() 
        }, { merge: true });
        
        tx.set(corridaRef, { 
          pagamento: { 
            ...(corridaSnap.data()?.pagamento||{}), 
            creditado: true, 
            creditadoEm: firebase.firestore.FieldValue.serverTimestamp(),
            valorTotal: valorTotal,
            valorMotorista: valorMotorista,
            taxaPlataforma: taxaPlataforma
          } 
        }, { merge: true });
          // MUDANÇAS AQUI ↓↓↓
  tx.set(corridaRef, { 
    pagamento: { 
      ...(corridaSnap.data()?.pagamento||{}), 
      creditado: true, 
      creditadoEm: firebase.firestore.FieldValue.serverTimestamp(),
      valorTotal: valorTotal,
      valorMotorista: valorMotorista,
      taxaPlataforma: taxaPlataforma
    },
    status: 'em_andamento',        // ← NOVO: Inicia corrida
    corridaIniciada: true,          // ← NOVO: Marca como iniciada
    clienteDevePagar: false         // ← NOVO: Remove flag
  }, { merge: true });
        return { already:false };
      });
      
      if (!txResult?.already) {

        try {
          await db.collection('motoristas').doc(motoristaId)
            .collection('historico').add({
              tipo: 'credito_pagamento',
              origem: 'mercado_pago',
              corridaId,
              valor: valorMotorista,
              valorOriginal: valorTotal,
              taxaPlataforma: taxaPlataforma,
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
            valor: valorMotorista,
            valorOriginal: valorTotal,
            taxaPlataforma: taxaPlataforma,
            moeda: 'BRL',
            status: 'aprovado',
            origem: 'mercado_pago',
            tipo: 'recebimento',
            tipoServico: tipoInferido,
            criadoEm: firebase.firestore.FieldValue.serverTimestamp()
          });
        } catch(e) { console.warn('Falha ao registrar na coleção global:', e); }
      }

      
      try { localStorage.removeItem('lastPayment'); } catch{}
      
    } catch (e) {
      console.error(e);
      ui.append('Falha ao creditar saldo.');
    }
  }

  window.PagamentoSucesso = {
    creditarAgora: () => executarCredito({ forcar:true })
  };

  document.addEventListener('DOMContentLoaded', ()=>{
    if (!isTest) executarCredito({ forcar:false });
  });
})();