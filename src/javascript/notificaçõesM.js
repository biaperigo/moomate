
    const menuToggle = document.getElementById('menuToggle');
    const navMenu = document.getElementById('navMenu');
    menuToggle.addEventListener('click', () => {
      navMenu.classList.toggle('show');
    });
    
    const modal = document.getElementById("modalConfirm");
    const btnClear = document.getElementById("clearBtn");
    const btnConfirm = document.getElementById("confirmDelete");
    const btnCancel = document.getElementById("cancelDelete");
    const lista = document.getElementById("listaNotificacoes");
    const vazio = document.getElementById("mensagemVazia");

    btnClear.addEventListener("click", () => {
      modal.style.display = "flex";
    });

    btnCancel.addEventListener("click", () => {
      modal.style.display = "none";
    });

    btnConfirm.addEventListener("click", () => {
      lista.style.display = "none";
      vazio.style.display = "flex";
      modal.style.display = "none";
    });
  