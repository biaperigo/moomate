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

  const ui = {
    container: document.querySelector('.container'),
    append(msg){
      const p = document.createElement('p');
      p.textContent = msg;
      this.container && this.container.appendChild(p);
    }
  };

  async function creditarSaldo(){
    try {
      if (status && status.toLowerCase() !== 'approved') {
        ui.append('Pagamento não está aprovado. Nenhum crédito aplicado.');
        return;
      }
      const last = JSON.parse(localStorage.getItem('lastPayment')||'{}');
      const valor = Number(last.valor||0);
      const corridaId = last.corridaId;
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
      if (!corridaDoc.exists) {
        corridaDoc = await db.collection('descartes').doc(corridaId).get();
      }
      if (!corridaDoc.exists) {
        ui.append('Documento da corrida não encontrado.');
        return;
      }
      const corrida = corridaDoc.data()||{};
      const motoristaId = corrida.motoristaId || corrida.propostaAceita?.motoristaUid;
      if (!motoristaId) {
        ui.append('Motorista da corrida não definido.');
        return;
      }

      const motRef = db.collection('motoristas').doc(motoristaId);
      await db.runTransaction(async (tx)=>{
        const snap = await tx.get(motRef);
        const saldoAtual = Number((snap.exists? (snap.data().saldo||0):0)) || 0;
        const novo = saldoAtual + valor;
        tx.set(motRef, { saldo: novo, saldoAtualizadoEm: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
      });

      ui.append(`Saldo do motorista (${motoristaId}) creditado: R$ ${valor.toFixed(2)}.`);
      try { localStorage.removeItem('lastPayment'); } catch{}
    } catch (e) {
      console.error(e);
      ui.append('Falha ao creditar saldo.');
    }
  }

  // dispara no load
  document.addEventListener('DOMContentLoaded', creditarSaldo);
})();
