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

    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();
    const descarteForm = document.getElementById('descarteForm');
    const propostasContainer = document.getElementById('propostasContainer');
    const localRetiradaInput = document.getElementById('localRetirada');
    const localEntregaInput = document.getElementById('localEntrega');
    const cepInput = document.getElementById('cep');
    
    let currentDescarteId = null;
    const SP_BOUNDS = {
        north: -19.80,
        south: -25.30,
        east: -44.20,
        west: -53.10
    };
    function isWithinSaoPaulo(lat, lng) {
        return lat >= SP_BOUNDS.south && lat <= SP_BOUNDS.north && 
               lng >= SP_BOUNDS.west && lng <= SP_BOUNDS.east;
    }
    function isCEPSaoPaulo(cep) {
        const cepNum = parseInt(cep.replace(/\D/g, ''), 10);
        return cepNum >= 1000000 && cepNum <= 19999999;
    }
    let timeoutAutocomplete;

    async function autocompleteEndereco(campo) {
        clearTimeout(timeoutAutocomplete);
        timeoutAutocomplete = setTimeout(async () => {
            const input = document.getElementById(campo);
            const val = input.value.trim();
            if (val.length < 3) {
                closeAutocomplete(campo);
                return;
            }

            const searchQuery = val.includes('SP') || val.includes('São Paulo') ? 
                val : val + ', São Paulo, Brasil';
            
            try {
                const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&addressdetails=1&limit=10&countrycodes=br`;
                const res = await fetch(url);
                const data = await res.json();

                const spResults = data.filter(item => {
                    const lat = parseFloat(item.lat);
                    const lng = parseFloat(item.lon);
                    return isWithinSaoPaulo(lat, lng) && 
                           (item.address?.state?.toLowerCase().includes('são paulo') ||
                            item.address?.state?.toLowerCase().includes('sp') ||
                            item.display_name.toLowerCase().includes('são paulo'));
                });

                showAutocompleteList(campo, spResults);
            } catch (error) {
                console.error('Erro no autocomplete:', error);
            }
        }, 300);
    }

    function showAutocompleteList(campo, data) {
        let container = document.getElementById(`autocomplete-list-${campo}`);
        if (!container) {
            container = document.createElement('div');
            container.id = `autocomplete-list-${campo}`;
            container.classList.add('autocomplete-items');
            document.getElementById(campo).parentNode.appendChild(container);
        }
        
        container.innerHTML = '';
        
        if (data.length === 0) {
            container.style.display = 'none';
            return;
        }

        data.forEach(item => {
            const div = document.createElement('div');
            div.className = 'autocomplete-item';
            div.textContent = item.display_name;
            div.addEventListener('click', () => {
                selectAutocompleteItem(campo, item);
                closeAutocomplete(campo);
            });
            container.appendChild(div);
        });

        container.style.display = 'block';
    }

    function selectAutocompleteItem(campo, item) {
        document.getElementById(campo).value = item.display_name;
        if (campo === 'localRetirada' && item.address?.postcode) {
            const cep = item.address.postcode.replace(/\D/g, '');
            if (isCEPSaoPaulo(cep)) {
                document.getElementById('cep').value = formatarCEP(cep);
            }
        }
    }

    function closeAutocomplete(campo) {
        const container = document.getElementById(`autocomplete-list-${campo}`);
        if (container) {
            container.style.display = 'none';
        }
    }

    //  Autocomplete de Ecopontos 
    function setupEcopontosAutocomplete() {
        if (!localEntregaInput) return;

        localEntregaInput.addEventListener('input', () => {
            const valor = localEntregaInput.value.trim();
            if (valor.length < 2) {
                closeAutocomplete('localEntrega');
                return;
            }
            const ecopontosSP = [
                'Ecoponto Liberdade - Rua Galvão Bueno, 425',
                'Ecoponto Vila Madalena - Rua Harmonia, 1047',
                'Ecoponto Mooca - Rua da Mooca, 2418',
                'Ecoponto Santana - Av. Cruzeiro do Sul, 1100',
                'Ecoponto Ipiranga - Av. Nazaré, 1555',
                'Ecoponto Lapa - Rua Guaicurus, 1000',
                'Ecoponto Butantã - Av. Corifeu de Azevedo Marques, 5000',
                'Ecoponto Vila Prudente - Av. Prof. Luiz Ignácio Anhaia Mello, 3012',
                'Ecoponto Penha - Rua Candapuí, 492',
                'Ecoponto Cidade Tiradentes - Av. dos Metalúrgicos, 2255',
                'Ecoponto Pirituba - Av. Raimundo Pereira de Magalhães, 1465',
                'Ecoponto Jabaquara - Av. Engenheiro Armando de Arruda Pereira, 2314',
                'Ecoponto Itaquera - Av. Itaquera, 8266',
                'Ecoponto São Miguel - Av. Marechal Tito, 3012',
                'Ecoponto Ermelino Matarazzo - Av. Paranaguá, 1000'
            ];
            const resultados = ecopontosSP.filter(ecoponto => 
                ecoponto.toLowerCase().includes(valor.toLowerCase())
            ).slice(0, 10);

            showEcopontosAutocompleteList(resultados);
        });

        document.addEventListener('click', (e) => {
            if (!e.target.closest('#localEntrega') && !e.target.closest('#autocomplete-list-localEntrega')) {
                closeAutocomplete('localEntrega');
            }
        });
    }

    function showEcopontosAutocompleteList(ecopontos) {
        let container = document.getElementById('autocomplete-list-localEntrega');
        if (!container) {
            container = document.createElement('div');
            container.id = 'autocomplete-list-localEntrega';
            container.classList.add('autocomplete-items');
            localEntregaInput.parentNode.appendChild(container);
        }

        container.innerHTML = '';
        
        if (ecopontos.length === 0) {
            container.style.display = 'none';
            return;
        }

        ecopontos.forEach(ecoponto => {
            const div = document.createElement('div');
            div.className = 'autocomplete-item';
            div.textContent = ecoponto;
            div.addEventListener('click', () => {
                localEntregaInput.value = ecoponto;
                closeAutocomplete('localEntrega');
            });
            container.appendChild(div);
        });

        container.style.display = 'block';
    }
    function formatarCEP(cep) {
        cep = cep.replace(/\D/g, '');
        return cep.length === 8 ? cep.substr(0, 5) + '-' + cep.substr(5, 3) : cep;
    }

    async function buscarEnderecoPorCEP(cep) {
        try {
            const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            const data = await res.json();
            
            if (data.erro) {
                alert('CEP não encontrado!');
                return;
            }

            if (data.uf !== 'SP') {
                alert('Este CEP não pertence ao estado de São Paulo.');
                cepInput.value = '';
                return;
            }

            const endereco = `${data.logradouro}, ${data.bairro}, ${data.localidade} - ${data.uf}`;
            localRetiradaInput.value = endereco;

        } catch (error) {
            console.error('Erro ao buscar CEP:', error);
            alert('Erro ao buscar o endereço pelo CEP.');
        }
    }

    function setupCEPInput() {
        if (!cepInput) return;

        cepInput.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length <= 8) {
                e.target.value = formatarCEP(value);
            }
        });

        cepInput.addEventListener('blur', () => {
            const cep = cepInput.value.replace(/\D/g, '');
            if (cep.length === 8) {
                if (isCEPSaoPaulo(cep)) {
                    buscarEnderecoPorCEP(cep);
                } else {
                    alert('Por favor, digite um CEP do estado de São Paulo.');
                    cepInput.value = '';
                }
            }
        });
    }
    function setupEnderecoAutocomplete() {
        if (localRetiradaInput) {
            localRetiradaInput.addEventListener('input', () => {
                autocompleteEndereco('localRetirada');
            });
            document.addEventListener('click', (e) => {
                if (!e.target.closest('#localRetirada') && !e.target.closest('#autocomplete-list-localRetirada')) {
                    closeAutocomplete('localRetirada');
                }
            });
        }
    }
    const enviarParaFirebase = async (dadosDescarte) => {
        try {
            console.log('Enviando dados para Firebase:', dadosDescarte);
            const docRef = await db.collection('descartes').add({
                ...dadosDescarte,
                status: 'pendente',
                dataEnvio: firebase.firestore.FieldValue.serverTimestamp(),
                tipo: 'descarte'
            });

            currentDescarteId = docRef.id;
            console.log('Descarte salvo com ID:', currentDescarteId);
            
            propostasContainer.style.display = 'block';
            propostasContainer.scrollIntoView({ behavior: 'smooth' });
            
            ouvirPropostas(currentDescarteId);
            
            return currentDescarteId;
        } catch (error) {
            console.error('Erro ao salvar no Firebase:', error);
            alert('Erro ao enviar solicitação. Tente novamente.');
        }
    };
//  Propostas em Tempo Real
const ouvirPropostas = (descarteId) => {
    if (!db || !descarteId) return;
    db.collection('descartes').doc(descarteId).get().then(doc => {
        if (!doc.exists) {
            console.error("Documento de descarte não encontrado!");
            return;
        }
        const descarteData = doc.data();

        db.collection('descartes')
            .doc(descarteId)
            .collection('propostas')
            .orderBy('dataEnvio', 'asc')
            .onSnapshot((snapshot) => {
                const lista = document.getElementById('lista-propostas');
                
                if (snapshot.empty) {
                    lista.innerHTML = '<p>Aguardando propostas dos motoristas...</p>';
                    return;
                }

                const aguardando = lista.querySelector('p');
                if (aguardando && aguardando.textContent.includes('Aguardando')) {
                    aguardando.remove();
                }

                snapshot.docChanges().forEach((change) => {
                    if (change.type === 'added') {
                        const proposta = change.doc.data();
                        proposta.id = change.doc.id;
                        
                        exibirProposta(proposta, descarteData); 
                    }
                });
            });
    }).catch(error => {
        console.error("Erro ao buscar dados do descarte:", error);
    });
};

const exibirProposta = (proposta, descarteData) => { //  dados da corrida 
    const lista = document.getElementById('lista-propostas');

    const origem = descarteData.localRetirada || 'N/A';
    const destino = descarteData.localEntrega || 'N/A';

    const propostaDiv = document.createElement('div');
    propostaDiv.classList.add('proposta-card', 'sustentavel');
    propostaDiv.innerHTML = `
        <div class="proposta-header">
            <div class="motorista-info">
                <div class="motorista-avatar">
                    <i class="fa-solid fa-user"></i>
                </div>
                <div class="motorista-dados">
                    <h4>${proposta.nomeMotorista || 'Motorista'}</h4>
                    <div class="avaliacao">
                        <i class="fa-solid fa-star"></i>
                        <span>${proposta.avaliacaoMotorista || '5.0'}</span>
                    </div>
                </div>
            </div>
            <div class="icone-sustentavel">
                <i class="fa-solid fa-recycle"></i>
            </div>
        </div>
        <div class="proposta-body">
            <div class="proposta-info">
                <p><strong>Descarte #${currentDescarteId.substring(0, 6)}</strong></p>
                <p><strong>De:</strong> ${origem}</p>
                <p><strong>Para:</strong> ${destino}</p>
                <p><strong>Tipo de veículo:</strong> ${proposta.veiculo || 'N/A'}</p>
                <p><strong>Tempo de chegada:</strong> ${proposta.tempoChegada || 0} min</p>
            </div>
            <div class="proposta-preco">
                <span class="valor">R$ ${Number(proposta.preco || 0).toFixed(2)}</span>
                <button class="btn-aceitar-proposta" data-proposta-id="${proposta.id}" data-motorista="${proposta.nomeMotorista || 'Motorista'}">
                    Aceitar Proposta
                </button>
            </div>
        </div>
    `;

    lista.prepend(propostaDiv);
    const btnAceitar = propostaDiv.querySelector('.btn-aceitar-proposta');
    btnAceitar.addEventListener('click', (event) => {
        const propostaId = event.target.dataset.propostaId;
        const nomeMotorista = event.target.dataset.motorista;
        aceitarProposta(propostaId, nomeMotorista, proposta);
    });
};

    //  Aceitar Proposta e Modal 
    const aceitarProposta = async (propostaId, nomeMotorista, proposta) => {
        try {
            // Atualiza status no Firebase
            await db.collection('descartes').doc(currentDescarteId).update({
                status: 'aceito',
                propostaAceita: propostaId,
                motoristaEscolhido: nomeMotorista
            });

            console.log(`Proposta ${propostaId} aceita!`);
            
            // Cria e mostra modal de confirmação
            criarModalConfirmacao(propostaId, nomeMotorista, proposta);
        } catch (error) {
            console.error('Erro ao aceitar proposta:', error);
            alert('Erro ao aceitar proposta. Tente novamente.');
        }
    };

    function criarModalConfirmacao(propostaId, nomeMotorista, proposta) {
        const modalExistente = document.getElementById('modal-confirmacao');
        if (modalExistente) {
            modalExistente.remove();
        }

        const modal = document.createElement('div');
        modal.id = 'modal-confirmacao';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Proposta Aceita!</h3>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fa-solid fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="confirmacao-info">
                        <div class="icone-sucesso">
                            <i class="fa-solid fa-check-circle"></i>
                        </div>
                        <p>Você aceitou a proposta de <strong>${nomeMotorista}</strong></p>
                        <p>Valor: <strong>R$ ${Number(proposta.preco || 0).toFixed(2)}</strong></p>
                        <p>O motorista foi notificado e está a caminho!</p>
                    </div>
                    <div class="modal-actions">
                        <button id="btn-iniciar-corrida" class="btn-iniciar">
                            Aguardar Motorista
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        setTimeout(() => {
            mostrarNotificacaoMotorista(nomeMotorista);
        }, 2000);

        const btnIniciar = modal.querySelector('#btn-iniciar-corrida');
        btnIniciar.addEventListener('click', () => {
            iniciarCorrida();
        });
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    function mostrarNotificacaoMotorista(nomeMotorista) {
        const modal = document.getElementById('modal-confirmacao');
        if (!modal) return;

        const modalBody = modal.querySelector('.modal-body');
        const notificacao = document.createElement('div');
        notificacao.className = 'notificacao-motorista';
        notificacao.innerHTML = `
            <div class="notificacao-content">
                <i class="fa-solid fa-truck"></i>
                <p><strong>${nomeMotorista}</strong> confirmou e está a caminho!</p>
            </div>
        `;

        modalBody.appendChild(notificacao);

        const btnIniciar = modal.querySelector('#btn-iniciar-corrida');
        btnIniciar.textContent = 'Iniciar Corrida';
        btnIniciar.classList.add('ativo');
    }

    function iniciarCorrida() {
        alert('Redirecionando para acompanhar o status da corrida...');
        const modal = document.getElementById('modal-confirmacao');
        if (modal) {
            modal.remove();
        }
        console.log('Motorista redirecionado para rotaM.html');
    }
    if (descarteForm) {
        descarteForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            const localRetirada = localRetiradaInput.value;
            const cep = cepInput.value;
            const numero = document.getElementById('numeroEntrega').value;
            const complemento = document.getElementById('complementoEntrega').value;
            const localEntrega = localEntregaInput.value;
            const tipoCaminhao = document.getElementById('tipoCaminhao').value;
            const descricao = document.getElementById('descricao').value;

            if (!localRetirada || !localEntrega || !tipoCaminhao || !descricao) {
                alert('Por favor, preencha todos os campos obrigatórios.');
                return;
            }

            const enderecoCompleto = `${localRetirada}${numero ? ', ' + numero : ''}${complemento ? ', ' + complemento : ''}`;

            const dadosDescarte = {
                localRetirada: enderecoCompleto,
                cep,
                localEntrega,
                tipoCaminhao,
                descricao,
                clienteId: 'cliente_teste', 
                origem: enderecoCompleto,
                destino: localEntrega,
                tipoVeiculo: tipoCaminhao
            };
            const btnSubmit = event.target.querySelector('.btn-enviarsolicitação');
            const textoOriginal = btnSubmit.textContent;
            btnSubmit.textContent = 'Enviando...';
            btnSubmit.disabled = true;

            try {
                await enviarParaFirebase(dadosDescarte);
                
                btnSubmit.textContent = 'Solicitação Enviada!';
                btnSubmit.classList.add('enviado');
                
                setTimeout(() => {
                    btnSubmit.textContent = textoOriginal;
                    btnSubmit.disabled = false;
                    btnSubmit.classList.remove('enviado');
                }, 3000);
            } catch (error) {
                btnSubmit.textContent = textoOriginal;
                btnSubmit.disabled = false;
            }
        });
    }

    setupEcopontosAutocomplete();
    setupEnderecoAutocomplete();
    setupCEPInput();
    adicionarEstilosCSS();
});

function adicionarEstilosCSS() {
    const style = document.createElement('style');
    style.textContent = `
        /* Autocomplete */
        .autocomplete-items {
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background: white;
            border: 1px solid #ddd;
            border-top: none;
            border-radius: 0 0 8px 8px;
            max-height: 200px;
            overflow-y: auto;
            z-index: 1000;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }

        .autocomplete-item {
            padding: 12px;
            cursor: pointer;
            border-bottom: 1px solid #eee;
            font-size: 14px;
        }

        .autocomplete-item:hover {
            background-color: #f5f5f5;
        }

        .autocomplete-item:last-child {
            border-bottom: none;
        }

        /* Container de propostas */
        .propostas-container {
            margin-top: 30px;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 12px;
            border: 2px solid #e9ecef;
        }

        .propostas-container h3 {
            color: #ff6b35;
            margin-bottom: 20px;
            font-size: 24px;
            text-align: center;
        }

        .lista-propostas {
            display: flex;
            flex-direction: column;
            gap: 15px;
        }

        /* Cards de proposta */
        .proposta-card {
            background: white;
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            border: 2px solid transparent;
            transition: all 0.3s ease;
        }

        .proposta-card.sustentavel {
            border-left: 5px solid #ff6b35;
        }

        .proposta-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(0,0,0,0.15);
        }

        .proposta-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }

        .motorista-info {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .motorista-avatar {
            width: 50px;
            height: 50px;
            background: #ff6b35;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 20px;
        }

        .motorista-dados h4 {
            margin: 0;
            font-size: 18px;
            color: #333;
        }

        .avaliacao {
            display: flex;
            align-items: center;
            gap: 5px;
            color: #ffc107;
            font-size: 14px;
        }

        .icone-sustentavel {
            background: #ff6b35;
            color: white;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
        }

        .proposta-body {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            gap: 20px;
        }

        .proposta-info p {
            margin: 5px 0;
            color: #666;
            font-size: 14px;
        }

        .proposta-info strong {
            color: #333;
        }

        .proposta-preco {
            text-align: right;
        }

        .valor {
            display: block;
            font-size: 24px;
            font-weight: bold;
            color: #ff6b35;
            margin-bottom: 10px;
        }

        .btn-aceitar-proposta {
            background: #ff6b35;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 8px;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.3s ease;
            font-size: 14px;
        }

        .btn-aceitar-proposta:hover {
            background: #e55a2b;
            transform: translateY(-1px);
        }

        /* Modal */
        .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        }

        .modal-content {
            background: white;
            border-radius: 16px;
            width: 90%;
            max-width: 500px;
            max-height: 90vh;
            overflow-y: auto;
        }

        .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px;
            border-bottom: 1px solid #eee;
        }

        .modal-header h3 {
            margin: 0;
            color: #ff6b35;
        }

        .modal-close {
            background: none;
            border: none;
            font-size: 20px;
            cursor: pointer;
            color: #999;
        }

        .modal-body {
            padding: 20px;
        }

        .confirmacao-info {
            text-align: center;
            margin-bottom: 20px;
        }

        .icone-sucesso {
            font-size: 48px;
            color: #28a745;
            margin-bottom: 15px;
        }

        .confirmacao-info p {
            margin: 10px 0;
            color: #666;
        }

        .modal-actions {
            text-align: center;
        }

        .btn-iniciar {
            background: #6c757d;
            color: white;
            border: none;
            padding: 15px 30px;
            border-radius: 8px;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.3s ease;
            font-size: 16px;
        }

        .btn-iniciar.ativo {
            background: #ff6b35;
        }

        .btn-iniciar:hover {
            transform: translateY(-1px);
        }

        .notificacao-motorista {
            background: #d4edda;
            border: 1px solid #c3e6cb;
            border-radius: 8px;
            padding: 15px;
            margin-top: 15px;
        }

        .notificacao-content {
            display: flex;
            align-items: center;
            gap: 10px;
            color: #155724;
        }

        .notificacao-content i {
            font-size: 20px;
        }

        /* Estados do botão de envio */
        .btn-enviarsolicitação.enviado {
            background: #28a745 !important;
        }

        /* Responsividade */
        @media (max-width: 768px) {
            .proposta-body {
                flex-direction: column;
                align-items: stretch;
                gap: 15px;
            }

            .proposta-preco {
                text-align: center;
            }

            .modal-content {
                width: 95%;
                margin: 20px;
            }
        }
    `;
    document.head.appendChild(style);
}

