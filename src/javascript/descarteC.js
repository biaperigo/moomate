document.addEventListener('DOMContentLoaded', () => {
    class GeocodificadorDescartes {
        constructor() {
            this.cache = new Map();
            this.ultimaRequisicao = 0;
            this.DELAY_MINIMO = 1000;
        }

        async aguardarRateLimit() {
            const agora = Date.now();
            const tempoDecorrido = agora - this.ultimaRequisicao;
            if (tempoDecorrido < this.DELAY_MINIMO) {
                await new Promise(resolve => setTimeout(resolve, this.DELAY_MINIMO - tempoDecorrido));
            }
            this.ultimaRequisicao = Date.now();
        }

        validarCoordenadas(lat, lng) {
            const latNum = parseFloat(lat);
            const lngNum = parseFloat(lng);
            return !isNaN(latNum) && !isNaN(lngNum) &&
                   latNum >= -25.30 && latNum <= -19.80 &&
                   lngNum >= -53.10 && lngNum <= -44.20;
        }

        async geocodificar(endereco) {
            if (!endereco || typeof endereco !== 'string') {
                console.warn('[Geocodificador] Endereço inválido:', endereco);
                return null;
            }

            const enderecoNormalizado = endereco.trim().toLowerCase();
            
            if (this.cache.has(enderecoNormalizado)) {
                const cached = this.cache.get(enderecoNormalizado);
                console.log('[Geocodificador] Cache:', endereco);
                return cached;
            }

            try {
                await this.aguardarRateLimit();

                const searchQuery = endereco.includes('SP') || 
                                  endereco.includes('São Paulo') || 
                                  endereco.includes('SÃ£o Paulo') ? 
                    endereco : `${endereco}, São Paulo, SP, Brasil`;

                const url = `https://nominatim.openstreetmap.org/search?` +
                    `format=json&q=${encodeURIComponent(searchQuery)}` +
                    `&addressdetails=1&limit=5&countrycodes=br`;

                console.log('[Geocodificador] Buscando:', searchQuery);

                const response = await fetch(url, {
                    headers: {
                        'User-Agent': 'MoomateApp/1.0',
                        'Accept-Language': 'pt-BR,pt;q=0.9'
                    }
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const data = await response.json();

                if (data && data.length > 0) {
                    for (const item of data) {
                        const lat = parseFloat(item.lat);
                        const lng = parseFloat(item.lon);
                        
                        if (this.validarCoordenadas(lat, lng)) {
                            const coords = { lat, lng, endereco: item.display_name };
                            console.log('[Geocodificador] ✓ Encontrado:', coords);
                            this.cache.set(enderecoNormalizado, coords);
                            return coords;
                        }
                    }
                }

                console.warn('[Geocodificador] ✗ Nenhum resultado em SP:', endereco);
                this.cache.set(enderecoNormalizado, null);
                return null;

            } catch (error) {
                console.error('[Geocodificador] Erro:', error.message);
                this.cache.set(enderecoNormalizado, null);
                return null;
            }
        }
    }

    const geocodificador = new GeocodificadorDescartes();

    const firebaseConfig = {
        apiKey: "AIzaSyB9ZuAW1F9rBfOtg3hgGpA6H7JFUoiTlhE",
        authDomain: "moomate-39239.firebaseapp.com",
        projectId: "moomate-39239",
        storageBucket: "moomate-39239.appspot.com",
        messagingSenderId: "637968714747",
        appId: "1:637968714747:web:ad15dc3571c22f046b595e",
        measurementId: "G-62J7Q8CKP4"
    };

    try {
        if (!firebase.apps || firebase.apps.length === 0) {
            firebase.initializeApp(firebaseConfig);
        }
    } catch (e) {
        console.warn('Firebase já estava inicializado ou falhou ao iniciar:', e?.message || e);
    }
    
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

    const ecopontosSaoPaulo = [
         {
        nome: "Ecoponto Viaduto Engenheiro Alberto Badra",
        endereco: "Avenida Aricanduva, nº 200 - Praça Lúcia Mekhitarian – Bairro: Aricanduva (baixo do Viaduto Engenheiro Alberto Badra)",
        cep: "03501-010",
        recebeGesso: true,
        lat: -23.5478,
        lng: -46.5360,
    },
    {
        nome: "Ecoponto Astarte",
        endereco: "Rua Astarte, nº 500 – Bairro: Vila Carrão",
        cep: "03446-090",
        recebeGesso: true,
        lat: -23.5470,
        lng: -46.5230,
    },
    {
        nome: "Ecoponto Nova York",
        endereco: "Rua Amélia Vanso Magnoli, nº 480 – Bairro: Conjunto Habitacional Barreira Grande",
        cep: "03907-010",
        recebeGesso: false,
        lat: -23.5600,
        lng: -46.5440,
    },
    {
        nome: "Ecoponto Aricanduva",
        endereco: "Rua Professor Alzira de Oliveira Gilioli, nº 400 – Bairro: Jardim Nice",
        cep: "03905-090",
        recebeGesso: true,
        lat: -23.5530,
        lng: -46.5320,
    },
    {
        nome: "Nascer do Sol",
        endereco: "Rua Nascer do Sol, nº 356 – Bairro: Conjunto Habitacional Santa Etelvina II",
        cep: "08485-020",
        recebeGesso: false,
        lat: -23.6231,
        lng: -46.3942,
        horario: "Seg a Sáb: 6h às 22h, Dom e feriados: 6h às 18h"
    },
    {
        nome: "Ecoponto Jardim Maria do Carmo",
        endereco: "Rua Caminho do Engenho, nº 800 – Bairro: Ferreira",
        cep: "05524-000",
        recebeGesso: false,
        lat: -23.5690,    
        lng: -46.7370,   
    },
    {
        nome: "Ecoponto Jardim Jaqueline",
        endereco: "Parque Raposo Tavares - Rua Walter Brito Belletti, s/nº - Bairro: Vila Albano",
        cep: "05543-040",
        recebeGesso: true,
        lat: -23.5615,
        lng: -46.7560,
    },
    {
        nome: "Ecoponto Politécnica",
        endereco: "Rua Paulino Baptista Conti, nº 2 – Bairro: Jardim Sarah",
        cep: "05382-140",
        recebeGesso: false,
        lat: -23.5720,
        lng: -46.7500,
    },
    {
        nome: "Ecoponto Giovani Gronchi",
        endereco: "Avenida Giovani Gronchi, nº 3413 – Bairro: Morumbi",
        cep: "05651-002",
        recebeGesso: false,
        lat: -23.6090,
        lng: -46.7110,
    },
    {
        nome: "Ecoponto Santo Dias",
        endereco: "Travessa Rosifloras, nº 301 – Bairro: Conjunto Habitacional Instituto Adventista",
        cep: "05868-600",
        recebeGesso: false,
        lat: -23.6465,
        lng: -46.7510,
    },
    {
        nome: "Ecoponto Parque Fernanda",
        endereco: "Avenida Doutor Salvador Rocco, nº 261, defronte Rua Antônio Cânon – Bairro: Parque Fernanda",
        cep: "05888-050",
        recebeGesso: false,
        lat: -23.6680,
        lng: -46.7575,
    },
    {
        nome: "Ecoponto Olinda",
        endereco: "Rua Nelson Brissac, nº 1235, esquina com Avenida Padre Adolfo Kolping – Bairro: Parque Regina",
        cep: "05773-110",
        recebeGesso: false,
        lat: -23.6540,
        lng: -46.7270,
    },
    {
        nome: "Ecoponto Vila das Belezas",
        endereco: "Rua Campo Novo do Sul, nº 500 – Bairro: Vila Andrade",
        cep: "05729-100",
        recebeGesso: true,
        lat: -23.6545,
        lng: -46.7400,
    },
    {
        nome: "Ecoponto Paraisópolis",
        endereco: "Rua Irapará, nº 73 – Bairro: Paraíso do Morumbi",
        cep: "05706-300",
        recebeGesso: false,
        lat: -23.6535,
        lng: -46.7370,
    },
    {
        nome: "Ecoponto Cidade Saudável",
        endereco: "Rua Ptolomeu, nº 869 – Bairro: Vila Socorro",
        cep: "04762-040",
        recebeGesso: true,
        lat: -23.6825,
        lng: -46.7180,
    },
    {
        nome: "Ecoponto Parque Peruche",
        endereco: "Avenida Engenheiro Caetano Álvares, nº 3142 – Bairro: Parque Peruche",
        cep: "02535-008",
        recebeGesso: false,
        lat: -23.5175,
        lng: -46.6455,
    },
    {
        nome: "Ecoponto Vila Nova Cachoeirinha",
        endereco: "Rua Felix Alves Pereira, nº 113 – Bairro: Jardim Centenário",
        cep: "02882-030",
        recebeGesso: false,
        lat: -23.4920,
        lng: -46.6570,
    },
    {
        nome: "Ecoponto Vila Santa Maria",
        endereco: "Rua André Bolsena com a Travessa Luiz Sá – Bairro Vila Santista",
        cep: "02560-170",
        recebeGesso: false,
        lat: -23.5070,
        lng: -46.6475,
    },
    {
        nome: "Ecoponto Jardim Antártica",
        endereco: "Rua Dom Aquino, nº 103 – Bairro: Jardim Antártica",
        cep: "02652-170",
        recebeGesso: false,
        lat: -23.5210,
        lng: -46.6480,
    },
    {
        nome: "Ecoponto São Leandro",
        endereco: "Rua São Leandro, nº 13 – Bairro: Vila Palmeiras",
        cep: "02725-010",
        recebeGesso: false,
        lat: -23.5190,
        lng: -46.6385,
    },
    {
        nome: "Ecoponto Alvarenga",
        endereco: "Estrada do Alvarenga, nº 2475 – Bairro: Balneário Mar Paulista",
        cep: "04467-000",
        recebeGesso: false,
        lat: -23.6580,
        lng: -46.7265,
    },
    {
        nome: "Ecoponto Cupecê",
        endereco: "Rua Anália Maria de Jesus, nº 130 – Trav. Av. Cupecê – Bairro: Jardim Itacolomi",
        cep: "04385-110",
        recebeGesso: false,
        lat: -23.6465,
        lng: -46.7165,
    },
    {
        nome: "Ecoponto Nascer do Sol",
        endereco: "Rua Nascer do Sol, nº 356 – Bairro: Conjunto Habitacional Santa Etelvina II",
        cep: "08485-020",
        recebeGesso: false,
        lat: -23.6231,
        lng: -46.3942,
    },
    {
        nome: "Ecoponto Setor G",
        endereco: "Rua Alfonso Asturaro, altura do nº 600 – Bairro: Conjunto Habitacional Barro Branco II",
        cep: "08473-591",
        recebeGesso: false,
        lat: -23.6140,
        lng: -46.4010,
    },
    {
        nome: "Ecoponto Inácio Monteiro",
        endereco: "Rua Regresso Feliz, nº 1190 - Bairro: Conjunto Habitacional Inácio Monteiro",
        cep: "08472-210",
        recebeGesso: true,
        lat: -23.6155,
        lng: -46.3985,
    },
    {
        nome: "Ecoponto Jardim São Nicolau",
        endereco: "Rua Agreste de Itabaiana, nº 590, esquina com a Rua Eduardo Kyioshi Shimuta – Bairro: Vila União (Zona Leste)",
        cep: "03683-000",
        recebeGesso: false,
        lat: -23.5415,
        lng: -46.4350,
      },
      {
        nome: "Ecoponto Boturussu",
        endereco: "Rua Nélio Batista Guimarães, nº 183 – Bairro: Parque Boturussu",
        cep: "03802-005",
        recebeGesso: false,
        lat: -23.5540,
        lng: -46.4440,
      },
      {
        nome: "Ecoponto Bandeirantes",
        endereco: "Rua Itaiquara, nº 237 - Bairro: Itaberaba",
        cep: "02803-050",
        recebeGesso: false,
        lat: -23.4900,
        lng: -46.6900,
      },
      {
        nome: "Ecoponto Freguesia do Ó",
        endereco: "Rua Sousa Filho, nº 690 – Bairro: Vila União (Zona Norte)",
        cep: "02911-135",
        recebeGesso: false,
        lat: -23.4905,
        lng: -46.6950,
      },
      {
        nome: "Ecoponto Vila Rica",
        endereco: "Rua Jorge Mamede da Silva, nº 200 – Bairro: Vila Souza",
        cep: "02860-050",
        recebeGesso: false,
        lat: -23.4800,
        lng: -46.6850,
      },
      {
        nome: "Ecoponto Jardim São Paulo",
        endereco: "Rua Utaro Kanai, nº 374 – Bairro: Conjunto Habitacional Juscelino Kubitschek",
        cep: "08465-000",
        recebeGesso: false,
        lat: -23.6000,
        lng: -46.4000,
      },
      {
        nome: "Ecoponto Guaiaponto",
        endereco: "Rua da Passagem Funda, nº 250 – Bairro: Vila Santa Cruz (Zona Leste)",
        cep: "08411-010",
        recebeGesso: true,
        lat: -23.6100,
        lng: -46.3900,
      },
      {
        nome: "Ecoponto Lajeado",
        endereco: "Rua Isabela, nº 405 – Bairro: Jardim Lajeado",
        cep: "08411-010",
        recebeGesso: false,
        lat: -23.6150,
        lng: -46.3950,
      },
      {
        nome: "Ecoponto Padre Nildo do Amaral",
        endereco: "Rua Padre Nildo do Amaral Júnior, nº 900 – Bairro: Vila Nova Curuçá",
        cep: "08032-650",
        recebeGesso: false,
        lat: -23.6200,
        lng: -46.3850,
      },
      {
        nome: "Ecoponto Tereza Cristina",
        endereco: "Rua Tereza Cristina, nº 10, esquina com Avenida do Estado – Bairro: Vila Monumento",
        cep: "01553-000",
        recebeGesso: true,
        lat: -23.6000,
        lng: -46.6150,
      },
      {
        nome: "Ecoponto Santa Cruz",
        endereco: "Rua Santa Cruz, nº 1452 (Baixo do Viaduto Santa Cruz) – Bairro: Vila Mariana",
        cep: "04122-000",
        recebeGesso: false,
        lat: -23.5900,
        lng: -46.6100,
      },
      {
        nome: "Ecoponto Vila das Mercês",
        endereco: "Rua Italva, nº 86 – Bairro: Saúde",
        cep: "04294-030",
        recebeGesso: false,
        lat: -23.5905,
        lng: -46.6105,
      },
      {
        nome: "Ecoponto Comandante Taylor",
        endereco: "Rua Comandante Taylor, nº 690 (Baixo do Viaduto Comandante Taylor) – Bairro: Ipiranga",
        cep: "04218-000",
        recebeGesso: false,
        lat: -23.5950,
        lng: -46.6200,
      },
      {
        nome: "Ecoponto Moreira",
        endereco: "Rua João Batista de Godói, nº 1164 – Bairro: Jardim das Oliveiras",
        cep: "08111-430",
        recebeGesso: false,
        lat: -23.5200,
        lng: -46.3800,
      },
      {
        nome: "Ecoponto Mãe Preta",
        endereco: "Avenida Dama Entre Verdes, nº 21, - Bairro: Vila Curuçá",
        cep: "08030-610",
        recebeGesso: true,
        lat: -23.5150,
        lng: -46.3850,
      },
      {
        nome: "Ecoponto Pesqueiro",
        endereco: "Rua Caiuás, nº 18, esquina com a Avenida Itamerendiba – Bairro: Jardim Ida Guedes",
        cep: "08120-580",
        recebeGesso: true,
        lat: -23.5100,
        lng: -46.3900,
      },
      {
        nome: "Ecoponto Flamingo",
        endereco: "Rua Alexandre Dias Nogueira, nº353 – Bairro: Vila Nova Curuçá",
        cep: "08031-240",
        recebeGesso: false,
        lat: -23.5050,
        lng: -46.3950,
      },
      {
        nome: "Ecoponto Itaim Paulista",
        endereco: "Rua Barão de Almeida Galeão, altura do nº61 – Bairro: Itaim Paulista",
        cep: "08575-210",
        recebeGesso: false,
        lat: -23.5250,
        lng: -46.3750,
      },
      {
        nome: "Ecoponto Jardim Indaiá",
        endereco: "Rua Rossini Pinto, altura do nº 214 – Bairro: Jardim Indaiá",
        cep: "08143-030",
        recebeGesso: false,
        lat: -23.5300,
        lng: -46.3700,
      },
      {
        nome: "Ecoponto Parque Guarani",
        endereco: "Rua Manuel Alves da Rocha, nº 584 – Bairro: Parque Guarani",
        cep: "08235-620",
        recebeGesso: false,
        lat: -23.5440,
        lng: -46.4460,
      },
      {
        nome: "Ecoponto Oswaldo Valle Cordeiro",
        endereco: "Av. Osvaldo Valle Cordeiro, nº 405 – Bairro: Jardim Brasília (Zona Leste)",
        cep: "03584-000",
        recebeGesso: true,
        lat: -23.5550,
        lng: -46.4400,
      },
      {
        nome: "Ecoponto Cidade Lider",
        endereco: "Rua Charles Manguin, nº 20- Bairro: Jardim Marília",
        cep: "03579-150",
        recebeGesso: false,
        lat: -23.5500,
        lng: -46.4450,
      },
      {
        nome: "Ecoponto Parque do Carmo",
        endereco: "Rua Machado Nunes, nº 95 – Bairro: Jardim Nossa Senhora do Carmo",
        cep: "08275-310",
        recebeGesso: false,
        lat: -23.5600,
        lng: -46.4300,
      },
      {
        nome: "Ecoponto Corinthians",
        endereco: "Rua Ana Perena, nº 155 – Bairro: Conjunto Residencial José Bonifácio",
        cep: "08253-230",
        recebeGesso: true,
        lat: -23.5480,
        lng: -46.4450,
      },
      {
        nome: "Ecoponto Caldeirão",
        endereco: "Rua Major Vitorino de Souza Rocha, altura do nº148 – Bairro: Vila Santa Teresinha",
        cep: "08247-080",
        recebeGesso: false,
        lat: -23.5505,
        lng: -46.4350,
      },
      {
        nome: "Ecoponto Imigrantes",
        endereco: "Rua Opixe - Bairro: Vila Guarani (Zona Sul)",
        cep: "04312-080",
        recebeGesso: true,
        lat: -23.6150,
        lng: -46.6580,
      },
      {
        nome: "Ecoponto Jabaquara",
        endereco: "Rua Jupatis, nº140 – Bairro: Vila Mira",
        cep: "04377-200",
        recebeGesso: true,
        lat: -23.6155,
        lng: -46.6550,
      },
      {
        nome: "Ecoponto Anselmo Machado",
        endereco: "Avenida Paulo Lincoln do Valle Pontin, altura do nº 550 – Bairro: Jaçanã",
        cep: "02273-011",
        recebeGesso: false,
        lat: -23.4900,
        lng: -46.6150,
      },
      {
        nome: "Ecoponto Silvio Bittencourt",
        endereco: "Rua Maria Amália Lopes Azevedo, nº 4008 – Bairro: Vila Albertina",
        cep: "02350-003",
        recebeGesso: false,
        lat: -23.5000,
        lng: -46.6200,
      },
      {
        nome: "Ecoponto Viaduto Antártica",
        endereco: "Rua Robert Bosch (Baixos Viaduto Antártica) – Bairro: Parque Industrial Tomas Edson",
        cep: "01141-010",
        recebeGesso: false,
        lat: -23.5300,
        lng: -46.6800,
      },
      {
        nome: "Ecoponto Vila Jaguara",
        endereco: "Rua Agrestina, nº 189 – Bairro: Vila Jaguara",
        cep: "05117-100",
        recebeGesso: false,
        lat: -23.5200,
        lng: -46.7000,
      },
      {
        nome: "Ecoponto Piraporinha",
        endereco: "Rua João de Abreu, nº 326 – Bairro: Jardim Tupã",
        cep: "04904-000",
        recebeGesso: true,
        lat: -23.6785,
        lng: -46.7605,
      },
      {
        nome: "Ecoponto São Luis",
        endereco: "Rua Pedro Armani, nº 252 – Bairro: Jardim Letícia",
        cep: "05820-220",
        recebeGesso: false,
        lat: -23.6840,
        lng: -46.7345,
      },
      {
        nome: "Ecoponto Bresser",
        endereco: "Pça. Giuseppe Cesari, nº 54 – Bairro: Brás",
        cep: "03053-000",
        recebeGesso: true,
        lat: -23.5516,
        lng: -46.5987,
      },
      {
        nome: "Ecoponto Tatuapé",
        endereco: "Av. Salim Farah Maluf, nº 179 – Bairro: Tatuapé",
        cep: "03076-000",
        recebeGesso: true,
        lat: -23.5455,
        lng: -46.5735,
      },
      {
        nome: "Ecoponto Brás",
        endereco: "Av. Presidente Wilson, nº 1 – Bairro: Mooca",
        cep: "03107-000",
        recebeGesso: false,
        lat: -23.5510,
        lng: -46.5950,
      },
      {
        nome: "Ecoponto Mooca",
        endereco: "Av. Pires do Rio, nº 600 – Bairro: Belenzinho",
        cep: "03163-010",
        recebeGesso: false,
        lat: -23.5470,
        lng: -46.5738,
      },
      {
        nome: "Ecoponto Pari",
        endereco: "Av. Carlos de Campos, nº 996 – Bairro: Pari",
        cep: "03028-001",
        recebeGesso: false,
        lat: -23.5220,
        lng: -46.6102,
      },
      {
        nome: "Ecoponto Belém",
        endereco: "Rua Belarmino Matos, nº 26 – Bairro: Belenzinho",
        cep: "03062-030",
        recebeGesso: false,
        lat: -23.5421,
        lng: -46.5796,
      },
      {
        nome: "Ecoponto Vila Luisa",
        endereco: "Praça Dante Maron, nº 92 – Bairro: Guaiúna",
        cep: "03631-230",
        recebeGesso: true,
        lat: -23.5309,
        lng: -46.5291,
      },
      {
        nome: "Ecoponto Água Rasa",
        endereco: "Av. Salim Farah Maluf, nº 1500 – Bairro: Quarta Parada",
        cep: "03304-090",
        recebeGesso: true,
        lat: -23.5444,
        lng: -46.5667,
      },
      {
        nome: "Ecoponto Mendes Caldeira",
        endereco: "Rua Monsenhor Andrade, nº 865 – Bairro: Brás",
        cep: "03008-000",
        recebeGesso: false,
        lat: -23.5440,
        lng: -46.6125,
      },
      {
        nome: "Ecoponto Mooca II",
        endereco: "Rua Pantojo, nº 1147 – Bairro: Vila Regente Feijó",
        cep: "03343-000",
        recebeGesso: false,
        lat: -23.5600,
        lng: -46.5600,
      },
      {
        nome: "Ecoponto Condessa",
        endereco: "Av. Condessa Elizabeth de Robiano, altura do nº 930 – Bairro: Parque São Jorge",
        cep: "",
        recebeGesso: true,
        lat: -23.5390,
        lng: -46.5720,
      },
      {
        nome: "Ecoponto Penha I",
        endereco: "Rua Doutor. Heládio, nº 104 – Bairro: Vila Esperança",
        cep: "03650-020",
        recebeGesso: false,
        lat: -23.5305,
        lng: -46.5287,
      },
      {
        nome: "Ecoponto Tiquatira",
        endereco: "Rua Amorim Diniz, nº 415 – Bairro: Jardim Jaú (Zona Leste)",
        cep: "03730-040",
        recebeGesso: false,
        lat: -23.5255,
        lng: -46.5050,
      },
      {
        nome: "Ecoponto Gamelinha",
        endereco: "Rua Morfeu, nº 25 – Bairro: Jardim Santo Antônio",
        cep: "03554-000",
        recebeGesso: false,
        lat: -23.5410,
        lng: -46.4980,
      },
      {
        nome: "Ecoponto Vila Matilde",
        endereco: "Rua Mateus de Siqueira, nº 375 – Bairro: Jardim Triana",
        cep: "03554-000",
        recebeGesso: false,
        lat: -23.5442,
        lng: -46.5075,
      },
      {
        nome: "Ecoponto Cangaíba",
        endereco: "Rua Luciano Nogueira, altura do nº 241 – Bairro: Cangaíba",
        cep: "03721-080",
        recebeGesso: false,
        lat: -23.5175,
        lng: -46.5105,
      },
      {
        nome: "Ecoponto Franquinho",
        endereco: "Rua Praia de Mucuripe, nº 685 – Bairro: Jardim Artur Alvim",
        cep: "03687-100",
        recebeGesso: false,
        lat: -23.5377,
        lng: -46.4742,
      },
      {
        nome: "Ecoponto Dalila",
        endereco: "Rua Inacio da Costa, nº 740 – Bairro: Vila Dalila",
        cep: "03520-030",
        recebeGesso: false,
        lat: -23.5440,
        lng: -46.5200,
      },
      {
        nome: "Ecoponto COHAB Artur Alvim",
        endereco: "Avenida Padre Estanislau de Campos, nº 56 – Bairro: Conj. Habitacional Padre Manoel da Nóbrega",
        cep: "03590-060",
        recebeGesso: false,
        lat: -23.5425,
        lng: -46.4600,
      },
      {
        nome: "Ecoponto Vila Talarico",
        endereco: "Avenida Bernardino Brito Fonseca de Carvalho, nº 1050 – Bairro: Vila Talarico",
        cep: "03535-000",
        recebeGesso: false,
        lat: -23.5445,
        lng: -46.5088,
      },
      {
        nome: "Ecoponto Recanto dos Humildes",
        endereco: "Rua Sales Gomes, nº 415 – Bairro: Vila Perus",
        cep: "05211-200",
        recebeGesso: false,
        lat: -23.4040,
        lng: -46.7670,
      },
      {
        nome: "Ecoponto Jardim Santa Fé",
        endereco: "Rua Salvador Albano, nº 156 – Bairro: Jardim Santa Fé (Zona Oeste)",
        cep: "05271-090",
        recebeGesso: false,
        lat: -23.4180,
        lng: -46.7480,
      },
      {
        nome: "Ecoponto Pinheiros",
        endereco: "Praça do Cancioneiro, nº 15 – Bairro: Cidade Monções",
        cep: "04571-200",
        recebeGesso: true,
        lat: -23.6095,
        lng: -46.6960,
      },
      {
        nome: "Ecoponto Vila Madalena",
        endereco: "Rua Girassol, nº 15 – Bairro: Vila Madalena",
        cep: "05433-000",
        recebeGesso: false,
        lat: -23.5615,
        lng: -46.6900,
      },
      {
        nome: "Ecoponto Alto de Pinheiros",
        endereco: "Praça Arcipreste Anselmo de Oliveira – Bairro: Alto de Pinheiros",
        cep: "05463-080",
        recebeGesso: false,
        lat: -23.5640,
        lng: -46.7100,
      },
      {
        nome: "Ecoponto Cônego José Salomon",
        endereco: "Avenida Cônego José Salomon, nº 861 – Bairro: Vila Portugal",
        cep: "02918-170",
        recebeGesso: true,
        lat: -23.5030,
        lng: -46.7155,
      },
      {
        nome: "Ecoponto Vigário Godói",
        endereco: "Rua Vigário Godói, nº 480 – Bairro: Vila Zat",
        cep: "02976-080",
        recebeGesso: true,
        lat: -23.4880,
        lng: -46.7240,
      },
      {
        nome: "Ecoponto Voith",
        endereco: "Avenida Atílio Brugnoli, nº 489 – Bairro: Parque Nações Unidas",
        cep: "02996-010",
        recebeGesso: false,
        lat: -23.4725,
        lng: -46.7320,
      },
      {
        nome: "Ecoponto Alexios Jafet",
        endereco: "Rua Alexios Jafet, nº 233 – Bairro: Jardim Ipanema (Zona Oeste)",
        cep: "05187-010",
        recebeGesso: false,
        lat: -23.4940,
        lng: -46.7520,
      },
      {
        nome: "Ecoponto Tucuruvi",
        endereco: "Rua Eduardo Vicente Nasser, nº 519 – Bairro: Barro Branco (Zona Norte)",
        cep: "02344-050",
        recebeGesso: false,
        lat: -23.4715,
        lng: -46.6090,
      },
      {
        nome: "Ecoponto Santana",
        endereco: "Avenida Zaki Narchi, nº 375 – Bairro: Carandiru",
        cep: "02029-000",
        recebeGesso: false,
        lat: -23.5070,
        lng: -46.6245,
      },
      {
        nome: "Ecoponto Alceu Maynard de Araújo",
        endereco: "Av. Prof. Alceu Maynard de Araújo, nº 330 – Vila Cruzeiro",
        cep: "04728-110",
        recebeGesso: false,
        lat: -23.6338,
        lng: -46.7078,
      },
      {
        nome: "Ecoponto Vicente Rao",
        endereco: "Av. Vicente Rao, nº 308 – Jardim Petrópolis",
        cep: "04636-000",
        recebeGesso: true,
        lat: -23.6225,
        lng: -46.6787,
      },
      {
        nome: "Ecoponto Pedro Bueno",
        endereco: "Rua João de Lery, nº 503 – Parque Jabaquara",
        cep: "04356-030",
        recebeGesso: true,
        lat: -23.6585,
        lng: -46.6360,
      },
      {
        nome: "Ecoponto Vitor Manzini",
        endereco: "Praça Dom Francisco de Sousa, nº 635 – Santo Amaro",
        cep: "04745-050",
        recebeGesso: true,
        lat: -23.6492,
        lng: -46.7030,
      },
      {
        nome: "Ecoponto Cipoaba",
        endereco: "Rua Padre Luis de Siqueira, nº 947 – Jardim Rodolfo Pirani",
        cep: "08310-260",
        recebeGesso: false,
        lat: -23.5810,
        lng: -46.4620,
      },
      {
        nome: "Ecoponto Iguatemi",
        endereco: "Rua Francisco de Melo Palheta, nº 1548 – Parque Boa Esperança",
        cep: "08341-235",
        recebeGesso: false,
        lat: -23.5710,
        lng: -46.4165,
      },
      {
        nome: "Ecoponto Montalvania",
        endereco: "Rua Montalvania, nº 195 – Jardim São Cristóvão",
        cep: "03930-095",
        recebeGesso: true,
        lat: -23.5792,
        lng: -46.5005,
      },
      {
        nome: "Ecoponto Lima Bonfante",
        endereco: "Rua Capitão-mor Lázaro da Costa, nº 251 – Jardim São Francisco",
        cep: "08390-260",
        recebeGesso: false,
        lat: -23.5605,
        lng: -46.3990,
      },
      {
        nome: "Ecoponto Imperador",
        endereco: "Av. Ribeirão Jacu, nº 201 – Jardim das Camélias",
        cep: "08050-420",
        recebeGesso: false,
        lat: -23.4940,
        lng: -46.4460,
      },
      {
        nome: "Ecoponto Carlito Maia",
        endereco: "Rua Domingos Fernandes Nobre, nº 109 – Vila Itaim",
        cep: "08190-300",
        recebeGesso: false,
        lat: -23.4872,
        lng: -46.3985,
      },
      {
        nome: "Ecoponto Pedro Nunes",
        endereco: "Rua da Polka, nº 100 – Jardim Pedro José Nunes",
        cep: "08061-540",
        recebeGesso: false,
        lat: -23.4860,
        lng: -46.4280,
      },
      {
        nome: "Ecoponto Itaqueruna",
        endereco: "Rua Domitila d'Abril, nº 88 – Cidade Nova São Miguel",
        cep: "08042-550",
        recebeGesso: true,
        lat: -23.4975,
        lng: -46.4528,
      },
      {
        nome: "Ecoponto Varre Vila",
        endereco: "Rua Primeiro de Maio, defronte nº 106 – União de Vila Nova",
        cep: "08072-050",
        recebeGesso: false,
        lat: -23.4685,
        lng: -46.4055,
      },
      {
        nome: "Ecoponto Vitória Popular",
        endereco: "Rua El Rey, nº 508 – Jardim São Carlos",
        cep: "08062-520",
        recebeGesso: false,
        lat: -23.4828,
        lng: -46.4188,
      },
      {
        nome: "Ecoponto Jardim Helena",
        endereco: "Rua Cosme dos Santos, nº 110 – Jardim Helena",
        cep: "08090-753",
        recebeGesso: true,
        lat: -23.4610,
        lng: -46.4055,
      },
      {
        nome: "Ecoponto Jardim Romano",
        endereco: "Rua Duarte Martins Mourão, nº 400 – Jardim Santa Margarida",
        cep: "08191-250",
        recebeGesso: false,
        lat: -23.4680,
        lng: -46.3865,
      },
      {
        nome: "Ecoponto Jardim Lapena",
        endereco: "Rua Rafael Zimbard, nº 78 – Jardim Nair",
        cep: "08071-130",
        recebeGesso: true,
        lat: -23.4758,
        lng: -46.4192,
      },
      {
        nome: "Ecoponto Sapopemba",
        endereco: "Rua Francesco Usper, nº 550 – Conj. Habitacional Teotonio Vilela",
        cep: "03928-235",
        recebeGesso: false,
        lat: -23.5893,
        lng: -46.5022,
      },
      {
        nome: "Ecoponto Vila Cardoso Franco",
        endereco: "Rua dos Vorás, nº 25 – Conj. Residencial Sítio Oratório",
        cep: "03978-310",
        recebeGesso: false,
        lat: -23.5820,
        lng: -46.4885,
      },
      {
        nome: "Ecoponto Reynaldo José",
        endereco: "Rua Silvestro Silvestre, nº 400 – Jardim Ângela (Zona Leste)",
        cep: "03985-000",
        recebeGesso: false,
        lat: -23.5852,
        lng: -46.4845,
      },
      {
        nome: "Ecoponto Joaquim Catuna",
        endereco: "Rua Luca Conforti, nº 210 – Fazenda da Juta",
        cep: "03977-417",
        recebeGesso: false,
        lat: -23.5860,
        lng: -46.5005,
      },
      {
        nome: "Ecoponto Glicério",
        endereco: "Praça Ministro Francisco Sá Carneiro, nº 6 – Liberdade",
        cep: "01517-100",
        recebeGesso: true,
        lat: -23.5533,
        lng: -46.6305,
      },
      {
        nome: "Ecoponto Liberdade",
        endereco: "Rua Jaceguai, nº 67 – Bela Vista",
        cep: "01315-010",
        recebeGesso: false,
        lat: -23.5545,
        lng: -46.6395,
      },
      {
        nome: "Ecoponto Armênia",
        endereco: "Rua General Carmona, nº 156 – Luz",
        cep: "01102-030",
        recebeGesso: false,
        lat: -23.5288,
        lng: -46.6322,
      },
      {
        nome: "Ecoponto Barra Funda",
        endereco: "Rua Cônego Vicente Miguel Marino, nº 76 – Barra Funda",
        cep: "",
        recebeGesso: false,
        lat: -23.5265,
        lng: -46.6610,
      },
      {
        nome: "Ecoponto Cambuci",
        endereco: "Av. Dom Pedro I, nº 38 – Vila Monumento",
        cep: "01552-001",
        recebeGesso: true,
        lat: -23.5747,
        lng: -46.6220,
      },
      {
        nome: "Ecoponto General Flores",
        endereco: "Rua General Flores, nº 10 – Bom Retiro",
        cep: "01129-010",
        recebeGesso: false,
        lat: -23.5253,
        lng: -46.6345,
        foraDeOperacao: true,
      },
      {
        nome: "Ecoponto Bela Vista",
        endereco: "Rua Quatorze de Julho, nº 59 – Bela Vista",
        cep: "01324-040",
        recebeGesso: true,
        lat: -23.5592,
        lng: -46.6493,
      },
      {
        nome: "Ecoponto Vila Guilherme",
        endereco: "Rua José Bernardo Pinto, nº 1480 – Vila Guilherme",
        cep: "02055-001",
        recebeGesso: true,
        lat: -23.5135,
        lng: -46.6027,
      },
      {
        nome: "Ecoponto Vila Sabrina",
        endereco: "Avenida do Poeta, nº 931 – Jardim Julieta",
        cep: "02161-160",
        recebeGesso: false,
        lat: -23.4959,
        lng: -46.5779,
      },
      {
        nome: "Ecoponto Vila Maria",
        endereco: "Rua Curuçá, nº 1700 – Jardim Andaraí",
        cep: "02168-150",
        recebeGesso: false,
        lat: -23.4947,
        lng: -46.5895,
      },
      {
        nome: "Ecoponto Mirandópolis",
        endereco: "Av. Senador Casemiro da Rocha, nº 1220 – Mirandópolis",
        cep: "", 
        recebeGesso: true,
        lat: -23.6023,
        lng: -46.6365,
      },
      {
        nome: "Ecoponto Vila Mariana",
        endereco: "Rua Mauricio Francisco Klabin, nº 37 – Vila Mariana",
        cep: "04120-020",
        recebeGesso: true,
        lat: -23.5897,
        lng: -46.6338,
      },
      {
        nome: "Ecoponto Saioa",
        endereco: "Rua Mary Baida Salem, nº 01 – Vila Firmiano Pinto",
        cep: "04124-210",
        recebeGesso: false,
        lat: -23.6031,
        lng: -46.6236,
      },
      {
        nome: "Ecoponto Rubem Berta",
        endereco: "Av. Rubem Berta, nº 1100 – Indianópolis",
        cep: "04014-010",
        recebeGesso: false,
        lat: -23.6020,
        lng: -46.6508,
      },
      {
        nome: "Ecoponto Anhaia Mello",
        endereco: "Rua da Prece, nº 296 – Vila Prudente",
        cep: "03156-210",
        recebeGesso: true,
        lat: -23.5803,
        lng: -46.5772,
      },
      {
        nome: "Ecoponto São Lucas",
        endereco: "Rua Florêncio Sanches, nº 307 – Parque Residencial Oratório",
        cep: "03266-120",
        recebeGesso: true,
        lat: -23.5895,
        lng: -46.5532,
      },
      {
        nome: "Ecoponto Vila Industrial",
        endereco: "Rua Lisa Ansorge, nº 645 – Jardim Guairaca",
        cep: "03244-060",
        recebeGesso: true,
        lat: -23.5891,
        lng: -46.5644,
      }
    ];


    function isWithinSaoPaulo(lat, lng) {
        return lat >= SP_BOUNDS.south && lat <= SP_BOUNDS.north && 
               lng >= SP_BOUNDS.west && lng <= SP_BOUNDS.east;
    }
    
    function isCEPSaoPaulo(cep) {
        const cepLimpo = cep.replace(/\D/g, '');
        if (cepLimpo.length !== 8) return false;
        const prefixo = parseInt(cepLimpo.substring(0, 2), 10);
        // CEPs de São Paulo começam com 01, 02, 03, 04, 05, 06, 07, 08, 09, 11, 12, 13, 14, 15, 16, 17, 18, 19
        return (prefixo >= 1 && prefixo <= 9) || (prefixo >= 11 && prefixo <= 19);
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

                showAutocompleteList(campo, data.map(item => ({
                    display: item.display_name,
                    endereco: item.display_name,
                    cep: item.address?.postcode || null,
                    lat: parseFloat(item.lat),
                    lng: parseFloat(item.lon),
                    tipo: 'endereco'
                })));
            } catch (error) {
                console.error('Erro no autocomplete:', error);
            }
        }, 300);
    }

    function autocompleteEcopontos(campo) {
        clearTimeout(timeoutAutocomplete);
        timeoutAutocomplete = setTimeout(() => {
            const input = document.getElementById(campo);
            const val = input.value.trim().toLowerCase();
            
            if (val.length < 2) {
                closeAutocomplete(campo);
                return;
            }

            const resultados = ecopontosSaoPaulo.filter(ecoponto => 
                ecoponto.nome.toLowerCase().includes(val) ||
                ecoponto.endereco.toLowerCase().includes(val) ||
                val.includes('ecoponto')
            ).map(ecoponto => ({
                display: `${ecoponto.nome} - ${ecoponto.endereco}`,
                endereco: ecoponto.endereco,
                nome: ecoponto.nome,
                cep: ecoponto.cep,
                lat: ecoponto.lat,
                lng: ecoponto.lng,
                tipo: 'ecoponto'
            }));

            showAutocompleteList(campo, resultados);
        }, 200);
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
            
            if (item.tipo === 'ecoponto') {
                div.innerHTML = `
                    <div class="autocomplete-ecoponto">
                        <div class="ecoponto-icon">♻️</div>
                        <div class="ecoponto-info">
                            <div class="ecoponto-nome">${item.nome}</div>
                            <div class="ecoponto-endereco">${item.endereco}</div>
                        </div>
                    </div>
                `;
            } else {
                div.innerHTML = `
                    <div class="autocomplete-endereco">
                        <div class="endereco-icon">📍</div>
                        <div class="endereco-text">${item.display}</div>
                    </div>
                `;
            }
            
            div.addEventListener('click', () => {
                selectAutocompleteItem(campo, item);
                closeAutocomplete(campo);
            });
            container.appendChild(div);
        });

        container.style.display = 'block';
    }

    function selectAutocompleteItem(campo, item) {
        const input = document.getElementById(campo);

        if (item.tipo === 'ecoponto') {
            input.value = `${item.nome} - ${item.endereco}`;
            input.dataset.nome = item.nome || '';
            input.dataset.endereco = item.endereco || '';
            if (typeof item.lat === 'number' && typeof item.lng === 'number') {
                input.dataset.lat = String(item.lat);
                input.dataset.lng = String(item.lng);
            } else {
                delete input.dataset.lat;
                delete input.dataset.lng;
            }
        } else {
            input.value = item.endereco;

            if (campo === 'localRetirada' && item.cep) {
                document.getElementById('cep').value = formatarCEP(item.cep);
            }
        }
    }

    function closeAutocomplete(campo) {
        const container = document.getElementById(`autocomplete-list-${campo}`);
        if (container) {
            container.style.display = 'none';
        }
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

            // Removendo validação de UF para permitir CEPs de São Paulo
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
                buscarEnderecoPorCEP(cep);
            }
        });
    }

    function setupAutocompletes() {
        if (localRetiradaInput) {
            localRetiradaInput.addEventListener('input', () => {
                autocompleteEndereco('localRetirada');
            });
        }

        if (localEntregaInput) {
            localEntregaInput.addEventListener('input', () => {
                autocompleteEcopontos('localEntrega');
            });
        }

        document.addEventListener('click', (e) => {
            if (!e.target.closest('#localRetirada') && !e.target.closest('#autocomplete-list-localRetirada')) {
                closeAutocomplete('localRetirada');
            }
            if (!e.target.closest('#localEntrega') && !e.target.closest('#autocomplete-list-localEntrega')) {
                closeAutocomplete('localEntrega');
            }
        });
    }

    const waitAuthUser = () => new Promise((resolve) => {
        try {
            const u = firebase.auth()?.currentUser || null;
            if (u) return resolve(u);
            const off = firebase.auth().onAuthStateChanged((usr) => {
                try { off && off(); } catch {}
                resolve(usr || null);
            });
            setTimeout(() => { try { off && off(); } catch {}; resolve(firebase.auth()?.currentUser || null); }, 2500);
        } catch { resolve(null); }
    });

    // === FUNÇÃO PARA CALCULAR PRECO ESTIMADO ===
    function calcularPrecoEstimado(distKm, tipoVeiculo) {
      const km = Number(distKm) || 0;
      const t = (tipoVeiculo || '').toString().toLowerCase();
      if (t.includes('medio') || t === 'medio' || t === 'médio') return 6 * km + 450 + 200;
      if (t.includes('grande') || t === 'grande') return 7 * km + 750 + 300;
      return 3.5 * km + 180; // pequeno
    }

    // === FUNÇÃO PARA CALCULAR DISTÂNCIA ===
    async function calcularDistancia(origem, destino) {
      try {
        const R = 6371;
        const toRad = (deg) => deg * Math.PI / 180;

        const oLat = origem?.lat;
        const oLng = origem?.lng;
        const dLat = destino?.lat;
        const dLng = destino?.lng;

        if ([oLat, oLng, dLat, dLng].every(Number.isFinite)) {
          const dPhi = toRad(dLat - oLat);
          const dLam = toRad(dLng - oLng);
          const a = Math.sin(dPhi / 2) * Math.sin(dPhi / 2) +
                   Math.cos(toRad(oLat)) * Math.cos(toRad(dLat)) *
                   Math.sin(dLam / 2) * Math.sin(dLam / 2);
          return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        }

        return 10; // fallback se não conseguir calcular
      } catch {
        return 10;
      }
    }

    // === ENVIO DE EMAIL VIA EMAILJS ===
    async function enviarEmailDescarte(dados) {
      try {
        emailjs.init("OORggr-8TZT0BnPBW");

        const templateParams = {
          to_email: "suporte@moomate.com.br",
          cliente_nome: dados.cliente_nome,
          local_retirada: dados.local_retirada,
          cep_retirada: dados.cep_retirada,
          local_entrega: dados.local_entrega,
          tipo_caminhao: dados.tipo_caminhao,
          descricao_objetos: dados.descricao_objetos,
          preco_estimado: dados.preco_estimado
        };

        const response = await emailjs.send(
          "service_mdbmmef",
          "template_y7von0h",
          templateParams
        );

        console.log("Email enviado com sucesso:", response);
      } catch (error) {
        console.error("Erro ao enviar email:", error);
      }
    }

    const enviarParaFirebase = async (dadosDescarte) => {
        try {
            console.log('[Firebase] Enviando:', dadosDescarte);
            const user = await waitAuthUser();
            if (!user) {
                console.warn('[Firebase] Sem usuário autenticado');
                alert('Faça login para solicitar um descarte.');
                return null;
            }
            const clienteUid = user?.uid || null;
            let clienteNome = user?.displayName || null;
            if (clienteUid) {
                try {
                    const uSnap = await db.collection('usuarios').doc(clienteUid).get();
                    const u = uSnap.exists ? (uSnap.data()||{}) : {};
                    clienteNome = u.nome || u.dadosPessoais?.nome || clienteNome || null;
                } catch (e) { console.warn('[Firebase] Falha ao obter nome:', e?.message||e); }
            }

            const payload = {
                ...dadosDescarte,
                status: 'pendente',
                dataEnvio: firebase.firestore.FieldValue.serverTimestamp(),
                tipo: 'descarte',
                clienteId: clienteUid || 'idCliente_descarte',
                clienteNome: clienteNome || null,
            };

            const docRef = await db.collection('descartes').add(payload);

            currentDescarteId = docRef.id;
            console.log('[Firebase] ✓ Descarte salvo:', currentDescarteId);

            // Calcular distância e preço estimado
            const distKm = await calcularDistancia(dadosDescarte.origem, dadosDescarte.destino);
            const precoEstimado = calcularPrecoEstimado(distKm, dadosDescarte.tipoCaminhao);

            // Enviar email com os dados do descarte
            await enviarEmailDescarte({
              cliente_nome: clienteNome || 'Cliente',
              local_retirada: dadosDescarte.localRetirada,
              cep_retirada: dadosDescarte.cep,
              local_entrega: dadosDescarte.localEntrega,
              tipo_caminhao: dadosDescarte.tipoCaminhao,
              descricao_objetos: dadosDescarte.descricao,
              preco_estimado: `R$ ${precoEstimado.toFixed(2).replace('.', ',')}`
            });

            propostasContainer.style.display = 'block';
            propostasContainer.scrollIntoView({ behavior: 'smooth' });

            ouvirPropostas(currentDescarteId);

            return currentDescarteId;
        } catch (error) {
            console.error('[Firebase] Erro:', error?.message || error);
            alert('Erro ao enviar solicitação. ' + (error?.message || 'Tente novamente.'));
        }
    };
