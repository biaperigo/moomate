// Configuração do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyB9ZuAW1F9rBfOtg3hgGpA6H7JFUoiTlhE",
  authDomain: "moomate-39239.firebaseapp.com",
  projectId: "moomate-39239",
  storageBucket: "moomate-39239.appspot.com",
  messagingSenderId: "637968714747",
  appId: "1:637968714747:web:ad15dc3571c22f046b595e",
  measurementId: "G-62J7Q8CKP4"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth(); // <— importante

// =================== Funções de formatação ===================
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

// =================== Funções de validação ===================
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

function validarAntecedentes(antecedentes) {
  return antecedentes.trim().length > 0 && antecedentes.trim().length <= 255;
}

// =================== ViaCEP ===================
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

// =================== SALVAR DADOS (Auth + Firestore) ===================
// Substitui a sua função antiga. Agora cria usuário no Auth, remove senha e salva o doc com o UID.
async function salvarDados(dados) {
  try {
    const email = dados.dadosPessoais.email.trim();
    const senha = dados.dadosPessoais.senha;

    // 0) Cria o usuário no Firebase Auth
    const userCred = await auth.createUserWithEmailAndPassword(email, senha);

    // 1) Não guardar senha no Firestore
    delete dados.dadosPessoais.senha;

    // 2) UID do Auth
    const uid = userCred.user.uid;
    dados.uid = uid;

    // 3) Salva no Firestore usando o UID como ID do documento
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

// =================== Validação do formulário ===================
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
    antecedentes: document.getElementById("antecedentes").value,
    tipoVeiculo: document.getElementById("tipo-veiculo").value,
    placa: document.getElementById("placa").value,
    crlv: document.getElementById("crlv").value,
    ano: document.getElementById("ano").value,
    banco: document.getElementById("banco").value,
    agencia: document.getElementById("agencia").value,
    numeroConta: document.getElementById("numero-conta").value
  };

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
  if (!validarAntecedentes(campos.antecedentes)) { alert("Antecedentes criminais: campo obrigatório e deve ter entre 1 e 255 caracteres."); return false; }

  return true;
}

// =================== Listeners ===================
document.addEventListener("DOMContentLoaded", function () {
  // Formatação e limitação
  document.getElementById("cpf").addEventListener("input", e => e.target.value = formatarCPF(e.target.value));
  document.getElementById("cep").addEventListener("input", e => e.target.value = formatarCEP(e.target.value));
  document.getElementById("telefone").addEventListener("input", e => e.target.value = formatarTelefone(e.target.value));
  document.getElementById("rg").addEventListener("input", e => e.target.value = formatarRG(e.target.value));
  document.getElementById("placa").addEventListener("input", e => e.target.value = formatarPlaca(e.target.value));
  document.getElementById("cnh").addEventListener("input", e => e.target.value = formatarCNH(e.target.value));
  document.getElementById("crlv").addEventListener("input", e => e.target.value = formatarCRLV(e.target.value));

  // ViaCEP ao sair do campo
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

  // Toggle senha
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

  // Habilitar/desabilitar botão salvar
  const inputs = document.querySelectorAll("input[required], select[required]");
  const botaoSalvar = document.getElementById("salvar-dados");

  function verificarCampos() {
    let todosPreenchidos = true;
    inputs.forEach(input => {
      if (!input.value.trim()) todosPreenchidos = false;
    });
    botaoSalvar.disabled = !todosPreenchidos;
  }

  inputs.forEach(input => {
    input.addEventListener("input", verificarCampos);
    input.addEventListener("change", verificarCampos);
  });

  // Submit do formulário
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

      const dados = {
        dadosPessoais: {
          nome: document.getElementById("nome").value.trim(),
          dataNascimento: document.getElementById("data-nascimento").value,
          cpf: document.getElementById("cpf").value,
          email: document.getElementById("email").value,
          senha: document.getElementById("senha").value, // será removida antes de salvar
          telefone: document.getElementById("telefone").value,
          endereco: {
            cep: document.getElementById("cep").value,
            rua: document.getElementById("rua").value,
            bairro: document.getElementById("bairro").value,
            cidade: document.getElementById("cidade").value,
            estado: document.getElementById("estado") ? document.getElementById("estado").value : ""
          }
        },
        documentacao: {
          rg: document.getElementById("rg").value,
          cnh: document.getElementById("cnh").value,
          antecedentes: document.getElementById("antecedentes").value
        },
        veiculo: {
          tipo: document.getElementById("tipo-veiculo").value,
          placa: document.getElementById("placa").value,
          crlv: document.getElementById("crlv").value,
          ano: document.getElementById("ano").value
        },
        dadosBancarios: {
          banco: document.getElementById("banco").value,
          tipoConta: tipoConta,
          agencia: document.getElementById("agencia").value,
          numeroConta: document.getElementById("numero-conta").value,
          pix: document.getElementById("pix").value || null
        },
        dataRegistro: new Date().toISOString(),
        status: "pendente"
      };

      // Salvar (Auth + Firestore)
      const docId = await salvarDados(dados);

      alert("Cadastro realizado com sucesso! ID: " + docId);

      // Limpar formulário
      document.getElementById("cadastro-form").reset();
      verificarCampos();

      // Redirecionar para login
      window.location.href = "loginM.html";

    } catch (error) {
      console.error("Erro ao salvar:", error);
      alert("Erro ao salvar dados: " + (error.message || "Tente novamente."));
    } finally {
      loader.style.display = "none";
      botaoSalvar.disabled = false;
      botaoSalvar.textContent = "SALVAR DADOS";
    }
  });

  // Helpers extras
  function apenasNumeros(valor) { return valor.replace(/\D/g, ""); }
  function apenasLetras(valor) { return valor.replace(/[^A-Za-zÀ-ÿ\s]/g, ""); }

  ["agencia", "numero-conta", "ano"].forEach(id => {
    const campo = document.getElementById(id);
    if (campo) campo.addEventListener("input", e => e.target.value = apenasNumeros(e.target.value));
  });

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
