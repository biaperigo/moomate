document.addEventListener("DOMContentLoaded", () => {

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
  const db   = firebase.firestore();

  const DESTINO = "homeM.html"; 
  const form       = document.querySelector(".cadastro-form");
  const emailInput = document.querySelector('input[placeholder="Email"]');
  const senhaInput = document.querySelector('input[placeholder="Senha"]');
  const togglePass = document.querySelector(".toggle-password");
  const forgotLink = document.querySelector(".forgot-password");


  // Olhinho da senha
  if (togglePass && senhaInput) {
    togglePass.addEventListener("click", () => {
      senhaInput.type = senhaInput.type === "password" ? "text" : "password";
      togglePass.classList.toggle("fa-eye");
      togglePass.classList.toggle("fa-eye-slash");
    });
  }
  // Esqueci a senha
  if (forgotLink) {
    forgotLink.addEventListener("click", async (e) => {
      e.preventDefault();
      const email = (emailInput?.value || "").trim();
      if (!email) {
        alert("Informe seu e-mail para redefinir a senha");
        return;
      }
      try {
        await auth.sendPasswordResetEmail(email);
      } catch (err) {
        console.error("Erro ao enviar e-mail de redefinição:", err);
        if (err.code === "auth/invalid-email") {
          alert("Informe um e-mail válido.");
          return;
        }
        // Demais erros ficam silenciosos para não vazar informações
      }
      alert("Verifique seu e-mail para redefinir a senha");
    });
  }
  async function buscarMotorista(uid, email) {

    const byUid = await db.collection("motoristas").doc(uid).get();
    if (byUid.exists) return byUid;
    const q = await db.collection("motoristas")
      .where("dadosPessoais.email", "==", email || "")
      .limit(1)
      .get();

    if (!q.empty) return q.docs[0];
    return null;
  }

  function validaTipo(docSnap) {
    const data = docSnap?.data?.() || docSnap?.data || {};
    if (data.tipoUsuario && data.tipoUsuario !== "motorista") return false;
    return true;
  }

  // Entrar com email
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const email = (emailInput?.value || "").trim();
      const senha = senhaInput?.value || "";

      if (!email || !senha) {
        alert("Preencha e-mail e senha.");
        return;
      }

      try {
        const cred = await auth.signInWithEmailAndPassword(email, senha);
        const user = cred.user;

        const docSnap = await buscarMotorista(user.uid, user.email);
        if (!docSnap) {
          await auth.signOut();
          alert("Este e-mail não está cadastrado como MOTORISTA.");
          return;
        }

        if (!validaTipo(docSnap)) {
          await auth.signOut();
          alert('Conta encontrada não é do tipo "motorista".');
          return;
        }
        window.location.href = DESTINO;
      } catch (err) {
        console.error("Erro ao entrar (motorista):", err);
        if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password") {
          alert("E-mail ou senha inválidos.");
        } else if (err.code === "auth/too-many-requests") {
          alert("Muitas tentativas. Tente novamente em alguns minutos.");
        } else {
          alert("Erro ao entrar: " + err.message);
        }
      }
    });
  }
});
