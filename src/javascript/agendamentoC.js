// Sistema de Tabs para Agendamento Moomate
document.addEventListener('DOMContentLoaded', function() {
  
  // Elementos das tabs
  const tabSolicitar = document.getElementById('tab-solicitar');
  const tabAgendados = document.getElementById('tab-agendados');
  const formSection = document.querySelector('.form-section');
  
  // Controle de estado atual
  let currentTab = 'solicitar';
  
  // Lista em memória (preenchida via Firestore)
  let viagensAgendadas = [];

  // Função para alternar entre as tabs
  function switchTab(activeTab, tabName) {
    // Remove a classe 'active' de todas as abas
    tabSolicitar.classList.remove('active');
    tabAgendados.classList.remove('active');
    
    // Adiciona a classe 'active' na aba clicada
    activeTab.classList.add('active');
    
    // Atualiza o estado atual
    currentTab = tabName;

    // Pega a referência da seção de propostas
    const propostasSection = document.getElementById('propostasSection');
    
    // Mostra/esconde conteúdo baseado na aba ativa
    if (tabName === 'solicitar') {
      // Mostra o formulário e esconde a lista de agendados
      showSolicitarContent(); 

      // Verifica se a seção de propostas já foi ativada anteriormente.
      // Se sim, ela deve continuar visível na aba "Solicitar".
      if (propostasSection && propostasSection.dataset.active === 'true') {
        propostasSection.style.display = 'block';
        // Mantém o formulário visível (não esconder .form-section)
      }

    } else if (tabName === 'agendados') {
      // Mostra a lista de agendados
      showAgendadosContent(); 
      
      // Esconde a seção de propostas e o formulário principal.
      // Isso garante que as propostas NUNCA apareçam na aba "Agendados".
      if (propostasSection) {
        propostasSection.style.display = 'none';
      }
      document.querySelector('.form-section').style.display = 'none';
    }
  }

  // Função para mostrar o conteúdo da aba "Solicitar"
  function showSolicitarContent() {
    formSection.style.display = 'block';
    hideAgendadosContent();
    // Se existir um agendamento em aberto (não aceito), manter a seção de propostas visível
    try {
      const abertoId = localStorage.getItem('agendamentoEmAberto');
      if (abertoId) {
        const propostasSection = document.getElementById('propostasSection');
        if (propostasSection) propostasSection.style.display = 'block';
        // Mantém o formulário visível: não esconder '.form-fields'
        // Reassina listener se necessário
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

  // Função para mostrar o conteúdo da aba "Agendados"
  function showAgendadosContent() {
    formSection.style.display = 'none';
    renderAgendados();
  }
  
  // Função para voltar para a aba anterior
  function goBackToSolicitar() {
    switchTab(tabSolicitar, 'solicitar');
  }

  // Função para esconder o conteúdo da aba "Agendados"
  function hideAgendadosContent() {
    const agendadosContainer = document.getElementById('agendados-container');
    if (agendadosContainer) {
      agendadosContainer.remove();
    }
  }

  // Função para renderizar as viagens agendadas
  async function renderAgendados() {
    // Remove container existente se houver
    hideAgendadosContent();

    const agendadosContainer = document.createElement('section');
    agendadosContainer.id = 'agendados-container';
    agendadosContainer.className = 'agendados-section';

    const loading = document.createElement('div');
    loading.className = 'delivery-list-loading';
    loading.textContent = 'Carregando agendamentos...';
    agendadosContainer.appendChild(loading);

    // Inserção robusta no DOM
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
      // Consulta simples por clienteId para evitar índice composto obrigatório
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

      // Render
      agendadosContainer.innerHTML = '';
      if (!viagensAgendadas.length){
        agendadosContainer.innerHTML = `<div class=\"empty-message\"><h3>Sem agendamentos no momento</h3></div>`;
        return;
      }
      // Ordena por confirmação mais recente primeiro
      viagensAgendadas.sort((a,b)=> (b.__confMs||0) - (a.__confMs||0));
      const cardsContainer = document.createElement('div');
      cardsContainer.className = 'cards-container';
      const list = document.createElement('div');
      list.style.display = 'flex';
      list.style.flexDirection = 'column';
      list.style.gap = '16px';
      viagensAgendadas.forEach(v=>{ 
        const card = createViagemCard(v); 
        list.appendChild(card);
        // Fallback: buscar nome/telefone do motorista se vierem vazios
        if ((v.motorista==='—' || v.telefone==='—') && v.motoristaUid){
          try{ preencherContatoMotorista(card, v.motoristaUid); }catch{}
        }
      });
      cardsContainer.appendChild(list);
      agendadosContainer.appendChild(cardsContainer);
    }catch(e){
      console.error('Falha ao carregar agendados', e);
      agendadosContainer.innerHTML = `<div class=\"empty-message\"><h3>Sem agendamentos no momento</h3></div>`;
    }
  }

  // Função para criar card de viagem
  function createViagemCard(viagem) {
    const card = document.createElement('div');
    card.className = 'viagem-card';
    
    // Determina a classe do status
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

  // Busca nome e telefone do motorista no Firestore e atualiza o card
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

  // Função para determinar a classe CSS do status
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

  // Função para formatar data
  function formatDate(dateString) {
    try{
      // Se vier como 'YYYY-MM-DD', converte por string para evitar fuso UTC
      if (/^\d{4}-\d{2}-\d{2}$/.test(String(dateString||''))){
        const [y,m,d] = String(dateString).split('-');
        return `${d}/${m}/${y}`;
      }
      const date = new Date(dateString);
      return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }catch{ return String(dateString||''); }
  }

  // Cancelamento de agendamento (Firestore)
  window.cancelViagem = async function(agendamentoId) {
    try{
      if (!window.firebase || !firebase.apps.length) return alert('Serviço indisponível.');
      const db = firebase.firestore();
      if (!confirm('Deseja realmente cancelar este agendamento?')) return;
      await db.collection('agendamentos').doc(String(agendamentoId)).set({ status: 'corrida_agendamento_cancelado', canceladoEm: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
      // Atualiza a lista após cancelar
      await renderAgendados();
      alert('Agendamento cancelado.');
    }catch(e){ console.error('Falha ao cancelar', e); alert('Erro ao cancelar agendamento.'); }
  };

  // Event listeners para as tabs
  tabSolicitar.addEventListener('click', () => switchTab(tabSolicitar, 'solicitar'));
  tabAgendados.addEventListener('click', () => switchTab(tabAgendados, 'agendados'));

  // Funcionalidade do menu mobile
  const menuToggle = document.getElementById('menuToggle');
  const navMenu = document.getElementById('navMenu');

  if (menuToggle && navMenu) {
    menuToggle.addEventListener('click', () => {
      navMenu.classList.toggle('show');
    });
  }

  // Máscara para CEP
  const cepInput = document.getElementById('cep');
  if (cepInput) {
    cepInput.addEventListener('input', function(e) {
      let value = e.target.value.replace(/\D/g, '');
      value = value.replace(/(\d{5})(\d)/, '$1-$2');
      e.target.value = value;
    });
  }

  // Consulta CEP via ViaCEP
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

  // Inicialização: mostra a aba "Solicitar" por padrão
  showSolicitarContent();

  console.log('Sistema de tabs inicializado com sucesso!');
  
  // Função global para testar
  window.testarPropostas = function() {
    document.getElementById('propostasSection').style.display = 'block';
    console.log('Seção de propostas mostrada!');
  };
});

// Enhancements for AgendamentoC: SP-only validation, CEP/address sync, autocomplete, date/time limits, Firestore submit and proposals
(function(){
  document.addEventListener('DOMContentLoaded', function(){
    const { firebase } = window;
    const db = (firebase && firebase.apps && firebase.apps.length) ? firebase.firestore() : null;

    // Elements
    const cepInput = document.getElementById('cep');
    const localRetirada = document.getElementById('localRetirada');
    const localEntrega = document.getElementById('localEntrega');
    const dataAgendamento = document.getElementById('dataAgendamento');
    const horaAgendamento = document.getElementById('horaAgendamento');
    const btnConfirmar = document.getElementById('confirmarAgendamento');

    // SP bounds util
    const SP_BOUNDS = { north: -19.80, south: -25.30, east: -44.20, west: -53.10 };
    function estaDentroDeSaoPaulo(lat, lng){
      return lat <= SP_BOUNDS.north && lat >= SP_BOUNDS.south && lng <= SP_BOUNDS.east && lng >= SP_BOUNDS.west;
    }
    function isCEPSaoPaulo(cep){
      const n = parseInt(String(cep||'').replace(/\D/g,''),10);
      return Number.isFinite(n) && n >= 1000000 && n <= 19999999; // 01000-000 a 19999-999
    }
    function formatarCEP(cep){
      cep = String(cep||'').replace(/\D/g,'');
      return cep.length===8 ? `${cep.substring(0,5)}-${cep.substring(5)}` : cep;
    }
    // Helper robusto: aceita endereço em qualquer cidade do estado de SP
    function isEnderecoSP(addressObj, lat, lon){
      try{
        // 1) Dentro do bounding box do estado
        if (Number.isFinite(lat) && Number.isFinite(lon) && estaDentroDeSaoPaulo(lat, lon)) return true;
        const addr = addressObj || {};
        const state = (addr.state||'').toLowerCase();
        const stateCode = (addr.state_code||'').toLowerCase();
        // 2) State textual
        if (state.includes('são paulo') || state === 'sp') return true;
        if (stateCode === 'sp') return true;
        // 3) ISO codes (Nominatim costuma trazer ISO3166-2 em diferentes níveis)
        for (const k of Object.keys(addr)){
          if (k.toLowerCase().startsWith('iso3166-2') && String(addr[k]).toUpperCase() === 'BR-SP') return true;
        }
      }catch{}
      return false;
    }
    // Fallback textual quando geocodificação falhar/oscilar
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

    // CEP mask already set by original; add SP validation and sync to retirada
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

    // Autocomplete SP using Nominatim
    let autocompleteTimers = {};
    // Inject styles to match descarte dropdown look
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
    // UI helper: mostra/oculta um hint de validação SP abaixo do campo
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
      if (ok){
        hint.textContent = 'Endereço válido no estado de São Paulo';
        hint.style.color = '#2e7d32';
      } else {
        hint.textContent = 'Verifique se o endereço é do estado de São Paulo';
        hint.style.color = '#a66a00';
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
      // marca visualmente como válido em SP
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
          if (!data[0]) { alert('Endereço inválido. Use um endereço de São Paulo.'); setSpHint('localRetirada', false); return; }
          const lat = parseFloat(data[0].lat), lon = parseFloat(data[0].lon);
          if (!isEnderecoSP(data[0].address, lat, lon)) {
            // fallback textual: não bloquear o usuário
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

    // Agrupa Data e Hora na mesma linha (sem alterar HTML), apenas layout
    try{
      const dataBox = document.getElementById('dataAgendamento')?.closest('.input-box');
      const horaBox = document.getElementById('horaAgendamento')?.closest('.input-box');
      if (dataBox && horaBox && dataBox.parentElement === horaBox.parentElement){
        const row = document.createElement('div');
        row.className = 'row-two-cols';
        row.style.display = 'grid';
        row.style.gridTemplateColumns = '1fr 1fr';
        row.style.gap = '12px';
        // insere acima do primeiro e move os dois
        dataBox.parentElement.insertBefore(row, dataBox);
        row.appendChild(dataBox);
        row.appendChild(horaBox);
      }
    }catch{}

    // Date/time constraints
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

    // Firestore submit and proposals listener
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

      // No seu arquivo agendamentoC.js

function ouvirPropostasAgendamento(id){
  if (!db || !id) return;
  const agRef = db.collection('agendamentos').doc(id);
  let origemTxt = '—', destinoTxt = '—';
  
  agRef.get().then(snap=>{
    const ag = snap.exists ? (snap.data()||{}) : {};
    origemTxt = ag?.origem?.endereco || ag?.localRetirada || origemTxt;
    destinoTxt = ag?.destino?.endereco || ag?.localEntrega || destinoTxt;
  }).catch(()=>{});

  const unsub = agRef.collection('propostas').orderBy('dataEnvio','asc')
    .onSnapshot(async snap=>{
      const container = document.getElementById('propostasContainer');
      if (!container) return;
      
      if (snap.empty){
        container.innerHTML = `
          <h3>Propostas Recebidas</h3>
          <p>Aguardando propostas dos motoristas...</p>
        `;
        return;
      }
      
      container.innerHTML = `<h3>Propostas Recebidas</h3><div id="lista-propostas"></div>`;
      const lista = document.getElementById('lista-propostas');
      
      snap.docs.forEach(d=>{
        const p = d.data()||{};
        const uidM = p.motoristaUid || d.id;
        const nome = p.nomeMotorista || 'Motorista';
        const foto = p.fotoMotoristaUrl || '';
        const preco = Number(p.preco||0).toFixed(2).replace('.', ',');
        const tempo = p.tempoChegada || 0;
        const ajud = p.ajudantes || 0;
        const veic = p.veiculo || '-';

        const card = document.createElement('div');
        // Usando a nova classe específica
        card.className = 'card-proposta-motorista'; 
        
        // Gerando o HTML com as novas classes específicas
        card.innerHTML = `
          <div class="card-proposta-motorista-content">
            <div class="card-proposta-motorista-accent"></div>
            
            <div class="card-proposta-motorista-perfil">
              <div class="card-proposta-motorista-avatar">
                ${foto ? `<img src="${foto}" alt="foto">` : `<span class="card-proposta-motorista-avatar-inicial">${nome.substring(0,1).toUpperCase()}</span>`}
              </div>
              <div class="card-proposta-motorista-info">
                <div class="nome">${nome}</div>
                <div class="rating"><i class="fa-solid fa-star"></i> 0.0</div>
              </div>
            </div>

            <div class="card-proposta-motorista-detalhes">
              <div class="corrida-id">Corrida #${String(id).substring(0,6)}</div>
              <div class="rota"><strong>De:</strong> ${origemTxt}</div>
              <div class="rota"><strong>Para:</strong> ${destinoTxt}</div>
              <div class="specs">
                <span><strong>Veículo:</strong> ${veic}</span>
                <span><strong>Chegada:</strong> ${tempo} min</span>
                <span><strong>Ajudantes:</strong> ${ajud}</span>
              </div>
            </div>

            <div class="card-proposta-motorista-valor">
              <div class="preco">R$ ${preco}</div>
              <button class="aceitar-btn" id="aceitar-${d.id}">ACEITAR PROPOSTA</button>
            </div>
          </div>`;
          
        lista.appendChild(card);
        const b = document.getElementById(`aceitar-${d.id}`);
        if (b){ b.addEventListener('click', ()=> aceitarPropostaAgendamento(id, d.id, uidM)); }
      });
    });
  return unsub;
}

// expõe o listener globalmente para reanexar ao voltar de abas
window.ouvirPropostasAgendamento = ouvirPropostasAgendamento;

    async function aceitarPropostaAgendamento(agendamentoId, propostaId, motoristaUid){
      if (!db) return alert('Firebase indisponível.');
      try{
        const snap = await db.collection('agendamentos').doc(agendamentoId).collection('propostas').doc(propostaId).get();
        if (!snap.exists) return alert('Proposta não encontrada.');
        const propostaData = snap.data();
        // Atualiza o agendamento como confirmado
        const user = firebase?.auth()?.currentUser || null;
        const clienteUid = user?.uid || propostaData?.clienteUid || null;
        await db.collection('agendamentos').doc(agendamentoId).set({ 
          status:'corrida_agendamento_confirmado', 
          motoristaId: motoristaUid, 
          clienteId: clienteUid || firebase.firestore.FieldValue.delete(),
          propostaAceita:{ motoristaUid, ...propostaData }, 
          confirmadoEm: firebase.firestore.FieldValue.serverTimestamp() 
        }, { merge:true });

        // Notificações simples (cliente e motorista)
        try{
          // já pegamos clienteUid acima
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

        // limpar estado de "em aberto"
        try { localStorage.removeItem('agendamentoEmAberto'); } catch {}

        // Esconder propostas
        const propSec = document.getElementById('propostasSection');
        if (propSec) propSec.style.display = 'none';

        // Exibir modal de confirmação (centralizado) e redirecionar automaticamente
        try{
          const modal = document.getElementById('modalPropostaAceita');
          if (modal){
            modal.classList.add('show');
            setTimeout(()=>{
              modal.classList.remove('show');
              const t = document.getElementById('tab-agendados');
              if (t) t.click();
              // força um refresh da lista pouco depois do redirecionamento
              setTimeout(()=>{ try{ renderAgendados(); }catch{} }, 400);
            }, 1200);
          } else {
            // Fallback
            const t = document.getElementById('tab-agendados'); if (t) t.click();
          }
        }catch{}
      }catch(e){ console.error(e); alert('Falha ao aceitar proposta.'); }
    }

    // Helpers para novos status exclusivos de agendamento (sem integrar telas agora)
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
    // expõe para futuras chamadas externas
    window.finalizarAgendamentoCliente = finalizarAgendamento;
    window.cancelarAgendamentoCliente = cancelarAgendamento;

    let propostasUnsub = null;
    function autoOuvirUltimoAgendamentoDoCliente(uid){
      if (!db || !uid) return;
      db.collection('agendamentos').where('clienteId','==', uid)
        .onSnapshot(snap=>{
          if (!snap || snap.empty) return;
          // pegar o mais recente com status aguardando_propostas_agendamento
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
          // Fallback: aceitar se texto/CEP indicarem SP
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
          
          // Persistir o agendamento em aberto para manter a visualização ao trocar de abas
          try { localStorage.setItem('agendamentoEmAberto', docRef.id); } catch {}
          
          // Mostrar a seção de propostas e ocultar os campos do formulário
          const propSec = document.getElementById('propostasSection');
          if (propSec) { propSec.style.display = 'block'; propSec.dataset.active = 'true'; }
          // Mantém o formulário visível: não esconder '.form-fields'
          
          if (propostasUnsub) { try{ propostasUnsub(); }catch{} propostasUnsub=null; }
          propostasUnsub = ouvirPropostasAgendamento(docRef.id);
        } catch (e) { console.error('Falha ao salvar agendamento:', e); alert('Erro ao criar agendamento.'); }
      });
    }

    // Quando o usuário recarrega a página, ligar automaticamente no último agendamento aberto
    firebase.auth().onAuthStateChanged(u=>{
      const uid = u?.uid || null;
      if (uid) autoOuvirUltimoAgendamentoDoCliente(uid);
      // Removido: popup em tempo real por notificações
      // O modal de confirmação aparece APENAS quando o usuário clica em "Aceitar Proposta".
    });
  });
})();
