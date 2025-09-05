$(document).ready(function () {
  // Aplica a máscara de telefone no campo com ID 'telefone'
  $('#telefone').mask('(00) 00000-0000');

  // Inicializa os provedores do Firebase
  const auth = firebase.auth();
  const db = firebase.firestore();
  const googleProvider = new firebase.auth.GoogleAuthProvider();

  // =================================================
  // === LÓGICA DE LOGIN/CADASTRO COM GOOGLE      ====
  // =================================================
  $('#btn-google').on('click', function () {
    auth.signInWithPopup(googleProvider)
      .then((result) => {
        // Login/Cadastro com Google bem-sucedido
        const user = result.user;

        // Salva ou atualiza os dados do usuário no Firestore.
        // { merge: true } é essencial para não apagar dados existentes, como um telefone inserido manualmente.
        return db.collection("usuarios").doc(user.uid).set({
          nome: user.displayName || "",
          email: user.email,
          foto: user.photoURL || "",
          criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
          emailVerificado: user.emailVerified,
          tipoUsuario: "usuario"
        }, { merge: true });
      })
      .then(() => {
        alert("Login com Google realizado com sucesso!");
        window.location.href = "login.html"; // Redireciona para a área do usuário
      })
      .catch((error) => {
        // Trata o erro específico de conta já existente com outro método de login
        if (error.code === 'auth/account-exists-with-different-credential') {
          const email = error.email;
          const pendingCred = error.credential;

          // Pergunta ao usuário se ele deseja unificar as contas
          if (confirm(`Você já possui uma conta com o e-mail ${email} (criada com senha). Deseja vincular sua conta Google a ela para poder entrar com ambos os métodos?`)) {
           
            const password = prompt("Para confirmar a vinculação, por favor, digite a senha da sua conta Moomate:");
            if (password) {
              // Faz login na conta original (e-mail/senha) para autorizar a vinculação
              auth.signInWithEmailAndPassword(email, password)
                .then((userCredential) => {
                  // Vincula a credencial do Google (que estava pendente) à conta agora logada
                  return userCredential.user.linkWithCredential(pendingCred);
                })
                .then(() => {
                  alert("Conta Google vinculada com sucesso! Agora você pode entrar usando o Google.");
                  window.location.href = "login.html";
                })
                .catch((linkError) => {
                  console.error("Erro ao vincular contas:", linkError);
                  if (linkError.code === 'auth/wrong-password') {
                    alert("Senha incorreta. A vinculação falhou. Tente novamente.");
                  } else {
                    alert("Ocorreu um erro ao vincular as contas: " + linkError.message);
                  }
                });
            }
          }
        } else {
          // Trata outros erros genéricos de login com Google
          console.error("Erro ao logar com Google:", error);
          alert("Erro ao fazer login com Google: " + error.message);
        }
      });
  });

  // =================================================
  // === LÓGICA DE CADASTRO COM E-MAIL E SENHA    ====
  // =================================================
  $('.cadastro-form').on('submit', async function (e) {
    e.preventDefault();

    const nome = $('input[placeholder="Nome Completo"]').val();
    const telefone = $('#telefone').val();
    const email = $('input[placeholder="Email"]').val();
    const senha = $('input[placeholder^="Senha"]').val();

    // Validações de campos
    if (!nome || !telefone || !email || !senha) {
      alert("Por favor, preencha todos os campos.");
      return;
    }
    if (senha.length < 6) {
      alert("A senha deve ter no mínimo 6 caracteres.");
      return;
    }
    if (telefone.replace(/\D/g, '').length < 10) {
      alert("Por favor, insira um número de telefone válido.");
      return;
    }

    try {
      // PASSO 1: Verificar se o NÚMERO DE TELEFONE já existe no Firestore (usuários)
      const telefoneSnapshotUsuarios = await db.collection("usuarios").where("telefone", "==", telefone).get();
      if (!telefoneSnapshotUsuarios.empty) {
        alert("Este número de telefone já está em uso por um usuário. Por favor, tente fazer login ou use um número diferente.");
        return;
      }

      // PASSO 1.1: Verificar se o NÚMERO DE TELEFONE já existe no Firestore (motoristas)
      const telefoneSnapshotMotoristas = await db.collection("motoristas").where("dadosPessoais.telefone", "==", telefone).get();
      if (!telefoneSnapshotMotoristas.empty) {
        alert("Este número de telefone já está em uso por um motorista. Por favor, tente fazer login ou use um número diferente.");
        return;
      }

      // PASSO 1.2: Verificar se o EMAIL já existe na coleção de motoristas
      const emailSnapshotMotoristas = await db.collection("motoristas").where("dadosPessoais.email", "==", email).get();
      if (!emailSnapshotMotoristas.empty) {
        alert("Este e-mail já está cadastrado como motorista. Por favor, tente fazer login ou use um e-mail diferente.");
        return;
      }

      // PASSO 2: Criar o usuário no Firebase Authentication (aqui o Firebase verifica o e-mail)
      const userCredential = await auth.createUserWithEmailAndPassword(email, senha);
      const createdUser = userCredential.user;

      // PASSO 3: Enviar o e-mail de verificação para o usuário
      await createdUser.sendEmailVerification();

      // PASSO 4: Salvar os dados do novo usuário no Firestore
      await db.collection("usuarios").doc(createdUser.uid).set({
        nome: nome,
        telefone: telefone,
        email: email,
        criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
        emailVerificado: false,
        tipoUsuario: "usuario"
      });

      // PASSO 5: Informar o usuário e redirecionar
      alert("Cadastro realizado com sucesso! Um e-mail de verificação foi enviado para " + email + ". Por favor, verifique sua caixa de entrada para ativar sua conta.");
      window.location.href = "login.html";

    } catch (error) {
      console.error("Erro no processo de cadastro:", error);
      // Trata o erro específico de E-MAIL já em uso
      if (error.code === 'auth/email-already-in-use') {
        alert("Este e-mail já está cadastrado. Por favor, tente fazer login ou use um e-mail diferente.");
      } else {
        // Trata outros erros genéricos de cadastro
        alert("Erro ao cadastrar: " + error.message);
      }
    }
  });

  // =================================================
  // === FUNCIONALIDADES EXTRAS                   ====
  // =================================================

  // Redireciona para a página de login
  $('#link-login').on('click', function (e) {
    e.preventDefault();
    window.location.href = 'login.html';
  });

  // Alterna a visibilidade da senha
  $(".toggle-password").on("click", function () {
    const input = $(this).prev("input");
    const tipo = input.attr("type") === "password" ? "text" : "password";
    input.attr("type", tipo);
    $(this).toggleClass("fa-eye fa-eye-slash");
  });
});