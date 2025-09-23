let currentPage = 1;
const productsPerPage = 8;
let productsData = [];
let selectedProduct = null;

// Filtros activos
let activeFilters = {
    category: null,
    priceRange: null,
    size: null,
    sortOrder: null
};

// Obtener el término de búsqueda de la URL
function getSearchQuery() {
    const params = new URLSearchParams(window.location.search);
    return params.get('search') || '';
}

async function fetchProducts(page) {
    try {
        const response = await fetch('/products.json');
        if (!response.ok) {
            throw new Error('Error al cargar los productos');
        }
        productsData = await response.json();

        const searchQuery = getSearchQuery().toLowerCase();
        if (searchQuery) {
            productsData = productsData.filter(product =>
                product.nombre.toLowerCase().includes(searchQuery)
            );
        }

        applyFilters();
    } catch (error) {
        console.error('Error al cargar los productos:', error);
    }
}

// Mostrar productos en el contenedor
function displayProducts(products) {
    const productContainer = document.querySelector('#productsContainer'); // Asegúrate de que este ID existe en tu HTML
    productContainer.innerHTML = '';

    products.forEach((product) => {
        const productHTML = `
            <div class="col-md-3">
                <div class="card mb-4">
                    <img src="${product.imagen}" class="card-img-top" alt="${product.nombre}">
                    <div class="card-body">
                        <h5 class="card-title">${product.nombre}</h5>
                        <p class="card-text"><strong>Precio:</strong> $${product.precio} MXN</p>
                        <p class="text-muted">${product.categoria}</p>
                        <div class="d-flex justify-content-between">
                            <button class="btn btn-outline-danger" onclick="addToWishlist('${product.id}')">
                                <i class="fas fa-heart"></i>
                            </button>
                            <button class="btn btn-outline-primary" onclick="openCartModal('${product.id}')">
                            <i class="fas fa-shopping-cart"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>`;
        productContainer.innerHTML += productHTML;
    });
}


// Agregar producto a la wishlist
function addToWishlist(id) {
    fetch('/wishlist/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
    })
    .then(response => {
        if (!response.ok) {
            return response.text().then(text => { throw new Error(text); });
        }
        return response.text();
    })
    .then(data => {
        alert(data);
        window.location.href = 'wishlist.html'; // Redirige a la página de wishlist
    })
    .catch(error => {
        console.error('Error:', error);
        alert(`Error: ${error.message}`);
    });
}





// Abrir el modal para agregar al carrito
function openCartModal(id) {
    const selectedProduct = productsData.find(product => product.id === id);
    console.log('Producto seleccionado para agregar al carrito:', selectedProduct); // Verificar producto seleccionado

    if (!selectedProduct) {
        alert('Producto no encontrado.');
        return;
    }

    const sizeSelect = document.querySelector('#sizeSelect');
    sizeSelect.innerHTML = '';

    for (const [size, stock] of Object.entries(selectedProduct.stock)) {
        console.log(`Talla: ${size}, Stock: ${stock}`); // Verificar tallas y stock disponibles
        const option = document.createElement('option');
        option.value = size;
        option.textContent = `${size} (${stock} disponibles)`;
        option.disabled = stock === 0;
        sizeSelect.appendChild(option);
    }

    sessionStorage.setItem('selectedProduct', JSON.stringify(selectedProduct));
    console.log('Producto almacenado en sessionStorage:', selectedProduct); // Confirmar almacenamiento

    const cartModal = new bootstrap.Modal(document.getElementById('cartModal'));
    cartModal.show();
}

function addProductToCartFromModal() {
    const selectedSize = document.querySelector('#sizeSelect').value;
    console.log('Talla seleccionada:', selectedSize);

    if (!selectedSize) {
        alert('Por favor selecciona una talla.');
        return;
    }

    const selectedProduct = JSON.parse(sessionStorage.getItem('selectedProduct'));
    console.log('Producto seleccionado desde sessionStorage:', selectedProduct);

    if (!selectedProduct) {
        alert('Error: Producto no seleccionado.');
        return;
    }

    fetch('/shopping_card/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            id: selectedProduct.id,
            size: selectedSize,
            quantity: 1,
            category: selectedProduct.categoria
        })
    })
    .then(response => {
        console.log('Respuesta del servidor:', response.status);
        if (!response.ok) {
            return response.text().then(text => { throw new Error(text); });
        }
        return response.text();
    })
    .then(data => {
        console.log('Producto agregado con éxito:', data);
        window.location.href = 'shopping_card.html';
    })
    .catch(error => {
        console.error('Error al agregar al carrito:', error);
        alert(`Error: ${error.message}`);
    });
}

