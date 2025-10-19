// latitude do estado de São Paulo 
const SP_BOUNDS = L.latLngBounds(
  L.latLng(-25.30, -53.10), 
  L.latLng(-19.80, -44.20) 
);
function estaDentroDeSaoPaulo(lat, lng) {
  return SP_BOUNDS.contains([lat, lng]);
}

// Aguarda o Firebase Auth disponibilizar o usuário atual (com timeout)
function obterUsuarioAtualAsync(timeoutMs = 4000) {
  try {
    const auth = firebase.auth && firebase.auth();
    const immediate = auth?.currentUser || null;
    if (immediate) return Promise.resolve(immediate);
    return new Promise((resolve) => {
      let done = false;
      const to = setTimeout(() => { if (!done) { done = true; resolve(null); } }, timeoutMs);
      auth.onAuthStateChanged((u) => { if (!done) { done = true; clearTimeout(to); resolve(u || null); } });
    });
  } catch { return Promise.resolve(null); }
}

// Utilitário para obter nome do cliente a partir do UID
async function getClienteNome(uid) {
  if (!uid || !db) return 'Cliente';
  try {
    // Tenta em 'usuarios' e depois em 'clientes'
    let s = await db.collection('usuarios').doc(uid).get();
    if (!s.exists) s = await db.collection('clientes').doc(uid).get();
    const d = s.exists ? (s.data()||{}) : {};
    return d?.dadosPessoais?.nome || d?.nome || 'Cliente';
  } catch (e) {
    console.warn('Falha ao obter nome do cliente:', e?.message||e);
    return 'Cliente';
  }
}

// === CEP da ENTREGA (destino) ===
function checarCEPEntrega() {
  const field = document.getElementById("cepEntrega");
  let digits = (field?.value || "").replace(/\D/g, "");
  // Aplica máscara 99999-999
  if (field) field.value = formatarCEP(digits);
  if (digits.length === 8) {
    if (isCEPSaoPaulo(digits)) {
      buscarEnderecoEntregaPorCEP(digits);
    } else {
      alert("Por favor, digite um CEP do estado de São Paulo.");
      if (field) field.value = "";
    }
  }
}

