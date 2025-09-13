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
const db = firebase.firestore();
const auth = firebase.auth();

const chatBox = document.getElementById("chat-box");
const messageInput = document.getElementById("message-input");
const sendBtn = document.getElementById("send-btn");

let chatId; // ID do chat, que deve ser obtido via Firebase ou URL

// Função para enviar mensagens
sendBtn.addEventListener("click", () => {
  const message = messageInput.value;
  if (message.trim()) {
    db.collection("chats").doc(chatId).collection("messages").add({
      sender: "motorista", // motorista envia a mensagem
      message: message,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    }).then(() => {
      messageInput.value = "";
    });
  }
});

// Obter o chat do Firebase (usando o chatId)
async function getChat() {
  const chatSnapshot = await db.collection("chats").doc(chatId).get();
  if (chatSnapshot.exists) {
    loadMessages();
  }
}

// Carregar mensagens do Firebase
function loadMessages() {
  db.collection("chats").doc(chatId).collection("messages")
    .orderBy("timestamp")
    .onSnapshot(snapshot => {
      chatBox.innerHTML = "";
      snapshot.forEach(doc => {
        const messageData = doc.data();
        const messageElement = document.createElement("div");
        messageElement.classList.add(messageData.sender);
        messageElement.textContent = messageData.message;
        chatBox.appendChild(messageElement);
      });
      chatBox.scrollTop = chatBox.scrollHeight; // Rola para a última mensagem
    });
}

// Chama a função para iniciar o chat
getChat();
