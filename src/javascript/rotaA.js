(() => {
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
  const fecharModalBtn = pick("close-user-modal")
  const comentarioEl = pick("user-rating-comment")

  const $openModal = () => modal && (modal.style.display = "flex")
  const $closeModal = () => modal && (modal.style.display = "none")
  
  if (fecharModalBtn) fecharModalBtn.addEventListener("click", $closeModal)

  if (!window.firebase) {
    console.error("Firebase não está carregado!")
    return
  }

  const firebase = window.firebase
  const db = firebase.firestore()
  let agendamentoId = null
  let dadosAgendamento = null
  let agendamentoRef = null
  let syncRef = null

  async function resolverNomeCliente({ docData, agendamentoId }) {
    try {
      let nome = docData?.clienteNome || dadosAgendamento?.clienteNome || null
      if (nome && typeof nome === 'string' && nome.trim() && nome.toLowerCase() !== 'cliente') return nome

      if (docData?.clienteId) {
        const uNome = await obterNome(docData.clienteId)
        if (uNome && uNome !== '—') return uNome
      }
    } catch {}
    return null
  }

  function criarModalCancelamento() {
    console.log("🚨 CRIANDO MODAL DE CANCELAMENTO")
    
    let modal = document.getElementById('client-cancel-modal')
    if (modal) modal.remove()

    modal = document.createElement('div')
    modal.id = 'client-cancel-modal'
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
    `
    
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
    `

    document.body.appendChild(modal)

    const okBtn = document.getElementById('ok-cancel-btn')
    if (okBtn) {
      okBtn.addEventListener('click', () => {
        localStorage.removeItem("ultimaCorridaMotorista")
        localStorage.removeItem("corridaSelecionada")
        
        if (window.cancelamentoListeners) {
          try {
            window.cancelamentoListeners.unsubscribeAgendamento()
            window.cancelamentoListeners.unsubscribeSync()
          } catch (e) {
            console.log("Erro ao limpar listeners:", e)
          }
        }
        
        window.location.href = "homeM.html"
      })
    }

    setTimeout(() => {
      if (document.getElementById('client-cancel-modal')) {
        okBtn?.click()
      }
    }, 10000)
  }

  function validarCoordenadas(lat, lng) {
    if (lat === null || lng === null || lat === undefined || lng === undefined) return false
    
    const latNum = parseFloat(lat)
    const lngNum = parseFloat(lng)
    
    if (isNaN(latNum) || isNaN(lngNum)) return false
    if (latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) return false
    if (latNum < -25.50 || latNum > -19.50 || lngNum < -53.50 || lngNum > -44.00) return false
    
    return true
  }

  async function geocodificarEndereco(endereco) {
    if (!endereco || typeof endereco !== 'string') return null

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)
    
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(endereco + ', São Paulo, SP, Brasil')}&addressdetails=1&limit=1&countrycodes=br`
      const response = await fetch(url, { 
        signal: controller.signal,
        headers: {
          'User-Agent': 'MoomateApp/1.0'
        }
      })
      clearTimeout(timeoutId)
      
      if (!response.ok) return null
      
      const data = await response.json()
      if (data && data.length > 0) {
        const result = data[0]
        const lat = parseFloat(result.lat)
        const lng = parseFloat(result.lon)

        if (validarCoordenadas(lat, lng)) {
          return { lat, lng, endereco: result.display_name }
        }
      }
    } catch (error) {
      clearTimeout(timeoutId)
      console.warn("Erro ao geocodificar:", error)
    }

    return null
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

  async function obterAgendamentoAtivo(uid) {
    try {
      const ultimo = localStorage.getItem("ultimaCorridaMotorista")
      if (ultimo) {
        try {
          let d = await db.collection("agendamentos").doc(ultimo).get()
          if (d.exists) {
            const data = d.data()
            if (data && data.status && !["finalizada", "cancelada", "cancelado_agendamento"].includes(data.status)) {
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

    if (dadosAgendamento?.origem && validarCoordenadas(dadosAgendamento.origem.lat, dadosAgendamento.origem.lng)) {
      const origemIcon = `<div style="width:22px;height:22px;background:#1E3A8A;border:3px solid #fff;border-radius:50%;"></div>`
      
      if (!origemMarker) {
        origemMarker = L.marker([dadosAgendamento.origem.lat, dadosAgendamento.origem.lng], {
          icon: L.divIcon({
            className: "marker-origem",
            html: origemIcon,
          }),
        }).addTo(map)
      } else {
        origemMarker.setLatLng([dadosAgendamento.origem.lat, dadosAgendamento.origem.lng])
      }
    }

    if (fase === "a_caminho_destino" && dadosAgendamento?.destino && validarCoordenadas(dadosAgendamento.destino.lat, dadosAgendamento.destino.lng)) {
      const destinoIcon = `<div style="width:22px;height:22px;background:#FF6C0C;border:3px solid #fff;border-radius:50%;"></div>`
      
      if (!destinoMarker) {
        destinoMarker = L.marker([dadosAgendamento.destino.lat, dadosAgendamento.destino.lng], {
          icon: L.divIcon({
            className: "marker-destino",
            html: destinoIcon,
          }),
        }).addTo(map)
      } else {
        destinoMarker.setLatLng([dadosAgendamento.destino.lat, dadosAgendamento.destino.lng])
      }
    }
  }

  const getTexto = (el) => (el && el.textContent && el.textContent.trim()) || ""

  async function upsertAgendamentoBase() {
    if (!agendamentoRef || !dadosAgendamento) return
    
    try {
      const snap = await agendamentoRef.get()
      const base = snap.exists ? (snap.data() || {}) : {}

      const payload = {}
      if (dadosAgendamento?.clienteId) payload.clienteId = dadosAgendamento.clienteId
      if (dadosAgendamento?.motoristaId) payload.motoristaId = dadosAgendamento.motoristaId

      if (dadosAgendamento?.origem) {
        if (validarCoordenadas(dadosAgendamento.origem.lat, dadosAgendamento.origem.lng)) {
          payload.origem = {
            lat: parseFloat(dadosAgendamento.origem.lat),
            lng: parseFloat(dadosAgendamento.origem.lng),
            endereco: dadosAgendamento.origem.endereco || getTexto(origemInfoEl) || base?.origem?.endereco || "",
          }
        }
        else if (dadosAgendamento.origem.endereco && typeof dadosAgendamento.origem.endereco === 'string' && dadosAgendamento.origem.endereco.trim()) {
          try {
            console.log("Geocodificando origem:", dadosAgendamento.origem.endereco)
            const coords = await geocodificarEndereco(dadosAgendamento.origem.endereco)
            if (coords && validarCoordenadas(coords.lat, coords.lng)) {
              payload.origem = {
                lat: parseFloat(coords.lat),
                lng: parseFloat(coords.lng),
                endereco: dadosAgendamento.origem.endereco,
              }
              dadosAgendamento.origem = payload.origem
              console.log("Origem geocodificada:", payload.origem)
            }
          } catch (error) {
            console.warn("Erro ao geocodificar origem:", error.message)
          }
        }
      }

      if (dadosAgendamento?.destino) {
        if (validarCoordenadas(dadosAgendamento.destino.lat, dadosAgendamento.destino.lng)) {
          payload.destino = {
            lat: parseFloat(dadosAgendamento.destino.lat),
            lng: parseFloat(dadosAgendamento.destino.lng),
            endereco: dadosAgendamento.destino.endereco || getTexto(destinoInfoEl) || base?.destino?.endereco || "",
          }
        }
        else if (dadosAgendamento.destino.endereco && typeof dadosAgendamento.destino.endereco === 'string' && dadosAgendamento.destino.endereco.trim()) {
          try {
            console.log("Geocodificando destino:", dadosAgendamento.destino.endereco)
            const coords = await geocodificarEndereco(dadosAgendamento.destino.endereco)
            if (coords && validarCoordenadas(coords.lat, coords.lng)) {
              payload.destino = {
                lat: parseFloat(coords.lat),
                lng: parseFloat(coords.lng),
                endereco: dadosAgendamento.destino.endereco,
              }
              dadosAgendamento.destino = payload.destino
              console.log("Destino geocodificado:", payload.destino)
            }
          } catch (error) {
            console.warn("Erro ao geocodificar destino:", error.message)
          }
        }
      }
      
      if (!base.status) payload.status = "indo_retirar"

      if (Object.keys(payload).length) {
        await agendamentoRef.set(payload, { merge: true })
      }
    } catch (error) {
      console.error("Erro ao atualizar agendamento base:", error)
    }
  }

  function publicarPosicao(lat, lng, heading) {
    if (!validarCoordenadas(lat, lng)) {
      console.warn("Coordenadas inválidas para posição do motorista:", { lat, lng })
      return
    }

    posMotorista = { lat: parseFloat(lat), lng: parseFloat(lng) }
    desenharMarcadores()
    
    if (fase === "indo_retirar" && dadosAgendamento?.origem && validarCoordenadas(dadosAgendamento.origem.lat, dadosAgendamento.origem.lng)) {
      desenharRota(posMotorista, dadosAgendamento.origem).catch(error => 
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
    if (!dadosAgendamento) return
    
    try {
      fase = "a_caminho_destino"
      if (routeLayer) map.removeLayer(routeLayer)
      desenharMarcadores()
      
      if (dadosAgendamento.origem && dadosAgendamento.destino && 
          validarCoordenadas(dadosAgendamento.origem.lat, dadosAgendamento.origem.lng) &&
          validarCoordenadas(dadosAgendamento.destino.lat, dadosAgendamento.destino.lng)) {
        await desenharRota(dadosAgendamento.origem, dadosAgendamento.destino)
      }
      
      btnTudoPronto.style.display = "none"
      if (btnFinalizar) btnFinalizar.style.display = "inline-block"

      const updatePromises = []
      if (syncRef) {
        const payload = { fase: "a_caminho_destino" }
        if (dadosAgendamento?.origem && validarCoordenadas(dadosAgendamento.origem.lat, dadosAgendamento.origem.lng)) {
          payload.origem = {
            lat: parseFloat(dadosAgendamento.origem.lat),
            lng: parseFloat(dadosAgendamento.origem.lng),
            endereco: dadosAgendamento.origem.endereco || ''
          }
        }
        if (dadosAgendamento?.destino && validarCoordenadas(dadosAgendamento.destino.lat, dadosAgendamento.destino.lng)) {
          payload.destino = {
            lat: parseFloat(dadosAgendamento.destino.lat),
            lng: parseFloat(dadosAgendamento.destino.lng),
            endereco: dadosAgendamento.destino.endereco || ''
          }
        }
        updatePromises.push(syncRef.set(payload, { merge: true }))
      }
      if (agendamentoRef) updatePromises.push(agendamentoRef.set({ status: "a_caminho_destino" }, { merge: true }))
      
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
      if (agendamentoRef) updatePromises.push(agendamentoRef.set({ status: "finalizada_pendente" }, { merge: true }))
      
      if (updatePromises.length > 0) {
        await Promise.all(updatePromises)
      }
    } catch (error) {
      console.error("Erro ao finalizar agendamento:", error)
    }
  })

  salvarAvaliacaoBtn?.addEventListener("click", async () => {
    try {
      const comentario = comentarioEl ? comentarioEl.value || "" : ""
      const rating = window.ratingAtual || 0
      
      if (agendamentoRef && rating > 0) {
        await agendamentoRef.set({
          avaliacao: {
            nota: rating,
            comentario: comentario,
            avaliadoEm: firebase.firestore.FieldValue.serverTimestamp()
          },
          status: 'finalizada'
        }, { merge: true })
        
        try {
          const clienteUid = dadosAgendamento?.clienteId || null
          if (clienteUid) {
            const userRef = db.collection('usuarios').doc(clienteUid)
            const motId = firebase.auth()?.currentUser?.uid || null
            let motNome = null
            
            if (motId) {
              try {
                const mSnap = await db.collection('motoristas').doc(motId).get()
                const m = mSnap.exists ? (mSnap.data() || {}) : {}
                motNome = m.nome || m.dadosPessoais?.nome || null
              } catch {}
              
              const contRef = userRef.collection('avaliacoes').doc(motId)
              await contRef.collection('avaliacoes').add({
                agendamentoId: agendamentoId,
                motoristaId: motId,
                motoristaNome: motNome || null,
                nota: rating,
                comentario: comentario,
                avaliadoPor: 'motorista',
                criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
              })
              
              await contRef.set({
                motoristaId: motId,
                motoristaNome: motNome || null,
                lastNota: rating,
                lastComentario: comentario || '',
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
              }, { merge: true })
            }
            
            await userRef.set({
              ratingCount: firebase.firestore.FieldValue.increment(1),
              ratingSum: firebase.firestore.FieldValue.increment(Number(rating) || 0)
            }, { merge: true })
            
            try {
              const aggSnap = await userRef.get()
              const d = aggSnap.exists ? (aggSnap.data() || {}) : {}
              const count = Number(d.ratingCount || 0)
              const sum = Number(d.ratingSum || 0)
              const media = count > 0 ? (sum / count) : 0
              await userRef.set({ ratingMedia: media }, { merge: true })
            } catch {}
          }
        } catch (e) {
          console.warn('Falha ao salvar avaliação no perfil do cliente:', e?.message || e)
        }
      }
      
      $closeModal()
      
      setTimeout(() => {
        alert('Agendamento finalizado com sucesso!')
        window.location.href = "carteiraM.html"
      }, 500)
    } catch (error) {
      console.error("Erro ao salvar avaliação:", error)
      alert("Erro ao finalizar. Tente novamente.")
    }
  })

  firebase.auth().onAuthStateChanged(async (user) => {
    if (!user) {
      console.error("Usuário não logado.")
      alert("Usuário não logado.")
      return
    }
    
    console.log("Usuário logado:", user.uid)
    
    try {
      const agendamentoAtivo = await obterAgendamentoAtivo(user.uid)
      if (!agendamentoAtivo) {
        console.error("Nenhum agendamento ativo encontrado.")
        alert("Nenhum agendamento ativo encontrado.")
        return
      }
      
      agendamentoId = agendamentoAtivo.id
      console.log(`Agendamento ativo encontrado: ${agendamentoId}`)
      
      localStorage.setItem("ultimaCorridaMotorista", agendamentoId)
      
      if (window.CHAT) {
        window.CHAT.init('motorista')
        window.CHAT.attach(agendamentoId)
      }

      agendamentoRef = db.collection('agendamentos').doc(agendamentoId)
      syncRef = agendamentoRef.collection("sync").doc("estado")

      if (syncRef) {
        syncRef.set({ fase: "indo_retirar" }, { merge: true }).catch(error => 
          console.error("Erro ao definir fase inicial:", error)
        )
      }

      const unsubscribeAgendamento = agendamentoRef.onSnapshot(async (doc) => {
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
            console.log("🚨 AGENDAMENTO CANCELADO PELO CLIENTE DETECTADO!")
            criarModalCancelamento()
            return
          }
          
          dadosAgendamento = {
            ...docData,
            clienteId: docData.clienteId,
            motoristaId: docData.motoristaId || docData.propostaAceita?.motoristaUid || user.uid,
            clienteNome: docData.clienteNome || dadosAgendamento?.clienteNome || null,
            motoristaNome: docData.motoristaNome || dadosAgendamento?.motoristaNome || null,
            origem: docData.origem || {
              endereco: docData.localRetirada || '',
              lat: null,
              lng: null
            },
            destino: docData.destino || {
              endereco: docData.localEntrega || '',
              lat: null,
              lng: null
            }
          }

          if (!validarCoordenadas(dadosAgendamento.origem.lat, dadosAgendamento.origem.lng) && 
              dadosAgendamento.origem.endereco) {
            try {
              const coordsOrigem = await geocodificarEndereco(dadosAgendamento.origem.endereco)
              if (coordsOrigem && validarCoordenadas(coordsOrigem.lat, coordsOrigem.lng)) {
                dadosAgendamento.origem = {
                  endereco: dadosAgendamento.origem.endereco,
                  lat: coordsOrigem.lat,
                  lng: coordsOrigem.lng
                }
              }
            } catch (error) {
              console.warn("Erro ao geocodificar origem:", error)
            }
          }

          if (!validarCoordenadas(dadosAgendamento.destino.lat, dadosAgendamento.destino.lng) && 
              dadosAgendamento.destino.endereco) {
            try {
              const coordsDestino = await geocodificarEndereco(dadosAgendamento.destino.endereco)
              if (coordsDestino && validarCoordenadas(coordsDestino.lat, coordsDestino.lng)) {
                dadosAgendamento.destino = {
                  endereco: dadosAgendamento.destino.endereco,
                  lat: coordsDestino.lat,
                  lng: coordsDestino.lng
                }
              }
            } catch (error) {
              console.warn("Erro ao geocodificar destino:", error)
            }
          }

          console.log("Dados do agendamento processados:", dadosAgendamento)
          
          if (origemInfoEl) {
            const textoOrigem = dadosAgendamento.origem?.endereco || "—"
            origemInfoEl.textContent = textoOrigem
            console.log("Origem atualizada na UI:", textoOrigem)
          }
          
          if (destinoInfoEl) {
            const textoDestino = dadosAgendamento.destino?.endereco || "—"
            destinoInfoEl.textContent = textoDestino
            console.log("Destino atualizado na UI:", textoDestino)
          }
          
          {
            let nomeCliente = docData.clienteNome || dadosAgendamento.clienteNome || null
            if (!nomeCliente || nomeCliente.toLowerCase?.() === 'cliente') {
              const resolvido = await resolverNomeCliente({ docData, agendamentoId })
              if (resolvido) nomeCliente = resolvido
            }
            if (!nomeCliente) nomeCliente = await obterNome(dadosAgendamento.clienteId)
            if (nomeClienteMainEl && nomeCliente) nomeClienteMainEl.textContent = nomeCliente
            if (nomeClienteModalEl && nomeCliente) nomeClienteModalEl.textContent = nomeCliente
            console.log("Nome do cliente atualizado:", nomeCliente)
            
            try {
              if (nomeCliente && agendamentoRef) {
                await agendamentoRef.set({ clienteNome: nomeCliente }, { merge: true })
              }
            } catch (e) { 
              console.warn('Falha ao persistir clienteNome:', e?.message || e) 
            }
          }

          console.log("Chamando upsertAgendamentoBase...")
          await upsertAgendamentoBase()
          
          console.log("Chamando desenharMarcadores...")
          desenharMarcadores()

          if (posMotorista && validarCoordenadas(posMotorista.lat, posMotorista.lng)) {
            console.log("Motorista tem posição válida, verificando rotas...")
            if (fase === "indo_retirar" && dadosAgendamento?.origem && validarCoordenadas(dadosAgendamento.origem.lat, dadosAgendamento.origem.lng)) {
              console.log("Desenhando rota para origem")
              await desenharRota(posMotorista, dadosAgendamento.origem)
            } else if (fase === "a_caminho_destino" && dadosAgendamento?.origem && dadosAgendamento?.destino && 
                      validarCoordenadas(dadosAgendamento.origem.lat, dadosAgendamento.origem.lng) &&
                      validarCoordenadas(dadosAgendamento.destino.lat, dadosAgendamento.destino.lng)) {
              console.log("Desenhando rota origem -> destino")
              await desenharRota(dadosAgendamento.origem, dadosAgendamento.destino)
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
            console.log("🚨 CANCELAMENTO DETECTADO NO SYNC!")
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
        unsubscribeAgendamento,
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
  const autodAgendamento = () =>
    getQS("corrida") || getQS("corridaId") || getQS("agendamento") || getQS("id") ||
    localStorage.getItem("ultimaCorridaCliente") ||
    localStorage.getItem("ultimaCorridaMotorista") ||
    localStorage.getItem("corridaSelecionada")

  const CHAT = {
    _db: db, _uid: null, _role: "cliente", _agendamentoId: null, _unsub: () => {},
    
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
      if (!id || id === this._agendamentoId) return
      try { 
        this._unsub() 
      } catch (e) { 
        console.error("Erro ao remover listener anterior:", e) 
      }
      this._agendamentoId = id

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
      if (!this._agendamentoId) this.attach(autodAgendamento())
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
      if (!text || !this._agendamentoId) return
      
      txtEl.value = ""
      
      try {
        await this._db.collection("agendamentos").doc(this._agendamentoId).collection("chat").add({
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
      const id = autodAgendamento() 
      if (id) CHAT.attach(id)
    } catch (error) {
      console.error("Erro na inicialização do chat:", error)
    }
  })
})()