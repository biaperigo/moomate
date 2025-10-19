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
const auth = firebase.auth();

let currentUserData = null;
let currentUserId = null;

function formatarCPF(cpf) {
  cpf = cpf.replace(/\D/g, "");
  if (cpf.length > 11) cpf = cpf.substring(0, 11);
  cpf = cpf.replace(/(\d{3})(\d)/, "$1.$2");
  cpf = cpf.replace(/(\d{3})(\d)/, "$1.$2");
  cpf = cpf.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  return cpf;
}

function formatarCEP(cep) {
  cep = cep.replace(/\D/g, "");
  if (cep.length > 8) cep = cep.substring(0, 8);
  cep = cep.replace(/(\d{5})(\d)/, "$1-$2");
  return cep;
}

function formatarTelefone(telefone) {
  telefone = telefone.replace(/\D/g, "");
  if (telefone.length > 11) telefone = telefone.substring(0, 11);
  if (telefone.length <= 10) {
    telefone = telefone.replace(/(\d{2})(\d)/, "($1) $2");
    telefone = telefone.replace(/(\d{4})(\d)/, "$1-$2");
  } else {
    telefone = telefone.replace(/(\d{2})(\d)/, "($1) $2");
    telefone = telefone.replace(/(\d{5})(\d)/, "$1-$2");
  }
  return telefone;
}

function formatarRG(rg) {
  rg = rg.replace(/\D/g, "");
  if (rg.length > 9) rg = rg.substring(0, 9);
  rg = rg.replace(/(\d{2})(\d)/, "$1.$2");
  rg = rg.replace(/(\d{3})(\d)/, "$1.$2");
  rg = rg.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  return rg;
}

function formatarPlaca(placa) {
  placa = placa.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (placa.length > 7) placa = placa.substring(0, 7);
  if (placa.length <= 7) {
    placa = placa.replace(/([A-Z]{3})(\d)/, "$1-$2");
  }
  return placa;
}

function formatarCNH(cnh) {
  cnh = cnh.replace(/\D/g, "");
  if (cnh.length > 11) cnh = cnh.substring(0, 11);
  return cnh;
}

function formatarCRLV(crlv) {
  crlv = crlv.replace(/\D/g, "");
  if (crlv.length > 11) crlv = crlv.substring(0, 11);
  return crlv;
}

async function uploadImagemCloudinary(file) {
  if (!file) return null;
  
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', 'moomate');
  formData.append('cloud_name', 'dal3nktmy');

  const response = await fetch('https://api.cloudinary.com/v1_1/dal3nktmy/upload', {
    method: 'POST',
    body: formData
  });

  const data = await response.json();
  if (data.secure_url) {
    return data.secure_url;
  } else {
    throw new Error('Erro ao fazer upload da imagem');
  }
}

// Upload genérico (auto) para suportar PDFs/imagens
async function uploadArquivoCloudinary(file) {
  if (!file) return null;
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', 'moomate');
  formData.append('cloud_name', 'dal3nktmy');
  const response = await fetch('https://api.cloudinary.com/v1_1/dal3nktmy/auto/upload', {
    method: 'POST',
    body: formData
  });
  const data = await response.json();
  if (data.secure_url) return data.secure_url;
  throw new Error('Erro ao fazer upload do arquivo');
}

async function carregarDadosUsuario() {
  try {
    const user = auth.currentUser;
    if (!user) {
      alert('Usuário não autenticado. Redirecionando para login...');
      window.location.href = 'loginM.html';
      return;
    }

    currentUserId = user.uid;
    const [userDoc, ratingsSnapshot] = await Promise.all([
      db.collection("motoristas").doc(currentUserId).get(),
      db.collection("avaliacoes").where("idMotorista", "==", currentUserId).get()
    ]);
    
    if (userDoc.exists) {
      currentUserData = userDoc.data();
      preencherCampos(currentUserData);
      
      // Calcular e exibir a média de avaliações
      if (!ratingsSnapshot.empty) {
        let totalRating = 0;
        let validRatings = 0;
        
        ratingsSnapshot.forEach(doc => {
          const rating = doc.data().nota;
          if (typeof rating === 'number' && rating >= 1 && rating <= 5) {
            totalRating += rating;
            validRatings++;
          }
        });
        
        if (validRatings > 0) {
          const averageRating = totalRating / validRatings;
          updateRatingDisplay(averageRating, validRatings);
        } else {
          updateRatingDisplay(0, 0);
        }
      } else {
        updateRatingDisplay(0, 0);
      }
    } else {
      console.error("Documento do usuário não encontrado");
      alert("Dados do usuário não encontrados.");
    }
  } catch (error) {
    console.error("Erro ao carregar dados do usuário:", error);
    alert("Erro ao carregar dados: " + error.message);
  }
}

