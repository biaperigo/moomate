// Inicia o mapa centralizado na região aproximada dos ecopontos (São Paulo)
const map = L.map('map').setView([-23.53, -46.56], 12);

// Adiciona camada do mapa OpenStreetMap
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
}).addTo(map);

// Ecopontos (padronize as propriedades dos objetos)
const ecopontos = [
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
        lat: -23.5690,    // latitude aproximada
        lng: -46.7370,    // longitude aproximada
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

    // Casa Verde / Limão / Cachoeirinha
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

    // Cidade Tiradentes
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
    
      // Freguesia do Ó / Brasilândia
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
    
      // Guaianases
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
    
      // Itaim Paulista
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
    
      // Jabaquara
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
    
      // Jaçanã/Tremembé
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
    
      // Lapa
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
    
      // Mooca
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
    
      // Perus
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
    
      // Pirituba/Jaraguá
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
    
      // Santana/Tucuruvi
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
    
      // São Mateus
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
    
      // São Miguel Paulista
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
    
      // Sé
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
        cep: "", // CEP não informado
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
    
      // Vila Mariana
      {
        nome: "Ecoponto Mirandópolis",
        endereco: "Av. Senador Casemiro da Rocha, nº 1220 – Mirandópolis",
        cep: "", // CEP não informado
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
    
      // Vila Prudente
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

// Função para criar o conteúdo do info quando o ponto é clicado
function criarConteudoInfo(ponto) {
    return `
        <h3>${ponto.nome}</h3>
        <p><strong>Endereço:</strong> ${ponto.endereco}</p>
        <p><strong>CEP:</strong> ${ponto.cep}</p>
        ${ponto.recebeGesso ? '<p><em>Este ecoponto recebe gesso</em></p>' : ''}
        ${ponto.horario ? `<p><strong>Horário:</strong> ${ponto.horario}</p>` : ''}
    `;
}

// Array para armazenar todos os marcadores e ajustar o zoom depois
const markers = [];

// Adiciona marcadores no mapa para cada ecoponto
ecopontos.forEach(ponto => {
    const marker = L.marker([ponto.lat, ponto.lng]).addTo(map);
    marker.bindPopup(`<b>${ponto.nome}</b>`);
    markers.push(marker);

    marker.on('click', () => {
        document.getElementById('info').innerHTML = criarConteudoInfo(ponto);
    });
});

// Ajusta o zoom do mapa para mostrar todos os marcadores
const group = L.featureGroup(markers);
map.fitBounds(group.getBounds()); 
document.addEventListener('DOMContentLoaded', () => {
  // Menu mobile
  const menuToggle = document.getElementById('menuToggle');
  const navMenu = document.getElementById('navMenu');
  menuToggle.addEventListener('click', () => {
    navMenu.classList.toggle('show');
  });

  // Idioma toggle
  const idiomaToggle = document.querySelector('.idioma-toggle');
  const idiomaOpcoes = document.querySelector('.idioma-opcoes');
  const idiomaAtual = document.getElementById('idioma-atual');

  if (idiomaToggle && idiomaOpcoes) {
    idiomaToggle.addEventListener('click', () => {
      const isVisible = idiomaOpcoes.style.display === 'flex';
      idiomaOpcoes.style.display = isVisible ? 'none' : 'flex';
    });

    document.querySelectorAll('input[name="idioma"]').forEach(radio => {
      radio.addEventListener('change', () => {
        idiomaAtual.textContent = radio.parentElement.textContent.trim();
        idiomaOpcoes.style.display = 'none';
      });
    });
  }
});
