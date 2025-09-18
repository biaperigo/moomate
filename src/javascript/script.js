$(document).ready(function () {

  $('#mobile_btn').on('click', function () {
    $('#mobile_menu').toggleClass('active');
    $('#mobile_btn').find('i').toggleClass('fa-x');
  });

  const sections = $('section');
  const navItems = $('.nav-item');
  const header = $('header');

  $(window).on('scroll', function () {
    const scrollPosition = $(window).scrollTop() + header.outerHeight();

    if ($(window).scrollTop() > 20) {
      header.addClass('scrolled');
    } else {
      header.removeClass('scrolled');
    }

    if (scrollPosition < 0) {
      header.css('box-shadow', 'none');
    } else {
      header.css('box-shadow', '5px 1px 5px rgba(0,0,0,0.1)');
    }

    let activeSectionIndex = 0;
    sections.each(function (i) {
      const section = $(this);
      const sectionTop = section.offset().top - header.outerHeight() - 10;
      const sectionBottom = sectionTop + section.outerHeight();

      if (scrollPosition >= sectionTop && scrollPosition < sectionBottom) {
        activeSectionIndex = i;
        return false;
      }
    });

    navItems.removeClass('active');
    $(navItems[activeSectionIndex]).addClass('active');
  });

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


  $(".btn-outline").on("click", function (e) {
    e.preventDefault();
    
  });
}); 
