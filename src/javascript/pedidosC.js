// Pedidos do Cliente – Histórico (Completos e Cancelados)
;(() => {
  // Tabs (agora somente 2: Completo e Cancelado)
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
  const listaAgendados = document.getElementById('lista-agendados');
  const vazioAgendados = document.getElementById('vazio-agendados');
  // Helpers
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
    try {
      if (!ts) return 0;
      if (ts?.seconds) return ts.seconds;
      const d = ts?.toDate ? ts.toDate() : (ts instanceof Date ? ts : null);
      return d ? Math.floor(d.getTime()/1000) : 0;
    } catch { return 0; }
  };

  function cardPedido({ id, tipo, origem, destino, tituloIcone, tituloTxt, statusTxt, statusClasse, quandoTxt, colecao }) {
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
    // Sem navegação ao clicar
    return div;
  }

  function renderLista(container, vazioEl, itens, tipoLista) {
    try {
      container.innerHTML = '';
      if (!itens || !itens.length) {
        const titulo = tipoLista === 'completos' ? 'Você ainda não tem pedidos concluídos.' : 'Você ainda não tem pedidos cancelados.';
        const dica   = tipoLista === 'completos' ? 'Assim que finalizar um pedido, ele aparecerá aqui.' : 'Se algum pedido for cancelado, ele aparecerá aqui.';
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
      itens.forEach(i => container.appendChild(cardPedido(i)));
    } catch (e) {
      console.warn('Falha ao renderizar lista:', e?.message || e);
    }
  }

  async function carregarHistorico(uid) {
    const { firebase } = window;
    if (!firebase || !firebase.apps.length) {
      console.error('Firebase não carregado.');
      return;
    }
    const db = firebase.firestore();

    // Buscar em 'corridas' e 'descartes'
  async function buscarColecao(nomeCol, filtroStatus) {
    const out = { completos: [], cancelados: [] };
    try {
      // Helper para consultar por campo de cliente, com fallback de índice
      const consultarPorCampo = async (campo, arrStatus, tipoLista) => {
        if (!campo || !Array.isArray(arrStatus) || !arrStatus.length) return [];
        const orderField = (nomeCol === 'descartes') ? 'dataEnvio' : 'criadoEm';
        try {
          const snap = await db.collection(nomeCol)
            .where(campo, '==', uid)
            .where('status', 'in', arrStatus)
            .orderBy(orderField, 'desc')
            .limit(20)
            .get()
            .catch(async (err) => {
              console.warn(`[${nomeCol}] Consulta ${tipoLista} com orderBy(${orderField}) falhou (${campo}):`, err?.message||err);
              return db.collection(nomeCol)
                .where(campo, '==', uid)
                .where('status', 'in', arrStatus)
                .limit(20)
                .get();
            });
          return snap.docs;
        } catch (e) {
          console.warn(`[${nomeCol}] Falha ao consultar por campo ${campo}:`, e?.message||e);
          return [];
        }
      };

      const isDesc = (nomeCol === 'descartes');
      const camposClienteDesc = ['clienteId','clienteUid','userId','usuarioId','solicitanteId'];

      // Completos
      if (Array.isArray(filtroStatus.completos) && filtroStatus.completos.length) {
        const docsC = isDesc
          ? (await Promise.all(camposClienteDesc.map(c => consultarPorCampo(c, filtroStatus.completos, 'completos')))).flat()
          : await consultarPorCampo('clienteId', filtroStatus.completos, 'completos');
        const vistos = new Set();
        docsC.forEach(doc => {
          if (vistos.has(doc.id)) return; vistos.add(doc.id);
          const d = doc.data() || {};
          const iconeTipo = isDesc ? '<i class="fa-solid fa-recycle" style="color:#28a745"></i>' : '<i class="fa-solid fa-truck" style="color:#ff6c0c"></i>';
          const tituloBase = isDesc ? 'Descarte' : (d.tipo || 'Mudança');
          out.completos.push({
            id: doc.id,
            tipo: isDesc ? 'descarte' : (d.tipo || 'mudança'),
            origem: isDesc ? (d.localRetirada || d.origem?.endereco || d?.origem || '-') : (d.origem?.endereco),
            destino: isDesc ? (d.localEntrega || d.destino?.endereco || d?.destino || '-') : (d.destino?.endereco),
            tituloIcone: iconeTipo,
            tituloTxt: `Pedido #${doc.id} – ${tituloBase}`,
            statusTxt: 'Concluído',
            statusClasse: 'status-concluido',
            quandoTxt: `Finalizado: ${fmtData(d.finalizadaEm || d.atualizadoEm || d.criadoEm || d.dataEnvio)}`,
            colecao: nomeCol,
            sortKey: tsNumber(d.finalizadaEm || d.atualizadoEm || d.criadoEm || d.dataEnvio),
          });
        });
      }

      // Cancelados
      if (Array.isArray(filtroStatus.canceladoArr) && filtroStatus.canceladoArr.length) {
        const docsX = isDesc
          ? (await Promise.all(camposClienteDesc.map(c => consultarPorCampo(c, filtroStatus.canceladoArr, 'cancelados')))).flat()
          : await consultarPorCampo('clienteId', filtroStatus.canceladoArr, 'cancelados');
        const vistosX = new Set();
        docsX.forEach(doc => {
          if (vistosX.has(doc.id)) return; vistosX.add(doc.id);
          const d = doc.data() || {};
          const iconeTipo = isDesc ? '<i class="fa-solid fa-recycle" style="color:#28a745"></i>' : '<i class="fa-solid fa-truck" style="color:#ff6c0c"></i>';
          const tituloBase = isDesc ? 'Descarte' : (d.tipo || 'Mudança');
          out.cancelados.push({
            id: doc.id,
            tipo: isDesc ? 'descarte' : (d.tipo || 'mudança'),
            origem: isDesc ? (d.localRetirada || d.origem?.endereco || d?.origem || '-') : (d.origem?.endereco),
            destino: isDesc ? (d.localEntrega || d.destino?.endereco || d?.destino || '-') : (d.destino?.endereco),
            tituloIcone: iconeTipo,
            tituloTxt: `Pedido #${doc.id} – ${tituloBase}`,
            statusTxt: 'Cancelado',
            statusClasse: 'status-cancelado',
            quandoTxt: `Cancelado em: ${fmtData(d.canceladoEm || d.atualizadoEm || d.criadoEm || d.dataEnvio)}`,
            colecao: nomeCol,
            sortKey: tsNumber(d.canceladoEm || d.atualizadoEm || d.criadoEm || d.dataEnvio),
          });
        });
      }

    } catch (e) {
      console.error(`Erro ao buscar ${nomeCol}:`, e);
    }
    return out;
  }

    // Abrangência maior de status para cobrir variações na base
    const filtroStatus = {
      completos: ['finalizada','finalizado','finalizada_pendente','concluida','concluído','concluido','pago','entregue'],
      canceladoArr: ['cancelada','cancelado'],
    };

    const [corridas, descartes] = await Promise.all([
      buscarColecao('corridas', filtroStatus),
      buscarColecao('descartes', filtroStatus),
    ]);

    const completos = [
      ...(corridas?.completos || []),
      ...(descartes?.completos || []),
    ];
    const cancelados = [
      ...(corridas?.cancelados || []),
      ...(descartes?.cancelados || []),
    ];
    // Ordenar por mais recente primeiro
    try {
      completos.sort((a,b)=> (b?.sortKey||0) - (a?.sortKey||0));
      cancelados.sort((a,b)=> (b?.sortKey||0) - (a?.sortKey||0));
    } catch {}

    renderLista(listaCompletos, vazioCompletos, completos, 'completos');
    renderLista(listaCancelados, vazioCancelados, cancelados, 'cancelados');
  }

  // Autenticação
  const { firebase } = window;
  if (!firebase || !firebase.apps.length) {
    console.warn('Firebase não detectado nesta página. As listas não serão carregadas.');
    return;
  }

  firebase.auth().onAuthStateChanged((user) => {
    if (!user) {
      console.warn('Usuário não autenticado.');
      // Mensagem amigável para ambas as abas
      const msgLogin = `
        <div class="delivery-card" style="opacity:.95">
          <div class="delivery-left">
            <h3><i class="fa-solid fa-right-to-bracket"></i> Faça login para ver seus pedidos</h3>
            <p style="color:#666;margin-top:6px">Acesse sua conta para visualizar seus pedidos concluídos e cancelados.</p>
          </div>
        </div>`;
      vazioCompletos.innerHTML = msgLogin; vazioCompletos.style.display = 'block';
      vazioCancelados.innerHTML = msgLogin; vazioCancelados.style.display = 'block';
      return;
    }
    console.log('[pedidosC] Usuário autenticado:', user.uid);
    carregarHistorico(user.uid).then(()=>{
      console.log('[pedidosC] Histórico carregado com sucesso');
    }).catch((e)=>{
      console.warn('[pedidosC] Falha ao carregar histórico:', e?.message||e);
    });
  });
})();
