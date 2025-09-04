// Configuração do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyB9ZuAW1F9rBfOtg3hgGpA6H7JFUoiTlhE",
  authDomain: "moomate-39239.firebaseapp.com",
  projectId: "moomate-39239",
  storageBucket: "moomate-39239.appspot.com",
  messagingSenderId: "637968714747",
  appId: "1:637968714747:web:ad15dc3571c22f046b595e",
  measurementId: "G-62J7Q8CKP4"
};

// Inicializar Firebase (será carregado via CDN)
let db;
let currentEntregaId = null; // Para armazenar o ID da entrega atual

let map;
let markerOrigem, markerDestino, routeLine;
let origemCoords = null;
let destinoCoords = null;

// Inicializar mapa focado no estado de São Paulo
function initMap() {
  // Coordenadas centrais do estado de São Paulo
  const defaultLatLng = [-23.5505, -46.6333]; // São Paulo capital
 
  // Bounds aproximados do estado de São Paulo
  const spBounds = [
    [-25.3, -53.1], // Southwest
    [-19.8, -44.2]  // Northeast
  ];

  map = L.map("map", {
    zoomControl: true,
    scrollWheelZoom: true,
    dragging: true,
    // Limitar o mapa ao estado de São Paulo
    maxBounds: spBounds,
    maxBoundsViscosity: 1.0
  }).setView(defaultLatLng, 7); // Zoom menor para mostrar mais do estado

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);

  // Marcador Origem
  markerOrigem = L.marker(defaultLatLng, { draggable: true })
    .addTo(map)
    .bindPopup("Origem (arraste para mudar)")
    .openPopup();

  // Marcador Destino (vermelho)
  const redIcon = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
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
    const latlng = markerOrigem.getLatLng();
    // Verificar se está dentro dos limites de SP
    if (isWithinSaoPaulo(latlng.lat, latlng.lng)) {
      origemCoords = [latlng.lat, latlng.lng];
      reverseGeocode(latlng.lat, latlng.lng, "localRetirada", true);
      updateRoute();
    } else {
      alert("Por favor, selecione um local dentro do estado de São Paulo.");
      markerOrigem.setLatLng(origemCoords || defaultLatLng);
    }
  });

  markerDestino.on("dragend", () => {
    const latlng = markerDestino.getLatLng();
    // Verificar se está dentro dos limites de SP
    if (isWithinSaoPaulo(latlng.lat, latlng.lng)) {
      destinoCoords = [latlng.lat, latlng.lng];
      reverseGeocode(latlng.lat, latlng.lng, "localEntrega", true);
      updateRoute();
    } else {
      alert("Por favor, selecione um local dentro do estado de São Paulo.");
      markerDestino.setLatLng(destinoCoords || defaultLatLng);
    }
  });

  // Geolocalização
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        // Verificar se a localização atual está em SP
        if (isWithinSaoPaulo(latitude, longitude)) {
          origemCoords = [latitude, longitude];
          map.setView(origemCoords, 15);
          markerOrigem.setLatLng(origemCoords);
          reverseGeocode(latitude, longitude, "localRetirada", true);
        } else {
          // Se não estiver em SP, usar coordenadas padrão
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

// Função para verificar se as coordenadas estão dentro do estado de São Paulo
function isWithinSaoPaulo(lat, lng) {
  // Bounds aproximados do estado de São Paulo
  const minLat = -25.3;
  const maxLat = -19.8;
  const minLng = -53.1;
  const maxLng = -44.2;
 
  return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
}

// CEP - modificado para aceitar apenas CEPs de SP
function checarCEP() {
  let cep = document.getElementById("cep").value.replace(/\D/g, "");
  if (cep.length === 8) {
    // Verificar se é CEP de São Paulo (faixas de CEP de SP)
    if (isCEPSaoPaulo(cep)) {
      buscarEnderecoPorCEP(cep);
    } else {
      alert("Por favor, digite um CEP do estado de São Paulo.");
      document.getElementById("cep").value = "";
    }
  }
}

// Função para verificar se o CEP é do estado de São Paulo
function isCEPSaoPaulo(cep) {
  const cepNum = parseInt(cep);
  // Faixas de CEP do estado de São Paulo
  return (cepNum >= 1000000 && cepNum <= 19999999);
}

async function buscarEnderecoPorCEP(cep) {
  try {
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const data = await res.json();
    if (data.erro) return alert("CEP não encontrado!");
   
    // Verificar se o CEP é realmente de São Paulo
    if (data.uf !== 'SP') {
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
   
    // Verificar se as coordenadas estão em SP
    if (!isWithinSaoPaulo(lat, lon)) {
      alert("Endereço não encontrado no estado de São Paulo.");
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

// Reverse geocode
async function reverseGeocode(lat, lon, campo, setCep) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`);
    const data = await res.json();
    if (!data.address) return;

    const a = data.address;
   
    // Verificar se o endereço é de São Paulo
    if (a.state && !a.state.toLowerCase().includes('são paulo') && !a.state.toLowerCase().includes('sp')) {
      return;
    }
   
    const enderecoMontado = (a.road ? a.road + ", " : "") +
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

function formatarCEP(cep) {
  cep = cep.replace(/\D/g, "");
  return cep.length === 8 ? cep.substr(0, 5) + "-" + cep.substr(5, 3) : cep;
}

// Autocomplete - modificado para buscar apenas em São Paulo
let timeoutAutocomplete;
async function autocompleteEndereco(campo) {
  clearTimeout(timeoutAutocomplete);
  timeoutAutocomplete = setTimeout(async () => {
    const val = document.getElementById(campo).value.trim();
    if (val.length < 3) return closeAutocomplete(campo);

    // Adicionar "São Paulo" à busca para filtrar apenas resultados de SP
    const searchQuery = val.includes('SP') || val.includes('São Paulo') ? val : val + ', São Paulo, Brasil';
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&addressdetails=1&limit=10&countrycodes=br`;
    const res = await fetch(url);
    const data = await res.json();
   
    // Filtrar apenas resultados do estado de São Paulo
    const spResults = data.filter(item => {
      const lat = parseFloat(item.lat);
      const lng = parseFloat(item.lon);
      return isWithinSaoPaulo(lat, lng) &&
             (item.address?.state?.toLowerCase().includes('são paulo') ||
              item.address?.state?.toLowerCase().includes('sp') ||
              item.display_name.toLowerCase().includes('são paulo'));
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
  if (!data.length) return container.style.display = "none";

  data.forEach(item => {
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

  // Verificar se está dentro de SP
  if (!isWithinSaoPaulo(lat, lon)) {
    alert("Por favor, selecione um endereço dentro do estado de São Paulo.");
    return;
  }

  if (campo === "localRetirada") {
    origemCoords = [lat, lon];
    markerOrigem.setLatLng(origemCoords).setOpacity(1);
    map.setView(origemCoords, 15);
    document.getElementById("cep").value = item.address?.postcode && isCEPSaoPaulo(item.address.postcode.replace(/\D/g, "")) ? formatarCEP(item.address.postcode) : "";
  } else {
    destinoCoords = [lat, lon];
    markerDestino.setLatLng(destinoCoords).setOpacity(1);
    map.setView(destinoCoords, 15);
  }

  updateRoute();
}

// Atualiza rota
function updateRoute() {
  if (routeLine) map.removeLayer(routeLine);

  if (origemCoords && destinoCoords) {
    routeLine = L.polyline([origemCoords, destinoCoords], { color: "orange", weight: 4, opacity: 0.7, dashArray: "10,10" }).addTo(map);
    map.fitBounds(routeLine.getBounds(), { padding: [50, 50] });
  }
}

// Cálculo de distância
function calcularDistancia(lat1, lon1, lat2, lon2) {
  const toRad = v => v * Math.PI / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Função para ouvir propostas em tempo real
function ouvirPropostas(entregaId) {
  if (!db || !entregaId) return;
  
  db.collection('entregas')
    .doc(entregaId)
    .collection('propostas')
    .onSnapshot(snapshot => {
      if (snapshot.empty) {
        return;
      }

      // Mostrar modal com propostas
      mostrarModalPropostas(entregaId, snapshot);
    });
}

// Função para mostrar modal com propostas
function mostrarModalPropostas(entregaId, snapshot) {
  // Criar modal se não existir
  let modal = document.getElementById('propostasModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'propostasModal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content">
        <span class="modal-close" onclick="fecharModalPropostas()">&times;</span>
        <h2>Propostas Recebidas</h2>
        <div id="propostas-list"></div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  const propostasList = document.getElementById('propostas-list');
  propostasList.innerHTML = '';

  snapshot.forEach(doc => {
    const proposta = doc.data();
    const propostaCard = document.createElement('div');
    propostaCard.className = 'proposta-card';
    propostaCard.innerHTML = `
      <div class="proposta-header">
        <h3>🚚 ${proposta.nomeMotorista || 'Motorista'}</h3>
      </div>
      <div class="proposta-body">
        <p><strong>Preço:</strong> R$ ${proposta.preco.toFixed(2)}</p>
        <p><strong>Tempo de chegada:</strong> ${proposta.tempoChegada} minutos</p>
        <p><strong>Ajudantes:</strong> ${proposta.ajudantes}</p>
        <p><strong>Tipo de veículo:</strong> ${proposta.veiculo}</p>
        <p><em>Enviado em: ${new Date(proposta.dataEnvio).toLocaleString()}</em></p>
      </div>
      <div class="proposta-footer">
        <button class="aceitar-btn" onclick="aceitarProposta('${entregaId}', '${doc.id}', '${proposta.motoristaId}')">
          ✅ Aceitar Proposta
        </button>
      </div>
    `;
    propostasList.appendChild(propostaCard);
  });

  // Mostrar modal
  modal.style.display = 'flex';
  setTimeout(() => {
    modal.style.opacity = '1';
    modal.querySelector('.modal-content').style.transform = 'scale(1)';
  }, 10);
}

// Função para fechar modal de propostas
function fecharModalPropostas() {
  const modal = document.getElementById('propostasModal');
  if (modal) {
    modal.style.opacity = '0';
    modal.querySelector('.modal-content').style.transform = 'scale(0.9)';
    setTimeout(() => { modal.style.display = 'none'; }, 300);
  }
}

// Função para aceitar proposta
async function aceitarProposta(entregaId, propostaId, motoristaId) {
  if (!db) return alert("Erro: Firebase não inicializado.");

  try {
    // Buscar dados da proposta
    const propostaDoc = await db.collection('entregas').doc(entregaId).collection('propostas').doc(propostaId).get();
    if (!propostaDoc.exists) {
      return alert("Proposta não encontrada.");
    }

    const propostaData = propostaDoc.data();

    // Atualizar status da entrega
    await db.collection('entregas').doc(entregaId).update({
      status: 'proposta_aceita',
      propostaAceita: {
        propostaId: propostaId,
        motoristaId: motoristaId,
        ...propostaData
      },
      aceitoEm: new Date().toISOString(),
      clienteConfirmou: true
    });

    alert("Proposta aceita com sucesso!");
    fecharModalPropostas();

    // Aguardar confirmação do motorista antes de mover para corridas
    mostrarAguardandoMotorista(entregaId);

  } catch (error) {
    console.error("Erro ao aceitar proposta:", error);
    alert("Erro ao aceitar proposta. Tente novamente.");
  }
}

// Função para mostrar que está aguardando confirmação do motorista
function mostrarAguardandoMotorista(entregaId) {
  // Criar modal de aguardo
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

  // Mostrar modal
  modal.style.display = 'flex';
  setTimeout(() => {
    modal.style.opacity = '1';
    modal.querySelector('.modal-content').style.transform = 'scale(1)';
  }, 10);

  // Ouvir quando a corrida for iniciada
  const unsubscribe = db.collection('corridas').doc(entregaId)
    .onSnapshot(doc => {
      if (doc.exists) {
        const corridaData = doc.data();
        if (corridaData.status === 'em_andamento') {
          // Fechar modal de aguardo
          modal.style.display = 'none';
          
          // Redirecionar para página da corrida
          alert('Corrida iniciada! Redirecionando...');
          setTimeout(() => {
            window.location.href = `corrida.html?entregaId=${entregaId}&tipo=cliente`;
          }, 1000);
          
          // Parar de ouvir
          unsubscribe();
        }
      }
    });
}

// Função principal para salvar dados quando o botão for clicado
async function verMotoristas() {
  // Validações básicas
  if (!origemCoords || !destinoCoords) {
    return alert("Defina origem e destino.");
  }
 
  const tipoVeiculo = document.getElementById("tipoVeiculo").value;
  if (!tipoVeiculo) {
    return alert("Selecione um tipo de veículo.");
  }

  // Capturar todos os dados do formulário
  const dadosFormulario = {
    // Dados de origem
    origem: {
      endereco: document.getElementById("localRetirada").value,
      numero: document.getElementById("numeroRetirada").value || "",
      complemento: document.getElementById("complementoRetirada").value || "",
      cep: document.getElementById("cep").value,
      coordenadas: {
        lat: origemCoords[0],
        lng: origemCoords[1]
      }
    },
    
    // Dados de destino
    destino: {
      endereco: document.getElementById("localEntrega").value,
      numero: document.getElementById("numeroEntrega").value || "",
      complemento: document.getElementById("complementoEntrega").value || "",
      coordenadas: {
        lat: destinoCoords[0],
        lng: destinoCoords[1]
      }
    },
    
    // Dados da entrega
    tipoVeiculo: tipoVeiculo,
    volumes: parseInt(document.getElementById("volumes").value) || 0,
    
    // Dados calculados
    distancia: 0,
    precoEstimado: 0,
    
    // Dados de controle
    status: "aguardando_propostas",
    criadoEm: new Date().toISOString(),
    propostas: {}
  };

  // Calcular distância e preço
  const dist = calcularDistancia(origemCoords[0], origemCoords[1], destinoCoords[0], destinoCoords[1]);
  const precoEstimado = 50 + 2 * dist;
  
  dadosFormulario.distancia = parseFloat(dist.toFixed(2));
  dadosFormulario.precoEstimado = parseFloat(precoEstimado.toFixed(2));

  try {
    // Salvar no Firebase
    if (db) {
      const docRef = await db.collection("entregas").add(dadosFormulario);
      currentEntregaId = docRef.id;
      
      // Exibir confirmação com todos os dados salvos
      const confirmacao = `
Pedido criado com sucesso!

ID do Pedido: ${docRef.id}

ORIGEM:
${dadosFormulario.origem.endereco}
${dadosFormulario.origem.numero ? 'Número: ' + dadosFormulario.origem.numero : ''}
${dadosFormulario.origem.complemento ? 'Complemento: ' + dadosFormulario.origem.complemento : ''}
CEP: ${dadosFormulario.origem.cep}

DESTINO:
${dadosFormulario.destino.endereco}
${dadosFormulario.destino.numero ? 'Número: ' + dadosFormulario.destino.numero : ''}
${dadosFormulario.destino.complemento ? 'Complemento: ' + dadosFormulario.destino.complemento : ''}

DETALHES:
Tipo de veículo: ${dadosFormulario.tipoVeiculo}
Volumes: ${dadosFormulario.volumes}
Distância: ${dadosFormulario.distancia} km
Preço estimado: R$ ${dadosFormulario.precoEstimado.toFixed(2)}

Status: Aguardando propostas dos motoristas...
      `;
      
      alert(confirmacao);
      
      // Log dos dados salvos para debug
      console.log("Dados salvos no Firebase:", dadosFormulario);
      
      // Começar a ouvir propostas
      ouvirPropostas(docRef.id);
      
      // Mostrar container de propostas
      document.getElementById("propostasContainer").style.display = "block";
      
    } else {
      // Fallback se Firebase não estiver carregado
      console.log("Dados que seriam salvos:", dadosFormulario);
      alert(`
Dados capturados com sucesso!

ORIGEM: ${dadosFormulario.origem.endereco}
DESTINO: ${dadosFormulario.destino.endereco}
TIPO: ${dadosFormulario.tipoVeiculo}
VOLUMES: ${dadosFormulario.volumes}
DISTÂNCIA: ${dadosFormulario.distancia} km
PREÇO: R$ ${dadosFormulario.precoEstimado.toFixed(2)}

Serviço temporariamente indisponível. Tente novamente.
      `);
    }
  } catch (error) {
    console.error("Erro ao salvar pedido:", error);
    alert("Erro ao criar pedido. Tente novamente.");
  }
}

// Tipo de veículo com cancelamento
function selecionarTipo(tipo) {
  const opcoes = document.querySelectorAll(".vehicle-option");
  const atual = Array.from(opcoes).find(el => el.dataset.type === tipo);

  if (atual.classList.contains("selected")) {
    atual.classList.remove("selected");
    document.getElementById("tipoVeiculo").value = "";
    opcoes.forEach(el => el.style.display = "block");
  } else {
    opcoes.forEach(el => el.classList.remove("selected"));
    atual.classList.add("selected");
    document.getElementById("tipoVeiculo").value = tipo;
    opcoes.forEach(el => { if (!el.classList.contains("selected")) el.style.display = "none"; });
  }
}

// Listeners
document.addEventListener('DOMContentLoaded', function() {
  // Event listeners para os campos
  const cepField = document.getElementById("cep");
  const localRetiradaField = document.getElementById("localRetirada");
  const localEntregaField = document.getElementById("localEntrega");
  const verMotoristasBtn = document.getElementById("verMotoristas");
  
  if (cepField) {
    cepField.addEventListener("input", checarCEP);
  }
  
  if (localRetiradaField) {
    localRetiradaField.addEventListener("input", () => autocompleteEndereco("localRetirada"));
  }
  
  if (localEntregaField) {
    localEntregaField.addEventListener("input", () => autocompleteEndereco("localEntrega"));
  }
  
  // Event listeners para seleção de veículo
  document.querySelectorAll(".vehicle-option").forEach(option => {
    option.addEventListener("click", () => {
      selecionarTipo(option.dataset.type);
    });
  });
  
  if (verMotoristasBtn) {
    verMotoristasBtn.addEventListener("click", verMotoristas);
  }
  
  // Fechar autocomplete ao clicar fora
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".input-box")) {
      closeAutocomplete("localRetirada");
      closeAutocomplete("localEntrega");
    }
  });
});

// Inicializar Firebase quando a página carregar
window.onload = function() {
  initMap();
 
  // Inicializar Firebase
  if (typeof firebase !== 'undefined') {
    firebase.initializeApp(firebaseConfig);
    db = firebase.app().firestore();
    console.log("Firebase inicializado com sucesso");
  } else {
    console.warn("Firebase não carregado. Funcionalidade limitada.");
  }
};