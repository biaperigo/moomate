const menuToggle = document.getElementById("menuToggle");
  const navMenu = document.getElementById("navMenu");

menuToggle.addEventListener('click', () => {
      navMenu.classList.toggle('show');
    });
document.addEventListener("DOMContentLoaded", () => {
  // SELEÇÃO DE MOTORISTA
  const cards = document.querySelectorAll(".card-motorista");
  const botaoProximo = document.getElementById("botaoProximo");

  cards.forEach(card => {
    card.addEventListener("click", () => {
      // Remove seleção anterior
      cards.forEach(c => c.classList.remove("selecionado"));
      // Marca o clicado
      card.classList.add("selecionado");

      // Ativa botão PRÓXIMO
      botaoProximo.disabled = false;
      botaoProximo.classList.add("ativo");
    });
  });

  // MODAL DE FORMA DE PAGAMENTO
  const abrirModal = document.getElementById("abrirModalPagamento");
  const modal = document.getElementById("modalPagamento");
  const fecharModal = document.getElementById("fecharModalPagamento");

  if (abrirModal && modal && fecharModal) {
    abrirModal.addEventListener("click", () => {
      modal.classList.remove("hidden");
    });

    fecharModal.addEventListener("click", () => {
      modal.classList.add("hidden");
    });
  }
});
