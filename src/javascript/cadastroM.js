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
// formatação
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

// validação
function validarCPF(cpf) {
  cpf = cpf.replace(/\D/g, "");
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  let soma = 0;
  for (let i = 0; i < 9; i++) soma += parseInt(cpf.charAt(i)) * (10 - i);
  let resto = 11 - (soma % 11);
  if (resto >= 10) resto = 0;
  if (resto !== parseInt(cpf.charAt(9))) return false;

  soma = 0;
  for (let i = 0; i < 10; i++) soma += parseInt(cpf.charAt(i)) * (11 - i);
  resto = 11 - (soma % 11);
  if (resto >= 10) resto = 0;
  return resto === parseInt(cpf.charAt(10));
}

function validarEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

function validarCEP(cep) {
  const regex = /^\d{5}-?\d{3}$/;
  return regex.test(cep);
}

function validarCodigoBanco(cod) {
  const only = String(cod || '').replace(/\D/g, '');
  return /^\d{3}$/.test(only);
}

const BANCOS_BR = {
  '001': 'Banco do Brasil',
  '033': 'Banco Santander (Brasil) S.A.',
  '041': 'Banrisul',
  '070': 'BRB Banco de Brasília',
  '077': 'Banco Inter',
  '104': 'Caixa Econômica Federal',
  '212': 'Banco Original',
  '218': 'BS2',
  '237': 'Bradesco',
  '260': 'Nubank (Itaú IP)',
  '290': 'PagBank - PagSeguro',
  '323': 'Mercado Pago Bank',
  '336': 'C6 Bank',
  '341': 'Itaú Unibanco',
  '380': 'PicPay Bank',
  '422': 'Banco Safra',
  '623': 'Banco Pan',
  '655': 'Banco Votorantim (BV)',
  '748': 'Sicredi',
  '756': 'Sicoob'
};

function nomeDoBanco(cod) {
  const only = String(cod || '').replace(/\D/g, '').padStart(3, '0');
  return BANCOS_BR[only] || null;
}

function validarTelefone(telefone) {
  const numeros = telefone.replace(/\D/g, "");
  return numeros.length >= 10 && numeros.length <= 11;
}

function validarCNH(cnh) {
  cnh = cnh.replace(/\D/g, "");
  return cnh.length === 11;
}

function validarCRLV(crlv) {
  crlv = crlv.replace(/\D/g, "");
  return crlv.length === 11;
}


// api cep
async function buscarCEP(cep) {
  try {
    cep = cep.replace(/\D/g, "");
    if (cep.length !== 8) throw new Error("CEP deve ter 8 dígitos");
    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const data = await response.json();
    if (data.erro) throw new Error("CEP não encontrado");
    return data;
  } catch (error) {
    console.error("Erro ao buscar CEP:", error);
    alert("Erro ao buscar CEP: " + error.message);
    return null;
  }
}

// cloudinary
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

function criarElementoPreview(inputId, previewId) {
  const input = document.getElementById(inputId);
  if (!input) return;

  let previewContainer = document.getElementById(previewId + '-container');
  if (!previewContainer) {
    previewContainer = document.createElement('div');
    previewContainer.id = previewId + '-container';
    previewContainer.style.marginTop = '10px';
    
    const previewImg = document.createElement('img');
    previewImg.id = previewId;
    previewImg.style.maxWidth = '200px';
    previewImg.style.maxHeight = '200px';
    previewImg.style.border = '2px solid #ddd';
    previewImg.style.borderRadius = '8px';
    previewImg.style.display = 'none';
    previewImg.alt = 'Preview da imagem';
    
    previewContainer.appendChild(previewImg);
    input.parentNode.insertBefore(previewContainer, input.nextSibling);
  }
}

function mostrarPreviewImagem(input, previewId) {
  const file = input.files[0];
  const preview = document.getElementById(previewId);
  
  if (file && preview) {
    const reader = new FileReader();
    reader.onload = function(e) {
      preview.src = e.target.result;
      preview.style.display = 'block';
    };
    reader.readAsDataURL(file);
  } else if (preview) {
    preview.style.display = 'none';
  }
}