function preencherCampos(dados) {

  if (dados.dadosPessoais) {
    document.getElementById('nome').textContent = dados.dadosPessoais.nome || '';
    document.getElementById('dataNascimento').textContent = formatarData(dados.dadosPessoais.dataNascimento) || '';
    document.getElementById('cpf').textContent = dados.dadosPessoais.cpf || '';
    document.getElementById('email').textContent = dados.dadosPessoais.email || '';
    document.getElementById('telefone').textContent = dados.dadosPessoais.telefone || '';
    
    if (dados.dadosPessoais.endereco) {
      document.getElementById('cep').textContent = dados.dadosPessoais.endereco.cep || '';
      document.getElementById('rua').textContent = dados.dadosPessoais.endereco.rua || '';
      document.getElementById('bairro').textContent = dados.dadosPessoais.endereco.bairro || '';
      document.getElementById('cidade').textContent = dados.dadosPessoais.endereco.cidade || '';
      document.getElementById('estado').textContent = dados.dadosPessoais.endereco.estado || '';
    }
    
    if (dados.dadosPessoais.fotoPerfilUrl) {
      document.getElementById('fotoPerfil').src = dados.dadosPessoais.fotoPerfilUrl;
    }
  }
  
  if (dados.dadosPessoais) {
    document.getElementById('rg').textContent = dados.dadosPessoais.rg || '';
    document.getElementById('cnh').textContent = dados.dadosPessoais.cnh || '';

    const certUrl = dados.dadosPessoais.certidaoNadaConstaUrl || '';
    const certImg = document.getElementById('certidaoImg');
    if (certImg && certUrl) {
      certImg.src = certUrl;
    }
  }
  
  if (dados.veiculo) {
    document.getElementById('tipoVeiculo').textContent = formatarTipoVeiculo(dados.veiculo.tipo) || '';
    document.getElementById('placa').textContent = dados.veiculo.placa || '';
    document.getElementById('crlv').textContent = dados.veiculo.crlv || '';
    document.getElementById('ano').textContent = dados.veiculo.ano || '';
    
    if (dados.veiculo.fotoVeiculoUrl) {
      document.getElementById('fotoVeiculo').src = dados.veiculo.fotoVeiculoUrl;
    }
  }
}

function formatarData(dataString) {
  if (!dataString) return '';
  const data = new Date(dataString);
  return data.toLocaleDateString('pt-BR');
}

function formatarTipoVeiculo(tipo) {
  const tipos = {
    'pequeno': 'Caminhão 3/4 (pequeno)',
    'medio': 'Caminhão toco (médio)',
    'grande': 'Caminhão truck (grande)'
  };
  return tipos[tipo] || tipo;
}

function updateRatingDisplay(averageRating, ratingCount) {
  const starsContainer = document.querySelector('.stars');
  const ratingValue = document.querySelector('.rating-value');
  const ratingCountElement = document.querySelector('.rating-count');
  
  // Arredonda para 1 casa decimal
  const roundedRating = Math.round(averageRating * 10) / 10;
  
  // Atualiza o valor numérico
  if (ratingValue) {
    ratingValue.textContent = ratingCount > 0 ? roundedRating.toFixed(1) : '0.0';
  }
  
  // Atualiza a contagem de avaliações
  if (ratingCountElement) {
    ratingCountElement.textContent = ratingCount === 0 ? '(sem avaliações)' : `(${ratingCount} ${ratingCount === 1 ? 'avaliação' : 'avaliações'})`;
  }
  
  // Mantém apenas uma estrela laranja como representação
  if (starsContainer) {
    starsContainer.innerHTML = '<i class="fas fa-star" style="color: #ff6c0c;"></i>';
  }
}

