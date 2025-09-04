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
    const cidadeInput = document.getElementById("cidade");
    const dataInput = document.getElementById("dataNascimento");
    const fotoPerfil = document.getElementById("fotoPerfil");
    const inputFoto = document.getElementById("inputFoto");

    let userId = null;

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
          if (dados.fotoURL) {
            fotoPerfil.src = dados.fotoURL;
          }
        }
      } else {
        window.location.href = "entrar.html";
      }
    });

    inputFoto.addEventListener("change", async () => {
      const file = inputFoto.files[0];
      if (!file || !userId) return;

      const ref = storage.ref().child(`fotosPerfil/${userId}`);
      await ref.put(file);
      const url = await ref.getDownloadURL();

      fotoPerfil.src = url;
      await db.collection("usuarios").doc(userId).update({
        fotoURL: url
      });
    });

    async function salvar() {
      if (!userId) return;

      await db.collection("usuarios").doc(userId).update({
        nome: nomeInput.value,
        telefone: telefoneInput.value,
        cidade: cidadeInput.value,
        dataNascimento: dataInput.value
      });

      alert("Dados atualizados com sucesso!");
    }

    function logout() {
      auth.signOut().then(() => {
        window.location.href = "entrar.html";
      });
    }