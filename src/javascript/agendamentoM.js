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
  }

  function criarCardEntrega(s){
    const card = document.createElement('div');
    card.className='delivery-card';
    card.dataset.entregaId = s.id;
    const origem = s.origem?.endereco || s.localRetirada || '—';
    const destino = s.destino?.endereco || s.localEntrega || '—';
    const dist = s.distancia ? `${Number(s.distancia).toFixed(2)} km` : '---';
    const vols = (s.volumes ? `${s.volumes} itens` : (s.quantidade || '—'));
    const tipoV = s.tipoVeiculo || s.tipoCaminhao || 'pequeno';
    const agTs = s.dataHoraAgendada?.seconds || s.dataAgendada?.seconds || null;
    let quando = '—';
    try{
      if (agTs){
        const dt = new Date(agTs*1000);
        const diff = dt - new Date();
        if (diff <= 0) quando = 'Agora';
        else {
          const mins = Math.round(diff/60000);
          quando = mins < 60 ? `${mins}min` : `${Math.round(mins/60)}h`;
        }
      }
    }catch{}

    card.innerHTML = `
      <div class="ag-card">
        <div class="ag-accent"></div>
        <div class="ag-top">
          <div class="ag-title">Agendamento #${s.id.substring(0,6)}</div>
          <div class="ag-when">${quando}</div>
        </div>
        <div class="ag-info">
          <div class="ag-left">
            <div><strong>Origem:</strong> ${origem}</div>
            <div><strong>Destino:</strong> ${destino}</div>
          </div>
          <div class="ag-mid">
            <div><strong>Distância:</strong> ${dist}</div>
            <div><strong>Volumes:</strong> ${vols}</div>
            <div><strong>Tipo de veículo:</strong> ${tipoV}</div>
          </div>
          <div class="ag-right">
            <span class="icon-area box" title="Agendamento"><i class="fa-solid fa-box-open"></i></span>
          </div>
        </div>
      </div>`;
    return card;
  }

  function abrirModal(){
    if(!entregaSelecionadaId) return alert('Selecione um agendamento!');
    const s = todasSolicitacoes.get(entregaSelecionadaId);
    const distKm = s.distancia || 1; // fallback para garantir mínimo
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

    const s = todasSolicitacoes.get(entregaSelecionadaId);
    const collectionName = 'agendamentos';

    const custoAjud = ajud*50; const precoTotal = precoBase + custoAjud; const precoCliente = precoTotal*1.10;
    const propostaData = {
      preco: precoCliente,
      tempoChegada: tempo,
      ajudantes: ajud,
      veiculo: veic,
      precoOriginal: { base: precoBase, ajudantes: custoAjud, totalMotorista: precoTotal },
      motoristaUid: idParaUsar,
      dataEnvio: firebase.firestore.FieldValue.serverTimestamp(),
      nomeMotorista: 'Motorista'
    };
    try{
      await db.collection(collectionName).doc(entregaSelecionadaId)
        .collection('propostas').doc(idParaUsar).set(propostaData);
      await db.collection(collectionName).doc(entregaSelecionadaId)
        .set({ [`propostas.${idParaUsar}`]: propostaData, ultimaPropostaEm: firebase.firestore.FieldValue.serverTimestamp() }, { merge:true });
      alert('Proposta enviada com sucesso!'); fecharModal(); botaoEnviar.disabled=true;
    }catch(e){ console.error(e); alert('Falha ao enviar proposta.'); }
  }

  // Apenas agendados: status agendado / dataHoraAgendada presente / flag agendado
  function carregarAgendados(){
    db.collection('agendamentos')
      .where('status', 'in', ['aguardando_propostas_agendamento','agendado'])
      .onSnapshot(snap=>{
        todasSolicitacoes.clear();
        snap.forEach(doc=>{
          const d = doc.data()||{};
          todasSolicitacoes.set(doc.id, { ...d, id: doc.id, dataOrdenacao: d.dataHoraAgendada?.seconds || 0 });
        });
        atualizarInterface();
      });
  }

  // Escuta propostas ACEITAS para este motorista com status 'agendado' e dispara popup próximo da hora
  function ouvirAgendamentosAceitos(){
    if (!motoristaUid) return;
    db.collection('agendamentos')
      .where('status','==','agendado')
      .where('propostaAceita.motoristaUid','==', motoristaUid)
      .onSnapshot(snap=>{
        const nowSec = firebase.firestore.Timestamp.now().seconds;
        snap.forEach(doc=>{
          const d = doc.data()||{};
          const ts = d.dataHoraAgendada?.seconds || null;
          if (!ts) return;
          if (nowSec >= ts - 5*60) {
            abrirPopupAgendamento(doc.id, 'agendamentos', d);
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
      await db.collection(colecao).doc(id).set({ status:'em_corrida', corridaIniciada:true, corridaIniciadaEm: firebase.firestore.FieldValue.serverTimestamp() }, { merge:true });

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
    if (motoristaUid) ouvirAgendamentosAceitos();
  });
})();
