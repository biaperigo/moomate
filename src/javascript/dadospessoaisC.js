// ===== Firebase =====
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
const db   = firebase.firestore();

// ===== DOM =====
const nomeInput     = document.getElementById("nome");
const emailInput    = document.getElementById("email");
const telefoneInput = document.getElementById("telefone");
const cidadeInput   = document.getElementById("cidade");
const dataInput     = document.getElementById("dataNascimento");
const fotoPerfil    = document.getElementById("fotoPerfil");
const inputFoto     = document.getElementById("inputFoto");

let userId = null;
let dadosOriginais = {};

// ===== Helpers =====
const onlyDigits = s => String(s||"").replace(/\D/g,"");
function formatarTelefone(v){
  const n = onlyDigits(v).slice(0,11);
  if (n.length===11) return n.replace(/(\d{2})(\d{5})(\d{4})/,"($1) $2-$3");
  if (n.length===10) return n.replace(/(\d{2})(\d{4})(\d{4})/,"($1) $2-$3");
  return v||"";
}
function toast(txt, tipo="info"){
  document.querySelector(".mensagem-feedback")?.remove();
  const el=document.createElement("div");
  el.className=`mensagem-feedback ${tipo}`;
  el.textContent=txt;
  el.style.cssText="position:fixed;top:20px;right:20px;padding:12px 20px;border-radius:8px;color:#fff;z-index:1000;animation:slideIn .3s ease-out";
  el.style.backgroundColor = tipo==="sucesso"?"#28a745":tipo==="erro"?"#dc3545":"#007bff";
  if(!document.getElementById("mensagem-styles")){
    const s=document.createElement("style"); s.id="mensagem-styles";
    s.textContent=`@keyframes slideIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}
                   @keyframes slideOut{from{transform:translateX(0);opacity:1}to{transform:translateX(100%);opacity:0}}`;
    document.head.appendChild(s);
  }
  document.body.appendChild(el);
  setTimeout(()=>{ el.style.animation="slideOut .3s"; setTimeout(()=>el.remove(),300); },4000);
}

// máscara ao digitar telefone
telefoneInput?.addEventListener("input", e => e.target.value = formatarTelefone(e.target.value));

// ===== Auth: carrega e observa SOMENTE usuarios/{uid} =====
auth.onAuthStateChanged(async (user) => {
  if (!user) { window.location.href = "entrar.html"; return; }
  userId = user.uid;

  emailInput.value = user.email || "";
  emailInput.disabled = true;
  emailInput.readOnly = true;

  const local = localStorage.getItem(`fotoPerfil_${userId}`);
  if (local && fotoPerfil) fotoPerfil.src = local;

  try {
    const ref = db.collection("usuarios").doc(userId);
    const snap = await ref.get();
    const dados = snap.exists ? (snap.data()||{}) : {};

    dadosOriginais = {
      nome: dados.nome || "",
      telefone: dados.telefone || "",
      cidade: dados.cidade || "",
      dataNascimento: dados.dataNascimento || "",
      email: user.email || ""
    };

    nomeInput.value     = dadosOriginais.nome;
    telefoneInput.value = formatarTelefone(dadosOriginais.telefone);
    cidadeInput.value   = dadosOriginais.cidade;
    dataInput.value     = dadosOriginais.dataNascimento;

    ref.onSnapshot(s => {
      if (!s.exists) return;
      const d = s.data()||{};
      if (typeof d.nome !== "undefined")            nomeInput.value     = d.nome;
      if (typeof d.telefone !== "undefined")        telefoneInput.value = formatarTelefone(d.telefone);
      if (typeof d.cidade !== "undefined")          cidadeInput.value   = d.cidade;
      if (typeof d.dataNascimento !== "undefined")  dataInput.value     = d.dataNascimento;

      dadosOriginais.nome           = typeof d.nome !== "undefined" ? d.nome : dadosOriginais.nome;
      dadosOriginais.telefone       = typeof d.telefone !== "undefined" ? d.telefone : dadosOriginais.telefone;
      dadosOriginais.cidade         = typeof d.cidade !== "undefined" ? d.cidade : dadosOriginais.cidade;
      dadosOriginais.dataNascimento = typeof d.dataNascimento !== "undefined" ? d.dataNascimento : dadosOriginais.dataNascimento;
    });
  } catch (e) {
    console.error(e);
    toast("Erro ao carregar dados do perfil.","erro");
  }
});

// ===== Controles ✔ / ✖ =====
function addControls(container, campoId){
  container.querySelector(".ok-btn")?.remove();
  container.querySelector(".cancel-btn")?.remove();

  const ok = document.createElement("button");
  ok.className = "ok-btn";
  ok.innerHTML = '<i class="fa-solid fa-check"></i>';
  ok.style.marginLeft = "8px";

  const cancel = document.createElement("button");
  cancel.className = "cancel-btn";
  cancel.innerHTML = '<i class="fa-solid fa-xmark"></i>';
  cancel.style.marginLeft = "6px";

  const alvo = container.querySelector('.edit-icon') || container.lastElementChild;
  alvo.insertAdjacentElement("afterend", cancel);
  cancel.insertAdjacentElement("afterend", ok);

  ok.onclick     = () => salvarCampoIndividual(campoId);
  cancel.onclick = () => cancelarEdicao(campoId);
}

