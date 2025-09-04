menuToggle.addEventListener('click', () => {
      navMenu.classList.toggle('show');
    });
    
    document.getElementById("form-conta").addEventListener("submit", function(event) {
      event.preventDefault();
      document.getElementById("mensagem").style.display = "block";
      setTimeout(() => {
        document.getElementById("mensagem").style.display = "none";
      }, 3000);
    });