async function buscarEnderecoEntregaPorCEP(cep) {
  try {
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const data = await res.json();
    if (data.erro) return alert("CEP não encontrado!");

    if (data.uf !== "SP") {
      alert("Este CEP não pertence ao estado de São Paulo.");
      const f = document.getElementById("cepEntrega");
      if (f) f.value = "";
      return;
    }

    const endereco = `${data.logradouro}, ${data.bairro}, ${data.localidade} - ${data.uf}`;
    const entregaField = document.getElementById("localEntrega");
    if (entregaField) entregaField.value = endereco;

    const q = encodeURIComponent(`${data.logradouro}, ${data.bairro}, ${data.localidade}, ${data.uf}`);
    const nominatimRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${q}`);
    const nominatimData = await nominatimRes.json();
    if (!nominatimData[0]) return;

    const lat = parseFloat(nominatimData[0].lat);
    const lon = parseFloat(nominatimData[0].lon);

    if (!estaDentroDeSaoPaulo(lat, lon)) {
      alert("Por favor, selecione um endereço dentro do estado de São Paulo.");
      return;
    }

    destinoCoords = [lat, lon];
    map.setView(destinoCoords, 15);
    markerDestino.setLatLng(destinoCoords).setOpacity(1);
    reverterGeocodificacao(lat, lon, "localEntrega", false);
    atualizarRota();
  } catch {
    alert("Erro ao buscar o endereço pelo CEP da entrega.");
  }
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

let db;
let currentEntregaId = null;

let map;
let markerOrigem, markerDestino, routeLine;
let origemCoords = null;
let destinoCoords = null;

function iniciarMapa() {
  const defaultLatLng = [-23.5505, -46.6333]; 

  map = L.map("map", {
    zoomControl: true,
    scrollWheelZoom: true,
    dragging: true,
    minZoom: 6,
    maxZoom: 18,
    maxBounds: SP_BOUNDS,
    maxBoundsViscosity: 1.0,
    worldCopyJump: false
  }).setView(defaultLatLng, 7);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
    noWrap: true,
    bounds: SP_BOUNDS
  }).addTo(map);
  markerOrigem = L.marker(defaultLatLng, { draggable: true })
    .addTo(map)
    .bindPopup("Origem (arraste para mudar)")
    .openPopup();

  const redIcon = L.icon({
    iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });

  markerDestino = L.marker(defaultLatLng, {
    draggable: false, 
    opacity: 0.5,
    icon: redIcon
  }).addTo(map).bindPopup("Destino");

  markerOrigem.on("dragend", () => {
    const { lat, lng } = markerOrigem.getLatLng();
    if (estaDentroDeSaoPaulo(lat, lng)) {
      origemCoords = [lat, lng];
      reverterGeocodificacao(lat, lng, "localRetirada", true);
      atualizarRota();
    } else {
      alert("Origem fora do estado de São Paulo. Selecione um local dentro de SP.");
      markerOrigem.setLatLng(origemCoords || defaultLatLng);
    }
  });

  markerDestino.on("dragend", () => {
    const { lat, lng } = markerDestino.getLatLng();
    if (estaDentroDeSaoPaulo(lat, lng)) {
      destinoCoords = [lat, lng];
      reverterGeocodificacao(lat, lng, "localEntrega", true);
      atualizarRota();
    } else {
      alert("Destino fora do estado de São Paulo. Selecione um local dentro de SP.");
      markerDestino.setLatLng(destinoCoords || defaultLatLng);
    }
  });
  // Geolocalização
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const { latitude, longitude } = coords;
        if (estaDentroDeSaoPaulo(latitude, longitude)) {
          origemCoords = [latitude, longitude];
          map.setView(origemCoords, 15);
          markerOrigem.setLatLng(origemCoords);
          reverterGeocodificacao(latitude, longitude, "localRetirada", true);
        } else {
          origemCoords = defaultLatLng;
          reverterGeocodificacao(defaultLatLng[0], defaultLatLng[1], "localRetirada", true);
        }
      },
      () => {
        origemCoords = defaultLatLng;
        reverterGeocodificacao(defaultLatLng[0], defaultLatLng[1], "localRetirada", true);
      }
    );
  } else {
    origemCoords = defaultLatLng;
    reverterGeocodificacao(defaultLatLng[0], defaultLatLng[1], "localRetirada", true);
  }
}

//  CEP (so SP) 
function checarCEP() {
  let cep = document.getElementById("cep").value.replace(/\D/g, "");
  if (cep.length === 8) {
    if (isCEPSaoPaulo(cep)) {
      buscarEnderecoPorCEP(cep);
    } else {
      alert("Por favor, digite um CEP do estado de São Paulo.");
      document.getElementById("cep").value = "";
    }
  }
}
function isCEPSaoPaulo(cep) {
  const cepNum = parseInt(cep, 10);
  return cepNum >= 1000000 && cepNum <= 19999999;
}
// Atualiza o marcador e o mapa dps de mudar o CEP
async function buscarEnderecoPorCEP(cep) {
  try {
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const data = await res.json();
    if (data.erro) return alert("CEP não encontrado!");

    if (data.uf !== "SP") {
      alert("Este CEP não pertence ao estado de São Paulo.");
      document.getElementById("cep").value = "";
      return;
    }

    const endereco = `${data.logradouro}, ${data.bairro}, ${data.localidade} - ${data.uf}`;
    document.getElementById("localRetirada").value = endereco;

    const q = encodeURIComponent(`${data.logradouro}, ${data.bairro}, ${data.localidade}, ${data.uf}`);
    const nominatimRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${q}`);
    const nominatimData = await nominatimRes.json();
    if (!nominatimData[0]) return;

    const lat = parseFloat(nominatimData[0].lat);
    const lon = parseFloat(nominatimData[0].lon);

    if (!estaDentroDeSaoPaulo(lat, lon)) {
      alert("Por favor, selecione um endereço dentro do estado de São Paulo.");
      return;
    }

    origemCoords = [lat, lon];
    map.setView(origemCoords, 15); // muda a visão do mapa
    markerOrigem.setLatLng(origemCoords).setOpacity(1); // muda a posição do marcador
    reverterGeocodificacao(lat, lon, "localRetirada", false); // muda o campo do endereço
    atualizarRota(); // Atualiza a rota
  } catch {
    alert("Erro ao buscar o endereço pelo CEP.");
  }
}
// reverse geocode openstreetmap api
async function reverterGeocodificacao(lat, lon, campo, setCep) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`);
    const data = await res.json();
    if (!data.address) return;

    const a = data.address;
    const state = (a.state || "").toLowerCase();
    if (!estaDentroDeSaoPaulo(lat, lon) || (!state.includes("são paulo") && !state.includes("sp"))) {
      alert("Endereço localizado fora do estado de São Paulo.");
      return; 
    }

    const enderecoMontado =
      (a.road ? a.road + ", " : "") +
      (a.suburb ? a.suburb + ", " : "") +
      (a.city || a.town || a.village || "") +
      (a.state ? " - " + a.state : "");
    document.getElementById(campo).value = enderecoMontado;

    if (setCep && a.postcode && isCEPSaoPaulo(a.postcode.replace(/\D/g, ""))) {
      if (campo === "localRetirada") {
        const f = document.getElementById("cep");
        if (f) f.value = formatarCEP(a.postcode);
      } else if (campo === "localEntrega") {
        const f2 = document.getElementById("cepEntrega");
        if (f2) f2.value = formatarCEP(a.postcode);
      }
    }
  } catch (e) {
    console.error("Erro reverse geocode", e);
  }
}
async function validarEnderecoSPPorTexto(fieldId) {
  const input = document.getElementById(fieldId);
  const val = (input.value || "").trim();
  if (!val) return true;

  const q =
    val.toLowerCase().includes("são paulo") || val.toLowerCase().includes("sp")
      ? val
      : `${val}, São Paulo, Brasil`;

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=1&countrycodes=br&q=${encodeURIComponent(
      q
    )}`;
    const res = await fetch(url);
    const data = await res.json();

    if (!data[0]) {
      alert("Endereço inválido. Digite um endereço dentro do estado de São Paulo.");
      input.value = "";
      return false;
    }

    const lat = parseFloat(data[0].lat),
      lon = parseFloat(data[0].lon);
    const state = (data[0].address?.state || "").toLowerCase();

    if (!estaDentroDeSaoPaulo(lat, lon) || (!state.includes("são paulo") && !state.includes("sp"))) {
      alert("Este endereço não pertence ao estado de São Paulo.");
      input.value = "";
      return false;
    }

    return true;
  } catch (e) {
    console.error("Erro ao validar endereço:", e);
    return true; 
  }
}

function formatarCEP(cep) {
  cep = cep.replace(/\D/g, "");
  return cep.length === 8 ? cep.substr(0, 5) + "-" + cep.substr(5, 3) : cep;
}

