// src/javascript/loginM.js
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
  const db   = firebase.firestore();

  const DESTINO = "homeM.html"; // ajuste se quiser outro destino

  // ================================
  // Seletores (iguais ao seu HTML)
  // ================================
  const form       = document.querySelector(".cadastro-form");
  const emailInput = document.querySelector('input[placeholder="Email"]');
  const senhaInput = document.querySelector('input[placeholder="Senha"]');
  const togglePass = document.querySelector(".toggle-password");

  // ================================
  // Olhinho da senha
  // ================================
  if (togglePass && senhaInput) {
    togglePass.addEventListener("click", () => {
      senhaInput.type = senhaInput.type === "password" ? "text" : "password";
      togglePass.classList.toggle("fa-eye");
      togglePass.classList.toggle("fa-eye-slash");
    });
  }

  // ================================
  // Helpers Firestore (motoristas)
  // ================================
  async function buscarMotorista(uid, email) {
    // 1) tenta doc motoristas/{uid}
    const byUid = await db.collection("motoristas").doc(uid).get();
    if (byUid.exists) return byUid;

    // 2) fallback por e-mail em campo aninhado dadosPessoais.email
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

  // ================================
  // Entrar com e-mail/senha
  // ================================
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
        // 1) Autentica no Auth
        const cred = await auth.signInWithEmailAndPassword(email, senha);
        const user = cred.user;

        // 2) Confirma que está na coleção 'motoristas'
        const docSnap = await buscarMotorista(user.uid, user.email);
        if (!docSnap) {
          await auth.signOut();
          alert("Este e-mail não está cadastrado como MOTORISTA.");
          return;
        }

        // 3) (opcional) valida tipoUsuario
        if (!validaTipo(docSnap)) {
          await auth.signOut();
          alert('Conta encontrada não é do tipo "motorista".');
          return;
        }

        // 4) OK → redireciona
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
