console.log('Archivo shopping_card.js cargado correctamente');
function loadCartFromServer() {
    console.log('Intentando cargar datos del carrito...');
    fetch('/shopping_card')
        .then(response => {
            console.log('Respuesta del servidor para /shopping_card:', response);
            if (!response.ok) {
                if (response.status === 401) {
                    alert('Debes iniciar sesión para acceder al carrito.');
                    window.location.href = 'index.html';
                } else {
                    throw new Error(`Error del servidor: ${response.statusText}`);
                }
            }
            return response.json(); // Aquí fallará si el servidor devuelve HTML
        })
        .then(cartData => {
            console.log('Datos del carrito recibidos:', cartData);
            renderCart(cartData);
        })
}



function addToCart(id, size, quantity = 1) {
    console.log('Enviando datos al servidor para agregar al carrito:', { id, size, quantity });
    fetch('/shopping_card/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, size, quantity })
    })
        .then(response => {
            console.log('Respuesta del servidor al agregar producto:', response);
            if (!response.ok) {
                return response.text().then(text => { throw new Error(text); });
            }
            return response.json();
        })
        .then(cartData => {
            console.log('Producto agregado al carrito, datos del carrito actualizados:', cartData);
            renderCart(cartData);
        })
        .catch(error => {
            console.error('Error al agregar al carrito:', error);
            alert(`Error: ${error.message}`);
        });
}

function updateProductQuantity(id, size, newQuantity) {
    fetch('/shopping_card/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, size, newQuantity })
    })
        .then(response => {
            if (!response.ok) {
                return response.text().then(text => { throw new Error(text); });
            }
            return response.json();
        })
        .then(updatedCartData => {
            console.log('Cantidad actualizada en el servidor:', updatedCartData);
            renderCart(updatedCartData); // Actualiza la vista directamente con los nuevos datos
        })
        .catch(error => {
            console.error('Error al actualizar el carrito:', error);
            alert(`Error: ${error.message}`);
        });
}



function removeFromCart(id, size) {
    console.log('Eliminando producto del carrito en el servidor:', { id, size });
    fetch('/shopping_card/remove', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, size })
    })
        .then(response => {
            console.log('Respuesta del servidor al eliminar producto:', response);
            if (!response.ok) {
                throw new Error('Error al eliminar el producto del carrito.');
            }
            return response.json();
        })
        .then(cartData => {
            console.log('Producto eliminado, datos del carrito actualizados:', cartData);
            renderCart(cartData.cart);
        })
        .catch(error => console.error('Error al eliminar del carrito:', error));
}

function renderCart(cartData) {
    console.log('Renderizando carrito con los datos:', cartData);
    const productContainer = document.querySelector('#productContainer');
    productContainer.innerHTML = '';

    if (cartData.length === 0) {
        console.log('El carrito está vacío.');
        productContainer.innerHTML = '<p class="text-center">Tu carrito está vacío.</p>';
        updateCartSummary(cartData);
        return;
    }

    cartData.forEach(item => {
        console.log('Procesando item del carrito:', item);
        const productHtml = `
            <div class="card mb-4">
                <div class="row g-0">
                    <div class="col-md-4">
                        <img src="${item.imagen}" class="img-fluid rounded-start" alt="${item.nombre}">
                    </div>
                    <div class="col-md-8">
                        <div class="card-body">
                            <h5 class="card-title">${item.nombre}</h5>
                            <p class="card-text">Talla: ${item.size}</p>
                            <p class="card-text">Categoría: ${item.category}</p>
                            <div class="d-flex align-items-center mb-3">
                                <label class="me-2">Cantidad:</label>
                                <input 
                                    type="number" 
                                    class="form-control w-25" 
                                    min="1" 
                                    max="${item.stock}" 
                                    value="${item.quantity}" 
                                    onchange="updateProductQuantity('${item.id}', '${item.size}', this.value)"
                                >
                            </div>
                            <p class="card-text"><strong>Subtotal:</strong> $${(item.quantity * item.precio).toFixed(2)} MXN</p>
                            <button class="btn btn-danger btn-sm" onclick="removeFromCart('${item.id}', '${item.size}')">Eliminar</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        productContainer.insertAdjacentHTML('beforeend', productHtml);
    });

    updateCartSummary(cartData);
}

function updateCartSummary(cartData) {
    console.log('Actualizando resumen del carrito:', cartData);
    const summaryContainer = document.querySelector('.col-md-5 .card-body');

    let total = cartData.reduce((sum, item) => sum + item.quantity * item.precio, 0);
    const shippingCost = 50;
    const totalWithShipping = total + shippingCost;

    summaryContainer.innerHTML = `
        <h5 class="card-title">Resumen de Compra</h5>
        ${cartData.map(item => `<p>${item.nombre} (Talla: ${item.size}): $${(item.quantity * item.precio).toFixed(2)}</p>`).join('')}
        <p>Costo de envío: $${shippingCost.toFixed(2)}</p>
        <h5>Total: $${totalWithShipping.toFixed(2)}</h5>
        <div class="d-flex gap-2">
            <a href="Pago.html" class="flex-grow-1">
                <button class="btn btn-primary w-100">Pagar</button>
            </a>
            <a href="home.html" class="flex-grow-1">
                <button class="btn btn-danger w-100">Cancelar</button>
            </a>
        </div>
    `;
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('Evento DOMContentLoaded ejecutado');
    loadCartFromServer();
});

