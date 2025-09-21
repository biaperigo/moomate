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
  const STORAGE_SEL_UID = 'motorista.uid.selecionado';
  const STORAGE_SEL_NOME = 'motorista.nome.selecionado';

  function salvarSelecaoMotorista(uid, nome){
    try { localStorage.setItem(STORAGE_SEL_UID, uid||''); localStorage.setItem(STORAGE_SEL_NOME, nome||''); } catch{}
  }
  function lerSelecaoMotorista(){
    try {
      const uid = localStorage.getItem(STORAGE_SEL_UID) || '';
      const nome = localStorage.getItem(STORAGE_SEL_NOME) || '';
      return (uid && nome) ? { uid, nome } : null;
    } catch { return null; }
  }

  async function buscarMotoristasPorNome(term){
    try{
      const out=[];
      // Tenta ordenar por 'nome' (raiz), depois por 'dadosPessoais.nome', senão pega sem ordenação
      const tryRoot = await db.collection('motoristas').orderBy('nome').limit(30).get().catch(()=>null);
      const tryDP   = tryRoot?.docs?.length ? null : await db.collection('motoristas').orderBy('dadosPessoais.nome').limit(30).get().catch(()=>null);
      const lista = tryRoot?.docs?.length ? tryRoot.docs : (tryDP?.docs?.length ? tryDP.docs : (await db.collection('motoristas').limit(30).get()).docs);
      const low = (term||'').toLowerCase();
      lista.forEach(d=>{
        const data = d.data()||{};
        const nome = data?.nome || data?.dadosPessoais?.nome || d.id;
        const foto = data?.fotoPerfilUrl || data?.dadosPessoais?.fotoPerfilUrl || null;
        if(!term || nome.toLowerCase().includes(low)) out.push({ uid:d.id, nome, foto });
      });
      return out;
    }catch(e){ console.warn('[homeM] buscarMotoristasPorNome falhou:', e?.message||e); return []; }
  }

  async function selecionarMotoristaInterativo(){
    const termo = prompt('Buscar motorista por nome (deixe vazio para listar alguns):') || '';
    const itens = await buscarMotoristasPorNome(termo);
    if(!itens.length){ alert('Nenhum motorista encontrado.'); return null; }
    const texto = itens.map((m,i)=>`${i+1}) ${m.nome} — ${m.uid}`).join('\n');
    const idxStr = prompt(`Escolha o número do motorista:\n\n${texto}`);
    const idx = Number(idxStr)-1;
    if(Number.isNaN(idx) || idx<0 || idx>=itens.length){ alert('Seleção inválida.'); return null; }
    const escolhido = itens[idx];
    salvarSelecaoMotorista(escolhido.uid, escolhido.nome);
    return escolhido;
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
  
  const todasSolicitacoes = new Map();
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
async function geocodificarEndereco(endereco) {
  if (!endereco) return null;
  
  try {
    const searchQuery = endereco.includes('SP') || endereco.includes('São Paulo') ? 
      endereco : endereco + ', São Paulo, Brasil';
    
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&addressdetails=1&limit=1&countrycodes=br`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (data && data.length > 0) {
      const result = data[0];
      const lat = parseFloat(result.lat);
      const lng = parseFloat(result.lon);
      
      // Verificar se está dentro dos limites de SP
      if (lat >= -25.30 && lat <= -19.80 && lng >= -53.10 && lng <= -44.20) {
        return {
          lat: lat,
          lng: lng,
          endereco: result.display_name
        };
      }
    }
  } catch (error) {
    console.error('Erro ao geocodificar endereço:', error);
  }
  
  return null;
}
  // Calcular preço 
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

  // Função principal p carregar todas as entregas
  function carregarTodasSolicitacoes() {
    console.log('Iniciando listeners para todas as solicitações...');
    
    db.collection('entregas')
      .where('status', 'in', ['aguardando_propostas', 'pendente', 'ativo', 'disponivel'])
      .onSnapshot(snapshot => {
        console.log(' Mudanças recebidas:', snapshot.size);
        processarSnapshot(snapshot, 'mudanca');
      });

    db.collection('descartes')
      .where('status', 'in', ['aguardando_propostas', 'pendente', 'ativo', 'disponivel'])
      .onSnapshot(snapshot => {
        console.log('Descartes recebidos:', snapshot.size);
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
    loadingMessage.style.display = 'none';
    deliveryList.innerHTML = '';

    if (todasSolicitacoes.size === 0) {
      loadingMessage.textContent = 'Nenhum pedido disponível no momento.';
      loadingMessage.style.display = 'block';
      deliveryList.appendChild(loadingMessage);
      return;
    }
    const solicitacoesOrdenadas = Array.from(todasSolicitacoes.values())
      .sort((a, b) => b.dataOrdenacao - a.dataOrdenacao);

    solicitacoesOrdenadas.forEach(solicitacao => {
      const card = criarCardEntrega(solicitacao);
      deliveryList.appendChild(card);
    });

    console.log(`📋 Interface atualizada: ${solicitacoesOrdenadas.length} solicitações`);
  }

  function criarCardEntrega(solicitacao) {
    const isDescarte = solicitacao.tipo === 'descarte';
    const iconClass = isDescarte ? 'fa-recycle' : 'fa-box-open';
    const badgeClass = isDescarte ? 'recycle' : 'box';
    
    const card = document.createElement('div');
    card.className = 'delivery-card';
    card.dataset.entregaId = solicitacao.id;
    card.dataset.tipoEntrega = solicitacao.tipo;
    
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

    let distancia = '---';
    if (solicitacao.distancia && solicitacao.distancia > 0) {
      distancia = `${Number(solicitacao.distancia).toFixed(2)} km`;
    } else if (isDescarte) {
      // Calcular localmente com heurística sem chamadas externas
      const getNum = (v) => (v === undefined || v === null ? null : Number(v));
      const oLat = getNum(solicitacao.origem?.lat ?? solicitacao.origem?.coordenadas?.lat);
      const oLng = getNum(solicitacao.origem?.lng ?? solicitacao.origem?.coordenadas?.lng);
      const dLat = getNum(solicitacao.destino?.lat ?? solicitacao.destino?.coordenadas?.lat);
      const dLng = getNum(solicitacao.destino?.lng ?? solicitacao.destino?.coordenadas?.lng);

      const R = 6371;
      const toRad = (deg) => deg * Math.PI / 180;
      const haversine = (lat1, lon1, lat2, lon2) => {
        const dPhi = toRad(lat2 - lat1);
        const dLam = toRad(lon2 - lon1);
        const a = Math.sin(dPhi/2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLam/2) ** 2;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
      };

      // Centro aproximado do Estado de São Paulo (lat/lng aproximados)
      const SP_CENTER = { lat: -22.1900, lng: -48.7900 };

      if (
        typeof oLat === 'number' && !Number.isNaN(oLat) &&
        typeof oLng === 'number' && !Number.isNaN(oLng) &&
        typeof dLat === 'number' && !Number.isNaN(dLat) &&
        typeof dLng === 'number' && !Number.isNaN(dLng)
      ) {
        const distKm = haversine(oLat, oLng, dLat, dLng);
        distancia = `${distKm.toFixed(2)} km`;
      } else if (
        typeof dLat === 'number' && !Number.isNaN(dLat) &&
        typeof dLng === 'number' && !Number.isNaN(dLng)
      ) {
        // Sem origem: usar centro da cidade -> destino
        const distKm = haversine(SP_CENTER.lat, SP_CENTER.lng, dLat, dLng);
        distancia = `${distKm.toFixed(2)} km (aprox.)`;
      } else if (
        typeof oLat === 'number' && !Number.isNaN(oLat) &&
        typeof oLng === 'number' && !Number.isNaN(oLng)
      ) {
        // Sem destino: usar origem -> centro da cidade
        const distKm = haversine(oLat, oLng, SP_CENTER.lat, SP_CENTER.lng);
        distancia = `${distKm.toFixed(2)} km (aprox.)`;
      } else {
        // Sem nenhuma coord: distância aproximada média intra-SP
        distancia = `10.00 km (aprox.)`;
      }
    }

    let volumes = '';
    if (isDescarte) {
      volumes = solicitacao.descricao ? 
        (solicitacao.descricao.length > 30 ? solicitacao.descricao.substring(0, 30) + '...' : solicitacao.descricao)
        : 'Não informado';
    } else {
      volumes = solicitacao.volumes ? `${solicitacao.volumes} itens` : '---';
    }
      
    const tipoVeiculo = solicitacao.tipoVeiculo || solicitacao.tipoCaminhao || '---';    
    const tempoPostagem = getTempoPostagem(solicitacao);

    card.innerHTML = `
      <strong>${isDescarte ? 'Descarte' : 'Entrega'} #${solicitacao.id.substring(0, 6)}</strong>
      <div class="tempo-postagem">${tempoPostagem}</div>
      <div class="info-container">
        <div class="info-esquerda">
          <p><strong>Origem:</strong> ${origem} ${complemento ? '- ' + complemento : ''}</p>
          <p><strong>Destino:</strong> ${destino}</p>
        </div>
        <div class="info-meio">
          <p><strong>Distância:</strong> <span class="distancia-valor" data-id="${solicitacao.id}">${distancia}</span></p>
          <p><strong>${isDescarte ? 'Descrição' : 'Volumes'}:</strong> ${volumes}</p>
          <p><strong>Tipo de veículo:</strong> ${tipoVeiculo}</p>
        </div>
        <div class="info-direita">
          <span class="icon-area ${badgeClass}"><i class="fa-solid ${iconClass}"></i></span>
        </div>
      </div>
    `;
    // Não chamar geocodificação no homeM para evitar erros e lentidão
    return card;
  }

  

  async function calcularDistanciaDescarteParaCard(solicitacao, cardEl) {
    try {
      // Guard: evita chamadas duplicadas para o mesmo card
      if (cardEl.dataset.calcDistRunning === '1') return;
      cardEl.dataset.calcDistRunning = '1';

      console.log('[homeM] Calcular distância (card)', {
        id: solicitacao.id,
        origemEnd: solicitacao.origem?.endereco || solicitacao.localRetirada,
        destinoEnd: solicitacao.destino?.endereco || solicitacao.localEntrega
      });

      const distSpan = cardEl.querySelector('.distancia-valor');
      if (!distSpan) return;

      // Pegar coordenadas já existentes
      const getNum = (v) => (v === undefined || v === null ? null : Number(v));
      let oLat = getNum(solicitacao.origem?.lat ?? solicitacao.origem?.coordenadas?.lat);
      let oLng = getNum(solicitacao.origem?.lng ?? solicitacao.origem?.coordenadas?.lng);
      let dLat = getNum(solicitacao.destino?.lat ?? solicitacao.destino?.coordenadas?.lat);
      let dLng = getNum(solicitacao.destino?.lng ?? solicitacao.destino?.coordenadas?.lng);

      console.log('[homeM] Coords iniciais', { oLat, oLng, dLat, dLng });

      // Se faltar alguma coordenada, tentar geocodificar pelo endereço
      const precisaOrigem = !(typeof oLat === 'number' && !Number.isNaN(oLat) && typeof oLng === 'number' && !Number.isNaN(oLng));
      const precisaDestino = !(typeof dLat === 'number' && !Number.isNaN(dLat) && typeof dLng === 'number' && !Number.isNaN(dLng));

      const enderecoOrigem = solicitacao.origem?.endereco || solicitacao.localRetirada || '';
      const enderecoDestino = solicitacao.destino?.endereco || solicitacao.localEntrega || '';

      // Geocodificar faltantes com orçamento curto
      const TIMEOUT_MS = 1200;
      const withTimeout = (promise, ms) => Promise.race([
        promise,
        new Promise(resolve => setTimeout(() => resolve(null), ms))
      ]);

      if (precisaOrigem && enderecoOrigem) {
        console.log('[homeM] Geocodificando origem…', enderecoOrigem);
        const geoO = await withTimeout(geocodificarEndereco(enderecoOrigem), TIMEOUT_MS);
        if (geoO && typeof geoO.lat === 'number' && typeof geoO.lng === 'number') {
          oLat = geoO.lat; oLng = geoO.lng;
          console.log('[homeM] Origem geocodificada', { oLat, oLng });
        }
      }
      if (precisaDestino && enderecoDestino) {
        console.log('[homeM] Geocodificando destino…', enderecoDestino);
        const geoD = await withTimeout(geocodificarEndereco(enderecoDestino), TIMEOUT_MS);
        if (geoD && typeof geoD.lat === 'number' && typeof geoD.lng === 'number') {
          dLat = geoD.lat; dLng = geoD.lng;
          console.log('[homeM] Destino geocodificado', { dLat, dLng });
        }
      }

      if (
        typeof oLat === 'number' && !Number.isNaN(oLat) &&
        typeof oLng === 'number' && !Number.isNaN(oLng) &&
        typeof dLat === 'number' && !Number.isNaN(dLat) &&
        typeof dLng === 'number' && !Number.isNaN(dLng)
      ) {
        const R = 6371;
        const toRad = (deg) => deg * Math.PI / 180;
        const dPhi = toRad(dLat - oLat);
        const dLam = toRad(dLng - oLng);
        const a = Math.sin(dPhi/2) ** 2 + Math.cos(toRad(oLat)) * Math.cos(toRad(dLat)) * Math.sin(dLam/2) ** 2;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distKm = R * c;
        distSpan.textContent = `${distKm.toFixed(2)} km`;
        console.log('[homeM] Distância calculada', { id: solicitacao.id, km: distKm });
      } else {
        console.log('[homeM] Distância não pôde ser calculada (faltam coords válidas)', { oLat, oLng, dLat, dLng });
      }
    } catch (e) {
      // Silenciar erros para não afetar a UI
      console.warn('[homeM] Falha ao calcular distância do card:', e?.message || e);
    } finally {
      delete cardEl.dataset.calcDistRunning;
    }
  }

  function getTempoPostagem(solicitacao) {
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
    if (!selectedEntregaId) return alert("Selecione um pedido!");
    const solicitacao = todasSolicitacoes.get(selectedEntregaId);
    if (!solicitacao) return alert("Dados da entrega não encontrados.");

    const distKm = solicitacao.distancia || 0;
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

  async function enviarProposta() {
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
    const precoFinalCliente = precoTotalMotorista * 1.10;

    // Exigir motorista autenticado – evita gravar ID errado
    const auth = firebase.auth();
    const idParaUsar = auth?.currentUser?.uid || motoristaUid || null;
    if(!idParaUsar){
      alert('Faça login nesta página com a CONTA DE MOTORISTA para enviar propostas.');
      return;
    }
    // Validar que o UID logado é de motorista e puxar o nome
    try {
      const mSnap = await db.collection('motoristas').doc(idParaUsar).get();
      if (!mSnap.exists) {
        alert('Esta conta logada não está cadastrada em motoristas. Entre com a conta de MOTORISTA.');
        return;
      }
      const mData = mSnap.data()||{};
      nomeMotoristaReal = mData?.nome || mData?.dadosPessoais?.nome || nomeMotoristaReal || 'Motorista';
    } catch(e){ console.warn('[homeM] validação motorista falhou:', e?.message||e); }
    // Carregar dados do cliente da entrega para anexar (somente leitura)
    const solicitacao = todasSolicitacoes.get(selectedEntregaId);
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
    // Tentar agregar dados do cliente (se disponíveis na lista em memória)
    try {
      if (solicitacao?.clienteId) propostaData.clienteId = solicitacao.clienteId;
      if (solicitacao?.clienteNome) propostaData.clienteNome = solicitacao.clienteNome;
    } catch {}

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
    if (modalExistente) {
        modalExistente.remove();
    }

    const modal = document.createElement('div');
    modal.id = 'modalPropostaAceitaDescarte';
    modal.className = 'modal-overlay';
    modal.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.45);z-index:9999;opacity:1;';
    
    modal.innerHTML = `
        <div class="modal-content proposta-aceita-style" style="width:min(520px,92vw);background:#fff;border-radius:12px;padding:20px;border:3px solid #ff6b35;">
            <div class="modal-header" style="text-align:center;margin-bottom:20px;">
                <h3 style="color:#ff6b35;margin:0;"><i class="fa-solid fa-check-circle" style="color:#28a745;margin-right:8px;"></i> Proposta Aceita</h3>
            </div>
            <div class="modal-body">
                <div class="proposta-info" style="margin-bottom:20px;">
                    <p style="margin:8px 0;"><strong style="color:#ff6b35;">Origem:</strong> <span style="color:#666;">${origem}</span></p>
                    <p style="margin:8px 0;"><strong style="color:#ff6b35;">Destino:</strong> <span style="color:#666;">${destino}</span></p>
                    <p style="margin:8px 0;"><strong style="color:#ff6b35;">Valor para o cliente:</strong> <span style="color:#333;font-weight:600;">R$ ${valor}</span></p>
                    <p style="margin:8px 0;"><strong style="color:#ff6b35;">Tempo até a retirada:</strong> <span style="color:#333;">${tempo} min</span></p>
                </div>
                <div class="modal-actions" style="display:flex;gap:12px;justify-content:center;">
                    <button id="btnIniciarCorridaDescarte" style="padding:12px 20px;background:#ff6b35;border:0;color:#fff;border-radius:8px;cursor:pointer;font-weight:600;flex:1;max-width:200px;">
                        <i class="fa-solid fa-truck" style="margin-right:6px;"></i> Iniciar Corrida
                    </button>
                    <button id="btnRecusarCorridaDescarte" style="padding:12px 20px;background:#6c757d;border:0;color:#fff;border-radius:8px;cursor:pointer;font-weight:600;flex:1;max-width:200px;">
                        <i class="fa-solid fa-times" style="margin-right:6px;"></i> Recusar Corrida
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    
    document.getElementById('btnIniciarCorridaDescarte').onclick = () => iniciarCorridaDescarte(descarteId, descarteData, nomeCliente);
    document.getElementById('btnRecusarCorridaDescarte').onclick = () => recusarCorridaDescarte(descarteId);
    
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
        console.log('Iniciando corrida de descarte:', descarteId);
        
        // Geocodificar origem se não tiver coordenadas
        let origemCoords = null;
        if (descarteData.origem?.coordenadas?.lat && descarteData.origem?.coordenadas?.lng) {
            origemCoords = descarteData.origem.coordenadas;
        } else if (descarteData.localRetirada) {
            const geocoded = await geocodificarEndereco(descarteData.localRetirada);
            if (geocoded) {
                origemCoords = { lat: geocoded.lat, lng: geocoded.lng };
                
                // Atualizar o documento com as coordenadas
                await db.collection('descartes').doc(descarteId).update({
                    'origem.coordenadas': origemCoords
                });
            }
        }
        
        // Geocodificar destino se não tiver coordenadas
        let destinoCoords = null;
        if (descarteData.destino?.coordenadas?.lat && descarteData.destino?.coordenadas?.lng) {
            destinoCoords = descarteData.destino.coordenadas;
        } else if (descarteData.localEntrega) {
            const geocoded = await geocodificarEndereco(descarteData.localEntrega);
            if (geocoded) {
                destinoCoords = { lat: geocoded.lat, lng: geocoded.lng };
                
                await db.collection('descartes').doc(descarteId).update({
                    'destino.coordenadas': destinoCoords
                });
            }
        }
        
        const origemData = {
            endereco: descarteData.localRetirada || '',
            numero: descarteData.numero || '',
            complemento: descarteData.complemento || '',
            cep: descarteData.cep || '',
            lat: origemCoords?.lat || null,
            lng: origemCoords?.lng || null,
        };
        
        const destinoData = {
            endereco: descarteData.localEntrega || '',
            numero: '',
            complemento: '',
            lat: destinoCoords?.lat || null,
            lng: destinoCoords?.lng || null,
        };

        // Calcular distância se as coordenadas estiverem disponíveis
        let distancia = null;
        if (origemCoords && destinoCoords) {
            const R = 6371; 
            const dLat = (destinoCoords.lat - origemCoords.lat) * Math.PI / 180;
            const dLon = (destinoCoords.lng - origemCoords.lng) * Math.PI / 180;
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                     Math.cos(origemCoords.lat * Math.PI / 180) * Math.cos(destinoCoords.lat * Math.PI / 180) * 
                     Math.sin(dLon/2) * Math.sin(dLon/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            distancia = R * c; // Distância em km
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
        console.log('Recusando corrida de descarte:', descarteId);
        
        await db.collection('descartes').doc(descarteId).update({
            status: 'pendente',
            propostaAceita: null,
            motoristaEscolhido: null,
            recusadaEm: firebase.firestore.FieldValue.serverTimestamp(),
            recusadaPor: motoristaUid || fallbackMotoristaId,
            motoristaRecusou: true
        });
      
        document.getElementById('modalPropostaAceitaDescarte').remove();
        
        alert('Corrida recusada. A solicitação voltará para a lista de disponíveis.');
        
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
        let origemData, destinoData;
        
        if (collectionName === 'descartes') {
           
            return await iniciarCorridaDescarte(entregaId, entregaData, nomeCliente);
        }
        
        // Para entregas regulares
        let origemCoords = null;
        if (entregaData.origem?.coordenadas?.lat && entregaData.origem?.coordenadas?.lng) {
            origemCoords = entregaData.origem.coordenadas;
        } else if (entregaData.origem?.endereco || entregaData.localRetirada) {
            const endereco = entregaData.origem?.endereco || entregaData.localRetirada;
            const geocoded = await geocodificarEndereco(endereco);
            if (geocoded) {
                origemCoords = { lat: geocoded.lat, lng: geocoded.lng };
                
                // Atualizar o documento com as coordenadas
                await db.collection('entregas').doc(entregaId).update({
                    'origem.coordenadas': origemCoords
                });
            }
        }
        
        let destinoCoords = null;
        if (entregaData.destino?.coordenadas?.lat && entregaData.destino?.coordenadas?.lng) {
            destinoCoords = entregaData.destino.coordenadas;
        } else if (entregaData.destino?.endereco || entregaData.localEntrega) {
            const endereco = entregaData.destino?.endereco || entregaData.localEntrega;
            const geocoded = await geocodificarEndereco(endereco);
            if (geocoded) {
                destinoCoords = { lat: geocoded.lat, lng: geocoded.lng };
                
        
                await db.collection('entregas').doc(entregaId).update({
                    'destino.coordenadas': destinoCoords
                });
            }
        }

        origemData = {
            endereco: entregaData.origem?.endereco || entregaData.localRetirada || '',
            numero: entregaData.origem?.numero || '',
            complemento: entregaData.origem?.complemento || '',
            cep: entregaData.origem?.cep || entregaData.cep || '',
            lat: origemCoords?.lat || null,
            lng: origemCoords?.lng || null,
        };
        
        destinoData = {
            endereco: entregaData.destino?.endereco || entregaData.localEntrega || '',
            numero: entregaData.destino?.numero || '',
            complemento: entregaData.destino?.complemento || '',
            lat: destinoCoords?.lat || null,
            lng: destinoCoords?.lng || null,
        };

        // Calcular distância
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
      
      alert('Corrida recusada. A solicitação voltará para a lista de disponíveis.');
    } catch (error) {
      console.error('Erro ao recusar a corrida:', error);
    } finally {
      fecharModalPropostaAceita();
    }
  }

  // Event listeners
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

  // Atualizar quando a página volta ao foco
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      setTimeout(atualizarInterface, 1000);
    }
  });

  // Inicializar
  carregarTodasSolicitacoes();
});