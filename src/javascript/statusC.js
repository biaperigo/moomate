let currentCorridaId = null;
let unsubCorrida = () => {};
let unsubSync = () => {};

(() => {
  const { firebase, L } = window;
  if (!firebase || !firebase.apps.length) return;
  const db = firebase.firestore();

  // Limites SP 
  const SP_BOUNDS = L.latLngBounds([[-25.5, -53.5], [-19.5, -44.0]]);
  const inSP = (p) => p && p.lat >= -25.5 && p.lat <= -19.5 && p.lng >= -53.5 && p.lng <= -44.0;
  const ATIVAS = new Set(["aceito","aceita","pendente","em_andamento","indo_retirar","a_caminho_destino","finalizada_pendente"]);

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
  const dadosDoSnap = (s) => (s && s.exists ? s.data()||{} : {});

  const getEl = pegarEl;
  const setText = definirTexto;
  const snapToData = dadosDoSnap;

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

    // 1) Subcoleção do motorista
    await db.collection('motoristas').doc(uidMot)
      .collection('avaliacoes').doc(avId)
      .set({ nota: n, estrelas: n, comentario: comentario||"", corridaId, clienteUid, criadoEm: when }, { merge: true });

    // 2) Coleção global
    await db.collection('avaliacoes').doc(avId)
      .set({ nota: n, estrelas: n, comentario: comentario||"", corridaId, clienteUid, motoristaUid: uidMot, criadoEm: when }, { merge: true });

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

  const nomeMotoristaEl = getEl("nomeMotorista","motorista-nome","motoristaInfo","driver-name","driverName");
  const carroEl         = getEl("veiculoInfo","motorista-carro","carroInfo","vehicle-info","vehicleInfo");

  // Elementos do cancelamento
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
  const setupCancelHandlers = configurarHandlersCancelamento;
  configurarHandlersCancelamento();

  // Mapa 
  const map = L.map("map", { maxBounds: SP_BOUNDS, maxBoundsViscosity: 1.0 });
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{ attribution:" OpenStreetMap" }).addTo(map);
  map.fitBounds(SP_BOUNDS);

  let mkM=null, mkO=null, mkD=null, routeLayer=null, fitted=false;
  const S = { origem:null, destino:null, motorista:null, fase:"indo_retirar" };
  let C = {};
  let corridaId = null;
  let currentUser = null;
  let tipoAtual = null;
  let colecaoAtual = 'corridas';
  let unsubSyncExtra = () => {};
  let lastRouteDrawTs = 0;
  let lastRouteKey = null; 

  // Função p validar coordenadas 
  function validarCoordenadas(lat, lng) {
    if (lat === null || lng === null || lat === undefined || lng === undefined) {
      return false;
    }
    
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    
    if (isNaN(latNum) || isNaN(lngNum)) {
      return false;
    }
    
    if (latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
      return false;
    }
    
    return true;
  }

  async function geocodificarEndereco(endereco) {
    if (!endereco || typeof endereco !== 'string') return null;
    const controller = new AbortController();
    const id = setTimeout(()=>controller.abort(), 4000);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(endereco)}`;
      const resp = await fetch(url, { headers: { 'Accept-Language': 'pt-BR', 'User-Agent': 'MoomateApp/1.0' }, signal: controller.signal });
      clearTimeout(id);
      if (!resp.ok) return null;
      const arr = await resp.json();
      const hit = Array.isArray(arr) ? arr[0] : null;
      if (!hit) return null;
      const lat = parseFloat(hit.lat), lng = parseFloat(hit.lon);
      if (!validarCoordenadas(lat, lng)) return null;
      return { lat, lng };
    } catch { clearTimeout(id); return null; }
  }
  
  const geocodeEndereco = geocodificarEndereco;

  // Resolve e posiciona pinos quando faltarem coordenadas usando endereço do doc ou do sync
  async function resolveAndSetPinos(docData, syncData, isDescarteDoc) {
    try {
      // ORIGEM
      if (!S.origem) {
        const endO = docData?.origem?.endereco || docData?.localRetirada || syncData?.origem?.endereco || null;
        if (endO) {
          const p = await geocodeEndereco(endO);
          if (p) { setPinoOrigem(p, !!isDescarteDoc); }
        }
      }
      // DESTINO
      if (!S.destino) {
        const endD = docData?.destino?.endereco || docData?.localEntrega || syncData?.destino?.endereco || null;
        if (endD) {
          const p = await geocodeEndereco(endD);
          if (p) { setPinoDestino(p, !!isDescarteDoc); }
        }
      }
    } catch (e) {
      console.warn('Geocode fallback falhou:', e?.message || e);
    }
  }

  
  async function cancelarCorrida() {
    if (!corridaId) return;

    try {
      console.log(`Cancelando ${tipoAtual === 'descarte' ? 'descarte' : 'corrida'}: ${corridaId}`);
      
      // USAR A COLEÇÃO CORRETA
      const colecao = tipoAtual === 'descarte' ? 'descartes' : 'corridas';
      
      await db.collection(colecao).doc(corridaId).update({
        status: "cancelada",
        canceladoPor: "cliente",
        canceladoEm: firebase.firestore.FieldValue.serverTimestamp(),
        canceladoPorUid: currentUser?.uid || null
      });

      await db.collection(colecao).doc(corridaId)
        .collection("sync").doc("estado").update({
          fase: "cancelada",
          cancelamento: {
            canceladoPor: "cliente",
            canceladoEm: firebase.firestore.FieldValue.serverTimestamp(),
            canceladoPorUid: currentUser?.uid || null
          }
        });

      if (cancelModal) cancelModal.style.display = "none";
      alert(`${tipoAtual === 'descarte' ? 'Descarte' : 'Corrida'} cancelada com sucesso!`);
      setTimeout(() => window.location.href = "homeC.html", 1000);

    } catch (error) {
      console.error("Erro ao cancelar corrida:", error);
      alert("Erro ao cancelar. Tente novamente.");
    }
  }

  // Função para detectar se é descarte
  function isDescarte(docData) {
    return docData.tipo === 'descarte' || 
           docData.localRetirada || 
           docData.localEntrega ||
           docData.tipoCaminhao ||
           (docData.propostaAceita && docData.clienteId);
  }

  async function hidratarMotorista(motoristaId, corridaData){
    let nome = corridaData?.motoristaNome || corridaData?.nomeMotorista || "—";
    let veiculoTxt = corridaData?.veiculo?.modelo || corridaData?.carro?.modelo || "";
    
    const tryDoc = async (col, id) => { 
      if(!id) return null; 
      try{ 
        const d = await db.collection(col).doc(id).get(); 
        return d.exists ? d.data() : null; 
      } catch { 
        return null; 
      } 
    };
    
    const uid = motoristaId || corridaData?.motoristaId || corridaData?.propostaAceita?.motoristaUid;
    
    let u = await tryDoc("usuarios", uid);
    if (!u) u = await tryDoc("motoristas", uid);
    
    if (u) {
      nome = u.nome || u.dadosPessoais?.nome || nome;
      const v = u.veiculo || u.carro || {};
      const fat = [v.marca||"", v.modelo||"", v.cor||""].filter(Boolean).join(" ");
      const placa = v.placa || v.placaVeiculo || "";
      veiculoTxt = [fat, placa?`• ${placa}`:""].join(" ").trim() || veiculoTxt;
    }

    if (!veiculoTxt) {
      const isDescarteDoc = tipoAtual === 'descarte';
      veiculoTxt = isDescarteDoc ? 
        (corridaData?.tipoCaminhao || corridaData?.tipoVeiculo || "Caminhão") :
        (corridaData?.veiculo || corridaData?.tipoVeiculo || "—");
    }
    
    if (nomeMotoristaEl) nomeMotoristaEl.textContent = nome || "—";
    if (carroEl) carroEl.textContent = veiculoTxt || "—";
  }

  function setMotorista(lat,lng){
    if (!validarCoordenadas(lat, lng)) {
      console.warn("Coordenadas inválidas para motorista:", {lat, lng});
      return;
    }
    
    const p = {lat: parseFloat(lat), lng: parseFloat(lng)}; 
    S.motorista = p;
    console.log("✅ Posição do motorista atualizada:", p);
    
    const icon = L.divIcon({ 
      className:"marker-motorista",
      html:`<div style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;background:#fff;border:3px solid #FF6C0C;border-radius:50%;box-shadow:0 0 10px rgba(0,0,0,.35)">
            <i class="fas fa-truck" style="color:#FF6C0C;font-size:14px;"></i></div>` 
    });
    
    if (!mkM) mkM = L.marker([p.lat, p.lng], { icon }).addTo(map); 
    else mkM.setLatLng([p.lat, p.lng]);

    try {
      const now = Date.now();
      if (now - lastRouteDrawTs > 3000) { 
        if (S.fase === 'indo_retirar' && S.origem && validarCoordenadas(S.origem.lat, S.origem.lng)) {
          lastRouteDrawTs = now;
          drawIfNew(S.motorista, S.origem, 'M->O');
        } else if (S.fase === 'a_caminho_destino' && S.origem && S.destino &&
                   validarCoordenadas(S.origem.lat, S.origem.lng) && validarCoordenadas(S.destino.lat, S.destino.lng)) {
          lastRouteDrawTs = now;
          drawIfNew(S.origem, S.destino, 'O->D');
        }
      }
    } catch (e) {
      console.warn('Falha ao forçar desenho de rota após atualizar motorista:', e?.message || e);
    }
  }

  function desenharSeNovo(from, to, key){
    try {
      if (!from || !to) return;
      if (lastRouteKey === key) {
        return;
      }
      lastRouteKey = key;
      desenharRota(from, to);
    } catch(e){
      console.warn('drawIfNew falhou:', e?.message || e);
    }
  }
  const drawIfNew = desenharSeNovo;
  
  function setPinoOrigem(p, isDescarteDoc = false){ 
    if (!validarCoordenadas(p.lat, p.lng)) {
      console.warn("Coordenadas inválidas para origem:", p);
      return;
    }
    
    const coords = {lat: parseFloat(p.lat), lng: parseFloat(p.lng)};
    S.origem = coords;
    console.log("✅ Origem definida:", coords);
    
    const iconHtml = `<div style="width:24px;height:24px;background:#1E3A8A;border:3px solid #fff;border-radius:50%;"></div>`
    
    if(!mkO) mkO = L.marker([coords.lat, coords.lng],{
      icon:L.divIcon({
        className:"marker-origem",
        html: iconHtml
      })
    }).addTo(map);
    else mkO.setLatLng([coords.lat, coords.lng]); 
  }

  function setPinoDestino(p, isDescarteDoc = false){ 
    if (!validarCoordenadas(p.lat, p.lng)) {
      console.warn("Coordenadas inválidas para destino:", p);
      return;
    }
    
    const coords = {lat: parseFloat(p.lat), lng: parseFloat(p.lng)};
    S.destino = coords;
    console.log("✅ Destino definido:", coords);
    
    // p descartes, usar marcador redondo laranja com símbolo de reciclagem
    const iconHtml = isDescarteDoc ?
      `<div style="width:24px;height:24px;background:#FF6C0C;border:3px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;">
        <i class="fa-solid fa-recycle" style="font-size:13px;color:#fff;"></i>
      </div>` :
      `<div style="width:24px;height:24px;background:#FF6C0C;border:3px solid #fff;border-radius:50%;"></div>`
    
    if(!mkD) mkD = L.marker([coords.lat, coords.lng],{
      icon:L.divIcon({
        className:"marker-destino",
        html: iconHtml
      })
    }).addTo(map);
    else mkD.setLatLng([coords.lat, coords.lng]); 
  }
  
  function atualizarPainel(durationSec, distanceM){
    setText(["estimated-time","tempoInfo","tempoPrevisto","tempo"], min(durationSec));
    setText(["distanciaInfo","estimated-distance","distPrevista","distancia"], km(distanceM));
  }
  
  async function desenharRota(from,to){
    if(!from||!to||!validarCoordenadas(from.lat,from.lng)||!validarCoordenadas(to.lat,to.lng)) {
      console.warn("Coordenadas inválidas para desenhar rota:", {from, to});
      return;
    }
    
    const url=`https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&steps=true`;
    console.log(" Desenhando rota:", from, "→", to);
    
    try {
      const r=await fetch(url); 
      if(!r.ok) {
        console.error("Erro na API de rotas:", r.status, r.statusText);
        return;
      }
      
      const j=await r.json(); 
      const route=j.routes?.[0]; 
      if(!route) {
        console.error("Nenhuma rota encontrada");
        return;
      }
      
      const latlngs=route.geometry.coordinates.map(([lng,lat])=>[lat,lng]);
      if(routeLayer) map.removeLayer(routeLayer);
      routeLayer=L.polyline(latlngs,{ color:"#ff6c0c", weight:6, opacity:.95 }).addTo(map);
      map.fitBounds(L.latLngBounds(latlngs), { padding:[40,40] });
      fitted=true; 
      atualizarPainel(route.duration, route.distance);
      console.log(" Rota desenhada com sucesso");
    } catch (error) {
      console.error("Erro ao desenhar rota:", error);
    }
  }
  const drawRoute = desenharRota;
  
  function ajustarMapa(){
    if (fitted) return;
    const pts=[]; 
    if(S.motorista) pts.push([S.motorista.lat,S.motorista.lng]);
    if(S.origem) pts.push([S.origem.lat,S.origem.lng]); 
    if(S.destino) pts.push([S.destino.lat,S.destino.lng]);
    if(pts.length){ 
      map.fitBounds(L.latLngBounds(pts), { padding:[40,40] }); 
      fitted=true; 
      console.log(" Mapa ajustado aos pontos");
    } else { 
      map.fitBounds(SP_BOUNDS); 
      console.log(" Mapa ajustado aos limites de SP");
    }
  }
  const fitOnce = ajustarMapa;

  function atualizarVisibilidadeBotaoCancelar(fase) {
    if (cancelBtn) {
      if (fase === "a_caminho_destino" || fase === "finalizada_pendente" || fase === "cancelada" || fase === "finalizada") {
        cancelBtn.style.display = "none";
      } else {
        cancelBtn.style.display = "block";
      }
    }
  }
  const updateCancelButtonVisibility = atualizarVisibilidadeBotaoCancelar;

  function updateTimeline(fase){
    const ids={
      aceito:"timeline-accepted",
      indo_retirar:"timeline-pickup",
      a_caminho_destino:"timeline-destination",
      finalizada_pendente:"timeline-completed"
    };
    
    const el=(k)=>$(k);
    Object.values(ids).forEach(id=>el(id)?.classList.remove("active","completed"));
    
    const isDescarteDoc = tipoAtual === 'descarte';
    const pickupEl = el(ids.indo_retirar)?.querySelector('h4');
    const destEl = el(ids.a_caminho_destino)?.querySelector('h4');
    const completedEl = el(ids.finalizada_pendente)?.querySelector('h4');
    
    if (pickupEl) pickupEl.textContent = isDescarteDoc ? "A caminho da coleta" : "A caminho da coleta";
    if (destEl) destEl.textContent = isDescarteDoc ? "A caminho do ecoponto" : "A caminho do destino";
    if (completedEl) completedEl.textContent = isDescarteDoc ? "Descarte finalizado" : "Entrega finalizada";
    
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

    updateCancelButtonVisibility(fase);
  }

  function redesenhar(){
    console.log(" Redesenho - Fase:", S.fase, "Motorista:", S.motorista, "Origem:", S.origem, "Destino:", S.destino);
    
    if (S.fase==="indo_retirar" && S.motorista && S.origem) { 
      console.log(" Desenhando rota: motorista → origem");
      drawIfNew(S.motorista, S.origem, 'M->O'); 
      return; 
    }
    
    if (S.fase==="a_caminho_destino" && S.origem && S.destino) { 
      console.log(" Desenhando rota: origem → destino");
      drawIfNew(S.origem, S.destino, 'O->D'); 
      return; 
    }
    
    if (S.fase === 'indo_retirar' && S.origem && S.destino &&
        validarCoordenadas(S.origem.lat, S.origem.lng) && validarCoordenadas(S.destino.lat, S.destino.lng)) {
      console.log(" Sem posição do motorista na fase 'indo_retirar': desenhando provisoriamente origem → destino até receber a posição do motorista.");
      drawIfNew(S.origem, S.destino, 'F:O->D');
      return;
    }

    console.log(" Ajustando mapa");
    ajustarMapa();
  }
  const redraw = redesenhar;

  
  function garantirRotaInicial() {
    try {
     
      if (S.fase === 'indo_retirar' && S.motorista && S.origem && validarCoordenadas(S.origem.lat, S.origem.lng)) {
        drawIfNew(S.motorista, S.origem, 'M->O');
        return;
      }
      
      if (S.fase === 'a_caminho_destino' && S.origem && S.destino &&
          validarCoordenadas(S.origem.lat, S.origem.lng) && validarCoordenadas(S.destino.lat, S.destino.lng)) {
        drawIfNew(S.origem, S.destino, 'O->D');
        return;
      }
      
      if (S.origem && S.destino && validarCoordenadas(S.origem.lat, S.origem.lng) && validarCoordenadas(S.destino.lat, S.destino.lng)) {

        console.log(" Rota inicial: usando desenho provisório origem → destino (motorista ainda indisponível)");
        drawIfNew(S.origem, S.destino, 'F:O->D');
        return;
      }
    
      ajustarMapa();
    } catch (e) {
      console.warn('ensureInitialRoute falhou:', e?.message || e);
    }
  }
  const ensureInitialRoute = garantirRotaInicial;

  async function processarDadosDocumento(docData) {
  console.log(" Processando dados do documento:", docData);
  
  tipoAtual = isDescarte(docData) ? 'descarte' : 'mudanca';
  C = docData;
  
  console.log(` Tipo detectado: ${tipoAtual}`);
  
  const isDescarteDoc = tipoAtual === 'descarte';
  
  console.log(" DEBUG - Objeto origem completo:", docData.origem);
  if (docData.origem) {
    console.log(" DEBUG - origem.lat:", docData.origem.lat, "tipo:", typeof docData.origem.lat);
    console.log(" DEBUG - origem.lng:", docData.origem.lng, "tipo:", typeof docData.origem.lng);
    console.log(" DEBUG - origem.endereco:", docData.origem.endereco);
    console.log(" DEBUG - Validação coordenadas:", validarCoordenadas(docData.origem.lat, docData.origem.lng));
  }
  
  console.log(" DEBUG - Objeto destino completo:", docData.destino);
  if (docData.destino) {
    console.log(" DEBUG - destino.lat:", docData.destino.lat, "tipo:", typeof docData.destino.lat);
    console.log(" DEBUG - destino.lng:", docData.destino.lng, "tipo:", typeof docData.destino.lng);
    console.log(" DEBUG - destino.endereco:", docData.destino.endereco);
    console.log(" DEBUG - Validação coordenadas:", validarCoordenadas(docData.destino.lat, docData.destino.lng));
  }
  
  if (docData.origem && validarCoordenadas(docData.origem.lat, docData.origem.lng)) {
    console.log(" Origem com coordenadas válidas:", docData.origem);
    setPinoOrigem(docData.origem, isDescarteDoc);
    setText(["origem-address","origemInfo"], docData.origem.endereco || "—");
  } else {
    console.warn(" Origem sem coordenadas válidas, aguardando rotaM processar...");
    const enderecoOrigem = isDescarteDoc ? 
      (docData.localRetirada || docData.origem?.endereco || "—") :
      (docData.origem?.endereco || "—");
    setText(["origem-address","origemInfo"], enderecoOrigem);
  }
  
  if (docData.destino && validarCoordenadas(docData.destino.lat, docData.destino.lng)) {
    console.log(" Destino com coordenadas válidas:", docData.destino);
    setPinoDestino(docData.destino, isDescarteDoc);
    setText(["destino-address","destinoInfo"], docData.destino.endereco || "—");
  } else {
    console.warn(" Destino sem coordenadas válidas, aguardando rotaM processar...");
    const enderecoDestino = isDescarteDoc ? 
      (docData.localEntrega || docData.destino?.endereco || "—") :
      (docData.destino?.endereco || "—");
    setText(["destino-address","destinoInfo"], enderecoDestino);
  }
  
  if (!S.origem || !S.destino) {
    await resolveAndSetPinos(docData, null, isDescarteDoc);
  }
  try {
    if (tipoAtual === 'descarte' && (!S.origem || !S.destino)) {
      const outraColecao = colecaoAtual === 'descartes' ? 'corridas' : 'descartes';
      const ref = db.collection(outraColecao).doc(corridaId);
      const snap = await ref.get();
      if (snap.exists) {
        const espelho = snap.data() || {};
        if (!S.origem && espelho.origem && validarCoordenadas(espelho.origem.lat, espelho.origem.lng)) {
          setPinoOrigem(espelho.origem, true);
        }
        if (!S.destino && espelho.destino && validarCoordenadas(espelho.destino.lat, espelho.destino.lng)) {
          setPinoDestino(espelho.destino, true);
        }
      }
    }
  } catch (e) {
    console.warn('Falha ao buscar doc espelho para coordenadas:', e?.message || e);
  }

  console.log(" Estado após processamento:", {origem: S.origem, destino: S.destino, motorista: S.motorista});
  
  if (tipoAtual === 'descarte' && colecaoAtual === 'corridas' && (!S.origem || !S.destino)) {
    try {
      const ref = db.collection('descartes').doc(corridaId);
      const snap = await ref.get();
      if (snap.exists) {
        const espelho = snap.data() || {};
        if (!S.origem && espelho.origem && validarCoordenadas(espelho.origem.lat, espelho.origem.lng)) {
          setPinoOrigem(espelho.origem, true);
        }
        if (!S.destino && espelho.destino && validarCoordenadas(espelho.destino.lat, espelho.destino.lng)) {
          setPinoDestino(espelho.destino, true);
        }
      }
    } catch (e) {
      console.warn('Falha ao buscar doc espelho para coordenadas:', e?.message || e);
    }
  }

  // Redesenhar dps d processar todos os dados
  redraw();
}

  // Buscar corrida ativa
async function pickCorridaId(uid){
  console.log(" Buscando corrida ativa para UID:", uid);
  
  const qs=new URLSearchParams(location.search);
  const fromQS=qs.get("corrida")||qs.get("corridaId")||qs.get("id");
  const fromLS=localStorage.getItem("ultimaCorridaCliente")||localStorage.getItem("ultimaCorridaMotorista")||localStorage.getItem("corridaSelecionada");
  
  const candIds=[];
  if(fromQS) candIds.push({id: fromQS, fonte: 'url'});
  if(fromLS) candIds.push({id: fromLS, fonte: 'localStorage'});
  
  // BUSCAR NA COLEÇÃO CORRIDAS
  try{ 
    const q1=await db.collection("corridas")
      .where("clienteId","==",uid)
      .orderBy("criadoEm","desc")
      .limit(10)
      .get(); 
    q1.forEach(d=>candIds.push({id: d.id, fonte: 'corridas'})); 
  }catch(error){
    console.warn(' Erro ao buscar corridas do cliente:', error);
  }
  
  // BUSCAR NA COLEÇÃO DESCARTES 
  try{ 
    const q2=await db.collection("descartes")
      .where("clienteId","==",uid)
      .orderBy("dataEnvio","desc")
      .limit(10)
      .get(); 
    q2.forEach(d=>candIds.push({id: d.id, fonte: 'descartes'})); 
  }catch(error){
    console.warn(' Erro ao buscar descartes do cliente:', error);
  }
  
  // BUSCAR CORRIDAS GERAIS
  try{ 
    const q3=await db.collection("corridas")
      .orderBy("criadoEm","desc")
      .limit(20)
      .get(); 
    q3.forEach(d=>candIds.push({id: d.id, fonte: 'corridas_geral'})); 
  }catch(error){
    console.warn(' Erro ao buscar corridas gerais:', error);
  }
  
  const seen=new Set(); 
  const candidates=candIds.filter(item=>!seen.has(item.id)&&seen.add(item.id));
  if(!candidates.length) {
    console.log(" Nenhum candidato encontrado");
    return null;
  }

  console.log(' Candidatos encontrados:', candidates);
  const now = firebase.firestore.Timestamp.now().seconds;
  
  for(const candidate of candidates){
    try{
      console.log(` Verificando candidato: ${candidate.id}`);
      
      let docSnap, syncSnap;
      
      // VERIFICAR NA COLEÇÃO CORRETA
      if (candidate.fonte === 'descartes') {
        docSnap = await db.collection("descartes").doc(candidate.id).get();
        syncSnap = await db.collection("descartes").doc(candidate.id).collection("sync").doc("estado").get();
      } else {
        docSnap = await db.collection("corridas").doc(candidate.id).get();
        syncSnap = await db.collection("corridas").doc(candidate.id).collection("sync").doc("estado").get();
      }
      
      const docData = docSnap.exists ? docSnap.data() : {};
      const syncData = snapToData(syncSnap);
      
      let tipo = isDescarte(docData) ? 'descarte' : 'mudanca';
      
      const m = syncData?.motorista;
      const fresh = m?.ts?.seconds ? (now - m.ts.seconds) <= 1800 : true;
      const ativa = ATIVAS.has(docData?.status) || ATIVAS.has(syncData?.fase);
      
      console.log(` Candidato ${candidate.id}: tipo=${tipo}, ativa=${ativa}, fresh=${fresh}, status=${docData?.status}, fase=${syncData?.fase}`);
      
      if (ativa && fresh) {
        console.log(` Selecionando candidato: ${candidate.id} (tipo: ${tipo})`);
        return { 
          id: candidate.id, 
          tipo: tipo, 
          fonte: candidate.fonte,
          colecao: candidate.fonte === 'descartes' ? 'descartes' : 'corridas'
        };
      }
    } catch(error) {
      console.warn(` Erro ao verificar candidato ${candidate.id}:`, error);
    }
  }
  
  const first = candidates[0];
  if (first) {
    try {
      const colecao = first.fonte === 'descartes' ? 'descartes' : 'corridas';
      const docSnap = await db.collection(colecao).doc(first.id).get();
      const docData = docSnap.exists ? docSnap.data() : {};
      const tipo = isDescarte(docData) ? 'descarte' : 'mudanca';
      
      console.log(` Fallback para primeiro candidato: ${first.id} (tipo: ${tipo})`);
      return { 
        id: first.id, 
        tipo: tipo,
        fonte: first.fonte,
        colecao: colecao
      };
    } catch (error) {
      console.warn(' Erro ao processar primeiro candidato:', error);
    }
  }
  
  return null;
}

 async function attachCorrida(corridaData){
  if (!corridaData || corridaData.id === currentCorridaId) return;

  console.log(` Anexando ${corridaData.tipo === 'descarte' ? 'descarte' : 'corrida'}: ${corridaData.id}`);

  try { unsubCorrida(); } catch {}
  try { unsubSync(); } catch {}
  try { unsubSyncExtra(); } catch {}

  currentCorridaId = corridaData.id;
  corridaId = corridaData.id;
  tipoAtual = corridaData.tipo;
  
  if (window.CHAT && window.CHAT.attach) window.CHAT.attach(corridaId);
  localStorage.setItem("ultimaCorridaCliente", corridaId);

  if (history.replaceState) {
    const url = `statusC.html?corrida=${encodeURIComponent(corridaId)}&tipo=cliente`;
    history.replaceState(null, "", url);
  }

  fitted = false;
  if(routeLayer){ map.removeLayer(routeLayer); routeLayer=null; }

  const colecao = corridaData.colecao || (corridaData.tipo === 'descarte' ? 'descartes' : 'corridas');
  colecaoAtual = colecao;
  console.log(` Usando coleção: ${colecao}`);

  const docRef = db.collection(colecao).doc(corridaId);
  docRefGlobal = docRef;
  const syncRef = db.collection(colecao).doc(corridaId).collection("sync").doc("estado");

  console.log(" Carregando dados iniciais...");
  const [docSnap, sSnap] = await Promise.all([docRef.get(), syncRef.get()]);
  
  if(docSnap.exists){
    const docData = docSnap.data() || {};
    console.log(" Dados iniciais do documento:", docData);
    
    try {
      if ((!docData.clienteId || typeof docData.clienteId !== 'string' || !docData.clienteId.trim()) && currentUser?.uid) {
        await docRef.set({ clienteId: currentUser.uid }, { merge: true });
        console.log(" clienteId ausente: preenchido com UID do usuário atual");
      }
      
      const motoristaUidDoc = docData.propostaAceita?.motoristaUid || docData.motoristaUid || null;
      if (currentUser?.uid && docData.motoristaId === currentUser.uid && motoristaUidDoc && motoristaUidDoc !== currentUser.uid) {
        await docRef.set({ motoristaId: motoristaUidDoc }, { merge: true });
        console.log(" motoristaId estava trocado e foi corrigido para:", motoristaUidDoc);
      }
    } catch (e) { console.warn(" Falha ao preencher clienteId:", e?.message || e); }

    await processarDadosDocumento({ ...docData, clienteId: docData.clienteId || currentUser?.uid });
    await hidratarMotorista(C?.motoristaId || C?.propostaAceita?.motoristaUid, C);
  }
  
  // PROCESSAR SYNC INICIAL
  if(sSnap.exists){
    const s=sSnap.data()||{};
    console.log(" Dados iniciais do sync:", s);
    
    if(s.fase) {
      S.fase = s.fase;
      console.log(` Fase inicial: ${S.fase}`);
    }
    
    if(s.motorista && validarCoordenadas(s.motorista.lat, s.motorista.lng)) {
      console.log(" Posição inicial do motorista:", s.motorista);
      setMotorista(s.motorista.lat, s.motorista.lng);
    }
    
    if (typeof s.etaMin === "number") setText(["estimated-time","tempoInfo","tempoPrevisto","tempo"], `${Math.max(1, Math.round(s.etaMin))} min`);
    if (typeof s.distanciaM === "number") setText(["distanciaInfo","estimated-distance","distPrevista","distancia"], km(s.distanciaM));
    
    updateTimeline(S.fase);
  }
  
  console.log(" Estado final inicial:", {fase: S.fase, motorista: S.motorista, origem: S.origem, destino: S.destino});
  redraw();
  ensureInitialRoute();

  // LISTENER DO DOCUMENTO
  console.log(" Configurando listener do documento...");
  unsubCorrida = docRef.onSnapshot(async doc=>{
    if(!doc.exists) {
      console.log(" Documento não existe mais");
      return;
    }
    
    const docData = doc.data()||{};
    console.log(" Update do documento:", docData);
    // Garantir clienteId durante updates também
    try {
      if ((!docData.clienteId || typeof docData.clienteId !== 'string' || !docData.clienteId.trim()) && currentUser?.uid) {
        await docRef.set({ clienteId: currentUser.uid }, { merge: true });
        console.log(" clienteId preenchido durante update");
      }
      const motoristaUidDoc = docData.propostaAceita?.motoristaUid || docData.motoristaUid || null;
      if (currentUser?.uid && docData.motoristaId === currentUser.uid && motoristaUidDoc && motoristaUidDoc !== currentUser.uid) {
        await docRef.set({ motoristaId: motoristaUidDoc }, { merge: true });
        console.log(" motoristaId corrigido durante update para:", motoristaUidDoc);
      }
    } catch (e) { console.warn(" Falha ao preencher clienteId no update:", e?.message || e); }
    await processarDadosDocumento(docData);
    await hidratarMotorista(C?.motoristaId || C?.propostaAceita?.motoristaUid, C);
    redraw();
  });

  // LISTENER DO SYNC TEMPO REAL
  console.log(" Configurando listener do sync (tempo real)...");
  unsubSync = syncRef.onSnapshot(s=>{
    const d=s.data()||{};
    console.log(" Update do sync:", d);
    
    let needsRedraw = false;
    
    // Atualizar fase
    if(d.fase && d.fase !== S.fase) {
      console.log(` Mudança de fase: ${S.fase} → ${d.fase}`);
      S.fase = d.fase;
      needsRedraw = true;
    }
    
      // aceitar origem/destino vindos do sync no descarte
    if (tipoAtual === 'descarte') {
      if (d.origem && validarCoordenadas(d.origem.lat, d.origem.lng)) {
        setPinoOrigem(d.origem, true);
        needsRedraw = true;
      }
      if (d.destino && validarCoordenadas(d.destino.lat, d.destino.lng)) {
        setPinoDestino(d.destino, true);
        needsRedraw = true;
      }
      // Se ainda faltar algum pino, tentar geocodificar pelo endereço do doc ou do sync
      if (!S.origem || !S.destino) {
        resolveAndSetPinos(C || {}, d || {}, true).then(()=>{ redraw(); ensureInitialRoute(); });
      }
    }

    // Atualizar posição do motorista 
    if(d.motorista && validarCoordenadas(d.motorista.lat, d.motorista.lng)) {
      const newLat = parseFloat(d.motorista.lat);
      const newLng = parseFloat(d.motorista.lng);
      
      if (!S.motorista || S.motorista.lat !== newLat || S.motorista.lng !== newLng) {
        console.log(" Nova posição do motorista:", {lat: newLat, lng: newLng});
        setMotorista(newLat, newLng);
        needsRedraw = true;
      }
    }
    
    if (typeof d.etaMin === "number") setText(["estimated-time","tempoInfo","tempoPrevisto","tempo"], `${Math.max(1, Math.round(d.etaMin))} min`);
    if (typeof d.distanciaM === "number") setText(["distanciaInfo","estimated-distance","distPrevista","distancia"], km(d.distanciaM));
    
    if (d.fase === "cancelada" || d.cancelamento) {
      console.log(" Corrida cancelada detectada!");
      alert(`${tipoAtual === 'descarte' ? 'Descarte' : 'Corrida'} foi cancelado!`);
      localStorage.removeItem("ultimaCorridaCliente");
      window.location.href = "homeC.html";
      return;
    }
    
    updateTimeline(S.fase);
    
    if (needsRedraw) {
      console.log(" Redesenhando devido a mudanças...");
      redraw();
    }
  });

  console.log(" Listeners configurados com sucesso!");

  // Listener extra no sync de DESCARTE
  try {
    if (tipoAtual === 'descarte') {
      const outraColecao = colecao === 'descartes' ? 'corridas' : 'descartes';
      const syncRefExtra = db.collection(outraColecao).doc(corridaId).collection('sync').doc('estado');
      console.log(` Configurando listener extra de sync na coleção espelho: ${outraColecao}`);
      try { unsubSyncExtra(); } catch {}
      unsubSyncExtra = syncRefExtra.onSnapshot((s)=>{
        const d = s.data() || {};
        if (!d) return;
        console.log(" Update do sync (espelho):", d);
        let needsRedraw = false;

        if (d.fase && d.fase !== S.fase) { S.fase = d.fase; needsRedraw = true; }
        if (d.origem && validarCoordenadas(d.origem.lat, d.origem.lng)) { setPinoOrigem(d.origem, true); needsRedraw = true; }
        if (d.destino && validarCoordenadas(d.destino.lat, d.destino.lng)) { setPinoDestino(d.destino, true); needsRedraw = true; }
        if (d.motorista && validarCoordenadas(d.motorista.lat, d.motorista.lng)) { setMotorista(d.motorista.lat, d.motorista.lng); needsRedraw = true; }
        if (typeof d.etaMin === "number") setText(["estimated-time","tempoInfo","tempoPrevisto","tempo"], `${Math.max(1, Math.round(d.etaMin))} min`);
        if (typeof d.distanciaM === "number") setText(["distanciaInfo","estimated-distance","distPrevista","distancia"], km(d.distanciaM));
        updateTimeline(S.fase);
        if (needsRedraw) redraw();
      });
    }
  } catch (e) {
    console.warn(' Falha ao configurar listener extra de sync:', e?.message || e);
  }
}

  function watchActiveCorridaCliente(uid){
    console.log(" Configurando watcher de corridas ativas...");
    
    const unsubCorridas = db.collection("corridas")
      .where("clienteId","==", uid)
      .orderBy("criadoEm","desc")
      .limit(5)
      .onSnapshot((snap)=>{
        const doc = snap.docs[0];
        if (!doc) return;
        const c = doc.data()||{};
        if (c.status === "finalizada" || c.status === "cancelada") return;
        if (doc.id !== currentCorridaId && ATIVAS.has(c.status)) {
          const tipo = isDescarte(c) ? 'descarte' : 'mudanca';
          console.log(`🔄 Nova corrida ativa detectada: ${doc.id} (tipo: ${tipo})`);
          attachCorrida({
            id: doc.id,
            tipo: tipo,
            fonte: 'corridas_watch'
          });
        }
      }, (error) => {
        console.warn("❌ Erro no watcher de corridas:", error);
      });
      
    return () => {
      unsubCorridas();
    };
  }

  function abrirModalAvaliacao(){
    const modal = getEl("driver-rating-modal","user-rating-modal");
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
          // 1. Salvar avaliação (como antes)
          await salvarAvaliacao({
            corridaId,
            motoristaId: C?.motoristaId || C?.propostaAceita?.motoristaUid,
            clienteId: currentUser?.uid || null,
            nota: Number(nota)||0,
            comentario: comentario?.value||""
          });
          
          modal.style.display="none";
          
          // 2. NOVA LÓGICA: Processar pagamento (SUBSTITUIR A LINHA ANTIGA)
          setTimeout(async () => {
            try {
              const dadosPagamento = await buscarDadosPagamento(corridaId);
              await criarPagamentoMercadoPago(dadosPagamento);
            } catch (error) {
              console.error('Erro ao processar pagamento:', error);
              alert('Erro ao processar pagamento. Redirecionando...');
              // Fallback para página antiga
              window.location.href = `pagamentoC.html?corrida=${encodeURIComponent(corridaId)}`;
            }
          }, 500);
          
        } catch (error) {
          console.error("Erro ao enviar avaliação:", error);
          alert("Erro ao enviar avaliação. Tente novamente.");
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
      
      const isDescarteDoc = tipoAtual === 'descarte';
      b.textContent = isDescarteDoc ? "Descarte concluído" : "Motorista chegou";
      
      b.className="track-btn destaque-chegada";
      document.querySelector(".ride-status")?.appendChild(b);
    }
    b.onclick = abrirModalAvaliacao;
  }


  async function getMotoristaRef(motoristaId){
    const uRef = db.collection("usuarios").doc(motoristaId);
    const u = await uRef.get();
    if (u.exists) return uRef;
    return db.collection("motoristas").doc(motoristaId);
  }
  
  async function salvarAvaliacao({ corridaId, motoristaId, clienteId, nota, comentario }){
    try {
      await db.collection("corridas").doc(corridaId)
        .collection("avaliacoes").doc(clienteId || "cliente")
        .set({ 
          nota: nota||null, 
          comentario: comentario||"", 
          avaliadoPor: "cliente",
          avaliado: motoristaId,
          ts: firebase.firestore.FieldValue.serverTimestamp() 
        }, { merge:true });

      if (!motoristaId || !nota) return;
      
      const mRef = await getMotoristaRef(motoristaId);
      await db.runTransaction(async (tx)=>{
        const snap = await tx.get(mRef);
        const d = snap.exists ? (snap.data()||{}) : {};
        const ratingCount = (d.ratingCount || 0) + 1;
        const ratingSum   = (d.ratingSum   || 0) + nota;
        const media       = ratingSum / ratingCount;
        
        tx.set(mRef, { 
          ratingCount, 
          ratingSum, 
          media: Number(media.toFixed(2)), 
          lastRatingAt: firebase.firestore.FieldValue.serverTimestamp() 
        }, { merge:true });
        
        tx.set(mRef.collection("avaliacoes").doc(corridaId), {
          from: clienteId || null, 
          corridaId, 
          nota, 
          comentario: comentario||"",
          avaliadoPor: "cliente",
          ts: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge:true });
      });
      
      console.log("Avaliação salva com sucesso!");
      
    } catch (error) {
      console.error("Erro ao salvar avaliação:", error);
    }
  }
  const USE_CHECKOUT_PRO = true; // true = Mercado Pago, false = checkout transparente

// FUNÇÕES DO MERCADO PAGO - Adicionar antes da inicialização principal
async function buscarDadosPagamento(corridaId) {
  try {
    const docSnap = await db.collection(colecaoAtual).doc(corridaId).get();
    const data = docSnap.data() || {};
    
    return {
      corridaId,
      // Valor que o cliente vai pagar (preço da proposta aceita com 10% + ajudantes)
      valor: (data.propostaAceita && typeof data.propostaAceita.preco === 'number')
        ? data.propostaAceita.preco
        : (data.precoFinal || data.valor || data.preco || 50.00),
      clienteId: data.clienteId || currentUser?.uid,
      motoristaId: data.motoristaId || data.propostaAceita?.motoristaUid,
      tipo: tipoAtual,
      descricao: `${tipoAtual === 'descarte' ? 'Serviço de Descarte' : 'Corrida de Mudança'} - ${corridaId.substring(0, 8)}`
    };
  } catch (error) {
    console.error('Erro ao buscar dados do pagamento:', error);
    throw error;
  }
}

async function criarPagamentoMercadoPago(dadosPagamento) {
  const { corridaId, valor, clienteId, descricao } = dadosPagamento;
  
  try {
    // Vercel API: cria a preferência no Mercado Pago
    const response = await fetch('https://moomate-omrw.vercel.app/api/create_preference', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        corridaId,
        valor: Number(valor),
        clienteId,
        items: [{
          title: descricao,
          quantity: 1,
          unit_price: Number(valor),
          currency_id: 'BRL'
        }],
        back_urls: {
          success: `${window.location.origin}/pagamento_sucesso.html?corrida=${corridaId}`,
          failure: `${window.location.origin}/pagamentoC.html?corrida=${corridaId}`,
          pending: `${window.location.origin}/pagamentoC.html?corrida=${corridaId}`
        },
        auto_return: 'approved'
      })
    });
    
    if (!response.ok) {
      throw new Error(`Erro HTTP: ${response.status}`);
    }
    
    const { init_point, preference_id } = await response.json();
    
    // Salvar dados do pagamento no Firebase
    await db.collection(colecaoAtual).doc(corridaId).update({
      pagamento: {
        preferenceId: preference_id,
        valor: Number(valor),
        status: 'pendente',
        criadoEm: firebase.firestore.FieldValue.serverTimestamp()
      },
      status: 'pagamento_pendente'
    });
    
    // Redirecionar para Mercado Pago
    console.log('Redirecionando para pagamento:', init_point);
    window.location.href = init_point;
    
  } catch (error) {
    console.error('Erro ao criar pagamento:', error);
    throw error;
  }
}

  //CSS
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

// Chat
(() => {
  const { firebase } = window;
  if (!firebase || !firebase.apps.length) return;
  const db = firebase.firestore();

  function garantirEstilos() {
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
  const ensureStyles = garantirEstilos;
  
  function garantirModal() {
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
  const ensureModal = garantirModal;
  
  function garantirBotao() {
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
  const ensureButton = garantirBotao;

  const escaparHtml = (s) => (s || "").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const esc = escaparHtml;
  const fmtHora = (ts) => {
    try { const d = ts?.toDate ? ts.toDate() : new Date(); return d.toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"}); }
    catch { return ""; }
  };
  
  const obterQS = (k) => new URLSearchParams(location.search).get(k);
  const getQS = obterQS;
  const autoDetectarCorrida = () =>
    obterQS("corrida") || obterQS("corridaId") || obterQS("id") ||
    localStorage.getItem("ultimaCorridaCliente") ||
    localStorage.getItem("ultimaCorridaMotorista") ||
    localStorage.getItem("corridaSelecionada");
  const autodCorrida = autoDetectarCorrida;

  const CHAT = {
    _db: db, _uid: null, _role: "cliente", _corridaId: null, _unsub: () => {},
    init(role) {
      garantirEstilos(); garantirModal(); garantirBotao();
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
              <div>${escaparHtml(m.text || "")}</div>
              <span class="time">${fmtHora(m.ts)}</span>
            </div>`;
          list.appendChild(row);
        });
        list.scrollTop = list.scrollHeight;
      });
    },
    open() {
      garantirEstilos(); garantirModal();
      if (!this._corridaId) this.attach(autoDetectarCorrida());
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

  // INICIALIZAÇÃO PRINCIPAL
  firebase.auth().onAuthStateChanged(async (user)=>{
    if(!user){ 
      console.log("❌ Usuário não logado");
      alert("Faça login."); 
      return; 
    }
    
    console.log("✅ Usuário logado:", user.uid);
    currentUser = user;

    const corridaData = await pickCorridaId(user.uid);
    if (corridaData) {
      console.log("✅ Corrida encontrada:", corridaData);
      await attachCorrida(corridaData);
    } else { 
      console.log("❌ Nenhuma corrida ativa encontrada");
      alert("Nenhuma corrida/descarte ativo encontrado."); 
      return; 
    }
    
    watchActiveCorridaCliente(user.uid);
    console.log("🎉 Sistema inicializado com sucesso!");
  });
})()