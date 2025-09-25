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
      document.getElementById("cep").value = formatarCEP(a.postcode);
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
    document.getElementById(campo).parentNode.appendChild(container);
  }
  container.innerHTML = "";
  if (!data.length) return (container.style.display = "none");

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
  }

  atualizarRota();
}

// rota
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

// proposta
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
      // Buscar dados do pedido para preencher De/Para/Tipo
      let pedido = {};
      try {
        const pedidoSnap = await db.collection('entregas').doc(entregaId).get();
        pedido = pedidoSnap.exists ? (pedidoSnap.data()||{}) : {};
      } catch {}
      async function getMotorista(uid) {
        console.log("Buscando motorista com ID:", uid); 
        if (!uid) return { nome: "Motorista", foto: null, nota: 0 };

        if (cacheMotoristas[uid]) return cacheMotoristas[uid];

        try {
          const snap = await db.collection("motoristas").doc(uid).get();
          if (!snap.exists) {
            console.log("Motorista não encontrado com ID:", uid); 
            return { nome: "Motorista", foto: null, nota: 0 };
          }
          const data = snap.data();
          const nome = data?.dadosPessoais?.nome || data?.nome || "Motorista";
          const foto = data?.dadosPessoais?.fotoPerfilUrl || data?.fotoPerfilUrl || null;
          let nota = (
            data?.avaliacaoMedia ??
            data?.rating ??
            data?.avaliacoes?.media ??
            data?.dadosPessoais?.avaliacao ??
            0
          );

          // Caso não haja campo agregado, calcular média das avaliações
          async function calcularMediaAvaliacoes(uidAlvo){
            try {
              let soma = 0, qtd = 0;
              // 1) subcoleção motoristas/{uid}/avaliacoes
              const sub = await db.collection('motoristas').doc(uidAlvo).collection('avaliacoes').get().catch(()=>null);
              if (sub && !sub.empty) {
                sub.forEach(d=>{ const v = Number(d.data()?.estrelas ?? d.data()?.nota ?? d.data()?.rating); if (Number.isFinite(v)) { soma += v; qtd++; } });
              }
              // 2) coleção global 'avaliacoes' filtrando pelo uid do motorista
              if (qtd === 0) {
                const glob = await db.collection('avaliacoes')
                  .where('motoristaUid','==', uidAlvo)
                  .limit(50)
                  .get().catch(()=>null);
                if (glob && !glob.empty) {
                  glob.forEach(d=>{ const v = Number(d.data()?.estrelas ?? d.data()?.nota ?? d.data()?.rating); if (Number.isFinite(v)) { soma += v; qtd++; } });
                }
              }
              return qtd>0 ? (soma/qtd) : 0;
            } catch { return 0; }
          }

          if (!(Number(nota) > 0)) {
            nota = await calcularMediaAvaliacoes(uid);
          }

          console.log("Foto do motorista (fotoPerfilUrl):", foto); 

          cacheMotoristas[uid] = { nome, foto, nota: Number(nota)||0 };
          return cacheMotoristas[uid];
        } catch (error) {
          console.error("Erro ao carregar dados do motorista:", error);
          return { nome: "Motorista", foto: null, nota: 0 };
        }
      }
      const fmtData = (v) => {
        try {
          if (v && typeof v.toDate === "function") return v.toDate().toLocaleString();
          if (typeof v === "string") return new Date(v).toLocaleString();
        } catch {}
        return "";
      };

      lista.innerHTML = "";
      for (const doc of snapshot.docs) {
        const p = doc.data();
        // Descoberta robusta do UID do motorista (inclui mais campos comuns)
        let uidMotorista = p.motoristaUid || p.motoristaId || p.uidMotorista || p.uid || p.userId || p.authorId || doc.id || "";
        console.log("[proposta] UID do motorista (resolvido):", uidMotorista, "|| bruto:", { motoristaUid: p.motoristaUid, motoristaId: p.motoristaId, uidMotorista: p.uidMotorista, uid: p.uid, userId: p.userId, authorId: p.authorId });

        // Buscar por cadastro; se não achar, usar o nome vindo da proposta como último recurso
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
                <div><strong>Ajudantes:</strong> ${p.ajudantes || 0}</div>
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

// ... restante do código ...

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

//aceitar proposta
async function aceitarProposta(entregaId, propostaId, motoristaId) {
  if (!db) return alert("Erro: Firebase não inicializado.");
  try {
    const propostaDoc = await db
      .collection("entregas").doc(entregaId)
      .collection("propostas").doc(propostaId).get();
    if (!propostaDoc.exists) return alert("Proposta não encontrada.");
    const propostaData = propostaDoc.data();

    // Se o motoristaId vier vazio do botão, tentar deduzir da proposta
    if (!motoristaId) {
      motoristaId = propostaData.motoristaUid || propostaData.motoristaId || propostaData.uidMotorista || propostaData.uid || propostaData.userId || propostaData.authorId || null;
      console.log("[aceitarProposta] motoristaId deduzido da proposta:", motoristaId);
    }

    // Buscar dados confiáveis do motorista para salvar no banco
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

    // Garantir que a corrida espelho receba os identificadores corretos
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

    alert("Proposta aceita com sucesso!");
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
  // animação de entrada (segue o padrão dos outros modais)
  setTimeout(() => {
    modal.style.opacity = '1';
    const card = modal.querySelector('.modal-content');
    if (card) card.style.transform = 'scale(1)';
  }, 10);

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

  // Garantir cliente autenticado (aguarda auth caso ainda não tenha carregado)
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
    volumes: parseInt(document.getElementById("volumes").value) || 0,
    distancia: 0,
    precoEstimado: 0,
    status: "aguardando_propostas",
    criadoEm: new Date().toISOString(),
    propostas: {}
  };

  // Preencher clienteId e clienteNome corretos
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
      // Ref refina os campos de cliente por segurança (evita qualquer tela antiga gravar errado)
      try {
        await db.collection('entregas').doc(docRef.id).update({
          clienteId: dadosFormulario.clienteId,
          clienteNome: dadosFormulario.clienteNome
        });
      } catch (e) { console.warn('Falha ao reforçar clienteId/nome na entrega:', e?.message||e); }
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

//tipo veiculo
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

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".input-box")) {
      fecharAutocomplete("localRetirada");
      fecharAutocomplete("localEntrega");
    }
  });
});

window.onload = function () {
  iniciarMapa();

  if (typeof firebase !== "undefined") {
    firebase.initializeApp(firebaseConfig);
    db = firebase.app().firestore();
    console.log("Firebase inicializado com sucesso");
  } else {
    console.warn("Firebase não carregado. Funcionalidade limitada.");
  }
};
