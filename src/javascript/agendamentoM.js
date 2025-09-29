// Agendamentos do Motorista - mesma base do homeM.js, filtrando apenas agendados
(function(){
  const { firebase } = window;
  // Firebase é inicializado no HTML (agendamentoM.html). Se ainda não estiver pronto, aborta silenciosamente.
  if (!firebase || !firebase.apps || !firebase.apps.length) return;
  const db = firebase.firestore();

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

  function distanciaEstimativaKmFromDoc(d){
    const salvo = Number(d?.distancia);
    if (Number.isFinite(salvo) && salvo>0) return salvo;
    const toNum = v => (v==null? null : Number(v));
    const oLat = toNum(d?.origem?.lat ?? d?.origem?.coordenadas?.lat);
    const oLng = toNum(d?.origem?.lng ?? d?.origem?.coordenadas?.lng);
    const dLat = toNum(d?.destino?.lat ?? d?.destino?.coordenadas?.lat);
    const dLng = toNum(d?.destino?.lng ?? d?.destino?.coordenadas?.lng);
    const R=6371, toRad=(deg)=>deg*Math.PI/180;
    const calc=(a1,o1,a2,o2)=>{ const dPhi=toRad(a2-a1), dLam=toRad(o2-o1); const a=Math.sin(dPhi/2)**2+Math.cos(toRad(a1))*Math.cos(toRad(a2))*Math.sin(dLam/2)**2; return 2*R*Math.atan2(Math.sqrt(a),Math.sqrt(1-a)); };
    const CENTRO_SP={ lat:-22.19, lng:-48.79 };
    if ([oLat,oLng,dLat,dLng].every(Number.isFinite)) return calc(oLat,oLng,dLat,dLng);
    if ([dLat,dLng].every(Number.isFinite)) return calc(CENTRO_SP.lat,CENTRO_SP.lng,dLat,dLng);
    if ([oLat,oLng].every(Number.isFinite)) return calc(oLat,oLng,CENTRO_SP.lat,CENTRO_SP.lng);
    return 1; // fallback mínimo
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
        viagens.forEach(v=> { 
          const card = createViagemCard(v);
          list.appendChild(card);
          if ((v.nomeCliente==='—' || v.emailCliente==='—') && v.clienteUid){
            try{ preencherContatoCliente(card, v.clienteUid); }catch{}
          }
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
    const distKm = (function(){
      // usar valor salvo se existente, senão haversine com fallbacks simples
      const salvo = Number(s.distancia);
      if (Number.isFinite(salvo) && salvo>0) return salvo;
      const toNum = v => (v==null? null : Number(v));
      const oLat = toNum(s.origem?.lat ?? s.origem?.coordenadas?.lat);
      const oLng = toNum(s.origem?.lng ?? s.origem?.coordenadas?.lng);
      const dLat = toNum(s.destino?.lat ?? s.destino?.coordenadas?.lat);
      const dLng = toNum(s.destino?.lng ?? s.destino?.coordenadas?.lng);
      const R=6371, toRad=(deg)=>deg*Math.PI/180;
      const calc=(a1,o1,a2,o2)=>{ const dPhi=toRad(a2-a1), dLam=toRad(o2-o1); const a=Math.sin(dPhi/2)**2+Math.cos(toRad(a1))*Math.cos(toRad(a2))*Math.sin(dLam/2)**2; return 2*R*Math.atan2(Math.sqrt(a),Math.sqrt(1-a)); };
      const CENTRO_SP={ lat:-22.19, lng:-48.79 };
      if ([oLat,oLng,dLat,dLng].every(Number.isFinite)) return calc(oLat,oLng,dLat,dLng);
      if ([dLat,dLng].every(Number.isFinite)) return calc(CENTRO_SP.lat,CENTRO_SP.lng,dLat,dLng);
      if ([oLat,oLng].every(Number.isFinite)) return calc(oLat,oLng,CENTRO_SP.lat,CENTRO_SP.lng);
      return NaN;
    })();
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
        <div class="ag-info" style="row-gap:8px">
          <div class="ag-left" style="display:flex;flex-direction:column;gap:6px;min-width:0">
            <div><strong>Origem:</strong> ${origem}</div>
            <div><strong>Destino:</strong> ${destino}</div>
          </div>
          <div class="ag-mid" style="display:flex;flex-direction:column;gap:6px;min-width:180px">
            <div><strong>Distância:</strong> ${distanciaLabel}</div>
            <div><strong>Volumes:</strong> ${volumesLabel}</div>
            <div><strong>Tipo de veículo:</strong> ${tipoLabel}</div>
          </div>
        </div>
        <div class="ag-footer" style="margin-top:10px;padding-top:10px;border-top:1px dashed #eee;display:flex;gap:24px;flex-wrap:wrap">
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