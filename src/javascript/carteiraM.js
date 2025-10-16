const menuToggle = document.getElementById('menuToggle');
const navMenu = document.getElementById('navMenu');
menuToggle.addEventListener('click', () => navMenu.classList.toggle('show'));

const firebaseConfig = {
  apiKey: "AIzaSyB9ZuAW1F9rBfOtg3hgGpA6H7JFUoiTlhE",
  authDomain: "moomate-39239.firebaseapp.com",
  projectId: "moomate-39239",
  storageBucket: "moomate-39239.appspot.com",
  messagingSenderId: "637968714747",
  appId: "1:637968714747:web:ad15dc3571c22f046b595e",
  measurementId: "G-62J7Q8CKP4"
};

try { if (!firebase.apps.length) firebase.initializeApp(firebaseConfig); } catch {}
const db = firebase.firestore();

function formatBRL(v){
  try { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); } catch { return `R$ ${Number(v||0).toFixed(2)}`; }
}

async function carregarSaldo(uid){
  const valorEl = document.querySelector('.saldo-box .valor');
  try{
    const ref = db.collection('motoristas').doc(uid);
    const snap = await ref.get();
    const saldo = Number(snap.exists ? (snap.data().saldo||0) : 0) || 0;
    if (valorEl) valorEl.textContent = formatBRL(saldo);
  } catch (e){
    console.warn('Falha ao carregar saldo:', e);
    if (valorEl) valorEl.textContent = 'R$0,00';
  }
}

function getUidFallback(){
  return localStorage.getItem('motoristaUid') || localStorage.getItem('uid') || null;
}

document.addEventListener('DOMContentLoaded', ()=>{
  const valorEl = document.querySelector('.saldo-box .valor');
  if (valorEl) valorEl.textContent = 'R$0,00';

  if (firebase.auth) {
    firebase.auth().onAuthStateChanged((user)=>{
      const uid = user?.uid || getUidFallback();
      if (uid) carregarSaldo(uid);
    });
  } else {
    const uid = getUidFallback();
    if (uid) carregarSaldo(uid);
  }
});