function iniciarEdicao(fieldElement) {
  const displayValue = fieldElement.querySelector('.display-value');
  const editInput = fieldElement.querySelector('.edit-input');
  const editBtn = fieldElement.querySelector('.edit-btn');
  const editActions = fieldElement.querySelector('.edit-actions');

  if (editInput.tagName === 'SELECT') {
    const fieldName = fieldElement.dataset.field;
    if (fieldName === 'tipoVeiculo' && currentUserData && currentUserData.veiculo) {
      editInput.value = currentUserData.veiculo.tipo || '';
    }
  } else if (editInput.tagName === 'TEXTAREA') {
    editInput.value = displayValue.textContent;
  } else {
    editInput.value = displayValue.textContent;
  }
  
  fieldElement.classList.add('editing');
  editBtn.style.display = 'none';
}

function cancelarEdicao(fieldElement) {
  fieldElement.classList.remove('editing');
  const editBtn = fieldElement.querySelector('.edit-btn');
  editBtn.style.display = 'inline-block';
}

async function salvarEdicao(fieldElement) {
  try {
    const fieldName = fieldElement.dataset.field;
    const editInput = fieldElement.querySelector('.edit-input');
    const displayValue = fieldElement.querySelector('.display-value');
    const newValue = editInput.value.trim();
    
    if (!newValue && fieldName !== 'antecedentes') {
      alert('Campo não pode estar vazio');
      return;
    }

    if (!validarCampo(fieldName, newValue)) {
      return;
    }
    const updateData = {};
    
    switch (fieldName) {
      case 'nome':
        updateData['dadosPessoais.nome'] = newValue;
        break;
      case 'dataNascimento':
        updateData['dadosPessoais.dataNascimento'] = newValue;
        break;
      case 'telefone':
        updateData['dadosPessoais.telefone'] = newValue;
        break;
      case 'cep':
        updateData['dadosPessoais.endereco.cep'] = newValue;
        break;
      case 'rua':
        updateData['dadosPessoais.endereco.rua'] = newValue;
        break;
      case 'bairro':
        updateData['dadosPessoais.endereco.bairro'] = newValue;
        break;
      case 'cidade':
        updateData['dadosPessoais.endereco.cidade'] = newValue;
        break;
      case 'estado':
        updateData['dadosPessoais.endereco.estado'] = newValue;
        break;
      case 'rg':
        updateData['dadosPessoais.rg'] = newValue;
        break;
      case 'cnh':
        updateData['dadosPessoais.cnh'] = newValue;
        break;
      case 'antecedentes':
        updateData['dadosPessoais.antecedentes'] = newValue;
        break;
      case 'tipoVeiculo':
        updateData['veiculo.tipo'] = newValue;
        break;
      case 'placa':
        updateData['veiculo.placa'] = newValue;
        break;
      case 'crlv':
        updateData['veiculo.crlv'] = newValue;
        break;
      case 'ano':
        updateData['veiculo.ano'] = newValue;
        break;
    }
    
    await db.collection("motoristas").doc(currentUserId).update(updateData);
    
    if (fieldName === 'tipoVeiculo') {
      displayValue.textContent = formatarTipoVeiculo(newValue);
    } else if (fieldName === 'dataNascimento') {
      displayValue.textContent = formatarData(newValue);
    } else {
      displayValue.textContent = newValue;
    }
    
    cancelarEdicao(fieldElement);
    
    console.log('Campo atualizado com sucesso:', fieldName);
    
  } catch (error) {
    console.error('Erro ao salvar:', error);
    alert('Erro ao salvar alterações: ' + error.message);
  }
}

