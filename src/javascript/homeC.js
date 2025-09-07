/*********************************************************
 * homeC.js — Moomate (CLIENTE)
 * - Mapa travado no estado de São Paulo (com alerts)
 * - Validação de CEP/endereço só-SP (input, autocomplete, blur)
 * - Entrega + propostas em tempo real renderizadas no bloco azul
 * - Mantém TODA a lógica original de pedidos e propostas
 **********************************************************/

// ===================== Estado de São Paulo =====================
const SP_BOUNDS = L.latLngBounds(
  L.latLng(-25.30, -53.10), // sudoeste
  L.latLng(-19.80, -44.20)  // nordeste
);
function isWithinSaoPaulo(lat, lng) {
  return SP_BOUNDS.contains([lat, lng]);
}

// ======================= Firebase config =======================
const firebaseConfig = {
  apiKey: "AIzaSyB9ZuAW1F9rBfOtg3hgGpA6H7JFUoiTlhE",
  authDomain: "moomate-39239.firebaseapp.com",
  projectId: "moomate-39239",
  storageBucket: "moomate-39239.appspot.com",
  messagingSenderId: "637968714747",
  appId: "1:637968714747:web:ad15dc3571c22f046b595e",
  measurementId: "G-62J7Q8CKP4"
};

// ===================== Variáveis globais =======================
let db;
let currentEntregaId = null;

let map;
let markerOrigem, markerDestino, routeLine;
let origemCoords = null;
let destinoCoords = null;

// ===================== Mapa (travado em SP) ====================
function initMap() {
  const defaultLatLng = [-23.5505, -46.6333]; // São Paulo capital

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

  // Marcador origem
  markerOrigem = L.marker(defaultLatLng, { draggable: true })
    .addTo(map)
    .bindPopup("Origem (arraste para mudar)")
    .openPopup();

  // Marcador destino (vermelho)
  const redIcon = L.icon({
    iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });

  markerDestino = L.marker(defaultLatLng, {
    draggable: false, // se quiser arrastar, troque para true
    opacity: 0.5,
    icon: redIcon
  }).addTo(map).bindPopup("Destino");

  // Origem: impede sair de SP (alerta + volta)
  markerOrigem.on("dragend", () => {
    const { lat, lng } = markerOrigem.getLatLng();
    if (isWithinSaoPaulo(lat, lng)) {
      origemCoords = [lat, lng];
      reverseGeocode(lat, lng, "localRetirada", true);
      updateRoute();
    } else {
      alert("Origem fora do estado de São Paulo. Selecione um local dentro de SP.");
      markerOrigem.setLatLng(origemCoords || defaultLatLng);
    }
  });

  // Destino: se tornar arrastável, já fica protegido
  markerDestino.on("dragend", () => {
    const { lat, lng } = markerDestino.getLatLng();
    if (isWithinSaoPaulo(lat, lng)) {
      destinoCoords = [lat, lng];
      reverseGeocode(lat, lng, "localEntrega", true);
      updateRoute();
    } else {
      alert("Destino fora do estado de São Paulo. Selecione um local dentro de SP.");
      markerDestino.setLatLng(destinoCoords || defaultLatLng);
    }
  });

  // Geolocalização (só SP)
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const { latitude, longitude } = coords;
        if (isWithinSaoPaulo(latitude, longitude)) {
          origemCoords = [latitude, longitude];
          map.setView(origemCoords, 15);
          markerOrigem.setLatLng(origemCoords);
          reverseGeocode(latitude, longitude, "localRetirada", true);
        } else {
          origemCoords = defaultLatLng;
          reverseGeocode(defaultLatLng[0], defaultLatLng[1], "localRetirada", true);
        }
      },
      () => {
        origemCoords = defaultLatLng;
        reverseGeocode(defaultLatLng[0], defaultLatLng[1], "localRetirada", true);
      }
    );
  } else {
    origemCoords = defaultLatLng;
    reverseGeocode(defaultLatLng[0], defaultLatLng[1], "localRetirada", true);
  }
}

