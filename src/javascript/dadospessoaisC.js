// Configuração do Firebase (sem alterações)
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
const auth = firebase.auth();
const storage = firebase.storage();

let usuarioAtual = null;
let campoEditando = null;

// Aguardar o DOM carregar completamente
document.addEventListener("DOMContentLoaded", function () {
  adicionarEstilos();
});

// --- INÍCIO DA SEÇÃO MODIFICADA ---

// Verificar o estado de autenticação
auth.onAuthStateChanged(async (user) => {
  if (user) {
    // 1. Primeiro, verificar se o usuário logado é do tipo 'usuario'
    const userDoc = await db.collection("usuarios").doc(user.uid).get();

    if (userDoc.exists && userDoc.data().tipoUsuario === "usuario") {
      // 2. Se for um usuário válido, carrega os dados
      const userData = userDoc.data();
      usuarioAtual = { id: user.uid, ...userData };
      carregarDadosUsuario(userData);
      // Garante que os campos de edição e o botão de foto estejam visíveis
      habilitarTodosCamposParaEdicao(); 
    } else {
      // 3. Se não for um usuário válido (é motorista, admin, ou não encontrado)
      //    Apenas limpa a página e informa que o acesso é restrito.
      //    Isso impede que dados de um usuário anterior permaneçam na tela.
      console.log("Usuário logado não é do tipo 'usuario' ou não foi encontrado na coleção 'usuarios'.");
      limparCampos();
      desabilitarEdicaoTodosCampos();
      mostrarFeedback("Acesso restrito. Esta página é apenas para usuários.", "error");
    }
  } else {
    // 4. Se ninguém estiver logado, redireciona para o login.
    limparCampos();
    desabilitarEdicaoTodosCampos();
    mostrarFeedback("Você não está logado. Redirecionando...", "error");
    setTimeout(() => { window.location.href = "login.html"; }, 2000);
  }
});

// --- FIM DA SEÇÃO MODIFICADA ---

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

// Desabilitar todos os campos de edição e esconder ícones/botões
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

// NOVA FUNÇÃO: Habilitar a interface para um usuário válido
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


// Carregar dados do usuário nos campos
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

// Habilitar edição de um campo específico
function habilitarEdicao(campo) {
  if (campoEditando && campoEditando !== campo) {
    cancelarEdicao(campoEditando);
  }

  const input = document.getElementById(campo);
  const wrapper = input.parentElement;
  const editIcon = wrapper.querySelector(".edit-icon");

  // Não permitir edição do email
  if (campo === "email") {
    return;
  }

  // Habilitar o campo
  input.disabled = false;
  input.focus();
  campoEditando = campo;

  // Trocar ícone de lápis por botões de salvar/cancelar
  editIcon.style.display = "none";

  // Criar botões de ação
  const actionsDiv = document.createElement("div");
  actionsDiv.className = "edit-actions";
  actionsDiv.innerHTML = `
    <i class="fa-solid fa-check save-btn" onclick="salvarCampo(\'${campo}\')" title="Salvar"></i>
    <i class="fa-solid fa-times cancel-btn" onclick="cancelarEdicao(\'${campo}\')" title="Cancelar"></i>
  `;

  wrapper.appendChild(actionsDiv);

  // Aplicar formatação em tempo real para telefone
  if (campo === "telefone") {
    input.addEventListener("input", aplicarMascaraTelefone);
  }
}

// Salvar alterações no campo
async function salvarCampo(campo) {
  const input = document.getElementById(campo);
  let valor = input.value.trim();

  // Validações
  if (!validarCampo(campo, valor)) {
    return;
  }

  try {
    // Preparar dados para atualização
    const dadosAtualizacao = {};

    if (campo === "telefone") {
      // Remover formatação do telefone para salvar apenas números
      valor = valor.replace(/\D/g, "");
    }

    dadosAtualizacao[campo] = valor;

    // Atualizar no Firebase
    await db.collection("usuarios").doc(usuarioAtual.id).update(dadosAtualizacao);

    // Atualizar dados locais
    usuarioAtual[campo] = valor;

    // Finalizar edição
    finalizarEdicao(campo);

    // Mostrar feedback de sucesso
    mostrarFeedback("Dados salvos com sucesso!", "success");
  } catch (error) {
    console.error("Erro ao salvar dados:", error);
    mostrarFeedback("Erro ao salvar dados. Tente novamente.", "error");
  }
}