function validarCampo(fieldName, value) {
  switch (fieldName) {
    case 'nome':
      if (value.length < 3) {
        alert('Nome deve ter pelo menos 3 caracteres');
        return false;
      }
      break;
    case 'telefone':
      const numeros = value.replace(/\D/g, "");
      if (numeros.length < 10 || numeros.length > 11) {
        alert('Telefone inválido');
        return false;
      }
      break;
    case 'cep':
      if (!/^\d{5}-?\d{3}$/.test(value)) {
        alert('CEP inválido');
        return false;
      }
      break;
    case 'cnh':
      if (value.replace(/\D/g, "").length !== 11) {
        alert('CNH deve ter 11 dígitos');
        return false;
      }
      break;
    case 'crlv':
      if (value.replace(/\D/g, "").length !== 11) {
        alert('CRLV deve ter 11 dígitos');
        return false;
      }
      break;
    case 'ano':
      const ano = parseInt(value);
      const anoAtual = new Date().getFullYear();
      if (ano < 1900 || ano > anoAtual + 1) {
        alert('Ano do veículo inválido');
        return false;
      }
      break;
  }
  return true;
}
async function handleImageUpload(inputElement, imageElement, isProfile = false) {
  const file = inputElement.files[0];
  if (!file) return;
  
  try {
    const reader = new FileReader();
    reader.onload = function(e) {
      const previewId = isProfile ? 'previewFotoPerfil' : 'previewFotoVeiculo';
      const preview = document.getElementById(previewId);
      preview.src = e.target.result;
      preview.style.display = 'block';
    };
    reader.readAsDataURL(file);
    
    const imageUrl = await uploadImagemCloudinary(file);
    
    if (imageUrl) {
      const updateData = {};
      if (isProfile) {
        updateData['dadosPessoais.fotoPerfilUrl'] = imageUrl;
      } else {
        updateData['veiculo.fotoVeiculoUrl'] = imageUrl;
      }
      
      await db.collection("motoristas").doc(currentUserId).update(updateData);
      

      imageElement.src = imageUrl;
      
      const previewId = isProfile ? 'previewFotoPerfil' : 'previewFotoVeiculo';
      const preview = document.getElementById(previewId);
      preview.style.display = 'none';
      
      console.log('Imagem atualizada com sucesso');
    }
    
  } catch (error) {
    console.error('Erro ao fazer upload da imagem:', error);
    alert('Erro ao fazer upload da imagem: ' + error.message);
  }
}

// Global variables for helpers management
let helpers = [];
let currentHelperIndex = -1;
let currentHelperPhotoFile = null;

// DOM elements
const helpersList = document.getElementById('helpersList');
const addHelperBtn = document.getElementById('addHelperBtn');
const helperModal = document.getElementById('helperModal');
const closeModal = document.querySelector('.close-modal');
const cancelHelperBtn = document.getElementById('cancelHelperBtn');
const saveHelperBtn = document.getElementById('saveHelperBtn');
const helperNameInput = document.getElementById('helperName');
const helperCpfInput = document.getElementById('helperCpf');
const helperPhotoInput = document.getElementById('helperPhotoInput');
const helperPhotoPreview = document.getElementById('helperPhotoPreview');
const modalTitle = document.getElementById('modalTitle');

// Format CPF input
helperCpfInput.addEventListener('input', function(e) {
  let value = e.target.value.replace(/\D/g, '');
  if (value.length > 11) value = value.substring(0, 11);
  value = value.replace(/(\d{3})(\d)/, '$1.$2');
  value = value.replace(/(\d{3})(\d)/, '$1.$2');
  value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  e.target.value = value;
});

// Handle helper photo upload
helperPhotoInput.addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (file) {
    if (file.size > 5 * 1024 * 1024) {
      alert('A imagem não pode ter mais que 5MB');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = function(event) {
      helperPhotoPreview.src = event.target.result;
      currentHelperPhotoFile = file;
    };
    reader.readAsDataURL(file);
  }
});

// Open modal to add new helper
addHelperBtn.addEventListener('click', () => {
  currentHelperIndex = -1;
  modalTitle.textContent = 'Adicionar Ajudante';
  helperNameInput.value = '';
  helperCpfInput.value = '';
  helperPhotoPreview.src = 'src/images/default-avatar.png';
  currentHelperPhotoFile = null;
  helperModal.style.display = 'flex';
});

// Close modal
closeModal.addEventListener('click', () => {
  helperModal.style.display = 'none';
});

cancelHelperBtn.addEventListener('click', () => {
  helperModal.style.display = 'none';
});

