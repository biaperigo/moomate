
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

document.addEventListener('DOMContentLoaded', () => {

  const menuToggle = document.getElementById('menuToggle');
  const navMenu = document.getElementById('navMenu');
  
  if (menuToggle && navMenu) {
    menuToggle.addEventListener('click', () => {
      navMenu.classList.toggle('show');
    });
  }

  auth.onAuthStateChanged((user) => {
    if (!user) {
      window.location.href = 'loginM.html';
      return;
    }
    
    console.log('Motorista logado:', user.uid);
    setupPasswordChange(user);
  });

  const btnSair = document.querySelector('.btn-sair');
  if (btnSair) {
    btnSair.addEventListener('click', handleLogout);
  }


  const notificationsToggle = document.querySelector('.switch input[type="checkbox"]');
  if (notificationsToggle) {
    loadNotificationSettings();
    
    notificationsToggle.addEventListener('change', (e) => {
      saveNotificationSettings(e.target.checked);
    });
  }
});

function setupPasswordChange(user) {
  const senhaAtualInput = document.getElementById('senhaAtual');
  const novaSenhaInput = document.getElementById('novaSenha');
  
  let btnSalvarSenha = document.querySelector('.btn-salvar-senha');
  if (!btnSalvarSenha) {
    btnSalvarSenha = document.createElement('button');
    btnSalvarSenha.textContent = 'Alterar Senha';
    btnSalvarSenha.className = 'btn-salvar-senha';
    btnSalvarSenha.style.cssText = `
      background-color: #ff6c0c;
      color: white;
      border: none;
      padding: 0.8rem 2rem;
      border-radius: 6px;
      cursor: pointer;
      font-size: 1rem;
      transition: background 0.3s;
      display: block;
      margin: 2rem auto;
    `;

    novaSenhaInput.parentNode.parentNode.appendChild(btnSalvarSenha);
  }
  
  btnSalvarSenha.addEventListener('click', () => {
    handlePasswordChange(user, senhaAtualInput.value, novaSenhaInput.value);
  });
}

async function handlePasswordChange(user, currentPassword, newPassword) {
  if (!currentPassword || !newPassword) {
    showMessage('Por favor, preencha todos os campos de senha.', 'error');
    return;
  }
  
  if (newPassword.length < 6) {
    showMessage('A nova senha deve ter pelo menos 6 caracteres.', 'error');
    return;
  }
  
  try {
    const credential = firebase.auth.EmailAuthProvider.credential(user.email, currentPassword);
    
    await user.reauthenticateWithCredential(credential);
    await user.updatePassword(newPassword);
    
    showMessage('Senha alterada com sucesso!', 'success');
    
    document.getElementById('senhaAtual').value = '';
    document.getElementById('novaSenha').value = '';
    
  } catch (error) {
    console.error('Erro ao alterar senha:', error);
    
    let errorMessage = 'Erro ao alterar senha. ';
    switch (error.code) {
      case 'auth/wrong-password':
        errorMessage += 'Senha atual incorreta.';
        break;
      case 'auth/weak-password':
        errorMessage += 'A nova senha é muito fraca.';
        break;
      case 'auth/too-many-requests':
        errorMessage += 'Muitas tentativas. Tente novamente mais tarde.';
        break;
      case 'auth/requires-recent-login':
        errorMessage += 'Por segurança, faça login novamente antes de alterar a senha.';
        break;
      default:
        errorMessage += error.message;
    }
    
    showMessage(errorMessage, 'error');
  }
}

async function handleLogout() {
  if (confirm('Tem certeza que deseja sair?')) {
    try {
      await auth.signOut();
      showMessage('Logout realizado com sucesso!', 'success');
      
      setTimeout(() => {
        window.location.href = 'loginM.html';
      }, 1000);
      
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      showMessage('Erro ao fazer logout: ' + error.message, 'error');
    }
  }
}

async function loadNotificationSettings() {
  try {
    const user = auth.currentUser;
    if (!user) return;

    const doc = await db.collection('motoristas').doc(user.uid).get();
    if (doc.exists) {
      const data = doc.data();
      const notificationsEnabled = data.notificacoesHabilitadas !== false; 
      
      const checkbox = document.querySelector('.switch input[type="checkbox"]');
      if (checkbox) {
        checkbox.checked = notificationsEnabled;
      }
    }
  } catch (error) {
    console.error('Erro ao carregar configurações de notificação:', error);
  }
}

async function saveNotificationSettings(enabled) {
  try {
    const user = auth.currentUser;
    if (!user) return;
    await db.collection('motoristas').doc(user.uid).update({
      notificacoesHabilitadas: enabled,
      configuracaoAtualizada: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    showMessage(`Notificações ${enabled ? 'ativadas' : 'desativadas'} com sucesso!`, 'success');
    
  } catch (error) {
    console.error('Erro ao salvar configurações de notificação:', error);
    showMessage('Erro ao salvar configurações de notificação.', 'error');
  }
}

function showMessage(message, type) {
  const existingMessage = document.querySelector('.message');
  if (existingMessage) {
    existingMessage.remove();
  }
  
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message';
  messageDiv.textContent = message;
  messageDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 15px 20px;
    border-radius: 5px;
    color: white;
    font-weight: bold;
    z-index: 1000;
    max-width: 300px;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    ${type === 'success' ? 'background-color: #ff6c0c;' : 'background-color: #f44336;'}
  `;
  
  document.body.appendChild(messageDiv);
  
  setTimeout(() => {
    if (messageDiv.parentNode) {
      messageDiv.remove();
    }
  }, 4000);
}