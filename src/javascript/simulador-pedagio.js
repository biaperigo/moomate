// Pontos de pedágio em SP com coordenadas aproximadas
// PREÇOS POR TIPO DE VEÍCULO (pequeno/medio/grande correspondem a van/caminhão médio/caminhão grande)
const PEDAGIOS_SP = [
  // BR-116 (Imigrantes/Anchieta)
  {
    nome: "Imigrantes (Km 45)",
    lat: -23.7914,
    lng: -46.6272,
    rodovia: "BR-116 (Imigrantes)",
    preco: { pequeno: 9.20, medio: 11.00, grande: 15.30 }
  },
  {
    nome: "Anchieta (Km 70)",
    lat: -23.8544,
    lng: -46.5439,
    rodovia: "BR-116 (Anchieta)",
    preco: { pequeno: 9.20, medio: 11.00, grande: 15.30 }
  },
  {
    nome: "Anchieta (Km 88)",
    lat: -23.9156,
    lng: -46.4989,
    rodovia: "BR-116 (Anchieta)",
    preco: { pequeno: 9.20, medio: 11.00, grande: 15.30 }
  },

  // BR-116 (Dutra)
  {
    nome: "Dutra (Km 20)",
    lat: -23.2022,
    lng: -46.8911,
    rodovia: "BR-116 (Dutra)",
    preco: { pequeno: 11.00, medio: 13.20, grande: 18.50 }
  },
  {
    nome: "Dutra (Km 50)",
    lat: -22.7533,
    lng: -46.4739,
    rodovia: "BR-116 (Dutra)",
    preco: { pequeno: 11.00, medio: 13.20, grande: 18.50 }
  },
  {
    nome: "Dutra (Km 80)",
    lat: -22.3244,
    lng: -46.2156,
    rodovia: "BR-116 (Dutra)",
    preco: { pequeno: 11.00, medio: 13.20, grande: 18.50 }
  },
  {
    nome: "Dutra (Km 110)",
    lat: -21.9089,
    lng: -45.9478,
    rodovia: "BR-116 (Dutra)",
    preco: { pequeno: 11.00, medio: 13.20, grande: 18.50 }
  },

  // SP-280 (Castelo Branco)
  {
    nome: "Castelo Branco (Km 35)",
    lat: -23.4614,
    lng: -46.8667,
    rodovia: "SP-280 (Castelo Branco)",
    preco: { pequeno: 9.80, medio: 11.70, grande: 16.40 }
  },
  {
    nome: "Castelo Branco (Km 75)",
    lat: -23.3089,
    lng: -47.2856,
    rodovia: "SP-280 (Castelo Branco)",
    preco: { pequeno: 9.80, medio: 11.70, grande: 16.40 }
  },
  {
    nome: "Castelo Branco (Km 120)",
    lat: -23.1856,
    lng: -47.6944,
    rodovia: "SP-280 (Castelo Branco)",
    preco: { pequeno: 9.80, medio: 11.70, grande: 16.40 }
  },

  // SP-348 (Bandeirantes)
  {
    nome: "Bandeirantes (Km 30)",
    lat: -23.3978,
    lng: -46.7392,
    rodovia: "SP-348 (Bandeirantes)",
    preco: { pequeno: 8.90, medio: 10.70, grande: 14.90 }
  },
  {
    nome: "Bandeirantes (Km 70)",
    lat: -23.2167,
    lng: -47.0889,
    rodovia: "SP-348 (Bandeirantes)",
    preco: { pequeno: 8.90, medio: 10.70, grande: 14.90 }
  },
  {
    nome: "Bandeirantes (Km 110)",
    lat: -23.0356,
    lng: -47.3978,
    rodovia: "SP-348 (Bandeirantes)",
    preco: { pequeno: 8.90, medio: 10.70, grande: 14.90 }
  },

  // SP-127 (Papa Bueno)
  {
    nome: "Papa Bueno (Km 30)",
    lat: -23.2833,
    lng: -47.0667,
    rodovia: "SP-127 (Papa Bueno)",
    preco: { pequeno: 7.60, medio: 9.10, grande: 12.80 }
  },
  {
    nome: "Papa Bueno (Km 55)",
    lat: -23.1742,
    lng: -47.2086,
    rodovia: "SP-127 (Papa Bueno)",
    preco: { pequeno: 7.60, medio: 9.10, grande: 12.80 }
  },

  // SP-099 (Ayrton Senna/Carvalho Pinto)
  {
    nome: "Ayrton Senna (Km 25)",
    lat: -23.1667,
    lng: -46.3333,
    rodovia: "SP-099 (Ayrton Senna)",
    preco: { pequeno: 10.50, medio: 12.60, grande: 17.60 }
  },
  {
    nome: "Ayrton Senna (Km 60)",
    lat: -22.9222,
    lng: -45.9889,
    rodovia: "SP-099 (Ayrton Senna)",
    preco: { pequeno: 10.50, medio: 12.60, grande: 17.60 }
  },
  {
    nome: "Carvalho Pinto (Km 95)",
    lat: -22.6556,
    lng: -45.5667,
    rodovia: "SP-099 (Carvalho Pinto)",
    preco: { pequeno: 10.50, medio: 12.60, grande: 17.60 }
  },

  // SP-081 (Via de acesso)
  {
    nome: "Via de Acesso (Km 15)",
    lat: -23.5356,
    lng: -46.6156,
    rodovia: "SP-081 (Via de Acesso)",
    preco: { pequeno: 6.50, medio: 7.80, grande: 10.90 }
  },

  // BR-381 (Fernão Dias)
  {
    nome: "Fernão Dias (Km 40)",
    lat: -23.2889,
    lng: -46.0667,
    rodovia: "BR-381 (Fernão Dias)",
    preco: { pequeno: 9.90, medio: 11.90, grande: 16.60 }
  },
  {
    nome: "Fernão Dias (Km 85)",
    lat: -22.8444,
    lng: -45.6722,
    rodovia: "BR-381 (Fernão Dias)",
    preco: { pequeno: 9.90, medio: 11.90, grande: 16.60 }
  },

  // BR-116 (Régis Bittencourt)
  {
    nome: "Régis Bittencourt (Km 35)",
    lat: -23.6667,
    lng: -47.4333,
    rodovia: "BR-116 (Régis Bittencourt)",
    preco: { pequeno: 10.80, medio: 12.90, grande: 18.00 }
  },
  {
    nome: "Régis Bittencourt (Km 75)",
    lat: -24.0889,
    lng: -47.8556,
    rodovia: "BR-116 (Régis Bittencourt)",
    preco: { pequeno: 10.80, medio: 12.90, grande: 18.00 }
  },

  // SP-287 (Via Litoral)
  {
    nome: "Via Litoral (Km 45)",
    lat: -24.2333,
    lng: -47.1167,
    rodovia: "SP-287 (Via Litoral)",
    preco: { pequeno: 8.70, medio: 10.40, grande: 14.60 }
  },

  // SP-251 (Imigrantes/Litoral)
  {
    nome: "SP-251 (Litoral)",
    lat: -24.3667,
    lng: -46.8333,
    rodovia: "SP-251 (Litoral)",
    preco: { pequeno: 8.50, medio: 10.20, grande: 14.30 }
  },

  // BR-262 (Mogi Cruzes)
  {
    nome: "BR-262 (Km 50)",
    lat: -23.5167,
    lng: -45.6833,
    rodovia: "BR-262",
    preco: { pequeno: 7.80, medio: 9.40, grande: 13.10 }
  },

  // SP-310 (Araraquara)
  {
    nome: "SP-310 (Km 65)",
    lat: -22.0333,
    lng: -48.1667,
    rodovia: "SP-310",
    preco: { pequeno: 7.40, medio: 8.90, grande: 12.40 }
  },

  // SP-330 (Anhanguera)
  {
    nome: "Anhanguera (Km 40)",
    lat: -23.2167,
    lng: -47.1333,
    rodovia: "SP-330 (Anhanguera)",
    preco: { pequeno: 8.20, medio: 9.80, grande: 13.70 }
  },
  {
    nome: "Anhanguera (Km 85)",
    lat: -22.9444,
    lng: -47.6444,
    rodovia: "SP-330 (Anhanguera)",
    preco: { pequeno: 8.20, medio: 9.80, grande: 13.70 }
  },

  // SP-332 (Rodovia do Açúcar)
  {
    nome: "Rodovia do Açúcar (Km 50)",
    lat: -22.5667,
    lng: -47.8333,
    rodovia: "SP-332",
    preco: { pequeno: 7.90, medio: 9.50, grande: 13.30 }
  },

  // BR-369 (Rodovia do Alcoól)
  {
    nome: "Rodovia do Álcool (Km 60)",
    lat: -22.3833,
    lng: -47.5333,
    rodovia: "BR-369",
    preco: { pequeno: 7.70, medio: 9.20, grande: 12.90 }
  },

  // SP-101 (Rio-Santos)
  {
    nome: "Rio-Santos (Km 100)",
    lat: -24.1333,
    lng: -46.9667,
    rodovia: "SP-101 (Rio-Santos)",
    preco: { pequeno: 8.30, medio: 9.95, grande: 13.90 }
  },

  // SP-191 (Mogi Mirim)
  {
    nome: "SP-191 (Km 40)",
    lat: -22.3667,
    lng: -46.9333,
    rodovia: "SP-191",
    preco: { pequeno: 7.50, medio: 9.00, grande: 12.60 }
  },

  // SP-255 (Rodovia dos Tamoios)
  {
    nome: "Tamoios (Km 25)",
    lat: -23.3444,
    lng: -45.1167,
    rodovia: "SP-255 (Tamoios)",
    preco: { pequeno: 8.60, medio: 10.30, grande: 14.40 }
  },
  {
    nome: "Tamoios (Km 55)",
    lat: -23.5389,
    lng: -45.3556,
    rodovia: "SP-255 (Tamoios)",
    preco: { pequeno: 8.60, medio: 10.30, grande: 14.40 }
  },

  // BR-459 (Rodovia do Circuito das Águas)
  {
    nome: "Circuito das Águas (Km 40)",
    lat: -22.1833,
    lng: -46.2167,
    rodovia: "BR-459",
    preco: { pequeno: 7.20, medio: 8.60, grande: 12.00 }
  },

  // SP-340 (Rod. Pres. Tancredo Neves)
  {
    nome: "Tancredo Neves (Km 35)",
    lat: -23.0667,
    lng: -47.5333,
    rodovia: "SP-340",
    preco: { pequeno: 7.85, medio: 9.40, grande: 13.10 }
  },
  {
    nome: "Tancredo Neves (Km 75)",
    lat: -22.8333,
    lng: -47.9833,
    rodovia: "SP-340",
    preco: { pequeno: 7.85, medio: 9.40, grande: 13.10 }
  },

  // SP-225 (Rodovia Pres. Castello Branco/Interior)
  {
    nome: "SP-225 (Km 50)",
    lat: -22.1667,
    lng: -48.8333,
    rodovia: "SP-225",
    preco: { pequeno: 6.90, medio: 8.30, grande: 11.60 }
  },

  // SP-261 (Rodovia Oswaldo Cruz)
  {
    nome: "Oswaldo Cruz (Km 40)",
    lat: -22.7333,
    lng: -48.7333,
    rodovia: "SP-261",
    preco: { pequeno: 7.15, medio: 8.55, grande: 11.90 }
  },

  // BR-267 (Raposo Tavares - mais praças)
  {
    nome: "Raposo Tavares (Km 80)",
    lat: -23.7333,
    lng: -47.8667,
    rodovia: "BR-267",
    preco: { pequeno: 8.50, medio: 10.20, grande: 14.30 }
  },
  {
    nome: "Raposo Tavares (Km 120)",
    lat: -23.5167,
    lng: -48.3167,
    rodovia: "BR-267",
    preco: { pequeno: 8.50, medio: 10.20, grande: 14.30 }
  },

  // SP-191 (Rodovia Pres. Getúlio Vargas)
  {
    nome: "Getúlio Vargas (Km 60)",
    lat: -22.1833,
    lng: -47.0667,
    rodovia: "SP-191",
    preco: { pequeno: 7.50, medio: 9.00, grande: 12.60 }
  },

  // SP-360 (Rodovia Antônio Thomáz Davella)
  {
    nome: "Antônio Thomáz Davella (Km 30)",
    lat: -22.9167,
    lng: -48.6333,
    rodovia: "SP-360",
    preco: { pequeno: 7.40, medio: 8.90, grande: 12.40 }
  },

  // SP-304 (Rodovia Jaú-Dois Córregos)
  {
    nome: "SP-304 (Km 45)",
    lat: -22.2833,
    lng: -48.5667,
    rodovia: "SP-304",
    preco: { pequeno: 7.10, medio: 8.50, grande: 11.90 }
  },

  // SP-342 (Rodovia Caetano Álvares)
  {
    nome: "Caetano Álvares (Km 35)",
    lat: -23.4833,
    lng: -46.4667,
    rodovia: "SP-342",
    preco: { pequeno: 7.95, medio: 9.55, grande: 13.30 }
  },

  // SP-300 (Rodovia Presidente Ataliba Leonel)
  {
    nome: "Ataliba Leonel (Km 50)",
    lat: -23.0833,
    lng: -48.5167,
    rodovia: "SP-300",
    preco: { pequeno: 7.65, medio: 9.20, grande: 12.80 }
  },

  // BR-374 (Rodovia Santa Lúcia)
  {
    nome: "Santa Lúcia (Km 40)",
    lat: -23.2167,
    lng: -48.4833,
    rodovia: "BR-374",
    preco: { pequeno: 7.40, medio: 8.90, grande: 12.40 }
  },

  // SP-215 (Rodovia Vicente de Carvalho)
  {
    nome: "Vicente de Carvalho (Km 25)",
    lat: -23.6167,
    lng: -46.1833,
    rodovia: "SP-215",
    preco: { pequeno: 8.20, medio: 9.80, grande: 13.70 }
  },

  // SP-147 (Rodovia Itajubá)
  {
    nome: "Itajubá (Km 55)",
    lat: -22.5,
    lng: -45.8333,
    rodovia: "SP-147",
    preco: { pequeno: 7.85, medio: 9.40, grande: 13.10 }
  },

  // SP-243 (Rodovia Franca)
  {
    nome: "Rodovia Franca (Km 70)",
    lat: -21.2333,
    lng: -48.1667,
    rodovia: "SP-243",
    preco: { pequeno: 7.30, medio: 8.75, grande: 12.20 }
  },

  // SP-318 (Rodovia Fernando de Sousa)
  {
    nome: "Fernando de Sousa (Km 45)",
    lat: -22.6667,
    lng: -49.2333,
    rodovia: "SP-318",
    preco: { pequeno: 7.05, medio: 8.45, grande: 11.80 }
  },

  // SP-263 (Rodovia Armando Salles Oliveira)
  {
    nome: "Armando Salles Oliveira (Km 35)",
    lat: -23.1333,
    lng: -47.6833,
    rodovia: "SP-263",
    preco: { pequeno: 7.75, medio: 9.30, grande: 13.00 }
  },

  // SP-345 (Rodovia Prefeito Faria Lima)
  {
    nome: "Prefeito Faria Lima (Km 40)",
    lat: -23.1667,
    lng: -47.2833,
    rodovia: "SP-345",
    preco: { pequeno: 8.05, medio: 9.65, grande: 13.50 }
  },

  // BR-381 (Fernão Dias - mais praças)
  {
    nome: "Fernão Dias (Km 130)",
    lat: -22.4556,
    lng: -45.3222,
    rodovia: "BR-381 (Fernão Dias)",
    preco: { pequeno: 9.90, medio: 11.90, grande: 16.60 }
  },

  // SP-322 (Rodovia Engenheiro Paulo Nilo Romano)
  {
    nome: "Paulo Nilo Romano (Km 55)",
    lat: -22.9167,
    lng: -48.1667,
    rodovia: "SP-322",
    preco: { pequeno: 7.50, medio: 9.00, grande: 12.60 }
  },

  // Duplicado/Contorno rodovias
  {
    nome: "Duplicação BR-116 (Km 15)",
    lat: -23.5889,
    lng: -46.6444,
    rodovia: "BR-116 (Duplicação)",
    preco: { pequeno: 9.80, medio: 11.70, grande: 16.40 }
  },
  {
    nome: "Contorno Campinas (Km 20)",
    lat: -22.9,
    lng: -47.0333,
    rodovia: "SP-360 (Contorno)",
    preco: { pequeno: 8.10, medio: 9.70, grande: 13.60 }
  },

  // Mais praças BR-116 Imigrantes/Anchieta
  {
    nome: "Imigrantes (Km 20)",
    lat: -23.6222,
    lng: -46.6889,
    rodovia: "BR-116 (Imigrantes)",
    preco: { pequeno: 9.20, medio: 11.00, grande: 15.30 }
  },
  {
    nome: "Imigrantes (Km 70)",
    lat: -23.9333,
    lng: -46.5167,
    rodovia: "BR-116 (Imigrantes)",
    preco: { pequeno: 9.20, medio: 11.00, grande: 15.30 }
  },

  // Mais praças Dutra
  {
    nome: "Dutra (Km 5)",
    lat: -23.3667,
    lng: -46.9667,
    rodovia: "BR-116 (Dutra)",
    preco: { pequeno: 11.00, medio: 13.20, grande: 18.50 }
  },
  {
    nome: "Dutra (Km 35)",
    lat: -23.0111,
    lng: -46.6333,
    rodovia: "BR-116 (Dutra)",
    preco: { pequeno: 11.00, medio: 13.20, grande: 18.50 }
  },
  {
    nome: "Dutra (Km 65)",
    lat: -22.5333,
    lng: -46.2889,
    rodovia: "BR-116 (Dutra)",
    preco: { pequeno: 11.00, medio: 13.20, grande: 18.50 }
  },
  {
    nome: "Dutra (Km 95)",
    lat: -22.1444,
    lng: -45.7667,
    rodovia: "BR-116 (Dutra)",
    preco: { pequeno: 11.00, medio: 13.20, grande: 18.50 }
  },
  {
    nome: "Dutra (Km 140)",
    lat: -21.6667,
    lng: -45.5333,
    rodovia: "BR-116 (Dutra)",
    preco: { pequeno: 11.00, medio: 13.20, grande: 18.50 }
  },

  // Mais praças Castelo Branco
  {
    nome: "Castelo Branco (Km 10)",
    lat: -23.5444,
    lng: -46.7222,
    rodovia: "SP-280 (Castelo Branco)",
    preco: { pequeno: 9.80, medio: 11.70, grande: 16.40 }
  },
  {
    nome: "Castelo Branco (Km 50)",
    lat: -23.3833,
    lng: -47.0556,
    rodovia: "SP-280 (Castelo Branco)",
    preco: { pequeno: 9.80, medio: 11.70, grande: 16.40 }
  },
  {
    nome: "Castelo Branco (Km 100)",
    lat: -23.2556,
    lng: -47.5333,
    rodovia: "SP-280 (Castelo Branco)",
    preco: { pequeno: 9.80, medio: 11.70, grande: 16.40 }
  },
  {
    nome: "Castelo Branco (Km 150)",
    lat: -23.0667,
    lng: -48.0556,
    rodovia: "SP-280 (Castelo Branco)",
    preco: { pequeno: 9.80, medio: 11.70, grande: 16.40 }
  },

  // Mais praças Bandeirantes
  {
    nome: "Bandeirantes (Km 15)",
    lat: -23.4667,
    lng: -46.6333,
    rodovia: "SP-348 (Bandeirantes)",
    preco: { pequeno: 8.90, medio: 10.70, grande: 14.90 }
  },
  {
    nome: "Bandeirantes (Km 50)",
    lat: -23.3,
    lng: -46.9167,
    rodovia: "SP-348 (Bandeirantes)",
    preco: { pequeno: 8.90, medio: 10.70, grande: 14.90 }
  },
  {
    nome: "Bandeirantes (Km 90)",
    lat: -23.1111,
    lng: -47.2667,
    rodovia: "SP-348 (Bandeirantes)",
    preco: { pequeno: 8.90, medio: 10.70, grande: 14.90 }
  },
  {
    nome: "Bandeirantes (Km 130)",
    lat: -22.9,
    lng: -47.5556,
    rodovia: "SP-348 (Bandeirantes)",
    preco: { pequeno: 8.90, medio: 10.70, grande: 14.90 }
  },

  // Mais praças Anhanguera
  {
    nome: "Anhanguera (Km 20)",
    lat: -23.3,
    lng: -47.0167,
    rodovia: "SP-330 (Anhanguera)",
    preco: { pequeno: 8.20, medio: 9.80, grande: 13.70 }
  },
  {
    nome: "Anhanguera (Km 60)",
    lat: -23.1167,
    lng: -47.4167,
    rodovia: "SP-330 (Anhanguera)",
    preco: { pequeno: 8.20, medio: 9.80, grande: 13.70 }
  },
  {
    nome: "Anhanguera (Km 100)",
    lat: -22.9833,
    lng: -47.8333,
    rodovia: "SP-330 (Anhanguera)",
    preco: { pequeno: 8.20, medio: 9.80, grande: 13.70 }
  },
  {
    nome: "Anhanguera (Km 140)",
    lat: -22.8333,
    lng: -48.2222,
    rodovia: "SP-330 (Anhanguera)",
    preco: { pequeno: 8.20, medio: 9.80, grande: 13.70 }
  },

  // Mais praças Ayrton Senna
  {
    nome: "Ayrton Senna (Km 10)",
    lat: -23.2333,
    lng: -46.4333,
    rodovia: "SP-099 (Ayrton Senna)",
    preco: { pequeno: 10.50, medio: 12.60, grande: 17.60 }
  },
  {
    nome: "Ayrton Senna (Km 40)",
    lat: -23.0667,
    lng: -46.1667,
    rodovia: "SP-099 (Ayrton Senna)",
    preco: { pequeno: 10.50, medio: 12.60, grande: 17.60 }
  },
  {
    nome: "Ayrton Senna (Km 80)",
    lat: -22.8222,
    lng: -45.7333,
    rodovia: "SP-099 (Ayrton Senna)",
    preco: { pequeno: 10.50, medio: 12.60, grande: 17.60 }
  },
  {
    nome: "Carvalho Pinto (Km 120)",
    lat: -22.5333,
    lng: -45.3333,
    rodovia: "SP-099 (Carvalho Pinto)",
    preco: { pequeno: 10.50, medio: 12.60, grande: 17.60 }
  },

  // Mais praças Régis Bittencourt
  {
    nome: "Régis Bittencourt (Km 15)",
    lat: -23.5556,
    lng: -47.2333,
    rodovia: "BR-116 (Régis Bittencourt)",
    preco: { pequeno: 10.80, medio: 12.90, grande: 18.00 }
  },
  {
    nome: "Régis Bittencourt (Km 55)",
    lat: -23.8667,
    lng: -47.6,
    rodovia: "BR-116 (Régis Bittencourt)",
    preco: { pequeno: 10.80, medio: 12.90, grande: 18.00 }
  },
  {
    nome: "Régis Bittencourt (Km 95)",
    lat: -24.2,
    lng: -48.1333,
    rodovia: "BR-116 (Régis Bittencourt)",
    preco: { pequeno: 10.80, medio: 12.90, grande: 18.00 }
  },

  // Mais praças Fernão Dias
  {
    nome: "Fernão Dias (Km 20)",
    lat: -23.4333,
    lng: -46.1667,
    rodovia: "BR-381 (Fernão Dias)",
    preco: { pequeno: 9.90, medio: 11.90, grande: 16.60 }
  },
  {
    nome: "Fernão Dias (Km 65)",
    lat: -23.0667,
    lng: -45.8333,
    rodovia: "BR-381 (Fernão Dias)",
    preco: { pequeno: 9.90, medio: 11.90, grande: 16.60 }
  },
  {
    nome: "Fernão Dias (Km 110)",
    lat: -22.6556,
    lng: -45.4167,
    rodovia: "BR-381 (Fernão Dias)",
    preco: { pequeno: 9.90, medio: 11.90, grande: 16.60 }
  },

  // Rodovia do Açúcar - mais praças
  {
    nome: "Rodovia do Açúcar (Km 20)",
    lat: -22.7167,
    lng: -47.6667,
    rodovia: "SP-332",
    preco: { pequeno: 7.90, medio: 9.50, grande: 13.30 }
  },
  {
    nome: "Rodovia do Açúcar (Km 80)",
    lat: -22.3667,
    lng: -48.1333,
    rodovia: "SP-332",
    preco: { pequeno: 7.90, medio: 9.50, grande: 13.30 }
  },

  // Rodovia do Álcool - mais praças
  {
    nome: "Rodovia do Álcool (Km 30)",
    lat: -22.5667,
    lng: -47.2333,
    rodovia: "BR-369",
    preco: { pequeno: 7.70, medio: 9.20, grande: 12.90 }
  },
  {
    nome: "Rodovia do Álcool (Km 90)",
    lat: -22.1667,
    lng: -47.8667,
    rodovia: "BR-369",
    preco: { pequeno: 7.70, medio: 9.20, grande: 12.90 }
  },

  // Papa Bueno - mais praças
  {
    nome: "Papa Bueno (Km 10)",
    lat: -23.3667,
    lng: -46.9333,
    rodovia: "SP-127 (Papa Bueno)",
    preco: { pequeno: 7.60, medio: 9.10, grande: 12.80 }
  },
  {
    nome: "Papa Bueno (Km 75)",
    lat: -23.0556,
    lng: -47.3667,
    rodovia: "SP-127 (Papa Bueno)",
    preco: { pequeno: 7.60, medio: 9.10, grande: 12.80 }
  },

  // Via de Acesso - mais praças
  {
    nome: "Via de Acesso (Km 5)",
    lat: -23.5667,
    lng: -46.5667,
    rodovia: "SP-081 (Via de Acesso)",
    preco: { pequeno: 6.50, medio: 7.80, grande: 10.90 }
  },
  {
    nome: "Via de Acesso (Km 25)",
    lat: -23.5,
    lng: -46.6667,
    rodovia: "SP-081 (Via de Acesso)",
    preco: { pequeno: 6.50, medio: 7.80, grande: 10.90 }
  },

  // Via Litoral - mais praças
  {
    nome: "Via Litoral (Km 20)",
    lat: -24.1667,
    lng: -47.0667,
    rodovia: "SP-287 (Via Litoral)",
    preco: { pequeno: 8.70, medio: 10.40, grande: 14.60 }
  },
  {
    nome: "Via Litoral (Km 70)",
    lat: -24.3333,
    lng: -47.3833,
    rodovia: "SP-287 (Via Litoral)",
    preco: { pequeno: 8.70, medio: 10.40, grande: 14.60 }
  },

  // Rio-Santos - mais praças
  {
    nome: "Rio-Santos (Km 50)",
    lat: -24.0167,
    lng: -46.8333,
    rodovia: "SP-101 (Rio-Santos)",
    preco: { pequeno: 8.30, medio: 9.95, grande: 13.90 }
  },
  {
    nome: "Rio-Santos (Km 150)",
    lat: -24.2833,
    lng: -47.1333,
    rodovia: "SP-101 (Rio-Santos)",
    preco: { pequeno: 8.30, medio: 9.95, grande: 13.90 }
  },

  // Rodovia do Circuito - mais praças
  {
    nome: "Circuito das Águas (Km 15)",
    lat: -22.3333,
    lng: -46.0833,
    rodovia: "BR-459",
    preco: { pequeno: 7.20, medio: 8.60, grande: 12.00 }
  },
  {
    nome: "Circuito das Águas (Km 70)",
    lat: -21.9667,
    lng: -46.3833,
    rodovia: "BR-459",
    preco: { pequeno: 7.20, medio: 8.60, grande: 12.00 }
  },

  // BR-262 - mais praças
  {
    nome: "BR-262 (Km 25)",
    lat: -23.6333,
    lng: -45.9333,
    rodovia: "BR-262",
    preco: { pequeno: 7.80, medio: 9.40, grande: 13.10 }
  },
  {
    nome: "BR-262 (Km 75)",
    lat: -23.3667,
    lng: -45.3333,
    rodovia: "BR-262",
    preco: { pequeno: 7.80, medio: 9.40, grande: 13.10 }
  },

  // SP-310 - mais praças
  {
    nome: "SP-310 (Km 30)",
    lat: -22.2833,
    lng: -48.3333,
    rodovia: "SP-310",
    preco: { pequeno: 7.40, medio: 8.90, grande: 12.40 }
  },
  {
    nome: "SP-310 (Km 95)",
    lat: -21.7667,
    lng: -48.9167,
    rodovia: "SP-310",
    preco: { pequeno: 7.40, medio: 8.90, grande: 12.40 }
  }
];