async function salvarDados(dados) {
  try {
    let fotoPerfilUrl = null;
    let fotoVeiculoUrl = null;
    let certidaoNadaConstaUrl = null;

    if (dados.dadosPessoais.fotoPerfil) {
      fotoPerfilUrl = await uploadImagemCloudinary(dados.dadosPessoais.fotoPerfil);
    }

    if (dados.veiculo.fotoVeiculo) {
      fotoVeiculoUrl = await uploadImagemCloudinary(dados.veiculo.fotoVeiculo);
    }

    if (dados.dadosPessoais.certidaoArquivo) {
      certidaoNadaConstaUrl = await uploadImagemCloudinary(dados.dadosPessoais.certidaoArquivo);
    }

    delete dados.dadosPessoais.fotoPerfil;
    delete dados.veiculo.fotoVeiculo;
    delete dados.dadosPessoais.certidaoArquivo;

    if (fotoPerfilUrl) {
      dados.dadosPessoais.fotoPerfilUrl = fotoPerfilUrl;
    }
    if (fotoVeiculoUrl) {
      dados.veiculo.fotoVeiculoUrl = fotoVeiculoUrl;
    }
    if (certidaoNadaConstaUrl) {
      dados.dadosPessoais.certidaoNadaConstaUrl = certidaoNadaConstaUrl;
    }

    const email = dados.dadosPessoais.email.trim();
    const senha = dados.dadosPessoais.senha;

    const userCred = await auth.createUserWithEmailAndPassword(email, senha);

    delete dados.dadosPessoais.senha;

    const uid = userCred.user.uid;
    dados.uid = uid;

    await db.collection("motoristas").doc(uid).set(dados);

    console.log("Documento salvo com ID:", uid);
    return uid;

  } catch (error) {
    console.error("Erro ao salvar dados:", error);
    const code = String(error.code || "").toLowerCase();
    if (code.includes("auth/email-already-in-use")) {
      throw new Error("Este e-mail já está cadastrado no sistema.");
    }
    if (code.includes("auth/weak-password")) {
      throw new Error("Senha fraca. Use pelo menos 6 caracteres.");
    }
    throw error;
  }
}


//validae formulario

