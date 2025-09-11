// ============== Firebase ==============
const firebaseConfig = {
    apiKey: "AIzaSyB9ZuAW1F9rBfOtg3hgGpA6H7JFUoiTlhE",
    authDomain: "moomate-39239.firebaseapp.com",
    projectId: "moomate-39239",
    storageBucket: "moomate-39239.appspot.com",
    messagingSenderId: "637968714747",
    appId: "1:637968714747:web:ad15dc3571c22f046b595e",
    measurementId: "G-62J7Q8CKP4"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ============== Resolução do corridaId ==============
const qs2 = new URLSearchParams(location.search);
let corridaIdC = qs2.get("id") || sessionStorage.getItem("corridaId");

async function esperarAuthC() {
  await new Promise((res) => {
    const unsub = firebase.auth().onAuthStateChanged(() => {
      unsub();
      res();
    });
  });
}

async function resolverCorridaIdCliente(dbRef) {
  if (corridaIdC) return corridaIdC;

  await esperarAuthC();
  const u = firebase.auth().currentUser;
  if (!u) {
    alert("Faça login. ID da corrida ausente.");
    throw new Error("sem-login");
  }

  const q = await dbRef
    .collection("corridas")
    .where("clienteId", "==", u.uid)
    .where("status", "in", ["aceita", "em_andamento", "ao_destino"])
    .orderBy("iniciadaEm", "desc")
    .limit(1)
    .get();

  if (q.empty) {
    alert("Nenhuma corrida ativa encontrada.");
    throw new Error("sem-corrida");
  }

  corridaIdC = q.docs[0].id;
  sessionStorage.setItem("corridaId", corridaIdC);
  return corridaIdC;
}

// ============== Elementos do layout ==============
const mapElC = document.getElementById("map");
const driverNameEl = document.getElementById("driver-name");
const vehicleInfoEl = document.getElementById("vehicle-info");
const currentStatusEl = document.getElementById("current-status");
const estimatedTimeEl = document.getElementById("estimated-time");

// Timeline elements
const timelineAccepted = document.getElementById("timeline-accepted");
const timelinePickup = document.getElementById("timeline-pickup");
const timelineDestination = document.getElementById("timeline-destination");
const timelineCompleted = document.getElementById("timeline-completed");

// Modal de avaliação do motorista
const modalMotorista = document.getElementById("driver-rating-modal");
const estrelasM = modalMotorista ? modalMotorista.querySelectorAll(".star") : [];
const comentarioM = document.getElementById("driver-rating-comment");
const salvarM = document.getElementById("submit-driver-rating");
const fecharM = document.getElementById("close-driver-modal");

// ============== Mapa / Rota / Rastreamento ==============
const MAPTILER_KEY_C = "lRS4UV8yOp62RauVV5D7";
let mapC, routeLayerC, driverMarkerC, pickupMarkerC, destinationMarkerC;
let corridaC, ratingM = 0;
let corridaRefC;

function initMapC(center = [-23.55, -46.64]) {
  mapC = L.map(mapElC).setView(center, 13);
  L.tileLayer(
    `https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${MAPTILER_KEY_C}`,
    { 
      tileSize: 512, 
      zoomOffset: -1, 
      attribution: "&copy; OpenStreetMap & MapTiler" 
    }
  ).addTo(mapC);
}

async function osrmC(fromLngLat, toLngLat) {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${fromLngLat[0]},${fromLngLat[1]};${toLngLat[0]},${toLngLat[1]}?overview=full&geometries=geojson&alternatives=false`;
    const r = await fetch(url);
    const j = await r.json();
    if (!j.routes || !j.routes[0]) return null;
    return j.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);
  } catch (error) {
    console.error("Erro ao calcular rota:", error);
    return null;
  }
}

function atualizarStatus(status) {
  if (currentStatusEl) {
    let statusText = "";
    switch (status) {
      case "aceita":
        statusText = "Motorista a caminho do ponto de retirada";
        ativarTimeline("accepted");
        break;
      case "em_andamento":
        statusText = "Motorista a caminho do ponto de retirada";
        ativarTimeline("pickup");
        break;
      case "ao_destino":
        statusText = "Motorista a caminho do destino";
        ativarTimeline("destination");
        break;
      case "concluida":
        statusText = "Corrida finalizada";
        ativarTimeline("completed");
        break;
      default:
        statusText = "Aguardando motorista...";
    }
    currentStatusEl.textContent = statusText;
  }
}

function ativarTimeline(step) {
  // Reset all timeline items
  [timelineAccepted, timelinePickup, timelineDestination, timelineCompleted].forEach(item => {
    if (item) item.classList.remove("active", "completed");
  });

  const now = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  switch (step) {
    case "accepted":
      if (timelineAccepted) {
        timelineAccepted.classList.add("active");
        const acceptedTime = timelineAccepted.querySelector("p");
        if (acceptedTime) acceptedTime.textContent = now;
      }
      break;
    case "pickup":
      if (timelineAccepted) timelineAccepted.classList.add("completed");
      if (timelinePickup) {
        timelinePickup.classList.add("active");
        const pickupTime = timelinePickup.querySelector("p");
        if (pickupTime) pickupTime.textContent = now;
      }
      break;
    case "destination":
      if (timelineAccepted) timelineAccepted.classList.add("completed");
      if (timelinePickup) timelinePickup.classList.add("completed");
      if (timelineDestination) {
        timelineDestination.classList.add("active");
        const destTime = timelineDestination.querySelector("p");
        if (destTime) destTime.textContent = now;
      }
      break;
    case "completed":
      [timelineAccepted, timelinePickup, timelineDestination].forEach(item => {
        if (item) item.classList.add("completed");
      });
      if (timelineCompleted) {
        timelineCompleted.classList.add("active");
        const completedTime = timelineCompleted.querySelector("p");
        if (completedTime) completedTime.textContent = now;
      }
      break;
  }
}

function atualizarPosicaoMotorista(lat, lng) {
  const truckIcon = L.divIcon({
    html: '<div style="background: #2196F3; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">🚚</div>',
    className: 'truck-marker',
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });

  if (!driverMarkerC) {
    driverMarkerC = L.marker([lat, lng], { icon: truckIcon }).addTo(mapC);
    driverMarkerC.bindPopup("🚚 Motorista");
  } else {
    // Animação suave do movimento
    const currentPos = driverMarkerC.getLatLng();
    const newPos = L.latLng(lat, lng);
    
    // Calcular a diferença para animação suave
    const steps = 10;
    const latStep = (newPos.lat - currentPos.lat) / steps;
    const lngStep = (newPos.lng - currentPos.lng) / steps;
    
    let step = 0;
    const animate = () => {
      if (step < steps) {
        const intermediatePos = L.latLng(
          currentPos.lat + (latStep * step),
          currentPos.lng + (lngStep * step)
        );
        driverMarkerC.setLatLng(intermediatePos);
        step++;
        setTimeout(animate, 50); // 50ms entre cada step
      } else {
        driverMarkerC.setLatLng(newPos);
      }
    };
    animate();
  }

  // Atualizar rota dinâmica baseada no status
  if (corridaC && corridaC.status) {
    atualizarRotaDinamica(lat, lng, corridaC.status);
  }
}

function atualizarRotaDinamica(motoristaLat, motoristaLng, status) {
  if (!corridaC || !corridaC.origem || !corridaC.destino) return;

  // Remover rota anterior se existir
  if (routeLayerC) {
    mapC.removeLayer(routeLayerC);
    routeLayerC = null;
  }

  let destino;
  let cor = '#2196F3';

  // Determinar destino baseado no status
  if (status === "aceita" || status === "em_andamento") {
    destino = [corridaC.origem.lng, corridaC.origem.lat];
    cor = '#4CAF50'; // Verde para ir à retirada
  } else if (status === "ao_destino") {
    destino = [corridaC.destino.lng, corridaC.destino.lat];
    cor = '#FF9800'; // Laranja para ir ao destino
  } else {
    return; // Não desenhar rota para outros status
  }

  // Calcular e desenhar nova rota
  osrmC([motoristaLng, motoristaLat], destino).then(coords => {
    if (coords) {
      routeLayerC = L.polyline(coords, { 
        weight: 5, 
        color: cor,
        opacity: 0.8
      }).addTo(mapC);

      // Calcular tempo estimado baseado na distância
      const distanciaKm = calcularDistanciaTotal(coords);
      const tempoEstimado = Math.round(distanciaKm * 2); // Aproximadamente 2 min por km
      
      if (estimatedTimeEl) {
        estimatedTimeEl.textContent = `${tempoEstimado} min`;
      }
    }
  });
}

function calcularDistanciaTotal(coords) {
  let distanciaTotal = 0;
  for (let i = 1; i < coords.length; i++) {
    const lat1 = coords[i-1][0];
    const lng1 = coords[i-1][1];
    const lat2 = coords[i][0];
    const lng2 = coords[i][1];
    
    const R = 6371; // Raio da Terra em km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    distanciaTotal += R * c;
  }
  return distanciaTotal;
}

function atualizarInfoCorrida() {
  if (corridaC) {
    if (driverNameEl) driverNameEl.textContent = corridaC.motoristaNome || "Motorista";
    if (vehicleInfoEl) vehicleInfoEl.textContent = corridaC.motoristaVeiculo || "Veículo não informado";
    
    // Atualizar modal com informações do motorista
    const modalDriverName = document.getElementById("modal-driver-name");
    const modalVehicleInfo = document.getElementById("modal-vehicle-info");
    if (modalDriverName) modalDriverName.textContent = corridaC.motoristaNome || "Motorista";
    if (modalVehicleInfo) modalVehicleInfo.textContent = corridaC.motoristaVeiculo || "Veículo não informado";
  }
}

// ============== Fluxo principal ==============
(async function mainC() {
  try {
    const id = await resolverCorridaIdCliente(db);
    corridaRefC = db.collection("corridas").doc(id);
    const s = await corridaRefC.get();
    
    if (!s.exists) {
      alert("Corrida não encontrada.");
      return;
    }
    
    corridaC = s.data();
    
    // Inicializar mapa centrado na origem
    initMapC([corridaC.origem.lat, corridaC.origem.lng]);
    
    // Atualizar informações da corrida
    atualizarInfoCorrida();

    // Criar marcadores de origem e destino
    if (corridaC.origem) {
      pickupMarkerC = L.marker([corridaC.origem.lat, corridaC.origem.lng], {
        icon: L.divIcon({
          html: '<i class="fas fa-map-marker-alt" style="color: #4CAF50; font-size: 24px;"></i>',
          className: 'custom-marker',
          iconSize: [30, 30],
          iconAnchor: [15, 30]
        })
      }).addTo(mapC).bindPopup("📍 Ponto de Retirada");
    }

    if (corridaC.destino) {
      destinationMarkerC = L.marker([corridaC.destino.lat, corridaC.destino.lng], {
        icon: L.divIcon({
          html: '<i class="fas fa-flag-checkered" style="color: #F44336; font-size: 24px;"></i>',
          className: 'custom-marker',
          iconSize: [30, 30],
          iconAnchor: [15, 30]
        })
      }).addTo(mapC).bindPopup("🏁 Destino");
    }

    // Desenhar rota visual origem->destino (linha pontilhada)
    if (corridaC.origem && corridaC.destino) {
      const coords = await osrmC(
        [corridaC.origem.lng, corridaC.origem.lat],
        [corridaC.destino.lng, corridaC.destino.lat]
      );
      
      if (coords) {
        const rotaCompleta = L.polyline(coords, { 
          weight: 3, 
          color: '#9E9E9E',
          opacity: 0.5,
          dashArray: '10, 10'
        }).addTo(mapC);
        
        // Ajustar visualização para mostrar toda a rota
        const bounds = L.latLngBounds([
          [corridaC.origem.lat, corridaC.origem.lng],
          [corridaC.destino.lat, corridaC.destino.lng]
        ]);
        mapC.fitBounds(bounds, { padding: [50, 50] });
      }
    }

    // Atualizar status inicial
    atualizarStatus(corridaC.status);

    // Se já existe posição do motorista, mostrar no mapa
    if (corridaC.motoristaPos && corridaC.motoristaPos.lat && corridaC.motoristaPos.lng) {
      atualizarPosicaoMotorista(corridaC.motoristaPos.lat, corridaC.motoristaPos.lng);
    }

    // Escutar mudanças em tempo real
    corridaRefC.onSnapshot((doc) => {
      const data = doc.data();
      if (!data) return;

      // Atualizar posição do motorista
      if (data.motoristaPos && data.motoristaPos.lat && data.motoristaPos.lng) {
        atualizarPosicaoMotorista(data.motoristaPos.lat, data.motoristaPos.lng);
      }

      // Atualizar status
      if (data.status !== corridaC.status) {
        atualizarStatus(data.status);
        
        // Abrir modal de avaliação quando corrida for concluída
        if (data.status === "concluida" && modalMotorista) {
          setTimeout(() => {
            modalMotorista.style.display = "block";
          }, 1000); // Aguardar 1 segundo para mostrar o modal
        }
      }

      // Atualizar dados da corrida se mudaram
      if (data.motoristaNome !== corridaC.motoristaNome || 
          data.motoristaVeiculo !== corridaC.motoristaVeiculo) {
        corridaC = data;
        atualizarInfoCorrida();
      } else {
        corridaC = data;
      }
    });

    // Sistema de avaliação do motorista
    estrelasM.forEach((estrela, index) => {
      estrela.addEventListener("click", () => {
        ratingM = index + 1;
        estrelasM.forEach((s, i) => {
          if (i < ratingM) {
            s.classList.add("active");
            s.style.color = "#FFD700";
          } else {
            s.classList.remove("active");
            s.style.color = "#ddd";
          }
        });
      });
    });

    // Salvar avaliação do motorista
    if (salvarM) {
      salvarM.addEventListener("click", async () => {
        if (ratingM <= 0) {
          alert("Por favor, selecione uma nota de 1 a 5 estrelas.");
          return;
        }

        try {
          const motoristaId = corridaC?.motoristaId;
          if (!motoristaId) {
            alert("ID do motorista não encontrado.");
            return;
          }

          await db
            .collection("usuarios")
            .doc(motoristaId)
            .collection("avaliacoes")
            .add({
              tipo: "motorista",
              corridaId: id,
              nota: ratingM,
              comentario: comentarioM?.value || "",
              criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
            });

          modalMotorista.style.display = "none";
          alert("Avaliação enviada com sucesso!");
          
          // Redirecionar para página de pagamento ou home
          window.location.href = `pagamento.html?id=${id}`;
          
        } catch (error) {
          console.error("Erro ao salvar avaliação:", error);
          alert("Erro ao enviar avaliação. Tente novamente.");
        }
      });
    }

    // Fechar modal de avaliação
    if (fecharM) {
      fecharM.addEventListener("click", () => {
        modalMotorista.style.display = "none";
        window.location.href = `pagamento.html?id=${id}`;
      });
    }

  } catch (error) {
    console.error("Erro na inicialização:", error);
    alert("Erro ao carregar o status da corrida. Verifique sua conexão e tente novamente.");
  }
})();