// Save helper
saveHelperBtn.addEventListener('click', async () => {
  const name = helperNameInput.value.trim();
  const cpf = helperCpfInput.value.trim();
  
  if (!name) {
    alert('Por favor, informe o nome do ajudante');
    return;
  }
  
  if (!cpf || cpf.length < 14) {
    alert('Por favor, informe um CPF válido');
    return;
  }
  
  let photoUrl = '';
  
  // Upload photo if a new one was selected
  if (currentHelperPhotoFile) {
    try {
      photoUrl = await uploadImagemCloudinary(currentHelperPhotoFile);
    } catch (error) {
      console.error('Erro ao fazer upload da foto:', error);
      alert('Erro ao fazer upload da foto. Tente novamente.');
      return;
    }
  } else if (currentHelperIndex >= 0 && helpers[currentHelperIndex]) {
    // Keep the existing photo if editing and no new photo was selected
    photoUrl = helpers[currentHelperIndex].fotoPerfilUrl || '';
  }
  
  const helperData = {
    nome: name,
    cpf: cpf,
    fotoPerfilUrl: photoUrl,
    dataAtualizacao: new Date().toISOString()
  };
  
  if (currentHelperIndex >= 0) {
    // Update existing helper
    helpers[currentHelperIndex] = helperData;
  } else {
    // Add new helper
    helpers.push(helperData);
  }
  
  // Save to Firestore
  await salvarAjudantes();
  
  // Update UI
  renderHelpers();
  helperModal.style.display = 'none';
});

// Render helpers list
function renderHelpers() {
  helpersList.innerHTML = '';
  
  if (helpers.length === 0) {
    helpersList.innerHTML = '<p class="no-helpers">Nenhum ajudante cadastrado. Clique no botão abaixo para adicionar.</p>';
    return;
  }
  
  helpers.forEach((helper, index) => {
    const helperElement = document.createElement('div');
    helperElement.className = 'helper-card';
    helperElement.innerHTML = `
      <img src="${helper.fotoPerfilUrl || 'src/images/default-avatar.png'}" alt="${helper.nome}" class="helper-photo">
      <div class="helper-info">
        <div class="helper-name">${helper.nome}</div>
        <div class="helper-cpf">${helper.cpf || 'CPF não informado'}</div>
      </div>
      <div class="helper-actions">
        <button class="edit-helper" data-index="${index}" title="Editar">
          <i class="fa-solid fa-pen"></i>
        </button>
        <button class="delete-helper" data-index="${index}" title="Excluir">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    `;
    
    helpersList.appendChild(helperElement);
  });
  
  // Add event listeners for edit and delete buttons
  document.querySelectorAll('.edit-helper').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const index = parseInt(btn.getAttribute('data-index'));
      editarAjudante(index);
    });
  });
  
  document.querySelectorAll('.delete-helper').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const index = parseInt(btn.getAttribute('data-index'));
      if (confirm('Tem certeza que deseja remover este ajudante?')) {
        helpers.splice(index, 1);
        await salvarAjudantes();
        renderHelpers();
      }
    });
  });
}

// Edit helper
function editarAjudante(index) {
  const helper = helpers[index];
  if (!helper) return;
  
  currentHelperIndex = index;
  modalTitle.textContent = 'Editar Ajudante';
  helperNameInput.value = helper.nome || '';
  helperCpfInput.value = helper.cpf || '';
  helperPhotoPreview.src = helper.fotoPerfilUrl || 'src/images/default-avatar.png';
  currentHelperPhotoFile = null;
  helperModal.style.display = 'flex';
}

// Save helpers to Firestore
async function salvarAjudantes() {
  if (!currentUserId) return;
  
  try {
    await db.collection('motoristas').doc(currentUserId).update({
      'ajudantes': helpers
    });
  } catch (error) {
    console.error('Erro ao salvar ajudantes:', error);
    throw error;
  }
}

// Load helpers from Firestore
async function carregarAjudantes() {
  if (!currentUserId) return;
  
  try {
    const doc = await db.collection('motoristas').doc(currentUserId).get();
    if (doc.exists) {
      const data = doc.data();
      if (data.ajudantes && Array.isArray(data.ajudantes)) {
        helpers = data.ajudantes;
        renderHelpers();
      }
    }
  } catch (error) {
    console.error('Erro ao carregar ajudantes:', error);
  }
}

