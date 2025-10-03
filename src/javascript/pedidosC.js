// Pedidos do Cliente – Histórico (Completos, Cancelados e Agendados)
;(() => {
  // Tabs (agora 3: Agendados, Completos e Cancelados)
  const tabs = document.querySelectorAll(".tab");
  const contents = document.querySelectorAll(".tab-content");
  const menuToggle = document.getElementById("menuToggle");
  const navMenu = document.getElementById("navMenu");

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      contents.forEach(c => c.classList.remove("active"));
      tab.classList.add("active");
      contents[index].classList.add("active");
    });
  });

  if (menuToggle && navMenu) {
    menuToggle.addEventListener("click", () => {
      navMenu.classList.toggle("show");
    });
  }

  const listaAgendados = document.getElementById("lista-agendados");
  const vazioAgendados = document.getElementById("vazio-agendados");
  const listaCompletos = document.getElementById("lista-completos");
  const vazioCompletos = document.getElementById("vazio-completos");
  const listaCancelados = document.getElementById("lista-cancelados");
  const vazioCancelados = document.getElementById("vazio-cancelados");

  // Helpers
  const txt = (v) => {
    if (v === null || v === undefined) return "—";
    if (typeof v === "string" && !v.trim()) return "—";
    return v;
  };

  const fmtData = (ts) => {
    try {
      const d = ts?.toDate ? ts.toDate() : (ts instanceof Date ? ts : null);
      if (!d) return "—";
      return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
    } catch { return "—"; }
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
    const div = document.createElement("div");
    div.className = "delivery-card";
    // Adiciona um link para a página de status se for um agendamento ativo
    if (colecao === "agendamentos" && statusClasse === "status-agendado") {
      div.onclick = () => { window.location.href = `statusA.html?corrida=${id}`; };
      div.style.cursor = "pointer";
    }
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
      container.innerHTML = "";
      if (!itens || !itens.length) {
        let titulo = "";
        let dica = "";
        if (tipoLista === "agendados") {
          titulo = "Você ainda não tem agendamentos ativos.";
          dica = "Agendamentos confirmados aparecerão aqui.";
        } else if (tipoLista === "completos") {
          titulo = "Você ainda não tem pedidos concluídos.";
          dica = "Assim que finalizar um pedido, ele aparecerá aqui.";
        } else if (tipoLista === "cancelados") {
          titulo = "Você ainda não tem pedidos cancelados.";
          dica = "Se algum pedido for cancelado, ele aparecerá aqui.";
        }
        
        vazioEl.innerHTML = `
          <div class="delivery-card" style="opacity:.95">
            <div class="delivery-left">
              <h3><i class="fa-regular fa-folder-open"></i> ${titulo}</h3>
              <p style="color:#666;margin-top:6px">${dica}</p>
            </div>
          </div>`;
        vazioEl.style.display = "block";
        return;
      }
      vazioEl.style.display = "none";
      itens.forEach(i => container.appendChild(cardPedido(i)));
    } catch (e) {
      console.warn("Falha ao renderizar lista:", e?.message || e);
    }
  }

  async function carregarHistorico(uid) {
    const { firebase } = window;
    if (!firebase || !firebase.apps.length) {
      console.error("Firebase não carregado.");
      return;
    }
    const db = firebase.firestore();

    async function consultar(nomeCol, campoId, arrStatus, orderField, limit = 20) {
      try {
        const snap = await db.collection(nomeCol)
          .where(campoId, "==", uid)
          .where("status", "in", arrStatus)
          .orderBy(orderField, "desc")
          .limit(limit)
          .get()
          .catch(async (err) => {
            console.warn(`[${nomeCol}] Consulta com orderBy(${orderField}) falhou:`, err?.message||err);
            return db.collection(nomeCol)
              .where(campoId, "==", uid)
              .where("status", "in", arrStatus)
              .limit(limit)
              .get();
          });
        return snap.docs;
      } catch (e) { console.warn(`[${nomeCol}] Falha consulta:`, e?.message||e); return []; }
    }

    const camposCliente = ["clienteId","clienteUid","userId","usuarioId","solicitanteId"];

    const filtroStatus = {
      agendados: ["agendamento_confirmado","corrida_agendamento_confirmado","indo_retirar","a_caminho_destino","finalizada_pendente"],
      completos: ["finalizada","finalizado","finalizada_pendente","concluida","concluído","concluido","pago","entregue","finalizado_agendamento"],
      cancelados: ["cancelada","cancelado","cancelado_agendamento","corrida_agendamento_cancelado"],
    };

    const agendamentosAtivosDocs = (await Promise.all(camposCliente.map(c => consultar("agendamentos", c, filtroStatus.agendados, "confirmadoEm")))).flat();
    const agendamentosCompletosDocs = (await Promise.all(camposCliente.map(c => consultar("agendamentos", c, filtroStatus.completos, "confirmadoEm")))).flat();
    const corridasCompletasDocs = (await Promise.all(camposCliente.map(c => consultar("corridas", c, filtroStatus.completos, "criadoEm")))).flat();
    const descartesCompletosDocs = (await Promise.all(camposCliente.map(c => consultar("descartes", c, filtroStatus.completos, "dataEnvio")))).flat();

    const agendamentosCanceladosDocs = (await Promise.all(camposCliente.map(c => consultar("agendamentos", c, filtroStatus.cancelados, "confirmadoEm")))).flat();
    const corridasCanceladasDocs = (await Promise.all(camposCliente.map(c => consultar("corridas", c, filtroStatus.cancelados, "criadoEm")))).flat();
    const descartesCanceladosDocs = (await Promise.all(camposCliente.map(c => consultar("descartes", c, filtroStatus.cancelados, "dataEnvio")))).flat();

    const vistosAg = new Set(), vistosC = new Set(), vistosX = new Set();
    const agendados = [], completos = [], cancelados = [];

    // Processar Agendamentos Ativos
    agendamentosAtivosDocs.forEach(doc => {
      if (vistosAg.has(doc.id)) return; vistosAg.add(doc.id);
      const d = doc.data()||{};
      agendados.push({
        id: doc.id,
        tipo: "agendamento",
        origem: d.origem?.endereco || "—",
        destino: d.destino?.endereco || "—",
        tituloIcone: `<i class="fa-solid fa-calendar-check" style="color:#007bff"></i>`,
        tituloTxt: `Agendamento #${doc.id}`,
        statusTxt: "Agendado",
        statusClasse: "status-agendado",
        quandoTxt: `Agendado para: ${fmtData(d.agendadoPara || d.confirmadoEm || d.criadoEm)}`,
        colecao: "agendamentos",
        sortKey: tsNumber(d.agendadoPara || d.confirmadoEm || d.criadoEm),
      });
    });

    // Processar Completos
    [...corridasCompletasDocs, ...descartesCompletosDocs, ...agendamentosCompletosDocs].forEach(doc => {
      if (vistosC.has(doc.id)) return; vistosC.add(doc.id);
      const d = doc.data()||{};
      const isDesc = doc.ref.parent.id === "descartes";
      const isAgendamento = doc.ref.parent.id === "agendamentos";
      const icone = isDesc ? `<i class="fa-solid fa-recycle" style="color:#28a745"></i>` : 
                    isAgendamento ? `<i class="fa-solid fa-calendar-check" style="color:#007bff"></i>` : 
                    `<i class="fa-solid fa-truck" style="color:#ff6c0c"></i>`;
      const tituloBase = isDesc ? "Descarte" : (isAgendamento ? "Agendamento" : (d.tipo || "Mudança"));
      completos.push({
        id: doc.id,
        tipo: isDesc ? "descarte" : (isAgendamento ? "agendamento" : (d.tipo || "mudança")),
        origem: isDesc ? (d.localRetirada || d.origem?.endereco || "—") : (d.origem?.endereco || "—"),
        destino: isDesc ? (d.localEntrega || d.destino?.endereco || "—") : (d.destino?.endereco || "—"),
        tituloIcone: icone,
        tituloTxt: `Pedido #${doc.id} – ${tituloBase}`,
        statusTxt: "Concluído",
        statusClasse: "status-concluido",
        quandoTxt: `Finalizado: ${fmtData(d.finalizadaEm || d.atualizadoEm || d.confirmadoEm || d.criadoEm || d.dataEnvio)}`,
        colecao: doc.ref.parent.id,
        sortKey: tsNumber(d.finalizadaEm || d.atualizadoEm || d.confirmadoEm || d.criadoEm || d.dataEnvio),
      });
    });

    // Processar Cancelados
    [...corridasCanceladasDocs, ...descartesCanceladosDocs, ...agendamentosCanceladosDocs.filter(doc => filtroStatus.cancelados.includes(doc.data().status))].forEach(doc => {
      if (vistosX.has(doc.id)) return; vistosX.add(doc.id);
      const d = doc.data()||{};
      const isDesc = doc.ref.parent.id === "descartes";
      const isAgendamento = doc.ref.parent.id === "agendamentos";
      const icone = isDesc ? `<i class="fa-solid fa-recycle" style="color:#28a745"></i>` : 
                    isAgendamento ? `<i class="fa-solid fa-calendar-xmark" style="color:#dc3545"></i>` : 
                    `<i class="fa-solid fa-truck" style="color:#ff6c0c"></i>`;
      const tituloBase = isDesc ? "Descarte" : (isAgendamento ? "Agendamento" : (d.tipo || "Mudança"));
      cancelados.push({
        id: doc.id,
        tipo: isDesc ? "descarte" : (isAgendamento ? "agendamento" : (d.tipo || "mudança")),
        origem: isDesc ? (d.localRetirada || d.origem?.endereco || "—") : (d.origem?.endereco || "—"),
        destino: isDesc ? (d.localEntrega || d.destino?.endereco || "—") : (d.destino?.endereco || "—"),
        tituloIcone: icone,
        tituloTxt: `Pedido #${doc.id} – ${tituloBase}`,
        statusTxt: "Cancelado",
        statusClasse: "status-cancelado",
        quandoTxt: `Cancelado em: ${fmtData(d.canceladoEm || d.atualizadoEm || d.criadoEm || d.dataEnvio)}`,
        colecao: doc.ref.parent.id,
        sortKey: tsNumber(d.canceladoEm || d.atualizadoEm || d.criadoEm || d.dataEnvio),
      });
    });

    // Ordenar por mais recente primeiro
    try {
      agendados.sort((a,b)=> (b?.sortKey||0) - (a?.sortKey||0));
      completos.sort((a,b)=> (b?.sortKey||0) - (a?.sortKey||0));
      cancelados.sort((a,b)=> (b?.sortKey||0) - (a?.sortKey||0));
    } catch (e) { console.warn("Erro ao ordenar listas:", e?.message||e); }

    renderLista(listaAgendados, vazioAgendados, agendados, "agendados");
    renderLista(listaCompletos, vazioCompletos, completos, "completos");
    renderLista(listaCancelados, vazioCancelados, cancelados, "cancelados");
  }

  // Autenticação
  const { firebase } = window;
  if (!firebase || !firebase.apps.length) {
    console.warn("Firebase não detectado nesta página. As listas não serão carregadas.");
    return;
  }

  firebase.auth().onAuthStateChanged((user) => {
    if (!user) {
      console.warn("Usuário não autenticado.");
      // Mensagem amigável para todas as abas
      const msgLogin = `
        <div class="delivery-card" style="opacity:.95">
          <div class="delivery-left">
            <h3><i class="fa-solid fa-right-to-bracket"></i> Faça login para ver seus pedidos</h3>
            <p style="color:#666;margin-top:6px">Acesse sua conta para visualizar seus pedidos agendados, concluídos e cancelados.</p>
          </div>
        </div>`;
      vazioAgendados.innerHTML = msgLogin; vazioAgendados.style.display = "block";
      vazioCompletos.innerHTML = msgLogin; vazioCompletos.style.display = "block";
      vazioCancelados.innerHTML = msgLogin; vazioCancelados.style.display = "block";
      return;
    }
    console.log("[pedidosC] Usuário autenticado:", user.uid);
    carregarHistorico(user.uid).then(()=>{
      console.log("[pedidosC] Histórico carregado com sucesso");
    }).catch((e)=>{
      console.warn("[pedidosC] Falha ao carregar histórico:", e?.message||e);
    });
  });
})();

