/* rotaM.js
   - Busca automaticamente a corrida ativa do motorista logado (sem ?corrida=ID)
   - Traça rota em tempo real do motorista até a retirada e depois até o destino
   - Preenche nomes reais (cliente e motorista) do Firestore
   - Ao finalizar, abre modal de avaliação e salva em corridas/{id}/avaliacoes
*/

/* ====== Estrutura esperada em "corridas/{id}" ======
{
  origem:  { lat: -23.55, lng: -46.63, endereco: "Rua X, 123" },
  destino: { lat: -23.58, lng: -46.64, endereco: "Av Y, 456" },
  clienteId: "uidCliente",
  motoristaId: "uidMotorista",
  clienteNome?: "Fulano",
  motoristaNome?: "Ciclano",
  status: "aguardando_motorista" | "indo_retirar" | "a_caminho_destino" | "finalizada",
  criadoEm: Timestamp
}
*/

(function () {
  /* ===== Helpers DOM ===== */
  const $ = (sel) => document.querySelector(sel);
  const origemInfoEl = $("#origem-info");
  const destinoInfoEl = $("#destino-info");
  const nomeClienteEl = $("#nome-cliente");
  const nomeMotoristaEl = $("#nome-motorista");
  const btnTudoPronto = $("#btnTudoPronto");
  const btnFinalizar = $("#btnFinalizarCorrida");

  /* ===== Modal Avaliação ===== */
  const modal = $("#modalAvaliacao");
  const estrelasWrap = $("#estrelas");
  const salvarAvaliacaoBtn = $("#salvarAvaliacao");
  const cancelarAvaliacaoBtn = $("#cancelarAvaliacao");
  const fecharModalBtn = $("#fecharModal");
  const comentarioEl = $("#comentario");
  let ratingAtual = 0;
  function abrirModal() { if (modal){ modal.style.display = "flex"; modal.setAttribute("aria-hidden","false"); } }
  function fecharModal() { if (modal){ modal.style.display = "none"; modal.setAttribute("aria-hidden","true"); } }
  [cancelarAvaliacaoBtn, fecharModalBtn].forEach(b => b?.addEventListener("click", fecharModal));
  estrelasWrap?.addEventListener("click", (e) => {
    const v = Number(e.target?.dataset?.v || 0);
    if (!v) return;
    ratingAtual = v;
    [...estrelasWrap.querySelectorAll("i")].forEach((i, idx) => {
      if (idx < v) { i.classList.add("active"); i.classList.replace("fa-regular","fa-solid"); }
      else { i.classList.remove("active"); i.classList.replace("fa-solid","fa-regular"); }
    });
  });

  /* ===== Firestore ===== */
  const db = firebase.firestore();
  let unsubCorrida = null;
  let dadosCorrida = null;

  /* ===== Cache de corrida ===== */
  let corridaId = null;
  const STATUS_ABERTOS = ["aguardando_motorista","indo_retirar","a_caminho_destino"];
  function salvarUltimaCorrida(id){ try{ localStorage.setItem("ultimaCorridaMotorista", id||""); }catch(e){} }
  function lerUltimaCorrida(){ try{ return localStorage.getItem("ultimaCorridaMotorista") || null; }catch(e){ return null; } }

  /* ===== Buscar nome por UID ===== */
  async function obterNomePorUid(uid) {
    if (!uid) return null;
    const colNames = ["usuarios","users"];
    for (const col of colNames) {
      try {
        const snap = await db.collection(col).doc(uid).get();
        if (snap.exists) {
          const d = snap.data() || {};
          return d.nome || d.displayName || d.nomeCompleto || null;
        }
      } catch(_) {}
    }
    return null;
  }

  /* ===== Resolver corrida ativa do motorista ===== */
  async function resolverCorridaAtiva(uid) {
    // 1) tenta a última salva se ainda estiver aberta
    const ultima = lerUltimaCorrida();
    if (ultima) {
      const d = await db.collection("corridas").doc(ultima).get();
      if (d.exists && STATUS_ABERTOS.includes((d.data().status)||"")) return d.id;
    }

    // 2) busca as mais recentes do motorista e filtra abertas (evita 'where in')
    const q = await db.collection("corridas")
      .where("motoristaId","==", uid)
      .orderBy("criadoEm","desc")
      .limit(5)
      .get();

    const candAberta = q.docs.find(d => STATUS_ABERTOS.includes((d.data().status)||""));
    if (candAberta) return candAberta.id;

    // 3) fallback: pega a mais recente não finalizada
    const candNaoFinal = q.docs.find(d => (d.data().status||"") !== "finalizada");
    if (candNaoFinal) return candNaoFinal.id;

    return null;
  }

  /* ===== Mapa (Leaflet + MapTiler tiles) ===== */
  const MAPTILER_KEY = "lRS4UV8yOp62RauVV5D7";
  const map = L.map("map", { zoomControl: true });
  const mtLayer = L.tileLayer(
    `https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`,
    { attribution: '&copy; OpenStreetMap & MapTiler', maxZoom: 20 }
  ).addTo(map);

  let motoristaMarker = null;
  let origemMarker = null;
  let destinoMarker = null;
  let routeLayer = null;

  /* ===== Estado de navegação ===== */
  let fase = "indo_retirar"; // "indo_retirar" -> "a_caminho_destino"
  const DISTANCIA_CHEGOU_M = 60;

  /* ===== Geolocalização do motorista ===== */
  let watchId = null;
  let posMotorista = null;

  function setMotoristaPos(lat, lng) {
    posMotorista = { lat, lng };
    if (!motoristaMarker) {
      motoristaMarker = L.marker([lat, lng], {
        icon: L.divIcon({
          className: "marker-motorista",
          html: `<div style="width:16px;height:16px;background:#3DBE34;border:2px solid #fff;border-radius:50%;box-shadow:0 0 0 2px rgba(0,0,0,.2)"></div>`
        })
      }).addTo(map);
      map.setView([lat, lng], 14);
    } else {
      motoristaMarker.setLatLng([lat, lng]);
    }
    atualizarRota();
  }

  function startGeolocation() {
    if (!navigator.geolocation) { console.error("Geolocalização indisponível."); return; }
    watchId = navigator.geolocation.watchPosition(
      (pos) => setMotoristaPos(pos.coords.latitude, pos.coords.longitude),
      (err) => console.error("Erro geolocalização:", err),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
    );
  }

  /* ===== Rota com OSRM público ===== */
  async function atualizarRota() {
    if (!posMotorista || !dadosCorrida?.origem || !dadosCorrida?.destino) return;

    const alvo = fase === "indo_retirar" ? dadosCorrida.origem : dadosCorrida.destino;
    if (!alvo?.lat || !alvo?.lng) return;

    const d = distanciaEmMetros(posMotorista.lat, posMotorista.lng, alvo.lat, alvo.lng);
    if (d <= DISTANCIA_CHEGOU_M) {
      if (fase === "indo_retirar") btnTudoPronto?.removeAttribute("disabled");
      return;
    }

    const url = `https://router.project-osrm.org/route/v1/driving/${posMotorista.lng},${posMotorista.lat};${alvo.lng},${alvo.lat}?overview=full&geometries=geojson`;
    try {
      const resp = await fetch(url);
      const json = await resp.json();
      const coords = json?.routes?.[0]?.geometry?.coordinates;
      if (!coords) return;

      const latlngs = coords.map(([lng, lat]) => [lat, lng]);

      if (routeLayer) routeLayer.setLatLngs(latlngs);
      else routeLayer = L.polyline(latlngs, { weight: 6, opacity: 0.85, color: "#3DBE34" }).addTo(map);

      const bounds = L.latLngBounds(latlngs);
      bounds.extend([posMotorista.lat, posMotorista.lng]);
      bounds.extend([alvo.lat, alvo.lng]);
      map.fitBounds(bounds, { padding: [40, 40] });
    } catch (e) {
      console.error("Falha ao obter rota OSRM:", e);
    }
  }

  /* ===== Distância Haversine ===== */
  function distanciaEmMetros(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const toRad = (v) => v * Math.PI / 180;
    const φ1 = toRad(lat1), φ2 = toRad(lat2);
    const Δφ = toRad(lat2 - lat1), Δλ = toRad(lon2 - lon1);
    const a = Math.sin(Δφ/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  /* ===== Marcadores origem/destino ===== */
  function desenharMarcadores() {
    if (dadosCorrida?.origem?.lat && dadosCorrida?.origem?.lng) {
      if (!origemMarker) {
        origemMarker = L.marker([dadosCorrida.origem.lat, dadosCorrida.origem.lng], {
          icon: L.divIcon({
            className: "marker-origem",
            html: `<div style="width:18px;height:18px;background:#1c1c1c;border:2px solid #fff;border-radius:50%;"></div>`
          })
        }).addTo(map);
      } else {
        origemMarker.setLatLng([dadosCorrida.origem.lat, dadosCorrida.origem.lng]);
      }
    }

    if (dadosCorrida?.destino?.lat && dadosCorrida?.destino?.lng) {
      if (!destinoMarker) {
        destinoMarker = L.marker([dadosCorrida.destino.lat, dadosCorrida.destino.lng], {
          icon: L.divIcon({
            className: "marker-destino",
            html: `<div style="width:18px;height:18px;background:#ff6c0c;border:2px solid #fff;border-radius:50%;"></div>`
          })
        }).addTo(map);
      } else {
        destinoMarker.setLatLng([dadosCorrida.destino.lat, dadosCorrida.destino.lng]);
      }
    }
  }

  /* ===== UI bind ===== */
  btnTudoPronto?.setAttribute("disabled","true");
  btnTudoPronto?.addEventListener("click", async () => {
    if (!dadosCorrida || !corridaId) return;
    fase = "a_caminho_destino";
    btnTudoPronto.setAttribute("disabled","true");
    try {
      await db.collection("corridas").doc(corridaId).set({ status: "a_caminho_destino" }, { merge: true });
    } catch(e){ console.error(e); }
    if (routeLayer) { map.removeLayer(routeLayer); routeLayer = null; }
    atualizarRota();
  });

  btnFinalizar?.addEventListener("click", () => abrirModal());

  salvarAvaliacaoBtn?.addEventListener("click", async () => {
    if (!corridaId) return;
    const nota = ratingAtual || 0;
    const comentario = comentarioEl?.value?.trim() || "";
    try {
      const batch = db.batch();
      const corridaRef = db.collection("corridas").doc(corridaId);
      const avalRef = corridaRef.collection("avaliacoes").doc();
      batch.set(avalRef, {
        nota,
        comentario,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        motoristaId: dadosCorrida?.motoristaId || null,
        clienteId: dadosCorrida?.clienteId || null
      });
      batch.set(corridaRef, { status: "finalizada", finalizadaEm: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
      await batch.commit();
      fecharModal();
      alert("Avaliação salva.");
    } catch (e) {
      console.error(e);
      alert("Erro ao salvar avaliação.");
    }
  });

  /* ===== Assinar corrida ===== */
  async function assinarCorrida() {
    firebase.auth().onAuthStateChanged(async (user) => {
      if (!user) { console.warn("Sem usuário logado."); return; }

      corridaId = await resolverCorridaAtiva(user.uid);
      if (!corridaId) { alert("Nenhuma corrida ativa encontrada para este motorista."); return; }

      salvarUltimaCorrida(corridaId);

      unsubCorrida && unsubCorrida();
      unsubCorrida = db.collection("corridas").doc(corridaId)
        .onSnapshot(async (doc) => {
          if (!doc.exists) return;
          dadosCorrida = doc.data() || {};

          // Infos visuais
          origemInfoEl && (origemInfoEl.textContent = dadosCorrida?.origem?.endereco || "—");
          destinoInfoEl && (destinoInfoEl.textContent = dadosCorrida?.destino?.endereco || "—");

          // Nomes
          (async () => {
            const nC = dadosCorrida?.clienteNome || await obterNomePorUid(dadosCorrida?.clienteId);
            const nM = dadosCorrida?.motoristaNome || await obterNomePorUid(dadosCorrida?.motoristaId);
            if (nomeClienteEl) nomeClienteEl.textContent = nC || "—";
            if (nomeMotoristaEl) nomeMotoristaEl.textContent = nM || "—";
          })();

          // Fase
          if (dadosCorrida.status === "a_caminho_destino") fase = "a_caminho_destino";
          else if (dadosCorrida.status === "finalizada") { /* nada */ }
          else fase = "indo_retirar";

          // Mapa
          desenharMarcadores();
          atualizarRota();

          // Inicia status se ausente
          if (!dadosCorrida.status) {
            try {
              await db.collection("corridas").doc(corridaId).set({ status: "indo_retirar" }, { merge: true });
            } catch(e){ console.error(e); }
          }
        });
    });
  }

  /* ===== Init ===== */
  function init() {
    map.setView([-15.78, -47.93], 4);
    mtLayer.addTo(map);
    assinarCorrida();
    startGeolocation();
  }
  init();

  /* ===== Cleanup ===== */
  window.addEventListener("beforeunload", () => {
    unsubCorrida && unsubCorrida();
    if (watchId) navigator.geolocation.clearWatch(watchId);
  });
})();
