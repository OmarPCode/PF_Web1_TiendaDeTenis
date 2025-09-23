let wishlist = [];

async function loadWishlist() {
    const wishlistContainer = document.getElementById('wishlistContainer');
    wishlistContainer.innerHTML = '<p class="text-center">Cargando wishlist...</p>';

    try {
        const response = await fetch('/wishlist');
        if (response.status === 401) {
            wishlistContainer.innerHTML = '<p class="text-center">Por favor, inicia sesión para ver tu wishlist.</p>';
            return;
        }
        if (!response.ok) {
            throw new Error('Error al cargar la wishlist.');
        }

        wishlist = await response.json();

        wishlistContainer.innerHTML = '';
        if (wishlist.length === 0) {
            wishlistContainer.innerHTML = '<p class="text-center">Tu wishlist está vacía.</p>';
            return;
        }

        wishlist.forEach((item, index) => {
            const productHtml = `
                <div class="card mb-1">
                    <div class="row g-0">
                        <div class="col-md-4">
                            <img src="${item.imagen}" class="img-fluid rounded-start" alt="${item.nombre}">
                        </div>
                        <div class="col-md-8">
                            <div class="card-body">
                                <h5 class="card-title">${item.nombre}</h5>
                                <p class="card-text">Categoría: ${item.categoria}</p>
                                <p class="card-text"><strong>Precio:</strong> $${item.precio} MXN</p>
                                <div class="text-center mt-3"> 
                                    <button class="btn btn-outline-primary me-2" onclick="openCartModalFromWishlist(${index})">
                                        <i class="fas fa-shopping-cart"></i> 
                                    </button>
                                    <button class="btn btn-outline-danger" onclick="removeFromWishlist('${item.id}')">
                                        <i class="fas fa-trash-alt"></i> 
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            wishlistContainer.insertAdjacentHTML('beforeend', productHtml);
        });
    } catch (error) {
        console.error('Error al cargar la wishlist:', error);
        wishlistContainer.innerHTML = '<p class="text-center">Error al cargar la wishlist. Intenta nuevamente más tarde.</p>';
    }
}

function openCartModalFromWishlist(productIndex) {
    const selectedProduct = wishlist[productIndex];
    const sizeSelect = document.querySelector('#sizeSelect');
    sizeSelect.innerHTML = '';

    if (!selectedProduct) {
        alert('Producto no encontrado en la wishlist.');
        console.log('Producto no encontrado:', wishlist[productIndex]);
        return;
    }

    console.log('Producto seleccionado para agregar al carrito:', selectedProduct);

    for (const [size, stock] of Object.entries(selectedProduct.stock)) {
        const option = document.createElement('option');
        option.value = size;
        option.textContent = `${size} (${stock} disponibles)`;
        option.disabled = stock === 0;
        sizeSelect.appendChild(option);
    }

    sessionStorage.setItem('selectedProduct', JSON.stringify(selectedProduct));
    const cartModal = new bootstrap.Modal(document.getElementById('cartModalFromWishlist'));
    cartModal.show();
}

async function addProductToCartFromWishlist() {
    const selectedSize = document.querySelector('#sizeSelect').value;
    const selectedProduct = JSON.parse(sessionStorage.getItem('selectedProduct'));

    if (!selectedSize) {
        alert('Por favor selecciona una talla.');
        return;
    }

    if (!selectedProduct) {
        alert('Error: Producto no seleccionado.');
        return;
    }

    try {
        const response = await fetch('/shopping_card/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: selectedProduct.id,
                size: selectedSize,
                quantity: 1,
                category: selectedProduct.categoria
            })
        });

        if (!response.ok) {
            throw new Error('Error al agregar el producto al carrito.');
        }

        console.log('Producto agregado con éxito desde la wishlist.');
        // Opcional: cerrar el modal
        const cartModal = bootstrap.Modal.getInstance(document.getElementById('cartModalFromWishlist'));
        cartModal.hide();
        window.location.href = 'shopping_card.html';
    } catch (error) {
        console.error('Error al agregar el producto al carrito:', error);
        alert('Error al agregar el producto al carrito. Intenta nuevamente.');
    }
}


async function removeFromWishlist(productId) {
    try {
        const response = await fetch(`/wishlist/remove/${productId}`, { method: 'DELETE' });
        if (!response.ok) {
            throw new Error('Error al eliminar el producto de la wishlist.');
        }

        // Actualiza la lista de la wishlist localmente
        wishlist = wishlist.filter(item => item.id !== productId);
        loadWishlist(); // Recarga la vista
    } catch (error) {
        console.error('Error al eliminar de la wishlist:', error);
        alert('Error al eliminar el producto. Intenta nuevamente.');
    }
}

document.addEventListener('DOMContentLoaded', loadWishlist);


