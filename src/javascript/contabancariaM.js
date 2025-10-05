// contabancariaM.js — salva/recupera dados bancários do motorista
(function(){
  // Menu
  try{
    document.getElementById('menuToggle')?.addEventListener('click', ()=>{
      document.getElementById('navMenu')?.classList.toggle('show');
    });
  }catch{}

  // Firebase compat
  const firebaseConfig = {
    apiKey: "AIzaSyB9ZuAW1F9rBfOtg3hgGpA6H7JFUoiTlhE",
    authDomain: "moomate-39239.firebaseapp.com",
    projectId: "moomate-39239",
    storageBucket: "moomate-39239.appspot.com",
    messagingSenderId: "637968714747",
    appId: "1:637968714747:web:ad15dc3571c22f046b595e",
    measurementId: "G-62J7Q8CKP4"
  };
  try{ if (!firebase.apps.length) firebase.initializeApp(firebaseConfig); }catch{}
  const db = firebase.firestore();

  const form = document.getElementById('form-conta');
  const banco = document.getElementById('banco');
  const agencia = document.getElementById('agencia');
  const conta = document.getElementById('conta');
  const cpf = document.getElementById('cpf');
  const msg = document.getElementById('mensagem');

  function getUid(){
    try { const u = firebase.auth?.().currentUser; if (u?.uid) return u.uid; } catch{}
    return localStorage.getItem('motoristaUid') || localStorage.getItem('uid') || null;
  }

  async function carregar(){
    const uid = getUid(); if (!uid) return;
    try{
      const snap = await db.collection('motoristas').doc(uid).get();
      const d = snap.exists ? (snap.data().dadosBancarios||{}) : {};
      if (d.banco) banco.value = d.banco;
      if (d.agencia) agencia.value = d.agencia;
      if (d.conta) conta.value = d.conta;
      if (d.cpf) cpf.value = d.cpf;
    }catch(e){ console.warn('Falha ao carregar dados bancários:', e); }
  }

  async function salvar(evt){
    evt?.preventDefault?.();
    const uid = getUid(); if (!uid) { alert('Faça login novamente.'); return; }
    const dados = {
      banco: (banco.value||'').trim(),
      agencia: (agencia.value||'').trim(),
      conta: (conta.value||'').trim(),
      cpf: (cpf.value||'').trim()
    };
    try{
      await db.collection('motoristas').doc(uid).set({ dadosBancarios: dados }, { merge: true });
      msg.style.display = 'block';
      msg.textContent = 'Conta salva com sucesso!';
      setTimeout(()=> msg.style.display='none', 2500);
    }catch(e){
      console.error(e);
      msg.style.display = 'block';
      msg.textContent = 'Falha ao salvar. Tente novamente.';
      setTimeout(()=> msg.style.display='none', 3000);
    }
  }

  form?.addEventListener('submit', salvar);
  document.addEventListener('DOMContentLoaded', carregar);
})();
menuToggle.addEventListener('click', () => {
      navMenu.classList.toggle('show');
    });
    
    document.getElementById("form-conta").addEventListener("submit", function(event) {
      event.preventDefault();
      document.getElementById("mensagem").style.display = "block";
      setTimeout(() => {
        document.getElementById("mensagem").style.display = "none";
      }, 3000);
    });