function validarFormulario() {
  const campos = {
    nome: document.getElementById("nome").value.trim(),
    dataNascimento: document.getElementById("data-nascimento").value,
    cpf: document.getElementById("cpf").value,
    email: document.getElementById("email").value,
    senha: document.getElementById("senha").value,
    telefone: document.getElementById("telefone").value,
    cep: document.getElementById("cep").value,
    rua: document.getElementById("rua").value,
    bairro: document.getElementById("bairro").value,
    cidade: document.getElementById("cidade").value,
    rg: document.getElementById("rg").value,
    cnh: document.getElementById("cnh").value,
    tipoVeiculo: document.getElementById("tipo-veiculo").value,
    placa: document.getElementById("placa").value,
    crlv: document.getElementById("crlv").value,
    ano: document.getElementById("ano").value,
    banco: document.getElementById("banco").value,
    agencia: document.getElementById("agencia").value,
    numeroConta: document.getElementById("numero-conta").value
  };

  const quantidadeAjudantes = parseInt(document.getElementById("quantidade-ajudantes").value || '0');
  for (let i = 1; i <= quantidadeAjudantes; i++) {
    const nomeAjudante = document.getElementById(`ajudante-${i}-nome`).value.trim();
    const cpfAjudante = document.getElementById(`ajudante-${i}-cpf`).value;
    const dataNascimentoAjudante = document.getElementById(`ajudante-${i}-data-nascimento`).value;
    const telefoneAjudante = document.getElementById(`ajudante-${i}-telefone`).value;
    const emailAjudante = document.getElementById(`ajudante-${i}-email`).value;
    const fotoPerfilAjudante = document.getElementById(`ajudante-${i}-foto-perfil`);

    if (!nomeAjudante || nomeAjudante.length < 3) { alert(`Nome do Ajudante ${i} deve ter pelo menos 3 caracteres`); return false; }
    if (!validarCPF(cpfAjudante)) { alert(`CPF do Ajudante ${i} inválido`); return false; }
    if (!dataNascimentoAjudante) { alert(`Data de nascimento do Ajudante ${i} é obrigatória`); return false; }
    if (!validarTelefone(telefoneAjudante)) { alert(`Telefone do Ajudante ${i} inválido`); return false; }
    if (!validarEmail(emailAjudante)) { alert(`Email do Ajudante ${i} inválido`); return false; }
    if (!fotoPerfilAjudante || !fotoPerfilAjudante.files || fotoPerfilAjudante.files.length === 0) { alert(`Envie a foto de perfil do Ajudante ${i}`); return false; }

    const hoje = new Date();
    const nascimentoAjudante = new Date(dataNascimentoAjudante);
    const idadeAjudante = hoje.getFullYear() - nascimentoAjudante.getFullYear();
    if (idadeAjudante < 18) { alert(`Ajudante ${i} deve ser maior de idade`); return false; }
  }



  if (!campos.nome || campos.nome.length < 3) { alert("Nome deve ter pelo menos 3 caracteres"); return false; }
  if (!validarCPF(campos.cpf)) { alert("CPF inválido"); return false; }
  if (!validarEmail(campos.email)) { alert("Email inválido"); return false; }
  if (!campos.senha || campos.senha.length < 6) { alert("Senha deve ter pelo menos 6 caracteres"); return false; }
  if (!validarTelefone(campos.telefone)) { alert("Telefone inválido"); return false; }
  if (!validarCEP(campos.cep)) { alert("CEP inválido"); return false; }
  if (!campos.dataNascimento) { alert("Data de nascimento é obrigatória"); return false; }

  const hoje = new Date();
  const nascimento = new Date(campos.dataNascimento);
  const idade = hoje.getFullYear() - nascimento.getFullYear();
  if (idade < 18) { alert("Motorista deve ser maior de idade"); return false; }

  if (!validarCNH(campos.cnh)) { alert("CNH inválida. Deve conter 11 dígitos numéricos."); return false; }
  if (!validarCRLV(campos.crlv)) { alert("CRLV inválido. Deve conter 11 dígitos numéricos."); return false; }
  const certidaoEl = document.getElementById('certidao-nada-consta');
  if (!certidaoEl || !certidaoEl.files || certidaoEl.files.length === 0) { alert('Envie a Certidão de Nada Consta (PDF ou imagem).'); return false; }
  if (!validarCodigoBanco(campos.banco)) { alert('Número do banco inválido. Informe exatamente 3 dígitos.'); return false; }
  if (!nomeDoBanco(campos.banco)) { alert('Código de banco não reconhecido no Brasil. Verifique o número do banco.'); return false; }

  return true;
}

