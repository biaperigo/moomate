    // Menu toggle
    const menuToggle = document.getElementById('menuToggle');
    const navMenu = document.getElementById('navMenu');

    menuToggle.addEventListener('click', () => {
      navMenu.classList.toggle('show');
    });

    // Firebase Config
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
    const storage = firebase.storage();

    let userId = null;

// Função para editar campos
function editField(field) {
  const element = document.getElementById(field);

  if (field === 'fotoPerfil') {
    const inputFile = document.getElementById("inputFoto");
    inputFile.click();
    return;
  }

  const currentValue = element.textContent || element.value || "";
  element.innerHTML = `<input type="text" value="${currentValue}" />`;
  const input = element.querySelector('input');
  input.focus();

  input.addEventListener('blur', function () {
    element.innerHTML = input.value;
    updateUserProfile();
  });
}

// Atualizar dados no Firebase
async function updateUserProfile() {
  if (!userId) return;

  const updatedData = {
    nome: document.getElementById("nome").textContent,
    telefone: document.getElementById("telefone").textContent,
    placa: document.getElementById("placa").textContent,
    ano: document.getElementById("ano").textContent,
    rg: document.getElementById("rg").textContent,
    cnh: document.getElementById("cnh").textContent,
    antecedentes: document.getElementById("antecedentes").textContent,
    tipoVeiculo: document.getElementById("tipoVeiculo").textContent,
    crlv: document.getElementById("crlv").textContent,
    cep: document.getElementById("cep").textContent,
    rua: document.getElementById("rua").textContent,
    bairro: document.getElementById("bairro").textContent,
    cidade: document.getElementById("cidade").textContent,
    estado: document.getElementById("estado").textContent,
    dataNascimento: document.getElementById("dataNascimento").textContent,
    cpf: document.getElementById("cpf").textContent,
    email: document.getElementById("email").textContent
  };

  try {
    await db.collection("motoristas").doc(userId).update(updatedData);
    console.log("Dados atualizados com sucesso");
  } catch (error) {
    console.error("Erro ao atualizar dados:", error);
  }
}

// Upload da foto de perfil no Firebase
async function uploadProfilePicture(file) {
  try {
    const ref = storage.ref().child(`fotosPerfil/${userId}`);
    await ref.put(file);
    const url = await ref.getDownloadURL();

    document.getElementById("fotoPerfil").src = url;

    await db.collection("motoristas").doc(userId).update({
      fotoURL: url
    });
  } catch (error) {
    console.error("Erro ao fazer upload da foto:", error);
  }
}

// Carregar dados do usuário logado
auth.onAuthStateChanged(async (user) => {
  if (user) {
    userId = user.uid;

    try {
      const doc = await db.collection("motoristas").doc(userId).get();
      if (doc.exists) {
        const dados = doc.data();

        document.getElementById("nome").textContent = dados.nome || "";
        document.getElementById("telefone").textContent = dados.telefone || "";
        document.getElementById("placa").textContent = dados.placa || "";
        document.getElementById("ano").textContent = dados.ano || "";
        document.getElementById("rg").textContent = dados.rg || "";
        document.getElementById("cnh").textContent = dados.cnh || "";
        document.getElementById("antecedentes").textContent = dados.antecedentes || "";
        document.getElementById("tipoVeiculo").textContent = dados.tipoVeiculo || "";
        document.getElementById("crlv").textContent = dados.crlv || "";
        document.getElementById("cep").textContent = dados.cep || "";
        document.getElementById("rua").textContent = dados.rua || "";
        document.getElementById("bairro").textContent = dados.bairro || "";
        document.getElementById("cidade").textContent = dados.cidade || "";
        document.getElementById("estado").textContent = dados.estado || "";
        document.getElementById("dataNascimento").textContent = dados.dataNascimento || "";
        document.getElementById("cpf").textContent = dados.cpf || "";
        document.getElementById("email").textContent = user.email || "";

        if (dados.fotoURL) {
          document.getElementById("fotoPerfil").src = dados.fotoURL;
        }
      }
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    }

  } else {
    window.location.href = "entrar.html";
  }
});

// Foto de perfil
const inputFoto = document.getElementById("inputFoto");
inputFoto.addEventListener("change", async () => {
  const file = inputFoto.files[0];
  if (file && userId) {
    await uploadProfilePicture(file);
  }
});