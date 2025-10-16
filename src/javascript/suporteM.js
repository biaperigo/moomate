const menuToggle = document.getElementById('menuToggle');
const navMenu = document.getElementById('navMenu');
menuToggle.addEventListener('click', () => navMenu.classList.toggle('show'));

document.getElementById('abrir-feedback').addEventListener('click', function() {
    document.getElementById('modal-feedback').classList.remove('hidden');
});

document.getElementById('fechar-modal').addEventListener('click', function() {
    document.getElementById('modal-feedback').classList.add('hidden');
});

document.getElementById('aceitar-corridas').addEventListener('click', function() {
    const explanation = document.getElementById('explanation-aceitar-corridas');
    explanation.style.display = explanation.style.display === 'none' ? 'block' : 'none';
});

document.getElementById('pagamentos').addEventListener('click', function() {
    const explanation = document.getElementById('explanation-pagamentos');
    explanation.style.display = explanation.style.display === 'none' ? 'block' : 'none';
});

document.getElementById('veículo').addEventListener('click', function() {
    const explanation = document.getElementById('explanation-veiculo');
    explanation.style.display = explanation.style.display === 'none' ? 'block' : 'none';
});