(function(){
  try {
    document.getElementById('menuToggle')?.addEventListener('click', ()=>{
      document.getElementById('navMenu')?.classList.toggle('show');
    });
  } catch{}

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

  const listEl = document.getElementById('lista-transacoes');

  function getUid(){
    try { const u = firebase.auth?.().currentUser; if (u?.uid) return u.uid; } catch{}
    const qs = new URLSearchParams(location.search);
    const fromQuery = qs.get('uid');
    const fromLs = localStorage.getItem('motoristaUid')
      || localStorage.getItem('uid')
      || localStorage.getItem('userId')
      || localStorage.getItem('userUid')
      || localStorage.getItem('motoristaId');
    return fromQuery || fromLs || null;
  }
  function formatBRL(n){ try { return Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); } catch { return `R$ ${Number(n||0).toFixed(2)}`; } }
  function fmtDate(ts){
    try{
      const d = ts?.toDate ? ts.toDate() : (ts?.seconds ? new Date(ts.seconds*1000) : new Date(ts));
      return d.toLocaleString('pt-BR',{ dateStyle:'short', timeStyle:'short' });
    }catch{ return ''; }
  }
  function shortId(id){ return (id||'').toString().slice(0,8); }

  function render(items){
    if (!listEl) return;
    listEl.innerHTML = '';
    if (!items.length){
      const p = document.createElement('p');
      p.textContent = 'Nenhuma transação encontrada.';
      p.style.color = '#666';
      p.style.textAlign = 'center';
      listEl.appendChild(p);
      return;
    }
    items.forEach(it=>{
      const card = document.createElement('div');
      card.className = `transacao-card ${it.tipo==='saque' ? 'retirada' : 'recebido'}`;
      const wrap = document.createElement('div'); wrap.className = 'transacao-info';
      const texto = document.createElement('div'); texto.className = 'texto';
      const strong = document.createElement('strong');
      if (it.tipo === 'saque') strong.textContent = `Saque ${it.metodo?.toUpperCase?.()||''}`.trim();
      else strong.textContent = `Recebido por ${ (it.tipoServico||'serviço').toString().toUpperCase() } · ${shortId(it.corridaId)}`;
      const span = document.createElement('span'); span.textContent = fmtDate(it.ts||it.criadoEm);
      texto.appendChild(strong); texto.appendChild(span);
      const valor = document.createElement('div'); valor.className = `valor ${it.tipo==='saque'?'saida':''}`;
      valor.textContent = `${it.tipo==='saque' ? '-' : '+'} ${formatBRL(it.valor)}`;
      wrap.appendChild(texto); wrap.appendChild(valor);
      card.appendChild(wrap);
      listEl.appendChild(card);
    });
  }

  async function load(){
    let uid = getUid();
    if (!uid){

      try {
        const u = firebase.auth?.().currentUser;
        let email = u?.email;
        if (!email) {
          email = localStorage.getItem('email') || localStorage.getItem('userEmail') || null;
        }
        if (email) {
          const qs = await db.collection('motoristas').where('email','==',email).limit(1).get();
          if (!qs.empty) uid = qs.docs[0].id;
        }
      } catch {}
    }
    if (!uid){

      try {
        const qs = new URLSearchParams(location.search);
        const corridaId = qs.get('corrida') || localStorage.getItem('ultimaCorridaMotorista') || localStorage.getItem('corridaSelecionada');
        if (corridaId){
          let doc = await db.collection('corridas').doc(corridaId).get();
          if (!doc.exists) doc = await db.collection('descartes').doc(corridaId).get();
          const data = doc.data()||{};
          uid = data.motoristaId || data.propostaAceita?.motoristaUid || uid;
        }
      } catch{}
    }
    if (!uid){
      console.warn('[Historico] Sem UID. Adicione ?uid=SEU_UID à URL ou faça login.');
      const p = document.createElement('p');
      p.textContent = 'Identificação do motorista não encontrada. Faça login ou abra com ?uid=SEU_UID.';
      p.style.textAlign = 'center'; p.style.color = '#666';
      listEl.innerHTML = ''; listEl.appendChild(p);
      return;
    }

    const recqs = await db.collection('historicotransacoesM')
      .where('motoristaId','==',uid)
      .where('tipo','==','recebimento')
      .orderBy('criadoEm','desc')
      .limit(100)
      .get();
    const recebimentos = [];
    recqs.forEach(d=> recebimentos.push({ id:d.id, ...d.data(), tipo:'recebimento' }));
    console.log('[Historico] Recebimentos:', recebimentos.length);

    const sq = await db.collection('saques')
      .where('motoristaId','==',uid)
      .orderBy('criadoEm','desc')
      .limit(100)
      .get();
    const saques = [];
    sq.forEach(d=> saques.push({ id:d.id, ...d.data(), tipo:'saque' }));
    console.log('[Historico] Saques:', saques.length);

    const all = recebimentos.concat(saques).sort((a,b)=>{
      const ta = (a.criadoEm?.toMillis?.()||0); const tb = (b.criadoEm?.toMillis?.()||0);
      return tb - ta;
    });
    render(all);
  }

  document.addEventListener('DOMContentLoaded', load);
})();
document.getElementById("menuToggle").addEventListener("click", () => {
      document.getElementById("navMenu").classList.toggle("show");
    });