// Cancelar edição
function cancelarEdicao(campo) {
  const input = document.getElementById(campo);

  // Restaurar valor original
  if (campo === "telefone") {
    input.value = formatarTelefone(usuarioAtual[campo] || "");
  } else {
    input.value = usuarioAtual[campo] || "";
  }

  finalizarEdicao(campo);
}

// Finalizar edição (comum para salvar e cancelar)
function finalizarEdicao(campo) {
  const input = document.getElementById(campo);
  const wrapper = input.parentElement;
  const editIcon = wrapper.querySelector(".edit-icon");
  const actionsDiv = wrapper.querySelector(".edit-actions");

  // Desabilitar campo
  input.disabled = true;
  campoEditando = null;

  // Remover listener de telefone se existir
  if (campo === "telefone") {
    input.removeEventListener("input", aplicarMascaraTelefone);
  }

  // Restaurar ícone de edição
  if (campo !== "email") { // Não mostrar ícone de lápis para email
    editIcon.style.display = "block";
  }

  // Remover botões de ação
  if (actionsDiv) {
    actionsDiv.remove();
  }
}

// Validar campos
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

// Formatação de telefone
function formatarTelefone(telefone) {
  const numeros = telefone.replace(/\D/g, "");

  if (numeros.length === 11) {
    return numeros.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  } else if (numeros.length === 10) {
    return numeros.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  }

  return telefone;
}

// Aplicar máscara de telefone em tempo real
function aplicarMascaraTelefone(event) {
  const input = event.target;
  let valor = input.value.replace(/\D/g, "");

  // Limitar a 11 dígitos
  if (valor.length > 11) {
    valor = valor.substring(0, 11);
  }

  // Aplicar formatação
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

// Mostrar feedback para o usuário
function mostrarFeedback(mensagem, tipo) {
  // Remover feedback anterior se existir
  const feedbackAnterior = document.querySelector(".feedback-message");
  if (feedbackAnterior) {
    feedbackAnterior.remove();
  }

  // Criar elemento de feedback
  const feedback = document.createElement("div");
  feedback.className = `feedback-message ${tipo}`;
  feedback.textContent = mensagem;

  // Adicionar estilos
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

  // Remover após 3 segundos
  setTimeout(() => {
    feedback.style.animation = "slideOut 0.3s ease-in";
    setTimeout(() => feedback.remove(), 300);
  }, 3000);
}

// Função para atualizar foto de perfil
// Função para atualizar a foto de perfil usando Cloudinary
async function atualizarFoto() {
  const input = document.getElementById("inputFoto");
  const file = input.files[0];

  if (!file) return;

  // Validar tipo de arquivo
  if (!file.type.startsWith("image/")) {
    mostrarFeedback("Por favor, selecione apenas arquivos de imagem", "error");
    return;
  }

  // Validar tamanho (máximo 5MB)
  if (file.size > 5 * 1024 * 1024) {
    mostrarFeedback("A imagem deve ter no máximo 5MB", "error");
    return;
  }

  try {
    // Criando o FormData para enviar ao Cloudinary
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', 'moomate');  // Substitua pelo nome do seu upload preset no Cloudinary

    // Realizando o upload para o Cloudinary
    const response = await fetch('https://api.cloudinary.com/v1_1/dal3nktmy/image/upload', {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();

    if (result.secure_url) {
      // URL da imagem carregada no Cloudinary
      const imageUrl = result.secure_url;

      // Atualizando a foto de perfil no Firestore
      await db.collection("usuarios").doc(usuarioAtual.id).update({
        fotoPerfil: imageUrl,
      });

      // Atualizar a foto de perfil na interface
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


// Função de logout (opcional)
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

// Adicionar estilos CSS dinamicamente
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