let timeoutAutocomplete;
async function autocompleteEndereco(campo) {
  clearTimeout(timeoutAutocomplete);
  timeoutAutocomplete = setTimeout(async () => {
    const val = document.getElementById(campo).value.trim();
    if (val.length < 3) return fecharAutocomplete(campo);

    const searchQuery =
      val.includes("SP") || val.includes("São Paulo") ? val : val + ", São Paulo, Brasil";
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      searchQuery
    )}&addressdetails=1&limit=10&countrycodes=br`;
    const res = await fetch(url);
    const data = await res.json();

    const spResults = data.filter((item) => {
      const lat = parseFloat(item.lat);
      const lng = parseFloat(item.lon);
      return (
        estaDentroDeSaoPaulo(lat, lng) &&
        (item.address?.state?.toLowerCase().includes("são paulo") ||
          item.address?.state?.toLowerCase().includes("sp") ||
          item.display_name.toLowerCase().includes("são paulo"))
      );
    });

    mostrarListaAutocomplete(campo, spResults);
  }, 300);
}

function mostrarListaAutocomplete(campo, data) {
    let container = document.getElementById(`autocomplete-list-${campo}`);
    if (!container) {
        container = document.createElement("div");
        container.id = `autocomplete-list-${campo}`;
        container.classList.add("autocomplete-items");
        const parent = document.getElementById(campo)?.parentNode;
        if (parent) {
            parent.appendChild(container);
        }
    }
    container.innerHTML = ""; 
    if (!data.length) {
        container.style.display = "none";
        return;
    }

    data.forEach((item) => {
        const div = document.createElement("div");
        div.textContent = item.display_name;
        div.addEventListener("click", () => {
            selecionarItemAutocomplete(campo, item);
            fecharAutocomplete(campo);
        });
        container.appendChild(div);
    });

    container.style.display = "block";
}

function fecharAutocomplete(campo) {
  const c = document.getElementById(`autocomplete-list-${campo}`);
  if (c) c.style.display = "none";
}

async function selecionarItemAutocomplete(campo, item) {
  document.getElementById(campo).value = item.display_name;
  const lat = parseFloat(item.lat);
  const lon = parseFloat(item.lon);

  if (!estaDentroDeSaoPaulo(lat, lon)) {
    alert("Por favor, selecione um endereço dentro do estado de São Paulo.");
    return;
  }

  if (campo === "localRetirada") {
    origemCoords = [lat, lon];
    markerOrigem.setLatLng(origemCoords).setOpacity(1);
    map.setView(origemCoords, 15);
    document.getElementById("cep").value =
      item.address?.postcode && isCEPSaoPaulo(item.address.postcode.replace(/\D/g, ""))
        ? formatarCEP(item.address.postcode)
        : "";
  } else {
    destinoCoords = [lat, lon];
    markerDestino.setLatLng(destinoCoords).setOpacity(1);
    map.setView(destinoCoords, 15);

    const cepEntregaEl = document.getElementById("cepEntrega");
    const pc = item.address?.postcode?.replace(/\D/g, "") || "";
    if (cepEntregaEl && pc && isCEPSaoPaulo(pc)) {
      cepEntregaEl.value = formatarCEP(pc);
    }
  }
  atualizarRota();
}

function atualizarRota() {
  if (routeLine) map.removeLayer(routeLine);
  if (origemCoords && destinoCoords) {
    routeLine = L.polyline([origemCoords, destinoCoords], {
      color: "orange",
      weight: 4,
      opacity: 0.7,
      dashArray: "10,10"
    }).addTo(map);
    map.fitBounds(routeLine.getBounds(), { padding: [50, 50] });
  }
}
function calcularDistancia(lat1, lon1, lat2, lon2) {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function ouvirPropostas(entregaId) {
  if (!db || !entregaId) return;

  db.collection("entregas")
    .doc(entregaId)
    .collection("propostas")
    .orderBy("dataEnvio", "asc")
    .onSnapshot(async (snapshot) => {
      const container = document.getElementById("propostasContainer");
      container.innerHTML = `
        <h3>Propostas Recebidas</h3>
        <div id="lista-propostas" class="lista-propostas"></div>
      `;
      const lista = document.getElementById("lista-propostas");

      if (snapshot.empty) {
        lista.innerHTML = `<p>Aguardando propostas dos motoristas...</p>`;
        return;
      }
      const cacheMotoristas = {};

      let pedido = {};
      try {
        const pedidoSnap = await db.collection('entregas').doc(entregaId).get();
        pedido = pedidoSnap.exists ? (pedidoSnap.data()||{}) : {};
      } catch {}
            async function getMotorista(uid) {
    console.log("[MOTORISTA] Buscando dados do UID:", uid); 
    if (!uid) return { nome: "Motorista", foto: null, nota: 0 };

    try {
        const snap = await db.collection("motoristas").doc(uid).get();
        if (!snap.exists) {
            console.log("[MOTORISTA] ❌ Não encontrado:", uid); 
            return { nome: "Motorista", foto: null, nota: 0 };
        }
        
        const data = snap.data() || {};
        
        const nome = data.dadosPessoais?.nome || data.nome || "Motorista";
        const foto = data.dadosPessoais?.fotoPerfilUrl || data.fotoPerfilUrl || null;
        
        let nota = 0;
        if (typeof data.avaliacaoMedia === 'number') {
          nota = data.avaliacaoMedia;
        } else if (typeof data.media === 'number') {
          nota = data.media;
        } else if (data.ratingSum && data.ratingCount) {
          nota = Number(data.ratingSum) / Number(data.ratingCount);
        }

        console.log(`[MOTORISTA] ✓ ${nome} - Nota: ${nota.toFixed(2)} (avaliacaoMedia: ${data.avaliacaoMedia}, media: ${data.media})`);

        const motoristaInfo = { nome, foto, nota: Number(nota) || 0 };
        cacheMotoristas[uid] = motoristaInfo; 
        return motoristaInfo;

    } catch (error) {
        console.error("[MOTORISTA] ❌ Erro ao carregar:", error);
        return { nome: "Motorista", foto: null, nota: 0 };
    }
}

      lista.innerHTML = "";
      for (const doc of snapshot.docs) {
        const p = doc.data();

        let uidMotorista = p.motoristaUid || p.motoristaId || p.uidMotorista || p.uid || p.userId || p.authorId || doc.id || "";
        console.log("[proposta] UID do motorista (resolvido):", uidMotorista, "|| bruto:", { motoristaUid: p.motoristaUid, motoristaId: p.motoristaId, uidMotorista: p.uidMotorista, uid: p.uid, userId: p.userId, authorId: p.authorId });

        const info = uidMotorista ? await getMotorista(uidMotorista) : { nome: null, foto: null, nota: 0 };
        let nomeMotorista = info?.nome || p.nomeMotorista || p.motoristaNome || p.nome || "Motorista";
        const fotoMotorista = info?.foto || p.fotoMotorista || null;
        const notaMotorista = Number(info?.nota||0);

        const card = document.createElement("div");
        card.className = "proposta-card";
        const stars = '★'.repeat(Math.round(notaMotorista)) + '☆'.repeat(5-Math.round(notaMotorista));
        const origemTxt = pedido?.origem?.endereco || document.getElementById('localRetirada')?.value || '-';
        const destinoTxt = pedido?.destino?.endereco || document.getElementById('localEntrega')?.value || '-';
        const tipoVeiculo = p.veiculo || pedido?.tipoVeiculo || '-';
        const shortId = `#${String(entregaId).substring(0,6)}`;
        card.innerHTML = `
          <div style="position:relative; background:#fff; border-radius:16px; box-shadow:0 10px 24px rgba(0,0,0,.08); padding:18px 18px 18px 0; display:flex; gap:16px; align-items:flex-start;">
            <div style="position:absolute; left:0; top:14px; bottom:14px; width:6px; background:linear-gradient(180deg,#ff7a3f 0%,#ff6b35 100%); border-radius:0 6px 6px 0"></div>
            <div style="margin-left:16px; width:52px; height:52px; border-radius:50%; background:#fff; box-shadow:0 6px 14px rgba(255,107,53,.35); border:2px solid #ff6b35; display:flex; align-items:center; justify-content:center; overflow:hidden; flex: 0 0 52px;">
              ${fotoMotorista ? `<img src="${fotoMotorista}" alt="foto" style="width:100%;height:100%;object-fit:cover"/>` : `<i class=\"fa-solid fa-user\" style=\"color:#ff6b35;font-size:22px\"></i>`}
            </div>
            <div style="flex:1 1 auto; min-width:0;">
              <div style="font-weight:700;color:#1e1e1e">${nomeMotorista}</div>
              <div style="color:#f5a623;font-weight:700; display:flex; align-items:center; gap:6px; margin-top:2px">
                <i class="fa-solid fa-star"></i> ${notaMotorista.toFixed(1)}
              </div>
              <div style="margin-top:10px; color:#333; line-height:1.35">
                <div style="color:#7b7b7b; font-weight:700; margin-bottom:6px">Corrida ${shortId}</div>
                <div><strong>De:</strong> <span style="color:#555">${origemTxt}</span></div>
                <div><strong>Para:</strong> <span style="color:#555">${destinoTxt}</span></div>
                <div style="margin-top:6px"><strong>Tipo de veículo:</strong> ${tipoVeiculo}</div>
                <div><strong>Tempo de chegada:</strong> ${p.tempoChegada || 0} min</div>
                <div><strong>Ajudantes:</strong> ${p.ajudantes?.quantidade || 0} ${p.ajudantes?.quantidade === 1 ? 'ajudante' : 'ajudantes'}</div>
              </div>
            </div>
            <div style="text-align:right; min-width:180px; padding-left:8px;">
              <div style="color:#ff6b35;font-size:1.9rem;font-weight:800">R$ ${Number(p.preco||0).toFixed(2)}</div>
              <button class="aceitar-btn" style="margin-top:12px;background:#ff6b35;color:#fff;border:0;padding:12px 16px;border-radius:12px;cursor:pointer;font-weight:800"
                onclick="aceitarProposta('${entregaId}', '${doc.id}', '${uidMotorista}')">ACEITAR PROPOSTA</button>
            </div>
          </div>
        `;
        lista.appendChild(card);
      }
    });
}

function mostrarModalPropostas(entregaId, snapshot) {  }
function fecharModalPropostas() {
  const modal = document.getElementById("propostasModal");
  if (modal) {
    modal.style.opacity = "0";
    modal.querySelector(".modal-content").style.transform = "scale(0.9)";
    setTimeout(() => {
      modal.style.display = "none";
    }, 300);
  }
}

async function aceitarProposta(entregaId, propostaId, motoristaId) {
  if (!db) return alert("Erro: Firebase não inicializado.");
  try {
    const propostaDoc = await db
      .collection("entregas").doc(entregaId)
      .collection("propostas").doc(propostaId).get();
    if (!propostaDoc.exists) return alert("Proposta não encontrada.");
    const propostaData = propostaDoc.data();

    if (!motoristaId) {
      motoristaId = propostaData.motoristaUid || propostaData.motoristaId || propostaData.uidMotorista || propostaData.uid || propostaData.userId || propostaData.authorId || null;
      console.log("[aceitarProposta] motoristaId deduzido da proposta:", motoristaId);
    }

    let motoristaNome = "Motorista";
    try {
      const snapM = await db.collection("motoristas").doc(motoristaId).get();
      const snapU = snapM.exists ? null : await db.collection("usuarios").doc(motoristaId).get();
      const d = snapM.exists ? (snapM.data()||{}) : (snapU?.exists ? (snapU.data()||{}) : {});
      motoristaNome = d?.dadosPessoais?.nome || d?.nome || motoristaNome;
    } catch {}

    const clienteUid = (firebase.auth && firebase.auth().currentUser) ? (firebase.auth().currentUser.uid || null) : null;

    await db.collection("entregas").doc(entregaId).update({
      status: "proposta_aceita",
      propostaAceita: { propostaId, motoristaId, ...propostaData },
      motoristaId: motoristaId,
      motoristaNome: motoristaNome,
      clienteId: clienteUid,
      aceitoEm: new Date().toISOString(),
      clienteConfirmou: true
    });

    try {
      await db.collection('corridas').doc(entregaId).set({
        motoristaId: motoristaId,
        motoristaNome: motoristaNome,
        clienteId: clienteUid,
        tipo: 'mudanca'
      }, { merge: true });
    } catch (e) {
      console.warn('Falha ao pré-preencher corridas/', entregaId, e?.message||e);
    }

    localStorage.setItem("ultimaCorridaCliente", entregaId);

    
    fecharModalPropostas();
    mostrarAguardandoMotorista(entregaId, { nomeMotorista: motoristaNome, valor: propostaData?.preco });
  } catch (error) {
    console.error("Erro ao aceitar proposta:", error);
    alert("Erro ao aceitar proposta. Tente novamente.");
  }
}

function mostrarAguardandoMotorista(entregaId, dados = {}) {
  let modal = document.getElementById('modalAguardandoMotorista');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modalAguardandoMotorista';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content aguardando-card">
        <div class="aguardando-header"><i class="fa-solid fa-hourglass-half"></i> Aguardando Motorista</div>
        <div class="aguardando-sep"></div>
        <div class="aguardando-body">
          <div class="aguardando-icon"><i class="fa-solid fa-circle-check"></i></div>
          <div class="aguardando-text">
            <p><strong>Proposta aceita com sucesso!</strong></p>
            <p>Motorista: <strong id="aguardando-motorista-nome">—</strong></p>
            <p>Valor: <strong id="aguardando-valor">R$ 0,00</strong></p>
            <p>Aguardando o motorista confirmar o início da corrida...</p>
            <div class="aguardando-spinner"></div>
          </div>
        </div>
      </div>`;
    document.body.appendChild(modal);
  }

  if (dados?.nomeMotorista) document.getElementById('aguardando-motorista-nome').textContent = dados.nomeMotorista;
  if (dados?.valor != null) document.getElementById('aguardando-valor').textContent = `R$ ${Number(dados.valor||0).toFixed(2)}`;

  modal.style.display = 'flex';

  setTimeout(() => {
    modal.style.opacity = '1';
    const card = modal.querySelector('.modal-content');
    if (card) card.style.transform = 'scale(1)';
  }, 10);

  // ADICIONE ESTA LINHA ↓↓↓
  ouvirStatusPagamento(entregaId);

  const stopCorrida = db.collection('corridas').doc(entregaId)
    .onSnapshot(doc => {
      const st = doc.exists ? doc.data()?.status : null;
      if (st === 'em_andamento' || st === 'a_caminho_destino') {
        modal.style.display = 'none';
        window.location.href = `statusC.html?corrida=${encodeURIComponent(entregaId)}&tipo=cliente`;
        stopCorrida(); stopEntrega();
      }
    });

  const stopEntrega = db.collection('entregas').doc(entregaId)
    .onSnapshot(doc => {
      if (!doc.exists) return;
      const st = doc.data()?.status;
      if (st === 'aguardando_propostas' || st === 'recusada_pelo_motorista') {
        modal.style.display = 'none';
        alert('O motorista recusou a corrida. Escolha outra proposta.');
        stopEntrega(); stopCorrida();
      }
    });
}
// Adicione esta função após mostrarAguardandoMotorista
function ouvirStatusPagamento(entregaId) {
  if (!db) return;
  
  const unsubscribe = db.collection('corridas').doc(entregaId)
    .onSnapshot(async (doc) => {
      if (!doc.exists) return;
      
      const data = doc.data();
      console.log('[PAGAMENTO] Status da corrida:', data.status);
      console.log('[PAGAMENTO] Cliente deve pagar?', data.clienteDevePagar);
      
      // Se cliente deve pagar, redireciona para pagamento
      if (data.clienteDevePagar && data.status === 'aguardando_pagamento') {
        console.log('[PAGAMENTO] Redirecionando para pagamento...');
        
        try {
          // Fecha o modal de aguardando motorista se estiver aberto
          const modal = document.getElementById('modalAguardandoMotorista');
          if (modal) modal.style.display = 'none';
          
          // Busca dados do pagamento
          const dadosPagamento = await buscarDadosPagamentoHomeC(entregaId);
          
          // Cria pagamento no Mercado Pago
          await criarPagamentoMercadoPagoHomeC(dadosPagamento);
          
        } catch (error) {
          console.error('[PAGAMENTO] Erro ao processar:', error);
          alert('Erro ao processar pagamento. Tente novamente.');
        }
        
        // Para de ouvir após redirecionar
        unsubscribe();
        return;
      }
      
      // Se pagamento foi confirmado e corrida iniciou
      if (data.status === 'em_andamento' && data.corridaIniciada === true) {
        console.log('[PAGAMENTO] Pagamento confirmado! Redirecionando para statusC...');
        unsubscribe();
        window.location.href = `statusC.html?corrida=${encodeURIComponent(entregaId)}&tipo=cliente`;
      }
    });
}

