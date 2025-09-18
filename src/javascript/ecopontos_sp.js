// Lista de ecopontos do estado de São Paulo para autocomplete
const ecopontosSP = [
  // Capital - São Paulo
  "Ecoponto Tereza Cristina - Rua Tereza Cristina, 10, Vila Monumento, São Paulo - SP",
  "Ecoponto Glicério - Baixos do Viaduto Glicério, São Paulo - SP",
  "Ecoponto Liberdade - Rua Jaceguai, 67, Liberdade, São Paulo - SP",
  "Ecoponto Armênia - Rua da Polka, 100, Armênia, São Paulo - SP",
  "Ecoponto Barra Funda - Rua Sólon, Barra Funda, São Paulo - SP",
  "Ecoponto Vila Guilherme - Rua José Bernardo Pinto, 1480, Vila Guilherme, São Paulo - SP",
  "Ecoponto Parque Peruche - Av. Engº Caetano Álvares, 3142, Parque Peruche, São Paulo - SP",
  "Ecoponto Santana - Santana, São Paulo - SP",
  "Ecoponto Caldeirão - Rua Major Vitorino de Souza Rocha, 90, São Paulo - SP",
  "Ecoponto Imigrantes - Jabaquara, São Paulo - SP",
  "Ecoponto Vila Santa Maria - Rua André Bolsena, 96, Casa Verde, São Paulo - SP",
  "Ecoponto Viaduto Eng.º Alberto Badra - Av. Aricanduva, 200, Zona Leste, São Paulo - SP",
  "Ecoponto Astarte - Rua Astarte x Av. Aricanduva, Zona Leste, São Paulo - SP",
  "Ecoponto Vila das Belezas - Rua Campo Novo do Sul, s/nº, Vila das Belezas, São Paulo - SP",
  "Ecoponto Paraisópolis - Rua Irapará, 73, Parque Morumbi, São Paulo - SP",
  "Ecoponto Vila Nova Cachoeirinha - Vila Nova Cachoeirinha, São Paulo - SP",
  
  // Região Metropolitana
  "Ecoponto Guarulhos - Guarulhos - SP",
  "Ecoponto Diadema - Diadema - SP",
  "Ecoponto Santo André - Santo André - SP",
  "Ecoponto São Bernardo do Campo - São Bernardo do Campo - SP",
  "Ecoponto São Caetano do Sul - São Caetano do Sul - SP",
  "Ecoponto Mauá - Mauá - SP",
  "Ecoponto Ribeirão Pires - Ribeirão Pires - SP",
  "Ecoponto Rio Grande da Serra - Rio Grande da Serra - SP",
  "Ecoponto Osasco - Osasco - SP",
  "Ecoponto Carapicuíba - Carapicuíba - SP",
  "Ecoponto Barueri - Barueri - SP",
  "Ecoponto Jandira - Jandira - SP",
  "Ecoponto Itapevi - Itapevi - SP",
  "Ecoponto Santana de Parnaíba - Santana de Parnaíba - SP",
  "Ecoponto Cotia - Cotia - SP",
  "Ecoponto Vargem Grande Paulista - Vargem Grande Paulista - SP",
  "Ecoponto Embu das Artes - Embu das Artes - SP",
  "Ecoponto Embu-Guaçu - Embu-Guaçu - SP",
  "Ecoponto Itapecerica da Serra - Itapecerica da Serra - SP",
  "Ecoponto Juquitiba - Juquitiba - SP",
  "Ecoponto São Lourenço da Serra - São Lourenço da Serra - SP",
  "Ecoponto Taboão da Serra - Taboão da Serra - SP",
  
  // Interior do Estado
  "Ecoponto Campinas - Campinas - SP",
  "Ecoponto Sorocaba - Sorocaba - SP",
  "Ecoponto Ribeirão Preto - Ribeirão Preto - SP",
  "Ecoponto Santos - Santos - SP",
  "Ecoponto São José dos Campos - São José dos Campos - SP",
  "Ecoponto Piracicaba - Piracicaba - SP",
  "Ecoponto Jundiaí - Jundiaí - SP",
  "Ecoponto Limeira - Limeira - SP",
  "Ecoponto Americana - Americana - SP",
  "Ecoponto Araraquara - Araraquara - SP",
  "Ecoponto Franca - Franca - SP",
  "Ecoponto Taubaté - Taubaté - SP",
  "Ecoponto Bauru - Bauru - SP",
  "Ecoponto Presidente Prudente - Presidente Prudente - SP",
  "Ecoponto São Carlos - São Carlos - SP",
  "Ecoponto Marília - Marília - SP",
  "Ecoponto Jacareí - Jacareí - SP",
  "Ecoponto Indaiatuba - Indaiatuba - SP",
  "Ecoponto Suzano - Suzano - SP",
  "Ecoponto Mogi das Cruzes - Mogi das Cruzes - SP",
  "Ecoponto Guarujá - Guarujá - SP",
  "Ecoponto Praia Grande - Praia Grande - SP",
  "Ecoponto São Vicente - São Vicente - SP",
  "Ecoponto Cubatão - Cubatão - SP",
  "Ecoponto Bertioga - Bertioga - SP"
];

// Função para filtrar ecopontos baseado no texto digitado
function filtrarEcopontos(texto) {
  if (!texto || texto.length < 2) return [];
  
  const textoLower = texto.toLowerCase();
  return ecopontosSP.filter(ecoponto => 
    ecoponto.toLowerCase().includes(textoLower)
  ).slice(0, 10); // Limita a 10 resultados
}

// Exporta para uso em outros arquivos
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ecopontosSP, filtrarEcopontos };
}

