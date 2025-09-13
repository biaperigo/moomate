(function() {
  const pick = (...ids) => ids.map(id => document.getElementById(id)).find(el => !!el) || null;

  // ===== Seletores =====
  const origemInfoEl = pick("origemInfo");
  const destinoInfoEl = pick("destinoInfo");
  const nomeClienteEl = pick("clienteInfo","modal-client-name");
  const nomeMotoristaEl = pick("motoristaInfo");
  const distEl = pick("distanciaInfo");
  const tempoEl = pick("tempoInfo");
  const btnTudoPronto = pick("btnSeguirDestino");
  const btnFinalizar = pick("btnFinalizar");

  const instrWrap = pick("route-instructions");
  const instrList = pick("directionsList");

  const modal = pick("user-rating-modal");
  const salvarAvaliacaoBtn = pick("submit-user-rating");
  const cancelarAvaliacaoBtn = pick("cancel-user-rating");
  const fecharModalBtn = pick("close-user-modal");
  const comentarioEl = pick("user-rating-comment");

  const $openModal = () => modal && (modal.style.display="flex");
  const $closeModal = () => modal && (modal.style.display="none");
  [cancelarAvaliacaoBtn, fecharModalBtn].forEach(b => b?.addEventListener("click",$closeModal));

  // ===== Firebase =====
  const db = firebase.firestore();
  let corridaId = null;
  let dadosCorrida = null;

  async function obterNome(uid){
    if(!uid) return "—";
    try{
      const doc = await db.collection("usuarios").doc(uid).get();
      if(doc.exists) return doc.data().nome || "—";
    }catch{}
    return "—";
  }

  async function obterCorridaAtiva(uid){
    const ultima = localStorage.getItem("ultimaCorridaMotorista");
    if(ultima){
      const d = await db.collection("corridas").doc(ultima).get();
      if(d.exists && d.data().status!=="finalizada") return d.id;
    }
    const q = await db.collection("corridas").where("motoristaId","==",uid).orderBy("criadoEm","desc").limit(1).get();
    if(!q.empty) return q.docs[0].id;
    return null;
  }

  // ===== Map =====
  const MAPTILER_KEY = "lRS4UV8yOp62RauVV5D7";
  const map = L.map("map").setView([-15.78,-47.93],14);
  L.tileLayer(`https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`,{
    attribution:"&copy; OpenStreetMap & MapTiler", maxZoom:20
  }).addTo(map);

  let motoristaMarker = null, origemMarker = null, destinoMarker = null, routeLayer = null;
  let posMotorista = null;
  let fase = "indo_retirar";

  // ===== Utils =====
  const km = m => (m/1000).toFixed(2)+" km";
  const min = s => Math.max(1, Math.round(s/60))+" min";

  function ptTurn(type,modifier){
    const m = (modifier||"").toLowerCase();
    const dir = m==="left"?"à esquerda":
                m==="right"?"à direita":
                m==="slight left"?"levemente à esquerda":
                m==="slight right"?"levemente à direita":
                m==="uturn"?"retorne":"em frente";
    if(type==="depart") return "Siga em frente";
    if(type==="arrive") return "Chegue ao destino";
    if(type==="turn") return `Vire ${dir}`;
    if(type==="roundabout") return "Entre na rotatória e saia conforme indicado";
    if(type==="merge") return "Converja para a via indicada";
    if(type==="end of road") return "No fim da via, siga indicado";
    if(type==="continue") return `Continue ${dir}`;
    return "Siga a via indicada";
  }

  function renderInstrucoes(steps){
    if(!instrWrap||!instrList) return;
    instrWrap.style.display="block";
    instrList.innerHTML = "";
    steps.forEach(s=>{
      const li = document.createElement("li");
      const via = s.name ? ` pela ${s.name}` : "";
      li.textContent = `${ptTurn(s.maneuver.type,s.maneuver.modifier)}${via}`;
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = `${km(s.distance)} · ${min(s.duration)}`;
      li.appendChild(badge);
      instrList.appendChild(li);
    });
  }

  async function desenharRota(from,to){
    if(!from || !to) return;
    const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&steps=true`;
    const resp = await fetch(url);
    if(!resp.ok) return console.error("OSRM indisponível");
    const data = await resp.json();
    const route = data?.routes?.[0];
    if(!route) return console.error("Rota não encontrada");

    const latlngs = route.geometry.coordinates.map(([lng,lat])=>[lat,lng]);
    if(routeLayer) map.removeLayer(routeLayer);
    routeLayer = L.polyline(latlngs,{weight:6,opacity:.95,color:"#ff6c0c"}).addTo(map);
    map.fitBounds(L.latLngBounds(latlngs),{padding:[40,40]});

    distEl && (distEl.textContent = km(route.distance));
    tempoEl && (tempoEl.textContent = min(route.duration));
    renderInstrucoes(route.legs[0].steps || []);
  }

  // ===== Marcadores =====
  function desenharMarcadores(){
    // Motorista – verde com pulse
    if(posMotorista){
      if(!motoristaMarker){
        motoristaMarker = L.marker([posMotorista.lat,posMotorista.lng],{
          icon:L.divIcon({
            className:"marker-motorista",
            html:`<div style="
              width:20px;
              height:20px;
              background:#3DBE34;
              border:3px solid #fff;
              border-radius:50%;
              box-shadow:0 0 10px rgba(0,0,0,0.5);
              animation: pulse 1.2s infinite;
            "></div>`
          })
        }).addTo(map);
      } else motoristaMarker.setLatLng([posMotorista.lat,posMotorista.lng]);
    }

    // Origem – azul simples
    if(dadosCorrida?.origem){
      if(!origemMarker){
        origemMarker = L.marker([dadosCorrida.origem.lat,dadosCorrida.origem.lng],{
          icon:L.divIcon({
            className:"marker-origem",
            html:`<div style="
              width:22px;
              height:22px;
              background:#1E3A8A;
              border:3px solid #fff;
              border-radius:50%;
            "></div>`
          })
        }).addTo(map);
      } else origemMarker.setLatLng([dadosCorrida.origem.lat,dadosCorrida.origem.lng]);
    }

    // Destino – laranja simples
    if(fase==="a_caminho_destino" && dadosCorrida?.destino){
      if(!destinoMarker){
        destinoMarker = L.marker([dadosCorrida.destino.lat,dadosCorrida.destino.lng],{
          icon:L.divIcon({
            className:"marker-destino",
            html:`<div style="
              width:22px;
              height:22px;
              background:#FF6C0C;
              border:3px solid #fff;
              border-radius:50%;
            "></div>`
          })
        }).addTo(map);
      }
    }
  }

  function setMotoristaPos(lat,lng){
    posMotorista = {lat,lng};
    desenharMarcadores();
    if(fase==="indo_retirar" && dadosCorrida?.origem){
      desenharRota(posMotorista,dadosCorrida.origem);
    }
  }

  function startGeolocation(){
    if(!navigator.geolocation) return console.error("Geolocalização indisponível");
    navigator.geolocation.watchPosition(p => setMotoristaPos(p.coords.latitude,p.coords.longitude));
  }

  // ===== Botões =====
  btnTudoPronto?.addEventListener("click", ()=>{
    if(!dadosCorrida) return;
    fase="a_caminho_destino";
    if(routeLayer) map.removeLayer(routeLayer);
    desenharMarcadores();
    desenharRota(dadosCorrida.origem,dadosCorrida.destino);
    btnTudoPronto.style.display="none";
    btnFinalizar.style.display="inline-block";
  });

  btnFinalizar?.addEventListener("click", ()=> $openModal());

  salvarAvaliacaoBtn?.addEventListener("click", async ()=>{
    if(!corridaId) return;
    try{
      const nota = 5;
      const comentario = comentarioEl.value || "";
      const batch = db.batch();
      const corridaRef = db.collection("corridas").doc(corridaId);
      const avalRef = corridaRef.collection("avaliacoes").doc();
      batch.set(avalRef,{nota,comentario,createdAt:firebase.firestore.FieldValue.serverTimestamp()});
      batch.set(corridaRef,{status:"finalizada",finalizadaEm:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});
      await batch.commit();
      $closeModal();
      alert("Avaliação salva!");
    }catch(e){console.error(e); alert("Erro ao salvar avaliação.");}
  });

  // ===== Init =====
  firebase.auth().onAuthStateChanged(async user=>{
    if(!user) return alert("Usuário não logado.");
    corridaId = await obterCorridaAtiva(user.uid);
    if(!corridaId) return alert("Nenhuma corrida ativa encontrada.");

    db.collection("corridas").doc(corridaId).onSnapshot(async doc=>{
      if(!doc.exists) return;
      dadosCorrida = doc.data();
      origemInfoEl.textContent = dadosCorrida.origem?.endereco || "—";
      destinoInfoEl.textContent = dadosCorrida.destino?.endereco || "—";
      nomeClienteEl.textContent = await obterNome(dadosCorrida.clienteId);
      nomeMotoristaEl.textContent = await obterNome(dadosCorrida.motoristaId);
      desenharMarcadores();
      if(posMotorista) desenharRota(posMotorista,dadosCorrida.origem);
    });

    startGeolocation();
  });

  // ===== Pulse CSS =====
  const style = document.createElement('style');
  style.innerHTML = `
    @keyframes pulse {
      0% { transform: scale(0.9); opacity: 0.7; }
      50% { transform: scale(1.2); opacity: 1; }
      100% { transform: scale(0.9); opacity: 0.7; }
    }
  `;
  document.head.appendChild(style);

})();
// ===== Avaliação - Estrelas =====
let ratingAtual = 0; // nota atual
const ratingStars = document.querySelectorAll(".rating-stars .star");

