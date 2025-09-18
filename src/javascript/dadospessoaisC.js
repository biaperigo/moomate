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
const storage = firebase.storage();

let usuarioAtual = null;
let campoEditando = null;


document.addEventListener("DOMContentLoaded", function () {
  adicionarEstilos();
});



auth.onAuthStateChanged(async (user) => {
  if (user) {
    // verifica se é usuário
    const userDoc = await db.collection("usuarios").doc(user.uid).get();

    if (userDoc.exists && userDoc.data().tipoUsuario === "usuario") {
      const userData = userDoc.data();
      usuarioAtual = { id: user.uid, ...userData };
      carregarDadosUsuario(userData);
      habilitarTodosCamposParaEdicao(); 
    } else {
      //  Se não for 
      console.log("Usuário logado não é do tipo 'usuario' ou não foi encontrado na coleção 'usuarios'.");
      limparCampos();
      desabilitarEdicaoTodosCampos();
      mostrarFeedback("Acesso restrito. Esta página é apenas para usuários.", "error");
    }
  } else {
    // Se ninguém estiver logado
    limparCampos();
    desabilitarEdicaoTodosCampos();
    mostrarFeedback("Você não está logado. Redirecionando...", "error");
    setTimeout(() => { window.location.href = "login.html"; }, 2000);
  }
});
// Limpar todos os campos de input
function limparCampos() {
  const campos = ["nome", "email", "telefone", "cidade", "dataNascimento"];
  campos.forEach(campo => {
    const input = document.getElementById(campo);
    if (input) input.value = "";
  });
  const fotoPerfil = document.getElementById("fotoPerfil");
  if (fotoPerfil) fotoPerfil.src = "default-avatar.png";
}

function desabilitarEdicaoTodosCampos() {
  const campos = ["nome", "telefone", "cidade", "dataNascimento"];
  campos.forEach(campo => {
    const input = document.getElementById(campo);
    if (input) {
      input.disabled = true;
      const wrapper = input.parentElement;
      const editIcon = wrapper.querySelector(".edit-icon");
      if (editIcon) editIcon.style.display = "none";
      const actionsDiv = wrapper.querySelector(".edit-actions");
      if (actionsDiv) actionsDiv.remove();
    }
  });
  const btnFoto = document.querySelector(".btn-foto");
  if (btnFoto) btnFoto.style.display = "none";
}

function habilitarTodosCamposParaEdicao() {
    const campos = ["nome", "telefone", "cidade", "dataNascimento"];
    campos.forEach(campoId => {
        const input = document.getElementById(campoId);
        if (input) {
            const wrapper = input.parentElement;
            const editIcon = wrapper.querySelector('.edit-icon');
            if (editIcon) editIcon.style.display = 'block';
        }
    });
    const btnFoto = document.querySelector(".btn-foto");
    if (btnFoto) btnFoto.style.display = 'block';
}

function carregarDadosUsuario(userData) {
  document.getElementById("nome").value = userData.nome || "";
  document.getElementById("email").value = userData.email || "";
  document.getElementById("telefone").value = formatarTelefone(userData.telefone || "");
  document.getElementById("cidade").value = userData.cidade || "";
  document.getElementById("dataNascimento").value = userData.dataNascimento || "";

  if (userData.fotoPerfil) {
    document.getElementById("fotoPerfil").src = userData.fotoPerfil;
  } else {
    document.getElementById("fotoPerfil").src = "default-avatar.png";
  }
}

function habilitarEdicao(campo) {
  if (campoEditando && campoEditando !== campo) {
    cancelarEdicao(campoEditando);
  }

  const input = document.getElementById(campo);
  const wrapper = input.parentElement;
  const editIcon = wrapper.querySelector(".edit-icon");

  if (campo === "email") {
    return;
  }

  input.disabled = false;
  input.focus();
  campoEditando = campo;

  editIcon.style.display = "none";
  const actionsDiv = document.createElement("div");
  actionsDiv.className = "edit-actions";
  actionsDiv.innerHTML = `
    <i class="fa-solid fa-check save-btn" onclick="salvarCampo(\'${campo}\')" title="Salvar"></i>
    <i class="fa-solid fa-times cancel-btn" onclick="cancelarEdicao(\'${campo}\')" title="Cancelar"></i>
  `;

  wrapper.appendChild(actionsDiv);

  if (campo === "telefone") {
    input.addEventListener("input", aplicarMascaraTelefone);
  }
}

async function salvarCampo(campo) {
  const input = document.getElementById(campo);
  let valor = input.value.trim();

  if (!validarCampo(campo, valor)) {
    return;
  }
  try {
    const dadosAtualizacao = {};

    if (campo === "telefone") {
      
      valor = valor.replace(/\D/g, "");
    }

    dadosAtualizacao[campo] = valor;

    
    await db.collection("usuarios").doc(usuarioAtual.id).update(dadosAtualizacao);
    usuarioAtual[campo] = valor;
    finalizarEdicao(campo);

    mostrarFeedback("Dados salvos com sucesso!", "success");
  } catch (error) {
    console.error("Erro ao salvar dados:", error);
    mostrarFeedback("Erro ao salvar dados. Tente novamente.", "error");
  }
}

