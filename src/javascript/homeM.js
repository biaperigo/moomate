document.addEventListener('DOMContentLoaded', () => {

  const firebaseConfig = {
    apiKey: "AIzaSyB9ZuAW1F9rBfOtg3hgGpA6H7JFUoiTlhE",
    authDomain: "moomate-39239.firebaseapp.com",
    projectId: "moomate-39239",
    storageBucket: "moomate-39239.appspot.com",
    messagingSenderId: "637968714747",
    appId: "1:637968714747:web:ad15dc3571c22f046b595e",
    measurementId: "G-62J7Q8CKP4"
  };

  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
  const db = firebase.firestore();
  const auth = firebase.auth();

  let motoristaUid = null;
  let nomeMotoristaReal = "Motorista";

  auth.onAuthStateChanged(async (user) => {
    if (!user) return; 
    motoristaUid = user.uid;
    try {
      const snap = await db.collection("motoristas").doc(user.uid).get();
      const data = snap.exists ? snap.data() : null;
      nomeMotoristaReal = data?.dadosPessoais?.nome || data?.nome || user.displayName || nomeMotoristaReal;
    } catch (err) {
      console.error("Erro ao buscar dados do motorista:", err);
    }

    ouvirAceitacaoPropostas();
  });

 
  const deliveryList = document.getElementById('delivery-list');
  const loadingMessage = document.getElementById('loading-message');
  const submitBtn = document.getElementById('submitBtn');
  const proposalModal = document.getElementById('proposalModal');
  const modalClose = document.getElementById('modalClose');
  const sendProposalBtn = document.getElementById('sendProposalBtn');
  const proposalPriceInput = document.getElementById('proposalPrice');
  const proposalTimeInput = document.getElementById('proposalTime');
  const proposalHelpersInput = document.getElementById('proposalHelpers');
  const proposalVehicleInput = document.getElementById('proposalVehicle');

  let selectedEntregaId = null;
  const fallbackMotoristaId = `motorista_${Math.random().toString(36).substr(2, 9)}`;
  const entregasCache = {}; 
  let currentBounds = null;

  (function fillHelpers() {
    proposalHelpersInput.innerHTML = "";
    for (let i = 0; i <= 10; i++) {
      const opt = document.createElement("option");
      opt.value = String(i);
      opt.textContent = `${i} Ajudante${i === 1 ? "" : "s"}`;
      proposalHelpersInput.appendChild(opt);
    }
  })();

  // preço 
  function calcPriceBoundsFromDistance(distKm) {
    const base = 24 * (Number(distKm) || 0); 
    const min = Math.max(0, base - 150);
    const max = base + 150;
    return {
      base: Math.round(base * 100) / 100,
      min: Math.round(min * 100) / 100,
      max: Math.round(max * 100) / 100,
    };
  }

  function ensurePriceHintElement() {
    let hint = document.getElementById("priceRangeHint");
    if (!hint) {
      hint = document.createElement("small");
      hint.id = "priceRangeHint";
      hint.style.display = "block";
      hint.style.marginTop = "6px";
      hint.style.color = "#666";
      proposalPriceInput.parentElement.appendChild(hint);
    }
    return hint;
  }

  //  Carregar Entregas 
  function carregarEntregas() {
    // mudança
    db.collection('entregas')
      .orderBy('criadoEm', 'desc')
      .onSnapshot(snapshot => processSnapshot(snapshot, 'mudanca'));

    // descartes
    db.collection('descartes')
      .orderBy('dataEnvio', 'desc')
      .onSnapshot(snapshot => processSnapshot(snapshot, 'descarte'));

    loadingMessage.textContent = 'Aguardando novas solicitações...';
    loadingMessage.style.display = 'block';
    deliveryList.innerHTML = '';
    deliveryList.appendChild(loadingMessage);
  }

  function processSnapshot(snapshot, tipo) {
    if (snapshot.empty && Object.keys(entregasCache).length === 0) {
        loadingMessage.textContent = 'Nenhum pedido disponível no momento.';
        return;
    }

    loadingMessage.style.display = 'none';

    snapshot.docChanges().forEach(change => {
        const entregaId = change.doc.id;
        const entregaData = change.doc.data();

        if (change.type === 'removed') {
            delete entregasCache[entregaId];
            const cardToRemove = deliveryList.querySelector(`[data-entrega-id="${entregaId}"]`);
            if (cardToRemove) cardToRemove.remove();
            return;
        }

        entregasCache[entregaId] = { ...entregaData, tipo };
        
        const existingCard = deliveryList.querySelector(`[data-entrega-id="${entregaId}"]`);
        if(existingCard) existingCard.remove();

        const card = criarCardEntrega(entregaId, { ...entregaData, tipo });
        deliveryList.prepend(card); 
    });
  }

function criarCardEntrega(entregaId, entregaData) {
  const isDescarte = entregaData.tipo === 'descarte';
  const iconClass = isDescarte ? 'fa-recycle' : 'fa-box-open';
  const badgeClass = isDescarte ? 'recycle' : 'box';
  const card = document.createElement('div');
  card.className = 'delivery-card';
  card.dataset.entregaId = entregaId;
  card.dataset.tipoEntrega = entregaData.tipo;
  const origem = entregaData.origem?.endereco || entregaData.localRetirada || 'Origem não informada';
  const destino = entregaData.destino?.endereco || entregaData.localEntrega || 'Destino não informado';
  const complemento = entregaData.origem?.complemento || '';
  const distancia = entregaData.distancia ? `${Number(entregaData.distancia).toFixed(2)} km` : '---';
  const volumes = entregaData.volumes ?? '---';
  const tipoVeiculo = entregaData.tipoVeiculo || entregaData.tipoCaminhao || '---';

  card.innerHTML = `
    <strong>${isDescarte ? 'Descarte' : 'Entrega'} #${entregaId.substring(0, 6)}</strong>
    <div class="info-container">
      <div class="info-esquerda">
        <p><strong>Origem:</strong> ${origem} ${complemento ? '- ' + complemento : ''}</p>
        <p><strong>Destino:</strong> ${destino}</p>
      </div>
      <div class="info-meio">
        <p><strong>Distância:</strong> ${distancia}</p>
        <p><strong>Volumes:</strong> ${complemento}</p>
        <p><strong>Tipo de veículo:</strong> ${tipoVeiculo}</p>
      </div>
      <div class="info-meio">
        <span class="icon-area ${badgeClass}"><i class="fa-solid ${iconClass}"></i></span>
      </div>
    </div>
  `;
  return card;
}

  function abrirModal() {
    if (!selectedEntregaId) return alert("Selecione um pedido!");
    const entrega = entregasCache[selectedEntregaId];
    if (!entrega) return alert("Dados da entrega não encontrados.");

    const distKm = entrega.distancia || 0;
    currentBounds = calcPriceBoundsFromDistance(distKm);

    proposalPriceInput.value = "";
    proposalPriceInput.min = currentBounds.min.toFixed(2);
    proposalPriceInput.max = currentBounds.max.toFixed(2);
    proposalPriceInput.step = "0.01";
    proposalTimeInput.value = "";
    proposalHelpersInput.value = "0";
    proposalVehicleInput.value = "pequeno";

    const hint = ensurePriceHintElement();
    hint.textContent = `Faixa permitida: R$ ${currentBounds.min.toFixed(2)} a R$ ${currentBounds.max.toFixed(2)} (base: R$ ${currentBounds.base.toFixed(2)})`;

    proposalModal.style.display = 'flex';
    setTimeout(() => {
      proposalModal.style.opacity = '1';
      proposalModal.querySelector('.modal-content').style.transform = 'scale(1)';
    }, 10);
  }

  function fecharModal() {
    proposalModal.style.opacity = '0';
    proposalModal.querySelector('.modal-content').style.transform = 'scale(0.9)';
    setTimeout(() => {
      proposalModal.style.display = 'none';
    }, 300);
  }

  //  Enviar proposta 
  function enviarProposta() {
    const precoBase = parseFloat((proposalPriceInput.value || "").replace(",", "."));
    const tempoChegada = parseInt(proposalTimeInput.value, 10);
    const numAjudantes = parseInt(proposalHelpersInput.value, 10);
    const tipoVeiculo = proposalVehicleInput.value;

    if (!selectedEntregaId) return alert("Entrega não selecionada.");
    if (!currentBounds) return alert("Não foi possível calcular a faixa de preço desta entrega.");
    if (!precoBase || isNaN(precoBase)) return alert("Informe um valor base válido.");
    if (precoBase < currentBounds.min || precoBase > currentBounds.max) {
      return alert(`O valor deve estar entre R$ ${currentBounds.min.toFixed(2)} e R$ ${currentBounds.max.toFixed(2)}.`);
    }
    if (!tempoChegada || tempoChegada <= 0) return alert("Informe o tempo até a retirada (minutos).");
    if (numAjudantes < 0 || numAjudantes > 10) return alert("Número de ajudantes inválido.");

    const custoAjudantes = numAjudantes * 50;
    const precoTotalMotorista = precoBase + custoAjudantes;
    const precoFinalCliente = precoTotalMotorista * 1.10; // +10% plataforma

    const idParaUsar = motoristaUid || fallbackMotoristaId;
    const propostaData = {
      preco: precoFinalCliente,
      tempoChegada,
      ajudantes: numAjudantes,
      veiculo: tipoVeiculo,
      precoOriginal: {
        base: precoBase,
        ajudantes: custoAjudantes,
        total: precoTotalMotorista
      },
      dataEnvio: firebase.firestore.FieldValue.serverTimestamp(),
      motoristaUid: idParaUsar,
      nomeMotorista: nomeMotoristaReal || `Motorista ${fallbackMotoristaId.substring(10, 15)}`
    };

    const card = deliveryList.querySelector(`[data-entrega-id="${selectedEntregaId}"]`);
    const tipoEntrega = card ? card.dataset.tipoEntrega : 'mudanca';
    const collectionName = tipoEntrega === 'descarte' ? 'descartes' : 'entregas';

    db.collection(collectionName)
      .doc(selectedEntregaId)
      .collection('propostas')
      .doc(idParaUsar)
      .set(propostaData)
      .then(() => {

        return db.collection(collectionName)
          .doc(selectedEntregaId)
          .update({
            [`propostas.${idParaUsar}`]: propostaData,
            ultimaPropostaEm: firebase.firestore.FieldValue.serverTimestamp()
          });
      })
      .then(() => {
        alert("Proposta enviada com sucesso!");
        fecharModal();
        selectedEntregaId = null;
        document.querySelectorAll('.delivery-card').forEach(c => c.classList.remove('selected'));
        submitBtn.disabled = true;
      })
      .catch(err => {
        console.error("Erro ao enviar proposta:", err);
        alert("Falha ao enviar proposta, tente novamente.");
      });
  }
  function ensureModalPropostaAceita(){
    let modal = document.getElementById('propostaAceitaModal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'propostaAceitaModal';
    modal.style.cssText = 'position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.45);z-index:9999;opacity:0;transition:opacity .2s ease';
    modal.innerHTML = `
      <div class="modal-content" style="width:min(520px,92vw);background:#fff;border-radius:12px;padding:20px;transform:scale(.96);transition:transform .2s ease">
        <h3>Proposta aceita</h3>
        <p id="mm-nome-cliente" style="margin:.25rem 0 .5rem 0">Cliente: —</p>
        <div class="mm-info" style="font-size:.95rem;line-height:1.45">
          <div><strong>Origem:</strong> <span id="origem-info">—</span></div>
          <div><strong>Destino:</strong> <span id="destino-info">—</span></div>
          <div><strong>Valor:</strong> R$ <span id="valor-info">0,00</span></div>
          <div><strong>Tempo de chegada:</strong> <span id="tempo-info">0</span> min</div>
        </div>
        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:12px">
          <button id="btnIniciarCorrida" style="padding:10px 14px;background:#3DBE34;border:0;color:#fff;border-radius:8px;cursor:pointer">Iniciar corrida</button>
          <button id="btnRecusarCorrida" style="padding:10px 14px;background:#e7e7e7;border:0;color:#111;border-radius:8px;cursor:pointer">Cancelar</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click',(e)=>{ if(e.target===modal) fecharModalPropostaAceita(); });
    return modal;
  }
  function abrirModalPropostaAceita(){
    const modal = ensureModalPropostaAceita();
    modal.style.display = 'flex';
    requestAnimationFrame(()=>{
      modal.style.opacity = '1';
      modal.querySelector('.modal-content').style.transform = 'scale(1)';
    });
  }
  function fecharModalPropostaAceita(){
    const modal = document.getElementById('propostaAceitaModal');
    if (!modal) return;
    modal.style.opacity = '0';
    modal.querySelector('.modal-content').style.transform = 'scale(.96)';
    setTimeout(()=>{ modal.style.display = 'none'; }, 200);
  }

  function ouvirAceitacaoPropostas() {
    const idParaUsar = motoristaUid || fallbackMotoristaId;
    db.collection('entregas')
      .where('status', '==', 'proposta_aceita')
      .where('propostaAceita.motoristaId', '==', idParaUsar)
      .onSnapshot(snapshot => {
        snapshot.docChanges().forEach(ch => {
          if (ch.type !== 'added' && ch.type !== 'modified') return;
          const entregaId = ch.doc.id;
          const entregaData = ch.doc.data();
          mostrarModalPropostaAceita(entregaId, entregaData, 'entregas');
        });
      });

    db.collection('descartes')
      .where('status', '==', 'aceito')
      .where('propostaAceita.motoristaId', '==', idParaUsar)
      .onSnapshot(snapshot => {
        snapshot.docChanges().forEach(ch => {
          if (ch.type !== 'added' && ch.type !== 'modified') return;
          const entregaId = ch.doc.id;
          const entregaData = ch.doc.data();
          mostrarModalPropostaAceita(entregaId, entregaData, 'descartes');
        });
      });
  }

  function mostrarModalPropostaAceita(entregaId, entregaData, collectionName) {
    const nomeCliente = entregaData.clienteNome || "Cliente";
    const origem = entregaData.origem?.endereco || entregaData.localRetirada || '';
    const destino = entregaData.destino?.endereco || entregaData.localEntrega || '';
    const valor = Number(entregaData.propostaAceita?.preco || 0).toFixed(2);
    const tempo = entregaData.propostaAceita?.tempoChegada || 0;

    ensureModalPropostaAceita();
    document.getElementById('mm-nome-cliente').textContent = `Cliente: ${nomeCliente}`;
    document.getElementById('origem-info').textContent = origem;
    document.getElementById('destino-info').textContent = destino;
    document.getElementById('valor-info').textContent = valor;
    document.getElementById('tempo-info').textContent = tempo;

    abrirModalPropostaAceita();

    document.getElementById('btnIniciarCorrida').onclick = () => iniciarCorrida(entregaId, entregaData, nomeCliente, collectionName);
    document.getElementById('btnRecusarCorrida').onclick = () => recusarCorridaAposAceite(entregaId, collectionName);
  }

async function iniciarCorrida(entregaId, entregaData, nomeCliente, collectionName) {
  try {
    const corridaData = {
      entregaId,
      status: 'em_andamento',
      iniciadaEm: firebase.firestore.FieldValue.serverTimestamp(),
      clienteId: entregaData.clienteId || null,
      clienteNome: nomeCliente || entregaData.clienteNome || 'Cliente',
      motoristaId: motoristaUid || fallbackMotoristaId,
      nomeMotorista: nomeMotoristaReal || 'Motorista',
      origem: {
        endereco: entregaData.origem?.endereco || entregaData.localRetirada || '',
        numero: entregaData.origem?.numero || '',
        complemento: entregaData.origem?.complemento || '',
        cep: entregaData.origem?.cep || entregaData.cep || '',
        lat: entregaData.origem?.coordenadas?.lat || null,
        lng: entregaData.origem?.coordenadas?.lng || null,
      },
      destino: {
        endereco: entregaData.destino?.endereco || entregaData.localEntrega || '',
        numero: entregaData.destino?.numero || '',
        complemento: entregaData.destino?.complemento || '',
        lat: entregaData.destino?.coordenadas?.lat || null,
        lng: entregaData.destino?.coordenadas?.lng || null,
      },
      preco: Number(entregaData.propostaAceita?.preco || 0),
      tempoChegada: entregaData.propostaAceita?.tempoChegada || 0,
      ajudantes: entregaData.propostaAceita?.ajudantes || 0,
      veiculo: entregaData.propostaAceita?.veiculo || entregaData.tipoVeiculo || '',
      criadoEm: firebase.firestore.FieldValue.serverTimestamp()
    };

    const corridaRef = db.collection('corridas').doc(entregaId);

    await corridaRef.set(corridaData, { merge: true });
    await corridaRef.collection('sync').doc('estado').set({ fase: 'indo_retirar' }, { merge: true });
    await db.collection(collectionName).doc(entregaId).delete();

    localStorage.setItem('corridaSelecionada', entregaId);
    localStorage.setItem('ultimaCorridaMotorista', entregaId);
    window.location.href = `rotaM.html?corrida=${encodeURIComponent(entregaId)}`;
  } catch (error) {
    console.error('Erro ao iniciar corrida:', error);
    alert('Erro ao iniciar corrida. Tente novamente.');
  }
}
  async function recusarCorridaAposAceite(entregaId, collectionName) {
    try {
      await db.collection(collectionName).doc(entregaId).update({
        status: 'recusada_pelo_motorista',
        recusadaEm: firebase.firestore.FieldValue.serverTimestamp(),
        recusadaPor: motoristaUid || fallbackMotoristaId
      });
    } catch (error) {
      console.error('Erro ao recusar a corrida:', error);
    } finally {
      fecharModalPropostaAceita();
    }
  }
  deliveryList.addEventListener('click', e => {
    const card = e.target.closest('.delivery-card');
    if (card) {
      document.querySelectorAll('.delivery-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      selectedEntregaId = card.dataset.entregaId;
      submitBtn.disabled = false;
    }
  });

  submitBtn.addEventListener('click', abrirModal);
  modalClose.addEventListener('click', fecharModal);
  sendProposalBtn.addEventListener('click', enviarProposta);
  proposalModal.addEventListener('click', (e) => {
    if (e.target === proposalModal) fecharModal();
  });

  carregarEntregas();
});