//Listeners 
  document.addEventListener("DOMContentLoaded", function () {

    const quantidadeAjudantesInput = document.getElementById("quantidade-ajudantes");
    const ajudantesContainer = document.getElementById("ajudantes-container");

    function gerarCamposAjudantes() {
      ajudantesContainer.innerHTML = "";
      let quantidade = parseInt(quantidadeAjudantesInput.value);

      if (quantidade > 5) {
        quantidade = 5;
        quantidadeAjudantesInput.value = 5;
      }

      for (let i = 1; i <= quantidade; i++) {
        const ajudanteDiv = document.createElement("div");
        ajudanteDiv.classList.add("ajudante-item");
        ajudanteDiv.innerHTML = `
          <h4>Ajudante ${i}</h4>
          <div class="dupla">
            <input type="text" id="ajudante-${i}-nome" placeholder="Nome Completo" required />
            <input type="text" id="ajudante-${i}-cpf" placeholder="CPF" required />
          </div>
          <div class="dupla">
            <input type="date" id="ajudante-${i}-data-nascimento" placeholder="Data de Nascimento" required />
            <input type="tel" id="ajudante-${i}-telefone" placeholder="Telefone" required />
          </div>
          <input type="email" id="ajudante-${i}-email" placeholder="Email" required />
          <label>Foto de perfil do Ajudante ${i}:</label>
          <input type="file" id="ajudante-${i}-foto-perfil" accept="image/*" />
          <hr />
        `;
        ajudantesContainer.appendChild(ajudanteDiv);

        const novosInputs = ajudanteDiv.querySelectorAll("input[required], select[required]");
        novosInputs.forEach(input => {
            input.addEventListener("input", verificarCampos);
            input.addEventListener("change", verificarCampos);
        });

        // Adicionar listeners de formatação para CPF e Telefone dos ajudantes
        document.getElementById(`ajudante-${i}-cpf`).addEventListener("input", e => e.target.value = formatarCPF(e.target.value));
        document.getElementById(`ajudante-${i}-telefone`).addEventListener("input", e => e.target.value = formatarTelefone(e.target.value));

        // Adicionar preview de imagem para a foto de perfil do ajudante
        criarElementoPreview(`ajudante-${i}-foto-perfil`, `preview-ajudante-${i}-foto-perfil`);
        document.getElementById(`ajudante-${i}-foto-perfil`).addEventListener("change", function() {
          mostrarPreviewImagem(this, `preview-ajudante-${i}-foto-perfil`);
        });
      }
    }

    quantidadeAjudantesInput.addEventListener("input", gerarCamposAjudantes);
    gerarCamposAjudantes(); // Gerar campos iniciais ao carregar a página

  
  criarElementoPreview('foto-perfil', 'preview-foto-perfil');
  criarElementoPreview('foto-veiculo', 'preview-foto-veiculo');

  
  document.getElementById("cpf").addEventListener("input", e => e.target.value = formatarCPF(e.target.value));
  document.getElementById("cep").addEventListener("input", e => e.target.value = formatarCEP(e.target.value));
  document.getElementById("telefone").addEventListener("input", e => e.target.value = formatarTelefone(e.target.value));
  document.getElementById("rg").addEventListener("input", e => e.target.value = formatarRG(e.target.value));
  document.getElementById("placa").addEventListener("input", e => e.target.value = formatarPlaca(e.target.value));
  document.getElementById("cnh").addEventListener("input", e => e.target.value = formatarCNH(e.target.value));
  document.getElementById("crlv").addEventListener("input", e => e.target.value = formatarCRLV(e.target.value));

  
  const fotoPerfilInput = document.getElementById("foto-perfil");
  const fotoVeiculoInput = document.getElementById("foto-veiculo");
  
  if (fotoPerfilInput) {
    fotoPerfilInput.addEventListener("change", function() {
      mostrarPreviewImagem(this, "preview-foto-perfil");
    });
  }
  
  if (fotoVeiculoInput) {
    fotoVeiculoInput.addEventListener("change", function() {
      mostrarPreviewImagem(this, "preview-foto-veiculo");
    });
  }

  // ViaCEP qnd sair 
  document.getElementById("cep").addEventListener("blur", async function (e) {
    const cep = e.target.value.replace(/\D/g, "");
    if (cep.length === 8) {
      const endereco = await buscarCEP(cep);
      if (endereco) {
        document.getElementById("rua").value = endereco.logradouro || "";
        document.getElementById("bairro").value = endereco.bairro || "";
        document.getElementById("cidade").value = endereco.localidade || "";
        if (document.getElementById("estado")) {
          document.getElementById("estado").value = endereco.uf || "";
        }
      }
    }
  });

  const togglePassword = document.querySelector(".toggle-password");
  if (togglePassword) {
    togglePassword.addEventListener("click", function () {
      const senhaInput = document.getElementById("senha");
      const type = senhaInput.getAttribute("type") === "password" ? "text" : "password";
      senhaInput.setAttribute("type", type);
      this.classList.toggle("fa-eye");
      this.classList.toggle("fa-eye-slash");
    });
  }

  const botaoSalvar = document.getElementById("salvar-dados");

  function verificarCampos() {
    let todosPreenchidos = true;
    // Seleciona todos os inputs e selects com o atributo 'required' no formulário
    const allRequiredElements = document.querySelectorAll("#cadastro-form input[required], #cadastro-form select[required]");

    allRequiredElements.forEach(element => {
      if (element.type === 'checkbox') {
        if (!element.checked) {
          todosPreenchidos = false;
        }
      } else if (element.type === 'file') {
        // Para campos de arquivo, verifica se um arquivo foi selecionado
        if (element.files.length === 0) {
          todosPreenchidos = false;
        }
      } else if (!element.value.trim()) {
        todosPreenchidos = false;
      }
    });
    botaoSalvar.disabled = !todosPreenchidos;
  }

  // Adicionar listener para o campo de quantidade de ajudantes para re-verificar campos
  document.getElementById("quantidade-ajudantes").addEventListener("input", () => {
    gerarCamposAjudantes(); // Regenerar campos e adicionar listeners para eles
    verificarCampos(); // Chamar verificarCampos após a regeneração
  });

  // Observar mudanças no DOM para novos campos de ajudantes e adicionar listeners
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === 1) { // Verifica se é um elemento HTML
            node.querySelectorAll('input[required], select[required]').forEach(input => {
              input.addEventListener('input', verificarCampos);
              input.addEventListener('change', verificarCampos);
            });
          }
        });
        verificarCampos(); // Chamar verificarCampos após a adição de novos elementos
      }
    });
  });
  observer.observe(document.getElementById("ajudantes-container"), { childList: true, subtree: true });

  // Adicionar listeners para todos os campos obrigatórios estáticos e dinâmicos (inicialmente)
  document.querySelectorAll("#cadastro-form input[required], #cadastro-form select[required]").forEach(input => {
    input.addEventListener("input", verificarCampos);
    input.addEventListener("change", verificarCampos);
  });

  verificarCampos(); // Chamar uma vez ao carregar a página para definir o estado inicial do botão.


  const tipoSelect = document.getElementById("tipo-veiculo");
  if (tipoSelect) {
    const anterior = tipoSelect.value; 
    const opts = [
      { value: "pequeno", label: "Caminhão 3/4 (pequeno)" },
      { value: "medio",   label: "Caminhão toco (médio)" },
      { value: "grande",  label: "Caminhão truck (grande)" }
    ];
    tipoSelect.innerHTML = "";
    opts.forEach(o => {
      const opt = document.createElement("option");
      opt.value = o.value;
      opt.textContent = o.label;
      tipoSelect.appendChild(opt);
    });
    tipoSelect.value = ["pequeno","medio","grande"].includes(anterior) ? anterior : "pequeno";
  }

  document.getElementById("cadastro-form").addEventListener("submit", async function (e) {
    e.preventDefault();

    if (!validarFormulario()) return;

    const loader = document.getElementById("loader");
    const botaoSalvar = document.getElementById("salvar-dados");

    try {
      loader.style.display = "block";
      botaoSalvar.disabled = true;
      botaoSalvar.textContent = "SALVANDO...";

      const tipoConta = document.querySelector('input[name="tipo-conta"]:checked').value;

      const fotoPerfil = document.getElementById("foto-perfil").files[0];
    const fotoVeiculo = document.getElementById("foto-veiculo").files[0];
    const certidaoArquivo = document.getElementById("certidao-nada-consta").files[0];



        const dados = {
  ajudantes: [],

  dadosPessoais: {
    nome: document.getElementById("nome").value.trim(),
    dataNascimento: document.getElementById("data-nascimento").value,
    cpf: document.getElementById("cpf").value,
    email: document.getElementById("email").value,
    senha: document.getElementById("senha").value, 
    telefone: document.getElementById("telefone").value,
    endereco: {
      cep: document.getElementById("cep").value,
      rua: document.getElementById("rua").value,
      bairro: document.getElementById("bairro").value,
      cidade: document.getElementById("cidade").value,
      estado: document.getElementById("estado") ? document.getElementById("estado").value : ""
    },
    fotoPerfil: fotoPerfil,
    rg: document.getElementById("rg").value,  
    cnh: document.getElementById("cnh").value,  
    certidaoArquivo: certidaoArquivo
  },
  veiculo: {
    tipo: document.getElementById("tipo-veiculo").value,
    placa: document.getElementById("placa").value,
    crlv: document.getElementById("crlv").value,
    ano: document.getElementById("ano").value,
    fotoVeiculo: fotoVeiculo
  },
  dadosBancarios: {
    banco: document.getElementById("banco").value.replace(/\D/g, '').slice(0,3),
    bancoNome: nomeDoBanco(document.getElementById("banco").value) || null,
    tipoConta: tipoConta,
    agencia: document.getElementById("agencia").value,
    numeroConta: document.getElementById("numero-conta").value,
    pix: document.getElementById("pix").value || null
  },
  ajudantes: await Promise.all(Array.from({length: parseInt(document.getElementById("quantidade-ajudantes").value || '0')}).map(async (_, i) => {
    const index = i + 1;
    const fotoPerfilAjudante = document.getElementById(`ajudante-${index}-foto-perfil`).files[0];
    let fotoPerfilAjudanteUrl = null;
    if (fotoPerfilAjudante) {
      fotoPerfilAjudanteUrl = await uploadImagemCloudinary(fotoPerfilAjudante);
    }
    return {
      nome: document.getElementById(`ajudante-${index}-nome`).value.trim(),
      cpf: document.getElementById(`ajudante-${index}-cpf`).value,
      dataNascimento: document.getElementById(`ajudante-${index}-data-nascimento`).value,
      telefone: document.getElementById(`ajudante-${index}-telefone`).value,
      email: document.getElementById(`ajudante-${index}-email`).value,
      fotoPerfilUrl: fotoPerfilAjudanteUrl
    };
  })),
  dataRegistro: new Date().toISOString(),
  status: "pendente"
};

      const docId = await salvarDados(dados);
          
      document.getElementById("cadastro-form").reset();
      
      const previewPerfil = document.getElementById("preview-foto-perfil");
      const previewVeiculo = document.getElementById("preview-foto-veiculo");
      if (previewPerfil) previewPerfil.style.display = 'none';
      if (previewVeiculo) previewVeiculo.style.display = 'none';
      const certidaoInput = document.getElementById('certidao-nada-consta');
      if (certidaoInput) certidaoInput.value = '';
      
      verificarCampos();

      window.location.href = "loginM.html";

    } catch (error) {
      console.error("Erro ao salvar:", error);
         } finally {
      loader.style.display = "none";
      botaoSalvar.disabled = false;
      botaoSalvar.textContent = "SALVAR DADOS";
    }
  });

  function apenasNumeros(valor) { return valor.replace(/\D/g, ""); }
  function apenasLetras(valor) { return valor.replace(/[^A-Za-zÀ-ÿ\s]/g, ""); }

  ["agencia", "numero-conta", "ano"].forEach(id => {
    const campo = document.getElementById(id);
    if (campo) campo.addEventListener("input", e => e.target.value = apenasNumeros(e.target.value));
  });

  const campoBanco = document.getElementById("banco");
  if (campoBanco) {
    campoBanco.addEventListener("input", e => {
      e.target.value = apenasNumeros(e.target.value).slice(0,3);
      const code = e.target.value;
      const small = document.getElementById('banco-nome');
      const nome = validarCodigoBanco(code) ? nomeDoBanco(code) : null;
      if (small) small.textContent = nome ? `Banco detectado: ${nome}` : (code ? 'Código não reconhecido' : '');
      if (nome) {
        e.target.setCustomValidity('');
      } else if (code && code.length === 3) {
        e.target.setCustomValidity('Informe um código de banco brasileiro válido');
      } else {
        e.target.setCustomValidity('');
      }
    });
  }

  const campoNome = document.getElementById("nome");
  if (campoNome) campoNome.addEventListener("input", e => e.target.value = apenasLetras(e.target.value));

  const campoAno = document.getElementById("ano");
  if (campoAno) {
    campoAno.addEventListener("blur", e => {
      const ano = parseInt(e.target.value);
      const anoAtual = new Date().getFullYear();
      if (ano < 1900 || ano > anoAtual + 1) {
        alert("Ano do veículo inválido");
        e.target.focus();
      }
    });
  }
});