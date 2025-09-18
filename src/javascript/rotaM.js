(() => {
  const pick = (...ids) => ids.map((id) => document.getElementById(id)).find((el) => !!el) || null

  const origemInfoEl = pick("origemInfo")
  const destinoInfoEl = pick("destinoInfo")
  const nomeClienteEl = pick("clienteInfo", "modal-client-name")
  const nomeMotoristaEl = pick("motoristaInfo")
  const distEl = pick("distanciaInfo")
  const tempoEl = pick("tempoInfo")
  const btnTudoPronto = pick("btnSeguirDestino")
  const btnFinalizar = pick("btnFinalizar")

  const instrWrap = pick("route-instructions")
  const instrList = pick("directionsList")

  const modal = pick("user-rating-modal")
  const salvarAvaliacaoBtn = pick("submit-user-rating")
  const cancelarAvaliacaoBtn = pick("cancel-user-rating")
  const fecharModalBtn = pick("close-user-modal")
  const comentarioEl = pick("user-rating-comment")

  const $openModal = () => modal && (modal.style.display = "flex")
  const $closeModal = () => modal && (modal.style.display = "none")
  ;[cancelarAvaliacaoBtn, fecharModalBtn].forEach((b) => b?.addEventListener("click", $closeModal))
  if (cancelarAvaliacaoBtn) cancelarAvaliacaoBtn.style.display = "none"

  
  const firebase = window.firebase
  const db = firebase.firestore()
  let corridaId = null
  let dadosCorrida = null
  let corridaRef = null
  let syncRef = null

  async function obterNome(uid) {
    if (!uid) return "—"
    try {
      const doc = await db.collection("usuarios").doc(uid).get()
      if (doc.exists) return doc.data().nome || "—"
    } catch {}
    return "—"
  }

  async function obterCorridaAtiva(uid) {
    const ultima = localStorage.getItem("ultimaCorridaMotorista")
    if (ultima) {
      const d = await db.collection("corridas").doc(ultima).get()
      if (d.exists && d.data().status !== "finalizada") return d.id
    }
    const q = await db.collection("corridas").where("motoristaId", "==", uid).orderBy("criadoEm", "desc").limit(1).get()
    if (!q.empty) return q.docs[0].id
    return null
  }

  //  Mapa
  const L = window.L
  const MAPTILER_KEY = "lRS4UV8yOp62RauVV5D7"
  const map = L.map("map")
  L.tileLayer(`https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`, {
    attribution: "&copy; OpenStreetMap & MapTiler",
    maxZoom: 20,
  }).addTo(map)

  let motoristaMarker = null, origemMarker = null, destinoMarker = null, routeLayer = null
  let posMotorista = null
  let fase = "indo_retirar"

  const km = (m) => (m / 1000).toFixed(2) + " km"
  const min = (s) => Math.max(1, Math.round(s / 60)) + " min"

  function ptTurn(type, modifier) {
    const m = (modifier || "").toLowerCase()
    const dir =
      m === "left" ? "à esquerda" :
      m === "right" ? "à direita" :
      m === "slight left" ? "levemente à esquerda" :
      m === "slight right" ? "levemente à direita" :
      m === "uturn" ? "retorne" : "em frente"
    if (type === "depart") return "Siga em frente"
    if (type === "arrive") return "Chegue ao destino"
    if (type === "turn") return `Vire ${dir}`
    if (type === "roundabout") return "Entre na rotatória e saia conforme indicado"
    if (type === "merge") return "Converja para a via indicada"
    if (type === "end of road") return "No fim da via, siga indicado"
    if (type === "continue") return `Continue ${dir}`
    return "Siga a via indicada"
  }

  function renderInstrucoes(steps) {
    if (!instrWrap || !instrList) return
    instrWrap.style.display = "block"
    instrList.innerHTML = ""
    steps.forEach((s) => {
      const li = document.createElement("li")
      const via = s.name ? ` pela ${s.name}` : ""
      li.textContent = `${ptTurn(s.maneuver.type, s.maneuver.modifier)}${via}`
      const badge = document.createElement("span")
      badge.className = "badge"
      badge.textContent = `${km(s.distance)} · ${min(s.duration)}`
      li.appendChild(badge)
      instrList.appendChild(li)
    })
  }

  async function desenharRota(from, to) {
    if (!from || !to) return
    const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&steps=true`
    const resp = await fetch(url)
    if (!resp.ok) return console.error("OSRM indisponível")
    const data = await resp.json()
    const route = data?.routes?.[0]
    if (!route) return console.error("Rota não encontrada")

    const latlngs = route.geometry.coordinates.map(([lng, lat]) => [lat, lng])
    if (routeLayer) map.removeLayer(routeLayer)
    routeLayer = L.polyline(latlngs, { weight: 6, opacity: 0.95, color: "#ff6c0c" }).addTo(map)
    map.fitBounds(L.latLngBounds(latlngs), { padding: [40, 40] })

    distEl && (distEl.textContent = km(route.distance))
    tempoEl && (tempoEl.textContent = min(route.duration))
    renderInstrucoes(route.legs[0].steps || [])
  }

  //  Marcadores 
  function desenharMarcadores() {
    // Motorista – verde com pulse
    if (posMotorista) {
      if (!motoristaMarker) {
        motoristaMarker = L.marker([posMotorista.lat, posMotorista.lng], {
          icon: L.divIcon({
            className: "marker-motorista",
            html: `<div style="width:20px;height:20px;background:#3DBE34;border:3px solid #fff;border-radius:50%;
                   box-shadow:0 0 10px rgba(0,0,0,0.5);animation:pulse 1.2s infinite;"></div>`,
          }),
        }).addTo(map)
      } else motoristaMarker.setLatLng([posMotorista.lat, posMotorista.lng])
    }

    // Origem – azul
    if (dadosCorrida?.origem) {
      if (!origemMarker) {
        origemMarker = L.marker([dadosCorrida.origem.lat, dadosCorrida.origem.lng], {
          icon: L.divIcon({
            className: "marker-origem",
            html: `<div style="width:22px;height:22px;background:#1E3A8A;border:3px solid #fff;border-radius:50%;"></div>`,
          }),
        }).addTo(map)
      } else origemMarker.setLatLng([dadosCorrida.origem.lat, dadosCorrida.origem.lng])
    }

    // Destino – laranja
    if (fase === "a_caminho_destino" && dadosCorrida?.destino) {
      if (!destinoMarker) {
        destinoMarker = L.marker([dadosCorrida.destino.lat, dadosCorrida.destino.lng], {
          icon: L.divIcon({
            className: "marker-destino",
            html: `<div style="width:22px;height:22px;background:#FF6C0C;border:3px solid #fff;border-radius:50%;"></div>`,
          }),
        }).addTo(map)
      } else destinoMarker.setLatLng([dadosCorrida.destino.lat, dadosCorrida.destino.lng])
    }
  }

  // sync 
  const getTexto = (el) => (el && el.textContent && el.textContent.trim()) || ""

  async function upsertCorridaBase() {
    if (!corridaRef) return
    const snap = await corridaRef.get()
    const base = snap.exists ? (snap.data() || {}) : {}

    const payload = {}
    if (dadosCorrida?.clienteId) payload.clienteId = dadosCorrida.clienteId
    if (dadosCorrida?.motoristaId) payload.motoristaId = dadosCorrida.motoristaId

    if (dadosCorrida?.origem?.lat && dadosCorrida?.origem?.lng) {
      payload.origem = {
        lat: dadosCorrida.origem.lat,
        lng: dadosCorrida.origem.lng,
        endereco: dadosCorrida.origem.endereco || getTexto(origemInfoEl) || base?.origem?.endereco || "",
      }
    }
    if (dadosCorrida?.destino?.lat && dadosCorrida?.destino?.lng) {
      payload.destino = {
        lat: dadosCorrida.destino.lat,
        lng: dadosCorrida.destino.lng,
        endereco: dadosCorrida.destino.endereco || getTexto(destinoInfoEl) || base?.destino?.endereco || "",
      }
    }
    if (!base.status) payload.status = "indo_retirar"

    if (Object.keys(payload).length) await corridaRef.set(payload, { merge: true })
  }

  function publicarPosicao(lat, lng, heading) {
    posMotorista = { lat, lng }
    desenharMarcadores()
    if (fase === "indo_retirar" && dadosCorrida?.origem) {
      desenharRota(posMotorista, dadosCorrida.origem)
    }
    syncRef?.set(
      {
        motorista: {
          lat,
          lng,
          heading: heading ?? null,
          ts: firebase.firestore.FieldValue.serverTimestamp(),
        },
      },
      { merge: true },
    )
  }

  function startGeolocation() {
    if (!navigator.geolocation) return console.error("Geolocalização indisponível")
    navigator.geolocation.watchPosition(
      (p) => publicarPosicao(p.coords.latitude, p.coords.longitude, p.coords.heading),
      () => {},
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 },
    )
  }

  btnTudoPronto?.addEventListener("click", async () => {
    if (!dadosCorrida) return
    fase = "a_caminho_destino"
    if (routeLayer) map.removeLayer(routeLayer)
    desenharMarcadores()
    desenharRota(dadosCorrida.origem, dadosCorrida.destino)
    btnTudoPronto.style.display = "none"
    btnFinalizar.style.display = "inline-block"

    await Promise.all([
      syncRef?.set({ fase: "a_caminho_destino" }, { merge: true }),
      corridaRef?.set({ status: "a_caminho_destino" }, { merge: true }),
    ])
  })

  btnFinalizar?.addEventListener("click", async () => {
    $openModal()
    await Promise.all([
      syncRef?.set({ fase: "finalizada_pendente" }, { merge: true }),
      corridaRef?.set({ status: "finalizada_pendente" }, { merge: true }),
    ])
  })

  
  firebase.auth().onAuthStateChanged(async (user) => {
    if (!user) return alert("Usuário não logado.")
    corridaId = await obterCorridaAtiva(user.uid)
    if (!corridaId) return alert("Nenhuma corrida ativa encontrada.")
    localStorage.setItem("ultimaCorridaMotorista", corridaId)
 if (window.CHAT) {
  window.CHAT.init('motorista');
  window.CHAT.attach(corridaId);
}

    corridaRef = db.collection("corridas").doc(corridaId)
    syncRef = corridaRef.collection("sync").doc("estado")


    syncRef.set({ fase: "indo_retirar" }, { merge: true })

    db.collection("corridas")
      .doc(corridaId)
      .onSnapshot(async (doc) => {
        if (!doc.exists) return
        dadosCorrida = doc.data()
        if (origemInfoEl) origemInfoEl.textContent = dadosCorrida.origem?.endereco || "—"
        if (destinoInfoEl) destinoInfoEl.textContent = dadosCorrida.destino?.endereco || "—"
        if (nomeClienteEl) nomeClienteEl.textContent = await obterNome(dadosCorrida.clienteId)
        if (nomeMotoristaEl) nomeMotoristaEl.textContent = await obterNome(dadosCorrida.motoristaId)

        await upsertCorridaBase()
        desenharMarcadores()

        if (posMotorista) {
          if (fase === "indo_retirar" && dadosCorrida?.origem) {
            desenharRota(posMotorista, dadosCorrida.origem)
          } else if (fase === "a_caminho_destino" && dadosCorrida?.origem && dadosCorrida?.destino) {
            desenharRota(dadosCorrida.origem, dadosCorrida.destino)
          }
        }
      })

    startGeolocation()
  })

  const style = document.createElement("style")
  style.innerHTML = `
    @keyframes pulse { 0%{transform:scale(.9);opacity:.7} 50%{transform:scale(1.2);opacity:1} 100%{transform:scale(.9);opacity:.7} }
  `
  document.head.appendChild(style)
})()