function habilitarEdicao(campoId){
  if (campoId==="email") return;
  const campo  = document.getElementById(campoId);
  if (!campo) return;
  const wrap   = campo.closest(".input-wrapper") || campo.parentElement;

  if (campo.disabled) {
    campo.disabled = false;
    campo.focus();
    const lapis = wrap.querySelector(".edit-icon");
    lapis?.classList.remove("fa-pencil");
    lapis?.classList.add("fa-pen-to-square");
    addControls(wrap, campoId);
  } else {
    addControls(wrap, campoId);
  }
}

async function salvarCampoIndividual(campoId){
  if (!userId) return;
  const campo  = document.getElementById(campoId);
  const wrap   = campo.closest(".input-wrapper") || campo.parentElement;
  let valor = (campo.value || "").trim();

  // obrigatórios: nome e email (email já fixo)
  if (campoId==="nome" && valor.length<2){ toast("Nome deve ter pelo menos 2 caracteres.","erro"); return; }

  // validações
  if (campoId==="telefone"){
    const n = onlyDigits(valor);
    if (n.length<10 || n.length>11){ toast("Telefone deve ter 10 ou 11 dígitos.","erro"); return; }
    valor = n;
  }
  if (campoId==="cidade" && valor && valor.length<2){ toast("Cidade deve ter pelo menos 2 caracteres.","erro"); return; }

  try{
    await db.collection("usuarios").doc(userId).set({ [campoId]: valor }, { merge:true });

    dadosOriginais[campoId] = valor;

    campo.disabled = true;
    wrap.querySelector(".ok-btn")?.remove();
    wrap.querySelector(".cancel-btn")?.remove();
    const lapis = wrap.querySelector(".edit-icon");
    lapis?.classList.remove("fa-pen-to-square");
    lapis?.classList.add("fa-pencil");

    if (campoId==="telefone") campo.value = formatarTelefone(valor);

    toast("Campo atualizado com sucesso!","sucesso");
  }catch(e){
    console.error(e);
    toast("Erro ao salvar alteração.","erro");
  }
}

function cancelarEdicao(campoId){
  const campo  = document.getElementById(campoId);
  const wrap   = campo.closest(".input-wrapper") || campo.parentElement;
  const antigo = dadosOriginais[campoId] ?? "";
  campo.value = (campoId==="telefone") ? formatarTelefone(antigo) : antigo;

  campo.disabled = true;
  wrap.querySelector(".ok-btn")?.remove();
  wrap.querySelector(".cancel-btn")?.remove();
  const lapis = wrap.querySelector(".edit-icon");
  lapis?.classList.remove("fa-pen-to-square");
  lapis?.classList.add("fa-pencil");
}

// ESC cancela campo ativo
document.addEventListener("keydown", e=>{
  if (e.key !== "Escape") return;
  ["nome","telefone","cidade","dataNascimento"].forEach(id=>{
    const el=document.getElementById(id);
    if(el && !el.disabled) cancelarEdicao(id);
  });
});

// ===== Foto (localStorage) =====
function atualizarFoto(){ // compat com onchange no HTML
  const f = inputFoto?.files?.[0];
  if(!f) return;
  if(!f.type.startsWith("image/")){ toast("Selecione uma imagem.","erro"); return; }
  if(f.size>5*1024*1024){ toast("A imagem deve ter no máximo 5MB.","erro"); return; }
  const rd=new FileReader();
  rd.onloadend=()=>{
    if(fotoPerfil) fotoPerfil.src = rd.result;
    if(userId) localStorage.setItem(`fotoPerfil_${userId}`, rd.result);
    toast("Foto atualizada.","sucesso");
  };
  rd.readAsDataURL(f);
}
inputFoto?.addEventListener("change", atualizarFoto);

// ===== Salvar tudo (opcional) =====
async function salvar(){
  if (!userId) return;
  const dados = {
    nome: (nomeInput.value||"").trim(),
    telefone: onlyDigits(telefoneInput.value||""),
    cidade: (cidadeInput.value||"").trim(),
    dataNascimento: (dataInput.value||"").trim()
  };
  if (!emailInput.value){ toast("Email é obrigatório.","erro"); return; }
  if (dados.nome.length < 2){ toast("Nome deve ter pelo menos 2 caracteres.","erro"); return; }
  if (dados.telefone && (dados.telefone.length<10 || dados.telefone.length>11)){
    toast("Telefone deve ter 10 ou 11 dígitos.","erro"); return;
  }
  if (dados.cidade && dados.cidade.length<2){ toast("Cidade deve ter pelo menos 2 caracteres.","erro"); return; }

  try{
    await db.collection("usuarios").doc(userId).set(dados, { merge:true });
    dadosOriginais = { ...dados, email: emailInput.value };
    telefoneInput.value = formatarTelefone(dados.telefone);
    toast("Dados atualizados com sucesso!","sucesso");
  }catch(e){
    console.error(e);
    toast("Erro ao salvar os dados.","erro");
  }
}

// ===== Logout =====
function logout(){
  auth.signOut().then(()=>{
    if (userId) localStorage.removeItem(`fotoPerfil_${userId}`);
    window.location.href="entrar.html";
  }).catch(e=>{ console.error(e); toast("Erro ao sair.","erro"); });
}
