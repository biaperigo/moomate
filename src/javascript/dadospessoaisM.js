/* =========================================================
 * PERFIL DO MOTORISTA — Firestore + Storage (somente auth.uid)
 * =======================================================*/
(() => {
  if (document.body?.dataset.role !== "motorista") return; // só roda na tela de motorista
/* ===== Helpers de máscara/validação ===== */
const onlyDigits = (s = "") => String(s).replace(/\D/g, "");
const maskCPF = (s = "") => onlyDigits(s).slice(0,11)
  .replace(/(\d{3})(\d)/,"$1.$2").replace(/(\d{3})(\d)/,"$1.$2").replace(/(\d{3})(\d{1,2})$/,"$1-$2");
const maskCEP = (s = "") => onlyDigits(s).slice(0,8).replace(/(\d{5})(\d{1,3})/,"$1-$2");
const maskPhoneBR = (s = "") => {
  const n = onlyDigits(s).slice(0,11);
  return n.length>10 ? n.replace(/(\d{2})(\d{5})(\d{4})/,"($1) $2-$3")
                     : n.replace(/(\d{2})(\d{4})(\d{0,4})/,"($1) $2-$3");
};
const maskDateBR = (s = "") => onlyDigits(s).slice(0,8)
  .replace(/(\d{2})(\d)/,"$1/$2").replace(/(\d{2})(\d)/,"$1/$2");
const isDateBR = (s = "") => {
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/); if (!m) return "Data inválida (dd/mm/aaaa)";
  const d=+m[1], mo=+m[2]-1, y=+m[3]; const dt=new Date(y,mo,d);
  return (dt.getFullYear()===y && dt.getMonth()===mo && dt.getDate()===d) || "Data inválida";
};
const maskRG = (s = "") => String(s).replace(/[^\dXx]/g,"").toUpperCase();
const maskPlaca = (s = "") => {
  const v = s.replace(/[^A-Za-z0-9]/g,"").toUpperCase().slice(0,7);
  return /^[A-Z]{3}\d{4}$/.test(v) ? v.slice(0,3)+"-"+v.slice(3) : v;
};

/* ===== Metadados: path + máscara + validação ===== */
const FIELD_META = {
  nome:           { path:"dadosPessoais.nome",            fmt:s=>s,        unfmt:s=>s.trim(),            valid:s=>s.trim().length>=2||"Nome mínimo 2 letras" },
  dataNascimento: { path:"dadosPessoais.dataNascimento",  fmt:maskDateBR,  unfmt:s=>s.trim(),            valid:isDateBR },
  cpf:            { path:"dadosPessoais.cpf",             fmt:maskCPF,     unfmt:onlyDigits,             valid:v=>onlyDigits(v).length===11||"CPF deve ter 11 dígitos" },
  telefone:       { path:"dadosPessoais.telefone",        fmt:maskPhoneBR, unfmt:onlyDigits,             valid:v=>{const n=onlyDigits(v).length;return(n===10||n===11)||"Telefone deve ter 10 ou 11 dígitos"} },
  cep:            { path:"dadosPessoais.endereco.cep",    fmt:maskCEP,     unfmt:onlyDigits,             valid:v=>onlyDigits(v).length===8||"CEP deve ter 8 dígitos" },
  rua:            { path:"dadosPessoais.endereco.rua",    fmt:s=>s,        unfmt:s=>s.trim(),            valid:s=>s.trim().length>=2||"Rua inválida" },
  bairro:         { path:"dadosPessoais.endereco.bairro", fmt:s=>s,        unfmt:s=>s.trim(),            valid:s=>s.trim().length>=2||"Bairro inválido" },
  cidade:         { path:"dadosPessoais.endereco.cidade", fmt:s=>s,        unfmt:s=>s.trim(),            valid:s=>s.trim().length>=2||"Cidade inválida" },
  estado:         { path:"dadosPessoais.endereco.estado", fmt:s=>s.toUpperCase(), unfmt:s=>s.toUpperCase(), valid:s=>/^[A-Z]{2}$/.test(s.trim())||"UF deve ter 2 letras" },
  rg:             { path:"documentacao.rg",               fmt:maskRG,      unfmt:s=>s.replace(/[^\dXx]/g,"").toUpperCase(), valid:s=>s.replace(/[^\dX]/gi,"").length>=7||"RG inválido" },
  cnh:            { path:"documentacao.cnh",              fmt:onlyDigits,  unfmt:onlyDigits,             valid:v=>onlyDigits(v).length===11||"CNH deve ter 11 dígitos" },
  antecedentes:   { path:"documentacao.antecedentes",     fmt:s=>s,        unfmt:s=>s.trim(),            valid:_=>true },
  tipoVeiculo:    { path:"veiculo.tipo",                  fmt:s=>s,        unfmt:s=>s.trim(),            valid:s=>s.trim().length>=2||"Tipo inválido" },
  placa:          { path:"veiculo.placa",                 fmt:maskPlaca,   unfmt:s=>s.replace(/[^A-Z0-9]/gi,"").toUpperCase(), valid:s=>s.replace(/[^A-Z0-9]/gi,"").length===7||"Placa deve ter 7 caracteres" },
  crlv:           { path:"veiculo.crlv",                  fmt:s=>s,        unfmt:s=>s.trim(),            valid:_=>true },
  ano:            { path:"veiculo.ano",                   fmt:s=>String(s).replace(/\D/g,"").slice(0,4), unfmt:s=>String(s).replace(/\D/g,""), valid:s=>{const y=+String(s).replace(/\D/g,"");return y>=1900&&y<=2099||"Ano inválido"} }
};

/* ===== UI: mensagens ===== */
function mostrarMensagem(texto, tipo){
  document.querySelector('.mensagem-feedback')?.remove();
  const el=document.createElement('div');
  el.className=`mensagem-feedback ${tipo}`; el.textContent=texto;
  el.style.cssText=`position:fixed;top:20px;right:20px;padding:12px 20px;border-radius:8px;color:#fff;font-weight:500;z-index:1000;animation:slideIn .3s ease-out;max-width:300px`;
  el.style.backgroundColor = tipo==='sucesso'?'#28a745':tipo==='erro'?'#dc3545':tipo==='aviso'?'#ffc107':'#007bff';
  if(!document.querySelector('#mensagem-styles')){const s=document.createElement('style');s.id='mensagem-styles';s.textContent='@keyframes slideIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}@keyframes slideOut{from{transform:translateX(0);opacity:1}to{transform:translateX(100%);opacity:0}}';document.head.appendChild(s);}
  document.body.appendChild(el); setTimeout(()=>{el.style.animation='slideOut .3s ease-in'; setTimeout(()=>el.remove(),300)},4000);
}

/* ===== Firebase (compat) ===== */
const firebaseConfig = {
  apiKey:"AIzaSyB9ZuAW1F9rBfOtg3hgGpA6H7JFUoiTlhE",
  authDomain:"moomate-39239.firebaseapp.com",
  projectId:"moomate-39239",
  storageBucket:"moomate-39239.appspot.com",
  messagingSenderId:"637968714747",
  appId:"1:637968714747:web:ad15dc3571c22f046b595e",
  measurementId:"G-62J7Q8CKP4"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.firestore();
const storage = firebase.storage();

/* ===== DOM ===== */
const nomeSpan = document.getElementById("nome");
const dataNascimentoSpan = document.getElementById("dataNascimento");
const cpfSpan = document.getElementById("cpf");
const emailSpan = document.getElementById("email");
const telefoneSpan = document.getElementById("telefone");
const cepSpan = document.getElementById("cep");
const ruaSpan = document.getElementById("rua");
const bairroSpan = document.getElementById("bairro");
const cidadeSpan = document.getElementById("cidade");
const estadoSpan = document.getElementById("estado");
const rgSpan = document.getElementById("rg");
const cnhSpan = document.getElementById("cnh");
const antecedentesSpan = document.getElementById("antecedentes");
const tipoVeiculoSpan = document.getElementById("tipoVeiculo");
const placaSpan = document.getElementById("placa");
const crlvSpan = document.getElementById("crlv");
const anoSpan = document.getElementById("ano");
const fotoPerfilImg = document.getElementById("fotoPerfil");
const inputFotoPerfil = document.getElementById("inputFoto");
const fotoVeiculoImg = document.getElementById("fotoVeiculo");

/* ===== Placeholder p/ imagens ===== */
const PLACEHOLDER = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5YII=";
function applyImageFallback(img){ if(!img) return; img.addEventListener("error",function onErr(){ img.removeEventListener("error",onErr); img.src=PLACEHOLDER; },{once:true}); }
applyImageFallback(fotoPerfilImg); applyImageFallback(fotoVeiculoImg);

/* ===== Render ===== */
function renderMotorista(d = {}){
  const dp=d.dadosPessoais||{}, end=dp.endereco||{}, docu=d.documentacao||{}, vei=d.veiculo||{};
  nomeSpan.textContent           = FIELD_META.nome.fmt(dp.nome || "");
  dataNascimentoSpan.textContent = FIELD_META.dataNascimento.fmt(dp.dataNascimento || "");
  cpfSpan.textContent            = FIELD_META.cpf.fmt(dp.cpf || "");
  telefoneSpan.textContent       = FIELD_META.telefone.fmt(dp.telefone || "");
  cepSpan.textContent            = FIELD_META.cep.fmt(end.cep || "");
  ruaSpan.textContent            = FIELD_META.rua.fmt(end.rua || "");
  bairroSpan.textContent         = FIELD_META.bairro.fmt(end.bairro || "");
  cidadeSpan.textContent         = FIELD_META.cidade.fmt(end.cidade || "");
  estadoSpan.textContent         = FIELD_META.estado.fmt(end.estado || "");
  rgSpan.textContent             = FIELD_META.rg.fmt(docu.rg || "");
  cnhSpan.textContent            = FIELD_META.cnh.fmt(docu.cnh || "");
  antecedentesSpan.textContent   = FIELD_META.antecedentes.fmt(docu.antecedentes || "");
  tipoVeiculoSpan.textContent    = FIELD_META.tipoVeiculo.fmt(vei.tipo || "");
  placaSpan.textContent          = FIELD_META.placa.fmt(vei.placa || "");
  crlvSpan.textContent           = FIELD_META.crlv.fmt(vei.crlv || "");
  anoSpan.textContent            = FIELD_META.ano.fmt(vei.ano || "");
  if (d.fotoPerfilUrl)  fotoPerfilImg.src  = d.fotoPerfilUrl;
  if (d.fotoVeiculoUrl) fotoVeiculoImg.src = d.fotoVeiculoUrl;
}
function limparUI(){
  [nomeSpan,dataNascimentoSpan,cpfSpan,emailSpan,telefoneSpan,cepSpan,ruaSpan,bairroSpan,cidadeSpan,estadoSpan,rgSpan,cnhSpan,antecedentesSpan,tipoVeiculoSpan,placaSpan,crlvSpan,anoSpan].forEach(el=>{ if(el) el.textContent=""; });
  fotoPerfilImg?.removeAttribute("src"); fotoVeiculoImg?.removeAttribute("src");
}

/* ===== Edição inline ===== */
function editField(fieldId){
  const span=document.getElementById(fieldId);
  if(!span || fieldId==='email') return;
  const meta=FIELD_META[fieldId] || {fmt:s=>s,unfmt:s=>s,valid:_=>true,path:fieldId};

  const originalValue = span.textContent || "";
  const input=document.createElement('input');
  input.type='text'; input.value=meta.fmt(originalValue);
  input.className='edit-input'; input.autocomplete='off'; input.inputMode='text';
  input.addEventListener('input',()=>{ const pos=input.selectionStart; input.value=meta.fmt(input.value); try{input.setSelectionRange(pos,pos);}catch{} });

  span.replaceWith(input); input.focus();

  const saveBtn=document.createElement('button'); saveBtn.className='save-btn'; saveBtn.innerHTML='<i class="fa-solid fa-check"></i>';
  const cancelBtn=document.createElement('button'); cancelBtn.className='cancel-btn'; cancelBtn.innerHTML='<i class="fa-solid fa-xmark"></i>';

  saveBtn.onclick=()=>saveField(fieldId,input,span,saveBtn,cancelBtn);
  cancelBtn.onclick=()=>cancelEdit(fieldId,input,span,saveBtn,cancelBtn,originalValue);

  const editButton=(input.parentElement||document).querySelector('.edit-btn');
  if(editButton) editButton.replaceWith(saveBtn,cancelBtn);
}
async function saveField(fieldId,inputElement,originalSpan,saveButton,cancelButton){
  if(!auth.currentUser) return;
  const uid = auth.currentUser.uid;
  const ref = db.collection("motoristas").doc(uid);

  const meta=FIELD_META[fieldId] || {path:fieldId,unfmt:s=>s,fmt:s=>s,valid:_=>true};
  const shown=(inputElement.value||"").trim();
  const ok=meta.valid(shown); if(ok!==true){ mostrarMensagem(ok,"erro"); return; }
  const newValue=meta.unfmt(shown);

  try{
    await ref.set({ [meta.path]: newValue }, { merge:true }); // merge para não perder outras chaves
    originalSpan.textContent = meta.fmt(newValue);
    inputElement.replaceWith(originalSpan);
    const btn=document.createElement('button'); btn.className='edit-btn'; btn.innerHTML='<i class="fa-solid fa-paintbrush"></i>'; btn.onclick=()=>editField(fieldId);
    saveButton.replaceWith(btn); cancelButton.remove();
    mostrarMensagem("Atualizado.","sucesso");
  }catch(e){ console.error(e); mostrarMensagem("Falha ao salvar.","erro"); }
}
function cancelEdit(fieldId,inputElement,originalSpan,saveButton,cancelButton,originalValue){
  const fmt=FIELD_META[fieldId]?.fmt || (s=>s);
  originalSpan.textContent=fmt(originalValue);
  inputElement.replaceWith(originalSpan);
  const btn=document.createElement('button'); btn.className='edit-btn'; btn.innerHTML='<i class="fa-solid fa-paintbrush"></i>'; btn.onclick=()=>editField(fieldId);
  saveButton.replaceWith(btn); cancelButton.remove();
}

/* ===== Upload fotos (sempre no doc do próprio UID) ===== */
async function uploadPhoto(fileInput,imgElement,firebasePath,urlField){
  const user=auth.currentUser; if(!user) return;
  const file=fileInput?.files?.[0]; if(!file) return;
  if(!file.type.startsWith('image/')){ mostrarMensagem("Selecione uma imagem.","erro"); return; }
  if(file.size>5*1024*1024){ mostrarMensagem("Máx. 5MB.","erro"); return; }

  const ref = storage.ref(`${firebasePath}/${user.uid}/${file.name}`);
  const task = ref.put(file);
  task.on('state_changed',
    s=>mostrarMensagem(`Upload ${Math.round(100*s.bytesTransferred/s.totalBytes)}%`,"info"),
    e=>{ console.error(e); mostrarMensagem("Upload falhou.","erro"); },
    async()=>{ const url=await task.snapshot.ref.getDownloadURL(); imgElement.src=url;
      await db.collection("motoristas").doc(user.uid).set({ [urlField]: url }, { merge:true });
      mostrarMensagem("Foto atualizada.","sucesso");
    }
  );
}

/* ===== Auth + live load (somente motoristas/{auth.uid}) ===== */
const LOGIN_URL = "entrar.html";
auth.onAuthStateChanged(async (user)=>{
  if(!user){ location.replace(LOGIN_URL); return; }
  if(emailSpan) emailSpan.textContent = user.email || "";

  const ref = db.collection("motoristas").doc(user.uid);

  // Checa uma vez
  const once = await ref.get();
  if(!once.exists){
    limparUI();
    mostrarMensagem("Cadastro de motorista não encontrado para este login.", "aviso");
  } else {
    renderMotorista(once.data()||{});
  }

  // Live updates
  ref.onSnapshot(
    (snap)=>{ if(snap.exists) renderMotorista(snap.data()||{}); },
    (err)=>{ console.error(err); mostrarMensagem("Sem permissão para ler seus dados de motorista.","erro"); }
  );
});

/* ===== Listeners de upload ===== */
document.querySelector('.profile-item button[onclick="editField(\'fotoPerfil\')"]')
  ?.addEventListener('click', ()=> inputFotoPerfil?.click());
inputFotoPerfil?.addEventListener('change', ()=> uploadPhoto(inputFotoPerfil, fotoPerfilImg, 'profile_pictures', 'fotoPerfilUrl'));

document.querySelector('.profile-item button[onclick="editField(\'fotoVeiculo\')"]')
  ?.addEventListener('click', ()=>{
    const f=document.createElement('input'); f.type='file'; f.style.display='none';
    document.body.appendChild(f); f.click();
    f.addEventListener('change', ()=>{ uploadPhoto(f, fotoVeiculoImg, 'vehicle_pictures', 'fotoVeiculoUrl'); document.body.removeChild(f); });
  });

/* ===== Menu ===== */
document.addEventListener('DOMContentLoaded', ()=>{
  const menuToggle=document.getElementById('menuToggle');
  const navMenu=document.getElementById('navMenu');
  if(menuToggle&&navMenu) menuToggle.addEventListener('click', ()=> navMenu.classList.toggle('active'));
});

/* ===== Regras recomendadas (Firestore):
match /databases/{db}/documents {
  match /motoristas/{uid} {
    allow read, write: if request.auth != null && request.auth.uid == uid;
  }
}
===== */
})();