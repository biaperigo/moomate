const form = document.getElementById("form-adicionar");
const metodo = document.getElementById("metodo");
const resultado = document.getElementById("resultado");
const toast = document.getElementById("toast");

// MODAL SUCESSO
const modalSucesso = document.createElement("div");
modalSucesso.classList.add("modal-sucesso", "hidden");
modalSucesso.innerHTML = `
  
<!-- MODAL DE PAGAMENTO EFETUADO COM SUCESSO  -->
<div id="modal-sucesso" class="modal-sucesso hidden">
  <div class="modal-conteudo-sucesso">
    <img src="src/images/pagamentoefetuado.png" alt="Pagamento Sucesso" class="imagem-sucesso" />
    <h3>Pagamento Efetuado!</h3>
    <p>O valor foi adicionado com sucesso à sua carteira.</p>
    <div class="botoes-modal">
      <a href="carteiraC.html" class="botao-principal">Ir para a Carteira</a>
    </div>
  </div>
</div>
`;
document.body.appendChild(modalSucesso);

function mostrarModalSucesso() {
  modalSucesso.classList.remove("hidden");

  // Impede voltar usando botão do navegador
  history.pushState(null, "", location.href);
  window.onpopstate = () => {
    history.pushState(null, "", location.href);
  };
}

form.addEventListener("submit", function (e) {
  e.preventDefault();
  const tipo = metodo.value;
  resultado.innerHTML = "";
  resultado.style.display = "block";

  if (tipo === "pix") {
    resultado.innerHTML = `
      <h2 class="metodo-title">Pagamento via PIX</h2>
      <img src="src/images/qrcodepix.png" alt="QR Code Pix" class="qr-img">
      <p class="copiar" id="btnCopiar"><i class="fa-solid fa-copy"></i> Copiar</p>
      <span id="codigoPix" style="display:none;">chave-pix-exemplo@moomate.com.br</span>
    `;

    document.getElementById("btnCopiar").addEventListener("click", () => {
      const codigo = document.getElementById("codigoPix").textContent;
      navigator.clipboard.writeText(codigo).then(() => {
        toast.classList.add("show");
        setTimeout(() => {
          toast.classList.remove("show");
        }, 2000);
      });
    });

    document.getElementById("finalizarPix").addEventListener("click", () => {
      mostrarModalSucesso();
    });

  } else {
    resultado.innerHTML = `
      <h2 class="metodo-title">Adicionar Cartão</h2>
      <form class="form-cartao" id="formCartao">
        <input type="text" placeholder="Número do Cartão" required>
        <div class="cartao-linha">
          <input type="text" placeholder="MM/YY" required>
          <input type="text" placeholder="CVV" required>
        </div>
        <button class="btn-salvar" type="submit">Salvar</button>
      </form>
    `;

    document.getElementById("formCartao").addEventListener("submit", function (e) {
      e.preventDefault();
      mostrarModalSucesso();
    });
  }
});

// Menu Mobile
document.getElementById("menuToggle").addEventListener("click", () => {
  document.getElementById("navMenu").classList.toggle("show");
});