function calcularDistancia(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

async function simularRotaComPedagio(origemCoords, destinoCoords, tipoVeiculo) {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${origemCoords[1]},${origemCoords[0]};${destinoCoords[1]},${destinoCoords[0]}?overview=full&geometries=geojson&steps=true`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`OSRM error: ${response.status}`);
    }
    
    const data = await response.json();
    const route = data.routes[0];
    
    if (!route || !route.geometry || !route.geometry.coordinates) {
      throw new Error("Nenhuma rota encontrada");
    }

    const coordenadas = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
    
    const pedagiosDetectados = [];
    const distanciaTolerancia = 0.5; // Aumentado de 2.5 para 8km

    for (const pedagio of PEDAGIOS_SP) {
      for (let i = 0; i < coordenadas.length - 1; i++) {
        const [lat1, lng1] = coordenadas[i];
        const [lat2, lng2] = coordenadas[i + 1];
        
        const distPedagio1 = calcularDistancia(pedagio.lat, pedagio.lng, lat1, lng1);
        const distPedagio2 = calcularDistancia(pedagio.lat, pedagio.lng, lat2, lng2);
        const distMin = Math.min(distPedagio1, distPedagio2);

        if (distMin < distanciaTolerancia) {
          const jaAdicionado = pedagiosDetectados.some(p => p.nome === pedagio.nome);
          if (!jaAdicionado) {
            pedagiosDetectados.push({
              nome: pedagio.nome,
              rodovia: pedagio.rodovia,
              preco: pedagio.preco[tipoVeiculo] || pedagio.preco.pequeno,
              distancia: distMin
            });
          }
          break;
        }
      }
    }

    const custoTotal = pedagiosDetectados.reduce((sum, p) => sum + p.preco, 0);

    return {
      sucesso: true,
      distancia: route.distance / 1000,
      duracao: route.duration / 60,
      pedagios: pedagiosDetectados,
      custoPedagio: custoTotal,
      temPedagio: pedagiosDetectados.length > 0,
      descricao: pedagiosDetectados.length > 0 
        ? `${pedagiosDetectados.length} pedágio(s) detectado(s)`
        : "Sem pedágios detectados"
    };
  } catch (error) {
    console.error("Erro ao simular rota:", error);
    return {
      sucesso: false,
      erro: error.message,
      pedagios: [],
      custoPedagio: 0,
      temPedagio: false
    };
  }
}

async function calcularPrecoFinalComPedagio(origemCoords, destinoCoords, tipoVeiculo, precoBase) {
  try {
    const simulacao = await simularRotaComPedagio(origemCoords, destinoCoords, tipoVeiculo);
    
    if (!simulacao.sucesso) {
      console.warn("Simulação falhou, usando preço sem pedágio");
      return {
        precoFinal: precoBase,
        pedagio: 0,
        pedagios: [],
        detalhes: "Não foi possível calcular pedágios"
      };
    }

    const precoFinal = precoBase + simulacao.custoPedagio;

    return {
      precoFinal,
      pedagio: simulacao.custoPedagio,
      pedagios: simulacao.pedagios,
      distancia: simulacao.distancia,
      duracao: simulacao.duracao,
      detalhes: simulacao.descricao,
      temPedagio: simulacao.temPedagio
    };
  } catch (error) {
    console.error("Erro ao calcular preço final:", error);
    return {
      precoFinal: precoBase,
      pedagio: 0,
      pedagios: [],
      detalhes: "Erro ao calcular pedágios"
    };
  }
}

window.simularRotaComPedagio = simularRotaComPedagio;
window.calcularPrecoFinalComPedagio = calcularPrecoFinalComPedagio;