document.addEventListener('DOMContentLoaded', function() {
  

  const tabSolicitar = document.getElementById('tab-solicitar');
  const tabAgendados = document.getElementById('tab-agendados');
  const formSection = document.querySelector('.form-section');
  

  let currentTab = 'solicitar';
  let viagensAgendadas = [];


  function ensureInfoModal(){
    let modal = document.getElementById('mm-info-modal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'mm-info-modal';
    modal.style.cssText = 'position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.35);z-index:9999;';
    modal.innerHTML = `
      <div id="mm-info-modal-content" style="background:#fff;border-radius:12px;min-width:280px;max-width:92vw;padding:20px 18px;box-shadow:0 10px 30px rgba(0,0,0,.15);transform:scale(.95);transition:transform .2s ease,opacity .2s ease;opacity:0">
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

  
  function ensureStartAgModalC(){
    let modal = document.getElementById('ag-start-modal-c');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'ag-start-modal-c';
    modal.style.cssText = 'position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.35);z-index:10000;';
    modal.innerHTML = `
      <div class="modal-content" style="background:#fff;border-radius:12px;min-width:300px;max-width:92vw;padding:20px;box-shadow:0 10px 30px rgba(0,0,0,.2);transform:scale(.96);transition:transform .2s ease,opacity .2s ease;opacity:0">
        <h3 style="margin:0 0 6px 0;color:#333">Está na hora do seu agendamento</h3>
        <p id="ag-start-text-c" style="margin:4px 0 12px 0;color:#555">Sua corrida está programada para agora.</p>
        <div style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap">
          <button id="ag-start-cancel" style="background:#e7e7e7;border:0;color:#111;border-radius:8px;padding:8px 12px;cursor:pointer">Depois</button>
          <button id="ag-start-go" style="background:#ff6b35;border:0;color:#fff;border-radius:8px;padding:8px 14px;cursor:pointer;font-weight:600">Iniciar</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e)=>{ if(e.target===modal) hideStartAgModalC(); });
    modal.querySelector('#ag-start-cancel').addEventListener('click', hideStartAgModalC);
    return modal;
  }
  function showStartAgModalC(msg, onStart){
    const modal = ensureStartAgModalC();
    modal.querySelector('#ag-start-text-c').textContent = msg || 'Sua corrida está programada para agora.';
    const go = modal.querySelector('#ag-start-go');
    go.onclick = ()=>{ try{ onStart && onStart(); }finally{ hideStartAgModalC(); } };
    modal.style.display = 'flex';
    requestAnimationFrame(()=>{
      const c = modal.querySelector('.modal-content'); c.style.opacity='1'; c.style.transform='scale(1)';
    });
  }
  function hideStartAgModalC(){
    const modal = document.getElementById('ag-start-modal-c'); if (!modal) return;
    const c = modal.querySelector('.modal-content'); c.style.opacity='0'; c.style.transform='scale(.96)';
    setTimeout(()=>{ modal.style.display='none'; }, 180);
  }

  
  function scheduleStartReminderCliente(v){
    try{
      if (!v?.id || !v?.data || !v?.hora) return;
      if (!window.__agStartTimersC) window.__agStartTimersC = {};
      if (window.__agStartTimersC[v.id]) return; 
      const ts = new Date(`${v.data}T${v.hora}:00`);
      if (!(ts instanceof Date) || isNaN(ts.getTime())) return;
      const now = new Date();
      const ms = ts.getTime() - now.getTime();
      const fire = async ()=>{
        try{
          
          const { firebase } = window; if (!firebase?.apps?.length) throw new Error('Firebase não inicializado');
          const db = firebase.firestore();
          const agRef = db.collection('agendamentos').doc(String(v.id));
          const agSnap = await agRef.get();
          const ag = agSnap.exists ? (agSnap.data()||{}) : {};
          const base = {
            clienteId: ag.clienteId || ag.clienteUid || firebase.auth()?.currentUser?.uid || null,
            motoristaId: ag.motoristaId || ag.propostaAceita?.motoristaUid || null,
            propostaAceita: ag.propostaAceita || null,
            tipoVeiculo: ag.tipoVeiculo || null,
            volumes: ag.volumes || null,
            origem: ag.origem || (ag.localRetirada ? { endereco: ag.localRetirada } : null),
            destino: ag.destino || (ag.localEntrega ? { endereco: ag.localEntrega } : null),
            agendamentoId: v.id,
            status: 'indo_retirar',
            criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
          };
          const corridaAgRef = db.collection('corridaagendamento').doc(String(v.id));
          await corridaAgRef.set(base, { merge: true });
          await corridaAgRef.collection('sync').doc('estado').set({ fase: 'indo_retirar' }, { merge: true });
          
          const corridaRef = db.collection('corridas').doc(String(v.id));
          const baseSemStatus = { ...base };
          try{ delete baseSemStatus.status; }catch{}
          await corridaRef.set(baseSemStatus, { merge: true });
          await corridaRef.collection('sync').doc('estado').set({ fase: 'indo_retirar' }, { merge: true });
          try{ localStorage.setItem('ultimaCorridaCliente', String(v.id)); }catch{}
        }catch(e){ console.warn('[agendamentoC] Falha ao preparar corrida agendada:', e?.message||e); }
        // Não mostrar modal para o cliente; fluxo de pagamento cuidará do redirecionamento
        delete window.__agStartTimersC[v.id];
      };
      if (ms <= 0){ fire(); return; }
      if (ms > 24*60*60*1000) return; 
      window.__agStartTimersC[v.id] = setTimeout(fire, ms);
    }catch{}
  }


  function switchTab(activeTab, tabName) {
     tabSolicitar.classList.remove('active');
    tabAgendados.classList.remove('active');
    

    activeTab.classList.add('active');
    currentTab = tabName;
    const propostasSection = document.getElementById('propostasSection');
    
    if (tabName === 'solicitar') {
     
      showSolicitarContent(); 

      if (propostasSection && propostasSection.dataset.active === 'true') {
        propostasSection.style.display = 'block';
      }

    } else if (tabName === 'agendados') {
      showAgendadosContent(); 
      
      if (propostasSection) {
        propostasSection.style.display = 'none';
      }
      document.querySelector('.form-section').style.display = 'none';
    }
  }


  function showSolicitarContent() {
    formSection.style.display = 'block';
    hideAgendadosContent();

    try {
      const abertoId = localStorage.getItem('agendamentoEmAberto');
      if (abertoId) {
        const propostasSection = document.getElementById('propostasSection');
        if (propostasSection) propostasSection.style.display = 'block';
      
        if (window.ouvirPropostasAgendamento && typeof window.ouvirPropostasAgendamento === 'function') {
          if (!window.__agendamentoListenId || window.__agendamentoListenId !== abertoId) {
            try { if (window.__propostasUnsub) { window.__propostasUnsub(); } } catch {}
            window.__propostasUnsub = window.ouvirPropostasAgendamento(abertoId);
            window.__agendamentoListenId = abertoId;
          }
        }
      }
    } catch {}
  }


  function showAgendadosContent() {
    formSection.style.display = 'none';
    renderAgendados();

    startAgendadosRealtime();
  }

  function goBackToSolicitar() {
    switchTab(tabSolicitar, 'solicitar');
  }

  function removeAgendadosContainer(){
    const agendadosContainer = document.getElementById('agendados-container');
    if (agendadosContainer) agendadosContainer.remove();
  }

  function hideAgendadosContent() {
    removeAgendadosContainer();
    
    stopAgendadosRealtime();
  }

  function startAgendadosRealtime(){
    try{
      const { firebase } = window;
      if (!firebase || !firebase.apps?.length) return;
      const db = firebase.firestore();
      const auth = firebase.auth();
 
      if (window.__agendadosUnsub) return;
      const attach = (uid)=>{
        if (!uid) return;
        if (window.__agendadosUnsub) return;
        window.__agendadosUnsub = db.collection('agendamentos')
          .where('clienteId','==', uid)
          .onSnapshot(()=>{
           
            renderAgendados();
          });
       
        renderAgendados();
      };
      const user = auth.currentUser || null;
      if (user && user.uid) attach(user.uid);
      else {
        const off = auth.onAuthStateChanged(u=>{ if(u?.uid){ attach(u.uid); off(); } });
      }
    }catch{}
  }

  function stopAgendadosRealtime(){
    try{ if (window.__agendadosUnsub){ window.__agendadosUnsub(); window.__agendadosUnsub = null; } }catch{}
  }

  async function renderAgendados() {

    removeAgendadosContainer();

    const agendadosContainer = document.createElement('section');
    agendadosContainer.id = 'agendados-container';
    agendadosContainer.className = 'agendados-section';

    const loading = document.createElement('div');
    loading.className = 'delivery-list-loading';
    loading.textContent = 'Carregando agendamentos...';
    agendadosContainer.appendChild(loading);


    const tabsElement = document.querySelector('.tabs');
    const mainEl = document.getElementById('main-content');
    const agendadosEl = document.getElementById('agendados') || document.querySelector('#agendados-content');
    if (tabsElement && tabsElement.insertAdjacentElement) {
      tabsElement.insertAdjacentElement('afterend', agendadosContainer);
    } else if (agendadosEl && agendadosEl.appendChild) {
      agendadosEl.innerHTML = '';
      agendadosEl.appendChild(agendadosContainer);
    } else if (mainEl && mainEl.appendChild) {
      mainEl.appendChild(agendadosContainer);
    } else {
      document.body.appendChild(agendadosContainer);
    }

    try{
      const { firebase } = window;
      const db = (firebase && firebase.apps && firebase.apps.length) ? firebase.firestore() : null;
      const user = firebase?.auth()?.currentUser || null;
      if (!db || !user){
        agendadosContainer.innerHTML = `<div class="empty-message"><i class="fa-solid fa-calendar-xmark"></i><h3>Nenhuma viagem agendada</h3><p>Entre para ver seus agendamentos.</p></div>`;
        return;
      }

      const qSnap = await db.collection('agendamentos')
        .where('clienteId', '==', user.uid)
        .limit(25)
        .get();

      viagensAgendadas = [];
      qSnap.forEach(doc=>{
        const d = doc.data()||{};
        // Filtra apenas confirmados
        if (!['agendamento_confirmado','corrida_agendamento_confirmado'].includes(d.status)) return;
        const dt = d.dataHoraAgendada?.toDate ? d.dataHoraAgendada.toDate() : null;
        const confDt = d.confirmadoEm?.toDate ? d.confirmadoEm.toDate() : null;
        const data = dt ? `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}` : '';
        const hora = dt ? `${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}` : '';
        const origem = d?.origem?.endereco || '-';
        const destino = d?.destino?.endereco || '-';
        const veiculo = d?.tipoVeiculo ? (String(d.tipoVeiculo).charAt(0).toUpperCase()+String(d.tipoVeiculo).slice(1)) : '-';
        const volumes = d?.volumes || '-';
        const motoristaUid = d?.propostaAceita?.motoristaUid || d?.motoristaId || null;
        const motorista = d?.propostaAceita?.nomeMotorista || '—';
        const telefone = d?.propostaAceita?.telefoneMotorista || '—';
        const preco = typeof d?.propostaAceita?.preco === 'number' ? `R$ ${d.propostaAceita.preco.toFixed(2).replace('.',',')}` : '—';
        viagensAgendadas.push({ id: doc.id, data, hora, origem, destino, veiculo, volumes, status: 'Confirmado', motorista, telefone, preco, motoristaUid, __confMs: confDt ? confDt.getTime() : 0 });
      });

  
      agendadosContainer.innerHTML = '';
      if (!viagensAgendadas.length){
        agendadosContainer.innerHTML = `<div class=\"empty-message\"><h3>Sem agendamentos no momento</h3></div>`;
        return;
      }

      viagensAgendadas.sort((a,b)=> (b.__confMs||0) - (a.__confMs||0));
      const cardsContainer = document.createElement('div');
      cardsContainer.className = 'cards-container';
      const list = document.createElement('div');
      list.style.display = 'flex';
      list.style.flexDirection = 'column';
      list.style.gap = '16px';

      try{ if(!window.__agCardUnsubs) window.__agCardUnsubs = {}; Object.values(window.__agCardUnsubs).forEach(fn=>{ try{fn();}catch{} }); window.__agCardUnsubs = {}; }catch{}

      viagensAgendadas.forEach(v=>{ 
        const card = createViagemCard(v); 
        list.appendChild(card);

        if ((v.motorista==='—' || v.telefone==='—') && v.motoristaUid){
          try{ preencherContatoMotorista(card, v.motoristaUid); }catch{}
        }

        try{ attachCardStatusListener(v.id, card); }catch{}

        try{ scheduleStartReminderCliente(v); }catch{}
        try{ attachPagamentoListenerAg(v.id); }catch{}
      });
      cardsContainer.appendChild(list);
      agendadosContainer.appendChild(cardsContainer);
    }catch(e){
      console.error('Falha ao carregar agendados', e);
      agendadosContainer.innerHTML = `<div class=\"empty-message\"><h3>Sem agendamentos no momento</h3></div>`;
    }
  }

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
    <button class="btn-start" title="Iniciar agora" onclick="iniciarAgendamentoAgora('${viagem.id}')"><i class="fa-solid fa-play"></i></button>
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
        
        ${viagem.motorista ? `
        <div class="driver-info">
          <div class="driver-details">
            <i class="fa-solid fa-user"></i>
            <span>Motorista: ${viagem.motorista}</span>
          </div>
          <div class="driver-contact">
            <i class="fa-solid fa-phone"></i>
            <span>${viagem.telefone}</span>
          </div>
        </div>
        ` : ''}
      </div>
    `;
    
    return card;
  }

  // ======== PAGAMENTO (AGENDAMENTO) ========
  function attachPagamentoListenerAg(agendamentoId){
    try{
      const { firebase } = window; if (!firebase?.apps?.length) return;
      const db = firebase.firestore();
      if (!window.__agPayUnsubs) window.__agPayUnsubs = {};
      if (window.__agPayUnsubs[agendamentoId]) return;
      const unsub = db.collection('corridas').doc(String(agendamentoId))
        .onSnapshot(async (doc)=>{
          if (!doc.exists) return;
          const d = doc.data()||{};
          const st = String(d.status||'').toLowerCase();
          if (d.clienteDevePagar === true && st === 'aguardando_pagamento'){
            try{
              const dados = await buscarDadosPagamentoAg(agendamentoId);
              await criarPagamentoMercadoPagoAg(dados);
            }catch(e){ console.error('[AG-PAGAMENTO] Erro ao processar pagamento:', e); alert('Erro ao iniciar pagamento. Tente novamente.'); }
            try{ unsub(); delete window.__agPayUnsubs[agendamentoId]; }catch{}
          }
        });
      window.__agPayUnsubs[agendamentoId] = unsub;
    }catch(e){ console.warn('[AG-PAGAMENTO] Falha ao anexar listener:', e?.message||e); }
  }

  async function buscarDadosPagamentoAg(corridaId){
    const { firebase } = window; const db = firebase.firestore();
    try{
      let data = null;
      try{ const s1 = await db.collection('corridas').doc(corridaId).get(); data = s1.exists ? (s1.data()||null) : null; }catch{}
      if (!data){ try{ const s2 = await db.collection('agendamentos').doc(corridaId).get(); data = s2.exists ? (s2.data()||null) : null; }catch{} }
      if (!data) throw new Error('Corrida não encontrada');
      const proposta = data.propostaAceita || {};
      const precoFinal = (function(){
        const candidatos = [proposta.precoFinal, proposta.preco, data.precoFinal, data.preco, data.valor];
        for (const c of candidatos){
          if (c === undefined || c === null || c === '') continue;
          const n = Number(String(c).replace(',', '.'));
          if (Number.isFinite(n) && n > 0) return n;
        }
        return 50; // fallback
      })();
      const valor = Math.round(Number(precoFinal) * 100) / 100;
      return {
        corridaId,
        valor: Number.isFinite(valor)&&valor>0 ? valor : 50,
        clienteId: data.clienteId || null,
        motoristaId: data.motoristaId || data.propostaAceita?.motoristaUid || null,
        tipo: 'agendamento',
        descricao: `Agendamento - ${String(corridaId).substring(0,8)}`
      };
    }catch(e){ console.error('[AG-PAGAMENTO] buscarDados', e); throw e; }
  }

  async function criarPagamentoMercadoPagoAg(dados){
    const { corridaId, valor, clienteId, descricao } = dados;
    const isVercel = /vercel\.app$/i.test(window.location.hostname);
    const apiBase = isVercel ? `${window.location.origin}/api` : 'http://localhost:3000';
    const items = [{ title: descricao, quantity: 1, unit_price: Number(valor), currency_id: 'BRL' }];
    const pagesBase = isVercel ? window.location.origin : 'http://localhost:3000';
    const back_urls = {
      success: `${pagesBase}/pagamento-sucesso.html?corrida=${encodeURIComponent(corridaId)}&status=approved&valor=${valor}&tipo=agendamento`,
      failure: `${pagesBase}/pagamento-erro.html?corrida=${encodeURIComponent(corridaId)}&tipo=agendamento`,
      pending: `${pagesBase}/pagamento-erro.html?corrida=${encodeURIComponent(corridaId)}&tipo=agendamento`
    };
    const payer = { email: (firebase.auth?.currentUser?.email) || `${(clienteId||'cliente')}@moomate.app`, name: 'Cliente Moomate' };
    const createUrl = isVercel ? `${apiBase}/create_preference` : `${apiBase}/create-mercadopago-preference`;
    let resp = await fetch(createUrl, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ items, payer, payment_methods:{}, back_urls, external_reference: corridaId, auto_return:'approved' }) });
    if (!resp.ok){
      resp = await fetch('https://moomate-omrw.vercel.app/api/create_preference', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ corridaId, valor:Number(valor), clienteId, items, payer, back_urls, auto_return:'approved' }) });
      if (!resp.ok){ const txt = await resp.text(); throw new Error(`HTTP ${resp.status}: ${txt||'sem mensagem'}`); }
    }
    const data = await resp.json();
    const prefUrl = data.init_point || data.sandbox_init_point || data.url || null;
    if (!prefUrl) throw new Error('Preferência sem URL');
    try{ localStorage.setItem('lastPayment', JSON.stringify({ corridaId, valor })); }catch{}
    window.location.href = prefUrl;
  }
  // ======== FIM PAGAMENTO ========

  window.iniciarAgendamentoAgora = async function(agendamentoId){
    try{
      const { firebase } = window; if (!firebase?.apps?.length) return alert('Serviço indisponível.');
      const db = firebase.firestore();
      const uid = firebase.auth()?.currentUser?.uid || null;
      if (!uid) { alert('Entre para iniciar sua corrida.'); return; }

      const agRef = db.collection('agendamentos').doc(String(agendamentoId));
      const agSnap = await agRef.get();
      const ag = agSnap.exists ? (agSnap.data()||{}) : {};
      const base = {
        clienteId: ag.clienteId || ag.clienteUid || uid,
        motoristaId: ag.motoristaId || ag.propostaAceita?.motoristaUid || null,
        propostaAceita: ag.propostaAceita || null,
        tipoVeiculo: ag.tipoVeiculo || null,
        volumes: ag.volumes || null,
        origem: ag.origem || (ag.localRetirada ? { endereco: ag.localRetirada } : null),
        destino: ag.destino || (ag.localEntrega ? { endereco: ag.localEntrega } : null),
        agendamentoId: agendamentoId,
        status: 'indo_retirar',
        criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
      };

 
      await agRef.set({ status: 'indo_retirar', confirmadoEm: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
      await agRef.collection('sync').doc('estado').set({ fase: 'indo_retirar' }, { merge: true });

      const corridaAgRef = db.collection('corridaagendamento').doc(String(agendamentoId));
      await corridaAgRef.set(base, { merge: true });
      await corridaAgRef.collection('sync').doc('estado').set({ fase: 'indo_retirar' }, { merge: true });

      const corridaRef = db.collection('corridas').doc(String(agendamentoId));
      const baseSemStatus = { ...base };
      try{ delete baseSemStatus.status; }catch{}
      await corridaRef.set(baseSemStatus, { merge: true });
      await corridaRef.collection('sync').doc('estado').set({ fase: 'indo_retirar' }, { merge: true });

      try{ localStorage.setItem('ultimaCorridaCliente', String(agendamentoId)); }catch{}


      window.location.href = `statusA.html?corrida=${encodeURIComponent(agendamentoId)}`;
    }catch(e){
      console.error('[agendamentoC] Falha ao iniciar agora:', e);
      alert('Não foi possível iniciar a corrida agora. Tente novamente.');
    }
  };


  async function preencherContatoMotorista(cardEl, motoristaUid){
    try{
      const { firebase } = window; if (!firebase?.apps?.length) return;
      const db = firebase.firestore();
      const snap = await db.collection('motoristas').doc(String(motoristaUid)).get();
      if (!snap.exists) return;
      const d = snap.data()||{};
      const nome = d?.dadosPessoais?.nome || d?.nome || null;
      const tel = d?.dadosPessoais?.telefone || d?.telefone || null;
      if (nome){ const el = cardEl.querySelector('.driver-details span'); if (el) el.textContent = `Motorista: ${nome}`; }
      if (tel){ const el2 = cardEl.querySelector('.driver-contact span'); if (el2) el2.textContent = tel; }
    }catch{}
  }

 
  function attachCardStatusListener(agendamentoId, cardEl){
    try{
      const { firebase } = window; if (!firebase?.apps?.length) return;
      const db = firebase.firestore();
      const ref = db.collection('agendamentos').doc(String(agendamentoId));
      const unsub = ref.onSnapshot(snap=>{
        if (!snap.exists) { try{ cardEl.remove(); }catch{}; return; }
        const d = snap.data()||{};
        const status = String(d.status||'').toLowerCase();
        const confirmados = ['agendamento_confirmado','corrida_agendamento_confirmado'];
        if (!confirmados.includes(status)){

          if (status === 'corrida_agendamento_cancelado' && !cardEl.dataset.modalShown){
            try{ showInfoModal('Agendamento cancelado', 'O motorista cancelou seu agendamento.'); cardEl.dataset.modalShown = '1'; }catch{}
          }
          try{ cardEl.remove(); }catch{}
        }
      });
      if (!window.__agCardUnsubs) window.__agCardUnsubs = {};
      window.__agCardUnsubs[agendamentoId] = unsub;
    }catch{}
  }

  function getStatusClass(status) {
    switch (status.toLowerCase()) {
      case 'confirmado':
        return 'status-confirmed';
      case 'aguardando':
        return 'status-pending';
      case 'em andamento':
        return 'status-progress';
      case 'finalizado':
        return 'status-completed';
      case 'cancelado':
        return 'status-cancelled';
      default:
        return 'status-default';
    }
  }


  function formatDate(dateString) {
    try{

      if (/^\d{4}-\d{2}-\d{2}$/.test(String(dateString||''))){
        const [y,m,d] = String(dateString).split('-');
        return `${d}/${m}/${y}`;
      }
      const date = new Date(dateString);
      return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }catch{ return String(dateString||''); }
  }

  window.cancelViagem = async function(agendamentoId) {
    try{
      if (!window.firebase || !firebase.apps.length) return alert('Serviço indisponível.');
      const db = firebase.firestore();
      if (!confirm('Deseja realmente cancelar este agendamento?')) return;

      await db.collection('agendamentos').doc(String(agendamentoId)).set({ status: 'cancelado_agendamento', canceladoEm: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });

      await renderAgendados();
    }catch(e){ console.error('Falha ao cancelar', e); alert('Erro ao cancelar agendamento.'); }
  };

  tabSolicitar.addEventListener('click', () => switchTab(tabSolicitar, 'solicitar'));
  tabAgendados.addEventListener('click', () => switchTab(tabAgendados, 'agendados'));

  const menuToggle = document.getElementById('menuToggle');
  const navMenu = document.getElementById('navMenu');

  if (menuToggle && navMenu) {
    menuToggle.addEventListener('click', () => {
      navMenu.classList.toggle('show');
    });
  }

  const cepInput = document.getElementById('cep');
  if (cepInput) {
    cepInput.addEventListener('input', function(e) {
      let value = e.target.value.replace(/\D/g, '');
      value = value.replace(/(\d{5})(\d)/, '$1-$2');
      e.target.value = value;
    });
  }

  if (cepInput) {
    cepInput.addEventListener('blur', function() {
      const cep = this.value.replace(/\D/g, '');
      if (cep.length === 8) {
        consultarCEP(cep);
      }
    });
  }

  function consultarCEP(cep) {
    fetch(`https://viacep.com.br/ws/${cep}/json/` )
      .then(response => response.json())
      .then(data => {
        if (!data.erro) {
          const localRetirada = document.getElementById('localRetirada');
          if (localRetirada) {
            localRetirada.value = `${data.logradouro}, ${data.bairro} - ${data.localidade}, ${data.uf}`;
          }
        }
      })
      .catch(error => {
        console.error('Erro ao consultar CEP:', error);
      });
  }

  showSolicitarContent();

  console.log('Sistema de tabs inicializado com sucesso!');

  window.testarPropostas = function() {
    document.getElementById('propostasSection').style.display = 'block';
    console.log('Seção de propostas mostrada!');
  };
});