function filterByCategory(category) {
    const buttons = document.querySelectorAll('button.category-filter');
    buttons.forEach(button => {
        if (button.innerText === category) {
            button.classList.toggle('active', activeFilters.category !== category);
        } else {
            button.classList.remove('active');
        }
    });

    if (activeFilters.category === category) {
        activeFilters.category = null;
    } else {
        activeFilters.category = category;
    }
    console.log('Categoría activa:', activeFilters.category);
    applyFilters();
}




// Filtrar por rango de precio
function filterByPriceRange(minPrice, maxPrice) {
    activeFilters.priceRange = { min: minPrice, max: maxPrice };
    applyFilters();
}

// Filtrar por talla
function filterBySize(size) {
    activeFilters.size = size;
    applyFilters();
}

// Ordenar por precio
function sortByPrice(order) {
    activeFilters.sortOrder = order;
    applyFilters();
}

// Aplicar todos los filtros activos
function applyFilters() {
    let filteredProducts = [...productsData];

    if (activeFilters.category) {
        filteredProducts = filteredProducts.filter(
            product => product.categoria === activeFilters.category
        );
    }

    if (activeFilters.priceRange) {
        const { min, max } = activeFilters.priceRange;
        filteredProducts = filteredProducts.filter(
            product => product.precio >= min && product.precio <= max
        );
    }

    if (activeFilters.size) {
        filteredProducts = filteredProducts.filter(
            product => product.stock && product.stock[activeFilters.size] > 0
        );
    }

    if (activeFilters.sortOrder) {
        filteredProducts.sort((a, b) => {
            return activeFilters.sortOrder === 'asc'
                ? a.precio - b.precio
                : b.precio - a.precio;
        });
    }

    updateDisplayedProducts(filteredProducts);
}


// Actualizar los productos mostrados
function updateDisplayedProducts(filteredProducts) {
    const startIndex = (currentPage - 1) * productsPerPage;
    const paginatedProducts = filteredProducts.slice(startIndex, startIndex + productsPerPage);

    console.log('Productos paginados:', paginatedProducts); // Verifica que los productos están siendo paginados correctamente

    displayProducts(paginatedProducts);
    togglePaginationButtons(filteredProducts.length);
}


async function fetchProducts(page) {
    try {
        const response = await fetch('/products.json');
        if (!response.ok) {
            throw new Error('Error al cargar los productos');
        }
        productsData = await response.json();
        console.log('Productos cargados:', productsData); // Asegúrate de que aquí se obtienen correctamente

        const searchQuery = getSearchQuery().toLowerCase();
        if (searchQuery) {
            productsData = productsData.filter(product =>
                product.nombre.toLowerCase().includes(searchQuery)
            );
        }

        applyFilters();
    } catch (error) {
        console.error('Error al cargar los productos:', error);
    }
}


// Botones de paginación
function togglePaginationButtons(totalProducts) {
    const totalPages = Math.ceil(totalProducts / productsPerPage);
    const paginationContainer = document.querySelector('.pagination');
    paginationContainer.innerHTML = '';

    for (let i = 1; i <= totalPages; i++) {
        const pageButton = document.createElement('li');
        pageButton.className = `page-item ${i === currentPage ? 'active' : ''}`;
        pageButton.innerHTML = `<a class="page-link" href="#">${i}</a>`;
        pageButton.addEventListener('click', () => loadPage(i));
        paginationContainer.appendChild(pageButton);
    }
}

// Cargar una página específica
function loadPage(pageNumber) {
    currentPage = pageNumber;
    applyFilters();
}

// Inicializar al cargar
document.addEventListener('DOMContentLoaded', () => fetchProducts(currentPage));


