// agendamentoC.js - Cliente
// Fornece funções globais para criar pedidos AGENDADOS e aceitar proposta marcando status 'agendado'.
// Compatível com Firebase v8 (mesmo padrão do projeto)
console.log('Script agendamentoC.js carregado');

// Função para verificar e logar elementos do DOM
function verificarElementos() {
  try {
    const cepInput = document.getElementById('cep');
    const localRetiradaInput = document.getElementById('localRetirada');
    const localEntregaInput = document.getElementById('localEntrega');
    
    console.log('Verificando elementos do formulário:', {
      cepInput: cepInput ? 'Encontrado' : 'Não encontrado',
      localRetiradaInput: localRetiradaInput ? 'Encontrado' : 'Não encontrado',
      localEntregaInput: localEntregaInput ? 'Encontrado' : 'Não encontrado',
      documentReadyState: document.readyState,
      firebaseCarregado: !!window.firebase,
      documentBody: document.body ? 'Pronto' : 'Não pronto'
    });
    
    return cepInput && localRetiradaInput && localEntregaInput;
  } catch (error) {
    console.error('Erro ao verificar elementos:', error);
    return false;
  }
}

// Inicialização segura do módulo
(function(){
  console.log('Iniciando módulo agendamentoC.js');
  
  // Verifica se o Firebase está disponível
  if (!window.firebase) {
    console.error('Firebase não está disponível. Verifique se o script do Firebase foi carregado corretamente.');
    return;
  }
  
  // Tenta inicializar imediatamente se o DOM estiver pronto
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    console.log('DOM já está pronto, iniciando verificação...');
    verificarElementos();
  } else {
    console.log('Aguardando DOM carregar...');
    document.addEventListener('DOMContentLoaded', () => {
      console.log('DOM completamente carregado');
      verificarElementos();
    });
  }
  const { firebase } = window;
  if (!firebase) return;
  const db = (firebase.apps && firebase.apps.length) ? firebase.firestore() : null;

  // Função para buscar endereço pelo CEP
  async function buscarEnderecoPorCEP(cep) {
    try {
      // Remove caracteres não numéricos
      cep = cep.replace(/\D/g, '');
      
      // Verifica se o CEP tem 8 dígitos
      if (cep.length !== 8) return null;
      
      // Faz a requisição para a API ViaCEP
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();
      
      // Verifica se o CEP é válido e se o estado é SP
      if (data.erro || data.uf !== 'SP') {
        throw new Error('CEP não encontrado ou fora do estado de São Paulo');
      }
      
      return {
        logradouro: data.logradouro || '',
        bairro: data.bairro || '',
        localidade: data.localidade || '',
        uf: data.uf || '',
        cep: data.cep || ''
      };
    } catch (error) {
      console.error('Erro ao buscar CEP:', error);
      throw new Error('Não foi possível buscar o endereço. Verifique o CEP e tente novamente.');
    }
  }

  // Função para formatar CEP
  function formatarCEP(cep) {
    if (!cep) return '';
    cep = cep.replace(/\D/g, '');
    if (cep.length > 5) {
      cep = cep.replace(/^(\d{5})(\d{1,3})/, '$1-$2');
    }
    return cep;
  }

  // Função para buscar sugestões de endereço via CEP
  async function buscarSugestoesEndereco(termo) {
    const cepLimpo = termo.replace(/\D/g, '');
    
    // Só busca se tiver pelo menos 5 dígitos (CEP parcial)
    if (cepLimpo.length < 5) return [];
    
    try {
      // Busca o endereço completo pelo CEP
      const endereco = await buscarEnderecoPorCEP(cepLimpo);
      
      if (endereco) {
        return [{
          logradouro: endereco.logradouro,
          bairro: endereco.bairro,
          localidade: endereco.localidade,
          uf: endereco.uf,
          cep: endereco.cep
        }];
      }
      
      return [];
    } catch (error) {
      console.error('Erro ao buscar sugestões de endereço:', error);
      return [];
    }
  }

  // Cria o dropdown de sugestões
  function criarDropdownSugestoes(inputElement, sugestoes, onSelect) {
    // Remove dropdowns existentes
    removerDropdown();
    
    if (sugestoes.length === 0) return;
    
    const dropdown = document.createElement('div');
    dropdown.className = 'sugestoes-dropdown';
    dropdown.style.position = 'absolute';
    dropdown.style.width = '100%';
    dropdown.style.maxHeight = '200px';
    dropdown.style.overflowY = 'auto';
    dropdown.style.background = 'white';
    dropdown.style.border = '1px solid #ddd';
    dropdown.style.borderRadius = '4px';
    dropdown.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
    dropdown.style.zIndex = '1000';
    
    // Filtra sugestões únicas baseadas no logradouro e bairro
    const sugestoesUnicas = [];
    const chavesVistas = new Set();
    
    sugestoes.forEach(sugestao => {
      const chave = `${sugestao.logradouro}-${sugestao.bairro}`;
      if (!chavesVistas.has(chave)) {
        chavesVistas.add(chave);
        sugestoesUnicas.push(sugestao);
      }
    });
    
    // Limita a 5 sugestões para não sobrecarregar a tela
    sugestoesUnicas.slice(0, 5).forEach((sugestao, index) => {
      const item = document.createElement('div');
      item.textContent = `${sugestao.logradouro}, ${sugestao.bairro} - ${sugestao.localidade}/${sugestao.uf}`;
      item.style.padding = '10px 12px';
      item.style.cursor = 'pointer';
      item.style.borderBottom = '1px solid #f0f0f0';
      item.style.fontSize = '14px';
      item.style.color = '#333';
      
      item.addEventListener('mouseover', () => {
        item.style.backgroundColor = '#fff9f4';
        item.style.color = '#ff6c0c';
      });
      
      item.addEventListener('mouseout', () => {
        item.style.backgroundColor = 'white';
        item.style.color = '#333';
      });
      
      item.addEventListener('click', () => {
        if (typeof onSelect === 'function') {
          onSelect(sugestao);
        } else {
          inputElement.value = formatarEndereco(sugestao);
        }
        removerDropdown();
      });
      
      dropdown.appendChild(item);
    });
    
    // Posiciona o dropdown abaixo do input
    const rect = inputElement.getBoundingClientRect();
    dropdown.style.position = 'absolute';
    dropdown.style.top = `${rect.bottom + window.scrollY}px`;
    dropdown.style.left = `${rect.left + window.scrollX}px`;
    dropdown.style.width = `${rect.width}px`;
    dropdown.style.zIndex = '1000';
    
    document.body.appendChild(dropdown);
  }
  
  function removerDropdown() {
    const dropdown = document.querySelector('.sugestoes-dropdown');
    if (dropdown) {
      document.body.removeChild(dropdown);
      document.removeEventListener('click', fecharDropdownAoClicarFora);
    }
  }
  
  function fecharDropdownAoClicarFora(event) {
    const dropdown = document.querySelector('.sugestoes-dropdown');
    if (dropdown && !dropdown.contains(event.target)) {
      removerDropdown();
    }
  }

  // Função para formatar endereço completo
  function formatarEndereco(endereco) {
    return [
      endereco.logradouro,
      endereco.bairro,
      `${endereco.localidade} - ${endereco.uf}`
    ].filter(Boolean).join(', ');
  }

  // Inicializa o autocomplete de CEP e endereço
  function inicializarAutoCompleteCEP() {
    const cepInput = document.getElementById('cep');
    const localRetiradaInput = document.getElementById('localRetirada');
    const localEntregaInput = document.getElementById('localEntrega');
    const numeroRetirada = document.getElementById('numeroRetirada');
    const complementoRetirada = document.getElementById('complementoRetirada');
    
    if (!cepInput || !localRetiradaInput || !localEntregaInput) return;

    // Formata o CEP enquanto digita
    cepInput.addEventListener('input', (e) => {
      e.target.value = formatarCEP(e.target.value);
    });

    // Busca o endereço quando o CEP perde o foco
    cepInput.addEventListener('blur', async () => {
      const cep = cepInput.value.replace(/\D/g, '');
      if (cep.length === 8) {
        try {
          const endereco = await buscarEnderecoPorCEP(cep);
          if (endereco) {
            localRetiradaInput.value = formatarEndereco(endereco);
            // Foca no campo de número após preencher o endereço
            numeroRetirada.focus();
          }
        } catch (error) {
          alert(error.message);
          cepInput.value = '';
          cepInput.focus();
        }
      }
    });

    // Autocomplete para o campo de retirada (quando o usuário digita o endereço manualmente)
    let timeoutRetirada;
    localRetiradaInput.addEventListener('input', async (e) => {
      const termo = e.target.value.trim();
      
      // Limpa o timeout anterior
      if (timeoutRetirada) {
        clearTimeout(timeoutRetirada);
      }
      
      // Se o campo estiver vazio, remove o dropdown
      if (termo.length < 5) {
        removerDropdown();
        return;
      }
      
      // Aguarda o usuário parar de digitar (300ms)
      timeoutRetirada = setTimeout(async () => {
        try {
          // Tenta buscar por logradouro
          const response = await fetch(`https://viacep.com.br/ws/SP/${encodeURIComponent(termo)}/json/`);
          const data = await response.json();
          
          if (data && !data.erro) {
            const resultados = Array.isArray(data) ? data : [data];
            const sugestoes = resultados
              .filter(end => end.uf === 'SP' && end.logradouro)
              .map(end => ({
                logradouro: end.logradouro,
                bairro: end.bairro,
                localidade: end.localidade,
                uf: end.uf,
                cep: end.cep
              }));
              
            if (sugestoes.length > 0) {
              criarDropdownSugestoes(localRetiradaInput, sugestoes, (enderecoSelecionado) => {
                localRetiradaInput.value = formatarEndereco(enderecoSelecionado);
                cepInput.value = enderecoSelecionado.cep.replace(/^(\d{5})(\d{3})$/, '$1-$2');
                numeroRetirada.focus();
              });
            }
          }
        } catch (error) {
          console.error('Erro ao buscar endereço:', error);
        }
      }, 300);
    });
    
    // Autocomplete para o campo de entrega
    let timeoutEntrega;
    localEntregaInput.addEventListener('input', async (e) => {
      const termo = e.target.value.trim();
      
      // Limpa o timeout anterior
      if (timeoutEntrega) {
        clearTimeout(timeoutEntrega);
      }
      
      // Se o campo estiver vazio, remove o dropdown
      if (termo.length < 3) {
        removerDropdown();
        return;
      }
      
      // Aguarda o usuário parar de digitar (300ms)
      timeoutEntrega = setTimeout(async () => {
        try {
          // Busca por logradouro no estado de SP
          const response = await fetch(`https://viacep.com.br/ws/SP/${encodeURIComponent(termo)}/json/`);
          const data = await response.json();
          
          if (data && !data.erro) {
            const resultados = Array.isArray(data) ? data : [data];
            const sugestoes = resultados
              .filter(end => end.uf === 'SP' && end.logradouro)
              .map(end => ({
                logradouro: end.logradouro,
                bairro: end.bairro,
                localidade: end.localidade,
                uf: end.uf,
                cep: end.cep
              }));
              
            if (sugestoes.length > 0) {
              criarDropdownSugestoes(localEntregaInput, sugestoes, (enderecoSelecionado) => {
                localEntregaInput.value = formatarEndereco(enderecoSelecionado);
                document.getElementById('numeroEntrega').focus();
              });
            } else {
              removerDropdown();
            }
          } else {
            removerDropdown();
          }
        } catch (error) {
          console.error('Erro ao buscar sugestões de endereço:', error);
          removerDropdown();
        }
      }, 300);
    });
    
    // Fecha os dropdowns ao pressionar Enter ou Tab
    [localRetiradaInput, localEntregaInput].forEach(input => {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === 'Tab') {
          removerDropdown();
        }
      });
    });
    
    // Fecha os dropdowns ao clicar fora
    document.addEventListener('click', (e) => {
      if (!localRetiradaInput.contains(e.target) && !localEntregaInput.contains(e.target)) {
        removerDropdown();
      }
    });
  }

  // Função para inicializar o autocomplete
  function tentarInicializarAutoComplete() {
    console.log('Tentando inicializar o autocomplete...');
    
    const cepInput = document.getElementById('cep');
    const localRetiradaInput = document.getElementById('localRetirada');
    const localEntregaInput = document.getElementById('localEntrega');
    
    console.log('Elementos encontrados:', {
      cepInput: !!cepInput,
      localRetiradaInput: !!localRetiradaInput,
      localEntregaInput: !!localEntregaInput
    });
    
    if (cepInput && localRetiradaInput && localEntregaInput) {
      console.log('Inicializando autocomplete...');
      try {
        inicializarAutoCompleteCEP();
        console.log('Autocomplete inicializado com sucesso!');
      } catch (error) {
        console.error('Erro ao inicializar autocomplete:', error);
      }
    } else {
      console.log('Aguardando elementos do formulário...');
      // Tenta novamente após um curto atraso
      setTimeout(tentarInicializarAutoComplete, 1000);
    }
  }
  
  // Inicializa quando o DOM estiver pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tentarInicializarAutoComplete);
  } else {
    // DOM já está pronto
    tentarInicializarAutoComplete();
  }

  function tsFrom(dateOrMillis){
    try{
      if (typeof dateOrMillis === 'number') return firebase.firestore.Timestamp.fromMillis(dateOrMillis);
      if (dateOrMillis instanceof Date) return firebase.firestore.Timestamp.fromDate(dateOrMillis);
      // ISO string
      const dt = new Date(dateOrMillis);
      return firebase.firestore.Timestamp.fromDate(dt);
    }catch{ return null; }
  }

  async function getUser(){
    try{
      const auth = firebase.auth();
      return auth.currentUser || null;
    }catch{ return null; }
  }

  function validarEstadoSP(cep) {
    const cepNum = parseInt(cep.replace(/\D/g, ''), 10);
    return cepNum >= 1000000 && cepNum <= 19999999;
  }

  async function criarMudancaAgendada({
    origem, // { endereco, numero?, complemento?, cep?, coordenadas? {lat,lng} }
    destino, // { endereco, numero?, complemento?, cep?, coordenadas? {lat,lng} }
    volumes = 0,
    tipoVeiculo = 'pequeno',
    dataHoraAgendada, // Date | millis | ISO
  }) {
    if (!db) throw new Error('Firebase não inicializado');

    const user = await getUser();
    if (!user) throw new Error('Usuário não autenticado');

    // Validações
    if (!origem?.endereco || !destino?.endereco) {
      throw new Error('Origem e destino são obrigatórios');
    }

    if (!validarEstadoSP(origem.cep || '')) {
      throw new Error('CEP de origem deve ser do estado de São Paulo');
    }

    if (!validarEstadoSP(destino.cep || '')) {
      throw new Error('CEP de destino deve ser do estado de São Paulo');
    }

    const dados = {
      tipo: 'mudanca',
      origem,
      destino,
      volumes,
      tipoVeiculo,
      dataHoraAgendada: tsFrom(dataHoraAgendada),
      status: 'agendado',
      clienteId: user.uid,
      criadoEm: tsFrom(new Date())
    };

    const docRef = await db.collection('agendamentos').add(dados);
    return docRef.id;
  }

  async function criarDescarteAgendado({
    origem, // { endereco, numero?, complemento?, cep?, coordenadas? {lat,lng} }
    destino, // { endereco, numero?, complemento?, cep?, coordenadas? {lat,lng} }
    tipoCaminhao = 'pequeno',
    descricao = '',
    dataHoraAgendada,
  }) {
    if (!db) throw new Error('Firebase não inicializado');

    const user = await getUser();
    if (!user) throw new Error('Usuário não autenticado');

    // Validações
    if (!origem?.endereco || !destino?.endereco) {
      throw new Error('Origem e destino são obrigatórios');
    }

    if (!validarEstadoSP(origem.cep || '')) {
      throw new Error('CEP de origem deve ser do estado de São Paulo');
    }

    if (!validarEstadoSP(destino.cep || '')) {
      throw new Error('CEP de destino deve ser do estado de São Paulo');
    }

    const dados = {
      tipo: 'descarte',
      origem,
      destino,
      tipoCaminhao,
      descricao,
      dataHoraAgendada: tsFrom(dataHoraAgendada),
      status: 'agendado',
      clienteId: user.uid,
      criadoEm: tsFrom(new Date())
    };

    const docRef = await db.collection('agendamentos').add(dados);
    return docRef.id;
  }

  async function aceitarPropostaAgendada(colecao, docId, propostaId, motoristaUid) {
    if (!db) throw new Error('Firebase não inicializado');

    const user = await getUser();
    if (!user) throw new Error('Usuário não autenticado');

    const docRef = db.collection(colecao).doc(docId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      throw new Error('Documento não encontrado');
    }

    const dados = docSnap.data();
    const proposta = dados.propostas?.[propostaId];

    if (!proposta) {
      throw new Error('Proposta não encontrada');
    }

    await docRef.update({
      status: 'agendado',
      propostaAceita: {
        id: propostaId,
        motoristaUid,
        ...proposta
      },
      aceitoEm: tsFrom(new Date())
    });

    return true;
  }

  // API pública
  window.agendamentoC = {
    criarMudancaAgendada,
    criarDescarteAgendado,
    aceitarPropostaAgendada,
    validarEstadoSP,
    getUser
  };

  // Ouvir propostas para o doc criado e renderizar na própria página
  async function ouvirPropostasAgendamento(colecao, entregaId) {
    if (!db || !entregaId) return;

    const container = document.getElementById('propostasContainer');
    if (!container) return;

    container.innerHTML = `
      <h3>Propostas Recebidas</h3>
      <div id="lista-propostas" class="lista-propostas"></div>
    `;

    const lista = document.getElementById('lista-propostas');
    if (!lista) return;

    db.collection(colecao)
      .doc(entregaId)
      .collection('propostas')
      .orderBy('dataEnvio', 'asc')
      .onSnapshot(async (snapshot) => {
        if (snapshot.empty) {
          lista.innerHTML = `<p>Aguardando propostas dos motoristas...</p>`;
          return;
        }

        lista.innerHTML = '';

        for (const doc of snapshot.docs) {
          const proposta = doc.data();
          const card = document.createElement('div');
          card.className = 'proposta-card';
          card.innerHTML = `
            <div style="background:#fff; border-radius:16px; box-shadow:0 10px 24px rgba(0,0,0,.08); padding:18px; display:flex; gap:16px; align-items:flex-start;">
              <div style="position:absolute; left:0; top:14px; bottom:14px; width:6px; background:linear-gradient(180deg,#ff7a3f 0%,#ff6b35 100%); border-radius:0 6px 6px 0"></div>
              <div style="margin-left:16px; width:52px; height:52px; border-radius:50%; background:#fff; box-shadow:0 6px 14px rgba(255,107,53,.35); border:2px solid #ff6b35; display:flex; align-items:center; justify-content:center; overflow:hidden; flex: 0 0 52px;">
                <i class="fa-solid fa-user" style="color:#ff6b35;font-size:22px"></i>
              </div>
              <div style="flex:1 1 auto; min-width:0;">
                <div style="font-weight:700;color:#1e1e1e">Motorista</div>
                <div style="color:#f5a623;font-weight:700; display:flex; align-items:center; gap:6px; margin-top:2px">
                  <i class="fa-solid fa-star"></i> 5.0
                </div>
                <div style="margin-top:10px; color:#333; line-height:1.35">
                  <div><strong>Tempo de chegada:</strong> ${proposta.tempoChegada || 0} min</div>
                  <div><strong>Ajudantes:</strong> ${proposta.ajudantes || 0}</div>
                </div>
              </div>
              <div style="text-align:right; min-width:180px; padding-left:8px;">
                <div style="color:#ff6b35;font-size:1.9rem;font-weight:800">R$ ${Number(proposta.preco||0).toFixed(2)}</div>
                <button class="aceitar-btn" style="margin-top:12px;background:#ff6b35;color:#fff;border:0;padding:12px 16px;border-radius:12px;cursor:pointer;font-weight:800"
                  onclick="agendamentoC.aceitarPropostaAgendada('${colecao}', '${entregaId}', '${doc.id}', '${proposta.motoristaUid || ''}')">ACEITAR PROPOSTA</button>
              </div>
            </div>
          `;
          lista.appendChild(card);
        }
      });
  }

  window.ouvirPropostasAgendamento = ouvirPropostasAgendamento;

  // Inicialização dos eventos do formulário
  document.addEventListener('DOMContentLoaded', function() {
    console.log('Inicializando eventos do formulário de agendamento...');

    // Configurar CEP
    const cepField = document.getElementById('cep');
    if (cepField) {
      cepField.addEventListener('input', (e) => {
        e.target.value = formatarCEP(e.target.value);
      });

      // Busca endereço quando CEP perde foco
      cepField.addEventListener('blur', async () => {
        const cep = cepField.value.replace(/\D/g, '');
        if (cep.length === 8) {
          try {
            const endereco = await buscarEnderecoPorCEP(cep);
            if (endereco) {
              const localRetiradaInput = document.getElementById('localRetirada');
              if (localRetiradaInput) {
                localRetiradaInput.value = formatarEndereco(endereco);
                document.getElementById('numeroRetirada')?.focus();
              }
            }
          } catch (error) {
            alert(error.message);
            cepField.value = '';
            cepField.focus();
          }
        }
      });
    }

    // Configurar autocomplete para endereços
    const localRetiradaField = document.getElementById('localRetirada');
    const localEntregaField = document.getElementById('localEntrega');

    if (localRetiradaField) {
      localRetiradaField.addEventListener('input', async (e) => {
        const termo = e.target.value.trim();
        if (termo.length < 5) {
          removerDropdown();
          return;
        }

        clearTimeout(window.timeoutRetirada);
        window.timeoutRetirada = setTimeout(async () => {
          try {
            const response = await fetch(`https://viacep.com.br/ws/SP/${encodeURIComponent(termo)}/json/`);
            const data = await response.json();

            if (data && !data.erro) {
              const resultados = Array.isArray(data) ? data : [data];
              const sugestoes = resultados
                .filter(end => end.uf === 'SP' && end.logradouro)
                .map(end => ({
                  logradouro: end.logradouro,
                  bairro: end.bairro,
                  localidade: end.localidade,
                  uf: end.uf,
                  cep: end.cep
                }));

              if (sugestoes.length > 0) {
                criarDropdownSugestoes(localRetiradaField, sugestoes, (enderecoSelecionado) => {
                  localRetiradaField.value = formatarEndereco(enderecoSelecionado);
                  if (cepField) {
                    cepField.value = enderecoSelecionado.cep.replace(/^(\d{5})(\d{3})$/, '$1-$2');
                  }
                  document.getElementById('numeroRetirada')?.focus();
                });
              }
            }
          } catch (error) {
            console.error('Erro ao buscar endereço:', error);
          }
        }, 300);
      });
    }

    if (localEntregaField) {
      localEntregaField.addEventListener('input', async (e) => {
        const termo = e.target.value.trim();
        if (termo.length < 3) {
          removerDropdown();
          return;
        }

        clearTimeout(window.timeoutEntrega);
        window.timeoutEntrega = setTimeout(async () => {
          try {
            const response = await fetch(`https://viacep.com.br/ws/SP/${encodeURIComponent(termo)}/json/`);
            const data = await response.json();

            if (data && !data.erro) {
              const resultados = Array.isArray(data) ? data : [data];
              const sugestoes = resultados
                .filter(end => end.uf === 'SP' && end.logradouro)
                .map(end => ({
                  logradouro: end.logradouro,
                  bairro: end.bairro,
                  localidade: end.localidade,
                  uf: end.uf,
                  cep: end.cep
                }));

              if (sugestoes.length > 0) {
                criarDropdownSugestoes(localEntregaField, sugestoes);
              }
            }
          } catch (error) {
            console.error('Erro ao buscar sugestões de entrega:', error);
          }
        }, 300);
      });
    }

    // Configurar botão de confirmar agendamento
    const btnConfirmar = document.getElementById('confirmarAgendamento');
    if (btnConfirmar) {
      btnConfirmar.addEventListener('click', async () => {
        try {
          // Coletar dados do formulário
          const data = (document.getElementById('dataAgendamento')?.value || '').trim();
          const hora = (document.getElementById('horaAgendamento')?.value || '').trim();
          const cep = (document.getElementById('cep')?.value || '').trim();
          const localRet = (document.getElementById('localRetirada')?.value || '').trim();
          const numRet = (document.getElementById('numeroRetirada')?.value || '').trim();
          const compRet = (document.getElementById('complementoRetirada')?.value || '').trim();
          const localEnt = (document.getElementById('localEntrega')?.value || '').trim();
          const numEnt = (document.getElementById('numeroEntrega')?.value || '').trim();
          const compEnt = (document.getElementById('complementoEntrega')?.value || '').trim();
          const volumes = Number(document.getElementById('volumes')?.value || 0);
          const tipoVeiculo = (document.getElementById('tipoVeiculo')?.value || '').trim() || 'pequeno';

          if (!data || !hora) return alert('Informe data e hora do agendamento.');
          if (!localRet || !localEnt) return alert('Informe origem e destino.');
          if (!volumes || volumes <= 0) return alert('Informe o número de volumes.');

          const dataHoraAgendada = new Date(`${data}T${hora}:00`);

          const origem = { endereco: localRet, numero: numRet, complemento: compRet, cep: cep };
          const destino = { endereco: localEnt, numero: numEnt, complemento: compEnt };

          const id = await criarMudancaAgendada({ origem, destino, volumes, tipoVeiculo, dataHoraAgendada });

          alert('Agendamento criado com sucesso! Aguardando propostas dos motoristas...');
          const propSec = document.getElementById('propostasSection');
          if (propSec) propSec.style.display = 'block';
          ouvirPropostasAgendamento('agendamentos', id);
        } catch (e) {
          console.error('Falha ao criar agendamento:', e);
          alert('Não foi possível criar o agendamento. Faça login e tente novamente.');
        }
      });
    }

    // Fechar dropdowns ao clicar fora
    document.addEventListener('click', (e) => {
      const localRetiradaField = document.getElementById('localRetirada');
      const localEntregaField = document.getElementById('localEntrega');
      if (!localRetiradaField?.contains(e.target) && !localEntregaField?.contains(e.target)) {
        removerDropdown();
      }
    });

    console.log('Eventos do formulário inicializados com sucesso!');
  });
})();