// Função para buscar dados do pagamento (cópia da statusC)
async function buscarDadosPagamentoHomeC(corridaId) {
  try {
    let data = null;
    try {
      const snap = await db.collection('corridas').doc(corridaId).get();
      data = snap.exists ? (snap.data() || null) : null;
    } catch {}
    
    if (!data) {
      try {
        const snap2 = await db.collection('entregas').doc(corridaId).get();
        data = snap2.exists ? (snap2.data() || null) : null;
      } catch {}
    }
    
    if (!data) throw new Error('Corrida não encontrada');

    let proposta = data?.propostaAceita || null;
    
    const precoBase = (typeof proposta?.preco === 'number')
      ? Number(proposta.preco)
      : Number(data?.preco || data?.valor || 50);

    let extras = 0;
    try {
      const p = proposta || data?.propostaAceita || {};
      const count = Number.isFinite(Number(p.ajudante)) ? Number(p.ajudante)
                   : Number.isFinite(Number(p.ajudantes)) ? Number(p.ajudantes)
                   : 0;
      extras = 50 * Math.max(0, count);
    } catch {}

    const valorBaseTotal = Number(precoBase) + Number(extras);
    const valorPagamento = Math.round((valorBaseTotal * 1.0) * 100) / 100;
    
    console.log('[PAGAMENTO] Valor calculado:', valorPagamento);

    return {
      corridaId,
      valor: Number.isFinite(valorPagamento) && valorPagamento > 0 ? valorPagamento : 50,
      clienteId: data.clienteId || null,
      motoristaId: data.motoristaId || data.propostaAceita?.motoristaUid,
      tipo: 'mudanca',
      descricao: `Corrida de Mudança - ${corridaId.substring(0, 8)}`
    };
  } catch (error) {
    console.error('[PAGAMENTO] Erro ao buscar dados:', error);
    throw error;
  }
}

