$(document).ready(function () {
  $('#telefone').mask('(00) 00000-0000');

  const auth = firebase.auth();
  const db = firebase.firestore();
  const googleProvider = new firebase.auth.GoogleAuthProvider();
  
  // login google

  $('#btn-google').on('click', function () {
    auth.signInWithPopup(googleProvider)
      .then((result) => {
                const user = result.user;
        // Salva os dados no Firestore
        // { merge: true }  não apagar dados 
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
                window.location.href = "homeC.html"; 
      })
      .catch((error) => {
        if (error.code === 'auth/account-exists-with-different-credential') {
          const email = error.email;
          const pendingCred = error.credential;

          if (confirm(`Você já possui uma conta com o e-mail ${email} (criada com senha). Deseja vincular sua conta Google a ela para poder entrar com ambos os métodos?`)) {
           
            const password = prompt("Para confirmar a vinculação, por favor, digite a senha da sua conta Moomate:");
            if (password) {
              auth.signInWithEmailAndPassword(email, password)
                .then((userCredential) => {
                  return userCredential.user.linkWithCredential(pendingCred);
                })
                .then(() => {
                  
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
          console.error("Erro ao logar com Google:", error);
        
        }
      });
  });
  //login email
  
  $('.cadastro-form').on('submit', async function (e) {
    e.preventDefault();

    const nome = $('input[placeholder="Nome Completo"]').val();
    const telefone = $('#telefone').val();
    const email = $('input[placeholder="Email"]').val();
    const senha = $('input[placeholder^="Senha"]').val();

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
      const telefoneSnapshotUsuarios = await db.collection("usuarios").where("telefone", "==", telefone).get();
      if (!telefoneSnapshotUsuarios.empty) {
        alert("Este número de telefone já está em uso por um usuário. Por favor, tente fazer login ou use um número diferente.");
        return;
      }

      const telefoneSnapshotMotoristas = await db.collection("motoristas").where("dadosPessoais.telefone", "==", telefone).get();
      if (!telefoneSnapshotMotoristas.empty) {
        alert("Este número de telefone já está em uso por um motorista. Por favor, tente fazer login ou use um número diferente.");
        return;
      }
      const emailSnapshotMotoristas = await db.collection("motoristas").where("dadosPessoais.email", "==", email).get();
      if (!emailSnapshotMotoristas.empty) {
        alert("Este e-mail já está cadastrado como motorista. Por favor, tente fazer login ou use um e-mail diferente.");
        return;
      }

      const userCredential = await auth.createUserWithEmailAndPassword(email, senha);
      const createdUser = userCredential.user; 

      await createdUser.sendEmailVerification();

      await db.collection("usuarios").doc(createdUser.uid).set({
        nome: nome,
        telefone: telefone,
        email: email,
        criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
        emailVerificado: false,
        tipoUsuario: "usuario"
      });

      
      window.location.href = "login.html";

    } catch (error) {
      console.error("Erro no processo de cadastro:", error);
      if (error.code === 'auth/email-already-in-use') {
        alert("Este e-mail já está cadastrado. Por favor, tente fazer login ou use um e-mail diferente.");
      } else {
        alert("Erro ao cadastrar: " + error.message);
      }
    }
  });

  $('#link-login').on('click', function (e) {
    e.preventDefault();
    window.location.href = 'login.html';
  });

  $(".toggle-password").on("click", function () {
    const input = $(this).prev("input");
    const tipo = input.attr("type") === "password" ? "text" : "password";
    input.attr("type", tipo);
    $(this).toggleClass("fa-eye fa-eye-slash");
  });
});