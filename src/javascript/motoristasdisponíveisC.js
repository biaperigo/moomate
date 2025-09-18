const menuToggle = document.getElementById("menuToggle");
  const navMenu = document.getElementById("navMenu");

menuToggle.addEventListener('click', () => {
      navMenu.classList.toggle('show');
    });
document.addEventListener("DOMContentLoaded", () => {
  const cards = document.querySelectorAll(".card-motorista");
  const botaoProximo = document.getElementById("botaoProximo");

  cards.forEach(card => {
    card.addEventListener("click", () => {
      cards.forEach(c => c.classList.remove("selecionado"));
      card.classList.add("selecionado");

      botaoProximo.disabled = false;
      botaoProximo.classList.add("ativo");
    });
  });

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
