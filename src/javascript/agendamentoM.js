// Agendamentos do Motorista - mesma base do homeM.js, filtrando apenas agendados
(function(){
  const { firebase } = window;
  // Firebase é inicializado no HTML (agendamentoM.html). Se ainda não estiver pronto, aborta silenciosamente.
  if (!firebase || !firebase.apps || !firebase.apps.length) return;
  const db = firebase.firestore();
  // Referência urbana para fallback (centro da cidade de São Paulo)
  const CENTRO_SP_REF = { lat: -23.55052, lng: -46.633308 };

  // Geocodificação aprimorada com múltiplos provedores e fallbacks
  async function geocodificarEndereco(endereco){
    if (!endereco) return null;
    
    // Cache para evitar requisições desnecessárias
    const cacheKey = `geocode_${endereco}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {}
    }

    // Normalizar endereço para melhor precisão
    const normalizeAddress = (addr) => {
      let normalized = addr.trim();
      // Adicionar Brasil se não especificado, mas não forçar São Paulo para permitir geocodificação mais ampla
      if (!normalized.includes("Brasil")) {
        normalized += ", Brasil";
      }
      return normalized;
    };

    const searchQuery = normalizeAddress(endereco);
    
    // Tentar múltiplos provedores de geocodificação
    const providers = [
      // Nominatim OpenStreetMap (gratuito)
      async () => {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&addressdetails=1&limit=3&countrycodes=br&bounded=1&viewbox=-46.826,-23.356,-46.365,-23.796`;
        const res = await fetch(url, {
          headers: { 'User-Agent': 'MoomateApp/1.0', 'Referer': 'https://moomate.com.br/' } // Adicionado Referer para evitar bloqueios
        });
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          // Priorizar resultados em São Paulo
          const spResult = data.find(r => r.display_name?.includes('São Paulo')) || data[0];
          const lat = parseFloat(spResult.lat);
          const lng = parseFloat(spResult.lon);
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            return { lat, lng, endereco: spResult.display_name, provider: 'nominatim' };
          }
        }
        return null;
      },
      
      // Photon (alternativa ao Nominatim)
      async () => {
        const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(searchQuery)}&limit=3&bbox=-46.826,-23.796,-46.365,-23.356`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.features && data.features.length > 0) {
          const feature = data.features[0];
          const coords = feature.geometry?.coordinates;
          if (coords && coords.length >= 2) {
            const [lng, lat] = coords;
            if (Number.isFinite(lat) && Number.isFinite(lng)) {
              return { lat, lng, endereco: feature.properties?.name || endereco, provider: 'photon' };
            }
          }
        }
        return null;
      },

    ];

    // Tentar cada provedor sequencialmente com retries
    const maxRetries = 2;
    for (let i = 0; i < providers.length; i++) {
      const provider = providers[i];
      for (let retry = 0; retry <= maxRetries; retry++) {
        try {
          const result = await Promise.race([
            provider(),
            new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 15000)) // Aumentar timeout para 15 segundos
          ]);
          
          if (result) {
            // Validar se as coordenadas estão dentro da região de São Paulo
            const { lat, lng } = result;
            // Ajustar a validação da bounding box para ser um pouco mais flexível
            if (lat >= -24.5 && lat <= -22.5 && lng >= -47.5 && lng <= -45.5) {
              // Salvar no cache
              sessionStorage.setItem(cacheKey, JSON.stringify(result));
              return result;
            }
          }
        } catch (error) {
          console.warn(`Geocoding provider failed (${provider.name || i}, retry ${retry}): ${error.message}`);
          if (retry === maxRetries) break; // Não tentar novamente se atingiu o limite de retries
          await new Promise(resolve => setTimeout(resolve, 1000 * (retry + 1))); // Esperar antes de tentar novamente
        }
      }
    }

    // Fallback para endereços conhecidos de São Paulo
    const fallbackLocations = {
      'centro': { lat: -23.55052, lng: -46.633308 },
      'vila madalena': { lat: -23.5505, lng: -46.6889 },
      'pinheiros': { lat: -23.5629, lng: -46.7006 },
      'itaim bibi': { lat: -23.5754, lng: -46.6754 },
      'moema': { lat: -23.6006, lng: -46.6639 },
      'vila olimpia': { lat: -23.5955, lng: -46.6856 },
      'brooklin': { lat: -23.6134, lng: -46.6917 }
    };

    const enderecoLower = endereco.toLowerCase();
    for (const [bairro, coords] of Object.entries(fallbackLocations)) {
      if (enderecoLower.includes(bairro)) {
        const result = { ...coords, endereco: `${bairro}, São Paulo, SP`, provider: 'fallback' };
        sessionStorage.setItem(cacheKey, JSON.stringify(result));
        return result;
      }
    }

    return null;
  }

  // Agenda lembrete para início no horário agendado (motorista)
  function scheduleStartReminderMotorista(v){
    try{
      if (!v?.id || !v?.data || !v?.hora) return;
      if (!window.__agStartTimersM) window.__agStartTimersM = {};
      if (window.__agStartTimersM[v.id]) return;
      const ts = new Date(`${v.data}T${v.hora}:00`);
      if (!(ts instanceof Date) || isNaN(ts.getTime())) return;
      const now = new Date();
      const ms = ts.getTime() - now.getTime();
      const fire = async ()=>{
        try{
          // Criar/atualizar corridaagendamento antes de redirecionar (espelha dados essenciais)
          const agRef = db.collection('agendamentos').doc(String(v.id));
          const agSnap = await agRef.get();
          const ag = agSnap.exists ? (agSnap.data()||{}) : {};
          const base = {
            clienteId: ag.clienteId || ag.clienteUid || null,
            motoristaId: ag.motoristaId || ag.propostaAceita?.motoristaUid || (window.firebase?.auth()?.currentUser?.uid||null),
            propostaAceita: ag.propostaAceita || null,
            tipoVeiculo: ag.tipoVeiculo || null,
            volumes: ag.volumes || null,
            origem: ag.origem || (ag.localRetirada ? { endereco: ag.localRetirada } : null),
            destino: ag.destino || (ag.localEntrega ? { endereco: ag.localEntrega } : null),
            agendamentoId: v.id,
            status: 'indo_retirar',
            criadoEm: window.firebase.firestore.FieldValue.serverTimestamp(),
          };
          const corridaRef = db.collection('corridaagendamento').doc(String(v.id));
          await corridaRef.set(base, { merge: true });
          await corridaRef.collection('sync').doc('estado').set({ fase: 'indo_retirar' }, { merge: true });
        }catch(e){ console.warn('[agendamentoM] Falha ao preparar corridaagendamento:', e?.message||e); }
        showStartAgModalM('Seu agendamento começou. Inicie a corrida.', ()=>{
          window.location.href = `rotaA.html?agendamento=${encodeURIComponent(v.id)}`;
        });
        delete window.__agStartTimersM[v.id];
      };
      if (ms <= 0){ fire(); return; }
      if (ms > 24*60*60*1000) return;
      window.__agStartTimersM[v.id] = setTimeout(fire, ms);
    }catch{}
  }
  
  // Modal informativo reutilizável (recriado após correção)
  function ensureInfoModal(){
    let modal = document.getElementById('mm-info-modal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'mm-info-modal';
    modal.style.cssText = 'position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.35);z-index:9999;';
    modal.innerHTML = `
      <div id="mm-info-modal-content" style="background:#fff;border-radius:8px;min-width:280px;max-width:92vw;padding:20px 18px;box-shadow:0 10px 30px rgba(0,0,0,.15);transform:scale(.95);transition:transform .2s ease,opacity .2s ease;opacity:0">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
          <i class="fa-solid fa-circle-info" style="color:#ff6b35"></i>
          <h3 id="mm-info-modal-title" style="margin:0;font-size:1.05rem;color:#333">Aviso</h3>
        </div>
        <div id="mm-info-modal-body" style="color:#555;font-size:.95rem;line-height:1.35"></div>
        <div style="display:flex;justify-content:flex-end;margin-top:14px">
          <button id="mm-info-modal-ok" style="background:#ff6b35;color:#fff;border:none;border-radius:8px;padding:8px 14px;cursor:pointer">OK</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    const ok = modal.querySelector('#mm-info-modal-ok');
    ok.addEventListener('click', hideInfoModal);
    modal.addEventListener('click', (e)=>{ if(e.target===modal) hideInfoModal(); });
    return modal;
  }
  function showInfoModal(title, message){
    const modal = ensureInfoModal();
    modal.querySelector('#mm-info-modal-title').textContent = title || 'Aviso';
    modal.querySelector('#mm-info-modal-body').textContent = message || '';
    modal.style.display = 'flex';
    const content = modal.querySelector('#mm-info-modal-content');
    requestAnimationFrame(()=>{ content.style.opacity='1'; content.style.transform='scale(1)'; });
  }
  function hideInfoModal(){
    const modal = document.getElementById('mm-info-modal'); if (!modal) return;
    const content = modal.querySelector('#mm-info-modal-content');
    content.style.opacity='0'; content.style.transform='scale(.95)';
    setTimeout(()=>{ modal.style.display='none'; }, 180);
  }

  // Modal para iniciar corrida no horário agendado (lado do motorista)
  function ensureStartAgModalM(){
    let modal = document.getElementById('ag-start-modal-m');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'ag-start-modal-m';
    modal.style.cssText = 'position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.35);z-index:10000;';
    modal.innerHTML = `
      <div class="modal-content" style="background:#fff;border-radius:8px;min-width:300px;max-width:92vw;padding:20px;box-shadow:0 10px 30px rgba(0,0,0,.2);transform:scale(.96);transition:transform .2s ease,opacity .2s ease;opacity:0">
        <h3 style=\"margin:0 0 6px 0;color:#333\">Está na hora do seu agendamento</h3>
        <p id=\"ag-start-text-m\" style=\"margin:4px 0 12px 0;color:#555\">Inicie a corrida agora.</p>
        <div style=\"display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap\">
          <button id=\"ag-start-cancel-m\" style=\"background:#e7e7e7;border:0;color:#111;border-radius:8px;padding:8px 12px;cursor:pointer\">Depois</button>
          <button id=\"ag-start-go-m\" style=\"background:#ff6b35;border:0;color:#fff;border-radius:8px;padding:8px 14px;cursor:pointer;font-weight:600\">Iniciar</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e)=>{ if(e.target===modal) hideStartAgModalM(); });
    modal.querySelector('#ag-start-cancel-m').addEventListener('click', hideStartAgModalM);
    return modal;
  }
  function showStartAgModalM(msg, onStart){
    const modal = ensureStartAgModalM();
    modal.querySelector('#ag-start-text-m').textContent = msg || 'Inicie a corrida agora.';
    const go = modal.querySelector('#ag-start-go-m');
    go.onclick = ()=>{ try{ onStart && onStart(); }finally{ hideStartAgModalM(); } };
    modal.style.display = 'flex';
    requestAnimationFrame(()=>{
      const c = modal.querySelector('.modal-content'); c.style.opacity='1'; c.style.transform='scale(1)';
    });
  }
  function hideStartAgModalM(){
    const modal = document.getElementById('ag-start-modal-m'); if (!modal) return;
    const c = modal.querySelector('.modal-content'); c.style.opacity='0'; c.style.transform='scale(.96)';
    setTimeout(()=>{ modal.style.display='none'; }, 180);
  }

  const listaEntregas = document.getElementById('delivery-list');
  const mensagemCarregando = document.getElementById('loading-message');
  const botaoEnviar = document.getElementById('submitBtn');
  const modalProposta = document.getElementById('proposalModal');
  const botaoFecharModal = document.getElementById('modalClose');
  const botaoConfirmarProposta = document.getElementById('sendProposalBtn');
  const inputPrecoProposta = document.getElementById('proposalPrice');
  const inputTempoProposta = document.getElementById('proposalTime');
  const inputAjudantesProposta = document.getElementById('proposalHelpers');
  const inputVeiculoProposta = document.getElementById('proposalVehicle');

  let entregaSelecionadaId = null;
  let motoristaUid = null;
  const todasSolicitacoes = new Map();
  let limitesPrecoAtuais = null;

  function calcularLimitesPrecoPorDistancia(distKm){
    const dist = Number(distKm)||0; let base = 24*dist; if(base<24) base=24;
    const min = Math.max(24, base-150), max = base+150;
    return { base: Math.round(base*100)/100, min: Math.round(min*100)/100, max: Math.round(max*100)/100 };
  }

  // Listener por documento para remover o card e avisar quando o cliente cancelar
  function attachCardStatusListenerM(agendamentoId, cardEl){
    try{
      const ref = db.collection('agendamentos').doc(String(agendamentoId));
      const unsub = ref.onSnapshot(snap=>{
        if (!snap.exists) { try{ cardEl.remove(); }catch{}; return; }
        const d = snap.data()||{};
        const status = String(d.status||'').toLowerCase();
        const confirmados = ['agendamento_confirmado','corrida_agendamento_confirmado'];
        if (!confirmados.includes(status)){
          if (status === 'cancelado_agendamento' && !cardEl.dataset.modalShown){
            try{ showInfoModal('Agendamento cancelado', 'O cliente cancelou este agendamento.'); cardEl.dataset.modalShown = '1'; }catch{}
          }
          try{ cardEl.remove(); }catch{}
        }
      });
      if (!window.__agCardUnsubsM) window.__agCardUnsubsM = {};
      window.__agCardUnsubsM[agendamentoId] = unsub;
    }catch{}
  }

  function distanciaEstimativaKmFromDoc(d){
    try{
      const distInformada = Number(d?.distancia);
      if (Number.isFinite(distInformada) && distInformada > 0) return distInformada;

      const toNum = (v)=> (v!=null && !Number.isNaN(Number(v)) ? Number(v) : null);
      const oLat = toNum(d?.origem?.lat ?? d?.origem?.coordenadas?.lat);
      const oLng = toNum(d?.origem?.lng ?? d?.origem?.coordenadas?.lng);
      const dLat = toNum(d?.destino?.lat ?? d?.destino?.coordenadas?.lat);
      const dLng = toNum(d?.destino?.lng ?? d?.destino?.coordenadas?.lng);

      const R = 6371; const toRad = (deg)=>deg*Math.PI/180;
      const calc = (lat1,lon1,lat2,lon2)=>{
        const dPhi=toRad(lat2-lat1), dLam=toRad(lon2-lon1);
        const a=Math.sin(dPhi/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLam/2)**2;
        return 2*R*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
      };

      if ([oLat,oLng,dLat,dLng].every(Number.isFinite)) return calc(oLat,oLng,dLat,dLng);
      if ([dLat,dLng].every(Number.isFinite)) return calc(CENTRO_SP_REF.lat,CENTRO_SP_REF.lng,dLat,dLng);
      if ([oLat,oLng].every(Number.isFinite)) return calc(oLat,oLng,CENTRO_SP_REF.lat,CENTRO_SP_REF.lng);

      return 1;
    }catch{ return 1; }
  }

  // Cache simples para nomes/fotos
  const cachePerfil = new Map(); // uid -> { nome, foto }
  async function preencherNomeEAvatar(card, uid){
    try{
      if (!uid || !firebase || !firebase.apps?.length) return;
      if (cachePerfil.has(uid)){
        const { nome, foto } = cachePerfil.get(uid);
        aplicarPerfilNoCard(card, nome, foto);
        return;
      }
      const dbref = firebase.firestore();
      let snap = await dbref.collection('usuarios').doc(uid).get();
      if (!snap.exists) snap = await dbref.collection('clientes').doc(uid).get();
      const d = snap.exists ? (snap.data()||{}) : {};
      const nome = d?.dadosPessoais?.nome || d?.nome || 'Cliente';
      const foto = d?.fotoUrl || d?.dadosPessoais?.fotoUrl || '';
      cachePerfil.set(uid, { nome, foto });
      aplicarPerfilNoCard(card, nome, foto);
    }catch(e){ /* silencioso */ }
  }
  function aplicarPerfilNoCard(card, nome, foto){
    try{
      const wrap = card.querySelector('[data-cliente-uid]'); if (!wrap) return;
      const nomeEl = wrap.querySelector('.cliente-nome'); if (nomeEl) nomeEl.textContent = nome || 'Cliente';
      const avatar = wrap.querySelector('.avatar');
      if (avatar){
        avatar.innerHTML = foto ? `<img src="${foto}" alt="foto" style="width:100%;height:100%;object-fit:cover">`
                                : `<span class="avatar-inicial" style='font-size:.8rem;color:#555;font-weight:700'>${(nome||'C').substring(0,1).toUpperCase()}</span>`;
      }
    }catch{}
  }

  // ================= Agendados (lista do motorista) =================
  let unsubscribeAgendados = null;
  function ouvirAgendadosDoMotorista(){
    if (!motoristaUid) return;
    const container = document.getElementById('scheduled-list');
    if (!container) return;
    if (unsubscribeAgendados) { try{ unsubscribeAgendados(); }catch{} }
    unsubscribeAgendados = db.collection('agendamentos')
      .where('motoristaId','==', motoristaUid)
      .onSnapshot(snap=>{
        container.innerHTML = '';
        const all = snap.docs.map(d=> ({ id:d.id, ...d.data() }));
        const confirmados = all.filter(d=> ['agendamento_confirmado','corrida_agendamento_confirmado'].includes(d.status));
        if (!confirmados.length){
          const empty = document.createElement('div');
          empty.className = 'empty-message';
          empty.innerHTML = '<h3>Sem agendamentos no momento</h3>';
          container.appendChild(empty);
          return;
        }
        // Monta o mesmo modelo de objeto do cliente
        const viagens = confirmados.map(d=>{
          const dt = d.dataHoraAgendada?.toDate ? d.dataHoraAgendada.toDate() : (d.dataHoraAgendada?.seconds? new Date(d.dataHoraAgendada.seconds*1000): null);
          const confDt = d.confirmadoEm?.toDate ? d.confirmadoEm.toDate() : (d.confirmadoEm?.seconds? new Date(d.confirmadoEm.seconds*1000): null);
          const data = dt ? `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}` : '';
          const hora = dt ? `${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}` : '';
          const origem = d?.origem?.endereco || d?.localRetirada || '-';
          const destino = d?.destino?.endereco || d?.localEntrega || '-';
          const veiculo = d?.tipoVeiculo ? (String(d.tipoVeiculo).charAt(0).toUpperCase()+String(d.tipoVeiculo).slice(1)) : (d?.propostaAceita?.veiculo || '-');
          const volumes = d?.volumes || '-';
          // Para o motorista, exibiremos dados do CLIENTE
          const clienteUid = d?.clienteId || d?.clienteUid || null;
          const nomeCliente = d?.clienteNome || '—';
          const emailCliente = d?.clienteEmail || '—';
          const preco = typeof d?.propostaAceita?.preco === 'number' ? `R$ ${Number(d.propostaAceita.preco).toFixed(2).replace('.',',')}` : '—';
          return { id: d.id, data, hora, origem, destino, veiculo, volumes, status: 'Confirmado', clienteUid, nomeCliente, emailCliente, preco, __confMs: confDt? confDt.getTime():0 };
        }).sort((a,b)=> (b.__confMs||0)-(a.__confMs||0));

        const list = document.createElement('div');
        list.style.display='flex'; list.style.flexDirection='column'; list.style.gap='16px';
        // Limpa listeners antigos
        try{ if(!window.__agCardUnsubsM) window.__agCardUnsubsM = {}; Object.values(window.__agCardUnsubsM).forEach(fn=>{ try{fn();}catch{} }); window.__agCardUnsubsM = {}; }catch{}

        viagens.forEach(v=> { 
          const card = createViagemCard(v);
          list.appendChild(card);
          if ((v.nomeCliente==='—' || v.emailCliente==='—') && v.clienteUid){
            try{ preencherContatoCliente(card, v.clienteUid); }catch{}
          }
          try{ attachCardStatusListenerM(v.id, card); }catch{}
          try{ scheduleStartReminderMotorista(v); }catch{}
        });
        container.appendChild(list);
      });
  }

  // Mantido para listas antigas, não usado após unificar design
  function criarCardAgendado(d){
    const card = document.createElement('div');
    card.className = 'delivery-card';
    const titulo = d.titulo || 'Serviço Agendado';
    const quando = (()=>{
      try{
        const ts = d.dataHoraAgendada?.seconds? new Date(d.dataHoraAgendada.seconds*1000) : null;
        if (!ts) return '';
        const dia = ts.toLocaleDateString('pt-BR', { weekday:'long' });
        const horas = ts.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
        return `${dia.charAt(0).toUpperCase()+dia.slice(1)} ${horas}`;
      }catch{ return ''; }
    })();
    const origem = d.origem?.endereco || d.localRetirada || '—';
    const destino = d.destino?.endereco || d.localEntrega || '—';
    const cliente = d.clienteNome || 'Cliente';
    const clienteUid = d.clienteId || d.clienteUid || null;
    const valor = (d.propostaAceita?.preco!=null) ? `R$ ${Number(d.propostaAceita.preco).toFixed(2)}` : '';
    card.innerHTML = `
      <div class="ag-card">
        <div class="ag-top">
          <div class="ag-title">${titulo}</div>
          <div class="ag-when">${quando}</div>
        </div>
        <div class="ag-info">
          <div class="ag-left">
            <div><i class="fa-solid fa-map-marker-alt"></i> ${origem}</div>
            <div><i class="fa-solid fa-arrow-right"></i> ${destino}</div>
          </div>
          <div class="ag-mid">
            <div><i class="fa-solid fa-user"></i> ${cliente}</div>
            <div><i class="fa-solid fa-dollar-sign"></i> ${valor}</div>
          </div>
        </div>
      </div>`;
    // Se não temos nome mas temos UID, buscar e preencher
    if (!d.clienteNome && clienteUid) preencherNomeEAvatar(card, clienteUid);
    return card;
  }

  async function atualizarDistanciaAssincrona(s, cardEl){
    try{
      if (cardEl.dataset.distCalcRunning==='1') return; cardEl.dataset.distCalcRunning='1';
      const origemEnd = s.origem?.endereco || s.localRetirada || '';
      const destinoEnd = s.destino?.endereco || s.localEntrega || '';
      let oLat = Number(s.origem?.coordenadas?.lat ?? s.origem?.lat);
      let oLng = Number(s.origem?.coordenadas?.lng ?? s.origem?.lng);
      let dLat = Number(s.destino?.coordenadas?.lat ?? s.destino?.lat);
      let dLng = Number(s.destino?.coordenadas?.lng ?? s.destino?.lng);
      const precisaOrigem = !(Number.isFinite(oLat) && Number.isFinite(oLng));
      const precisaDestino = !(Number.isFinite(dLat) && Number.isFinite(dLng));
      const TEMPO_LIMITE_MS = 1000;
      const limit = (p)=> Promise.race([p, new Promise(r=>setTimeout(()=>r(null),TEMPO_LIMITE_MS))]);
      if (precisaOrigem && origemEnd){ const g = await limit(geocodificarEndereco(origemEnd)); if (g){ oLat=g.lat; oLng=g.lng; } }
      if (precisaDestino && destinoEnd){ const g = await limit(geocodificarEndereco(destinoEnd)); if (g){ dLat=g.lat; dLng=g.lng; } }
      if ([oLat,oLng,dLat,dLng].every(Number.isFinite)){
        const R=6371, toRad=(deg)=>deg*Math.PI/180;
        const dPhi=toRad(dLat-oLat), dLam=toRad(dLng-oLng);
        const a=Math.sin(dPhi/2)**2 + Math.cos(toRad(oLat))*Math.cos(toRad(dLat))*Math.sin(dLam/2)**2;
        const dist = 2*R*Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distEl = cardEl.querySelector('.ag-mid')?.querySelector('div');
        // Atualiza o primeiro item da coluna do meio que mostra Distância
        const label = cardEl.querySelector('.ag-mid');
        if (label){
          const distRow = label.querySelector('div');
          if (distRow) distRow.innerHTML = `<strong>Distância:</strong> ${dist.toFixed(2)} km`;
        }
      }
    }catch{} finally{ delete cardEl.dataset.distCalcRunning; }
  }

  // ====== Card igual ao cliente ======
  function createViagemCard(viagem) {
    const card = document.createElement('div');
    card.className = 'viagem-card';
    const statusClass = getStatusClass(viagem.status);
    card.innerHTML = `
      <div class="card-header">
        <div class="card-info">
          <h3><i class="fa-solid fa-truck"></i> Viagem #${viagem.id}</h3>
          <div class="card-status">
            <span class="status ${statusClass}">${viagem.status}</span>
          </div>
        </div>
        <div class="card-actions">
          <button class="btn-cancel" title="Cancelar agendamento" onclick="cancelViagem('${viagem.id}')"><i class="fa-solid fa-times"></i></button>
        </div>
      </div>

      <div class="card-body">
        <div class="datetime-info">
          <div class="date">
            <i class="fa-solid fa-calendar"></i>
            <span>${formatDate(viagem.data)}</span>
          </div>
          <div class="time">
            <i class="fa-solid fa-clock"></i>
            <span>${viagem.hora}</span>
          </div>
        </div>
        <div class="route-info">
          <div class="route-point origin">
            <i class="fa-solid fa-circle-dot"></i>
            <span>${viagem.origem}</span>
          </div>
          <div class="route-line"></div>
          <div class="route-point destination">
            <i class="fa-solid fa-location-dot"></i>
            <span>${viagem.destino}</span>
          </div>
        </div>
        <div class="trip-details">
          <div class="detail">
            <i class="fa-solid fa-truck"></i>
            <span>Veículo: ${viagem.veiculo}</span>
          </div>
          <div class="detail">
            <i class="fa-solid fa-boxes-stacked"></i>
            <span>Volumes: ${viagem.volumes}</span>
          </div>
          <div class="detail price">
            <i class="fa-solid fa-money-bill"></i>
            <span>${viagem.preco}</span>
          </div>
        </div>
        <div class="driver-info">
          <div class="driver-details">
            <i class="fa-solid fa-user"></i>
            <span>Cliente: ${viagem.nomeCliente || '—'}</span>
          </div>
          <div class="driver-contact">
            <i class="fa-solid fa-envelope"></i>
            <span>${viagem.emailCliente || '—'}</span>
          </div>
        </div>
      </div>`;
    return card;
  }

  // Busca nome e email do cliente e atualiza o card
  async function preencherContatoCliente(cardEl, clienteUid){
    try{
      const { firebase } = window; if (!firebase?.apps?.length) return;
      const db = firebase.firestore();
      let snap = await db.collection('usuarios').doc(String(clienteUid)).get();
      if (!snap.exists) snap = await db.collection('clientes').doc(String(clienteUid)).get();
      if (!snap.exists) return;
      const d = snap.data()||{};
      const nome = d?.dadosPessoais?.nome || d?.nome || null;
      const email = d?.email || d?.dadosPessoais?.email || null;
      if (nome){ const el = cardEl.querySelector('.driver-details span'); if (el) el.textContent = `Cliente: ${nome}`; }
      if (email){ const el2 = cardEl.querySelector('.driver-contact span'); if (el2) el2.textContent = email; }
    }catch{}
  }

  function getStatusClass(status) {
    switch (String(status||'').toLowerCase()) {
      case 'confirmado': return 'status-confirmed';
      case 'aguardando': return 'status-pending';
      case 'em andamento': return 'status-progress';
      case 'finalizado': return 'status-completed';
      case 'cancelado': return 'status-cancelled';
      default: return 'status-default';
    }
  }

  function formatDate(dateString) {
    try{
      if (/^\d{4}-\d{2}-\d{2}$/.test(String(dateString||''))){
        const [y,m,d] = String(dateString).split('-');
        return `${d}/${m}/${y}`;
      }
      const date = new Date(dateString);
      return date.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric' });
    }catch{ return String(dateString||''); }
  }

  // Cancelamento para motorista (mesmo handler, opcional)
  window.cancelViagem = async function(agendamentoId) {
    try{
      if (!window.firebase || !firebase.apps.length) return alert('Serviço indisponível.');
      const db = firebase.firestore();
      if (!confirm('Deseja realmente cancelar este agendamento?')) return;
      await db.collection('agendamentos').doc(String(agendamentoId))
        .set({ status: 'corrida_agendamento_cancelado', canceladoEm: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
    }catch(e){ console.error('Falha ao cancelar', e); alert('Erro ao cancelar agendamento.'); }
  };

  function garantirElementoDicaPreco(){
    let hint = document.getElementById('priceRangeHint');
    if(!hint){
      hint = document.createElement('small');
      hint.id='priceRangeHint'; hint.style.display='block'; hint.style.marginTop='6px'; hint.style.color='#666';
      inputPrecoProposta.parentElement.appendChild(hint);
    }
    return hint;
  }

  function atualizarInterface(){
    mensagemCarregando.style.display='none';
    listaEntregas.innerHTML='';
    if(todasSolicitacoes.size===0){
      mensagemCarregando.textContent='Nenhum agendamento disponível no momento.';
      mensagemCarregando.style.display='block';
      listaEntregas.appendChild(mensagemCarregando);
      return;
    }
    const ordenadas = Array.from(todasSolicitacoes.values()).sort((a,b)=>b.dataOrdenacao-a.dataOrdenacao);
    ordenadas.forEach(s=> listaEntregas.appendChild(criarCardEntrega(s)) );
    // Quando houver apenas 1 card, centraliza para não ficar estranho; múltiplos permanecem ancorados à direita
    if (listaEntregas && listaEntregas.classList) {
      listaEntregas.classList.toggle('single', ordenadas.length === 1);
    }
  }

  function criarCardEntrega(s){
    const card = document.createElement('div');
    card.className='delivery-card';
    card.dataset.entregaId = s.id;
    const origem = s.origem?.endereco || s.localRetirada || '—';
    const destino = s.destino?.endereco || s.localEntrega || '—';
    const volsNum = Number(s.volumes||0);
    const tipoV = s.tipoVeiculo || s.tipoCaminhao || 'pequeno';
    let usouFallbackCentro = false;
    const distKm = (function(){
      try{
        const distInformada = Number(s.distancia);
        if (Number.isFinite(distInformada) && distInformada > 0) return distInformada;

        const toNum = (v)=> (v!=null && !Number.isNaN(Number(v)) ? Number(v) : null);
        const oLat = toNum(s.origem?.lat ?? s.origem?.coordenadas?.lat);
        const oLng = toNum(s.origem?.lng ?? s.origem?.coordenadas?.lng);
        const dLat = toNum(s.destino?.lat ?? s.destino?.coordenadas?.lat);
        const dLng = toNum(s.destino?.lng ?? s.destino?.coordenadas?.lng);

        const R = 6371; const toRad = (deg)=>deg*Math.PI/180;
        const calc = (lat1,lon1,lat2,lon2)=>{
          const dPhi=toRad(lat2-lat1), dLam=toRad(lon2-lon1);
          const a=Math.sin(dPhi/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLam/2)**2;
          return 2*R*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
        };

        if ([oLat,oLng,dLat,dLng].every(Number.isFinite)) return calc(oLat,oLng,dLat,dLng);
        if ([dLat,dLng].every(Number.isFinite)) { usouFallbackCentro = true; return calc(CENTRO_SP_REF.lat,CENTRO_SP_REF.lng,dLat,dLng); }
        if ([oLat,oLng].every(Number.isFinite)) { usouFallbackCentro = true; return calc(oLat,oLng,CENTRO_SP_REF.lat,CENTRO_SP_REF.lng); }

        return 1;
      }catch{ return 1; }
    })();
    // Se a distância está em fallback (1 km) ou NaN, tentar geocodificar e atualizar o card de forma assíncrona
    try{
      if (!Number.isFinite(distKm) || distKm === 1 || usouFallbackCentro){
        atualizarDistanciaAssincrona(s, card);
      }
    }catch{}

    // Função para atualizar distância assincronamente
    async function atualizarDistanciaAssincrona(solicitacao, cardElement) {
      try {
        const origem = solicitacao.origem?.endereco || solicitacao.localRetirada;
        const destino = solicitacao.destino?.endereco || solicitacao.localEntrega;
        
        if (!origem || !destino) return;

        // Geocodificar origem e destino
        const [coordOrigem, coordDestino] = await Promise.all([
          geocodificarEndereco(origem),
          geocodificarEndereco(destino)
        ]);

        if (coordOrigem && coordDestino) {
          // Calcular distância real
          const R = 6371; // Raio da Terra em km
          const toRad = (deg) => deg * Math.PI / 180;
          const dLat = toRad(coordDestino.lat - coordOrigem.lat);
          const dLng = toRad(coordDestino.lng - coordOrigem.lng);
          const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                   Math.cos(toRad(coordOrigem.lat)) * Math.cos(toRad(coordDestino.lat)) *
                   Math.sin(dLng/2) * Math.sin(dLng/2);
          const distanciaReal = 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

          // Atualizar o card com a distância real
          const distanciaEl = cardElement.querySelector('[data-distancia]');
          if (distanciaEl) {
            distanciaEl.textContent = `${distanciaReal.toFixed(2)} km`;
            distanciaEl.style.color = '#28a745'; // Verde para indicar que foi atualizada
          }

          // Atualizar no Firestore para cache futuro
          try {
            await db.collection('agendamentos').doc(solicitacao.id).update({
              'origem.lat': coordOrigem.lat,
              'origem.lng': coordOrigem.lng,
              'destino.lat': coordDestino.lat,
              'destino.lng': coordDestino.lng,
              distancia: distanciaReal,
              geocodificadoEm: firebase.firestore.FieldValue.serverTimestamp()
            });
          } catch (updateError) {
            console.warn('Falha ao atualizar coordenadas no Firestore:', updateError);
          }
        }
      } catch (error) {
        console.warn('Falha na geocodificação assíncrona:', error);
      }
    }

    const agTs = s.dataHoraAgendada?.seconds || s.dataAgendada?.seconds || null;
    let quando = '—';
    let dataLabel = '—';
    let horaLabel = '—';
    try{
      if (agTs){
        const dt = new Date(agTs*1000);
        dataLabel = dt.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric' });
        horaLabel = dt.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
        const diff = dt - new Date();
        if (diff <= 0) quando = 'Agora';
        else {
          const mins = Math.round(diff/60000);
          quando = mins < 60 ? `${mins}min` : `${Math.round(mins/60)}h`;
        }
      }
    }catch{}

    // Informações ao centro como no HomeM
    const distanciaLabel = (Number.isFinite(distKm) && distKm>0) ? `${distKm.toFixed(2)} km` : '---';
    const volumesLabel = volsNum>0 ? `${volsNum} itens` : '---';
    const tipoLabel = tipoV || '---';
    const clienteUid = s.clienteUid || s.clienteId || null;
    const clienteNome = s.clienteNome || 'Cliente';
    const fotoUrl = s.clienteFotoUrl || '';

    card.innerHTML = `
      <div class="ag-card">
        <div class="ag-accent"></div>
        <div class="ag-top" style="display:flex;align-items:center;justify-content:space-between;gap:12px">
          <div>
            <div class="ag-title">Entrega #${s.id.substring(0,6)}</div>
            <div style="font-size:.85rem;color:#666;margin-top:2px">${tempoPostado(s)}</div>
          </div>
          <div style="display:flex;align-items:center;gap:10px">
            <div title="${clienteNome}" style="display:flex;align-items:center;gap:8px" data-cliente-uid="${clienteUid||''}">
              <div class="avatar" style="width:34px;height:34px;border-radius:50%;overflow:hidden;background:#eee;display:inline-flex;align-items:center;justify-content:center;border:2px solid #ff6b35;">
                ${fotoUrl ? `<img src="${fotoUrl}" alt="foto" style="width:100%;height:100%;object-fit:cover">` : `<span class="avatar-inicial" style='font-size:.8rem;color:#555;font-weight:700'>${(clienteNome||'C').substring(0,1).toUpperCase()}</span>`}
              </div>
              <span class="cliente-nome" style="font-size:.9rem;color:#333;font-weight:600;max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${clienteNome}</span>
            </div>
          </div>
        </div>
        <div class="ag-info" style="display:flex;flex-wrap:wrap;gap:4px 10px;margin-top:10px;font-size:.9rem;">
          <div><strong>Origem:</strong> ${origem}</div>
          <div><strong>Destino:</strong> ${destino}</div>
          <div><strong>Distância:</strong> <span data-distancia>${distanciaLabel}</span></div>
          <div><strong>Volumes:</strong> ${volumesLabel}</div>
          <div><strong>Tipo de veículo:</strong> ${tipoLabel}</div>
          <div><strong>Data:</strong> ${dataLabel}</div>
          <div><strong>Horário:</strong> ${horaLabel}</div>
        </div>
      </div>`;
    return card;
  }

  function tempoPostado(s){
    try{
      const base = s.criadoEm?.toDate ? s.criadoEm.toDate().getTime() : (s.criadoEm?.seconds? s.criadoEm.seconds*1000 : (s.dataOrdenacao||Date.now()));
      const diff = Date.now() - base;
      const mins = Math.floor(diff/60000);
      if (mins < 1) return 'Agora';
      if (mins < 60) return `${mins}min atrás`;
      const horas = Math.floor(mins/60); if (horas < 24) return `${horas}h atrás`;
      const dias = Math.floor(horas/24); return `${dias}d atrás`;
    }catch{ return 'Agora'; }
  }

  function abrirModal(){
    if(!entregaSelecionadaId) return alert('Selecione um agendamento!');
    const s = todasSolicitacoes.get(entregaSelecionadaId);
    const distKm = distanciaEstimativaKmFromDoc(s);
    limitesPrecoAtuais = calcularLimitesPrecoPorDistancia(distKm);
    inputPrecoProposta.value=''; inputTempoProposta.value=''; inputAjudantesProposta.value='0'; inputVeiculoProposta.value='pequeno';
    inputPrecoProposta.min = limitesPrecoAtuais.min.toFixed(2);
    inputPrecoProposta.max = limitesPrecoAtuais.max.toFixed(2);
    garantirElementoDicaPreco().textContent = `Faixa permitida: R$ ${limitesPrecoAtuais.min.toFixed(2)} a R$ ${limitesPrecoAtuais.max.toFixed(2)} (base: R$ ${limitesPrecoAtuais.base.toFixed(2)})`;
    modalProposta.style.display='flex'; setTimeout(()=>{ modalProposta.style.opacity='1'; modalProposta.querySelector('.modal-content').style.transform='scale(1)'; },10);
  }
  function fecharModal(){ modalProposta.style.opacity='0'; modalProposta.querySelector('.modal-content').style.transform='scale(0.9)'; setTimeout(()=> modalProposta.style.display='none',300); }

  async function enviarProposta(){
    const precoBase = Number((inputPrecoProposta.value||'').replace(',','.'));
    const tempo = parseInt(inputTempoProposta.value,10);
    const ajud = parseInt(inputAjudantesProposta.value,10);
    const veic = inputVeiculoProposta.value;
    if(!entregaSelecionadaId) return alert('Selecione um agendamento.');
    if(!limitesPrecoAtuais) return alert('Faixa de preço indisponível.');
    if(!precoBase || precoBase<limitesPrecoAtuais.min || precoBase>limitesPrecoAtuais.max) return alert(`Valor fora da faixa (R$ ${limitesPrecoAtuais.min.toFixed(2)} - ${limitesPrecoAtuais.max.toFixed(2)})`);
    if(!tempo || tempo<=0) return alert('Informe o tempo até a retirada (min).');
    if(ajud<0||ajud>10) return alert('Número de ajudantes inválido.');

    const auth = firebase.auth();
    const idParaUsar = auth?.currentUser?.uid || null;
    if(!idParaUsar) return alert('Faça login como motorista.');

    const s = todasSolicitacoes.get(entregaSelecionadaId) || {};
    const collectionName = 'agendamentos';

    // cálculo alinhado ao HomeM: custo ajudantes + 10% taxa
    const custoAjud = ajud*50;
    const precoTotalMotorista = precoBase + custoAjud;
    const taxaPlataforma = 0.10;
    const precoCliente = Number((precoTotalMotorista * (1+taxaPlataforma)).toFixed(2));

    // buscar perfil do motorista
    let nomeMotorista = 'Motorista';
    let fotoMotoristaUrl = '';
    let telefoneMotorista = '';
    try {
      const mSnap = await db.collection('motoristas').doc(idParaUsar).get();
      if (mSnap.exists){
        const m = mSnap.data()||{};
        nomeMotorista = m?.dadosPessoais?.nome || m?.nome || nomeMotorista;
        fotoMotoristaUrl = m?.dadosPessoais?.fotoUrl || m?.fotoUrl || '';
        telefoneMotorista = m?.dadosPessoais?.telefone || m?.telefone || '';
      }
    } catch {}

    const propostaData = {
      preco: precoCliente,
      tempoChegada: tempo,
      ajudantes: ajud,
      veiculo: veic,
      precoOriginal: { base: Number(precoBase.toFixed(2)), ajudantes: Number(custoAjud.toFixed(2)), totalMotorista: Number(precoTotalMotorista.toFixed(2)), taxa: taxaPlataforma },
      motoristaUid: idParaUsar,
      motoristaId: idParaUsar,
      nomeMotorista,
      fotoMotoristaUrl,
      telefoneMotorista,
      dataEnvio: firebase.firestore.FieldValue.serverTimestamp(),
      gravadoPor: 'motorista'
    };
    try{
      await db.collection(collectionName).doc(entregaSelecionadaId)
        .collection('propostas').doc(idParaUsar).set(propostaData);
      await db.collection(collectionName).doc(entregaSelecionadaId)
        .set({ [`propostas.${idParaUsar}`]: propostaData, ultimaPropostaEm: firebase.firestore.FieldValue.serverTimestamp() }, { merge:true });
      alert('Proposta enviada com sucesso!'); fecharModal(); botaoEnviar.disabled=true;
    }catch(e){ console.error(e); alert('Falha ao enviar proposta.'); }
  }

  // Solicitações: apenas status aguardando_propostas_agendamento
  function carregarAgendados(){
    db.collection('agendamentos')
      .where('status', '==', 'aguardando_propostas_agendamento')
      .onSnapshot(snap=>{
        todasSolicitacoes.clear();
        snap.forEach(doc=>{
          const d = doc.data()||{};
          let ord = Date.now();
          try{
            if (d.criadoEm?.toDate) ord = d.criadoEm.toDate().getTime();
            else if (typeof d.criadoEm?.seconds === 'number') ord = d.criadoEm.seconds*1000;
            else if (typeof d.dataHoraAgendada?.seconds === 'number') ord = d.dataHoraAgendada.seconds*1000;
          }catch{}
          todasSolicitacoes.set(doc.id, { ...d, id: doc.id, dataOrdenacao: ord });
        });
        atualizarInterface();
      });
  }

  // Escuta propostas ACEITAS para este motorista com status 'agendado' e dispara popup próximo da hora
  function ouvirAgendamentosAceitos(){
    if (!motoristaUid) return;
    db.collection('agendamentos')
      .where('motoristaId','==', motoristaUid)
      .onSnapshot(snap=>{
        snap.docChanges().forEach(change=>{
          if (change.type !== 'added' && change.type !== 'modified') return;
          const d = change.doc.data()||{};
          if (!['agendamento_confirmado','corrida_agendamento_confirmado'].includes(d.status)) return;
          const modal = document.getElementById('modalPropostaAceita');
          if (modal){
            modal.classList.add('show');
            setTimeout(()=>{
              modal.classList.remove('show');
              // troca para aba Agendados
              const link = document.querySelector('.tab-link[data-tab="agendados"]');
              if (link) link.click();
            }, 1200);
          }
        });
      });
  }

  function abrirPopupAgendamento(id, colecao, d){
    const modal = document.getElementById('modal-proposta-motorista');
    if (!modal) return;
    document.getElementById('mm-nome-cliente').textContent = `Cliente: ${d.clienteNome || d.clienteId || 'Cliente'}`;
    const origem = d.origem?.endereco || d.localRetirada || '—';
    const destino = d.destino?.endereco || d.localEntrega || '—';
    const valor = Number(d.propostaAceita?.preco||0).toFixed(2);
    const tempo = d.propostaAceita?.tempoChegada || 0;
    const info = document.getElementById('mm-info-corrida');
    if (info) info.innerHTML = `
      <div><strong style="color:#ff6b35">Origem:</strong> ${origem}</div>
      <div><strong style="color:#ff6b35">Destino:</strong> ${destino}</div>
      <div><strong style="color:#ff6b35">Valor:</strong> R$ ${valor}</div>
      <div><strong style="color:#ff6b35">Tempo de chegada:</strong> ${tempo} min</div>`;
    modal.classList.remove('hidden');
    // ações
    const btnIniciar = document.getElementById('mm-iniciar');
    const btnCancelar = document.getElementById('mm-cancelar');
    if (btnIniciar) btnIniciar.onclick = ()=> iniciarCorridaAgendada(id, colecao, d);
    if (btnCancelar) btnCancelar.onclick = ()=> modal.classList.add('hidden');
  }

  async function iniciarCorridaAgendada(id, colecao, d){
    try{
      // Criar/atualizar corridas/{id}
      const corridaData = {
        tipo: colecao === 'descartes' ? 'descarte' : 'mudanca',
        clienteId: d.clienteId || null,
        motoristaId: motoristaUid,
        origem: d.origem || { endereco: d.localRetirada||'' },
        destino: d.destino || { endereco: d.localEntrega||'' },
        propostaAceita: d.propostaAceita || null,
        status: 'indo_retirar',
        criadoEm: firebase.firestore.FieldValue.serverTimestamp()
      };
      await db.collection('corridas').doc(id).set(corridaData, { merge:true });
      await db.collection('corridas').doc(id).collection('sync').doc('estado')
        .set({ fase:'indo_retirar', corridaId:id, tipo:corridaData.tipo }, { merge:true });
      // Atualizar doc de origem para em_corrida
      await db.collection(colecao).doc(id).set({ status:'em_corrida_agendamento', corridaIniciada:true, corridaIniciadaEm: firebase.firestore.FieldValue.serverTimestamp() }, { merge:true });

      localStorage.setItem('corridaSelecionada', id);
      localStorage.setItem('ultimaCorridaMotorista', id);
      const modal = document.getElementById('modal-proposta-motorista');
      if (modal) modal.classList.add('hidden');
      window.location.href = `rotaM.html?corrida=${encodeURIComponent(id)}`;
    }catch(e){
      console.error('Falha ao iniciar corrida agendada:', e);
      alert('Não foi possível iniciar a corrida.');
    }
  }

  listaEntregas.addEventListener('click', e=>{
    const card = e.target.closest('.delivery-card');
    if(card){
      document.querySelectorAll('.delivery-card').forEach(c=>c.classList.remove('selected'));
      card.classList.add('selected');
      entregaSelecionadaId = card.dataset.entregaId;
      botaoEnviar.disabled = false;
    }
  });

  botaoEnviar.addEventListener('click', abrirModal);
  botaoFecharModal.addEventListener('click', fecharModal);
  botaoConfirmarProposta.addEventListener('click', enviarProposta);
  // Autenticação e listeners
  firebase.auth().onAuthStateChanged(u=>{
    motoristaUid = u?.uid || null;
    carregarAgendados();
    if (motoristaUid) {
      ouvirAgendamentosAceitos();
      ouvirAgendadosDoMotorista();
    }
  });
})();

// Menu Toggle
document.getElementById('menuToggle').addEventListener('click', function() {
  const navMenu = document.getElementById('navMenu');
  navMenu.classList.toggle('show');
});

// Tab Functionality
document.addEventListener('DOMContentLoaded', function() {
  const tabLinks = document.querySelectorAll('.tab-link');
  const tabContents = document.querySelectorAll('.tab-content');

  tabLinks.forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      
      // Remove active class from all tabs and contents
      tabLinks.forEach(l => l.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      
      // Add active class to clicked tab
      this.classList.add('active');
      
      // Show corresponding content
      const tabId = this.getAttribute('data-tab');
      document.getElementById(tabId).classList.add('active');
      
      // Update button text based on active tab
      const submitBtn = document.getElementById('submitBtn');
      if (tabId === 'solicitacoes') {
        submitBtn.textContent = 'MANDAR PROPOSTA DE VALOR';
        submitBtn.style.display = 'block';
      } else {
        submitBtn.style.display = 'none';
      }
    });
  });
});

// Delivery card selection
document.addEventListener('click', function(e) {
  if (e.target.closest('.delivery-card')) {
    // Remove selected class from all cards
    document.querySelectorAll('.delivery-card').forEach(card => {
      card.classList.remove('selected');
    });
    
    // Add selected class to clicked card
    e.target.closest('.delivery-card').classList.add('selected');
    
    // Enable submit button
    document.getElementById('submitBtn').disabled = false;
  }
});

// Modal functionality
document.getElementById('submitBtn').addEventListener('click', function() {
  const selectedCard = document.querySelector('.delivery-card.selected');
  if (selectedCard) {
    document.getElementById('proposalModal').style.display = 'flex';
    document.getElementById('proposalModal').style.opacity = '1';
    document.querySelector('.modal-content').style.transform = 'scale(1)';
  }
});

document.getElementById('modalClose').addEventListener('click', function() {
  closeModal();
});

document.getElementById('proposalModal').addEventListener('click', function(e) {
  if (e.target === this) {
    closeModal();
  }
});

function closeModal() {
  const modal = document.getElementById('proposalModal');
  modal.style.opacity = '0';
  document.querySelector('.modal-content').style.transform = 'scale(0.9)';
  setTimeout(() => {
    modal.style.display = 'none';
  }, 300);
}

// O envio real da proposta está no handler enviarProposta()

// Simulate real-time updates
setInterval(function() {
  const loadingMessage = document.getElementById('loading-message');
  if (loadingMessage) {
    const messages = [
      'Buscando novos pedidos...',
      'Verificando disponibilidade...',
      'Atualizando propostas...'
    ];
    loadingMessage.textContent = messages[Math.floor(Math.random() * messages.length)];
  }
}, 3000);