document.addEventListener('DOMContentLoaded', () => {
  // Configuração do Firebase
  const firebaseConfig = {
    apiKey: "AIzaSyB9ZuAW1F9rBfOtg3hgGpA6H7JFUoiTlhE",
    authDomain: "moomate-39239.firebaseapp.com",
    projectId: "moomate-39239",
    storageBucket: "moomate-39239.appspot.com",
    messagingSenderId: "637968714747",
    appId: "1:637968714747:web:ad15dc3571c22f046b595e",
    measurementId: "G-62J7Q8CKP4"
  };

  firebase.initializeApp(firebaseConfig);
  const db = firebase.firestore();

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
  const motoristaId = `motorista_${Math.random().toString(36).substr(2, 9)}`;

  // --- Carrega entregas em tempo real ---
  function carregarEntregas() {
    db.collection('entregas')
      .orderBy("criadoEm", "desc") // pega os mais novos primeiro
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

          const card = document.createElement('div');
          card.className = 'delivery-card';
          card.dataset.entregaId = entregaId;

          card.innerHTML = `
          
            <strong>Entrega #${entregaId.substring(0, 6)}</strong>
            <p><strong>Origem:</strong> ${entregaData.origem?.endereco|| entregaData.origem?.cep || ''}, ${entregaData.origem?.complemento || ''}</p>
            <p><strong>Destino:</strong> ${entregaData.destino?.endereco || ''}, ${entregaData.destino?.numero || ''}</p>
            <p><strong>Distância:</strong> ${entregaData.distancia ? entregaData.distancia.toFixed(2) + ' km' : '---'}</p>
             <p><strong>Volumes:</strong> ${entregaData.volumes}</p>
             <p><strong>Tipo de veículo:</strong> ${entregaData.tipoVeiculo}</p>
          `;

          deliveryList.appendChild(card);
        });
      });
  }

  function abrirModal() {
    if (!selectedEntregaId) return alert("Selecione um pedido!");
    proposalPriceInput.value = '';
    proposalTimeInput.value = '';
    proposalHelpersInput.value = '0';
    proposalVehicleInput.value = 'pequeno';
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

  function enviarProposta() {
    const precoBase = parseFloat(proposalPriceInput.value);
    const tempoChegada = parseInt(proposalTimeInput.value, 10);
    const numAjudantes = parseInt(proposalHelpersInput.value, 10);
    const tipoVeiculo = proposalVehicleInput.value;

    if (!precoBase || precoBase <= 0 || !tempoChegada || tempoChegada <= 0) 
      return alert("Preencha valor e tempo corretamente.");
    if (!selectedEntregaId) return alert("Entrega não selecionada.");

    const custoAjudantes = numAjudantes * 50;
    const precoTotalMotorista = precoBase + custoAjudantes;
    const precoFinalCliente = precoTotalMotorista * 1.10;

    const propostaData = {
      preco: precoFinalCliente,
      tempoChegada,
      ajudantes: numAjudantes,
      veiculo: tipoVeiculo,
      precoOriginal: { base: precoBase, ajudantes: custoAjudantes, total: precoTotalMotorista },
      dataEnvio: new Date().toISOString(),
      motoristaId,
      nomeMotorista: `Motorista ${motoristaId.substring(10, 15)}` // Nome fictício
    };

    // Salvar proposta na subcoleção 'propostas' da entrega
    db.collection('entregas')
      .doc(selectedEntregaId)
      .collection('propostas')
      .doc(motoristaId)
      .set(propostaData)
      .then(() => {
        // Também atualizar o documento principal da entrega para indicar que há propostas
        return db.collection('entregas').doc(selectedEntregaId).update({
          [`propostas.${motoristaId}`]: propostaData,
          ultimaPropostaEm: new Date().toISOString()
        });
      })
      .then(() => {
        alert("Proposta enviada com sucesso!");
        fecharModal();
        selectedEntregaId = null;
        // Desmarcar card selecionado
        document.querySelectorAll('.delivery-card').forEach(c => c.classList.remove('selected'));
        submitBtn.disabled = true;
      })
      .catch(err => {
        console.error("Erro ao enviar proposta:", err);
        alert("Falha ao enviar proposta, tente novamente.");
      });
  }

  // Ouvir aceitação de propostas
  function ouvirAceitacaoPropostas() {
    db.collection('entregas')
      .where('status', '==', 'proposta_aceita')
      .where('propostaAceita.motoristaId', '==', motoristaId)
      .onSnapshot(snapshot => {
        snapshot.docChanges().forEach(change => {
          if (change.type === 'modified') {
            const entregaData = change.doc.data();
            if (entregaData.propostaAceita && entregaData.propostaAceita.motoristaId === motoristaId) {
              // Mostrar modal de confirmação personalizado
              mostrarModalIniciarCorrida(change.doc.id, entregaData);
            }
          }
        });
      });
  }

  // Função para mostrar modal de iniciar corrida
  function mostrarModalIniciarCorrida(entregaId, entregaData) {
    // Criar modal se não existir
    let modal = document.getElementById('iniciarCorridaModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'iniciarCorridaModal';
      modal.className = 'modal-overlay';
      modal.innerHTML = `
        <div class="modal-content">
          <h2>🎉 Proposta Aceita!</h2>
          <div class="proposta-aceita-info">
            <p><strong>Sua proposta foi aceita pelo cliente!</strong></p>
            <p><strong>Origem:</strong> ${entregaData.origem?.endereco || ''}</p>
            <p><strong>Destino:</strong> ${entregaData.destino?.endereco || ''}</p>
            <p><strong>Valor:</strong> R$ ${entregaData.propostaAceita?.preco?.toFixed(2) || '0.00'}</p>
            <p><strong>Tempo estimado:</strong> ${entregaData.propostaAceita?.tempoChegada || '0'} minutos</p>
          </div>
          <div class="modal-buttons">
            <button id="iniciarCorridaBtn" class="btn-iniciar">🚚 Iniciar Corrida</button>
            <button id="cancelarCorridaBtn" class="btn-cancelar">❌ Cancelar</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      // Event listeners para os botões
      document.getElementById('iniciarCorridaBtn').addEventListener('click', () => {
        iniciarCorrida(entregaId, entregaData);
        modal.style.display = 'none';
      });

      document.getElementById('cancelarCorridaBtn').addEventListener('click', () => {
        modal.style.display = 'none';
      });
    } else {
      // Atualizar conteúdo do modal existente
      modal.querySelector('.proposta-aceita-info').innerHTML = `
        <p><strong>Sua proposta foi aceita pelo cliente!</strong></p>
        <p><strong>Origem:</strong> ${entregaData.origem?.endereco || ''}</p>
        <p><strong>Destino:</strong> ${entregaData.destino?.endereco || ''}</p>
        <p><strong>Valor:</strong> R$ ${entregaData.propostaAceita?.preco?.toFixed(2) || '0.00'}</p>
        <p><strong>Tempo estimado:</strong> ${entregaData.propostaAceita?.tempoChegada || '0'} minutos</p>
      `;
    }

    // Mostrar modal
    modal.style.display = 'flex';
    setTimeout(() => {
      modal.style.opacity = '1';
      modal.querySelector('.modal-content').style.transform = 'scale(1)';
    }, 10);
  }

  // Função para iniciar corrida
  async function iniciarCorrida(entregaId, entregaData) {
    try {
      // Criar dados da corrida
      const corridaData = {
        ...entregaData,
        status: 'em_andamento',
        iniciadaEm: new Date().toISOString(),
        motoristaConfirmou: true,
        clienteConfirmou: true // Assumindo que o cliente já confirmou ao aceitar
      };

      // Salvar na coleção 'corridas'
      await db.collection('corridas').doc(entregaId).set(corridaData);

      // Remover da coleção 'entregas'
      await db.collection('entregas').doc(entregaId).delete();

      alert('Corrida iniciada com sucesso!');
      
      // Redirecionar para página da corrida
      window.location.href = `corrida.html?entregaId=${entregaId}&tipo=motorista`;

    } catch (error) {
      console.error('Erro ao iniciar corrida:', error);
      alert('Erro ao iniciar corrida. Tente novamente.');
    }
  }

  // Selecionar card
  deliveryList.addEventListener('click', e => {
    const card = e.target.closest('.delivery-card');
    if (card) {
      document.querySelectorAll('.delivery-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      selectedEntregaId = card.dataset.entregaId;
      submitBtn.disabled = false;
    }
  });

  // Eventos
  submitBtn.addEventListener('click', abrirModal);
  modalClose.addEventListener('click', fecharModal);
  sendProposalBtn.addEventListener('click', enviarProposta);

  // Fechar modal clicando fora
  proposalModal.addEventListener('click', (e) => {
    if (e.target === proposalModal) {
      fecharModal();
    }
  });

  // Inicia carregamento e ouvir aceitações
  carregarEntregas();
  ouvirAceitacaoPropostas();
});