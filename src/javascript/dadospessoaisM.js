menuToggle.addEventListener('click', () => {
      navMenu.classList.toggle('show');
    });

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
const storage = firebase.storage();

const nomeInput = document.getElementById("nome");
const emailInput = document.getElementById("email");
const telefoneInput = document.getElementById("telefone");
const placaInput = document.getElementById("placa");
const renavamInput = document.getElementById("renavam");
const anoInput = document.getElementById("ano");
const fotoPerfil = document.getElementById("fotoPerfil");
const inputFoto = document.getElementById("inputFoto");

let userId = null;

// Função para editar campos
function editField(field) {
  const element = document.getElementById(field);
  
  if (field === 'fotoPerfil') {
    const inputFile = document.createElement('input');
    inputFile.type = 'file';
    inputFile.accept = 'image/*';
    
    inputFile.onchange = async function (event) {
      const file = event.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = function () {
          element.src = reader.result;
        };
        reader.readAsDataURL(file);
        await uploadProfilePicture(file);
      }
    };
    
    inputFile.click();
    return;
  }
  
  const currentValue = element.textContent || element.value;
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

  await db.collection("motoristas").doc(userId).update({
    nome: nomeInput.value,
    telefone: telefoneInput.value,
    placa: placaInput.value,
    renavam: renavamInput.value,
    ano: anoInput.value
  });

  alert("Dados atualizados com sucesso!");
}

// Upload da foto de perfil no Firebase
async function uploadProfilePicture(file) {
  const ref = storage.ref().child(`fotosPerfil/${userId}`);
  await ref.put(file);
  const url = await ref.getDownloadURL();

  fotoPerfil.src = url;
  await db.collection("motoristas").doc(userId).update({
    fotoURL: url
  });
}

// Função de logout
function logout() {
  auth.signOut().then(() => {
    window.location.href = "entrar.html";
  });
}

// Verificação de autenticação e carregamento dos dados do motorista
auth.onAuthStateChanged(async (user) => {
  if (user) {
    userId = user.uid;
    emailInput.value = user.email;

    const doc = await db.collection("motoristas").doc(userId).get();
    if (doc.exists) {
      const dados = doc.data();
      nomeInput.value = dados.nome || "";
      telefoneInput.value = dados.telefone || "";
      placaInput.value = dados.placa || "";
      renavamInput.value = dados.renavam || "";
      anoInput.value = dados.ano || "";
      if (dados.fotoURL) {
        fotoPerfil.src = dados.fotoURL;
      }
    }
  } else {
    window.location.href = "entrar.html";
  }
});

// Atualiza dados ao alterar a foto
inputFoto.addEventListener("change", async () => {
  const file = inputFoto.files[0];
  if (!file || !userId) return;

  await uploadProfilePicture(file);
});