//  Avaliação  
let ratingAtual = 0

window.ratingAtual = 0; 
(() => {
  const stars = document.querySelectorAll(".rating-stars .star");
  if (!stars || stars.length === 0) return;

  const forEach = (list, cb) => Array.prototype.forEach.call(list, cb);

  forEach(stars, (star, i) => {
    star.addEventListener("click", () => {
      window.ratingAtual = i + 1;
      forEach(stars, (s, j) => {
        if (j < window.ratingAtual) s.classList.add("active");
        else s.classList.remove("active");
      });
    });
  });
})();


//  chat
(() => {
  const { firebase } = window;
  if (!firebase || !firebase.apps.length) return;
  const db = firebase.firestore();

  function ensureStyles() {
    if (document.getElementById("mm-chat-styles")) return;
    const s = document.createElement("style");
    s.id = "mm-chat-styles";
    s.textContent = `
      #openChat{position:fixed;right:16px;bottom:18px;z-index:20000;background:#ff6c0c;color:#fff;
        border:0;border-radius:999px;padding:12px 18px;font-weight:700;box-shadow:0 8px 18px rgba(255,108,12,.35);cursor:pointer}
      .mm-chat-modal{position:fixed;inset:0;background:rgba(0,0,0,.35);display:none;align-items:center;justify-content:center;z-index:20001}
      .mm-chat-card{width:min(720px,92vw);height:min(70vh,720px);background:#fff;border-radius:16px;display:flex;flex-direction:column;box-shadow:0 18px 48px rgba(0,0,0,.25)}
      .mm-chat-hd{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid #eee}
      .mm-chat-title{font-weight:800}
      .mm-chat-list{flex:1;overflow:auto;padding:12px;background:#f8f9fb}
      .mm-row{display:flex;margin:6px 0}
      .mm-row.me{justify-content:flex-end}
      .mm-bub{max-width:75%;padding:10px 12px;border-radius:12px;line-height:1.25;box-shadow:0 2px 6px rgba(0,0,0,.06)}
      .mm-bub.them{background:#fff;border:1px solid #e9ecef}
      .mm-bub.me{background:#ffefe5;border:1px solid #ffd7bf}
      .mm-bub .time{display:block;margin-top:6px;font-size:11px;opacity:.7;text-align:right}
      .mm-ft{display:flex;gap:8px;padding:10px;border-top:1px solid #eee;background:#fff}
      .mm-inp{flex:1;resize:none;height:44px;padding:10px;border:1px solid #ddd;border-radius:10px;outline:none}
      .mm-send{background:#ff6c0c;color:#fff;border:0;border-radius:10px;padding:0 16px;font-weight:700;cursor:pointer}
    `;
    document.head.appendChild(s);
  }
  function ensureModal() {
    if (document.getElementById("mm-chat-modal")) return;
    const el = document.createElement("div");
    el.className = "mm-chat-modal";
    el.id = "mm-chat-modal";
    el.innerHTML = `
      <div class="mm-chat-card">
        <div class="mm-chat-hd">
          <div class="mm-chat-title" id="mm-chat-title">Chat</div>
          <button id="mm-chat-close" style="background:none;border:0;font-size:20px;cursor:pointer">✕</button>
        </div>
        <div class="mm-chat-list" id="mm-chat-list"></div>
        <div class="mm-ft">
          <textarea id="mm-chat-text" class="mm-inp" placeholder="Escreva uma mensagem"></textarea>
          <button id="mm-chat-send" class="mm-send">Enviar</button>
        </div>
      </div>`;
    document.body.appendChild(el);
  }
  function ensureButton() {
    let btn = document.getElementById("openChat");
    if (!btn) {
      btn = document.createElement("button");
      btn.id = "openChat";
      btn.textContent = "Chat";
      document.body.appendChild(btn);
    }
    btn.onclick = (e) => { e.preventDefault(); window.CHAT?.open(); };
    document.addEventListener("click", (e) => {
      const t = e.target;
      if (t?.id === "openChat" || t?.closest?.("#openChat")) {
        e.preventDefault(); window.CHAT?.open();
      }
    });
  }

  const esc = (s) => (s || "").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const fmtHora = (ts) => {
    try { const d = ts?.toDate ? ts.toDate() : new Date(); return d.toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"}); }
    catch { return ""; }
  };
  const getQS = (k) => new URLSearchParams(location.search).get(k);
  const autodCorrida = () =>
    getQS("corrida") || getQS("corridaId") || getQS("id") ||
    localStorage.getItem("ultimaCorridaCliente") ||
    localStorage.getItem("ultimaCorridaMotorista") ||
    localStorage.getItem("corridaSelecionada");

  const CHAT = {
    _db: db, _uid: null, _role: "cliente", _corridaId: null, _unsub: () => {},
    init(role) {
      ensureStyles(); ensureModal(); ensureButton();
      this._role = role || "cliente";
      this._uid = firebase.auth().currentUser?.uid || null;

      document.getElementById("mm-chat-close").onclick = () => this.close();
      document.getElementById("mm-chat-send").onclick  = () => this.send();
      document.getElementById("mm-chat-text").onkeydown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); this.send(); }
      };
    },
    attach(id) {
      if (!id || id === this._corridaId) return;
      try { this._unsub(); } catch {}
      this._corridaId = id;

      const ttl = document.getElementById("mm-chat-title");
      if (ttl) ttl.textContent = this._role === "motorista" ? "Chat com Cliente" : "Chat com Motorista";

      const ref = this._db.collection("corridas").doc(id).collection("chat").orderBy("ts","asc").limit(500);
      this._unsub = ref.onSnapshot((snap) => {
        const list = document.getElementById("mm-chat-list"); if (!list) return;
        list.innerHTML = "";
        snap.forEach(d => {
          const m = d.data() || {};
          const mine = m?.role ? (m.role === this._role) : (m.senderId === this._uid);
          const row = document.createElement("div");
          row.className = "mm-row " + (mine ? "me" : "them");
          row.innerHTML = `<div class="mm-bub ${mine ? "me" : "them"}">
              <div>${esc(m.text || "")}</div>
              <span class="time">${fmtHora(m.ts)}</span>
            </div>`;
          list.appendChild(row);
        });
        list.scrollTop = list.scrollHeight;
      });
    },
    open() {
      ensureStyles(); ensureModal();
      if (!this._corridaId) this.attach(autodCorrida());
      document.getElementById("mm-chat-modal").style.display = "flex";
      setTimeout(() => document.getElementById("mm-chat-text").focus(), 0);
    },
    close() { document.getElementById("mm-chat-modal").style.display = "none"; },
    async send() {
      const txtEl = document.getElementById("mm-chat-text");
      const text = (txtEl.value || "").trim();
      if (!text || !this._corridaId) return;
      txtEl.value = "";
      await this._db.collection("corridas").doc(this._corridaId).collection("chat").add({
        text, senderId: this._uid, role: this._role, ts: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
  };

  window.CHAT = CHAT;

  firebase.auth().onAuthStateChanged(() => {
    const isCliente = /statusC\.html/i.test(location.pathname);
    CHAT.init(isCliente ? "cliente" : "motorista");
    const id = autodCorrida(); if (id) CHAT.attach(id);
  });
})();


