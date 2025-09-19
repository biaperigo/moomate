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
  const getEl = (...ids) => ids.map(id=>document.getElementById(id)).find(Boolean) || null;
  const setText = (ids, txt) => { const el = getEl(...ids); if (el) el.textContent = txt; };
  const km  = (m)=> (m/1000).toFixed(2)+" km";
  const min = (s)=> Math.max(1, Math.round(s/60))+" min";
  const snapToData = (s) => (s && s.exists ? s.data()||{} : {});

  const nomeMotoristaEl = getEl("driver-name","motorista-nome","nomeMotorista","driverName","motoristaInfo");
  const carroEl         = getEl("vehicle-info","motorista-carro","veiculoInfo","vehicleInfo","carroInfo");

  // Mapa 
  const map = L.map("map", { maxBounds: SP_BOUNDS, maxBoundsViscosity: 1.0 });
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{ attribution:"© OpenStreetMap" }).addTo(map);
  map.fitBounds(SP_BOUNDS);

  let mkM=null, mkO=null, mkD=null, routeLayer=null, fitted=false;
  const S = { origem:null, destino:null, motorista:null, fase:"indo_retirar" };
  let C = {};
  let corridaId = null;
  let currentUser = null;

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
    
    const uid = motoristaId || corridaData?.motoristaId;
    
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
      veiculoTxt = corridaData?.veiculo || corridaData?.tipoVeiculo || corridaData?.tipoCaminhao || "—";
    }
    
    if (nomeMotoristaEl) nomeMotoristaEl.textContent = nome || "—";
    if (carroEl) carroEl.textContent = veiculoTxt || "—";
  }

  function setMotorista(lat,lng){
    const p={lat,lng}; 
    if(!inSP(p)) return;
    S.motorista = p;
    
    const icon = L.divIcon({ 
      className:"marker-motorista",
      html:`<div style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;background:#fff;border:3px solid #FF6C0C;border-radius:50%;box-shadow:0 0 10px rgba(0,0,0,.35)">
            <i class="fas fa-truck" style="color:#FF6C0C;font-size:14px;"></i></div>` 
    });
    
    if (!mkM) mkM = L.marker([lat,lng], { icon }).addTo(map); 
    else mkM.setLatLng([lat,lng]);
  }
  
  function setPinoOrigem(p, isDescarte = false){ 
    if(!inSP(p)) return; 
    S.origem=p;
    
    const iconHtml = isDescarte ? 
      `<div style="width:24px;height:24px;background:#ff6b35;border:3px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;"><i class="fa-solid fa-recycle" style="font-size:12px;color:#fff;"></i></div>` :
      `<div style="width:24px;height:24px;background:#1E3A8A;border:3px solid #fff;border-radius:50%;"></div>`
    
    if(!mkO) mkO = L.marker([p.lat,p.lng],{
      icon:L.divIcon({
        className:"marker-origem",
        html: iconHtml
      })
    }).addTo(map);
    else mkO.setLatLng([p.lat,p.lng]); 
  }
  
  function setPinoDestino(p, isDescarte = false){ 
    if(!inSP(p)) return; 
    S.destino=p;
    
    const iconHtml = isDescarte ?
      `<div style="width:24px;height:24px;background:#28a745;border:3px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;"><i class="fa-solid fa-leaf" style="font-size:12px;color:#fff;"></i></div>` :
      `<div style="width:24px;height:24px;background:#FF6C0C;border:3px solid #fff;border-radius:50%;"></div>`
    
    if(!mkD) mkD = L.marker([p.lat,p.lng],{
      icon:L.divIcon({
        className:"marker-destino",
        html: iconHtml
      })
    }).addTo(map);
    else mkD.setLatLng([p.lat,p.lng]); 
  }

  function atualizarPainel(durationSec, distanceM){
    setText(["estimated-time","tempoInfo","tempoPrevisto","tempo"], min(durationSec));
    setText(["distanciaInfo","estimated-distance","distPrevista","distancia"], km(distanceM));
  }
  
  async function drawRoute(from,to){
    if(!from||!to||!inSP(from)||!inSP(to)) return;
    const u=`https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&steps=true`;
    
    try {
      const r=await fetch(u); 
      if(!r.ok) return;
      const j=await r.json(); 
      const route=j.routes?.[0]; 
      if(!route) return;
      
      const latlngs=route.geometry.coordinates.map(([lng,lat])=>[lat,lng]);
      if(routeLayer) map.removeLayer(routeLayer);
      routeLayer=L.polyline(latlngs,{ color:"#ff6c0c", weight:6, opacity:.95 }).addTo(map);
      map.fitBounds(L.latLngBounds(latlngs), { padding:[40,40] });
      fitted=true; 
      atualizarPainel(route.duration, route.distance);
    } catch (error) {
      console.error("Erro ao desenhar rota:", error);
    }
  }
  
  function fitOnce(){
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

  (function injectCss(){
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
          await salvarAvaliacao({
            corridaId,
            motoristaId: C?.motoristaId,
            clienteId: currentUser?.uid || null,
            nota: Number(nota)||0,
            comentario: comentario?.value||""
          });
          
          modal.style.display="none";
          
          setTimeout(() => {
            window.location.href = `pagamentoC.html?corrida=${encodeURIComponent(corridaId)}`;
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
      
      const isDescarte = C?.tipo === 'descarte';
      b.textContent = isDescarte ? "Descarte concluído" : "Motorista chegou";
      
      b.className="track-btn destaque-chegada";
      document.querySelector(".ride-status")?.appendChild(b);
    }
    b.onclick = abrirModalAvaliacao;
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
    

    const isDescarte = C?.tipo === 'descarte';
    const pickupEl = el(ids.indo_retirar)?.querySelector('h4');
    const destEl = el(ids.a_caminho_destino)?.querySelector('h4');
    const completedEl = el(ids.finalizada_pendente)?.querySelector('h4');
    
    if (pickupEl) pickupEl.textContent = isDescarte ? "A caminho da coleta" : "A caminho da coleta";
    if (destEl) destEl.textContent = isDescarte ? "A caminho do ecoponto" : "A caminho do destino";
    if (completedEl) completedEl.textContent = isDescarte ? "Descarte finalizado" : "Entrega finalizada";
    
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
  }

  function redraw(){
    const isDescarte = C?.tipo === 'descarte';
    
    if (S.fase==="indo_retirar" && S.motorista && S.origem) { 
      drawRoute(S.motorista, S.origem); 
      return; 
    }
    
    if (S.fase==="a_caminho_destino" && S.origem && S.destino) { 
      drawRoute(S.origem, S.destino); 
      return; 
    }
    
    fitOnce();
  }

  async function pickCorridaId(uid){
    const qs=new URLSearchParams(location.search);
    const fromQS=qs.get("corrida")||qs.get("corridaId")||qs.get("id");
    const fromLS=localStorage.getItem("ultimaCorridaCliente")||localStorage.getItem("ultimaCorridaMotorista");
    
    const candIds=[]; 
    if(fromQS) candIds.push(fromQS); 
    if(fromLS) candIds.push(fromLS);
    
    try{ 
      const q1=await db.collection("corridas")
        .where("clienteId","==",uid)
        .orderBy("criadoEm","desc")
        .limit(5)
        .get(); 
      q1.forEach(d=>candIds.push(d.id)); 
    }catch{}
    
    try{ 
      const q2=await db.collection("corridas")
        .where("motoristaId","==",uid)
        .orderBy("criadoEm","desc")
        .limit(3)
        .get(); 
      q2.forEach(d=>candIds.push(d.id)); 
    }catch{}
    
    try{ 
      const q3=await db.collection("corridas")
        .orderBy("criadoEm","desc")
        .limit(10)
        .get(); 
      q3.forEach(d=>candIds.push(d.id)); 
    }catch{}
    
    const seen=new Set(); 
    const ids=candIds.filter(id=>!seen.has(id)&&seen.add(id)); 
    if(!ids.length) return null;

    const now = firebase.firestore.Timestamp.now().seconds;
    for(const id of ids){
      try{
        const [cSnap,sSnap]=await Promise.all([
          db.collection("corridas").doc(id).get(), 
          db.collection("corridas").doc(id).collection("sync").doc("estado").get()
        ]);
        
        const c=cSnap.exists?cSnap.data():{}; 
        const s=snapToData(sSnap); 
        const m=s?.motorista;
        const fresh = m?.ts?.seconds ? (now - m.ts.seconds) <= 1800 : true;
        const ativa = ATIVAS.has(c?.status) || ATIVAS.has(s?.fase);
        
        if (m && inSP(m) && fresh && ativa) return id;
      }catch{}
    }
    return ids[0];
  }

  async function attachCorrida(newCorridaId){
    if (!newCorridaId || newCorridaId === currentCorridaId) return;

    try { unsubCorrida(); } catch {}
    try { unsubSync(); } catch {}

    currentCorridaId = newCorridaId;
    corridaId = newCorridaId;
    
    if (window.CHAT && window.CHAT.attach) window.CHAT.attach(corridaId);

    localStorage.setItem("ultimaCorridaCliente", corridaId);

    if (history.replaceState) {
      const url = `statusC.html?corrida=${encodeURIComponent(corridaId)}&tipo=cliente`;
      history.replaceState(null, "", url);
    }

    fitted = false;
    if(routeLayer){ map.removeLayer(routeLayer); routeLayer=null; }

    const corridaRef = db.collection("corridas").doc(corridaId);
    const syncRef    = corridaRef.collection("sync").doc("estado");

    const [cSnap,sSnap]=await Promise.all([corridaRef.get(), syncRef.get()]);
    
    if(cSnap.exists){
      C=cSnap.data()||{};
      const isDescarte = C.tipo === 'descarte';
      
      if(C.origem && inSP(C.origem)){ 
        setPinoOrigem(C.origem, isDescarte); 
        setText(["origem-address","origemInfo"], C.origem.endereco||"—"); 
      }
      
      if(C.destino&& inSP(C.destino)){ 
        setPinoDestino(C.destino, isDescarte); 
        setText(["destino-address","destinoInfo"], C.destino.endereco||"—"); 
      }
      
      await hidratarMotorista(C?.motoristaId, C);
    }
    
    if(sSnap.exists){
      const s=sSnap.data()||{};
      if(s.fase) S.fase=s.fase;
      if(s.motorista) setMotorista(s.motorista.lat, s.motorista.lng);
      if (typeof s.etaMin === "number") setText(["estimated-time","tempoInfo","tempoPrevisto","tempo"], `${Math.max(1, Math.round(s.etaMin))} min`);
      if (typeof s.distanciaM === "number") setText(["distanciaInfo","estimated-distance","distPrevista","distancia"], km(s.distanciaM));
      updateTimeline(S.fase);
    }
    
    redraw();

    // Listeners ativos
    unsubCorrida = corridaRef.onSnapshot(async doc=>{
      if(!doc.exists) return;
      C=doc.data()||{};
      const isDescarte = C.tipo === 'descarte';
      
      if(C.origem && inSP(C.origem)){ 
        setPinoOrigem(C.origem, isDescarte); 
        setText(["origem-address","origemInfo"], C.origem.endereco||"—"); 
      }
      
      if(C.destino&& inSP(C.destino)){ 
        setPinoDestino(C.destino, isDescarte); 
        setText(["destino-address","destinoInfo"], C.destino.endereco||"—"); 
      }
      
      await hidratarMotorista(C?.motoristaId, C);
      redraw();
    });

    unsubSync = syncRef.onSnapshot(s=>{
      const d=s.data()||{};
      if(d.fase) S.fase=d.fase;
      if(d.motorista) setMotorista(d.motorista.lat, d.motorista.lng);
      if (typeof d.etaMin === "number") setText(["estimated-time","tempoInfo","tempoPrevisto","tempo"], `${Math.max(1, Math.round(d.etaMin))} min`);
      if (typeof d.distanciaM === "number") setText(["distanciaInfo","estimated-distance","distPrevista","distancia"], km(d.distanciaM));
      updateTimeline(S.fase);
      redraw();
    });
  }

  function watchActiveCorridaCliente(uid){
    return db.collection("corridas")
      .where("clienteId","==", uid)
      .orderBy("criadoEm","desc")
      .limit(1)
      .onSnapshot((snap)=>{
        const doc = snap.docs[0];
        if (!doc) return;
        const c = doc.data()||{};
        if (c.status === "finalizada") return;
        if (doc.id !== currentCorridaId) attachCorrida(doc.id);
      });
  }
  
  firebase.auth().onAuthStateChanged(async (user)=>{
    if(!user){ alert("Faça login."); return; }
    currentUser = user;

    const qs = new URLSearchParams(location.search);
    const fromQS = qs.get("corrida") || qs.get("corridaId") || qs.get("id");
    const fromLS = localStorage.getItem("ultimaCorridaCliente");

    if (fromQS) {
      await attachCorrida(fromQS);
    } else if (fromLS) {
      await attachCorrida(fromLS);
    } else {
      const p = await pickCorridaId(user.uid);
      if (p) await attachCorrida(p);
      else { alert("Nenhuma corrida ativa encontrada."); return; }
    }
    
    watchActiveCorridaCliente(user.uid);
  });
})();

// Chat 
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