// Função para criar pagamento (cópia da statusC)
async function criarPagamentoMercadoPagoHomeC(dadosPagamento) {
  let { corridaId, valor, clienteId, descricao } = dadosPagamento;

  try {
    const isVercel = /vercel\.app$/i.test(window.location.hostname);
    const apiBase = isVercel ? `${window.location.origin}/api` : 'http://localhost:3000';

    if (!Number.isFinite(Number(valor)) || Number(valor) <= 0) {
      console.warn('[PAGAMENTO] Valor inválido, usando fallback 50');
      valor = 50;
    }

    const items = [{
      title: descricao,
      quantity: 1,
      unit_price: Number(valor),
      currency_id: 'BRL'
    }];

    const pagesBase = isVercel ? window.location.origin : 'http://localhost:3000';
    const back_urls = {
      success: `${pagesBase}/pagamento-sucesso.html?corrida=${encodeURIComponent(corridaId)}&status=approved&valor=${valor}`,
      failure: `${pagesBase}/pagamento-erro.html?corrida=${encodeURIComponent(corridaId)}`,
      pending: `${pagesBase}/pagamento-erro.html?corrida=${encodeURIComponent(corridaId)}`
    };

    console.log('[PAGAMENTO] Criando preferência...', { corridaId, valor });
    
    const payer = {
      email: (firebase.auth?.currentUser?.email) || `${(clienteId||'cliente')}@moomate.app`,
      name: 'Cliente Moomate'
    };

    const createUrl = isVercel ? `${apiBase}/create_preference` : `${apiBase}/create-mercadopago-preference`;
    
    let resp = await fetch(createUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items,
        payer,
        payment_methods: {},
        back_urls,
        external_reference: corridaId
      })
    });

    if (!resp.ok) {
      console.warn('[PAGAMENTO] Backend local falhou, tentando Vercel...');
      resp = await fetch('https://moomate-omrw.vercel.app/api/create_preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          corridaId,
          valor: Number(valor),
          clienteId,
          items,
          payer,
          back_urls,
          auto_return: 'approved'
        })
      });
      
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`HTTP ${resp.status}: ${txt || 'sem mensagem'}`);
      }
    }

    const data = await resp.json();
    const init_point = data?.init_point;
    
    if (!init_point) throw new Error('init_point não retornado');
    
    try {
      await db.collection('corridas').doc(corridaId).update({
        pagamento: {
          preferenceId: data.preference_id || null,
          valor: Number(valor),
          status: 'pendente',
          criadoEm: firebase.firestore.FieldValue.serverTimestamp()
        }
      });
    } catch {}
    
    try { 
      localStorage.setItem('lastPayment', JSON.stringify({ valor: Number(valor), corridaId })); 
    } catch {}
    
    console.log('[PAGAMENTO] Redirecionando para:', init_point);
    window.location.href = init_point;

  } catch (error) {
    console.error('[PAGAMENTO] Erro ao criar pagamento:', error);
    alert('Erro ao processar pagamento. Tente novamente.');
    throw error;
  }
}