ratingStars.forEach((star,index)=>{
  star.addEventListener("click", ()=>{
    ratingAtual = parseInt(star.dataset.rating);
    // Atualiza visualmente todas as estrelas
    ratingStars.forEach((s,i)=>{
      if(i < ratingAtual){
        s.classList.add("active");  // estrela cheia
      } else {
        s.classList.remove("active"); // estrela vazia
      }
    });
  });
});

// ===== Salvar avaliação =====
salvarAvaliacaoBtn?.addEventListener("click", async ()=>{
  if(!corridaId || !dadosCorrida?.clienteId) return;

  const nota = ratingAtual || 0;
  const comentario = comentarioEl.value?.trim() || "";
  const clienteId = dadosCorrida.clienteId;

  try {
    const corridaRef = db.collection("corridas").doc(corridaId);
    const avalRef = corridaRef.collection("avaliacoes").doc();
    const usuarioRef = db.collection("usuarios").doc(clienteId);

    const batch = db.batch();

    // 1️⃣ Avaliação na corrida
    batch.set(avalRef,{
      nota,
      comentario,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      motoristaId: dadosCorrida?.motoristaId || null,
      clienteId: clienteId
    });

    // 2️⃣ Atualizar avaliação do usuário
    batch.set(usuarioRef,{
      avaliacoesRecebidas: firebase.firestore.FieldValue.arrayUnion({
        corridaId: corridaId,
        nota,
        comentario,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        motoristaId: dadosCorrida?.motoristaId || null
      })
    }, { merge: true });

    // 3️⃣ Atualizar status da corrida para finalizada
    batch.set(corridaRef,{
      status:"finalizada",
      finalizadaEm: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    await batch.commit();

    // Fechar modal e resetar estrelas
    $closeModal();
    ratingAtual = 0;
    ratingStars.forEach(s=>s.classList.remove("active"));
    comentarioEl.value = "";

    alert("Avaliação salva com sucesso!");
  } catch(e){
    console.error(e);
    alert("Erro ao salvar avaliação. Tente novamente.");
  }
});
