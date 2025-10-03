let currentCorridaId = null;
let unsubCorrida = () => {};
let unsubSync = () => {};

(() => {
  const { firebase, L } = window;
  if (!firebase || !firebase.apps.length) return;
  const db = firebase.firestore();

  const SP_BOUNDS = L.latLngBounds([[-25.5, -53.5], [-19.5, -44.0]]);
  const ATIVAS = new Set(["agendamento_confirmado","corrida_agendamento_confirmado","indo_retirar","a_caminho_destino","finalizada_pendente"]);

  const $ = (id)=>document.getElementById(id);
  const pegarEl = (...ids) => ids.map(id=>document.getElementById(id)).find(Boolean) || null;

  const definirTexto = (ids, txt) => { 
    const el = pegarEl(...ids); 
    if (el) {
      const val = (txt === null || txt === undefined || txt === "null" || txt === "undefined" || (typeof txt === 'string' && txt.trim() === '')) ? "—" : txt;
      el.textContent = val;
    }
  };
  const km  = (m)=> (m/1000).toFixed(2)+" km";
  const min = (s)=> Math.max(1, Math.round(s/60))+" min";

  let docRefGlobal = null;
  let motoristaUidAtual = null;
  
  async function salvarAvaliacaoMotorista(motoristaUid, nota, comentario = "", corridaIdOverride = null, clienteUidOverride = null){
    const uidMot = motoristaUid || motoristaUidAtual;
    if (!uidMot) throw new Error('motoristaUid inválido');
    const n = Number(nota);
    if (!Number.isFinite(n) || n < 1 || n > 5) throw new Error('nota deve ser 1..5');
    const clienteUid = clienteUidOverride || (firebase.auth && firebase.auth().currentUser?.uid) || null;
    const when = firebase.firestore.FieldValue.serverTimestamp();
    const corridaId = corridaIdOverride || currentCorridaId || null;
    const avId = `${corridaId||'sem'}_${clienteUid||'anon'}`;

    await db.collection('motoristas').doc(uidMot)
      .collection('avaliacoes').doc(avId)
      .set({ nota: n, estrelas: n, comentario: comentario||"", agendamentoId: corridaId, clienteUid, criadoEm: when }, { merge: true });

    await db.collection('avaliacoes').doc(avId)
      .set({ nota: n, estrelas: n, comentario: comentario||"", agendamentoId: corridaId, clienteUid, motoristaUid: uidMot, criadoEm: when }, { merge: true });

    const motRef = db.collection('motoristas').doc(uidMot);
    await db.runTransaction(async (tx)=>{
      const motSnap = await tx.get(motRef);
      const d = motSnap.exists ? (motSnap.data()||{}) : {};
      const soma = Number(d.avaliacaoSoma||0) + n;
      const count = Number(d.avaliacaoCount||0) + 1;
      const media = soma / count;
      tx.set(motRef, { avaliacaoSoma: soma, avaliacaoCount: count, avaliacaoMedia: media }, { merge: true });
    });
  
    try { if (docRefGlobal) await docRefGlobal.set({ avaliacaoRegistrada: true }, { merge: true }); } catch {}
  }
  window.salvarAvaliacaoMotorista = salvarAvaliacaoMotorista;

  const nomeMotoristaEl = pegarEl("nomeMotorista","motorista-nome","motoristaInfo","driver-name","driverName");
  const carroEl = pegarEl("veiculoInfo","motorista-carro","carroInfo","vehicle-info","vehicleInfo");

  const cancelBtn = $("cancel-ride-btn");
  const cancelModal = $("cancel-modal");
  const confirmCancelBtn = $("confirm-cancel");
  const keepRideBtn = $("keep-ride");

  function configurarHandlersCancelamento(){
    try{
      if (window.__cancel_handlers_bound__) return; 
      window.__cancel_handlers_bound__ = true;
      if (cancelModal) cancelModal.style.display = "none";
      if (cancelBtn) cancelBtn.onclick = (e)=>{ 
        if (e && e.preventDefault) e.preventDefault();
        if (e && e.stopPropagation) e.stopPropagation();
        if (!cancelModal) return false;
        if (cancelModal.style.display === 'flex') return false; 
        cancelModal.style.display = "flex"; 
        return false; 
      };
      if (keepRideBtn) keepRideBtn.onclick = (e)=>{ 
        if (e && e.preventDefault) e.preventDefault();
        if (e && e.stopPropagation) e.stopPropagation();
        if (cancelModal) cancelModal.style.display = "none"; 
        return false;
      };
      if (confirmCancelBtn) confirmCancelBtn.onclick = (e)=>{ 
        if (e && e.preventDefault) e.preventDefault();
        if (e && e.stopPropagation) e.stopPropagation();
        cancelarCorrida(); 
        return false;
      };
    }catch(err){ console.warn('Falha ao configurar handlers de cancelamento:', err); }
  }
  configurarHandlersCancelamento();

  const map = L.map("map", { maxBounds: SP_BOUNDS, maxBoundsViscosity: 1.0 });
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{ attribution:" OpenStreetMap" }).addTo(map);
  map.fitBounds(SP_BOUNDS);

  let mkM=null, mkO=null, mkD=null, routeLayer=null, fitted=false;
  const S = { origem:null, destino:null, motorista:null, fase:"indo_retirar" };
  let C = {};
  let corridaId = null;
  let currentUser = null;
  let lastRouteDrawTs = 0;

  function validarCoordenadas(lat, lng) {
    if (lat === null || lng === null || lat === undefined || lng === undefined) return false;
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    if (isNaN(latNum) || isNaN(lngNum)) return false;
    if (latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) return false;
    return true;
  }

  async function geocodificarEndereco(endereco) {
    if (!endereco || typeof endereco !== 'string') return null;
    
    console.log("[GEOCODE] Tentando geocodificar:", endereco);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(()=>controller.abort(), 8000);
    
    try {
      const enderecoCompleto = endereco.includes('São Paulo') ? endereco : `${endereco}, São Paulo, SP, Brasil`;
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(enderecoCompleto)}&addressdetails=1&limit=1&countrycodes=br`;
      
      const resp = await fetch(url, { 
        headers: { 
          'Accept-Language': 'pt-BR', 
          'User-Agent': 'MoomateApp/1.0' 
        }, 
        signal: controller.signal 
      });
      
      clearTimeout(timeoutId);
      
      if (!resp.ok) {
        console.warn("[GEOCODE] Erro HTTP:", resp.status);
        return null;
      }
      
      const arr = await resp.json();
      const hit = Array.isArray(arr) ? arr[0] : null;
      
      if (!hit) {
        console.warn("[GEOCODE] Nenhum resultado encontrado");
        return null;
      }
      
      const lat = parseFloat(hit.lat);
      const lng = parseFloat(hit.lon);
      
      if (!validarCoordenadas(lat, lng)) {
        console.warn("[GEOCODE] Coordenadas inválidas:", lat, lng);
        return null;
      }
      
      console.log("[GEOCODE] ✓ Sucesso:", { lat, lng, endereco: hit.display_name });
      return { lat, lng, endereco: hit.display_name };
      
    } catch (error) {
      clearTimeout(timeoutId);
      console.error("[GEOCODE] Erro:", error.message);
      return null;
    }
  }

  async function resolveAndSetPinos(docData) {
    console.log("[RESOLVE] Resolvendo pinos...");
    
    if (!S.origem && docData?.origem?.endereco) {
      console.log("[RESOLVE] Tentando resolver origem:", docData.origem.endereco);
      const p = await geocodificarEndereco(docData.origem.endereco);
      if (p && validarCoordenadas(p.lat, p.lng)) {
        console.log("[RESOLVE] ✓ Origem resolvida");
        setPinoOrigem(p);
      }
    }
    
    if (!S.destino && docData?.destino?.endereco) {
      console.log("[RESOLVE] Tentando resolver destino:", docData.destino.endereco);
      const p = await geocodificarEndereco(docData.destino.endereco);
      if (p && validarCoordenadas(p.lat, p.lng)) {
        console.log("[RESOLVE] ✓ Destino resolvido");
        setPinoDestino(p);
      }
    }
  }

  async function cancelarCorrida() {
    if (!corridaId) return;

    try {
      await db.collection('agendamentos').doc(corridaId).update({
        status: "cancelado_agendamento",
        canceladoPor: "cliente",
        canceladoEm: firebase.firestore.FieldValue.serverTimestamp(),
        canceladoPorUid: currentUser?.uid || null
      });

      await db.collection('agendamentos').doc(corridaId)
        .collection("sync").doc("estado").update({
          fase: "cancelada",
          cancelamento: {
            canceladoPor: "cliente",
            canceladoEm: firebase.firestore.FieldValue.serverTimestamp(),
            canceladoPorUid: currentUser?.uid || null
          }
        });

      if (cancelModal) cancelModal.style.display = "none";
          setTimeout(() => window.location.href = "homeC.html", 1000);

    } catch (error) {
      console.error("Erro ao cancelar:", error);
          }
  }

  async function hidratarMotorista(motoristaId, corridaData){
    let nome = corridaData?.motoristaNome || corridaData?.nomeMotorista || corridaData?.propostaAceita?.nomeMotorista || "—";
    let veiculoTxt = corridaData?.propostaAceita?.veiculo || corridaData?.tipoVeiculo || "";
    
    const uid = motoristaId || corridaData?.motoristaId || corridaData?.propostaAceita?.motoristaUid;
    motoristaUidAtual = uid;
    
    if (uid) {
      try {
        let snap = await db.collection("usuarios").doc(uid).get();
        if (!snap.exists) snap = await db.collection("motoristas").doc(uid).get();
        
        if (snap.exists) {
          const u = snap.data();
          nome = u.nome || u.dadosPessoais?.nome || nome;
          const v = u.veiculo || u.carro || {};
          const fat = [v.marca||"", v.modelo||"", v.cor||""].filter(Boolean).join(" ");
          const placa = v.placa || v.placaVeiculo || "";
          veiculoTxt = [fat, placa?`• ${placa}`:""].join(" ").trim() || veiculoTxt;
        }
      } catch (error) {
        console.warn("Erro ao hidratar motorista:", error);
      }
    }

    if (!veiculoTxt) veiculoTxt = corridaData?.tipoVeiculo || "—";
    
    if (nomeMotoristaEl) nomeMotoristaEl.textContent = nome || "—";
    if (carroEl) carroEl.textContent = veiculoTxt || "—";
  }

  function setMotorista(lat,lng){
    if (!validarCoordenadas(lat, lng)) return;
    
    const p = {lat: parseFloat(lat), lng: parseFloat(lng)}; 
    S.motorista = p;
    
    console.log("[MOTORISTA] Posição atualizada:", p);
    
    const icon = L.divIcon({ 
      className:"marker-motorista",
      html:`<div style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;background:#fff;border:3px solid #FF6C0C;border-radius:50%;box-shadow:0 0 10px rgba(0,0,0,.35)">
            <i class="fas fa-truck" style="color:#FF6C0C;font-size:14px;"></i></div>` 
    });
    
    if (!mkM) {
      mkM = L.marker([p.lat, p.lng], { icon }).addTo(map);
      console.log("[MOTORISTA] Marcador criado no mapa");
    } else {
      mkM.setLatLng([p.lat, p.lng]);
    }

    const now = Date.now();
    if (now - lastRouteDrawTs > 3000) { 
      lastRouteDrawTs = now;
      redesenhar();
    }
  }
  
  function setPinoOrigem(p){ 
    if (!validarCoordenadas(p.lat, p.lng)) return;
    
    const coords = {lat: parseFloat(p.lat), lng: parseFloat(p.lng)};
    S.origem = coords;
    
    console.log("[ORIGEM] Pino definido:", coords);
    
    const iconHtml = `<div style="width:24px;height:24px;background:#1E3A8A;border:3px solid #fff;border-radius:50%;"></div>`;
    
    if(!mkO) {
      mkO = L.marker([coords.lat, coords.lng],{
        icon:L.divIcon({
          className:"marker-origem",
          html: iconHtml
        })
      }).addTo(map);
    } else {
      mkO.setLatLng([coords.lat, coords.lng]); 
    }
  }

  function setPinoDestino(p){ 
    if (!validarCoordenadas(p.lat, p.lng)) return;
    
    const coords = {lat: parseFloat(p.lat), lng: parseFloat(p.lng)};
    S.destino = coords;
    
    console.log("[DESTINO] Pino definido:", coords);
    
    const iconHtml = `<div style="width:24px;height:24px;background:#FF6C0C;border:3px solid #fff;border-radius:50%;"></div>`;
    
    if(!mkD) {
      mkD = L.marker([coords.lat, coords.lng],{
        icon:L.divIcon({
          className:"marker-destino",
          html: iconHtml
        })
      }).addTo(map);
    } else {
      mkD.setLatLng([coords.lat, coords.lng]); 
    }
  }
  
  function atualizarPainel(durationSec, distanceM){
    console.log("[PAINEL] Atualizando - Distância:", distanceM, "m | Duração:", durationSec, "s");
    definirTexto(["estimated-time","tempoInfo","tempoPrevisto","tempo"], min(durationSec));
    definirTexto(["distanciaInfo","estimated-distance","distPrevista","distancia"], km(distanceM));
  }
  
  async function desenharRota(from,to){
    if(!from||!to) {
      console.warn("[ROTA] Coordenadas ausentes");
      return;
    }
    
    if(!validarCoordenadas(from.lat,from.lng)||!validarCoordenadas(to.lat,to.lng)) {
      console.warn("[ROTA] Coordenadas inválidas:", from, to);
      return;
    }
    
    console.log("[ROTA] Desenhando de", from, "para", to);
    
    const url=`https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&steps=true`;
    
    try {
      const r=await fetch(url); 
      if(!r.ok) {
        console.error("[ROTA] Erro HTTP:", r.status);
        return;
      }
      
      const j=await r.json(); 
      const route=j.routes?.[0]; 
      
      if(!route) {
        console.error("[ROTA] Nenhuma rota encontrada");
        return;
      }
      
      const latlngs=route.geometry.coordinates.map(([lng,lat])=>[lat,lng]);
      
      if(routeLayer) map.removeLayer(routeLayer);
      
      routeLayer=L.polyline(latlngs,{ color:"#ff6c0c", weight:6, opacity:.95 }).addTo(map);
      map.fitBounds(L.latLngBounds(latlngs), { padding:[40,40] });
      fitted=true; 
      
      console.log("[ROTA] ✓ Rota desenhada - Distância:", route.distance, "m");
      
      atualizarPainel(route.duration, route.distance);
      
    } catch (error) {
      console.error("[ROTA] Erro:", error);
    }
  }
  
  function ajustarMapa(){
    if (fitted) return;
    
    const pts=[]; 
    if(S.motorista) pts.push([S.motorista.lat,S.motorista.lng]);
    if(S.origem) pts.push([S.origem.lat,S.origem.lng]); 
    if(S.destino) pts.push([S.destino.lat,S.destino.lng]);
    
    if(pts.length){ 
      map.fitBounds(L.latLngBounds(pts), { padding:[40,40] }); 
      fitted=true; 
    } else { 
      map.fitBounds(SP_BOUNDS); 
    }
  }

  function atualizarVisibilidadeBotaoCancelar(fase) {
    if (cancelBtn) {
      if (fase === "a_caminho_destino" || fase === "finalizada_pendente" || fase === "cancelada" || fase === "finalizada") {
        cancelBtn.style.display = "none";
      } else {
        cancelBtn.style.display = "block";
      }
    }
  }

  function updateTimeline(fase){
    const ids={
      aceito:"timeline-accepted",
      indo_retirar:"timeline-pickup",
      a_caminho_destino:"timeline-destination",
      finalizada_pendente:"timeline-completed"
    };
    
    const el=(k)=>$(k);
    Object.values(ids).forEach(id=>el(id)?.classList.remove("active","completed"));
    
    const pickupEl = el(ids.indo_retirar)?.querySelector('h4');
    const destEl = el(ids.a_caminho_destino)?.querySelector('h4');
    const completedEl = el(ids.finalizada_pendente)?.querySelector('h4');
    
    if (pickupEl) pickupEl.textContent = "A caminho da coleta";
    if (destEl) destEl.textContent = "A caminho do destino";
    if (completedEl) completedEl.textContent = "Entrega finalizada";
    
    el(ids.aceito)?.classList.add("completed");
    
    if(fase==="indo_retirar") el(ids.indo_retirar)?.classList.add("active");
    
    if(fase==="a_caminho_destino"){ 
      el(ids.indo_retirar)?.classList.add("completed"); 
      el(ids.a_caminho_destino)?.classList.add("active"); 
    }
    
    if(fase==="finalizada_pendente"){
      el(ids.indo_retirar)?.classList.add("completed");
      el(ids.a_caminho_destino)?.classList.add("completed");
      el(ids.finalizada_pendente)?.classList.add("active");
      ensureChegouButton();
    }

    atualizarVisibilidadeBotaoCancelar(fase);
  }

  function redesenhar(){
    console.log("[REDESENHAR] Fase:", S.fase, "| Motorista:", !!S.motorista, "| Origem:", !!S.origem, "| Destino:", !!S.destino);
    
    if (S.fase==="indo_retirar" && S.motorista && S.origem && 
        validarCoordenadas(S.motorista.lat, S.motorista.lng) && 
        validarCoordenadas(S.origem.lat, S.origem.lng)) {
      console.log("[REDESENHAR] Traçando rota: Motorista -> Origem");
      desenharRota(S.motorista, S.origem);
      return; 
    }
    
    if (S.fase==="a_caminho_destino" && S.origem && S.destino &&
        validarCoordenadas(S.origem.lat, S.origem.lng) && 
        validarCoordenadas(S.destino.lat, S.destino.lng)) {
      console.log("[REDESENHAR] Traçando rota: Origem -> Destino");
      desenharRota(S.origem, S.destino);
      return; 
    }

    ajustarMapa();
  }

  async function processarDadosDocumento(docData) {
    C = docData;
    
    console.log("[PROCESSAR] Dados do documento:", docData);
    
    if (docData.origem) {
      if (validarCoordenadas(docData.origem.lat, docData.origem.lng)) {
        setPinoOrigem(docData.origem);
      }
      definirTexto(["origem-address","origemInfo"], docData.origem.endereco || "—");
    }
    
    if (docData.destino) {
      if (validarCoordenadas(docData.destino.lat, docData.destino.lng)) {
        setPinoDestino(docData.destino);
      }
      definirTexto(["destino-address","destinoInfo"], docData.destino.endereco || "—");
    }
    
    if ((!S.origem || !S.destino) && (docData.origem?.endereco || docData.destino?.endereco)) {
      await resolveAndSetPinos(docData);
    }
    
    redesenhar();
  }

  async function pickCorridaId(uid){
    const qs=new URLSearchParams(location.search);
    const fromQS=qs.get("corrida")||qs.get("corridaId")||qs.get("id");
    const fromLS=localStorage.getItem("ultimaCorridaCliente");
    
    const candIds=[];
    if(fromQS) candIds.push({id: fromQS});
    if(fromLS) candIds.push({id: fromLS});
    
    try{ 
      const qAg=await db.collection("agendamentos")
        .where("clienteId","==",uid)
        .where("status","in",["agendamento_confirmado","corrida_agendamento_confirmado","indo_retirar","a_caminho_destino"])
        .orderBy("confirmadoEm","desc")
        .limit(10)
        .get(); 
      qAg.forEach(d=>candIds.push({id: d.id})); 
    }catch(error){
      console.warn('Erro ao buscar agendamentos:', error);
    }
    
    const seen=new Set(); 
    const candidates=candIds.filter(item=>!seen.has(item.id)&&seen.add(item.id));
    if(!candidates.length) return null;

    const now = firebase.firestore.Timestamp.now().seconds;
    
    for(const candidate of candidates){
      try{
        const docSnap = await db.collection("agendamentos").doc(candidate.id).get();
        const syncSnap = await db.collection("agendamentos").doc(candidate.id).collection("sync").doc("estado").get();
        
        const docData = docSnap.exists ? docSnap.data() : {};
        const syncData = syncSnap.exists ? syncSnap.data() : {};
        
        const m = syncData?.motorista;
        const fresh = m?.ts?.seconds ? (now - m.ts.seconds) <= 1800 : true;
        const ativa = ATIVAS.has(docData?.status) || ATIVAS.has(syncData?.fase);
        
        if (ativa && fresh) {
          return { id: candidate.id };
        }
      } catch(error) {
        console.warn(`Erro ao verificar candidato ${candidate.id}:`, error);
      }
    }
    
    if (candidates[0]) {
      try {
        const docSnap = await db.collection("agendamentos").doc(candidates[0].id).get();
        if (docSnap.exists) {
          return { id: candidates[0].id };
        }
      } catch (error) {
        console.warn('Erro ao processar primeiro candidato:', error);
      }
    }
    
    return null;
  }

  async function attachCorrida(corridaData){
    if (!corridaData || corridaData.id === currentCorridaId) return;

    try { unsubCorrida(); } catch {}
    try { unsubSync(); } catch {}

    currentCorridaId = corridaData.id;
    corridaId = corridaData.id;
    
    console.log("[ATTACH] Anexando agendamento:", corridaId);
    
    if (window.CHAT && window.CHAT.attach) window.CHAT.attach(corridaId);
    localStorage.setItem("ultimaCorridaCliente", corridaId);

    if (history.replaceState) {
      const url = `statusA.html?corrida=${encodeURIComponent(corridaId)}`;
      history.replaceState(null, "", url);
    }

    fitted = false;
    if(routeLayer){ map.removeLayer(routeLayer); routeLayer=null; }

    const docRef = db.collection('agendamentos').doc(corridaId);
    docRefGlobal = docRef;
    const syncRef = db.collection('agendamentos').doc(corridaId).collection("sync").doc("estado");

    const [docSnap, sSnap] = await Promise.all([docRef.get(), syncRef.get()]);
    
    if(docSnap.exists){
      const docData = docSnap.data() || {};
      
      try {
        if ((!docData.clienteId || typeof docData.clienteId !== 'string' || !docData.clienteId.trim()) && currentUser?.uid) {
          await docRef.set({ clienteId: currentUser.uid }, { merge: true });
        }
        
        const motoristaUidDoc = docData.propostaAceita?.motoristaUid || docData.motoristaUid || null;
        if (currentUser?.uid && docData.motoristaId === currentUser.uid && motoristaUidDoc && motoristaUidDoc !== currentUser.uid) {
          await docRef.set({ motoristaId: motoristaUidDoc }, { merge: true });
        }
      } catch (e) { console.warn("Falha ao preencher clienteId:", e?.message || e); }

      await processarDadosDocumento({ ...docData, clienteId: docData.clienteId || currentUser?.uid });
      await hidratarMotorista(C?.motoristaId || C?.propostaAceita?.motoristaUid, C);
    }
    
    if(sSnap.exists){
      const s=sSnap.data()||{};
      
      if(s.fase) {
        S.fase = s.fase;
        console.log("[SYNC] Fase inicial:", S.fase);
      }
      
      if(s.motorista && validarCoordenadas(s.motorista.lat, s.motorista.lng)) {
        console.log("[SYNC] Posição inicial do motorista:", s.motorista);
        setMotorista(s.motorista.lat, s.motorista.lng);
      }
      
      if (typeof s.etaMin === "number") definirTexto(["estimated-time","tempoInfo","tempoPrevisto","tempo"], `${Math.max(1, Math.round(s.etaMin))} min`);
      if (typeof s.distanciaM === "number") definirTexto(["distanciaInfo","estimated-distance","distPrevista","distancia"], km(s.distanciaM));
      
      updateTimeline(S.fase);
    }
    
    redesenhar();

    unsubCorrida = docRef.onSnapshot(async doc=>{
      if(!doc.exists) return;
      
      const docData = doc.data()||{};
      
      try {
        if ((!docData.clienteId || typeof docData.clienteId !== 'string' || !docData.clienteId.trim()) && currentUser?.uid) {
          await docRef.set({ clienteId: currentUser.uid }, { merge: true });
        }
        const motoristaUidDoc = docData.propostaAceita?.motoristaUid || docData.motoristaUid || null;
        if (currentUser?.uid && docData.motoristaId === currentUser.uid && motoristaUidDoc && motoristaUidDoc !== currentUser.uid) {
          await docRef.set({ motoristaId: motoristaUidDoc }, { merge: true });
        }
      } catch (e) { console.warn("Falha ao preencher clienteId no update:", e?.message || e); }
      
      await processarDadosDocumento(docData);
      await hidratarMotorista(C?.motoristaId || C?.propostaAceita?.motoristaUid, C);
      redesenhar();
    });

    unsubSync = syncRef.onSnapshot(s=>{
      const d=s.data()||{};
      
      console.log("[SYNC UPDATE]", d);
      
      let needsRedraw = false;
      
      if(d.fase && d.fase !== S.fase) {
        console.log("[SYNC] Mudança de fase:", S.fase, "->", d.fase);
        S.fase = d.fase;
        needsRedraw = true;
      }
      
      if(d.motorista && validarCoordenadas(d.motorista.lat, d.motorista.lng)) {
        const newLat = parseFloat(d.motorista.lat);
        const newLng = parseFloat(d.motorista.lng);
        
        console.log("[SYNC] Nova posição do motorista:", { lat: newLat, lng: newLng });
        
        if (!S.motorista || S.motorista.lat !== newLat || S.motorista.lng !== newLng) {
          setMotorista(newLat, newLng);
          needsRedraw = true;
        }
      }
      
      if (typeof d.etaMin === "number") definirTexto(["estimated-time","tempoInfo","tempoPrevisto","tempo"], `${Math.max(1, Math.round(d.etaMin))} min`);
      if (typeof d.distanciaM === "number") definirTexto(["distanciaInfo","estimated-distance","distPrevista","distancia"], km(d.distanciaM));
      
      if (d.fase === "cancelada" || d.cancelamento) {
          localStorage.removeItem("ultimaCorridaCliente");
        window.location.href = "homeC.html";
        return;
      }
      
      updateTimeline(S.fase);
      
      if (needsRedraw) {
        redesenhar();
      }
    });
  }

  function watchActiveCorridaCliente(uid){
    db.collection("agendamentos")
      .where("clienteId","==", uid)
      .where("status","in",["agendamento_confirmado","corrida_agendamento_confirmado","indo_retirar","a_caminho_destino"])
      .orderBy("confirmadoEm","desc")
      .limit(5)
      .onSnapshot((snap)=>{
        const doc = snap.docs[0];
        if (!doc) return;
        const c = doc.data()||{};
        if (c.status === "finalizada" || c.status === "cancelada") return;
        if (doc.id !== currentCorridaId && ATIVAS.has(c.status)) {
          attachCorrida({ id: doc.id });
        }
      }, (error) => {
        console.warn("Erro no watcher de agendamentos:", error);
      });
  }

  function abrirModalAvaliacao(){
    const modal = pegarEl("driver-rating-modal","user-rating-modal");
    if (!modal) return;
    
    const mName = $("modal-driver-name");
    const mCar  = $("modal-vehicle-info");
    if (mName) mName.textContent = nomeMotoristaEl?.textContent || "—";
    if (mCar)  mCar.textContent  = carroEl?.textContent || "—";

    const stars = modal.querySelectorAll(".rating-stars .star");
    let nota = 0;
    
    stars.forEach((s)=>{ 
      s.onclick = ()=>{ 
        nota = Number.parseInt(s.dataset.rating||"0",10);
        stars.forEach((x)=> Number(x.dataset.rating)<=nota ? x.classList.add("active") : x.classList.remove("active")); 
      }; 
    });

    const closeBtn = $("close-driver-modal"); 
    if (closeBtn) closeBtn.onclick = ()=> modal.style.display="none";
    
    const enviar = $("submit-driver-rating");
    const comentario = $("driver-rating-comment");
    
    if (enviar) {
      enviar.onclick = async ()=>{
        if (nota === 0) {
          alert("Por favor, selecione uma avaliação.");
          return;
        }
        
        try {
          await salvarAvaliacaoMotorista(
            C?.motoristaId || C?.propostaAceita?.motoristaUid,
            nota,
            comentario?.value||"",
            corridaId,
            currentUser?.uid
          );
          
          modal.style.display="none";
          
          window.location.href = "homeC.html";
          
        } catch (error) {
          console.error("Erro ao enviar avaliação:", error);
          
        }
      };
    }
    
    modal.style.display = "flex";
  }
  
  function ensureChegouButton(){
    let b = $("btnChegou");
    if (!b) {
      b = document.createElement("button");
      b.id="btnChegou"; 
      b.textContent = "Motorista chegou";
      b.className="track-btn destaque-chegada";
      document.querySelector(".ride-status")?.appendChild(b);
    }
    b.onclick = abrirModalAvaliacao;
  }

  (function injetarCss(){
    if (document.getElementById("css-destaque-chegada")) return;
    const st=document.createElement("style"); 
    st.id="css-destaque-chegada";
    st.textContent=`.destaque-chegada{display:block;margin:28px auto;padding:18px 38px;width:clamp(260px,55%,560px);
    font-size:20px;font-weight:800;text-transform:uppercase;letter-spacing:.3px;color:#fff;background:#ff6c0c;border:0;border-radius:16px;
    box-shadow:0 10px 24px rgba(255,108,12,.35),0 0 0 10px rgba(255,108,12,.18);cursor:pointer;animation:pulse-chegou 1.6s ease-in-out infinite;}
    .destaque-chegada:hover{transform:translateY(-1px);box-shadow:0 14px 28px rgba(255,108,12,.4),0 0 0 12px rgba(255,108,12,.22)}
    @keyframes pulse-chegou{0%{box-shadow:0 10px 24px rgba(255,108,12,.35),0 0 0 8px rgba(255,108,12,.18)}70%{box-shadow:0 10px 24px rgba(255,108,12,.35),0 0 0 16px rgba(255,108,12,0)}100%{box-shadow:0 10px 24px rgba(255,108,12,.35),0 0 0 8px rgba(255,108,12,.18)}}
    .modal .star{font-size:28px;color:#d0d0d0;cursor:pointer;transition:transform .12s}
    .modal .star.active,.modal .star:hover{color:#ffb400;transform:scale(1.08)}`;
    document.head.appendChild(st);
  })();

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
    }

    const esc = (s) => (s || "").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
    const fmtHora = (ts) => {
      try { 
        const d = ts?.toDate ? ts.toDate() : new Date();
        return d.toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"});
      } catch { 
        return ""; 
      }
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
        ensureStyles();
        ensureModal();
        ensureButton();
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

        const ref = this._db.collection("agendamentos").doc(id).collection("chat").orderBy("ts","asc").limit(500);
        this._unsub = ref.onSnapshot((snap) => {
          const list = document.getElementById("mm-chat-list"); 
          if (!list) return;
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
        ensureStyles();
        ensureModal();
        if (!this._corridaId) this.attach(autodCorrida());
        document.getElementById("mm-chat-modal").style.display = "flex";
        setTimeout(() => document.getElementById("mm-chat-text").focus(), 0);
      },
      
      close() { 
        document.getElementById("mm-chat-modal").style.display = "none";
      },
      
      async send() {
        const txtEl = document.getElementById("mm-chat-text");
        const text = (txtEl.value || "").trim();
        if (!text || !this._corridaId) return;
        txtEl.value = "";
        await this._db.collection("agendamentos").doc(this._corridaId).collection("chat").add({
          text, 
          senderId: this._uid, 
          role: this._role, 
          ts: firebase.firestore.FieldValue.serverTimestamp()
        });
      }
    };

    window.CHAT = CHAT;

    firebase.auth().onAuthStateChanged(() => {
      const isCliente = /statusA\.html/i.test(location.pathname);
      CHAT.init(isCliente ? "cliente" : "motorista");
      const id = autodCorrida(); 
      if (id) CHAT.attach(id);
    });
  })();

  firebase.auth().onAuthStateChanged(async (user)=>{
    if(!user){ 
      alert("Faça login."); 
      return; 
    }
    
    currentUser = user;
    console.log("[AUTH] Usuário logado:", user.uid);

    const corridaData = await pickCorridaId(user.uid);
    if (corridaData) {
      await attachCorrida(corridaData);
    } else { 
      alert("Nenhum agendamento ativo encontrado."); 
      return; 
    }
    
    watchActiveCorridaCliente(user.uid);
  });
})()