async function verMotoristas() {
  if (!origemCoords || !destinoCoords) return alert("Defina origem e destino.");

  if (
    !estaDentroDeSaoPaulo(origemCoords[0], origemCoords[1]) ||
    !estaDentroDeSaoPaulo(destinoCoords[0], destinoCoords[1])
  ) {
    return alert("Origem e destino devem estar dentro do estado de São Paulo.");
  }

  const tipoVeiculo = document.getElementById("tipoVeiculo").value;
  if (!tipoVeiculo) return alert("Selecione um tipo de veículo.");
  
  const user = await obterUsuarioAtualAsync();
  if (!user) {
    alert('Faça login para criar o pedido (ou aguarde alguns segundos e tente novamente).');
    return;
  }

  const dadosFormulario = {
    origem: {
      endereco: document.getElementById("localRetirada").value,
      numero: document.getElementById("numeroRetirada").value || "",
      complemento: document.getElementById("complementoRetirada").value || "",
      cep: document.getElementById("cep").value,
      coordenadas: { lat: origemCoords[0], lng: origemCoords[1] }
    },
    destino: {
      endereco: document.getElementById("localEntrega").value,
      numero: document.getElementById("numeroEntrega").value || "",
      complemento: document.getElementById("complementoEntrega").value || "",
      coordenadas: { lat: destinoCoords[0], lng: destinoCoords[1] }
    },
    tipoVeiculo,
    distancia: 0,
    precoEstimado: 0,
    status: "aguardando_propostas",
    criadoEm: new Date().toISOString(),
    propostas: {}
  };

  try {
    const uid = user.uid;
    dadosFormulario.clienteId = uid;
    const nomeCli = await getClienteNome(uid);
    dadosFormulario.clienteNome = nomeCli;
    try { localStorage.setItem('clienteNome', nomeCli); } catch {}
  } catch (e) {
    console.warn('Não foi possível preencher clienteId/nome:', e?.message||e);
    dadosFormulario.clienteNome = (window.userNome || localStorage.getItem('clienteNome') || 'Cliente');
  }

  // CALCULAR DISTÂNCIA BASE
  const dist = calcularDistancia(
    origemCoords[0], origemCoords[1],
    destinoCoords[0], destinoCoords[1]
  );

  // NOVO: SIMULAR ROTA E DETECTAR PEDÁGIOS
  console.log("🚗 Simulando rota para detectar pedágios...");
  
  let infoPedagio = { pedagio: 0, pedagios: [], detalhes: "Calculando..." };
  
  try {
    infoPedagio = await calcularPrecoFinalComPedagio(
      origemCoords,
      destinoCoords,
      tipoVeiculo,
      0 // preço base temporário só para calcular pedágio
    );
  } catch (error) {
    console.warn("Erro ao calcular pedágios:", error);
    infoPedagio = { pedagio: 0, pedagios: [], detalhes: "Não foi possível calcular" };
  }

  // CALCULAR PREÇO FINAL
  const precoBase = 50 + (2 * dist);
  const precoFinal = precoBase + infoPedagio.pedagio;

  dadosFormulario.distancia = parseFloat(dist.toFixed(2));
  dadosFormulario.precoEstimado = parseFloat(precoFinal.toFixed(2));
  dadosFormulario.pedagio = {
    valor: parseFloat(infoPedagio.pedagio.toFixed(2)),
    pedagios: infoPedagio.pedagios,
    temPedagio: infoPedagio.temPedagio,
    detalhes: infoPedagio.detalhes
  };

  // MOSTRAR BREAKDOWN PARA O USUÁRIO
  mostrarBreakdownPreco(precoBase, infoPedagio);

  try {
    if (db) {
      const docRef = await db.collection("entregas").add(dadosFormulario);

      try {
        await db.collection('entregas').doc(docRef.id).update({
          clienteId: dadosFormulario.clienteId,
          clienteNome: dadosFormulario.clienteNome
        });
      } catch (e) { console.warn('Falha ao reforçar clienteId/nome na entrega:', e?.message||e); }
      currentEntregaId = docRef.id;

      console.log("Dados salvos no Firebase:", dadosFormulario);

      ouvirPropostas(docRef.id);
      document.getElementById("propostasContainer").style.display = "block";
    } else {
      console.log("Dados que seriam salvos:", dadosFormulario);
      alert(`Dados capturados com sucesso!\n\nORIGEM: ${dadosFormulario.origem.endereco}\nDESTINO: ${dadosFormulario.destino.endereco}\nTIPO: ${dadosFormulario.tipoVeiculo}\nDISTÂNCIA: ${dadosFormulario.distancia} km\nPEDÁGIO: R$ ${dadosFormulario.pedagio.valor.toFixed(2)}\nPREÇO TOTAL: R$ ${dadosFormulario.precoEstimado.toFixed(2)}\n\nServiço temporariamente indisponível. Tente novamente.`);
    }
  } catch (error) {
    console.error("Erro ao salvar pedido:", error);
    alert("Erro ao criar pedido. Tente novamente.");
  }
}
// SUBSTITUA a função mostrarBreakdownPreco em homeC.js por esta:

function mostrarBreakdownPreco(precoBase, infoPedagio) {
  // Se não tem pedágio, não mostra o breakdown
  if (!infoPedagio.temPedagio || !infoPedagio.pedagios || infoPedagio.pedagios.length === 0) {
    return;
  }

  const antigoBreakdown = document.getElementById('priceBreakdown');
  if (antigoBreakdown) antigoBreakdown.remove();

  const breakdown = document.createElement('div');
  breakdown.id = 'priceBreakdown';
  breakdown.style.cssText = `
    background: linear-gradient(135deg, #fff5ef 0%, #ffe8dc 100%);
    padding: 20px;
    border-radius: 12px;
    margin: 15px 0;
    border-left: 5px solid #ff6b35;
    box-shadow: 0 4px 12px rgba(255, 107, 53, 0.15);
    font-size: 14px;
  `;

  let html = `
    <div style="background: white; padding: 12px; border-radius: 8px; margin-bottom: 0; border-left: 3px solid #f5a623;">
      <strong style="color: #f5a623;">🛣️ Pedágios Detectados:</strong>
      <ul style="margin: 8px 0 0 20px; padding: 0;">
  `;
  
  infoPedagio.pedagios.forEach(p => {
    html += `
      <li style="margin: 4px 0; font-size: 13px;">
        <strong>${p.nome}</strong> (${p.rodovia})
        <span style="float: right; color: #f5a623;">R$ ${p.preco.toFixed(2)}</span>
      </li>
    `;
  });

  html += `
      </ul>
      <div style="display: flex; justify-content: space-between; margin-top: 10px; padding-top: 10px; border-top: 1px solid #f5a623;">
        <span><strong>Total de Pedágios:</strong></span>
        <span style="font-weight: 600; color: #f5a623;">R$ ${infoPedagio.pedagio.toFixed(2)}</span>
      </div>
    </div>
  `;

  breakdown.innerHTML = html;
  
  const propostasContainer = document.getElementById('propostasContainer');
  if (propostasContainer) {
    propostasContainer.parentNode.insertBefore(breakdown, propostasContainer);
  } else {
    document.querySelector('.form-fields').appendChild(breakdown);
  }
}

