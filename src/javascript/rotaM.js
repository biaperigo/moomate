/* rotaM.js
   - Busca automaticamente a corrida ativa do motorista logado (sem ?corrida=ID)
   - Traça rota em tempo real do motorista até a retirada e depois até o destino
   - Preenche nomes reais (cliente e motorista) do Firestore
   - Ao finalizar, abre modal de avaliação e salva em corridas/{id}/avaliacoes
*/

(function () {
  // ===== Helpers DOM (suporta múltiplos ids usados nas suas páginas) =====
  const pick = (...ids) => ids.map(id => document.getElementById(id)).find(el => !!el) || null;
  const origemInfoEl     = pick("origem-info","origemInfo","pickup-address");
  const destinoInfoEl    = pick("destino-info","destinoInfo","destination-address");
  const nomeClienteEl    = pick("nome-cliente","clienteInfo","client-name","modal-client-name");
  const nomeMotoristaEl  = pick("nome-motorista","motoristaInfo");
  const distEl           = pick("distanciaInfo","route-distance");
  const tempoEl          = pick("tempoInfo","route-time");
  const btnTudoPronto    = pick("btnTudoPronto","btnSeguirDestino","ready-button");
  const btnFinalizar     = pick("btnFinalizarCorrida","btnFinalizar");
  const modal            = pick("modalAvaliacao","user-rating-modal");
  const estrelasWrap     = pick("estrelas");
  const salvarAvaliacaoBtn   = pick("salvarAvaliacao","submit-user-rating");
  const cancelarAvaliacaoBtn = pick("cancelarAvaliacao","cancel-user-rating","close-user-modal");
  const fecharModalBtn       = pick("fecharModal","close-user-modal");
  const comentarioEl     = pick("comentario","user-rating-comment");
  const instrWrap        = pick("route-instructions");
  const instrList        = pick("directionsList");

  const $openModal = () => { if (modal){ modal.style.display="flex"; modal.setAttribute("aria-hidden","false"); } };
  const $closeModal= () => { if (modal){ modal.style.display="none"; modal.setAttribute("aria-hidden","true"); } };
  [cancelarAvaliacaoBtn, fecharModalBtn].forEach(b => b?.addEventListener("click",$closeModal));

  let ratingAtual = 0;
  estrelasWrap?.addEventListener("click",(e)=>{
    const v = Number(e.target?.dataset?.v || 0);
    if(!v) return; ratingAtual = v;
    [...estrelasWrap.querySelectorAll("i")].forEach((i,idx)=>{
      if(idx < v){ i.classList.add("active"); i.classList.replace("fa-regular","fa-solid"); }
      else{ i.classList.remove("active"); i.classList.replace("fa-solid","fa-regular"); }
    });
  });

  // ===== Firestore =====
  const db = firebase.firestore();
  let unsubCorrida = null;
  let dadosCorrida = null;
  let corridaId = null;

  const STATUS_ABERTOS = ["aguardando_motorista","indo_retirar","a_caminho_destino"];
  const salvarUltima = id => { try{ localStorage.setItem("ultimaCorridaMotorista", id||""); }catch{} };
  const lerUltima    = () => { try{ return localStorage.getItem("ultimaCorridaMotorista")||null; }catch{ return null; } };

  async function obterNomePorUid(uid){
    if(!uid) return null;
    for(const col of ["usuarios","users"]){
      try{
        const s = await db.collection(col).doc(uid).get();
        if(s.exists){ const d=s.data()||{}; return d.nome||d.displayName||d.nomeCompleto||null; }
      }catch{}
    }
    return null;
  }

  async function resolverCorridaAtiva(uid){
    const ultima = lerUltima();
    if(ultima){
      const d = await db.collection("corridas").doc(ultima).get();
      if(d.exists && STATUS_ABERTOS.includes((d.data().status)||"")) return d.id;
    }
    const q = await db.collection("corridas")
      .where("motoristaId","==",uid).orderBy("criadoEm","desc").limit(5).get();
    const aberta   = q.docs.find(d=>STATUS_ABERTOS.includes((d.data().status)||""));
    if(aberta) return aberta.id;
    const nFinal   = q.docs.find(d=>(d.data().status||"")!=="finalizada");
    if(nFinal) return nFinal.id;
    return null;
  }

  // ===== Mapa =====
  const MAPTILER_KEY = "lRS4UV8yOp62RauVV5D7";
  const map = L.map("map",{ zoomControl:true }).setView([-15.78,-47.93],4);
  L.tileLayer(`https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`,{
    attribution:"&copy; OpenStreetMap & MapTiler", maxZoom:20
  }).addTo(map);

  let motoristaMarker=null, origemMarker=null, destinoMarker=null, routeLayer=null;
  let fase = "indo_retirar"; // ou "a_caminho_destino"
  const DISTANCIA_CHEGOU_M = 60;

  // ===== Geolocalização =====
  let watchId=null, posMotorista=null;
  function setMotoristaPos(lat,lng){
    posMotorista = {lat,lng};
    if(!motoristaMarker){
      motoristaMarker = L.marker([lat,lng],{
        icon: L.divIcon({ className:"marker-motorista",
          html:`<div style="width:16px;height:16px;background:#3DBE34;border:2px solid #fff;border-radius:50%;box-shadow:0 0 0 2px rgba(0,0,0,.2)"></div>` })
      }).addTo(map);
      map.setView([lat,lng],14);
    }else motoristaMarker.setLatLng([lat,lng]);
    atualizarRota(); // real-time
  }
  function startGeolocation(){
    if(!navigator.geolocation){ console.error("Geolocalização indisponível."); return; }
    watchId = navigator.geolocation.watchPosition(
      p=>setMotoristaPos(p.coords.latitude,p.coords.longitude),
      e=>console.error("Erro geolocalização:",e),
      { enableHighAccuracy:true, maximumAge:2000, timeout:10000 }
    );
  }

  // ===== Util =====
  const km   = m => (m/1000).toFixed(2)+" km";
  const min  = s => Math.max(1, Math.round(s/60))+" min";
  function distanciaM(lat1,lon1,lat2,lon2){
    const R=6371e3,toRad=v=>v*Math.PI/180;
    const φ1=toRad(lat1), φ2=toRad(lat2), dφ=toRad(lat2-lat1), dλ=toRad(lon2-lon1);
    const a=Math.sin(dφ/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(dλ/2)**2;
    return 2*R*Math.asin(Math.sqrt(a));
  }
  function ptTurn(type,modifier){
    const m=(modifier||"").toLowerCase();
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
    instrList.innerHTML="";
    steps.forEach(s=>{
      const li=document.createElement("li");
      const via = s.name?` pela ${s.name}`:"";
      li.textContent = `${ptTurn(s.maneuver.type,s.maneuver.modifier)}${via}`;
      const badge=document.createElement("span");
      badge.className="badge";
      badge.textContent = `${km(s.distance)} · ${min(s.duration)}`;
      li.appendChild(badge);
      instrList.appendChild(li);
    });
  }

  // ===== Rota OSRM com instruções e cor laranja =====
  async function desenharRota(from,to){
    const url=`https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&steps=true&annotations=distance,duration`;
    const resp=await fetch(url);
    if(!resp.ok) throw new Error("OSRM indisponível");
    const data=await resp.json();
    const route=data?.routes?.[0];
    if(!route) throw new Error("Rota não encontrada");

    const latlngs=route.geometry.coordinates.map(([lng,lat])=>[lat,lng]);
    if(routeLayer) routeLayer.setLatLngs(latlngs);
    else routeLayer=L.polyline(latlngs,{weight:6,opacity:.95,color:"#ff6c0c"}).addTo(map);

    // Ajuste de viewport
    const b=L.latLngBounds(latlngs);
    map.fitBounds(b,{padding:[40,40]});

    // Campos distância/tempo
    distEl && (distEl.textContent = km(route.distance));
    tempoEl && (tempoEl.textContent = min(route.duration));

    // Instruções
    const steps = route.legs?.[0]?.steps || [];
    renderInstrucoes(steps);
  }
function atualizarRota(){
  if(!dadosCorrida?.origem || !dadosCorrida?.destino) return;

  if(fase === "indo_retirar"){
    if(!posMotorista) return;
    const alvo = dadosCorrida.origem;

    // habilita o botão quando chegar na origem
    const d = distanciaM(posMotorista.lat,posMotorista.lng,alvo.lat,alvo.lng);
    if(d <= DISTANCIA_CHEGOU_M){ btnTudoPronto?.removeAttribute("disabled"); return; }

    // rota dinâmica: motorista -> origem
    desenharRota(
      { lat: posMotorista.lat, lng: posMotorista.lng },
      { lat: alvo.lat,        lng: alvo.lng }
    ).catch(e=>console.error("Falha rota motorista->origem:", e));
    return;
  }

  if(fase === "a_caminho_destino"){
    // rota fixa: origem -> destino
    desenharRota(
      { lat: dadosCorrida.origem.lat,  lng: dadosCorrida.origem.lng  },
      { lat: dadosCorrida.destino.lat, lng: dadosCorrida.destino.lng }
    ).catch(e=>console.error("Falha rota origem->destino:", e));
  }
}

  function atualizarRota(){
    if(!posMotorista || !dadosCorrida?.origem || !dadosCorrida?.destino) return;
    const alvo = (fase==="indo_retirar") ? dadosCorrida.origem : dadosCorrida.destino;
    if(!alvo?.lat || !alvo?.lng) return;

    const d = distanciaM(posMotorista.lat,posMotorista.lng,alvo.lat,alvo.lng);
    if(d <= DISTANCIA_CHEGOU_M){
      if(fase==="indo_retirar") btnTudoPronto?.removeAttribute("disabled");
      return;
    }

    desenharRota({lat:posMotorista.lat,lng:posMotorista.lng},{lat:alvo.lat,lng:alvo.lng})
      .catch(e=>console.error("Falha rota:",e));
  }

  // ===== Marcadores origem/destino =====
  function desenharMarcadores(){
    if(dadosCorrida?.origem?.lat && dadosCorrida?.origem?.lng){
      if(!origemMarker){
        origemMarker=L.marker([dadosCorrida.origem.lat,dadosCorrida.origem.lng],{
          icon:L.divIcon({className:"marker-origem",
            html:`<div style="width:18px;height:18px;background:#1c1c1c;border:2px solid #fff;border-radius:50%;"></div>`})
        }).addTo(map);
      }else origemMarker.setLatLng([dadosCorrida.origem.lat,dadosCorrida.origem.lng]);
    }
    if(dadosCorrida?.destino?.lat && dadosCorrida?.destino?.lng){
      if(!destinoMarker){
        destinoMarker=L.marker([dadosCorrida.destino.lat,dadosCorrida.destino.lng],{
          icon:L.divIcon({className:"marker-destino",
            html:`<div style="width:18px;height:18px;background:#ff6c0c;border:2px solid #fff;border-radius:50%;"></div>`})
        }).addTo(map);
      }else destinoMarker.setLatLng([dadosCorrida.destino.lat,dadosCorrida.destino.lng]);
    }
  }

  // ===== UI =====
 btnTudoPronto?.addEventListener("click", async ()=>{
  if(!dadosCorrida || !corridaId) return;
  fase = "a_caminho_destino";                 // muda de fase
  btnTudoPronto.style.display = "none";
  btnFinalizar && (btnFinalizar.style.display = "inline-block");

  try {
    await db.collection("corridas").doc(corridaId)
      .set({ status: "a_caminho_destino" }, { merge: true });
  } catch(e){ console.error(e); }

  // limpa a rota anterior (motorista -> origem)
  if(routeLayer){ map.removeLayer(routeLayer); routeLayer = null; }

  // desenha NOVA rota: origem -> destino (fixa)
  if(dadosCorrida?.origem && dadosCorrida?.destino){
    desenharRota(
      { lat: dadosCorrida.origem.lat,  lng: dadosCorrida.origem.lng  },
      { lat: dadosCorrida.destino.lat, lng: dadosCorrida.destino.lng }
    ).catch(e=>console.error("Falha rota origem->destino:", e));
  }
});


  btnFinalizar?.addEventListener("click", ()=> $openModal());

  salvarAvaliacaoBtn?.addEventListener("click", async ()=>{
    if(!corridaId) return;
    const nota = ratingAtual||0;
    const comentario = comentarioEl?.value?.trim() || "";
    try{
      const corridaRef = db.collection("corridas").doc(corridaId);
      const avalRef = corridaRef.collection("avaliacoes").doc();
      const batch = db.batch();
      batch.set(avalRef,{
        nota, comentario,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        motoristaId: dadosCorrida?.motoristaId||null,
        clienteId: dadosCorrida?.clienteId||null
      });
      batch.set(corridaRef,{
        status:"finalizada",
        finalizadaEm: firebase.firestore.FieldValue.serverTimestamp()
      },{merge:true});
      await batch.commit();
      $closeModal();
      alert("Avaliação salva.");
    }catch(e){
      console.error(e); alert("Erro ao salvar avaliação.");
    }
  });

  // ===== Assinar corrida =====
  async function assinarCorrida(){
    firebase.auth().onAuthStateChanged(async (user)=>{
      if(!user){ console.warn("Sem usuário logado."); return; }
      corridaId = await resolverCorridaAtiva(user.uid);
      if(!corridaId){ alert("Nenhuma corrida ativa encontrada para este motorista."); return; }
      salvarUltima(corridaId);

      unsubCorrida && unsubCorrida();
      unsubCorrida = db.collection("corridas").doc(corridaId).onSnapshot(async (doc)=>{
        if(!doc.exists) return;
        dadosCorrida = doc.data()||{};

        origemInfoEl && (origemInfoEl.textContent  = dadosCorrida?.origem?.endereco  || "—");
        destinoInfoEl && (destinoInfoEl.textContent = dadosCorrida?.destino?.endereco || "—");

        // nomes
        (async ()=>{
          const nC = dadosCorrida?.clienteNome   || await obterNomePorUid(dadosCorrida?.clienteId);
          const nM = dadosCorrida?.motoristaNome || await obterNomePorUid(dadosCorrida?.motoristaId);
          nomeClienteEl && (nomeClienteEl.textContent = nC || "—");
          nomeMotoristaEl && (nomeMotoristaEl.textContent = nM || "—");
        })();

        // fase
        if(dadosCorrida.status==="a_caminho_destino") fase="a_caminho_destino";
        else if(dadosCorrida.status==="finalizada"){} else fase="indo_retirar";

        desenharMarcadores();
        atualizarRota();

        if(!dadosCorrida.status){
          try{ await db.collection("corridas").doc(corridaId).set({status:"indo_retirar"},{merge:true}); }
          catch(e){ console.error(e); }
        }
      });
    });
  }

  // ===== Init/Cleanup =====
  function init(){ assinarCorrida(); startGeolocation(); }
  init();

  window.addEventListener("beforeunload",()=>{
    unsubCorrida && unsubCorrida();
    if(watchId) navigator.geolocation.clearWatch(watchId);
  });
})();
