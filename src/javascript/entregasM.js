;(async () => {

  function loadScript(src){
    return new Promise((resolve,reject)=>{
      const s=document.createElement('script'); s.src=src; s.onload=resolve; s.onerror=reject; document.head.appendChild(s);
    });
  }
  async function ensureFirebase(){
    if(!window.firebase){
      await loadScript('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
      await loadScript('https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js');
      await loadScript('https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js');
    }
    const firebaseConfig = {
      apiKey: "AIzaSyB9ZuAW1F9rBfOtg3hgGpA6H7JFUoiTlhE",
      authDomain: "moomate-39239.firebaseapp.com",
      projectId: "moomate-39239",
      storageBucket: "moomate-39239.appspot.com",
      messagingSenderId: "637968714747",
      appId: "1:637968714747:web:ad15dc3571c22f046b595e",
      measurementId: "G-62J7Q8CKP4"
    };
    try{ if(!firebase.apps.length) firebase.initializeApp(firebaseConfig); }catch{}
  }
  await ensureFirebase();
  const tabs = document.querySelectorAll('.tab');
  const contents = document.querySelectorAll('.tab-content');
  const menuToggle = document.getElementById('menuToggle');
  const navMenu = document.getElementById('navMenu');

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      contents.forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      contents[index].classList.add('active');
    });
  });

  if (menuToggle && navMenu) {
    menuToggle.addEventListener('click', () => {
      navMenu.classList.toggle('show');
    });
  }

  const listaCompletos = document.getElementById('lista-completos');
  const vazioCompletos = document.getElementById('vazio-completos');
  const listaCancelados = document.getElementById('lista-cancelados');
  const vazioCancelados = document.getElementById('vazio-cancelados');

  const txt = (v) => {
    if (v === null || v === undefined) return '—';
    if (typeof v === 'string' && !v.trim()) return '—';
    return v;
  };
  const fmtData = (ts) => {
    try {
      const d = ts?.toDate ? ts.toDate() : (ts instanceof Date ? ts : null);
      if (!d) return '—';
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch { return '—'; }
  };
  const tsNumber = (ts) => {
    try { if (!ts) return 0; if (ts?.seconds) return ts.seconds; const d = ts?.toDate ? ts.toDate() : (ts instanceof Date ? ts : null); return d ? Math.floor(d.getTime()/1000) : 0; } catch { return 0; }
  };

  function card({ id, tipo, origem, destino, tituloIcone, tituloTxt, statusTxt, statusClasse, quandoTxt }) {
    const div = document.createElement('div');
    div.className = 'delivery-card';
    div.innerHTML = `
      <div class="delivery-left">
        <h3>${tituloIcone} ${txt(tituloTxt)}</h3>
        <p><i class="fa-solid fa-location-dot"></i>Origem: ${txt(origem)}</p>
        <p><i class="fa-solid fa-location-arrow"></i>Destino: ${txt(destino)}</p>
        <span class="tempo">${txt(quandoTxt)}</span>
      </div>
      <div class="delivery-right">
        <span class="entrega-agora ${statusClasse}">${txt(statusTxt)}</span>
      </div>`;
    return div;
  }

  function renderLista(container, vazioEl, itens, tipoLista) {
    try {
      container.innerHTML = '';
      if (!itens || !itens.length) {
        const titulo = tipoLista === 'completos' ? 'Você ainda não tem entregas concluídas.' : 'Você ainda não tem entregas canceladas.';
        const dica   = tipoLista === 'completos' ? 'Assim que finalizar uma entrega, ela aparecerá aqui.' : 'Se alguma entrega for cancelada, ela aparecerá aqui.';
        vazioEl.innerHTML = `
          <div class="delivery-card" style="opacity:.95">
            <div class="delivery-left">
              <h3><i class="fa-regular fa-folder-open"></i> ${titulo}</h3>
              <p style="color:#666;margin-top:6px">${dica}</p>
            </div>
          </div>`;
        vazioEl.style.display = 'block';
        return;
      }
      vazioEl.style.display = 'none';
      itens.forEach(i => container.appendChild(card(i)));
    } catch (e) {
      console.warn('[entregasM] Falha ao renderizar lista:', e?.message || e);
    }
  }

  async function carregarHistorico(uid) {
    const { firebase } = window; if (!firebase || !firebase.apps.length) return;
    const db = firebase.firestore();

    async function consultar(nomeCol, campoId, arrStatus, tipoLista) {
      const orderField = (nomeCol === 'descartes') ? 'dataEnvio' : ((nomeCol === 'agendamentos') ? 'confirmadoEm' : 'criadoEm');
      try {
        const snap = await db.collection(nomeCol)
          .where(campoId, '==', uid)
          .where('status', 'in', arrStatus)
          .orderBy(orderField, 'desc')
          .limit(20)
          .get()
          .catch(async (err) => {
            console.warn(`[${nomeCol}] Consulta ${tipoLista} com orderBy(${orderField}) falhou:`, err?.message||err);
            return db.collection(nomeCol)
              .where(campoId, '==', uid)
              .where('status', 'in', arrStatus)
              .limit(20)
              .get();
          });
        return snap.docs;
      } catch (e) { console.warn(`[${nomeCol}] Falha consulta:`, e?.message||e); return []; }
    }

    const camposMotorista = ['motoristaId','motoristaUid','propostaAceita.motoristaUid'];
    const filtroStatus = {
      completos: ['finalizada','finalizado','finalizada_pendente','concluida','concluído','concluido','pago','entregue','finalizado_agendamento'],
      cancelados: ['cancelada','cancelado','cancelado_agendamento','corrida_agendamento_cancelado']
    };

    async function buscarColecao(nomeCol) {
      const isDesc = (nomeCol === 'descartes');
      const isAgendamento = (nomeCol === 'agendamentos');
      const completosDocs = (await Promise.all(camposMotorista.map(c => consultar(nomeCol, c, filtroStatus.completos, 'completos')))).flat();
      const canceladosDocs = (await Promise.all(camposMotorista.map(c => consultar(nomeCol, c, filtroStatus.cancelados, 'cancelados')))).flat();
      const vistosC = new Set(), vistosX = new Set();
      const completos = [], cancelados = [];

      completosDocs.forEach(doc => {
        if (vistosC.has(doc.id)) return; vistosC.add(doc.id);
        const d = doc.data()||{};
        const icone = isDesc ? '<i class="fa-solid fa-recycle" style="color:#28a745"></i>' : 
                      isAgendamento ? '<i class="fa-solid fa-calendar-check" style="color:#007bff"></i>' :
                      '<i class="fa-solid fa-truck" style="color:#ff6c0c"></i>';
        const titulo = isDesc ? 'Descarte' : (isAgendamento ? 'Agendamento' : (d.tipo || 'Mudança'));
        completos.push({
          id: doc.id,
          tipo: isDesc ? 'descarte' : (isAgendamento ? 'agendamento' : (d.tipo || 'mudança')),
          origem: isDesc ? (d.localRetirada || d.origem?.endereco || d?.origem || '-') : (d.origem?.endereco || '-'),
          destino: isDesc ? (d.localEntrega || d.destino?.endereco || d?.destino || '-') : (d.destino?.endereco || '-'),
          tituloIcone: icone,
          tituloTxt: `Entrega #${doc.id} — ${titulo}`,
          statusTxt: 'Concluído',
          statusClasse: 'status-concluido',
          quandoTxt: `Finalizado: ${fmtData(d.finalizadaEm || d.atualizadoEm || d.confirmadoEm || d.criadoEm || d.dataEnvio)}`,
          sortKey: tsNumber(d.finalizadaEm || d.atualizadoEm || d.confirmadoEm || d.criadoEm || d.dataEnvio),
        });
      });

      canceladosDocs.forEach(doc => {
        if (vistosX.has(doc.id)) return; vistosX.add(doc.id);
        const d = doc.data()||{};
        const icone = isDesc ? '<i class="fa-solid fa-recycle" style="color:#28a745"></i>' : 
                      isAgendamento ? '<i class="fa-solid fa-calendar-xmark" style="color:#dc3545"></i>' :
                      '<i class="fa-solid fa-truck" style="color:#ff6c0c"></i>';
        const titulo = isDesc ? 'Descarte' : (isAgendamento ? 'Agendamento' : (d.tipo || 'Mudança'));
        cancelados.push({
          id: doc.id,
          tipo: isDesc ? 'descarte' : (isAgendamento ? 'agendamento' : (d.tipo || 'mudança')),
          origem: isDesc ? (d.localRetirada || d.origem?.endereco || d?.origem || '-') : (d.origem?.endereco || '-'),
          destino: isDesc ? (d.localEntrega || d.destino?.endereco || d?.destino || '-') : (d.destino?.endereco || '-'),
          tituloIcone: icone,
          tituloTxt: `Entrega #${doc.id} — ${titulo}`,
          statusTxt: 'Cancelado',
          statusClasse: 'status-cancelado',
          quandoTxt: `Cancelado em: ${fmtData(d.canceladoEm || d.atualizadoEm || d.criadoEm || d.dataEnvio)}`,
          sortKey: tsNumber(d.canceladoEm || d.atualizadoEm || d.criadoEm || d.dataEnvio),
        });
      });

      return { completos, cancelados };
    }

    const [corridas, descartes, agendamentos] = await Promise.all([
      buscarColecao('corridas'),
      buscarColecao('descartes'),
      buscarColecao('agendamentos')
    ]);

    const completos = [...(corridas?.completos||[]), ...(descartes?.completos||[]), ...(agendamentos?.completos||[])].sort((a,b)=> (b.sortKey||0)-(a.sortKey||0));
    const cancelados = [...(corridas?.cancelados||[]), ...(descartes?.cancelados||[]), ...(agendamentos?.cancelados||[])].sort((a,b)=> (b.sortKey||0)-(a.sortKey||0));

    renderLista(listaCompletos, vazioCompletos, completos, 'completos');
    renderLista(listaCancelados, vazioCancelados, cancelados, 'cancelados');
  }

  window.firebase.auth().onAuthStateChanged((user) => {
    if (!user) {
      const msg = `
        <div class="delivery-card" style="opacity:.95">
          <div class="delivery-left">
            <h3><i class="fa-solid fa-right-to-bracket"></i> Faça login para ver suas entregas</h3>
            <p style="color:#666;margin-top:6px">Acesse sua conta para visualizar suas entregas concluídas e canceladas.</p>
          </div>
        </div>`;
      if (vazioCompletos) { vazioCompletos.innerHTML = msg; vazioCompletos.style.display='block'; }
      if (vazioCancelados) { vazioCancelados.innerHTML = msg; vazioCancelados.style.display='block'; }
      return;
    }
    console.log('[entregasM] UID motorista:', user.uid);
    carregarHistorico(user.uid).catch(e=>console.warn('[entregasM] erro:', e?.message||e));
  });
})();