    $('.toggle-password').on('click', function () {
      const input = $(this).siblings('input');
      const type = input.attr('type') === 'password' ? 'text' : 'password';
      input.attr('type', type);
      $(this).toggleClass('fa-eye fa-eye-slash');
    });