function selecionarTipo(tipo) {
  const opcoes = document.querySelectorAll(".vehicle-option");
  const atual = Array.from(opcoes).find((el) => el.dataset.type === tipo);

  if (atual.classList.contains("selected")) {
    atual.classList.remove("selected");
    document.getElementById("tipoVeiculo").value = "";
    opcoes.forEach((el) => (el.style.display = "block"));
  } else {
    opcoes.forEach((el) => el.classList.remove("selected"));
    atual.classList.add("selected");
    document.getElementById("tipoVeiculo").value = tipo;
    opcoes.forEach((el) => {
      if (!el.classList.contains("selected")) el.style.display = "none";
    });
  }
}

document.addEventListener("DOMContentLoaded", function () {
  const cepField = document.getElementById("cep");
  const localRetiradaField = document.getElementById("localRetirada");
  const localEntregaField = document.getElementById("localEntrega");
  const cepEntregaField = document.getElementById("cepEntrega");
  const verMotoristasBtn = document.getElementById("verMotoristas");

  if (cepField) cepField.addEventListener("input", checarCEP);
  if (localRetiradaField) {
    localRetiradaField.addEventListener("input", () => autocompleteEndereco("localRetirada"));
    localRetiradaField.addEventListener("blur", () => validarEnderecoSPPorTexto("localRetirada"));
  }
  if (localEntregaField) {
    localEntregaField.addEventListener("input", () => autocompleteEndereco("localEntrega"));
    localEntregaField.addEventListener("blur", () => validarEnderecoSPPorTexto("localEntrega"));
  }
  if (cepEntregaField) cepEntregaField.addEventListener("input", checarCEPEntrega);

  document.querySelectorAll(".vehicle-option").forEach((option) => {
    option.addEventListener("click", () => {
      selecionarTipo(option.dataset.type);
    });
  });

  if (verMotoristasBtn) verMotoristasBtn.addEventListener("click", verMotoristas);

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".input-box")) {
      fecharAutocomplete("localRetirada");
      fecharAutocomplete("localEntrega");
    }
  });
});


window.onload = function () {
  iniciarMapa();

  injetarEstilosHomeC(); 

  if (typeof firebase !== "undefined") {
    firebase.initializeApp(firebaseConfig);
    db = firebase.app().firestore();
    console.log("Firebase inicializado com sucesso");
  } else {
    console.warn("Firebase não carregado. Funcionalidade limitada.");
  }
};

function injetarEstilosHomeC() {
    const styleId = 'homec-custom-styles';
    const oldStyle = document.getElementById(styleId);
    if (oldStyle) {
        oldStyle.remove();
    }

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
        /* --- Estilo para o Dropdown de Autocomplete (VERSÃO !IMPORTANT) --- */
        .input-box {
            position: relative !important; 
        }
        .autocomplete-items {
            position: absolute !important;
            top: 100% !important;
            left: 0 !important;
            right: 0 !important;
            background: white !important;
            border: 1px solid #ddd !important;
            border-top: none !important;
            z-index: 1001 !important;
            max-height: 220px !important;
            overflow-y: auto !important;
            border-radius: 0 0 10px 10px !important;
            box-shadow: 0 8px 16px rgba(0,0,0,0.1) !important;
        }
        /* Estilo para CADA item da lista */
        .autocomplete-items div {
            display: block !important;
            width: 100% !important;
            padding: 12px 15px !important;
            cursor: pointer !important;
            border-bottom: 1px solid #f5f5f5 !important;
            font-size: 14px !important;
            color: #333 !important;
            line-height: 1.5 !important;
            text-align: left !important;
            white-space: normal !important;
            transition: background-color 0.2s ease !important;
        }
        .autocomplete-items div:last-child {
            border-bottom: none !important;
        }
        .autocomplete-items div:hover {
            background-color: #fff5ef !important; /* Fundo laranja claro */
        }

        /* --- Estilos para o Card de Proposta (mantidos) --- */
        .proposta-card-home {
            background: white; border-radius: 15px; padding: 20px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.08); border-left: 5px solid #ff6b35;
            margin-bottom: 15px;
        }
        .proposta-header-home { display: flex; align-items: center; margin-bottom: 15px; }
        .motorista-info-home { display: flex; align-items: center; gap: 12px; }
        .motorista-avatar-home {
            width: 50px; height: 50px; border-radius: 50%; display: flex;
            align-items: center; justify-content: center; overflow: hidden;
            flex-shrink: 0; border: 3px solid #ff6b35; background: #f0f0f0;
        }
        .motorista-foto-home { width: 100%; height: 100%; object-fit: cover; }
        .motorista-iniciais-home { font-weight: 700; font-size: 18px; color: #555; }
        .motorista-dados-home h4 { margin: 0; font-size: 18px; font-weight: 600; }
        .avaliacao-home { display: flex; align-items: center; gap: 5px; color: #ffc107; font-size: 14px; }
        .proposta-body-home { display: flex; justify-content: space-between; align-items: flex-end; }
        .proposta-info-home p { margin: 4px 0; font-size: 14px; color: #666; }
        .proposta-preco-home { text-align: right; }
        .valor-home { font-size: 26px; font-weight: 700; color: #ff6b35; display: block; margin-bottom: 8px; }
        .aceitar-btn-home {
            background: #ff6b35; color: white; border: none; padding: 10px 20px;
            border-radius: 8px; font-weight: 600; cursor: pointer; transition: background-color 0.2s;
        }
        .aceitar-btn-home:hover { background: #e55a2b; }
    `;
    document.head.appendChild(style);
}