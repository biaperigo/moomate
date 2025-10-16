
const menuToggle = document.getElementById('menuToggle');
const navMenu = document.getElementById('navMenu');
menuToggle.addEventListener('click', () => navMenu.classList.toggle('show'));

document.getElementById('abrir-feedback').addEventListener('click', function() {
    document.getElementById('modal-feedback').classList.remove('hidden');
});

document.getElementById('fechar-modal').addEventListener('click', function() {
    document.getElementById('modal-feedback').classList.add('hidden');
});

document.getElementById('fazer-pedido').addEventListener('click', function() {
    const explanation = document.getElementById('explanation-fazer-pedido');
    explanation.style.display = explanation.style.display === 'none' ? 'block' : 'none';
});

document.getElementById('problemas-pedido').addEventListener('click', function() {
    const explanation = document.getElementById('explanation-problemas-pedido');
    explanation.style.display = explanation.style.display === 'none' ? 'block' : 'none';
});

document.getElementById('informacoes-gerais').addEventListener('click', function() {
    const explanation = document.getElementById('explanation-informacoes-gerais');
    explanation.style.display = explanation.style.display === 'none' ? 'block' : 'none';
});