const ouvirPropostas = (descarteId) => {
    if (!db || !descarteId) return;

    const descarteRef = db.collection('descartes').doc(descarteId);

    descarteRef.get().then(doc => {
        if (!doc.exists) {
            console.error("Documento de descarte não encontrado!");
            return;
        }
        const descarteData = doc.data();

        const propostasRef = descarteRef.collection('propostas').orderBy('dataEnvio', 'asc');
        
        propostasRef.onSnapshot((snapshot) => {
            const lista = document.getElementById('lista-propostas');
            if (!lista) return;

            if (snapshot.empty) {
                lista.innerHTML = '<p>Aguardando propostas dos motoristas...</p>';
                return;
            }

            const aguardandoMsg = lista.querySelector('p');
            if (aguardandoMsg) aguardandoMsg.remove();

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

const exibirProposta = async (proposta, descarteData) => {
    const lista = document.getElementById('lista-propostas');
    if (!lista) return;

    const origem = descarteData.localRetirada || 'N/A';
    const destino = descarteData.localEntrega || 'N/A';

    let motoristaNome = proposta.nomeMotorista || 'Motorista';
    let motoristaFotoUrl = null;
    let motoristaAvaliacao = 0.0;

    if (proposta.motoristaUid) {
        try {
            const motoristaDoc = await db.collection('motoristas').doc(proposta.motoristaUid).get();
            if (motoristaDoc.exists) {
                const motoristaData = motoristaDoc.data();
                
                console.log('[PROPOSTA] Dados do motorista:', motoristaData);
                motoristaNome = motoristaData.dadosPessoais?.nome || motoristaData.nome || motoristaNome;
                motoristaFotoUrl = motoristaData.dadosPessoais?.fotoPerfilUrl || motoristaData.fotoPerfilUrl || null;
                
                if (typeof motoristaData.avaliacaoMedia === 'number') {
                    motoristaAvaliacao = motoristaData.avaliacaoMedia;
                } else if (typeof motoristaData.media === 'number') {
                    motoristaAvaliacao = motoristaData.media;
                } else if (motoristaData.ratingSum && motoristaData.ratingCount) {
                    motoristaAvaliacao = Number(motoristaData.ratingSum) / Number(motoristaData.ratingCount);
                }
                
                console.log(`[PROPOSTA] ${motoristaNome}: nota=${motoristaAvaliacao.toFixed(1)} (avaliacaoMedia=${motoristaData.avaliacaoMedia}, media=${motoristaData.media})`);
            }
        } catch (error) {
            console.error("[PROPOSTA] Erro ao buscar motorista:", error);
        }
    }

    const getIniciais = (nome) => {
        if (!nome) return '?';
        const partes = nome.trim().split(' ').filter(p => p);
        if (partes.length > 1) {
            return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
        }
        return (partes[0]?.[0] || '').toUpperCase();
    };

    const propostaDiv = document.createElement('div');
    propostaDiv.classList.add('proposta-card');
    propostaDiv.dataset.propostaId = proposta.id;
    propostaDiv.innerHTML = `
        <div class="proposta-header">
            <div class="motorista-info">
                <div class="motorista-avatar">
                    ${motoristaFotoUrl 
                        ? `<img src="${motoristaFotoUrl}" alt="Foto de ${motoristaNome}" class="motorista-foto">` 
                        : `<span class="motorista-iniciais">${getIniciais(motoristaNome)}</span>`
                    }
                </div>
                <div class="motorista-dados">
                    <h4>${motoristaNome}</h4>
                    <div class="avaliacao">
                        <i class="fa-solid fa-star"></i>
                        <span>${Number(motoristaAvaliacao).toFixed(1)}</span>
                    </div>
                </div>
            </div>
            <div class="icone-sustentavel">
                <i class="fa-solid fa-recycle"></i>
            </div>
        </div>
        <div class="proposta-body">
            <div class="proposta-info">
                <p><strong>Descarte #${(currentDescarteId || '').substring(0, 6)}</strong></p>
                <p><strong>De:</strong> ${origem}</p>
                <p><strong>Para:</strong> ${destino}</p>
                <p><strong>Tipo de veículo:</strong> ${proposta.veiculo || 'N/A'}</p>
                <p><strong>Ajudantes:</strong> ${proposta.ajudantes?.quantidade || 0} ${proposta.ajudantes?.quantidade === 1 ? 'ajudante' : 'ajudantes'}</p>
                <p><strong>Tempo de chegada:</strong> ${proposta.tempoChegada || 0} min</p>
            </div>
            <div class="proposta-preco">
                <span class="valor">R$ ${Number(proposta.preco || 0).toFixed(2)}</span>
                <button class="btn-aceitar-proposta" data-proposta-id="${proposta.id}" data-motorista="${motoristaNome}">
                    Aceitar Proposta
                </button>
            </div>
        </div>
    `;

    const cardExistente = lista.querySelector(`[data-proposta-id="${proposta.id}"]`);
    if(cardExistente) cardExistente.remove();

    lista.prepend(propostaDiv);
    const btnAceitar = propostaDiv.querySelector('.btn-aceitar-proposta');
    btnAceitar.addEventListener('click', (event) => {
        const propostaId = event.target.dataset.propostaId;
        const nomeMotorista = event.target.dataset.motorista;
        aceitarProposta(propostaId, nomeMotorista, proposta);
    });
};


    const aceitarProposta = async (propostaId, nomeMotorista, proposta) => {
        try {
            console.log('Aceitando proposta:', propostaId);
            
            await db.collection('descartes').doc(currentDescarteId).update({
                status: 'aceito',
                propostaAceita: {
                    propostaId: propostaId,
                    motoristaId: proposta.motoristaUid,
                    motoristaUid: proposta.motoristaUid,
                    ...proposta
                },
                motoristaEscolhido: nomeMotorista,
                aceitoEm: firebase.firestore.FieldValue.serverTimestamp(),
                clienteConfirmou: true
            });

            console.log(`✓ Proposta ${propostaId} aceita`);
            
            mostrarModalAguardandoMotorista(currentDescarteId, nomeMotorista, proposta);
            
        } catch (error) {
            console.error('Erro ao aceitar proposta:', error);
            alert('Erro ao aceitar proposta. Tente novamente.');
        }
    };

    function mostrarModalAguardandoMotorista(descarteId, nomeMotorista, proposta) {
        const modalExistente = document.getElementById('modal-aguardando-motorista');
        if (modalExistente) {
            modalExistente.remove();
        }

        const modal = document.createElement('div');
        modal.id = 'modal-aguardando-motorista';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content aguardando-style">
                <div class="modal-header">
                    <h3><i class="fa-solid fa-hourglass-half"></i> Aguardando Motorista</h3>
                </div>
                <div class="modal-body">
                    <div class="aguardando-info">
                        <div class="icone-sucesso">
                            <i class="fa-solid fa-check-circle"></i>
                        </div>
                        <p><strong>Proposta aceita com sucesso!</strong></p>
                        <p>Motorista: <strong>${nomeMotorista}</strong></p>
                        <p>Valor: <strong>R$ ${Number(proposta.preco || 0).toFixed(2)}</strong></p>
                        <p>Aguardando o motorista confirmar o início da corrida...</p>
                        <div class="loading-spinner">
                            <i class="fa-solid fa-spinner fa-spin"></i>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const stopListener = db.collection('corridas').doc(descarteId)
            .onSnapshot(doc => {
                if (doc.exists) {
                    const corridaData = doc.data();
                    if (corridaData.status === 'em_andamento') {
                        modal.remove();
                        localStorage.setItem('ultimaCorridaCliente', descarteId);
                        window.location.href = `statusC.html?corrida=${encodeURIComponent(descarteId)}&tipo=cliente`;
                        stopListener();
                    }
                }
            });

        const stopDescarteListener = db.collection('descartes').doc(descarteId)
            .onSnapshot(doc => {
                if (doc.exists) {
                    const descarteData = doc.data();
                    if (descarteData.status === 'pendente' || descarteData.motoristaRecusou) {
                        modal.remove();
                        alert('O motorista recusou a corrida. Escolha outra proposta.');
                        stopDescarteListener();
                        stopListener();
                    }
                }
            });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                if (confirm('Deseja cancelar a espera pelo motorista?')) {
                    modal.remove();
                    stopListener();
                    stopDescarteListener();
                }
            }
        });
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

            const formEl = event.target;
            const btnSubmit = event.submitter || formEl.querySelector('[type="submit"]');
            const textoOriginal = btnSubmit?.textContent || '';
            if (btnSubmit) {
                btnSubmit.textContent = 'Enviando...';
                btnSubmit.disabled = true;
            }

            try {
                console.log('[Submit] Geocodificando origem...');
                let coordsOrigem = null;
                let origemEnderecoUsado = enderecoCompleto;
        
                try {
                    const oriLat = parseFloat(localRetiradaInput?.dataset?.lat || '');
                    const oriLng = parseFloat(localRetiradaInput?.dataset?.lng || '');
                    if (!isNaN(oriLat) && !isNaN(oriLng) && geocodificador.validarCoordenadas(oriLat, oriLng)) {
                        coordsOrigem = { lat: oriLat, lng: oriLng };
                        origemEnderecoUsado = localRetirada;
                        console.log('[Submit] Origem do autocomplete dataset:', coordsOrigem);
                    }
                } catch {}
                try {
                    const cepNumPre = (cep || '').replace(/\D/g, '');
                    if (cepNumPre.length === 8 && numero) {
                        const resPre = await fetch(`https://viacep.com.br/ws/${cepNumPre}/json/`);
                        const dataPre = await resPre.json();
                        if (!dataPre.erro && dataPre.uf === 'SP' && dataPre.logradouro && dataPre.localidade) {
                            let logPre = String(dataPre.logradouro || '').trim()
                                .replace(/^ruc\b/i, 'Rua')
                                .replace(/^r\.?\s+/i, 'Rua ')
                                .replace(/^av\.?\s+/i, 'Avenida ')
                                .replace(/^trav\.?\s+/i, 'Travessa ');
                            const cidadePre = String(dataPre.localidade || 'São Paulo');
                            const bairroPre = String(dataPre.bairro || '').trim();
                            const candPre = `${logPre}, ${String(numero).trim()} - ${bairroPre}, ${cidadePre} - SP, Brasil`;
                            const tentativaPre = await geocodificador.geocodificar(candPre);
                            if (tentativaPre && geocodificador.validarCoordenadas(tentativaPre.lat, tentativaPre.lng)) {
                                coordsOrigem = tentativaPre;
                                origemEnderecoUsado = candPre;
                                console.log('[Submit] ✓ Origem geocodificada (canônico):', origemEnderecoUsado);
                            }
                        }
                    }
                } catch {}
                if (!coordsOrigem) {
                    coordsOrigem = await geocodificador.geocodificar(enderecoCompleto);
                    origemEnderecoUsado = enderecoCompleto;
                }
                const origemObj = {
                    endereco: origemEnderecoUsado,
                    lat: coordsOrigem?.lat || null,
                    lng: coordsOrigem?.lng || null
                };
                if (!coordsOrigem) {
                    console.warn('[Submit] ⚠️ Não foi possível geocodificar a origem. Tentando fallback via CEP...');
                    let retryOk = false;
                    try {
                        const cepNum = (cep || '').replace(/\D/g, '');
                        if (cepNum.length === 8) {
                            const res = await fetch(`https://viacep.com.br/ws/${cepNum}/json/`);
                            const data = await res.json();
                            if (!data.erro && data.uf === 'SP' && data.logradouro && data.localidade) {
                            
                                let log = String(data.logradouro || '').trim();
                                log = log.replace(/^ruc\b/i, 'Rua');
                                log = log.replace(/^r\.?\s+/i, 'Rua ');
                                log = log.replace(/^av\.?\s+/i, 'Avenida ');
                                log = log.replace(/^trav\.?\s+/i, 'Travessa ');
                                const cidade = String(data.localidade || 'São Paulo');
                                const bairro = String(data.bairro || '').trim();
                                const numeroFmt = numero ? String(numero).trim() : '';
                                const candidatos = [];
                                if (numeroFmt) {
                                    candidatos.push(
                                        `${log}, ${numeroFmt} - ${bairro}, ${cidade} - SP, Brasil`,
                                        `${log} ${numeroFmt}, ${bairro}, ${cidade} - SP, Brasil`,
                                        `${log}, ${numeroFmt}, ${cidade} - SP, Brasil`,
                                        `${log} ${numeroFmt} - ${cidade} - SP, Brasil`
                                    );
                                }
                                candidatos.push(
                                    `${log} - ${bairro}, ${cidade} - SP, Brasil`,
                                    `${log}, ${cidade} - SP, Brasil`
                                );
                                for (const cand of candidatos) {
                                    const tentativa = await geocodificador.geocodificar(cand);
                                    if (tentativa && geocodificador.validarCoordenadas(tentativa.lat, tentativa.lng)) {
                                        origemObj.endereco = cand;
                                        origemObj.lat = tentativa.lat;
                                        origemObj.lng = tentativa.lng;
                                        retryOk = true;
                                        console.log('[Submit] ✓ Origem geocodificada no fallback:', origemObj);
                                        break;
                                    }
                                }
                            }
                        }
                    } catch (e) {
                        console.warn('[Submit] Fallback via CEP falhou:', e?.message || e);
                    }

                    if (!retryOk) {
                        alert('Não foi possível localizar o endereço de retirada. Verifique o endereço (inclua CEP e número) e tente novamente.');
                        if (btnSubmit) {
                            btnSubmit.textContent = textoOriginal;
                            btnSubmit.disabled = false;
                            btnSubmit.classList.remove('enviado');
                        }
                        return;
                    }
                }

                console.log('[Submit] Origem:', origemObj);

                let destinoObj = { endereco: localEntrega, lat: null, lng: null };
                
                const destLat = parseFloat(localEntregaInput?.dataset?.lat || '');
                const destLng = parseFloat(localEntregaInput?.dataset?.lng || '');
                
                if (!isNaN(destLat) && !isNaN(destLng) && geocodificador.validarCoordenadas(destLat, destLng)) {
                    destinoObj = { endereco: localEntrega, lat: destLat, lng: destLng };
                    console.log('[Submit] Destino (autocomplete):', destinoObj);
                } else {
                    console.log('[Submit] Geocodificando destino...');
                    const coordsDestino = await geocodificador.geocodificar(localEntrega);
                    destinoObj = {
                        endereco: localEntrega,
                        lat: coordsDestino?.lat || null,
                        lng: coordsDestino?.lng || null
                    };
                    if (!coordsDestino) {
                        console.warn('[Submit] ⚠️ Não foi possível geocodificar destino, mas continuando...');
                    }
                    console.log('[Submit] Destino:', destinoObj);
                }
                let uid = null;
                try {
                    if (typeof firebase.auth === 'function') {
                        uid = firebase.auth().currentUser?.uid || null;
                    }
                } catch (e) {
                    console.warn('Erro ao obter UID:', e?.message);
                }
                if (!uid) {
                    uid = localStorage.getItem('clienteUid') || localStorage.getItem('uid') || null;
                }

                const dadosDescarte = {
                    localRetirada: enderecoCompleto,
                    cep,
                    localEntrega,
                    tipoCaminhao,
                    descricao,
                    clienteId: uid,
                    origem: origemObj,
                    destino: destinoObj,
                    tipoVeiculo: tipoCaminhao,
                    tipo: 'descarte',
                    precisaGeocodificar: (!origemObj.lat || !destinoObj.lat)
                };

                console.log('[Submit] Dados finais:', dadosDescarte);

                await enviarParaFirebase(dadosDescarte);
                
                if (btnSubmit) {
                    btnSubmit.textContent = 'Solicitação Enviada!';
                    btnSubmit.classList.add('enviado');
                }
                if (currentDescarteId) {
                    setTimeout(async () => {
                        console.log('[Background] Iniciando geocodificação em background...');
                        const atualizacoes = {};
                        let precisaAtualizar = false;

                        if (!dadosDescarte.origem.lat || !dadosDescarte.origem.lng) {
                            console.log('[Background] Tentando geocodificar origem (tentativa 2)...');
                            const coords = await geocodificador.geocodificar(dadosDescarte.origem.endereco);
                            if (coords && geocodificador.validarCoordenadas(coords.lat, coords.lng)) {
                                atualizacoes.origem = {
                                    ...dadosDescarte.origem,
                                    lat: coords.lat,
                                    lng: coords.lng
                                };
                                precisaAtualizar = true;
                                console.log('[Background] ✓ Origem geocodificada:', atualizacoes.origem);
                            }
                        }

             
                        if (!dadosDescarte.destino.lat || !dadosDescarte.destino.lng) {
                            console.log('[Background] Tentando geocodificar destino (tentativa 2)...');
                            const coords = await geocodificador.geocodificar(dadosDescarte.destino.endereco);
                            if (coords && geocodificador.validarCoordenadas(coords.lat, coords.lng)) {
                                atualizacoes.destino = {
                                    ...dadosDescarte.destino,
                                    lat: coords.lat,
                                    lng: coords.lng
                                };
                                precisaAtualizar = true;
                            }
                        }

                        if (precisaAtualizar) {
                            atualizacoes.precisaGeocodificar = false;
                            console.log('[Background] Atualizando Firebase com coordenadas:', atualizacoes);
                            await db.collection('descartes').doc(currentDescarteId).update(atualizacoes);
                        } else {
                            console.log('[Background] Nenhuma atualização necessária ou possível');
                        }
                    }, 3000); 
                }
                
                setTimeout(() => {
                    if (btnSubmit) {
                        btnSubmit.textContent = textoOriginal;
                        btnSubmit.disabled = false;
                        btnSubmit.classList.remove('enviado');
                    }
                }, 3000);
            } catch (error) {
                console.error('[Submit] Erro:', error);
                if (btnSubmit) {
                    btnSubmit.textContent = textoOriginal;
                    btnSubmit.disabled = false;
                }
                alert('Erro ao enviar solicitação: ' + (error?.message || 'Tente novamente.'));
            }
        });
    }

    setupAutocompletes();
    setupCEPInput();
    adicionarEstilosCSS();
});

