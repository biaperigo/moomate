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
    const doc = await db.collection("motoristas").doc(currentUserId).get();
    
    if (doc.exists) {
      currentUserData = doc.data();
      preencherCampos(currentUserData);
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

    // Exibir Certidão de Nada Consta como imagem no quadrado
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

document.addEventListener("DOMContentLoaded", function () {
  auth.onAuthStateChanged(function(user) {
    if (user) {
      carregarDadosUsuario();
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
  // Certidão de Nada Consta: upload imediato como no foto do veículo
  const inputCertidao = document.getElementById('inputCertidaoNadaConsta');
  if (inputCertidao) {
    inputCertidao.addEventListener('change', async function() {
      const file = this.files && this.files[0];
      if (!file) return;
      try {
        // Preview temporário
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