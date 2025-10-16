
function abrirModalPix() {
  const modal = document.getElementById("modalPix");
  modal.classList.remove("hidden");

  const qrcodeContainer = document.getElementById("qrcode");
  qrcodeContainer.innerHTML = ""; 

  const codigoPix = document.getElementById("codigoPixTexto").textContent;

  new QRCode(qrcodeContainer, {
    text: codigoPix,
    width: 200,
    height: 200,
    colorDark: "#000000",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.H,
  });
}


function fecharModalPix() {
  const modal = document.getElementById("modalPix");
  modal.classList.add("hidden");
}


function copiarCodigoPix() {
  const codigo = document.getElementById("codigoPixTexto").textContent;
  const aviso = document.getElementById("copiadoAviso");

  navigator.clipboard.writeText(codigo).then(() => {
    aviso.style.display = "inline";
    setTimeout(() => {
      aviso.style.display = "none";
    }, 2000);
  });
}


document.addEventListener("DOMContentLoaded", () => {
  const botaoPagar = document.querySelector(".botao-pagar");
  if (botaoPagar) {
    botaoPagar.addEventListener("click", abrirModalPix);
  }
});
function abrirModalConfirmado() {
  document.getElementById('modalConfirmado').classList.remove('hidden');
}

function fecharModalConfirmado() {
  document.getElementById('modalConfirmado').classList.add('hidden');
}

window.history.pushState(null, "", window.location.href);
window.onpopstate = function () {
  window.history.pushState(null, "", window.location.href);
};