(function(){
  document.addEventListener('DOMContentLoaded', function(){
    const { firebase } = window;
    const db = (firebase && firebase.apps && firebase.apps.length) ? firebase.firestore() : null;

    
    const cepInput = document.getElementById('cep');
    const localRetirada = document.getElementById('localRetirada');
    const localEntrega = document.getElementById('localEntrega');
    const cepEntregaInput = document.getElementById('cepEntrega');
    const dataAgendamento = document.getElementById('dataAgendamento');
    const horaAgendamento = document.getElementById('horaAgendamento');
    const btnConfirmar = document.getElementById('confirmarAgendamento');


    const SP_BOUNDS = { north: -19.80, south: -25.30, east: -44.20, west: -53.10 };
    function estaDentroDeSaoPaulo(lat, lng){
      return lat <= SP_BOUNDS.north && lat >= SP_BOUNDS.south && lng <= SP_BOUNDS.east && lng >= SP_BOUNDS.west;
    }
    function isCEPSaoPaulo(cep){
      const n = parseInt(String(cep||'').replace(/\D/g,''),10);
      return Number.isFinite(n) && n >= 1000000 && n <= 19999999; 
    }
    function formatarCEP(cep){
      cep = String(cep||'').replace(/\D/g,'');
      return cep.length===8 ? `${cep.substring(0,5)}-${cep.substring(5)}` : cep;
    }
    
    function isEnderecoSP(addressObj, lat, lon){
      try{
        
        if (Number.isFinite(lat) && Number.isFinite(lon) && estaDentroDeSaoPaulo(lat, lon)) return true;
        const addr = addressObj || {};
        const state = (addr.state||'').toLowerCase();
        const stateCode = (addr.state_code||'').toLowerCase();
        
        if (state.includes('são paulo') || state === 'sp') return true;
        if (stateCode === 'sp') return true;

        for (const k of Object.keys(addr)){
          if (k.toLowerCase().startsWith('iso3166-2') && String(addr[k]).toUpperCase() === 'BR-SP') return true;
        }
      }catch{}
      return false;
    }

    function textoIndicaSP(texto, cepPossivel){
      try{
        const t = String(texto||'').toLowerCase();
        if (t.includes(' são paulo') || t.includes('são paulo') || /\bsp\b/.test(t)) return true;
        const cepMatch = String(texto||'').match(/\b\d{5}-?\d{3}\b/);
        if (cepMatch && isCEPSaoPaulo(cepMatch[0])) return true;
        if (cepPossivel && isCEPSaoPaulo(cepPossivel)) return true;
      }catch{}
      return false;
    }

    if (cepInput){
      cepInput.addEventListener('blur', async function(){
        const cep = this.value.replace(/\D/g,'');
        if (cep.length !== 8) return;
        if (!isCEPSaoPaulo(cep)) { alert('Por favor, informe um CEP do estado de São Paulo.'); this.value=''; return; }
        try{
          const res = await fetch(`https://viacep.com.br/ws/${cep}/json/` );
          const data = await res.json();
          if (data.erro || data.uf !== 'SP') { alert('CEP não pertence ao estado de São Paulo.'); this.value=''; return; }
          if (localRetirada){
            localRetirada.value = `${data.logradouro}, ${data.bairro} - ${data.localidade}, ${data.uf}`;
            try{ if (data.uf === 'SP') setSpHint('localRetirada', true); }catch{}
          }
        }catch(e){ console.error('Erro ao consultar CEP:', e); }
      });
    }


    if (cepEntregaInput){

      cepEntregaInput.addEventListener('input', function(e){
        let v = String(e.target.value||'').replace(/\D/g,'');
        if (v.length > 8) v = v.slice(0,8);
        if (v.length >= 6) e.target.value = `${v.slice(0,5)}-${v.slice(5)}`; else e.target.value = v;
      });
      cepEntregaInput.addEventListener('blur', async function(){
        const cep = this.value.replace(/\D/g,'');
        if (cep.length !== 8) return;
        if (!isCEPSaoPaulo(cep)) { alert('Por favor, informe um CEP do estado de São Paulo.'); this.value=''; return; }
        try{
          const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
          const data = await res.json();
          if (data.erro || data.uf !== 'SP') { alert('CEP não pertence ao estado de São Paulo.'); this.value=''; return; }
          if (localEntrega){
            localEntrega.value = `${data.logradouro}, ${data.bairro} - ${data.localidade}, ${data.uf}`;
            try{ if (data.uf === 'SP') setSpHint('localEntrega', true); }catch{}
          }
        }catch(e){ console.error('Erro ao consultar CEP (entrega):', e); }
      });
    }


    let autocompleteTimers = {};

    (function injectAutocompleteStyles(){
      const styleId = 'autocomplete-style-agendamento';
      if (document.getElementById(styleId)) return;
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        .autocomplete-items {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          background: #fff;
          border: 1px solid #ddd;
          border-top: none;
          z-index: 1000;
          max-height: 220px;
          overflow-y: auto;
          border-radius: 0 0 8px 8px;
          box-shadow: 0 6px 14px rgba(0,0,0,0.08);
        }
        .autocomplete-items div {
          padding: 10px 12px;
          cursor: pointer;
          border-bottom: 1px solid #f3f3f3;
          font-size: 0.95rem;
          color: #333;
        }
        .autocomplete-items div:hover {
          background: #fff5ef;
        }
        .autocomplete-items::-webkit-scrollbar { width: 6px; }
        .autocomplete-items::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 3px; }
        .autocomplete-items::-webkit-scrollbar-thumb { background: #ccc; border-radius: 3px; }
        .autocomplete-items::-webkit-scrollbar-thumb:hover { background: #999; }
        .input-box { position: relative; }
        .autocomplete-items { animation: slideDown 0.2s ease-out; }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-4px);} to { opacity: 1; transform: translateY(0);} }
      `;
      document.head.appendChild(style);
    })();

    
    if (localEntrega){
      localEntrega.addEventListener('blur', async function(){
        try{
          const txt = String(localEntrega.value||'').trim();
          if (!txt) return;
          const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=1&countrycodes=br&q=${encodeURIComponent(txt)}`;
          const resp = await fetch(url, { headers: { 'Accept-Language':'pt-BR','User-Agent':'MoomateApp/1.0' } });
          if (!resp.ok) return;
          const arr = await resp.json();
          const hit = Array.isArray(arr) ? arr[0] : null;
          if (!hit) return;
          const addr = hit.address || {};
          const postcode = String(addr.postcode||'').replace(/\D/g,'');
          if (postcode && isCEPSaoPaulo(postcode) && cepEntregaInput){
            cepEntregaInput.value = formatarCEP(postcode);
          }
        }catch(e){ console.warn('Falha ao obter CEP por endereço de entrega:', e?.message||e); }
      });
    }
    function fecharAutocomplete(campo){ const c = document.getElementById(`autocomplete-list-${campo}`); if (c) c.style.display='none'; }
    function mostrarListaAutocomplete(campo, data){
      let container = document.getElementById(`autocomplete-list-${campo}`);
      if (!container){
        container = document.createElement('div');
        container.id = `autocomplete-list-${campo}`;
        container.className = 'autocomplete-items';
        const parent = document.getElementById(campo)?.parentNode; if (parent) parent.appendChild(container);
      }
      container.innerHTML = '';
      if (!data.length){ container.style.display='none'; return; }
      data.forEach(item=>{
        const div = document.createElement('div');
        div.textContent = item.display_name;
        div.addEventListener('click', ()=>{ selecionarItemAutocomplete(campo, item); fecharAutocomplete(campo); });
        container.appendChild(div);
      });
      container.style.display='block';
    }

    function setSpHint(fieldId, ok){
      const input = document.getElementById(fieldId);
      if (!input) return;
      let hint = input.parentElement.querySelector('.sp-hint');
      if (!hint){
        hint = document.createElement('small');
        hint.className = 'sp-hint';
        hint.style.display = 'block';
        hint.style.marginTop = '6px';
        hint.style.fontSize = '12px';
        input.parentElement.appendChild(hint);
      }
      
    }
    async function selecionarItemAutocomplete(campo, item){
      const input = document.getElementById(campo);
      if (!input) return;
      input.value = item.display_name;
      const lat = parseFloat(item.lat), lon = parseFloat(item.lon);
      if (!estaDentroDeSaoPaulo(lat, lon)) { alert('Selecione um endereço dentro do estado de São Paulo.'); return; }
      if (campo === 'localRetirada' && cepInput){
        const pc = (item.address?.postcode||'').replace(/\D/g,'');
        cepInput.value = isCEPSaoPaulo(pc) ? formatarCEP(pc) : '';
      }

      setSpHint(campo, true);
    }
    async function autocompleteEndereco(campo){
      clearTimeout(autocompleteTimers[campo]);
      autocompleteTimers[campo] = setTimeout(async ()=>{
        const val = (document.getElementById(campo)?.value||'').trim();
        if (val.length < 3) return fecharAutocomplete(campo);
        const q = (val.toLowerCase().includes('são paulo') || val.includes('SP')) ? val : `${val}, São Paulo, Brasil`;
        try{
          const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q )}&addressdetails=1&limit=10&countrycodes=br`;
          const res = await fetch(url);
          const data = await res.json();
          const spOnly = data.filter(item=>{
            const lat = parseFloat(item.lat), lon = parseFloat(item.lon);
            const st = (item.address?.state||'').toLowerCase();
            return estaDentroDeSaoPaulo(lat, lon) && (st.includes('são paulo') || st.includes('sp') || item.display_name.toLowerCase().includes('são paulo'));
          });
          mostrarListaAutocomplete(campo, spOnly);
        }catch(e){ console.error('Autocomplete falhou', e); }
      }, 300);
    }

    if (localRetirada){
      localRetirada.addEventListener('input', ()=> autocompleteEndereco('localRetirada'));
      localRetirada.addEventListener('blur', async ()=>{
        const val = localRetirada.value.trim(); if (!val) return;
        try{
          const q = val.toLowerCase().includes('são paulo') || val.includes('SP') ? val : `${val}, São Paulo, Brasil`;
          const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=1&countrycodes=br
&q=${encodeURIComponent(q)}`);
          const data = await res.json();
          if (!data[0]) { setSpHint('localRetirada', false); return; }
          const lat = parseFloat(data[0].lat), lon = parseFloat(data[0].lon);
          if (!isEnderecoSP(data[0].address, lat, lon)) {
    
            const cepVal = (document.getElementById('cep')?.value||'').replace(/\D/g,'');
            if (!textoIndicaSP(val, cepVal)) {
              alert('Este endereço não aparenta ser do estado de São Paulo.');
            }
            setSpHint('localRetirada', false);
          } else { setSpHint('localRetirada', true); }
          const pc = (data[0].address?.postcode||'').replace(/\D/g,'');
          if (cepInput && pc && isCEPSaoPaulo(pc)) cepInput.value = formatarCEP(pc);
        }catch(e){ console.warn('Falha ao validar endereço de retirada', e); }
      });
    }
    if (localEntrega){
      localEntrega.addEventListener('input', ()=> autocompleteEndereco('localEntrega'));
      localEntrega.addEventListener('blur', async ()=>{
        const val = localEntrega.value.trim(); if (!val) return;
        try{
          const q = val.toLowerCase().includes('são paulo') || val.includes('SP') ? val : `${val}, São Paulo, Brasil`;
          const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=1&countrycodes=br&q=${encodeURIComponent(q )}`);
          const data = await res.json();
          if (!data[0]) { alert('Endereço inválido. Use um endereço de São Paulo.'); setSpHint('localEntrega', false); return; }
          const lat = parseFloat(data[0].lat), lon = parseFloat(data[0].lon);
          if (!isEnderecoSP(data[0].address, lat, lon)) {
            const cepVal = (document.getElementById('cep')?.value||'').replace(/\D/g,'');
            if (!textoIndicaSP(val, cepVal)) {
              alert('Este endereço não aparenta ser do estado de São Paulo.');
            }
            setSpHint('localEntrega', false);
          } else { setSpHint('localEntrega', true); }
        }catch(e){ console.warn('Falha ao validar endereço de entrega', e); }
      });
    }
    try{
      const dataBox = document.getElementById('dataAgendamento')?.closest('.input-box');
      const horaBox = document.getElementById('horaAgendamento')?.closest('.input-box');
      if (dataBox && horaBox && dataBox.parentElement === horaBox.parentElement){
        const row = document.createElement('div');
        row.className = 'row-two-cols';
        row.style.display = 'grid';
        row.style.gridTemplateColumns = '1fr 1fr';
        row.style.gap = '12px';
        dataBox.parentElement.insertBefore(row, dataBox);
        row.appendChild(dataBox);
        row.appendChild(horaBox);
      }
    }catch{}

    if (dataAgendamento){
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth()+1).padStart(2,'0');
      const dd = String(now.getDate()).padStart(2,'0');
      dataAgendamento.min = `${yyyy}-${mm}-${dd}`;
      const atualizarMinHora = ()=>{
        if (!horaAgendamento) return;
        const sel = dataAgendamento.value; if (!sel) return;
        const hoje = new Date();
        const selDate = new Date(sel+'T00:00:00');
        if (selDate.toDateString() === hoje.toDateString()){
          const hh = String(hoje.getHours()).padStart(2,'0');
          const mi = String(hoje.getMinutes()).padStart(2,'0');
          horaAgendamento.min = `${hh}:${mi}`;
        } else {
          horaAgendamento.removeAttribute('min');
        }
      };
      dataAgendamento.addEventListener('change', atualizarMinHora);
      atualizarMinHora();
    }

    async function obterUsuarioAtualAsync(timeoutMs = 4000){
      try{
        const auth = firebase?.auth();
        const immediate = auth?.currentUser || null;
        if (immediate) return immediate;
        return await new Promise(resolve=>{
          let done=false; const to=setTimeout(()=>{ if(!done){done=true; resolve(null);} }, timeoutMs);
          auth.onAuthStateChanged(u=>{ if(!done){done=true; clearTimeout(to); resolve(u||null);} });
        });
      }catch{ return null; }
    }
    async function getClienteNome(uid){
      if (!uid || !db) return 'Cliente';
      try{
        let s = await db.collection('usuarios').doc(uid).get();
        if (!s.exists) s = await db.collection('clientes').doc(uid).get();
        const d = s.exists ? (s.data()||{}) : {};
        return d?.dadosPessoais?.nome || d?.nome || 'Cliente';
      }catch{ return 'Cliente'; }
    }
async function ouvirPropostasAgendamento(id) {
    if (!db || !id) return;

    const agRef = db.collection('agendamentos').doc(id);
    let origemTxt = '—', destinoTxt = '—';

    try {
        const agSnap = await agRef.get();
        const ag = agSnap.exists ? (agSnap.data() || {}) : {};
        origemTxt = ag?.origem?.endereco || ag?.localRetirada || origemTxt;
        destinoTxt = ag?.destino?.endereco || ag?.localEntrega || destinoTxt;
    } catch (e) {
        console.warn("Falha ao buscar detalhes do agendamento:", e);
    }

    const cacheMotoristas = {};

     async function getMotorista(uid) {
        console.log("[AGENDAMENTO] Buscando motorista:", uid);
        if (!uid) return { nome: "Motorista", foto: null, nota: 0 };
        if (cacheMotoristas[uid]) return cacheMotoristas[uid];

        try {
            const snap = await db.collection("motoristas").doc(uid).get();
            if (!snap.exists) {
                console.log("[AGENDAMENTO] Motorista não encontrado:", uid);
                return { nome: "Motorista", foto: null, nota: 0 };
            }
            
            const data = snap.data() || {};
            
            const nome = data?.dadosPessoais?.nome || data?.nome || "Motorista";
            const foto = data?.dadosPessoais?.fotoPerfilUrl || data?.fotoPerfilUrl || null;

            let nota = 0;
            if (typeof data.avaliacaoMedia === 'number') {
                nota = data.avaliacaoMedia;
            } else if (typeof data.media === 'number') {
                nota = data.media;
            } else if (data.ratingSum && data.ratingCount) {
                nota = Number(data.ratingSum) / Number(data.ratingCount);
            }

            console.log(`[AGENDAMENTO] ${nome}: nota=${nota.toFixed(1)} (avaliacaoMedia=${data.avaliacaoMedia}, media=${data.media})`);

            const motoristaInfo = { nome, foto, nota: Number(nota) || 0 };
            cacheMotoristas[uid] = motoristaInfo;
            return motoristaInfo;

        } catch (error) {
            console.error("[AGENDAMENTO] Erro ao carregar motorista:", error);
            return { nome: "Motorista", foto: null, nota: 0 };
        }
    }

    const unsub = agRef.collection('propostas').orderBy('dataEnvio', 'asc')
        .onSnapshot(async snap => {
            const container = document.getElementById('propostasContainer');
            if (!container) return;

            if (snap.empty) {
                container.innerHTML = `<h3>Propostas Recebidas</h3><p>Aguardando propostas dos motoristas...</p>`;
                return;
            }

            container.innerHTML = `<h3>Propostas Recebidas</h3><div id="lista-propostas"></div>`;
            const lista = document.getElementById('lista-propostas');
            lista.innerHTML = '';

            for (const d of snap.docs) {
                const p = d.data() || {};
                const uidM = p.motoristaUid || d.id;
                
                const motorista = await getMotorista(uidM);

                const nome = motorista.nome;
                const fotoUrl = motorista.foto;
                const avaliacao = motorista.nota;

                const preco = Number(p.preco || 0).toFixed(2).replace('.', ',');
                const tempo = p.tempoChegada || 0;
                // Extrai a quantidade de ajudantes do objeto ajudantes, se existir
                const qtdAjudantes = p.ajudantes && typeof p.ajudantes === 'object' 
                    ? (p.ajudantes.quantidade || 0) 
                    : (Number(p.ajudantes) || 0);
                const veic = p.veiculo || '-';

                const card = document.createElement('div');
                card.className = 'card-proposta-motorista';

                card.innerHTML = `
                    <div class="card-proposta-motorista-content">
                        <div class="card-proposta-motorista-accent"></div>
                        <div class="card-proposta-motorista-perfil">
                            <div class="card-proposta-motorista-avatar">
                                ${fotoUrl ? `<img src="${fotoUrl}" alt="Foto de ${nome}">` : `<span class="card-proposta-motorista-avatar-inicial">${nome.substring(0,1).toUpperCase()}</span>`}
                            </div>
                            <div class="card-proposta-motorista-info">
                                <div class="nome">${nome}</div>
                                <div class="rating"><i class="fa-solid fa-star"></i> ${avaliacao.toFixed(1)}</div>
                            </div>
                        </div>
                        <div class="card-proposta-motorista-detalhes">
                            <div class="corrida-id">Corrida #${String(id).substring(0,6)}</div>
                            <div class="rota"><strong>De:</strong> ${origemTxt}</div>
                            <div class="rota"><strong>Para:</strong> ${destinoTxt}</div>
                            <div class="specs">
                                <span><strong>Veículo:</strong> ${veic}</span>
                                <span><strong>Ajudantes:</strong> ${qtdAjudantes}</span>
                            </div>
                        </div>
                        <div class="card-proposta-motorista-valor">
                            <div class="preco">R$ ${preco}</div>
                            <button class="aceitar-btn" id="aceitar-${d.id}">ACEITAR PROPOSTA</button>
                        </div>
                    </div>`;

                lista.appendChild(card);
                const b = document.getElementById(`aceitar-${d.id}`);
                if (b) {
                    b.addEventListener('click', () => aceitarPropostaAgendamento(id, d.id, uidM));
                }
            }
        });
    return unsub;
}


window.ouvirPropostasAgendamento = ouvirPropostasAgendamento;

    async function aceitarPropostaAgendamento(agendamentoId, propostaId, motoristaUid){
      if (!db) return alert('Firebase indisponível.');
      try{
        const snap = await db.collection('agendamentos').doc(agendamentoId).collection('propostas').doc(propostaId).get();
        if (!snap.exists) return alert('Proposta não encontrada.');
        const propostaData = snap.data();
        const user = firebase?.auth()?.currentUser || null;
        const clienteUid = user?.uid || propostaData?.clienteUid || null;
        await db.collection('agendamentos').doc(agendamentoId).set({ 
          status:'corrida_agendamento_confirmado', 
          motoristaId: motoristaUid, 
          clienteId: clienteUid || firebase.firestore.FieldValue.delete(),
          propostaAceita:{ motoristaUid, ...propostaData }, 
          confirmadoEm: firebase.firestore.FieldValue.serverTimestamp() 
        }, { merge:true });

        try{
          const notifRef = db.collection('notificacoes');
          const payload = {
            tipo: 'agendamento_confirmado',
            agendamentoId,
            motoristaUid,
            clienteUid,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            mensagem: 'Seu agendamento foi confirmado.'
          };
          if (clienteUid) await notifRef.add({ ...payload, destinatario: clienteUid });
          if (motoristaUid) await notifRef.add({ ...payload, destinatario: motoristaUid });
        }catch(err){ console.warn('Falha ao registrar notificações', err); }

        try { localStorage.removeItem('agendamentoEmAberto'); } catch {}

        const propSec = document.getElementById('propostasSection');
        if (propSec) propSec.style.display = 'none';
        try{
          const modal = document.getElementById('modalPropostaAceita');
          if (modal){
            modal.classList.add('show');
            setTimeout(()=>{
              modal.classList.remove('show');
              const t = document.getElementById('tab-agendados');
              if (t) t.click();
              setTimeout(()=>{ try{ renderAgendados(); }catch{} }, 400);
            }, 1200);
          } else {
    
            const t = document.getElementById('tab-agendados'); if (t) t.click();
          }
        }catch{}
      }catch(e){ console.error(e); alert('Falha ao aceitar proposta.'); }
    }
    async function finalizarAgendamento(agendamentoId){
      if (!db) return;
      try{
        await db.collection('agendamentos').doc(agendamentoId).set({ status:'finalizado_agendamento', finalizadoEm: firebase.firestore.FieldValue.serverTimestamp() }, { merge:true });
      }catch(e){ console.warn('Falha ao finalizar agendamento:', e); }
    }
    async function cancelarAgendamento(agendamentoId, motivo){
      if (!db) return;
      try{
        await db.collection('agendamentos').doc(agendamentoId).set({ status:'cancelado_agendamento', canceladoEm: firebase.firestore.FieldValue.serverTimestamp(), motivoCancelamento: motivo||null }, { merge:true });
      }catch(e){ console.warn('Falha ao cancelar agendamento:', e); }
    }
    window.finalizarAgendamentoCliente = finalizarAgendamento;
    window.cancelarAgendamentoCliente = cancelarAgendamento;

    let propostasUnsub = null;
    function autoOuvirUltimoAgendamentoDoCliente(uid){
      if (!db || !uid) return;
      db.collection('agendamentos').where('clienteId','==', uid)
        .onSnapshot(snap=>{
          if (!snap || snap.empty) return;
          let maisRecente = null; let tsRef = 0;
          snap.forEach(doc=>{
            const d = doc.data()||{};
            if (d.status !== 'aguardando_propostas_agendamento') return;
            let ord = 0;
            try{
              if (d.criadoEm?.toDate) ord = d.criadoEm.toDate().getTime();
              else if (typeof d.criadoEm?.seconds === 'number') ord = d.criadoEm.seconds*1000;
              else if (typeof d.dataHoraAgendada?.seconds === 'number') ord = d.dataHoraAgendada.seconds*1000;
            }catch{}
            if (ord >= tsRef){ tsRef = ord; maisRecente = doc.id; }
          });
          if (maisRecente){
            if (propostasUnsub) { try{ propostasUnsub(); }catch{} propostasUnsub=null; }
            propostasUnsub = ouvirPropostasAgendamento(maisRecente);
          }
        });
    }

    if (btnConfirmar){
      btnConfirmar.addEventListener('click', async (e)=>{
        e.preventDefault();
        if (!db){ alert('Serviço indisponível no momento.'); return; }
        const dataSel = (dataAgendamento?.value||'').trim();
        const horaSel = (horaAgendamento?.value||'').trim();
        const localR = (localRetirada?.value||'').trim();
        const localE = (localEntrega?.value||'').trim();
        const numeroR = (document.getElementById('numeroRetirada')?.value||'').trim();
        const compR = (document.getElementById('complementoRetirada')?.value||'').trim();
        const numeroE = (document.getElementById('numeroEntrega')?.value||'').trim();
        const compE = (document.getElementById('complementoEntrega')?.value||'').trim();
        const volumes = parseInt(document.getElementById('volumes')?.value||'0',10);
        const tipoVeiculo = (document.getElementById('tipoVeiculo')?.value||'').trim();
        const cepVal = (cepInput?.value||'').replace(/\D/g,'');

        if (!dataSel || !horaSel) return alert('Selecione data e horário.');
        if (!localR) return alert('Informe o local de retirada.');
        if (!localE) return alert('Informe o local de entrega.');
        if (!tipoVeiculo) return alert('Selecione o tipo de veículo.');
        if (!volumes || volumes<=0) return alert('Informe o número de volumes.');
        if (cepVal && !isCEPSaoPaulo(cepVal)) return alert('CEP precisa ser do estado de São Paulo.');

        async function validarEnderecoSP(texto){
          const cepVal = (document.getElementById('cep')?.value||'').replace(/\D/g,'');
          try{
            const q = (String(texto).toLowerCase().includes('são paulo')||String(texto).includes('SP'))? texto : `${texto}, São Paulo, Brasil`;
            const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=1&countrycodes=br&q=${encodeURIComponent(q )}`);
            const d = await r.json();
            if (d[0]){
              const lat=parseFloat(d[0].lat), lon=parseFloat(d[0].lon);
              if (isEnderecoSP(d[0].address, lat, lon)) return { lat, lon, address: d[0].address, display_name: d[0].display_name };
            }
          }catch(e){ console.warn('Geo falhou, usando fallback SP', e); }
          if (textoIndicaSP(texto, cepVal)) return { lat:null, lon:null, address:null, display_name:String(texto) };
          return null;
        }
        const origemOk = await validarEnderecoSP(localR); if (!origemOk) return alert('Local de retirada precisa ser em São Paulo.');
        const destinoOk = await validarEnderecoSP(localE); if (!destinoOk) return alert('Local de entrega precisa ser em São Paulo.');

        const user = await obterUsuarioAtualAsync(); if (!user){ alert('Faça login para agendar.'); return; }
        const clienteNome = await getClienteNome(user.uid);
        const tsLocal = new Date(`${dataSel}T${horaSel}:00`);
        if (isNaN(tsLocal.getTime())) return alert('Data/hora inválidas.');
        if (tsLocal < new Date()) return alert('Escolha uma data/horário no futuro.');

        const dados = {
          origem: {
            endereco: localR,
            numero: numeroR,
            complemento: compR,
            cep: formatarCEP(cepVal || (origemOk.address?.postcode||'')),
            coordenadas: { lat: origemOk.lat, lng: origemOk.lon }
          },
          destino: {
            endereco: localE,
            numero: numeroE,
            complemento: compE,
            coordenadas: { lat: destinoOk.lat, lng: destinoOk.lon }
          },
          tipoVeiculo,
          volumes,
          distancia: null,
          status: 'aguardando_propostas_agendamento',
          criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
          dataHoraAgendada: firebase.firestore.Timestamp.fromDate(tsLocal),
          propostas: {},
          clienteId: user.uid,
          clienteNome
        };

        try{
          const docRef = await db.collection('agendamentos').add(dados);
          alert('Solicitação criada com sucesso! Aguardando propostas...');
          
          try { localStorage.setItem('agendamentoEmAberto', docRef.id); } catch {}
          
          const propSec = document.getElementById('propostasSection');
          if (propSec) { propSec.style.display = 'block'; propSec.dataset.active = 'true'; }

          
          if (propostasUnsub) { try{ propostasUnsub(); }catch{} propostasUnsub=null; }
          propostasUnsub = ouvirPropostasAgendamento(docRef.id);
        } catch (e) { console.error('Falha ao salvar agendamento:', e); alert('Erro ao criar agendamento.'); }
      });
    }
    firebase.auth().onAuthStateChanged(u=>{
      const uid = u?.uid || null;
      if (uid) autoOuvirUltimoAgendamentoDoCliente(uid);
    });
  });
})();
