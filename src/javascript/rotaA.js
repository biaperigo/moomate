﻿(() => {
  const pick = (...ids) => ids.map((id) => document.getElementById(id)).find((el) => !!el) || null

  const origemInfoEl = pick("origemInfo")
  const destinoInfoEl = pick("destinoInfo")
  const nomeClienteMainEl = pick("clienteInfo")
  const nomeClienteModalEl = pick("modal-client-name")

  const distEl = pick("distanciaInfo")
  const tempoEl = pick("tempoInfo")
  const btnTudoPronto = pick("btnSeguirDestino")
  const btnFinalizar = pick("btnFinalizar")

  const instrWrap = pick("route-instructions")
  const instrList = pick("directionsList")

  const modal = pick("user-rating-modal")
  const salvarAvaliacaoBtn = pick("submit-user-rating")
  const cancelarAvaliacaoBtn = pick("cancel-user-rating")
  const fecharModalBtn = pick("close-user-modal")
  const comentarioEl = pick("user-rating-comment")

  const $openModal = () => modal && (modal.style.display = "flex")
  const $closeModal = () => modal && (modal.style.display = "none")
  ;[cancelarAvaliacaoBtn, fecharModalBtn].forEach((b) => b?.addEventListener("click", $closeModal))
  if (cancelarAvaliacaoBtn) cancelarAvaliacaoBtn.style.display = "none"

  if (!window.firebase) {
    console.error("Firebase não está carregado!")
    return
  }

  const firebase = window.firebase
  const db = firebase.firestore()
  let corridaId = null
  let dadosCorrida = null
  let corridaRef = null
  let syncRef = null

  async function resolverNomeCliente({ docData, corridaId }) {
    try {
      let nome = docData?.clienteNome || dadosCorrida?.clienteNome || null;
      if (nome && typeof nome === 'string' && nome.trim() && nome.toLowerCase() !== 'cliente') return nome;

      if (docData?.clienteId) {
        const uNome = await obterNome(docData.clienteId);
        if (uNome && uNome !== '—') return uNome;
      }
    } catch {}
    return null;
  }

  function criarModalCancelamento() {
    let modal = document.getElementById('client-cancel-modal');
    if (modal) {
      modal.remove();
    }

    modal = document.createElement('div');
    modal.id = 'client-cancel-modal';
    modal.style.cssText = `
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      background: rgba(0, 0, 0, 0.8) !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      z-index: 99999 !important;
      animation: fadeIn 0.3s ease !important;
    `;
    
    modal.innerHTML = `
      <div style="
        background: white;
        padding: 40px;
        border-radius: 16px;
        max-width: 450px;
        width: 90%;
        text-align: center;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
        animation: slideIn 0.3s ease;
        position: relative;
        z-index: 100000;
      ">
        <div style="
          width: 80px;
          height: 80px;
          background: #ff6b35;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 20px;
        ">
          <i class="fas fa-times" style="color: white; font-size: 36px;"></i>
        </div>
        
        <h2 style="
          color: #dc3545;
          margin-bottom: 15px;
          font-size: 28px;
          font-weight: 700;
        ">🚫 Agendamento Cancelado</h2>
        
        <p style="
          color: #666;
          margin-bottom: 30px;
          font-size: 18px;
          line-height: 1.5;
        ">O cliente cancelou o agendamento. Você será redirecionado para a página inicial.</p>
        
        <button id="ok-cancel-btn" style="
          background: #007bff;
          color: white;
          border: none;
          padding: 15px 30px;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          width: 100%;
        ">
          <i class="fas fa-check"></i> Entendi
        </button>
      </div>
      
      <style>
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes slideIn {
          from { 
            transform: translateY(-50px);
            opacity: 0;
          }
          to { 
            transform: translateY(0);
            opacity: 1;
          }
        }
        
        #client-cancel-modal button:hover {
          background: #0056b3 !important;
        }
        
        #client-cancel-modal button:active {
          transform: translateY(1px);
        }
      </style>
    `;

    document.body.appendChild(modal);

    const okBtn = document.getElementById('ok-cancel-btn');
    if (okBtn) {
      okBtn.addEventListener('click', () => {
        localStorage.removeItem("ultimaCorridaMotorista");
        localStorage.removeItem("corridaSelecionada");
        
        if (window.cancelamentoListeners) {
          try {
            window.cancelamentoListeners.unsubscribeCorreda();
            window.cancelamentoListeners.unsubscribeSync();
          } catch (e) {
            console.log("Erro ao limpar listeners:", e);
          }
        }
        
        window.location.href = "homeM.html";
      });
    }

    setTimeout(() => {
      if (document.getElementById('client-cancel-modal')) {
        okBtn?.click();
      }
    }, 10000);
  }

  function validarCoordenadas(lat, lng) {
    if (lat === null || lng === null || lat === undefined || lng === undefined) {
      return false
    }
    
    const latNum = parseFloat(lat)
    const lngNum = parseFloat(lng)
    
    if (isNaN(latNum) || isNaN(lngNum)) {
      return false
    }
    
    if (latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
      return false
    }
    
    if (latNum < -25.50 || latNum > -19.50 || lngNum < -53.50 || lngNum > -44.00) {
      return false
    }
    
    return true
  }

  async function geocodificarEndereco(endereco) {
    if (!endereco || typeof endereco !== 'string') {
      return null;
    }

    let searchQuery = endereco;

    if (searchQuery.toLowerCase().includes('ecoponto')) {
      const partes = searchQuery.split('–');
      if (partes.length > 1) {
        searchQuery = partes[1].trim();
      }
      searchQuery = searchQuery.replace(/(defronte|bairro:|nº)/gi, '');
      searchQuery = searchQuery.replace(/\s+/g, ' ').trim();
    }

    const queries = [
      searchQuery + ', São Paulo, SP, Brasil',
      searchQuery + ', São Paulo, Brasil',
      searchQuery.split(',')[0] + ', São Paulo, Brasil'
    ];

    for (const query of queries) {
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=3&countrycodes=br`;
        const response = await fetch(url);
        const data = await response.json();

        if (data && data.length > 0) {
          const result = data[0];
          const lat = parseFloat(result.lat);
          const lng = parseFloat(result.lon);

          if (validarCoordenadas(lat, lng)) {
            return { lat, lng, endereco: result.display_name };
          }
        }
      } catch (error) {
        console.warn(`Erro na query: ${query}`, error);
      }
    }

    return null;
  }

  async function obterNome(uid) {
    if (!uid) return "—"
    try {
      let doc = await db.collection("usuarios").doc(uid).get()
      if (doc.exists) {
        const data = doc.data()
        return data.nome || data.dadosPessoais?.nome || "—"
      }
      
      doc = await db.collection("clientes").doc(uid).get()
      if (doc.exists) {
        const data = doc.data()
        return data.nome || data.dadosPessoais?.nome || "—"
      }
    } catch (error) {
      console.error("Erro ao obter nome:", error)
    }
    return "—"
  }

  async function obterCorridaAtiva(uid) {
    try {
      const ultima = localStorage.getItem("ultimaCorridaMotorista")
      if (ultima) {
        try {
          let d = await db.collection("agendamentos").doc(ultima).get()
          if (d.exists) {
            const data = d.data()
            if (data && data.status && data.status !== "finalizada" && data.status !== "cancelada") {
              return { id: d.id }
            }
          }
        } catch (error) {
          console.warn("Erro ao buscar agendamento específico:", error)
        }
      }
      
      try {
        let q = await db.collection("agendamentos")
          .where("motoristaId", "==", uid)
          .where("status", "in", ["indo_retirar", "a_caminho_destino", "agendamento_confirmado", "corrida_agendamento_confirmado"])
          .orderBy("confirmadoEm", "desc")
          .limit(1)
          .get()
          
        if (!q.empty) {
          const doc = q.docs[0]
          return { id: doc.id }
        }
      } catch (error) {
        console.warn("Erro ao buscar agendamentos ativos:", error)
      }
    } catch (error) {
      console.error("Erro ao obter agendamento ativo:", error)
    }
    return null
  }

  if (!window.L) {
    console.error("Leaflet não está carregado!")
    return
  }

  const L = window.L
  const MAPTILER_KEY = "lRS4UV8yOp62RauVV5D7"
  
  const mapElement = document.getElementById("map")
  if (!mapElement) {
    console.error("Elemento do mapa não encontrado!")
    return
  }
  
  const map = L.map("map")
  L.tileLayer(`https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`, {
    attribution: "&copy; OpenStreetMap & MapTiler",
    maxZoom: 20,
  }).addTo(map)

  let motoristaMarker = null, origemMarker = null, destinoMarker = null, routeLayer = null
  let posMotorista = null
  let fase = "indo_retirar"

  const km = (m) => (m / 1000).toFixed(2) + " km"
  const min = (s) => Math.max(1, Math.round(s / 60)) + " min"

  function ptTurn(type, modifier) {
    const m = (modifier || "").toLowerCase()
    const dir =
      m === "left" ? "à esquerda" :
      m === "right" ? "à direita" :
      m === "slight left" ? "levemente à esquerda" :
      m === "slight right" ? "levemente à direita" :
      m === "uturn" ? "retorne" : "em frente"
    if (type === "depart") return "Siga em frente"
    if (type === "arrive") return "Chegue ao destino"
    if (type === "turn") return `Vire ${dir}`
    if (type === "roundabout") return "Entre na rotatória e saia conforme indicado"
    if (type === "merge") return "Converja para a via indicada"
    if (type === "end of road") return "No fim da via, siga indicado"
    if (type === "continue") return `Continue ${dir}`
    return "Siga a via indicada"
  }

  function renderInstrucoes(steps) {
    if (!instrWrap || !instrList) return
    instrWrap.style.display = "block"
    instrList.innerHTML = ""
    if (!steps || !Array.isArray(steps)) return
    
    steps.forEach((s) => {
      if (!s || !s.maneuver) return
      const li = document.createElement("li")
      const via = s.name ? ` pela ${s.name}` : ""
      li.textContent = `${ptTurn(s.maneuver.type, s.maneuver.modifier)}${via}`
      const badge = document.createElement("span")
      badge.className = "badge"
      badge.textContent = `${km(s.distance || 0)} · ${min(s.duration || 0)}`
      li.appendChild(badge)
      instrList.appendChild(li)
    })
  }

  async function desenharRota(from, to) {
    if (!from || !to) {
      console.warn("Coordenadas de origem ou destino não fornecidas")
      return
    }
    
    if (!validarCoordenadas(from.lat, from.lng) || !validarCoordenadas(to.lat, to.lng)) {
      console.error("Coordenadas inválidas para rota:", { from, to })
      return
    }
    
    const fromLat = parseFloat(from.lat)
    const fromLng = parseFloat(from.lng)
    const toLat = parseFloat(to.lat)
    const toLng = parseFloat(to.lng)
    
    const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson&steps=true`
    
    try {
      const resp = await fetch(url)
      if (!resp.ok) {
        console.error(`OSRM retornou ${resp.status}: ${resp.statusText}`)
        return
      }
      
      const data = await resp.json()
      const route = data?.routes?.[0]
      if (!route || !route.geometry || !route.geometry.coordinates) {
        console.error("Nenhuma rota válida encontrada nos dados:", data)
        return
      }

      const latlngs = route.geometry.coordinates.map(([lng, lat]) => {
        if (validarCoordenadas(lat, lng)) {
          return [lat, lng]
        }
        return null
      }).filter(coord => coord !== null)
      
      if (latlngs.length === 0) {
        console.error("Nenhuma coordenada válida na rota")
        return
      }
      
      if (routeLayer) map.removeLayer(routeLayer)
      routeLayer = L.polyline(latlngs, { weight: 6, opacity: 0.95, color: "#ff6c0c" }).addTo(map)
      map.fitBounds(L.latLngBounds(latlngs), { padding: [40, 40] })

      if (distEl) distEl.textContent = km(route.distance || 0)
      if (tempoEl) tempoEl.textContent = min(route.duration || 0)
      renderInstrucoes(route.legs && route.legs[0] ? route.legs[0].steps || [] : [])
      
    } catch (error) {
      console.error("Erro ao buscar rota:", error)
    }
  }

  function desenharMarcadores() {
    if (posMotorista && validarCoordenadas(posMotorista.lat, posMotorista.lng)) {
      if (!motoristaMarker) {
        motoristaMarker = L.marker([posMotorista.lat, posMotorista.lng], {
          icon: L.divIcon({
            className: "marker-motorista",
            html: `<div style="width:20px;height:20px;background:#3DBE34;border:3px solid #fff;border-radius:50%;
                   box-shadow:0 0 10px rgba(0,0,0,0.5);animation:pulse 1.2s infinite;"></div>`,
          }),
        }).addTo(map)
      } else {
        motoristaMarker.setLatLng([posMotorista.lat, posMotorista.lng])
      }
    }

    if (dadosCorrida?.origem && validarCoordenadas(dadosCorrida.origem.lat, dadosCorrida.origem.lng)) {
      const origemIcon = `<div style="width:22px;height:22px;background:#1E3A8A;border:3px solid #fff;border-radius:50%;"></div>`
      
      if (!origemMarker) {
        origemMarker = L.marker([dadosCorrida.origem.lat, dadosCorrida.origem.lng], {
          icon: L.divIcon({
            className: "marker-origem",
            html: origemIcon,
          }),
        }).addTo(map)
      } else {
        origemMarker.setLatLng([dadosCorrida.origem.lat, dadosCorrida.origem.lng])
      }
    }

    if (fase === "a_caminho_destino" && dadosCorrida?.destino && validarCoordenadas(dadosCorrida.destino.lat, dadosCorrida.destino.lng)) {
      const destinoIcon = `<div style="width:22px;height:22px;background:#FF6C0C;border:3px solid #fff;border-radius:50%;"></div>`
      
      if (!destinoMarker) {
        destinoMarker = L.marker([dadosCorrida.destino.lat, dadosCorrida.destino.lng], {
          icon: L.divIcon({
            className: "marker-destino",
            html: destinoIcon,
          }),
        }).addTo(map)
      } else {
        destinoMarker.setLatLng([dadosCorrida.destino.lat, dadosCorrida.destino.lng])
      }
    }
  }

  const getTexto = (el) => (el && el.textContent && el.textContent.trim()) || ""

  async function upsertCorridaBase() {
    if (!corridaRef || !dadosCorrida) return
    
    try {
      const snap = await corridaRef.get()
      const base = snap.exists ? (snap.data() || {}) : {}

      const payload = {}
      if (dadosCorrida?.clienteId) payload.clienteId = dadosCorrida.clienteId
      if (dadosCorrida?.motoristaId) payload.motoristaId = dadosCorrida.motoristaId

      if (dadosCorrida?.origem) {
        if (validarCoordenadas(dadosCorrida.origem.lat, dadosCorrida.origem.lng)) {
          payload.origem = {
            lat: parseFloat(dadosCorrida.origem.lat),
            lng: parseFloat(dadosCorrida.origem.lng),
            endereco: dadosCorrida.origem.endereco || getTexto(origemInfoEl) || base?.origem?.endereco || "",
          }
        }
        else if (dadosCorrida.origem.endereco && typeof dadosCorrida.origem.endereco === 'string' && dadosCorrida.origem.endereco.trim()) {
          try {
            const coords = await geocodificarEndereco(dadosCorrida.origem.endereco)
            if (coords && validarCoordenadas(coords.lat, coords.lng)) {
              payload.origem = {
                lat: parseFloat(coords.lat),
                lng: parseFloat(coords.lng),
                endereco: dadosCorrida.origem.endereco,
              }
              dadosCorrida.origem = payload.origem
            }
          } catch (error) {
            console.warn("Erro ao geocodificar origem:", error.message)
          }
        }
      }

      if (dadosCorrida?.destino) {
        if (validarCoordenadas(dadosCorrida.destino.lat, dadosCorrida.destino.lng)) {
          payload.destino = {
            lat: parseFloat(dadosCorrida.destino.lat),
            lng: parseFloat(dadosCorrida.destino.lng),
            endereco: dadosCorrida.destino.endereco || getTexto(destinoInfoEl) || base?.destino?.endereco || "",
          }
        }
        else if (dadosCorrida.destino.endereco && typeof dadosCorrida.destino.endereco === 'string' && dadosCorrida.destino.endereco.trim()) {
          try {
            const coords = await geocodificarEndereco(dadosCorrida.destino.endereco)
            if (coords && validarCoordenadas(coords.lat, coords.lng)) {
              payload.destino = {
                lat: parseFloat(coords.lat),
                lng: parseFloat(coords.lng),
                endereco: dadosCorrida.destino.endereco,
              }
              dadosCorrida.destino = payload.destino
            }
          } catch (error) {
            console.warn("Erro ao geocodificar destino:", error.message)
          }
        }
      }
      
      if (!base.status) payload.status = "indo_retirar"

      if (Object.keys(payload).length) {
        await corridaRef.set(payload, { merge: true })
      }
    } catch (error) {
      console.error("Erro ao atualizar corrida base:", error)
    }
  }

  function publicarPosicao(lat, lng, heading) {
    if (!validarCoordenadas(lat, lng)) {
      console.warn("Coordenadas inválidas para posição do motorista:", { lat, lng })
      return
    }

    posMotorista = { lat: parseFloat(lat), lng: parseFloat(lng) }
    desenharMarcadores()
    
    if (fase === "indo_retirar" && dadosCorrida?.origem && validarCoordenadas(dadosCorrida.origem.lat, dadosCorrida.origem.lng)) {
      desenharRota(posMotorista, dadosCorrida.origem).catch(error => 
        console.warn("Erro ao desenhar rota para origem:", error.message)
      )
    }
    
    if (syncRef) {
      syncRef.set(
        {
          motorista: {
            lat: parseFloat(lat),
            lng: parseFloat(lng),
            heading: heading ?? null,
            ts: firebase.firestore.FieldValue.serverTimestamp(),
          },
        },
        { merge: true },
      ).catch(error => console.error("Erro ao publicar posição:", error))
    }
  }

  function startGeolocation() {
    if (!navigator.geolocation) {
      console.error("Geolocalização indisponível")
      return
    }
    
    navigator.geolocation.watchPosition(
      (p) => {
        if (p && p.coords) {
          publicarPosicao(p.coords.latitude, p.coords.longitude, p.coords.heading)
        }
      },
      (error) => {
        console.error("Erro na geolocalização:", error)
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 },
    )
  }

  btnTudoPronto?.addEventListener("click", async () => {
    if (!dadosCorrida) return
    
    try {
      fase = "a_caminho_destino"
      if (routeLayer) map.removeLayer(routeLayer)
      desenharMarcadores()
      
      if (dadosCorrida.origem && dadosCorrida.destino && 
          validarCoordenadas(dadosCorrida.origem.lat, dadosCorrida.origem.lng) &&
          validarCoordenadas(dadosCorrida.destino.lat, dadosCorrida.destino.lng)) {
        await desenharRota(dadosCorrida.origem, dadosCorrida.destino)
      }
      
      btnTudoPronto.innerHTML = '<i class="fas fa-check"></i> Tudo pronto, seguir até o destino'
      btnTudoPronto.style.display = "none"
      if (btnFinalizar) btnFinalizar.style.display = "inline-block"

      const updatePromises = []
      if (syncRef) {
        const payload = { fase: "a_caminho_destino" }
        if (dadosCorrida?.origem && validarCoordenadas(dadosCorrida.origem.lat, dadosCorrida.origem.lng)) {
          payload.origem = {
            lat: parseFloat(dadosCorrida.origem.lat),
            lng: parseFloat(dadosCorrida.origem.lng),
            endereco: dadosCorrida.origem.endereco || ''
          }
        }
        if (dadosCorrida?.destino && validarCoordenadas(dadosCorrida.destino.lat, dadosCorrida.destino.lng)) {
          payload.destino = {
            lat: parseFloat(dadosCorrida.destino.lat),
            lng: parseFloat(dadosCorrida.destino.lng),
            endereco: dadosCorrida.destino.endereco || ''
          }
        }
        updatePromises.push(syncRef.set(payload, { merge: true }))
      }
      if (corridaRef) updatePromises.push(corridaRef.set({ status: "a_caminho_destino" }, { merge: true }))
      
      if (updatePromises.length > 0) {
        await Promise.all(updatePromises)
      }
      
    } catch (error) {
      console.error("Erro ao processar 'Tudo Pronto':", error)
    }
  })

  btnFinalizar?.addEventListener("click", async () => {
    try {
      $openModal()
      
      const updatePromises = []
      if (syncRef) updatePromises.push(syncRef.set({ fase: "finalizada_pendente" }, { merge: true }))
      if (corridaRef) updatePromises.push(corridaRef.set({ status: "finalizada_pendente" }, { merge: true }))
      
      if (updatePromises.length > 0) {
        await Promise.all(updatePromises)
      }
    } catch (error) {
      console.error("Erro ao finalizar corrida:", error)
    }
  })

 salvarAvaliacaoBtn?.addEventListener("click", async () => {
    try {
      const comentario = comentarioEl ? comentarioEl.value || "" : ""
      const rating = window.ratingAtual || 0
      
      if (!rating || rating < 1 || rating > 5) {
        alert("Por favor, selecione uma avaliação de 1 a 5 estrelas.");
        return;
      }

      const clienteUid = dadosCorrida?.clienteId || null;
      if (!clienteUid) {
        alert("Erro: ID do cliente não encontrado.");
        return;
      }

      console.log("[AVALIAÇÃO] Salvando:", {
        clienteUid,
        nota: rating,
        corridaId,
        motoristaUid: firebase.auth()?.currentUser?.uid
      });

      // 1. Salvar na subcoleção de avaliações do cliente
      const motoristaUid = firebase.auth()?.currentUser?.uid || null;
      const avId = `${corridaId||'sem'}_${motoristaUid||'anon'}`;
      
      await db.collection('usuarios').doc(clienteUid)
        .collection('avaliacoes').doc(avId)
        .set({ 
          nota: rating, 
          estrelas: rating, 
          comentario: comentario || "", 
          corridaId, 
          agendamentoId: corridaId,
          motoristaUid,
          avaliadoPor: 'motorista',
          criadoEm: firebase.firestore.FieldValue.serverTimestamp() 
        }, { merge: true });

      // 2. Salvar na coleção global de avaliações
      await db.collection('avaliacoes').doc(avId)
        .set({ 
          nota: rating, 
          estrelas: rating, 
          comentario: comentario || "", 
          corridaId,
          agendamentoId: corridaId,
          clienteUid, 
          motoristaUid,
          tipo: 'cliente',
          criadoEm: firebase.firestore.FieldValue.serverTimestamp() 
        }, { merge: true });

      // 3. Atualizar campos agregados usando transação
      const userRef = db.collection('usuarios').doc(clienteUid);
      await db.runTransaction(async (tx) => {
        const userSnap = await tx.get(userRef);
        const userData = userSnap.exists ? (userSnap.data() || {}) : {};
        
        const soma = Number(userData.avaliacaoSoma || 0) + rating;
        const count = Number(userData.avaliacaoCount || 0) + 1;
        const media = soma / count;
        
        tx.set(userRef, { 
          avaliacaoSoma: soma, 
          avaliacaoCount: count, 
          avaliacaoMedia: media,
          // Manter compatibilidade com campos antigos
          ratingSum: soma,
          ratingCount: count,
          ratingMedia: media
        }, { merge: true });
      });

      console.log("[AVALIAÇÃO] ✓ Avaliação salva com sucesso!");
      
      // 4. Atualizar status da corrida
      if (corridaRef) {
        await corridaRef.set({
          avaliacao: {
            nota: rating,
            comentario: comentario,
            avaliadoEm: firebase.firestore.FieldValue.serverTimestamp()
          },
          status: 'finalizada'
        }, { merge: true });
      }
      
      $closeModal()
      
      setTimeout(() => {
        alert('Agendamento finalizado com sucesso!')
        window.location.href = "carteiraM.html"
      }, 500)
    } catch (error) {
      console.error("[AVALIAÇÃO] Erro:", error)
      alert("Erro ao finalizar. Tente novamente.")
    }
  })

  firebase.auth().onAuthStateChanged(async (user) => {
    if(!user){console.error("Usuário não logado.")
    alert("Usuário não logado.")
    return
  }
  
  console.log("Usuário logado:", user.uid)
  
  try {
    const corridaAtiva = await obterCorridaAtiva(user.uid)
    if (!corridaAtiva) {
      console.error("Nenhum agendamento ativo encontrado.")
      alert("Nenhum agendamento ativo encontrado.")
      return
    }
    
    corridaId = corridaAtiva.id
    
    console.log(`Agendamento ativo encontrado: ${corridaId}`)
    
    localStorage.setItem("ultimaCorridaMotorista", corridaId)
    
    if (window.CHAT) {
      window.CHAT.init('motorista');
      window.CHAT.attach(corridaId);
    }

    corridaRef = db.collection('agendamentos').doc(corridaId)
    syncRef = corridaRef.collection("sync").doc("estado")

    if (syncRef) {
      syncRef.set({ fase: "indo_retirar" }, { merge: true }).catch(error => 
        console.error("Erro ao definir fase inicial:", error)
      )
    }

    const unsubscribeCorreda = db.collection('agendamentos')
      .doc(corridaId)
      .onSnapshot(async (doc) => {
        console.log("Snapshot recebido, doc exists:", doc.exists)
        
        if (!doc.exists) {
          console.warn("Documento não existe!")
          return
        }
        
        try {
          const docData = doc.data()
          console.log("Dados do documento:", docData)
          
          if (!docData) {
            console.warn("Documento sem dados!")
            return
          }

          if (docData.status === "cancelado_agendamento" || docData.canceladoPor === "cliente") {
            console.log("🚫 AGENDAMENTO CANCELADO PELO CLIENTE!")
            console.log("Status:", docData.status)
            console.log("Cancelado por:", docData.canceladoPor)
            
            criarModalCancelamento()
            return
          }
          
          dadosCorrida = {
            ...docData,
            clienteNome: docData.clienteNome || dadosCorrida?.clienteNome || null,
            motoristaNome: docData.motoristaNome || dadosCorrida?.motoristaNome || null,
            
            origem: docData.origem || {
              endereco: '',
              lat: null,
              lng: null
            },
            destino: docData.destino || {
              endereco: '',
              lat: null,
              lng: null
            }
          }

          if (!validarCoordenadas(dadosCorrida.origem.lat, dadosCorrida.origem.lng) && docData.origem?.endereco) {
            try {
              const coordsOrigem = await geocodificarEndereco(docData.origem.endereco)
              if (coordsOrigem && validarCoordenadas(coordsOrigem.lat, coordsOrigem.lng)) {
                dadosCorrida.origem = {
                  endereco: docData.origem.endereco,
                  lat: coordsOrigem.lat,
                  lng: coordsOrigem.lng
                }
              }
            } catch (error) {
              console.warn("Erro ao geocodificar origem:", error)
            }
          }

          if (!validarCoordenadas(dadosCorrida.destino.lat, dadosCorrida.destino.lng) && docData.destino?.endereco) {
            try {
              const coordsDestino = await geocodificarEndereco(docData.destino.endereco)
              if (coordsDestino && validarCoordenadas(coordsDestino.lat, coordsDestino.lng)) {
                dadosCorrida.destino = {
                  endereco: docData.destino.endereco,
                  lat: coordsDestino.lat,
                  lng: coordsDestino.lng
                }
              }
            } catch (error) {
              console.warn("Erro ao geocodificar destino:", error)
            }
          }

          console.log("Dados da corrida processados:", dadosCorrida)
          
          if (origemInfoEl) {
            const textoOrigem = dadosCorrida.origem?.endereco || "—"
            origemInfoEl.textContent = textoOrigem
            console.log("Origem atualizada na UI:", textoOrigem)
          }
          
          if (destinoInfoEl) {
            const textoDestino = dadosCorrida.destino?.endereco || "—"
            destinoInfoEl.textContent = textoDestino
            console.log("Destino atualizado na UI:", textoDestino)
          }
          
          {
            let nomeCliente = docData.clienteNome || dadosCorrida.clienteNome || null;
            if (!nomeCliente || nomeCliente.toLowerCase?.() === 'cliente') {
              const resolvido = await resolverNomeCliente({ docData, corridaId });
              if (resolvido) nomeCliente = resolvido;
            }
            if (!nomeCliente) nomeCliente = await obterNome(dadosCorrida.clienteId);
            if (nomeClienteMainEl && nomeCliente) nomeClienteMainEl.textContent = nomeCliente;
            if (nomeClienteModalEl && nomeCliente) nomeClienteModalEl.textContent = nomeCliente;
            console.log("Nome do cliente atualizado:", nomeCliente)
            
            try {
              if (nomeCliente && corridaRef) {
                await corridaRef.set({ clienteNome: nomeCliente }, { merge: true });
              }
            } catch (e) { console.warn('Falha ao persistir clienteNome:', e?.message||e); }
          }

          console.log("Chamando upsertCorridaBase...")
          await upsertCorridaBase()
          
          console.log("Chamando desenharMarcadores...")
          desenharMarcadores()

          if (posMotorista && validarCoordenadas(posMotorista.lat, posMotorista.lng)) {
            console.log("Motorista tem posição válida, verificando rotas...")
            if (fase === "indo_retirar" && dadosCorrida?.origem && validarCoordenadas(dadosCorrida.origem.lat, dadosCorrida.origem.lng)) {
              console.log("Desenhando rota para origem")
              await desenharRota(posMotorista, dadosCorrida.origem)
            } else if (fase === "a_caminho_destino" && dadosCorrida?.origem && dadosCorrida?.destino && 
                      validarCoordenadas(dadosCorrida.origem.lat, dadosCorrida.origem.lng) &&
                      validarCoordenadas(dadosCorrida.destino.lat, dadosCorrida.destino.lng)) {
              console.log("Desenhando rota origem -> destino")
              await desenharRota(dadosCorrida.origem, dadosCorrida.destino)
            }
          } else {
            console.log("Motorista sem posição válida ainda, aguardando geolocalização...")
          }
        } catch (error) {
          console.error("Erro ao processar snapshot:", error)
        }
      }, (error) => {
        console.error("Erro no listener:", error)
      })

    const unsubscribeSync = syncRef.onSnapshot((syncDoc) => {
      try {
        const syncData = syncDoc.data() || {}
        console.log("Dados do sync:", syncData)

        if (syncData.fase === "cancelada" || syncData.cancelamento) {
          console.log("🚫 CANCELAMENTO DETECTADO NO SYNC!")
          console.log("Fase:", syncData.fase)
          console.log("Cancelamento:", syncData.cancelamento)
          
          criarModalCancelamento()
          return
        }

        if (syncData.fase) fase = syncData.fase
        if (syncData.motorista) {
          posMotorista = {
            lat: parseFloat(syncData.motorista.lat),
            lng: parseFloat(syncData.motorista.lng)
          }
          desenharMarcadores()
        }

      } catch (error) {
        console.error("Erro ao processar sync:", error)
      }
    }, (error) => {
      console.error("Erro no listener do sync:", error)
    })

    window.cancelamentoListeners = {
      unsubscribeCorreda,
      unsubscribeSync
    }

    console.log("Iniciando geolocalização...")
    startGeolocation()
    
    if (!posMotorista) {
      map.setView([-23.5505, -46.6333], 12)
    }
    
  } catch (error) {
    console.error("Erro na inicialização:", error)
    alert("Erro ao inicializar o sistema: " + error.message)
  }
})

const style = document.createElement("style")
style.innerHTML = `
  @keyframes pulse { 
    0%{transform:scale(.9);opacity:.7} 
    50%{transform:scale(1.2);opacity:1} 
    100%{transform:scale(.9);opacity:.7} 
  }
  .marker-motorista, .marker-origem, .marker-destino {
    background: transparent !important;
    border: none !important;
  }
  .badge {
    background: #f8f9fa;
    color: #495057;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 11px;
    margin-left: 8px;
  }
  #route-instructions {
    max-height: 200px;
    overflow-y: auto;
  }
  #directionsList li {
    padding: 8px;
    border-bottom: 1px solid #eee;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
`
document.head.appendChild(style)
})()

let ratingAtual = 0
window.ratingAtual = 0

;(() => {
const stars = document.querySelectorAll(".rating-stars .star")
if (!stars || stars.length === 0) return

const forEach = (list, cb) => Array.prototype.forEach.call(list, cb)

forEach(stars, (star, i) => {
  star.addEventListener("click", () => {
    window.ratingAtual = i + 1
    ratingAtual = i + 1
    forEach(stars, (s, j) => {
      if (j < window.ratingAtual) s.classList.add("active")
      else s.classList.remove("active")
    })
  })
})
})()

;(() => {
const { firebase } = window
if (!firebase || !firebase.apps.length) return
const db = firebase.firestore()

function ensureStyles() {
  if (document.getElementById("mm-chat-styles")) return
  const s = document.createElement("style")
  s.id = "mm-chat-styles"
  s.textContent = `
    #openChat{position:fixed;right:16px;bottom:18px;z-index:20000;background:#ff6c0c;color:#fff;
      border:0;border-radius:999px;padding:12px 18px;font-weight:700;box-shadow:0 8px 18px rgba(255,108,12,.35);cursor:pointer}
    .mm-chat-modal{position:fixed;inset:0;background:rgba(0,0,0,.35);display:none;align-items:center;justify-content:center;z-index:20001}
    .mm-chat-card{width:min(720px,92vw);height:min(70vh,720px);background:#fff;border-radius:16px;display:flex;flex-direction:column;box-shadow:0 18px 48px rgba(0,0,0,.25)}
    .mm-chat-hd{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid #eee}
    .mm-chat-title{font-weight:800}
    .mm-chat-list{flex:1;overflow:auto;padding:12px;background:#f8f9fb}
    .mm-row{display:flex;margin:6px 0}
    .mm-row.me{justify-content:flex-end}
    .mm-bub{max-width:75%;padding:10px 12px;border-radius:12px;line-height:1.25;box-shadow:0 2px 6px rgba(0,0,0,.06)}
    .mm-bub.them{background:#fff;border:1px solid #e9ecef}
    .mm-bub.me{background:#ffefe5;border:1px solid #ffd7bf}
    .mm-bub .time{display:block;margin-top:6px;font-size:11px;opacity:.7;text-align:right}
    .mm-ft{display:flex;gap:8px;padding:10px;border-top:1px solid #eee;background:#fff}
    .mm-inp{flex:1;resize:none;height:44px;padding:10px;border:1px solid #ddd;border-radius:10px;outline:none}
    .mm-send{background:#ff6c0c;color:#fff;border:0;border-radius:10px;padding:0 16px;font-weight:700;cursor:pointer}
  `
  document.head.appendChild(s)
}

function ensureModal() {
  if (document.getElementById("mm-chat-modal")) return
  const el = document.createElement("div")
  el.className = "mm-chat-modal"
  el.id = "mm-chat-modal"
  el.innerHTML = `
    <div class="mm-chat-card">
      <div class="mm-chat-hd">
        <div class="mm-chat-title" id="mm-chat-title">Chat</div>
        <button id="mm-chat-close" style="background:none;border:0;font-size:20px;cursor:pointer">✕</button>
      </div>
      <div class="mm-chat-list" id="mm-chat-list"></div>
      <div class="mm-ft">
        <textarea id="mm-chat-text" class="mm-inp" placeholder="Escreva uma mensagem"></textarea>
        <button id="mm-chat-send" class="mm-send">Enviar</button>
      </div>
    </div>`
  document.body.appendChild(el)
}

function ensureButton() {
  let btn = document.getElementById("openChat")
  if (!btn) {
    btn = document.createElement("button")
    btn.id = "openChat"
    btn.textContent = "Chat"
    document.body.appendChild(btn)
  }
  btn.onclick = (e) => { e.preventDefault(); window.CHAT?.open() }
  document.addEventListener("click", (e) => {
    const t = e.target
    if (t?.id === "openChat" || t?.closest?.("#openChat")) {
      e.preventDefault()
      window.CHAT?.open()
    }
  })
}

const esc = (s) => (s || "").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))
const fmtHora = (ts) => {
  try { 
    const d = ts?.toDate ? ts.toDate() : new Date()
    return d.toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"})
  } catch { 
    return "" 
  }
}
const getQS = (k) => new URLSearchParams(location.search).get(k)
const autodCorrida = () =>
  getQS("corrida") || getQS("corridaId") || getQS("id") ||
  localStorage.getItem("ultimaCorridaCliente") ||
  localStorage.getItem("ultimaCorridaMotorista") ||
  localStorage.getItem("corridaSelecionada")

const CHAT = {
  _db: db, _uid: null, _role: "cliente", _corridaId: null, _unsub: () => {},
  
  init(role) {
    ensureStyles()
    ensureModal()
    ensureButton()
    this._role = role || "cliente"
    this._uid = firebase.auth().currentUser?.uid || null

    const closeBtn = document.getElementById("mm-chat-close")
    const sendBtn = document.getElementById("mm-chat-send")
    const textArea = document.getElementById("mm-chat-text")
    
    if (closeBtn) closeBtn.onclick = () => this.close()
    if (sendBtn) sendBtn.onclick = () => this.send()
    if (textArea) {
      textArea.onkeydown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) { 
          e.preventDefault()
          this.send()
        }
      }
    }
  },
  
  attach(id) {
    if (!id || id === this._corridaId) return
    try { 
      this._unsub() 
    } catch (e) { 
      console.error("Erro ao remover listener anterior:", e) 
    }
    this._corridaId = id

    const ttl = document.getElementById("mm-chat-title")
    if (ttl) ttl.textContent = this._role === "motorista" ? "Chat com Cliente" : "Chat com Motorista"

    try {
      const ref = this._db.collection("agendamentos").doc(id).collection("chat").orderBy("ts","asc").limit(500)
      this._unsub = ref.onSnapshot((snap) => {
        const list = document.getElementById("mm-chat-list") 
        if (!list) return
        list.innerHTML = ""
        snap.forEach(d => {
          try {
            const m = d.data() || {}
            const mine = m?.role ? (m.role === this._role) : (m.senderId === this._uid)
            const row = document.createElement("div")
            row.className = "mm-row " + (mine ? "me" : "them")
            row.innerHTML = `<div class="mm-bub ${mine ? "me" : "them"}">
                <div>${esc(m.text || "")}</div>
                <span class="time">${fmtHora(m.ts)}</span>
              </div>`
            list.appendChild(row)
          } catch (e) {
            console.error("Erro ao processar mensagem:", e)
          }
        })
        list.scrollTop = list.scrollHeight
      }, (error) => {
        console.error("Erro no listener do chat:", error)
      })
    } catch (error) {
      console.error("Erro ao anexar chat:", error)
    }
  },
  
  open() {
    ensureStyles()
    ensureModal()
    if (!this._corridaId) this.attach(autodCorrida())
    const modal = document.getElementById("mm-chat-modal")
    if (modal) modal.style.display = "flex"
    setTimeout(() => {
      const textArea = document.getElementById("mm-chat-text")
      if (textArea) textArea.focus()
    }, 0)
  },
  
  close() { 
    const modal = document.getElementById("mm-chat-modal")
    if (modal) modal.style.display = "none"
  },
  
  async send() {
    const txtEl = document.getElementById("mm-chat-text")
    if (!txtEl) return
    
    const text = (txtEl.value || "").trim()
    if (!text || !this._corridaId) return
    
    txtEl.value = ""
    
    try {
      await this._db.collection("agendamentos").doc(this._corridaId).collection("chat").add({
        text, 
        senderId: this._uid, 
        role: this._role, 
        ts: firebase.firestore.FieldValue.serverTimestamp()
      })
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error)
      txtEl.value = text
    }
  }
}

window.CHAT = CHAT

firebase.auth().onAuthStateChanged(() => {
  try {
    const isCliente = /statusA\.html/i.test(location.pathname)
    CHAT.init(isCliente ? "cliente" : "motorista")
    const id = autodCorrida() 
    if (id) CHAT.attach(id)
  } catch (error) {
    console.error("Erro na inicialização do chat:", error)
  }
})
})()