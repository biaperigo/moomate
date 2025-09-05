// --- CONFIG FIREBASE ---
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
const auth = firebase.auth();
const db = firebase.firestore();

// --- ELEMENTOS ---
const form = document.querySelector(".cadastro-form");
const googleBtn = document.querySelector(".btn-google");

// --- mostrar/ocultar senha ---
document.querySelector(".toggle-password")?.addEventListener("click", (e) => {
  const input = document.querySelector(".senha-container input");
  if (!input) return;
  if (input.type === "password") {
    input.type = "text";
    e.currentTarget.classList.replace("fa-eye-slash", "fa-eye");
  } else {
    input.type = "password";
    e.currentTarget.classList.replace("fa-eye", "fa-eye-slash");
  }
});

// --- LOGIN EMAIL/SENHA ---
form.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const email = form.querySelector("input[type='email']").value.trim();
  const senha = form.querySelector("input[type='password']").value;

  if (!email || !senha) {
    alert("Preencha email e senha.");
    return;
  }

  try {
    const cred = await auth.signInWithEmailAndPassword(email, senha);
    await direcionarPorColecao(cred.user);
  } catch (err) {
    let msg = "Erro ao entrar.";
    if (err.code === "auth/user-not-found") msg = "Usuário não encontrado.";
    if (err.code === "auth/wrong-password") msg = "Senha incorreta.";
    if (err.code === "auth/too-many-requests") msg = "Muitas tentativas. Tente novamente mais tarde.";
    alert(msg);
    console.error(err);
  }
});

// --- LOGIN GOOGLE ---
googleBtn.addEventListener("click", async () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    const result = await auth.signInWithPopup(provider);
    const user = result.user;

    const destino = await buscarDestinoPorPerfil(user);
    if (destino) {
      window.location.href = destino;
      return;
    }

    abrirPopupEscolha(user);
  } catch (err) {
    console.error("Erro Google:", err);
    alert("Erro ao entrar com Google.");
  }
});

// --- FUNÇÕES AUXILIARES ---
async function direcionarPorColecao(user) {
  const destino = await buscarDestinoPorPerfil(user);
  if (destino) {
    window.location.href = destino;
  } else {
    abrirPopupEscolha(user);
  }
}

async function buscarDestinoPorPerfil(user) {
  const uid = user.uid;
  const email = user.email;

  try {
    // Checa se o doc do UID existe em "usuarios"
    let doc = await db.collection("usuarios").doc(uid).get();
    if (doc.exists) return "homeC.html";

    // Checa se o doc do UID existe em "motoristas"
    doc = await db.collection("motoristas").doc(uid).get();
    if (doc.exists) return "homeM.html";

    // Compatibilidade antiga (busca por email)
    let snap = await db.collection("usuarios").where("email", "==", email).limit(1).get();
    if (!snap.empty) return "homeC.html";

    snap = await db.collection("motoristas").where("email", "==", email).limit(1).get();
    if (!snap.empty) return "homeM.html";

    // Se não encontrou nada
    return null;
  } catch (err) {
    console.error("Erro Firestore:", err);
    return null;
  }
}

function abrirPopupEscolha(user) {
  const overlay = document.createElement("div");
  overlay.style.cssText = `
    position:fixed; inset:0; display:flex; align-items:center; justify-content:center;
    background:rgba(0,0,0,.6); z-index:9999; padding:16px;
  `;
  overlay.innerHTML = `
    <div style="background:#fff; border-radius:16px; padding:24px; width:min(420px,95%); text-align:center;">
      <h3>Você é?</h3>
      <p>Escolha para finalizar seu cadastro</p>
      <div style="display:flex; gap:12px; justify-content:center;">
        <button id="btnUsuario" style="flex:1; padding:12px; border:none; border-radius:12px; background:#ff6a00; color:#fff;">Sou Usuário</button>
        <button id="btnMotorista" style="flex:1; padding:12px; border:1px solid #ccc; border-radius:12px; background:#fff;">Sou Motorista</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });

  document.getElementById("btnUsuario").onclick = async () => {
    await criarPerfil(user, "usuarios");
    window.location.href = "homeC.html";
  };
  document.getElementById("btnMotorista").onclick = async () => {
    await criarPerfil(user, "motoristas");
    window.location.href = "homeM.html";
  };
}

async function criarPerfil(user, colecao) {
  const uid = user.uid;
  const payload = {
    email: user.email,
    nome: user.displayName || "",
    criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
    emailVerificado: !!user.emailVerified
  };

  try {
    await db.collection(colecao).doc(uid).set(payload, { merge: true });
  } catch (err) {
    console.error("Erro criar perfil:", err);
  }
}
