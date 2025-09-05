// script.js

$(document).ready(function(){
  // Toggle menu mobile
  $('#mobile_btn').on('click', function (){
    $('#mobile_menu').toggleClass('active');
    $('#mobile_btn').find('i').toggleClass('fa-x');
  });

  const sections = $('section');
  const navItems = $('.nav-item');
  const header = $('header');

  $(window).on('scroll', function (){
    const scrollPosition = $(window).scrollTop() + header.outerHeight();

    if ($(window).scrollTop() > 20) {
      header.addClass('scrolled');
    } else {
      header.removeClass('scrolled');
    }

    if(scrollPosition < 0){
      header.css('box-shadow', 'none');
    } else {
      header.css('box-shadow', '5px 1px 5px rgba(0,0,0,0.1)');
    }

    let activeSectionIndex = 0;
    sections.each(function(i){
      const section = $(this);
      const sectionTop = section.offset().top - header.outerHeight() - 10;
      const sectionBottom = sectionTop + section.outerHeight();

      if(scrollPosition >= sectionTop && scrollPosition < sectionBottom){
        activeSectionIndex = i;
        return false;
      }
    });

    navItems.removeClass('active');
    $(navItems[activeSectionIndex]).addClass('active');
  });

  // === ScrollReveal Animations ===
  ScrollReveal().reveal('section', {
    origin: 'left',
    distance: '60px',
    duration: 1000,
    easing: 'ease-out',
    reset: false,
    delay: 100
  });

  ScrollReveal().reveal('#cta .title', {
    origin: 'left',
    distance: '40px',
    duration: 1000,
    delay: 200
  });

  ScrollReveal().reveal('#cta .description', {
    origin: 'left',
    distance: '40px',
    duration: 1000,
    delay: 400
  });

  ScrollReveal().reveal('#cta_buttons', {
    origin: 'left',
    distance: '40px',
    duration: 1000,
    delay: 600
  });

  ScrollReveal().reveal('#banner img', {
    origin: 'right',
    distance: '60px',
    duration: 1000,
    delay: 400
  });

  ScrollReveal().reveal('.team-member', {
    origin: 'bottom',
    distance: '40px',
    duration: 800,
    interval: 200
  });

  ScrollReveal().reveal('.motorista-imagem img', {
    origin: 'left',
    distance: '50px',
    duration: 1000,
    delay: 200
  });

  ScrollReveal().reveal('.motorista-conteudo', {
    origin: 'left',
    distance: '50px',
    duration: 1000,
    delay: 400
  });

  ScrollReveal().reveal('.usuario-imagem img', {
    origin: 'left',
    distance: '50px',
    duration: 1000,
    delay: 200
  });

  ScrollReveal().reveal('.usuario-conteudo', {
    origin: 'left',
    distance: '50px',
    duration: 1000,
    delay: 400
  });

  // Modal
$(document).ready(function() {
    // CÓDIGO PARA O MODAL DE CADASTRO
    $(".btn-outline, .btn-cinza").on("click", function (e) {
        e.preventDefault();
        $("#modal-tipo-cadastro").removeClass("hidden");
    });

    // Evento para redirecionar quando clicar nas opções do modal de cadastro
    $("#modal-tipo-cadastro .btn-opcao").on("click", function () {
        const destino = $(this).data("destino");
        window.location.href = destino;
    });

    // Prevenir que cliques no conteúdo do modal de cadastro fechem o modal
    $("#modal-tipo-cadastro .modal-content").on("click", function (e) {
        e.stopPropagation();
    });

    // Fechar modal de cadastro ao clicar fora dele
    $("#modal-tipo-cadastro").on("click", function (e) {
        if ($(e.target).is("#modal-tipo-cadastro")) {
            $(this).addClass("hidden");
        }
    });

    // CÓDIGO PARA O MODAL DE LOGIN (o que eu te passei)
    $(".btn-default").on("click", function (e) {
        e.preventDefault();
        $("#modal-tipo-login").removeClass("hidden");
    });

    // Evento para redirecionar quando clicar nas opções do modal de login
    $("#modal-tipo-login .btn-opcao").on("click", function () {
        const destino = $(this).data("destino");
        window.location.href = destino;
    });

    // Prevenir que cliques no conteúdo do modal de login fechem o modal
    $("#modal-tipo-login .modal-content").on("click", function (e) {
        e.stopPropagation();
    });

    // Fechar modal de login ao clicar fora dele
    $("#modal-tipo-login").on("click", function (e) {
        if ($(e.target).is("#modal-tipo-login")) {
            $(this).addClass("hidden");
        }
    });
});

  });
  
  