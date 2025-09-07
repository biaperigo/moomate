document.addEventListener("DOMContentLoaded", () => {
  // ================================
  // Firebase init (v8)
  // ================================
  const firebaseConfig = {
    apiKey: "AIzaSyB9ZuAW1F9rBfOtg3hgGpA6H7JFUoiTlhE",
    authDomain: "moomate-39239.firebaseapp.com",
    projectId: "moomate-39239",
    storageBucket: "moomate-39239.appspot.com",
    messagingSenderId: "637968714747",
    appId: "1:637968714747:web:ad15dc3571c22f046b595e",
    measurementId: "G-62J7Q8CKP4"
  };
  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

  const auth = firebase.auth();
  const db = firebase.firestore();
  const googleProvider = new firebase.auth.GoogleAuthProvider();

  // ================================
  // Seletores conforme seu HTML/CSS
  // ================================
  const form = document.querySelector(".cadastro-form");
  const emailInput = document.querySelector('input[placeholder="Email"]');
  const senhaInput = document.querySelector('input[placeholder="Senha"]');
  const btnGoogle = document.querySelector(".btn-google");
  const togglePass = document.querySelector(".toggle-password");

  // ================================
  // Toggle de visibilidade da senha
  // ================================
  if (togglePass) {
    togglePass.addEventListener("click", () => {
      const tipo = senhaInput.type === "password" ? "text" : "password";
      senhaInput.type = tipo;
      togglePass.classList.toggle("fa-eye");
      togglePass.classList.toggle("fa-eye-slash");
    });
  }

  // ================================
  // Entrar com e-mail/senha
  // ================================
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const email = (emailInput.value || "").trim();
      const senha = senhaInput.value || "";

      if (!email || !senha) {
        alert("Preencha e-mail e senha.");
        return;
      }

      try {
        const cred = await auth.signInWithEmailAndPassword(email, senha);
        const uid = cred.user.uid;

        const doc = await db.collection("usuarios").doc(uid).get();
        if (!doc.exists) {
          await auth.signOut();
          alert("Este e-mail não está cadastrado como USUÁRIO.");
          return;
        }

        const data = doc.data();
        if (data && data.tipoUsuario && data.tipoUsuario !== "usuario") {
          await auth.signOut();
          alert('Conta encontrada não é do tipo "usuario".');
          return;
        }

        window.location.href = "homeC.html";
      } catch (err) {
        console.error("Erro ao entrar:", err);
        if (
          err.code === "auth/user-not-found" ||
          err.code === "auth/wrong-password"
        ) {
          alert("E-mail ou senha inválidos.");
        } else if (err.code === "auth/too-many-requests") {
          alert("Muitas tentativas. Tente novamente em alguns minutos.");
        } else {
          alert("Erro ao entrar: " + err.message);
        }
      }
    });
  }

  // ================================
  // Entrar com Google
  // ================================
  if (btnGoogle) {
    btnGoogle.addEventListener("click", async (e) => {
      e.preventDefault();
      try {
        const result = await auth.signInWithPopup(googleProvider);
        const user = result.user;

        await db.collection("usuarios").doc(user.uid).set(
          {
            nome: user.displayName || "",
            email: user.email || "",
            foto: user.photoURL || "",
            criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
            emailVerificado: !!user.emailVerified,
            tipoUsuario: "usuario"
          },
          { merge: true }
        );

        window.location.href = "homeC.html";
      } catch (err) {
        console.error("Erro Google:", err);
        if (err.code === "auth/account-exists-with-different-credential") {
          alert(
            "Este e-mail já está cadastrado com outro método. Entre com e-mail/senha e vincule o Google depois."
          );
        } else if (err.code === "auth/popup-blocked") {
          alert(
            "Seu navegador bloqueou o pop-up do Google. Permita pop-ups e tente novamente."
          );
        } else {
          alert("Erro ao entrar com Google: " + err.message);
        }
      }
    });
  }
});
