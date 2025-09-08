document.addEventListener('DOMContentLoaded', () => {
  // ================= Firebase =================
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
    if (!user) return; // se quiser, redirecione pra loginM.html
    motoristaUid = user.uid;
    try {
      const snap = await db.collection("motoristas").doc(user.uid).get();
      const data = snap.exists ? snap.data() : null;
      nomeMotoristaReal = data?.dadosPessoais?.nome || data?.nome || user.displayName || nomeMotoristaReal;
    } catch {}
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
  const entregasCache = {}; // entregaId -> dados (para pegar distância)
  let currentBounds = null; // {base, min, max}

  // helpers 0..10
  (function fillHelpers() {
    proposalHelpersInput.innerHTML = "";
    for (let i = 0; i <= 10; i++) {
      const opt = document.createElement("option");
      opt.value = String(i);
      opt.textContent = `${i} Ajudante${i === 1 ? "" : "s"}`;
      proposalHelpersInput.appendChild(opt);
    }
  })();

  // ================== Utils de preço ==================
  function calcPriceBoundsFromDistance(distKm) {
    const base = 48 * (Number(distKm) || 0); // 8x6xkm
    const min = Math.max(0, base - 150);
    const max = base + 150;
    return {
      base: Math.round(base * 100) / 100,
      min:  Math.round(min  * 100) / 100,
      max:  Math.round(max  * 100) / 100,
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

  // ================== Listagem de entregas ==================
  function carregarEntregas() {
    db.collection('entregas')
      .orderBy("criadoEm", "desc")
      .onSnapshot(snapshot => {
        deliveryList.innerHTML = '';
        if (snapshot.empty) {
          loadingMessage.textContent = "Nenhum pedido disponível no momento.";
          loadingMessage.style.display = 'block';
          deliveryList.appendChild(loadingMessage);
          return;
        }
        loadingMessage.style.display = 'none';

        snapshot.forEach(doc => {
          const entregaId = doc.id;
          const entregaData = doc.data();
          entregasCache[entregaId] = entregaData; // cache para usar no modal

          const card = document.createElement('div');
          card.className = 'delivery-card';
          card.dataset.entregaId = entregaId;
          card.innerHTML = `            
            <strong>Entrega #${entregaId.substring(0, 6)}</strong>
            <p><strong>Origem:</strong> ${entregaData.origem?.endereco || entregaData.origem?.cep || ''} ${entregaData.origem?.complemento ? '- ' + entregaData.origem.complemento : ''}</p>
            <p><strong>Destino:</strong> ${entregaData.destino?.endereco || ''} ${entregaData.destino?.numero ? ', ' + entregaData.destino.numero : ''}</p>
            <p><strong>Distância:</strong> ${entregaData.distancia ? entregaData.distancia.toFixed(2) + ' km' : '---'}</p>
            <p><strong>Volumes:</strong> ${entregaData.volumes}</p>
            <p><strong>Tipo de veículo:</strong> ${entregaData.tipoVeiculo}</p>
          `;
          deliveryList.appendChild(card);
        });
      });
  }

  // ================== Modal abrir/fechar ==================
  function abrirModal() {
    if (!selectedEntregaId) return alert("Selecione um pedido!");

    const distKm = entregasCache[selectedEntregaId]?.distancia || 0;
    currentBounds = calcPriceBoundsFromDistance(distKm);

    // input começa vazio, mas já com min/max
    proposalPriceInput.value = "";
    proposalPriceInput.min   = String(currentBounds.min.toFixed(2));
    proposalPriceInput.max   = String(currentBounds.max.toFixed(2));
    proposalPriceInput.step  = "0.01";

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
    setTimeout(() => { proposalModal.style.display = 'none'; }, 300);
  }

  // ================== Enviar proposta ==================
  function enviarProposta() {
    const precoBase = parseFloat((proposalPriceInput.value || "").replace(",", "."));
    const tempoChegada = parseInt(proposalTimeInput.value, 10);
    const numAjudantes = parseInt(proposalHelpersInput.value, 10);
    const tipoVeiculo = proposalVehicleInput.value;

    if (!selectedEntregaId) return alert("Entrega não selecionada.");
    if (!currentBounds)      return alert("Não foi possível calcular a faixa de preço desta entrega.");

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
      precoOriginal: { base: precoBase, ajudantes: custoAjudantes, total: precoTotalMotorista },
      dataEnvio: firebase.firestore.FieldValue.serverTimestamp(),
      motoristaUid: idParaUsar,
      nomeMotorista: nomeMotoristaReal || `Motorista ${fallbackMotoristaId.substring(10, 15)}`
    };

    db.collection('entregas')
      .doc(selectedEntregaId)
      .collection('propostas')
      .doc(idParaUsar)
      .set(propostaData)
      .then(() => {
        return db.collection('entregas').doc(selectedEntregaId).update({
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

  // ================== Escutar proposta aceita ==================
// Escuta o status da proposta e exibe o modal para o motorista
function ouvirAceitacaoPropostas() {
  const idParaUsar = motoristaUid || fallbackMotoristaId;
  db.collection('entregas')
    .where('status', '==', 'proposta_aceita')
    .where('propostaAceita.motoristaId', '==', idParaUsar)
    .onSnapshot(snapshot => {
      snapshot.forEach(docSnap => {
        const entregaId = docSnap.id;
        const entregaData = docSnap.data();
        mostrarModalPropostaAceita(entregaId, entregaData);
      });
    });
}

// Função para exibir o modal com as informações da proposta
function mostrarModalPropostaAceita(entregaId, entregaData) {
  const nomeCliente = entregaData.clienteNome || "Cliente";
  const valor = entregaData.propostaAceita?.preco?.toFixed(2) || "0.00";
  const tempo = entregaData.propostaAceita?.tempoChegada || 0;
  const origem = entregaData.origem?.endereco || '';
  const destino = entregaData.destino?.endereco || '';

  // Preenche o modal com as informações da proposta aceita
  document.getElementById('origem-info').textContent = origem;
  document.getElementById('destino-info').textContent = destino;
  document.getElementById('valor-info').textContent = valor;
  document.getElementById('tempo-info').textContent = tempo;

  // Exibe o modal
  const modal = document.getElementById('propostaAceitaModal');
  modal.style.display = 'flex';
  setTimeout(() => {
    modal.style.opacity = '1';
    modal.querySelector('.modal-content').style.transform = 'scale(1)';
  }, 10);

  // Função para iniciar a corrida
  document.getElementById('btnIniciarCorrida').onclick = () => {
    iniciarCorrida(entregaId, entregaData);
    modal.style.display = 'none';
  };

  // Função para recusar a corrida
  document.getElementById('btnRecusarCorrida').onclick = () => {
    recusarCorridaAposAceite(entregaId);
    modal.style.display = 'none';
  };
}


// Função para fechar o modal
function fecharModalPropostaAceita() {
  const modal = document.getElementById('propostaAceitaModal');
  
  if (!modal) {
    console.warn("Modal não encontrado!");
    return; // Se o modal não existir, não faz nada e exibe um aviso no console
  }

  // Inicia a animação de fechamento
  modal.style.opacity = '0';
  modal.querySelector('.modal-content').style.transform = 'scale(0.9)';

  // Após 300ms (tempo da animação), oculta o modal completamente
  setTimeout(() => {
    modal.style.display = 'none';
  }, 300);  // Tempo ajustado para a animação de fechamento
}


// Função para iniciar a corrida
async function iniciarCorrida(entregaId, entregaData) {
  try {
    const corridaData = {
      ...entregaData,
      status: 'em_andamento',
      iniciadaEm: new Date().toISOString(),
      motoristaConfirmou: true,
      clienteConfirmou: true
    };
    
    // Cria a corrida no banco de dados
    await db.collection('corridas').doc(entregaId).set(corridaData);
    
    // Deleta a entrega do banco após iniciar a corrida
    await db.collection('entregas').doc(entregaId).delete();

    alert('Corrida iniciada com sucesso!');

    // Redireciona o motorista para a página 'rotaM.html'
    if (entregaData.motoristaUid === motoristaUid) {
      window.location.href = `rotaM.html?entregaId=${entregaId}`;
    }

    // Redireciona o cliente para a página 'rotaC.html'
    if (entregaData.clienteUid === motoristaUid) {
      window.location.href = `statusC.html?entregaId=${entregaId}`;
    }

  } catch (error) {
    console.error('Erro ao iniciar corrida:', error);
    alert('Erro ao iniciar corrida. Tente novamente.');
  }
}


// Função para recusar a corrida após aceitação
async function recusarCorridaAposAceite(entregaId) {
  try {
    await db.collection('entregas').doc(entregaId).update({ status: 'recusada_pelo_motorista' });
    alert('Corrida recusada com sucesso!');
  } catch (error) {
    console.error('Erro ao recusar a corrida:', error);
    alert('Erro ao recusar a corrida. Tente novamente.');
  }
}

// Chama a função para ouvir as propostas aceitas
ouvirAceitacaoPropostas();
async function iniciarCorrida(entregaId, entregaData) {
  try {
    const corridaData = {
      ...entregaData,
      status: 'em_andamento',
      iniciadaEm: new Date().toISOString(),
      motoristaConfirmou: true,
      clienteConfirmou: true
    };
    await db.collection('corridas').doc(entregaId).set(corridaData);
    await db.collection('entregas').doc(entregaId).delete();
    alert('Corrida iniciada com sucesso!');
    window.location.href = `rotaM.html?entregaId=${entregaId}&tipo=motorista`;
  } catch (error) {
    console.error('Erro ao iniciar corrida:', error);
    alert('Erro ao iniciar corrida. Tente novamente.');
  }
}


  // ================== Interações da lista ==================
  deliveryList.addEventListener('click', e => {
    const card = e.target.closest('.delivery-card');
    if (card) {
      document.querySelectorAll('.delivery-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      selectedEntregaId = card.dataset.entregaId;
      submitBtn.disabled = false;
    }
  });

  // ================== Eventos do modal ==================
  submitBtn.addEventListener('click', abrirModal);
  modalClose.addEventListener('click', fecharModal);
  sendProposalBtn.addEventListener('click', enviarProposta);
  proposalModal.addEventListener('click', (e) => { if (e.target === proposalModal) fecharModal(); });

  // ================== Boot ==================
  carregarEntregas();
  ouvirAceitacaoPropostas();
});
