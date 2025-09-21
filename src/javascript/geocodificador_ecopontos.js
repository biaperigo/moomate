/**
 * Sistema de Geocodificação Automática para Ecopontos
 * Garante que todos os ecopontos tenham coordenadas válidas para desenho de rotas
 */

class GeocodificadorEcopontos {
  constructor() {
    this.cache = new Map();
    this.tentativasMaximas = 3;
    this.delayEntreTentativas = 1000; // 1 segundo
  }

  /**
   * Valida se as coordenadas estão dentro dos limites de São Paulo
   */
  validarCoordenadas(lat, lng) {
    if (lat === null || lng === null || lat === undefined || lng === undefined) {
      return false;
    }
    
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    
    if (isNaN(latNum) || isNaN(lngNum)) {
      return false;
    }
    
    if (latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
      return false;
    }
    
    // Verificação específica para região metropolitana de SP (bounds ampliados)
    if (latNum < -25.50 || latNum > -19.50 || lngNum < -53.50 || lngNum > -44.00) {
      return false;
    }
    
    return true;
  }

  /**
   * Limpa e normaliza o endereço para melhor geocodificação
   */
  normalizarEndereco(endereco) {
    if (!endereco || typeof endereco !== 'string') {
      return null;
    }

    let enderecoLimpo = endereco.trim();

    // Remover prefixo "Ecoponto" se existir
    enderecoLimpo = enderecoLimpo.replace(/^Ecoponto\s+/i, '');

    // Se contém " - ", pegar a parte do endereço
    if (enderecoLimpo.includes(' - ')) {
      const partes = enderecoLimpo.split(' - ');
      if (partes.length > 1) {
        enderecoLimpo = partes[1].trim();
      }
    }

    // Remover informações desnecessárias
    enderecoLimpo = enderecoLimpo
      .replace(/(defronte|altura do|esquina com|baixo do|baixos do)/gi, '')
      .replace(/nº\s*\d+/gi, '') // Remover números específicos que podem não existir
      .replace(/\s+/g, ' ')
      .trim();

    // Garantir que termine com São Paulo
    if (!enderecoLimpo.toLowerCase().includes('são paulo')) {
      enderecoLimpo += ', São Paulo, SP';
    }

    return enderecoLimpo;
  }

