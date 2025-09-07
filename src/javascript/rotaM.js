// Iniciar o mapa com Leaflet.js
let map = L.map('map').setView([-23.55052, -46.633308], 13); // Coordenadas de São Paulo

// Adicionar o mapa do OpenStreetMap
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// Função para adicionar marcador no mapa
function addMarker(lat, lon, popupText) {
  let marker = L.marker([lat, lon]).addTo(map);
  marker.bindPopup(popupText).openPopup();
}

// Adicionar um marcador de exemplo no ponto de retirada
addMarker(-23.55052, -46.633308, "Ponto de Retirada");

// Função para iniciar a viagem (exemplo de rota)
document.getElementById('startButton').addEventListener('click', function() {
  // Vamos configurar uma rota do ponto A até o ponto B
  const origem = [-23.55052, -46.633308]; // Ponto de retirada
  const destino = [-23.587274, -46.652758]; // Ponto de destino

  // Limpar os marcadores antigos
  map.eachLayer(function(layer) {
    if (layer instanceof L.Marker) {
      map.removeLayer(layer);
    }
  });

  // Adicionar novos marcadores
  addMarker(origem[0], origem[1], "Ponto de Retirada");
  addMarker(destino[0], destino[1], "Destino Final");

  // Traçar a rota
  let route = L.polyline([origem, destino], {color: 'blue'}).addTo(map);

  // Ajustar o mapa para a rota
  map.fitBounds(route.getBounds());
});
