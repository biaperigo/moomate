document.addEventListener('DOMContentLoaded', () => {
  
  const menuToggle = document.getElementById('menuToggle');
  const navMenu = document.getElementById('navMenu');
  menuToggle.addEventListener('click', () => {
    navMenu.classList.toggle('show');
  });

  const idiomaToggle = document.querySelector('.idioma-toggle');
  const idiomaOpcoes = document.querySelector('.idioma-opcoes');
  const idiomaAtual = document.getElementById('idioma-atual');

  if (idiomaToggle && idiomaOpcoes) {
    idiomaToggle.addEventListener('click', () => {
      const isVisible = idiomaOpcoes.style.display === 'flex';
      idiomaOpcoes.style.display = isVisible ? 'none' : 'flex';
    });

    document.querySelectorAll('input[name="idioma"]').forEach(radio => {
      radio.addEventListener('change', () => {
        idiomaAtual.textContent = radio.parentElement.textContent.trim();
        idiomaOpcoes.style.display = 'none';
      });
    });
  }
});
