document.getElementById('searchForm').addEventListener('submit', function (event) {
    event.preventDefault(); // Prevenir el comportamiento predeterminado del formulario
    const searchTerm = document.getElementById('searchInput').value.trim();
    if (searchTerm) {
      window.location.href = `product.html?search=${encodeURIComponent(searchTerm)}`;
    } else {
      console.log('No se ingresó un término de búsqueda');
    }
});
