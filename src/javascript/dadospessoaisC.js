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

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Referência aos campos
const nomeInput = document.getElementById("nome");
const emailInput = document.getElementById("email");
const telefoneInput = document.getElementById("telefone");
const cidadeInput = document.getElementById("cidade");
const dataInput = document.getElementById("dataNascimento");
const senhaInput = document.getElementById("senha"); // Campo para senha
const novaSenhaInput = document.getElementById("novaSenha"); // Campo para nova senha

let userId = null;

// Carregar os dados do usuário ao se autenticar
auth.onAuthStateChanged(async (user) => {
  if (user) {
    userId = user.uid;
    emailInput.value = user.email;

    const doc = await db.collection("usuarios").doc(userId).get();
    if (doc.exists) {
      const dados = doc.data();
      nomeInput.value = dados.nome || "";
      telefoneInput.value = dados.telefone || "";
      cidadeInput.value = dados.cidade || "";
      dataInput.value = dados.dataNascimento || "";
    }
  } else {
    window.location.href = "entrar.html";  // Redireciona se não houver usuário autenticado
  }
});

// Função para salvar dados no Firestore
async function salvar() {
  if (!userId) return;

  // Coletando os dados dos inputs
  const nome = nomeInput.value;
  const telefone = telefoneInput.value;
  const cidade = cidadeInput.value;
  const dataNascimento = dataInput.value;

  try {
    // Atualizando os dados no Firestore
    await db.collection("usuarios").doc(userId).update({
      nome: nome,
      telefone: telefone,
      cidade: cidade,
      dataNascimento: dataNascimento
    });

    // Exibindo mensagem de sucesso
    alert("Dados atualizados com sucesso!");
  } catch (error) {
    console.error("Erro ao atualizar os dados: ", error);
    alert("Erro ao salvar os dados. Tente novamente.");
  }
}

// Função para alterar a senha do usuário
async function alterarSenha() {
  const novaSenha = novaSenhaInput.value;

  if (!novaSenha) {
    alert("Por favor, insira uma nova senha.");
    return;
  }

  const user = auth.currentUser;

  try {
    // Alterando a senha do usuário
    await user.updatePassword(novaSenha);
    alert("Senha alterada com sucesso!");
  } catch (error) {
    console.error("Erro ao alterar a senha:", error);
    alert("Erro ao alterar a senha. Tente novamente.");
  }
}

// Função para logout
function logout() {
  auth.signOut().then(() => {
    window.location.href = "entrar.html";
  });
}