// Load user data from Firestore
async function carregarDadosUsuario() {
  const user = auth.currentUser;
  if (!user) return;

  currentUserId = user.uid;
  const userRef = db.collection('motoristas').doc(currentUserId);

  userRef.get().then((doc) => {
    if (doc.exists) {
      currentUserData = doc.data();
      preencherCampos(currentUserData);
      
      // Atualiza a exibição da avaliação média
      const ratingData = {
        averageRating: currentUserData.avaliacaoMedia || 0,
        ratingCount: currentUserData.avaliacaoCount || 0
      };
      updateRatingDisplay(ratingData.averageRating, ratingData.ratingCount);
    }
  }).catch((error) => {
    console.error("Erro ao carregar dados do usuário:", error);
  });
}

document.addEventListener("DOMContentLoaded", function () {
  auth.onAuthStateChanged(function(user) {
    if (user) {
      carregarDadosUsuario();
      carregarAjudantes();
    } else {
      window.location.href = 'loginM.html';
    }
  });
  
  document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const fieldElement = this.closest('.editable-field');
      if (fieldElement) {
        iniciarEdicao(fieldElement);
      }
    });
  });
  
  document.querySelectorAll('.save-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const fieldElement = this.closest('.editable-field');
      if (fieldElement) {
        salvarEdicao(fieldElement);
      }
    });
  });
  
  document.querySelectorAll('.cancel-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const fieldElement = this.closest('.editable-field');
      if (fieldElement) {
        cancelarEdicao(fieldElement);
      }
    });
  });
  
  const inputFotoPerfil = document.getElementById('inputFotoPerfil');
  const inputFotoVeiculo = document.getElementById('inputFotoVeiculo');
  const fotoPerfil = document.getElementById('fotoPerfil');
  const fotoVeiculo = document.getElementById('fotoVeiculo');
  
  if (inputFotoPerfil) {
    inputFotoPerfil.addEventListener('change', function() {
      handleImageUpload(this, fotoPerfil, true);
    });
  }
  
  if (inputFotoVeiculo) {
    inputFotoVeiculo.addEventListener('change', function() {
      handleImageUpload(this, fotoVeiculo, false);
    });
  }
  const inputCertidao = document.getElementById('inputCertidaoNadaConsta');
  if (inputCertidao) {
    inputCertidao.addEventListener('change', async function() {
      const file = this.files && this.files[0];
      if (!file) return;
      try {

        try {
          const reader = new FileReader();
          reader.onload = function(e){
            const prev = document.getElementById('previewCertidao');
            if (prev) { prev.src = e.target.result; prev.style.display = 'block'; }
          };
          reader.readAsDataURL(file);
        } catch {}

        const url = await uploadArquivoCloudinary(file);
        await db.collection('motoristas').doc(currentUserId).update({
          'dadosPessoais.certidaoNadaConstaUrl': url
        });
        const img = document.getElementById('certidaoImg');
        if (img) img.src = url;
        const prev = document.getElementById('previewCertidao');
        if (prev) prev.style.display = 'none';
        this.value = '';
        console.log('Certidão de Nada Consta atualizada com sucesso');
      } catch (e) {
        console.error('Erro ao enviar certidão:', e);
        alert('Erro ao enviar Certidão de Nada Consta: ' + (e?.message||e));
      }
    });
  }
  
  document.addEventListener('input', function(e) {
    if (e.target.classList.contains('edit-input')) {
      const fieldElement = e.target.closest('.editable-field');
      const fieldName = fieldElement.dataset.field;
      
      switch (fieldName) {
        case 'telefone':
          e.target.value = formatarTelefone(e.target.value);
          break;
        case 'cep':
          e.target.value = formatarCEP(e.target.value);
          break;
        case 'rg':
          e.target.value = formatarRG(e.target.value);
          break;
        case 'placa':
          e.target.value = formatarPlaca(e.target.value);
          break;
        case 'cnh':
          e.target.value = formatarCNH(e.target.value);
          break;
        case 'crlv':
          e.target.value = formatarCRLV(e.target.value);
          break;
      }
    }
  });
  const menuToggle = document.getElementById('menuToggle');
  const navMenu = document.getElementById('navMenu');
  
  if (menuToggle && navMenu) {
    menuToggle.addEventListener('click', function() {
      navMenu.classList.toggle('active');
    });
  }
});