  /**
   * Geocodifica um endereço usando múltiplas estratégias
   */
  async geocodificarEndereco(endereco, tentativa = 1) {
    const enderecoNormalizado = this.normalizarEndereco(endereco);
    
    if (!enderecoNormalizado) {
      console.warn('Endereço inválido para geocodificação:', endereco);
      return null;
    }

    // Verificar cache
    if (this.cache.has(enderecoNormalizado)) {
      return this.cache.get(enderecoNormalizado);
    }

    const queries = [
      enderecoNormalizado + ', Brasil',
      enderecoNormalizado,
      enderecoNormalizado.split(',')[0] + ', São Paulo, SP, Brasil'
    ];

    for (const query of queries) {
      try {
        console.log(`🔍 Tentativa ${tentativa}: Geocodificando "${query}"`);
        
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=5&countrycodes=br&bounded=1&viewbox=-53.5,-25.5,-44.0,-19.5`;
        
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'MooMate-Ecopontos/1.0'
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (data && data.length > 0) {
          // Procurar o resultado mais relevante
          for (const result of data) {
            const lat = parseFloat(result.lat);
            const lng = parseFloat(result.lon);

            if (this.validarCoordenadas(lat, lng)) {
              const coordenadas = {
                lat,
                lng,
                endereco: result.display_name,
                enderecoOriginal: endereco,
                fonte: 'nominatim',
                confianca: this.calcularConfianca(result, enderecoNormalizado)
              };

              // Salvar no cache
              this.cache.set(enderecoNormalizado, coordenadas);
              
              console.log(`✅ Geocodificação bem-sucedida:`, coordenadas);
              return coordenadas;
            }
          }
        }

        // Delay entre tentativas para não sobrecarregar a API
        await this.delay(this.delayEntreTentativas);

      } catch (error) {
        console.warn(`❌ Erro na query "${query}":`, error.message);
        await this.delay(this.delayEntreTentativas);
      }
    }

    // Se chegou aqui, tentar novamente se não excedeu o limite
    if (tentativa < this.tentativasMaximas) {
      console.log(`🔄 Tentando novamente (${tentativa + 1}/${this.tentativasMaximas}) para: ${endereco}`);
      await this.delay(this.delayEntreTentativas * tentativa);
      return this.geocodificarEndereco(endereco, tentativa + 1);
    }

    console.error(`❌ Falha na geocodificação após ${this.tentativasMaximas} tentativas:`, endereco);
    return null;
  }

  /**
   * Calcula a confiança do resultado baseado na relevância
   */
  calcularConfianca(result, enderecoOriginal) {
    let confianca = 0.5; // Base

    const displayName = result.display_name.toLowerCase();
    const original = enderecoOriginal.toLowerCase();

    // Verificar se contém elementos do endereço original
    if (displayName.includes('são paulo')) confianca += 0.2;
    if (result.class === 'amenity' || result.class === 'building') confianca += 0.1;
    if (result.type === 'recycling' || result.type === 'waste_disposal') confianca += 0.2;

    // Verificar palavras-chave
    const palavrasChave = original.split(/\s+/).filter(p => p.length > 3);
    for (const palavra of palavrasChave) {
      if (displayName.includes(palavra)) {
        confianca += 0.1;
      }
    }

    return Math.min(confianca, 1.0);
  }

  /**
   * Delay helper
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Geocodifica uma lista de ecopontos em lote
   */
  async geocodificarLote(ecopontos, callback = null) {
    const resultados = [];
    const total = ecopontos.length;

    console.log(`🚀 Iniciando geocodificação em lote de ${total} ecopontos`);

    for (let i = 0; i < ecopontos.length; i++) {
      const ecoponto = ecopontos[i];
      
      try {
        let endereco;
        
        // Determinar o endereço baseado no formato do ecoponto
        if (typeof ecoponto === 'string') {
          endereco = ecoponto;
        } else if (ecoponto.endereco) {
          endereco = ecoponto.endereco;
        } else if (ecoponto.nome) {
          endereco = ecoponto.nome;
        } else {
          console.warn('Formato de ecoponto não reconhecido:', ecoponto);
          continue;
        }

        // Se já tem coordenadas válidas, usar as existentes
        if (ecoponto.lat && ecoponto.lng && this.validarCoordenadas(ecoponto.lat, ecoponto.lng)) {
          resultados.push({
            ...ecoponto,
            geocodificado: false,
            fonte: 'existente'
          });
          
          if (callback) callback(i + 1, total, ecoponto.nome || endereco, 'existente');
          continue;
        }

        // Geocodificar
        const coordenadas = await this.geocodificarEndereco(endereco);
        
        if (coordenadas) {
          const ecopontoGeocodificado = {
            ...ecoponto,
            lat: coordenadas.lat,
            lng: coordenadas.lng,
            endereco: endereco,
            enderecoCompleto: coordenadas.endereco,
            geocodificado: true,
            fonte: coordenadas.fonte,
            confianca: coordenadas.confianca
          };
          
          resultados.push(ecopontoGeocodificado);
          
          if (callback) callback(i + 1, total, ecoponto.nome || endereco, 'sucesso');
        } else {
          // Manter o ecoponto mesmo sem coordenadas
          resultados.push({
            ...ecoponto,
            geocodificado: false,
            erro: 'Não foi possível geocodificar',
            fonte: 'erro'
          });
          
          if (callback) callback(i + 1, total, ecoponto.nome || endereco, 'erro');
        }

        // Delay entre geocodificações para não sobrecarregar a API
        if (i < ecopontos.length - 1) {
          await this.delay(1500);
        }

      } catch (error) {
        console.error(`Erro ao processar ecoponto ${i}:`, error);
        resultados.push({
          ...ecoponto,
          geocodificado: false,
          erro: error.message,
          fonte: 'erro'
        });
        
        if (callback) callback(i + 1, total, ecoponto.nome || 'Desconhecido', 'erro');
      }
    }

    const sucessos = resultados.filter(r => r.lat && r.lng && this.validarCoordenadas(r.lat, r.lng));
    const erros = resultados.filter(r => !r.lat || !r.lng || !this.validarCoordenadas(r.lat, r.lng));

    console.log(`✅ Geocodificação concluída: ${sucessos.length}/${total} sucessos, ${erros.length} erros`);

    return {
      ecopontos: resultados,
      estatisticas: {
        total,
        sucessos: sucessos.length,
        erros: erros.length,
        percentualSucesso: ((sucessos.length / total) * 100).toFixed(1)
      }
    };
  }

  /**
   * Busca o ecoponto mais próximo de uma coordenada
   */
  encontrarEcopontoMaisProximo(lat, lng, ecopontos) {
    if (!this.validarCoordenadas(lat, lng) || !ecopontos || ecopontos.length === 0) {
      return null;
    }

    let menorDistancia = Infinity;
    let ecopontoMaisProximo = null;

    for (const ecoponto of ecopontos) {
      if (!this.validarCoordenadas(ecoponto.lat, ecoponto.lng)) {
        continue;
      }

      const distancia = this.calcularDistancia(lat, lng, ecoponto.lat, ecoponto.lng);
      
      if (distancia < menorDistancia) {
        menorDistancia = distancia;
        ecopontoMaisProximo = {
          ...ecoponto,
          distancia: distancia
        };
      }
    }

    return ecopontoMaisProximo;
  }

  /**
   * Calcula a distância entre duas coordenadas (fórmula de Haversine)
   */
  calcularDistancia(lat1, lng1, lat2, lng2) {
    const R = 6371; // Raio da Terra em km
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Converte graus para radianos
   */
  toRad(degrees) {
    return degrees * (Math.PI / 180);
  }
}

// Exportar para uso global
if (typeof window !== 'undefined') {
  window.GeocodificadorEcopontos = GeocodificadorEcopontos;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = GeocodificadorEcopontos;
}