// =================== CEP (apenas SP) ===========================
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
  // Faixa SP (01000-000 a 19999-999)
  return cepNum >= 1000000 && cepNum <= 19999999;
}
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

    // geocodifica para posicionar no mapa
    const q = encodeURIComponent(`${data.logradouro}, ${data.bairro}, ${data.localidade}, ${data.uf}`);
    const nominatimRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${q}`);
    const nominatimData = await nominatimRes.json();
    if (!nominatimData[0]) return;

    const lat = parseFloat(nominatimData[0].lat);
    const lon = parseFloat(nominatimData[0].lon);

    if (!isWithinSaoPaulo(lat, lon)) {
      alert("Por favor, selecione um endereço dentro do estado de São Paulo.");
      return;
    }

    origemCoords = [lat, lon];
    map.setView(origemCoords, 15);
    markerOrigem.setLatLng(origemCoords);
    reverseGeocode(lat, lon, "localRetirada", false);
    updateRoute();
  } catch {
    alert("Erro ao buscar o endereço pelo CEP.");
  }
}

// =================== Reverse geocode (só SP) ===================
async function reverseGeocode(lat, lon, campo, setCep) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`);
    const data = await res.json();
    if (!data.address) return;

    const a = data.address;
    const state = (a.state || "").toLowerCase();
    if (!isWithinSaoPaulo(lat, lon) || (!state.includes("são paulo") && !state.includes("sp"))) {
      alert("Endereço localizado fora do estado de São Paulo.");
      return; // não preenche o campo
    }

    const enderecoMontado =
      (a.road ? a.road + ", " : "") +
      (a.suburb ? a.suburb + ", " : "") +
      (a.city || a.town || a.village || "") +
      (a.state ? " - " + a.state : "");
    document.getElementById(campo).value = enderecoMontado;

    if (setCep && a.postcode && isCEPSaoPaulo(a.postcode.replace(/\D/g, ""))) {
      document.getElementById("cep").value = formatarCEP(a.postcode);
    }
  } catch (e) {
    console.error("Erro reverse geocode", e);
  }
}

// ============= Validação por texto digitado (blur) =============
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

    if (!isWithinSaoPaulo(lat, lon) || (!state.includes("são paulo") && !state.includes("sp"))) {
      alert("Este endereço não pertence ao estado de São Paulo.");
      input.value = "";
      return false;
    }

    return true;
  } catch (e) {
    console.error("Erro ao validar endereço:", e);
    return true; // não bloqueia se der erro de rede
  }
}

function formatarCEP(cep) {
  cep = cep.replace(/\D/g, "");
  return cep.length === 8 ? cep.substr(0, 5) + "-" + cep.substr(5, 3) : cep;
}

// ================== Autocomplete (apenas SP) ===================
let timeoutAutocomplete;
async function autocompleteEndereco(campo) {
  clearTimeout(timeoutAutocomplete);
  timeoutAutocomplete = setTimeout(async () => {
    const val = document.getElementById(campo).value.trim();
    if (val.length < 3) return closeAutocomplete(campo);

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
        isWithinSaoPaulo(lat, lng) &&
        (item.address?.state?.toLowerCase().includes("são paulo") ||
          item.address?.state?.toLowerCase().includes("sp") ||
          item.display_name.toLowerCase().includes("são paulo"))
      );
    });

    showAutocompleteList(campo, spResults);
  }, 300);
}

function showAutocompleteList(campo, data) {
  let container = document.getElementById(`autocomplete-list-${campo}`);
  if (!container) {
    container = document.createElement("div");
    container.id = `autocomplete-list-${campo}`;
    container.classList.add("autocomplete-items");
    document.getElementById(campo).parentNode.appendChild(container);
  }
  container.innerHTML = "";
  if (!data.length) return (container.style.display = "none");

  data.forEach((item) => {
    const div = document.createElement("div");
    div.textContent = item.display_name;
    div.addEventListener("click", () => {
      selectAutocompleteItem(campo, item);
      closeAutocomplete(campo);
    });
    container.appendChild(div);
  });
  container.style.display = "block";
}