function cancelarEdicao(campo) {
  const input = document.getElementById(campo);

  if (campo === "telefone") {
    input.value = formatarTelefone(usuarioAtual[campo] || "");
  } else {
    input.value = usuarioAtual[campo] || "";
  }
  finalizarEdicao(campo);
}
function finalizarEdicao(campo) {
  const input = document.getElementById(campo);
  const wrapper = input.parentElement;
  const editIcon = wrapper.querySelector(".edit-icon");
  const actionsDiv = wrapper.querySelector(".edit-actions");

  input.disabled = true;
  campoEditando = null;

  if (campo === "telefone") {
    input.removeEventListener("input", aplicarMascaraTelefone);
  }
  if (campo !== "email") { 
    editIcon.style.display = "block";
  }
  if (actionsDiv) {
    actionsDiv.remove();
  }
}
function validarCampo(campo, valor) {
  switch (campo) {
    case "nome":
      if (valor.length < 2) {
        mostrarFeedback("Nome deve ter pelo menos 2 caracteres", "error");
        return false;
      }
      break;
    case "telefone":
      const telefoneNumeros = valor.replace(/\D/g, "");
      if (telefoneNumeros.length < 10 || telefoneNumeros.length > 11) {
        mostrarFeedback("Telefone deve ter 10 ou 11 dígitos", "error");
        return false;
      }
      break;
    case "cidade":
      if (valor.length < 2) {
        mostrarFeedback("Cidade deve ter pelo menos 2 caracteres", "error");
        return false;
      }
      break;
    case "dataNascimento":
      const hoje = new Date();
      const nascimento = new Date(valor);
      if (nascimento >= hoje) {
        mostrarFeedback("Data de nascimento deve ser anterior à data atual", "error");
        return false;
      }
      break;
  }
  return true;
}

function formatarTelefone(telefone) {
  const numeros = telefone.replace(/\D/g, "");

  if (numeros.length === 11) {
    return numeros.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  } else if (numeros.length === 10) {
    return numeros.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  }

  return telefone;
}

function aplicarMascaraTelefone(event) {
  const input = event.target;
  let valor = input.value.replace(/\D/g, "");

  if (valor.length > 11) {
    valor = valor.substring(0, 11);
  }

  if (valor.length >= 11) {
    valor = valor.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  } else if (valor.length >= 10) {
    valor = valor.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  } else if (valor.length >= 6) {
    valor = valor.replace(/(\d{2})(\d{4})(\d+)/, "($1) $2-$3");
  } else if (valor.length >= 2) {
    valor = valor.replace(/(\d{2})(\d+)/, "($1) $2");
  }

  input.value = valor;
}

function mostrarFeedback(mensagem, tipo) {
  const feedbackAnterior = document.querySelector(".feedback-message");
  if (feedbackAnterior) {
    feedbackAnterior.remove();
  }

  const feedback = document.createElement("div");
  feedback.className = `feedback-message ${tipo}`;
  feedback.textContent = mensagem;

  feedback.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 20px;
    border-radius: 5px;
    color: white;
    font-weight: bold;
    z-index: 1000;
    animation: slideIn 0.3s ease-out;
    ${tipo === "success" ? "background-color: #4CAF50;" : "background-color: #f44336;"}
  `;

  document.body.appendChild(feedback);
  setTimeout(() => {
    feedback.style.animation = "slideOut 0.3s ease-in";
    setTimeout(() => feedback.remove(), 300);
  }, 3000);
}
//  foto de perfil
async function atualizarFoto() {
  const input = document.getElementById("inputFoto");
  const file = input.files[0];

  if (!file) return;
  if (!file.type.startsWith("image/")) {
    mostrarFeedback("Por favor, selecione apenas arquivos de imagem", "error");
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    mostrarFeedback("A imagem deve ter no máximo 5MB", "error");
    return;
  }
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', 'moomate');  

    const response = await fetch('https://api.cloudinary.com/v1_1/dal3nktmy/image/upload', {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();

    if (result.secure_url) {
      const imageUrl = result.secure_url;

      await db.collection("usuarios").doc(usuarioAtual.id).update({
        fotoPerfil: imageUrl,
      });

      document.getElementById("fotoPerfil").src = imageUrl;
      usuarioAtual.fotoPerfil = imageUrl;

      mostrarFeedback("Foto atualizada com sucesso!", "success");
    } else {
      throw new Error('Erro ao obter URL da imagem do Cloudinary');
    }
  } catch (error) {
    console.error("Erro ao fazer upload da foto:", error);
    mostrarFeedback("Erro ao atualizar foto. Tente novamente.", "error");
  }
}

// Função de logout depois
function logout() {
  auth
    .signOut()
    .then(() => {
      window.location.href = "login.html";
    })
    .catch((error) => {
      console.error("Erro ao fazer logout:", error);
    });
}

//  CSS 
function adicionarEstilos() {
  const style = document.createElement("style");
  style.textContent = `
    .edit-actions {
      display: flex;
      gap: 8px;
      margin-left: 8px;
    }
    
    .save-btn, .cancel-btn {
      cursor: pointer;
      padding: 4px;
      border-radius: 3px;
      transition: all 0.2s;
    }
    
    .save-btn {
      color: #4CAF50;
    }
    
    .save-btn:hover {
      background-color: #4CAF50;
      color: white;
    }
    
    .cancel-btn {
      color: #f44336;
    }
    
    .cancel-btn:hover {
      background-color: #f44336;
      color: white;
    }
    
    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    
    @keyframes slideOut {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(100%);
        opacity: 0;
      }
    }
    
    .input-wrapper {
      position: relative;
      display: flex;
      align-items: center;
      margin-bottom: 15px;
    }
    
    .input-wrapper input:disabled {
      background-color: #f5f5f5;
      cursor: not-allowed;
    }
    
    .input-wrapper input:not(:disabled) {
      background-color: white;
      border: 2px solid #4CAF50;
    }
  `;

  document.head.appendChild(style);
}
