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
  const CENTRO_SP_REF = { lat: -22.1900, lng: -48.7900 };
  
  // Cache para geocodificação
  const geocodingCache = new Map();
  let geocodingQueue = [];
  let isProcessingQueue = false;

  function estimarDistanciaKm(solicitacao){
    try{
      const distInformada = Number(solicitacao?.distancia);
      if (Number.isFinite(distInformada) && distInformada > 0) return distInformada;

      const toNum = (v)=> (v!=null && !Number.isNaN(Number(v)) ? Number(v) : null);
      const oLat = toNum(solicitacao?.origem?.lat ?? solicitacao?.origem?.coordenadas?.lat);
      const oLng = toNum(solicitacao?.origem?.lng ?? solicitacao?.origem?.coordenadas?.lng);
      const dLat = toNum(solicitacao?.destino?.lat ?? solicitacao?.destino?.coordenadas?.lat);
      const dLng = toNum(solicitacao?.destino?.lng ?? solicitacao?.destino?.coordenadas?.lng);

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
  const fallbackMotoristaId = `motorista_${Math.random().toString(36).substr(2, 9)}`;
  
  const todasSolicitacoes = new Map();
  let limitesPrecoAtuais = null;

  (function preencherAjudantes() {
    inputAjudantesProposta.innerHTML = "";
    for (let i = 0; i <= 5; i++) {
      const opt = document.createElement("option");
      opt.value = String(i);
      opt.textContent = `${i} Ajudante${i === 1 ? "" : "s"}`;
      inputAjudantesProposta.appendChild(opt);
    }
  })();

  // Função de geocodificação com fila e delay
  async function geocodificarEndereco(endereco) {
    if (!endereco) return null;
    
    // Verificar cache
    if (geocodingCache.has(endereco)) {
      return geocodingCache.get(endereco);
    }
    
    try {
      // Aguardar 1 segundo entre requisições
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const searchQuery = endereco.includes('SP') || endereco.includes('São Paulo') ? 
        endereco : endereco + ', São Paulo, Brasil';
      
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&addressdetails=1&limit=1&countrycodes=br`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'MoomateApp/1.0'
        }
      });
      
      if (!response.ok) throw new Error('Geocoding failed');
      
      const data = await response.json();
      
      if (data && data.length > 0) {
        const result = data[0];
        const lat = parseFloat(result.lat);
        const lng = parseFloat(result.lon);
        
        if (lat >= -25.30 && lat <= -19.80 && lng >= -53.10 && lng <= -44.20) {
          const coords = { lat, lng, endereco: result.display_name };
          geocodingCache.set(endereco, coords);
          return coords;
        }
      }
      
      geocodingCache.set(endereco, null);
      return null;
    } catch (error) {
      console.warn('Erro ao geocodificar (silenciado):', endereco);
      geocodingCache.set(endereco, null);
      return null;
    }
  }

  function calcularLimitesPrecoPorDistancia(distKm, isDescarte = false) {
    const dist = Number(distKm) || 0;
    const fatorBase = isDescarte ? 10 : 24;
    let base = fatorBase * dist;
    
    const minBase = isDescarte ? 20 : 24;
    if (base < minBase) base = minBase;
    
    let min = Math.max(minBase, Math.max(0, base - 50));
    let max = base + 150;
    
    return {
      base: Math.round(base * 100) / 100,
      min: Math.round(min * 100) / 100,
      max: Math.round(max * 100) / 100,
    };
  }

  function garantirElementoDicaPreco() {
    let hint = document.getElementById("priceRangeHint");
    if (!hint) {
      hint = document.createElement("small");
      hint.id = "priceRangeHint";
      hint.style.display = "block";
      hint.style.marginTop = "6px";
      hint.style.color = "#666";
      inputPrecoProposta.parentElement.appendChild(hint);
    }
    return hint;
  }

  function carregarTodasSolicitacoes() {
    console.log('Iniciando listeners para todas as solicitações...');
    
    db.collection('entregas')
      .where('status', 'in', ['aguardando_propostas', 'pendente', 'ativo', 'disponivel'])
      .onSnapshot(snapshot => {
        processarSnapshot(snapshot, 'mudanca');
      });

    db.collection('descartes')
      .where('status', 'in', ['aguardando_propostas', 'pendente', 'ativo', 'disponivel'])
      .onSnapshot(snapshot => {
        processarSnapshot(snapshot, 'descarte');
      });
  }

  function processarSnapshot(snapshot, tipo) {
    snapshot.docChanges().forEach(change => {
      const id = change.doc.id;
      const data = change.doc.data();

      if (change.type === 'removed') {
        todasSolicitacoes.delete(id);
      } else {
        let dataOrdenacao = Date.now();
        if (data.criadoEm) {
          dataOrdenacao = data.criadoEm.toDate ? data.criadoEm.toDate().getTime() : new Date(data.criadoEm).getTime();
        } else if (data.dataEnvio) {
          dataOrdenacao = data.dataEnvio.toDate ? data.dataEnvio.toDate().getTime() : new Date(data.dataEnvio).getTime();
        }

        todasSolicitacoes.set(id, {
          ...data,
          tipo,
          id,
          dataOrdenacao
        });
      }
    });

    atualizarInterface();
  }

  function atualizarInterface() {
    mensagemCarregando.style.display = 'none';
    listaEntregas.innerHTML = '';

    if (todasSolicitacoes.size === 0) {
      mensagemCarregando.textContent = 'Nenhum pedido disponível no momento.';
      mensagemCarregando.style.display = 'block';
      listaEntregas.appendChild(mensagemCarregando);
      return;
    }
    
    const solicitacoesOrdenadas = Array.from(todasSolicitacoes.values())
      .sort((a, b) => b.dataOrdenacao - a.dataOrdenacao);

    solicitacoesOrdenadas.forEach(solicitacao => {
      const card = criarCardEntrega(solicitacao);
      listaEntregas.appendChild(card);
    });
  }

  function criarCardEntrega(solicitacao) {
    const isDescarte = solicitacao.tipo === 'descarte';
    const classeIcone = isDescarte ? 'fa-recycle' : 'fa-box-open';
    const classeDistintivo = isDescarte ? 'recycle' : 'box';
    
    const card = document.createElement('div');
    card.className = 'delivery-card';
    card.dataset.entregaId = solicitacao.id;
    card.dataset.tipoEntrega = solicitacao.tipo;
    
    const nomeCliente = solicitacao.clienteNome || solicitacao.clienteId || 'Cliente não informado';
    
    let origem = '';
    if (isDescarte) {
      origem = solicitacao.localRetirada || solicitacao.origem?.endereco || 'Origem não informada';
    } else {
      origem = solicitacao.origem?.endereco || solicitacao.localRetirada || 'Origem não informada';
    }
    
    let destino = '';
    if (isDescarte) {
      destino = solicitacao.localEntrega || solicitacao.destino?.endereco || 'Destino não informado';
    } else {
      destino = solicitacao.destino?.endereco || solicitacao.localEntrega || 'Destino não informado';
    }
    
    const complemento = !isDescarte && solicitacao.origem?.complemento ? solicitacao.origem.complemento : '';

    // Calcular distância local com Haversine
    let distancia = '---';
    const getNum = (v) => (v === undefined || v === null ? null : Number(v));
    const oLat = getNum(solicitacao.origem?.lat ?? solicitacao.origem?.coordenadas?.lat);
    const oLng = getNum(solicitacao.origem?.lng ?? solicitacao.origem?.coordenadas?.lng);
    const dLat = getNum(solicitacao.destino?.lat ?? solicitacao.destino?.coordenadas?.lat);
    const dLng = getNum(solicitacao.destino?.lng ?? solicitacao.destino?.coordenadas?.lng);

    if (typeof oLat === 'number' && !Number.isNaN(oLat) &&
        typeof oLng === 'number' && !Number.isNaN(oLng) &&
        typeof dLat === 'number' && !Number.isNaN(dLat) &&
        typeof dLng === 'number' && !Number.isNaN(dLng)) {
      const R = 6371;
      const toRad = (deg) => deg * Math.PI / 180;
      const dPhi = toRad(dLat - oLat);
      const dLam = toRad(dLng - oLng);
      const a = Math.sin(dPhi/2) ** 2 + Math.cos(toRad(oLat)) * Math.cos(toRad(dLat)) * Math.sin(dLam/2) ** 2;
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distKm = R * c;
      distancia = `${distKm.toFixed(2)} km`;
    }
    
    const tipoVeiculo = solicitacao.tipoVeiculo || solicitacao.tipoCaminhao || '---';
    const descricao = isDescarte && solicitacao.descricao ? 
      (solicitacao.descricao.length > 30 ? solicitacao.descricao.substring(0, 30) + '...' : solicitacao.descricao)
      : 'Não informado';
    
    const tempoPostagem = obterTempoPostagem(solicitacao);

    card.innerHTML = `
      <strong>${isDescarte ? 'Descarte' : 'Entrega'} #${solicitacao.id.substring(0, 6)}</strong>
      <div class="tempo-postagem">${tempoPostagem}</div>
      <p><strong>Cliente:</strong> ${nomeCliente}</p>
      <div class="info-container">
        <div class="info-esquerda">
          <p><strong>Origem:</strong> ${origem} ${complemento ? '- ' + complemento : ''}</p>
          <p><strong>Destino:</strong> ${destino}</p>
        </div>
        <div class="info-meio">
          <p><strong>Distância:</strong> <span class="distancia-valor">${distancia}</span></p>
          ${isDescarte ? `<p><strong>Descrição:</strong> ${descricao}</p>` : ''}
          <p><strong>Tipo de veículo:</strong> ${tipoVeiculo}</p>
        </div>
        <div class="info-direita">
          <span class="icon-area ${classeDistintivo}"><i class="fa-solid ${classeIcone}"></i></span>
        </div>
      </div>
    `;
    
    return card;
  }

  function obterTempoPostagem(solicitacao) {
    try {
      const agora = new Date();
      const dataPostagem = new Date(solicitacao.dataOrdenacao);
      const diffMs = agora - dataPostagem;
      const diffMins = Math.floor(diffMs / (1000 * 60));
      
      if (diffMins < 1) return 'Agora';
      if (diffMins < 60) return `${diffMins}min atrás`;
      
      const diffHoras = Math.floor(diffMins / 60);
      if (diffHoras < 24) return `${diffHoras}h atrás`;
      
      const diffDias = Math.floor(diffHoras / 24);
      return `${diffDias}d atrás`;
    } catch (error) {
      return 'Agora';
    }
  }

   function abrirModal() {
    if (!entregaSelecionadaId) return alert("Selecione um pedido!");
    const solicitacao = todasSolicitacoes.get(entregaSelecionadaId);
    if (!solicitacao) return alert("Dados da entrega não encontrados.");

    const isDescarte = solicitacao.tipo === 'descarte';
    const distKm = estimarDistanciaKm(solicitacao);
    limitesPrecoAtuais = calcularLimitesPrecoPorDistancia(distKm, isDescarte);

    inputPrecoProposta.value = "";
    inputPrecoProposta.min = limitesPrecoAtuais.min.toFixed(2);
    inputPrecoProposta.max = limitesPrecoAtuais.max.toFixed(2);
    inputPrecoProposta.step = "0.01";
    inputTempoProposta.value = "";
    inputAjudantesProposta.value = "0";
    inputVeiculoProposta.value = "pequeno";

    const hint = garantirElementoDicaPreco();
    hint.textContent = `Faixa permitida: R$ ${limitesPrecoAtuais.min.toFixed(2)} a R$ ${limitesPrecoAtuais.max.toFixed(2)} (base: R$ ${limitesPrecoAtuais.base.toFixed(2)})`;

    // Esconde o botão fixo
    botaoEnviar.classList.add('hidden-by-modal');

    modalProposta.style.display = 'flex';
    setTimeout(() => {
      modalProposta.style.opacity = '1';
      modalProposta.querySelector('.conteudo-modal, .modal-content').style.transform = 'scale(1)';
    }, 10);
  }

  function fecharModal() {
  modalProposta.style.opacity = '0';
  modalProposta.querySelector('.conteudo-modal, .modal-content').style.transform = 'scale(0.9)';
  setTimeout(() => {
    modalProposta.style.display = 'none';
  }, 300);
  // Mostra o botão fixo novamente
  botaoEnviar.classList.remove('hidden-by-modal');
}

  async function enviarProposta() {
    const precoBase = parseFloat((inputPrecoProposta.value || "").replace(",", "."));
    const tempoChegada = parseInt(inputTempoProposta.value, 10);
    const numAjudantes = parseInt(inputAjudantesProposta.value, 10);
    const tipoVeiculo = inputVeiculoProposta.value;

    if (!entregaSelecionadaId) return alert("Entrega não selecionada.");
    if (!limitesPrecoAtuais) return alert("Não foi possível calcular a faixa de preço desta entrega.");
    if (!precoBase || isNaN(precoBase)) return alert("Informe um valor base válido.");
    if (precoBase < limitesPrecoAtuais.min || precoBase > limitesPrecoAtuais.max) {
      return alert(`O valor deve estar entre R$ ${limitesPrecoAtuais.min.toFixed(2)} e R$ ${limitesPrecoAtuais.max.toFixed(2)}.`);
    }
    if (!tempoChegada || tempoChegada <= 0) return alert("Informe o tempo até a retirada (minutos).");
    if (numAjudantes < 0 || numAjudantes > 10) return alert("Número de ajudantes inválido.");

    const custoAjudantes = numAjudantes * 50;
    const precoTotalMotorista = precoBase + custoAjudantes;
    const precoFinalCliente = precoTotalMotorista * 1.10;

    const auth = firebase.auth();
    const idParaUsar = auth?.currentUser?.uid || motoristaUid || null;
    if(!idParaUsar){
      alert('Faça login nesta página com a CONTA DE MOTORISTA para enviar propostas.');
      return;
    }
    
    try {
      const mSnap = await db.collection('motoristas').doc(idParaUsar).get();
      if (!mSnap.exists) {
        alert('Esta conta logada não está cadastrada em motoristas. Entre com a conta de MOTORISTA.');
        return;
      }
      const mData = mSnap.data()||{};
      nomeMotoristaReal = mData?.nome || mData?.dadosPessoais?.nome || nomeMotoristaReal || 'Motorista';
    } catch(e){ console.warn('[homeM] validação motorista falhou:', e?.message||e); }
    
    const solicitacao = todasSolicitacoes.get(entregaSelecionadaId);
    const collectionName = solicitacao.tipo === 'descarte' ? 'descartes' : 'entregas';

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
      motoristaId: idParaUsar,
      nomeMotorista: nomeMotoristaReal || 'Motorista',
      gravadoPor: 'motorista'
    };
    
    try {
      if (solicitacao?.clienteId) propostaData.clienteId = solicitacao.clienteId;
      if (solicitacao?.clienteNome) propostaData.clienteNome = solicitacao.clienteNome;
    } catch {}

    db.collection(collectionName)
      .doc(entregaSelecionadaId)
      .collection('propostas')
      .doc(idParaUsar)
      .set(propostaData)
      .then(() => {
        return db.collection(collectionName)
          .doc(entregaSelecionadaId)
          .update({
            [`propostas.${idParaUsar}`]: propostaData,
            ultimaPropostaEm: firebase.firestore.FieldValue.serverTimestamp()
          });
      })
      .then(() => {
        fecharModal();
        entregaSelecionadaId = null;
        document.querySelectorAll('.delivery-card').forEach(c => c.classList.remove('selected'));
        botaoEnviar.disabled = true;
      })
      .catch(err => {
        console.error("Erro ao enviar proposta:", err);
        alert("Falha ao enviar proposta, tente novamente.");
      });
  }

  function garantirModalPropostaAceita(){
    let modal = document.getElementById('propostaAceitaModal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'propostaAceitaModal';
    modal.style.cssText = 'position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.45);z-index:9999;opacity:0;transition:opacity .2s ease';
    modal.innerHTML = `
      <div class="modal-content conteudo-modal" style="width:min(520px,92vw);background:#eeeeee;border:3px solid #ff6b35;border-radius:16px;padding:20px;box-shadow:0 16px 40px rgba(0,0,0,.35);transform:scale(.96);transition:transform .2s ease">
        <h3 style="margin:0 0 8px 0;text-align:center;color:#1e1e1e;font-size:1.6rem;font-weight:700">Proposta aceita</h3>
        <p id="mm-nome-cliente" style="margin:.25rem 0 .75rem 0;text-align:center;color:#6b6b6b">Cliente: —</p>
        <div class="mm-info" style="font-size:.95rem;line-height:1.45">
          <div><strong style="color:#ff6b35">Origem:</strong> <span id="origem-info">—</span></div>
          <div><strong style="color:#ff6b35">Destino:</strong> <span id="destino-info">—</span></div>
          <div><strong style="color:#ff6b35">Valor:</strong> R$ <span id="valor-info">0,00</span></div>
          <div><strong style="color:#ff6b35">Tempo de chegada:</strong> <span id="tempo-info">0</span> min</div>
        </div>
        <div style="display:flex;gap:12px;justify-content:flex-end;margin-top:14px">
          <button id="btnIniciarCorrida" style="padding:12px 18px;background:linear-gradient(180deg,#ff7a3f 0%,#ff6b35 100%);border:0;color:#fff;border-radius:10px;cursor:pointer;box-shadow:0 6px 16px rgba(255,107,53,.45);font-weight:600">Iniciar corrida</button>
          <button id="btnRecusarCorrida" style="padding:12px 18px;background:#e7e7e7;border:0;color:#111;border-radius:10px;cursor:pointer;font-weight:600">Cancelar</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click',(e)=>{ if(e.target===modal) fecharModalPropostaAceita(); });
    return modal;
  }
  
  function abrirModalPropostaAceita(){
  const modal = garantirModalPropostaAceita();
  modal.style.display = 'flex';
  requestAnimationFrame(()=>{
    modal.style.opacity = '1';
    modal.querySelector('.conteudo-modal, .modal-content').style.transform = 'scale(1)';
  });
}
  
  function fecharModalPropostaAceita(){
    const modal = document.getElementById('propostaAceitaModal');
    if (!modal) return;
    modal.style.opacity = '0';
    modal.querySelector('.conteudo-modal, .modal-content').style.transform = 'scale(.96)';
    setTimeout(()=>{ modal.style.display = 'none'; }, 200);
  }

  function ouvirAceitacaoPropostas() {
    const idParaUsar = motoristaUid || fallbackMotoristaId;
    
    db.collection('entregas')
      .where('status', '==', 'proposta_aceita')
      .onSnapshot(snapshot => {
        snapshot.docChanges().forEach(ch => {
          if (ch.type !== 'added' && ch.type !== 'modified') return;
          const entregaId = ch.doc.id;
          const entregaData = ch.doc.data();
          
          const propostaAceita = entregaData.propostaAceita;
          if (propostaAceita && (propostaAceita.motoristaId === idParaUsar || propostaAceita.motoristaUid === idParaUsar)) {
            todasSolicitacoes.delete(entregaId);
            atualizarInterface();
            mostrarModalPropostaAceita(entregaId, entregaData, 'entregas');
          }
        });
      });

    db.collection('descartes')
      .where('status', '==', 'aceito')
      .onSnapshot(snapshot => {
        snapshot.docChanges().forEach(ch => {
          if (ch.type !== 'added' && ch.type !== 'modified') return;
          const descarteId = ch.doc.id;
          const descarteData = ch.doc.data();
          
          const propostaAceita = descarteData.propostaAceita;
          if (propostaAceita && (propostaAceita.motoristaId === idParaUsar || propostaAceita.motoristaUid === idParaUsar)) {
            todasSolicitacoes.delete(descarteId);
            atualizarInterface();
            mostrarModalPropostaAceitaDescarte(descarteId, descarteData);
          }
        });
      });
  }

  function mostrarModalPropostaAceitaDescarte(descarteId, descarteData) {
  const nomeCliente = descarteData.clienteNome || descarteData.clienteId || "Cliente";
  const origem = descarteData.localRetirada || descarteData.origem?.endereco || 'Não informado';
  const destino = descarteData.localEntrega || descarteData.destino?.endereco || 'Não informado';
  const valor = Number(descarteData.propostaAceita?.preco || 0).toFixed(2);
  const tempo = descarteData.propostaAceita?.tempoChegada || 0;

  const modalExistente = document.getElementById('modalPropostaAceitaDescarte');
  if (modalExistente) modalExistente.remove();

  // Esconde o botão fixo
  botaoEnviar.classList.add('hidden-by-modal');

  const modal = document.createElement('div');
  modal.id = 'modalPropostaAceitaDescarte';
  modal.className = 'modal-overlay';
  modal.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.45);z-index:9999;opacity:1;';
  
  modal.innerHTML = `
      <div class="modal-content conteudo-modal proposta-aceita-style" style="width:min(520px,92vw);background:#eeeeee;border:3px solid #ff6b35;border-radius:16px;padding:20px;box-shadow:0 16px 40px rgba(0,0,0,.35);position:relative;">
          <button aria-label="Fechar" style="position:absolute;top:12px;right:14px;background:transparent;border:0;font-size:20px;color:#888;cursor:pointer">&times;</button>
          <div class="modal-header" style="text-align:center;margin-bottom:12px;">
              <h3 style="color:#1e1e1e;margin:0;font-size:1.6rem;font-weight:700"><i class="fa-solid fa-check-circle" style="color:#3DBE34;margin-right:8px;"></i> Proposta Aceita</h3>
          </div>
          <div class="modal-body">
              <p style="margin:8px 0;text-align:center;"><strong style="color:#ff6b35;">Cliente:</strong> <span style="color:#333;">${nomeCliente}</span></p>
              <div class="proposta-info" style="margin-bottom:14px;font-size:.95rem;line-height:1.45;">
                  <p style="margin:8px 0;"><strong style="color:#ff6b35;">Origem:</strong> <span style="color:#333;">${origem}</span></p>
                  <p style="margin:8px 0;"><strong style="color:#ff6b35;">Destino:</strong> <span style="color:#333;">${destino}</span></p>
                  <p style="margin:8px 0;"><strong style="color:#ff6b35;">Valor para o cliente:</strong> <span style="color:#111;font-weight:700;">R$ ${valor}</span></p>
                  <p style="margin:8px 0;"><strong style="color:#ff6b35;">Tempo até a retirada:</strong> <span style="color:#111;">${tempo} min</span></p>
              </div>
              <div class="modal-actions" style="display:flex;gap:12px;justify-content:flex-end;flex-wrap:wrap;">
                  <button id="btnIniciarCorridaDescarte" style="padding:12px 18px;background:linear-gradient(180deg,#ff7a3f 0%,#ff6b35 100%);border:0;color:#fff;border-radius:10px;cursor:pointer;font-weight:700;box-shadow:0 6px 16px rgba(255,107,53,.45);">
                      <i class="fa-solid fa-truck" style="margin-right:6px;"></i> Iniciar Corrida
                  </button>
                  <button id="btnRecusarCorridaDescarte" style="padding:12px 18px;background:#e7e7e7;border:0;color:#111;border-radius:10px;cursor:pointer;font-weight:700;">
                      <i class="fa-solid fa-times" style="margin-right:6px;"></i> Recusar Corrida
                  </button>
              </div>
          </div>
      </div>
  `;

  document.body.appendChild(modal);

  const fecharModalDescarte = () => {
    modal.remove();
    botaoEnviar.classList.remove('hidden-by-modal');
  };

  document.getElementById('btnIniciarCorridaDescarte').onclick = () => iniciarCorridaDescarte(descarteId, descarteData, nomeCliente);
  document.getElementById('btnRecusarCorridaDescarte').onclick = () => recusarCorridaDescarte(descarteId);
  modal.querySelector('button[aria-label="Fechar"]').onclick = fecharModalDescarte;
  
  modal.addEventListener('click', (e) => {
      if (e.target === modal) {
          if (confirm('Deseja recusar esta corrida?')) {
              recusarCorridaDescarte(descarteId);
          }
      }
  });
}

  async function iniciarCorridaDescarte(descarteId, descarteData, nomeCliente) {
    try {
        let origemCoords = null;
        if (descarteData.origem?.coordenadas?.lat && descarteData.origem?.coordenadas?.lng) {
            origemCoords = descarteData.origem.coordenadas;
        } else if (descarteData.origem?.lat && descarteData.origem?.lng) {
            origemCoords = { lat: descarteData.origem.lat, lng: descarteData.origem.lng };
        }
        
        let destinoCoords = null;
        if (descarteData.destino?.coordenadas?.lat && descarteData.destino?.coordenadas?.lng) {
            destinoCoords = descarteData.destino.coordenadas;
        } else if (descarteData.destino?.lat && descarteData.destino?.lng) {
            destinoCoords = { lat: descarteData.destino.lat, lng: descarteData.destino.lng };
        }
        
        const origemData = {
            endereco: descarteData.localRetirada || descarteData.origem?.endereco || '',
            numero: descarteData.numero || '',
            complemento: descarteData.complemento || '',
            cep: descarteData.cep || '',
            lat: origemCoords?.lat || null,
            lng: origemCoords?.lng || null,
        };
        
        const destinoData = {
            endereco: descarteData.localEntrega || descarteData.destino?.endereco || '',
            numero: '',
            complemento: '',
            lat: destinoCoords?.lat || null,
            lng: destinoCoords?.lng || null,
        };

        let distancia = null;
        if (origemCoords && destinoCoords) {
            const R = 6371; 
            const dLat = (destinoCoords.lat - origemCoords.lat) * Math.PI / 180;
            const dLon = (destinoCoords.lng - origemCoords.lng) * Math.PI / 180;
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                     Math.cos(origemCoords.lat * Math.PI / 180) * Math.cos(destinoCoords.lat * Math.PI / 180) * 
                     Math.sin(dLon/2) * Math.sin(dLon/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            distancia = R * c;
        }

        const corridaData = {
            entregaId: descarteId,
            tipo: 'descarte',
            status: 'em_andamento',
            iniciadaEm: firebase.firestore.FieldValue.serverTimestamp(),
            clienteId: descarteData.clienteId || null,
            clienteNome: nomeCliente || 'Cliente',
            motoristaId: motoristaUid || fallbackMotoristaId,
            nomeMotorista: nomeMotoristaReal || 'Motorista',
            origem: origemData,
            destino: destinoData,
            distancia: distancia,
            preco: Number(descarteData.propostaAceita?.preco || 0),
            tempoChegada: descarteData.propostaAceita?.tempoChegada || 0,
            ajudantes: descarteData.propostaAceita?.ajudantes || 0,
            veiculo: descarteData.propostaAceita?.veiculo || descarteData.tipoVeiculo || descarteData.tipoCaminhao || '',
            criadoEm: firebase.firestore.FieldValue.serverTimestamp()
        };

        const corridaRef = db.collection('corridas').doc(descarteId);
        await corridaRef.set(corridaData, { merge: true });
        await corridaRef.collection('sync').doc('estado').set({ 
            fase: 'indo_retirar',
            corridaId: descarteId,
            tipo: 'descarte'
        }, { merge: true });
        
        await db.collection('descartes').doc(descarteId).update({
            status: 'em_corrida',
            corridaIniciada: true,
            corridaIniciadaEm: firebase.firestore.FieldValue.serverTimestamp(),
            motoristaConfirmou: true,
            distancia: distancia
        });

        todasSolicitacoes.delete(descarteId);
        atualizarInterface();

        localStorage.setItem('corridaSelecionada', descarteId);
        localStorage.setItem('ultimaCorridaMotorista', descarteId);   
        document.getElementById('modalPropostaAceitaDescarte')?.remove();
        window.location.href = `rotaM.html?corrida=${encodeURIComponent(descarteId)}`;
        
    } catch (error) {
        console.error('Erro ao iniciar corrida de descarte:', error);
        alert('Erro ao iniciar corrida. Tente novamente.');
    }
  }

  async function recusarCorridaDescarte(descarteId) {
    try {
        await db.collection('descartes').doc(descarteId).update({
            status: 'pendente',
            propostaAceita: null,
            motoristaEscolhido: null,
            recusadaEm: firebase.firestore.FieldValue.serverTimestamp(),
            recusadaPor: motoristaUid || fallbackMotoristaId,
            motoristaRecusou: true
        });
      
        document.getElementById('modalPropostaAceitaDescarte')?.remove();
                
    } catch (error) {
        console.error('Erro ao recusar corrida de descarte:', error);
    }
  }

function mostrarModalPropostaAceita(entregaId, entregaData, collectionName) {
  const nomeCliente = entregaData.clienteNome || "Cliente";
  
  let origem, destino;
  if (collectionName === 'descartes') {
    origem = entregaData.localRetirada || entregaData.origem?.endereco || '';
    destino = entregaData.localEntrega || entregaData.destino?.endereco || '';
  } else {
    origem = entregaData.origem?.endereco || entregaData.localRetirada || '';
    destino = entregaData.destino?.endereco || entregaData.localEntrega || '';
  }
  
  const valor = Number(entregaData.propostaAceita?.preco || 0).toFixed(2);
  const tempo = entregaData.propostaAceita?.tempoChegada || 0;

  garantirModalPropostaAceita();
  document.getElementById('mm-nome-cliente').textContent = `Cliente: ${nomeCliente}`;
  document.getElementById('origem-info').textContent = origem;
  document.getElementById('destino-info').textContent = destino;
  document.getElementById('valor-info').textContent = valor;
  document.getElementById('tempo-info').textContent = tempo;

  // Esconde o botão fixo
  botaoEnviar.classList.add('hidden-by-modal');

  abrirModalPropostaAceita();

  document.getElementById('btnIniciarCorrida').onclick = () => iniciarCorrida(entregaId, entregaData, nomeCliente, collectionName);
  document.getElementById('btnRecusarCorrida').onclick = () => recusarCorridaAposAceite(entregaId, collectionName);
}

  async function iniciarCorrida(entregaId, entregaData, nomeCliente, collectionName) {
    try {
        if (collectionName === 'descartes') {
            return await iniciarCorridaDescarte(entregaId, entregaData, nomeCliente);
        }
        
        let origemCoords = null;
        if (entregaData.origem?.coordenadas?.lat && entregaData.origem?.coordenadas?.lng) {
            origemCoords = entregaData.origem.coordenadas;
        } else if (entregaData.origem?.lat && entregaData.origem?.lng) {
            origemCoords = { lat: entregaData.origem.lat, lng: entregaData.origem.lng };
        }
        
        let destinoCoords = null;
        if (entregaData.destino?.coordenadas?.lat && entregaData.destino?.coordenadas?.lng) {
            destinoCoords = entregaData.destino.coordenadas;
        } else if (entregaData.destino?.lat && entregaData.destino?.lng) {
            destinoCoords = { lat: entregaData.destino.lat, lng: entregaData.destino.lng };
        }

        const origemData = {
            endereco: entregaData.origem?.endereco || entregaData.localRetirada || '',
            numero: entregaData.origem?.numero || '',
            complemento: entregaData.origem?.complemento || '',
            cep: entregaData.origem?.cep || entregaData.cep || '',
            lat: origemCoords?.lat || null,
            lng: origemCoords?.lng || null,
        };
        
        const destinoData = {
            endereco: entregaData.destino?.endereco || entregaData.localEntrega || '',
            numero: entregaData.destino?.numero || '',
            complemento: entregaData.destino?.complemento || '',
            lat: destinoCoords?.lat || null,
            lng: destinoCoords?.lng || null,
        };

        let distancia = null;
        if (origemCoords && destinoCoords) {
            const R = 6371;
            const dLat = (destinoCoords.lat - origemCoords.lat) * Math.PI / 180;
            const dLon = (destinoCoords.lng - origemCoords.lng) * Math.PI / 180;
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                     Math.cos(origemCoords.lat * Math.PI / 180) * Math.cos(destinoCoords.lat * Math.PI / 180) * 
                     Math.sin(dLon/2) * Math.sin(dLon/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            distancia = R * c;
        }

        const corridaData = {
            entregaId,
            tipo: 'mudanca',
            status: 'em_andamento',
            iniciadaEm: firebase.firestore.FieldValue.serverTimestamp(),
            clienteId: entregaData.clienteId || null,
            clienteNome: nomeCliente || entregaData.clienteNome || 'Cliente',
            motoristaId: motoristaUid || fallbackMotoristaId,
            nomeMotorista: nomeMotoristaReal || 'Motorista',
            origem: origemData,
            destino: destinoData,
            distancia: distancia,
            preco: Number(entregaData.propostaAceita?.preco || 0),
            tempoChegada: entregaData.propostaAceita?.tempoChegada || 0,
            ajudantes: entregaData.propostaAceita?.ajudantes || 0,
            veiculo: entregaData.propostaAceita?.veiculo || entregaData.tipoVeiculo || entregaData.tipoCaminhao || '',
            criadoEm: firebase.firestore.FieldValue.serverTimestamp()
        };

        const corridaRef = db.collection('corridas').doc(entregaId);
        await corridaRef.set(corridaData, { merge: true });
        await corridaRef.collection('sync').doc('estado').set({ 
            fase: 'indo_retirar',
            corridaId: entregaId,
            tipo: 'mudanca'
        }, { merge: true });
        
        await db.collection('entregas').doc(entregaId).update({
            status: 'em_corrida',
            corridaIniciada: true,
            corridaIniciadaEm: firebase.firestore.FieldValue.serverTimestamp(),
            motoristaConfirmou: true,
            distancia: distancia
        });

        todasSolicitacoes.delete(entregaId);
        atualizarInterface();

        localStorage.setItem('corridaSelecionada', entregaId);
        localStorage.setItem('ultimaCorridaMotorista', entregaId);

        fecharModalPropostaAceita();
        window.location.href = `rotaM.html?corrida=${encodeURIComponent(entregaId)}`;
        
    } catch (error) {
        console.error('Erro ao iniciar corrida:', error);
        alert('Erro ao iniciar corrida. Tente novamente.');
    }
  }

 async function recusarCorridaAposAceite(entregaId, collectionName) {
  try {
    await db.collection(collectionName).doc(entregaId).update({
      status: collectionName === 'descartes' ? 'pendente' : 'aguardando_propostas',
      propostaAceita: null,
      motoristaEscolhido: null,
      recusadaEm: firebase.firestore.FieldValue.serverTimestamp(),
      recusadaPor: motoristaUid || fallbackMotoristaId,
      motoristaRecusou: true
    });
  } catch (error) {
    console.error('Erro ao recusar a corrida:', error);
  } finally {
    fecharModalPropostaAceita();
    // Garante que o botão volte
    botaoEnviar.classList.remove('hidden-by-modal');
  }
}

  listaEntregas.addEventListener('click', e => {
    const card = e.target.closest('.delivery-card');
    if (card) {
      document.querySelectorAll('.delivery-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      entregaSelecionadaId = card.dataset.entregaId;
      botaoEnviar.disabled = false;
    }
  });

  botaoEnviar.addEventListener('click', abrirModal);
  botaoFecharModal.addEventListener('click', fecharModal);
  botaoConfirmarProposta.addEventListener('click', enviarProposta);
  modalProposta.addEventListener('click', (e) => {
    if (e.target === modalProposta) fecharModal();
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      setTimeout(atualizarInterface, 1000);
    }
  });

  carregarTodasSolicitacoes();
});