function closeAutocomplete(campo) {
  const c = document.getElementById(`autocomplete-list-${campo}`);
  if (c) c.style.display = "none";
}

async function selectAutocompleteItem(campo, item) {
  document.getElementById(campo).value = item.display_name;
  const lat = parseFloat(item.lat);
  const lon = parseFloat(item.lon);

  if (!isWithinSaoPaulo(lat, lon)) {
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
  }

  updateRoute();
}

// ====================== Rota/Distância ========================
function updateRoute() {
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

// ================= Propostas em tempo real (inline) ============
function ouvirPropostas(entregaId) {
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

      // cache: evita buscar mesmo motorista várias vezes
      const cacheMotoristas = {};

      // pega nome + foto do Firestore (motoristas/{uid})
      async function getMotorista(uid) {
        if (!uid) return { nome: "Motorista", foto: null };
        if (cacheMotoristas[uid]) return cacheMotoristas[uid];
        try {
          const snap = await db.collection("motoristas").doc(uid).get();
          if (!snap.exists) return { nome: "Motorista", foto: null };
          const data = snap.data();
          const nome = data?.dadosPessoais?.nome || data?.nome || "Motorista";
          const foto = data?.dadosPessoais?.foto || data?.foto || null;
          cacheMotoristas[uid] = { nome, foto };
          return cacheMotoristas[uid];
        } catch {
          return { nome: "Motorista", foto: null };
        }
      }

      // formata data Firestore Timestamp ou ISO
      const fmtData = (v) => {
        try {
          if (v && typeof v.toDate === "function") return v.toDate().toLocaleString();
          if (typeof v === "string") return new Date(v).toLocaleString();
        } catch {}
        return "";
      };

      // iniciais para fallback
      const iniciaisDe = (nome) => {
        if (!nome) return "??";
        const parts = nome.trim().split(/\s+/).filter(Boolean);
        const first = parts[0]?.[0] || "";
        const last  = parts.length > 1 ? parts[parts.length - 1][0] : (parts[0]?.[1] || "");
        return (first + last).toUpperCase();
      };

      lista.innerHTML = "";
      for (const doc of snapshot.docs) {
        const p = doc.data();

        // compatibilidade: pode vir motoristaUid OU motoristaId (legado)
        const uidMotorista = p.motoristaUid || p.motoristaId || "";

        // se a proposta já trouxe nome/foto, usamos; senão buscamos
        let nomeMotorista = p.nomeMotorista || "";
        let fotoMotorista = p.fotoMotorista || null;

        if (!nomeMotorista || fotoMotorista === undefined) {
          const info = await getMotorista(uidMotorista);
          if (!nomeMotorista) nomeMotorista = info.nome;
          if (fotoMotorista === undefined) fotoMotorista = info.foto;
        }

        const avatarHtml = fotoMotorista
          ? `<img src="${fotoMotorista}" alt="${nomeMotorista}">`
          : `<span class="motorista-iniciais">${iniciaisDe(nomeMotorista)}</span>`;

        const card = document.createElement("div");
        card.className = "proposta-card inline";
        card.innerHTML = `
          <div class="proposta-header">
            <div class="motorista-avatar">${avatarHtml}</div>
            <h4>${nomeMotorista}</h4>
          </div>
          <div class="proposta-body">
            <p><strong>Preço:</strong> R$ ${Number(p.preco || 0).toFixed(2)}</p>
            <p><strong>Tempo de chegada:</strong> ${p.tempoChegada || 0} min</p>
            <p><strong>Ajudantes:</strong> ${p.ajudantes || 0}</p>
            <p><strong>Tipo de veículo:</strong> ${p.veiculo || "-"}</p>
            <p><em>Enviado em: ${fmtData(p.dataEnvio)}</em></p>
          </div>
          <div class="proposta-footer">
            <button class="aceitar-btn"
              onclick="aceitarProposta('${entregaId}', '${doc.id}', '${uidMotorista}')">
              ✅ Aceitar Proposta
            </button>
          </div>
        `;
        lista.appendChild(card);
      }
    });
}


