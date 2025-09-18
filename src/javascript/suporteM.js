 const menuToggle = document.getElementById('menuToggle');
    const navMenu = document.getElementById('navMenu');
    menuToggle.addEventListener('click', () => navMenu.classList.toggle('show'));
  document.getElementById('abrir-feedback').addEventListener('click', function() {
      document.getElementById('modal-feedback').classList.remove('hidden');
    });

    document.getElementById('fechar-modal').addEventListener('click', function() {
      document.getElementById('modal-feedback').classList.add('hidden');
    });