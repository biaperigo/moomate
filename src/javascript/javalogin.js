// Configurar provedor do Google
const googleProvider = new GoogleAuthProvider();

// Elementos do DOM
const form = document.querySelector(".cadastro-form");
const emailInput = document.querySelector("input[type=\"email\"]");
const passwordInput = document.querySelector("input[type=\"password\"]");
const togglePassword = document.querySelector(".toggle-password");
const googleBtn = document.querySelector(".btn-google");
const modal = document.getElementById("modal-tipo-cadastro");
const closeModal = document.querySelector(".close-modal");
const cadastroLink = document.querySelector(".login a");

// Função para mostrar/ocultar senha
togglePassword.addEventListener("click", function() {
  const type = passwordInput.getAttribute("type") === "password" ? "text" : "password";
  passwordInput.setAttribute("type", type);
  
  // Alternar ícone
  this.classList.toggle("fa-eye");
  this.classList.toggle("fa-eye-slash");
});

// Função para verificar se o usuário existe na tabela de usuários
async function verificarUsuarioNaTabela(email, senha) {
  try {
    // Buscar na coleção 'usuarios' por email
    const q = query(collection(db, "usuarios"), where("email", "==", email));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      throw new Error("Usuário não encontrado");
    }
    
    let usuarioEncontrado = null;
    querySnapshot.forEach((doc) => {
      const userData = doc.data();
      // Verificar se a senha confere
      if (userData.senha === senha) {
        usuarioEncontrado = { id: doc.id, ...userData };
      }
    });
    
    if (!usuarioEncontrado) {
      throw new Error("Senha incorreta");
    }
    
    return usuarioEncontrado;
  } catch (error) {
    throw error;
  }
}

// Função para fazer login com email e senha
async function loginComEmailSenha(email, senha) {
  try {
    // Verificar se o usuário existe na tabela usuarios
    const usuario = await verificarUsuarioNaTabela(email, senha);
    
    console.log("Login realizado com sucesso:", usuario);
    
    // Salvar dados do usuário no localStorage para uso posterior
    localStorage.setItem("usuarioLogado", JSON.stringify(usuario));
    
    // Redirecionar para homeC.html
    window.location.href = "homeC.html";
    
  } catch (error) {
    console.error("Erro no login:", error);
    
    // Mostrar mensagem de erro para o usuário
    let mensagem = "Email ou senha incorretos.";
    
    if (error.message === "Usuário não encontrado" || error.message === "Senha incorreta") {
      mensagem = "Email ou senha incorretos.";
    }
    
    alert(mensagem);
  }
}

// Função para login com Google
async function loginComGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    
    console.log("Login com Google realizado:", user);
    
    // Verificar se o usuário já existe na tabela de usuários
    const q = query(collection(db, "usuarios"), where("email", "==", user.email));
    const querySnapshot = await getDocs(q);
    
    let usuarioData;
    
    if (querySnapshot.empty) {
      // Se não existe, criar um novo registro na tabela
      const novoUsuario = {
        email: user.email,
        nome: user.displayName,
        foto: user.photoURL,
        loginGoogle: true,
        criadoEm: serverTimestamp()
      };
      
      const docRef = await addDoc(collection(db, "usuarios"), novoUsuario);
      usuarioData = { id: docRef.id, ...novoUsuario };
      
      console.log("Novo usuário criado na tabela");
    } else {
      // Se já existe, pegar os dados
      querySnapshot.forEach((doc) => {
        usuarioData = { id: doc.id, ...doc.data() };
      });
    }
    
    // Salvar dados do usuário no localStorage
    localStorage.setItem("usuarioLogado", JSON.stringify(usuarioData));
    
    // Redirecionar para homeC.html
    window.location.href = "homeC.html";
    
  } catch (error) {
    console.error("Erro no login com Google:", error);
    
    let mensagem = "Erro no login com Google. Tente novamente.";
    
    switch (error.code) {
      case "auth/popup-closed-by-user":
        mensagem = "Login cancelado pelo usuário.";
        break;
      case "auth/popup-blocked":
        mensagem = "Popup bloqueado. Permita popups para este site.";
        break;
    }
    
    alert(mensagem);
  }
}

// Event listener para o formulário de login
form.addEventListener("submit", function(e) {
  e.preventDefault();
  
  const email = emailInput.value.trim();
  const senha = passwordInput.value;
  
  if (!email || !senha) {
    alert("Por favor, preencha todos os campos.");
    return;
  }
  
  // Desabilitar botão durante o login
  const submitBtn = form.querySelector(".btn-laranja");
  submitBtn.disabled = true;
  submitBtn.textContent = "ENTRANDO...";
  
  loginComEmailSenha(email, senha).finally(() => {
    // Reabilitar botão
    submitBtn.disabled = false;
    submitBtn.textContent = "ENTRAR";
  });
});

// Event listener para o botão do Google
googleBtn.addEventListener("click", function() {
  this.disabled = true;
  this.innerHTML = '<i class="fa-brands fa-google"></i> Entrando...';
  
  loginComGoogle().finally(() => {
    this.disabled = false;
    this.innerHTML = '<i class="fa-brands fa-google"></i> Entrar com Google';
  });
});

// Event listeners para o modal de cadastro
cadastroLink.addEventListener("click", function(e) {
  e.preventDefault();
  modal.classList.remove("hidden");
});

closeModal.addEventListener("click", function() {
  modal.classList.add("hidden");
});

// Fechar modal clicando fora dele
modal.addEventListener("click", function(e) {
  if (e.target === modal) {
    modal.classList.add("hidden");
  }
});

// Event listeners para os botões de opção do modal
document.querySelectorAll(".btn-opcao").forEach(btn => {
  btn.addEventListener("click", function() {
    const destino = this.getAttribute("data-destino");
    window.location.href = destino;
  });
});



// Função para logout (pode ser útil)
function logout() {
  // Remover dados do localStorage
  localStorage.removeItem("usuarioLogado");
  
  // Fazer logout do Firebase Auth se estiver logado
  signOut(auth).then(() => {
    console.log("Logout realizado");
    window.location.href = "login.html";
  }).catch((error) => {
    console.error("Erro no logout:", error);
    // Mesmo com erro, redirecionar para login
    window.location.href = "login.html";
  });
}