function adicionarEstilosCSS() {
    const style = document.createElement('style');
    style.textContent = `
        .autocomplete-items {
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background: white;
            border: 1px solid #ddd;
            border-top: none;
            border-radius: 0 0 8px 8px;
            max-height: 300px;
            overflow-y: auto;
            z-index: 1000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }

        .autocomplete-item {
            padding: 0;
            cursor: pointer;
            border-bottom: 1px solid #eee;
            transition: background-color 0.2s ease;
        }

        .autocomplete-item:hover {
            background-color: #f8f9fa;
        }

        .autocomplete-item:last-child {
            border-bottom: none;
        }

        .autocomplete-ecoponto {
            display: flex;
            align-items: center;
            padding: 12px;
            gap: 12px;
        }
.motorista-avatar {
    width: 55px;
    height: 55px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden; /* Essencial para cortar a imagem */
    flex-shrink: 0;
    
    /* Remove o fundo laranja e adiciona a borda */
    background: #eee; /* Um fundo neutro caso a imagem falhe */
    border: 3px solid #ff6b35; /* A borda laranja! */
    box-shadow: 0 3px 10px rgba(0, 0, 0, 0.1);
}

.motorista-foto {
    width: 100%;
    height: 100%;
    object-fit: cover; /* Garante que a imagem cubra o espaço sem distorcer */
}

.motorista-iniciais {
    font-weight: 700;
    font-size: 20px;
    color: #555; /* Cor para as iniciais caso não haja foto */
}
        .ecoponto-icon {
            font-size: 24px;
            flex-shrink: 0;
        }

        .ecoponto-info {
            flex: 1;
        }

        .ecoponto-nome {
            font-weight: bold;
            color: #ff6b35;
            font-size: 14px;
            margin-bottom: 4px;
        }

        .ecoponto-endereco {
            font-size: 12px;
            color: #666;
            line-height: 1.3;
        }

        .autocomplete-endereco {
            display: flex;
            align-items: center;
            padding: 12px;
            gap: 8px;
        }

        .endereco-icon {
            font-size: 16px;
            color: #666;
            flex-shrink: 0;
        }

        .endereco-text {
            font-size: 14px;
            color: #333;
            line-height: 1.4;
        }

        .autocomplete-item:hover .ecoponto-nome {
            color: #e55a2b;
        }

        .autocomplete-item:hover .endereco-icon {
            color: #ff6b35;
        }

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

        .modal-body {
            padding: 20px;
        }

        .aguardando-info {
            text-align: center;
            margin-bottom: 20px;
        }

        .icone-sucesso {
            font-size: 48px;
            color: #28a745;
            margin-bottom: 15px;
        }

        .aguardando-info p {
            margin: 10px 0;
            color: #666;
        }

        .loading-spinner {
            margin-top: 20px;
            font-size: 32px;
            color: #ff6b35;
        }

        .btn-enviarsolicitação.enviado {
            background: #28a745 !important;
        }

        .autocomplete-items::-webkit-scrollbar {
            width: 6px;
        }

        .autocomplete-items::-webkit-scrollbar-track {
            background: #f1f1f1;
            border-radius: 3px;
        }

        .autocomplete-items::-webkit-scrollbar-thumb {
            background: #ccc;
            border-radius: 3px;
        }

        .autocomplete-items::-webkit-scrollbar-thumb:hover {
            background: #999;
        }

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

            .autocomplete-ecoponto, .autocomplete-endereco {
                padding: 10px;
            }

            .ecoponto-nome {
                font-size: 13px;
            }

            .ecoponto-endereco {
                font-size: 11px;
            }
        }

        .form-group {
            position: relative;
        }

        .autocomplete-items {
            animation: slideDown 0.2s ease-out;
        }

        @keyframes slideDown {
            from {
                opacity: 0;
                transform: translateY(-10px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        .autocomplete-loading {
            padding: 15px;
            text-align: center;
            color: #666;
            font-style: italic;
        }

        .autocomplete-item.active {
            background-color: #e3f2fd;
        }
    `;
    document.head.appendChild(style);
}