// ============= (Seu modal antigo mantido – não usado) =========
function mostrarModalPropostas(entregaId, snapshot) { /* mantém se quiser usar */ }
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

// ================== Aceitar proposta / corrida =================
async function aceitarProposta(entregaId, propostaId, motoristaId) {
  if (!db) return alert("Erro: Firebase não inicializado.");

  try {
    const propostaDoc = await db
      .collection("entregas")
      .doc(entregaId)
      .collection("propostas")
      .doc(propostaId)
      .get();
    if (!propostaDoc.exists) return alert("Proposta não encontrada.");
    const propostaData = propostaDoc.data();

    await db.collection("entregas").doc(entregaId).update({
      status: "proposta_aceita",
      propostaAceita: {
        propostaId,
        motoristaId,
        ...propostaData
      },
      aceitoEm: new Date().toISOString(),
      clienteConfirmou: true
    });

    alert("Proposta aceita com sucesso!");
    fecharModalPropostas();
    mostrarAguardandoMotorista(entregaId);
  } catch (error) {
    console.error("Erro ao aceitar proposta:", error);
    alert("Erro ao aceitar proposta. Tente novamente.");
  }
}

function mostrarAguardandoMotorista(entregaId) {
  // cria modal se não existir
  let modal = document.getElementById('aguardandoMotoristaModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'aguardandoMotoristaModal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content">
        <h2>⏳ Aguardando Motorista</h2>
        <div class="aguardando-info">
          <p><strong>Proposta aceita com sucesso!</strong></p>
          <p>Aguardando o motorista confirmar o início da corrida...</p>
          <div class="loading-spinner">🔄</div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  modal.style.display = 'flex';
  setTimeout(() => {
    modal.style.opacity = '1';
    modal.querySelector('.modal-content').style.transform = 'scale(1)';
  }, 10);

  // 1) fecha quando a corrida começar
  const stopCorrida = db.collection('corridas').doc(entregaId)
    .onSnapshot(doc => {
      if (doc.exists && doc.data()?.status === 'em_andamento') {
        modal.style.display = 'none';
        alert('Corrida iniciada! Redirecionando...');
        setTimeout(() => {
          window.location.href = `statusC.html?entregaId=${entregaId}&tipo=cliente`;
        }, 500);
        stopCorrida(); stopEntrega();
      }
    });

  // 2) fecha se o motorista recusar
  const stopEntrega = db.collection('entregas').doc(entregaId)
    .onSnapshot(doc => {
      if (!doc.exists) return; // pode já ter virado corrida
      const st = doc.data()?.status;
      if (st === 'aguardando_propostas' || st === 'recusada_pelo_motorista') {
        modal.style.display = 'none';
        alert('O motorista recusou a corrida. Escolha outra proposta.');
        stopEntrega(); stopCorrida();
      }
    });
}


// ================== Criar pedido / ver motoristas =============
async function verMotoristas() {
  if (!origemCoords || !destinoCoords) return alert("Defina origem e destino.");

  // reforço SP
  if (
    !isWithinSaoPaulo(origemCoords[0], origemCoords[1]) ||
    !isWithinSaoPaulo(destinoCoords[0], destinoCoords[1])
  ) {
    return alert("Origem e destino devem estar dentro do estado de São Paulo.");
  }

  const tipoVeiculo = document.getElementById("tipoVeiculo").value;
  if (!tipoVeiculo) return alert("Selecione um tipo de veículo.");

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
    volumes: parseInt(document.getElementById("volumes").value) || 0,
    distancia: 0,
    precoEstimado: 0,
    status: "aguardando_propostas",
    criadoEm: new Date().toISOString(),
    propostas: {}
  };
  // antes de salvar dadosFormulario:
dadosFormulario.clienteNome = (window.userNome || localStorage.getItem('clienteNome') || 'Cliente');


  const dist = calcularDistancia(
    origemCoords[0],
    origemCoords[1],
    destinoCoords[0],
    destinoCoords[1]
  );
  const precoEstimado = 50 + 2 * dist;

  dadosFormulario.distancia = parseFloat(dist.toFixed(2));
  dadosFormulario.precoEstimado = parseFloat(precoEstimado.toFixed(2));

  try {
    if (db) {
      const docRef = await db.collection("entregas").add(dadosFormulario);
      currentEntregaId = docRef.id;

      alert(
        `Pedido criado com sucesso!\n\nID do Pedido: ${docRef.id}\n\nORIGEM:\n${dadosFormulario.origem.endereco}\n${
          dadosFormulario.origem.numero ? "Número: " + dadosFormulario.origem.numero : ""
        }\n${
          dadosFormulario.origem.complemento
            ? "Complemento: " + dadosFormulario.origem.complemento
            : ""
        }\nCEP: ${dadosFormulario.origem.cep}\n\nDESTINO:\n${
          dadosFormulario.destino.endereco
        }\n${
          dadosFormulario.destino.numero ? "Número: " + dadosFormulario.destino.numero : ""
        }\n${
          dadosFormulario.destino.complemento
            ? "Complemento: " + dadosFormulario.destino.complemento
            : ""
        }\n\nDETALHES:\nTipo de veículo: ${dadosFormulario.tipoVeiculo}\nVolumes: ${
          dadosFormulario.volumes
        }\nDistância: ${dadosFormulario.distancia} km\nPreço estimado: R$ ${dadosFormulario.precoEstimado.toFixed(
          2
        )}\n\nStatus: Aguardando propostas dos motoristas...`
      );

      console.log("Dados salvos no Firebase:", dadosFormulario);

      ouvirPropostas(docRef.id);
      document.getElementById("propostasContainer").style.display = "block";
    } else {
      console.log("Dados que seriam salvos:", dadosFormulario);
      alert(
        `Dados capturados com sucesso!\n\nORIGEM: ${dadosFormulario.origem.endereco}\nDESTINO: ${dadosFormulario.destino.endereco}\nTIPO: ${dadosFormulario.tipoVeiculo}\nVOLUMES: ${dadosFormulario.volumes}\nDISTÂNCIA: ${dadosFormulario.distancia} km\nPREÇO: R$ ${dadosFormulario.precoEstimado.toFixed(
          2
        )}\n\nServiço temporariamente indisponível. Tente novamente.`
      );
    }
  } catch (error) {
    console.error("Erro ao salvar pedido:", error);
    alert("Erro ao criar pedido. Tente novamente.");
  }
}

// ================ Tipo de veículo (toggle) =====================
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

// ==================== Listeners de página ======================
document.addEventListener("DOMContentLoaded", function () {
  const cepField = document.getElementById("cep");
  const localRetiradaField = document.getElementById("localRetirada");
  const localEntregaField = document.getElementById("localEntrega");
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

  document.querySelectorAll(".vehicle-option").forEach((option) => {
    option.addEventListener("click", () => {
      selecionarTipo(option.dataset.type);
    });
  });

  if (verMotoristasBtn) verMotoristasBtn.addEventListener("click", verMotoristas);

  // fecha autocomplete ao clicar fora
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".input-box")) {
      closeAutocomplete("localRetirada");
      closeAutocomplete("localEntrega");
    }
  });
});

// ===================== Bootstrap da página =====================
window.onload = function () {
  initMap();

  if (typeof firebase !== "undefined") {
    firebase.initializeApp(firebaseConfig);
    db = firebase.app().firestore();
    console.log("Firebase inicializado com sucesso");
  } else {
    console.warn("Firebase não carregado. Funcionalidade limitada.");
  }
};
