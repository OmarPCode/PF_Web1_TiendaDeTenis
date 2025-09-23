const express = require('express');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const session = require('express-session');
const stripe = require('stripe')('sk_test_51QPPYS1zf5Osqsu0vONchigMJTy75VtGsb6zl2ShZZHmmk2vMXmaqfTsEmH1pFVh1FE6MSO4qI745wWrD5KZ0Cx300BAiNbCXR');
const fs = require('fs');
const User = require('./public/user');

const app = express();
const port = 3000;

// Configuración de MongoDB
const mongoConnection = "mongodb+srv://Omar:%40omar30@myapp.dupmd.mongodb.net/MyAppDB";
mongoose.connect(mongoConnection, { useNewUrlParser: true, useUnifiedTopology: true });

const db = mongoose.connection;
db.on('connecting', () => console.log('Conectando a MongoDB...'));
db.on('connected', () => console.log('Conexión exitosa a MongoDB'));
db.on('error', (err) => console.error('Error en la conexión a MongoDB:', err));

// Middleware de sesión
app.use(session({
    secret: 'tu_clave_secreta',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // Cambiar a `true` si usas HTTPS
}));

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

// Definir esquema y modelo para productos
const productSchema = mongoose.Schema({
    id: String,
    nombre: String,
    precio: Number,
    categoria: String,
    imagen: String,
    stock: Object
});

const Product = mongoose.model('Product', productSchema);

// Middleware de autenticación
function isAuthenticated(req, res, next) {
    if (req.session && req.session.userId) {
        next();
    } else {
        res.status(401).send('Usuario no autenticado.');
    }
}

// Rutas estáticas para las carpetas "public" y "views"
app.use("/", express.static(path.join(__dirname, "views")));
app.use("/", express.static(path.join(__dirname, "public")));

// Ruta para servir la página principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'home.html'));
});



// Ruta para obtener productos desde MongoDB
app.get('/products.json', async (req, res) => {
    try {
        const products = await Product.find();
        res.json(products);
    } catch (error) {
        console.error('Error al obtener productos de MongoDB:', error);
        res.status(500).send('Error al cargar los productos');
    }
});

// Ruta para obtener un producto por ID
app.get('/products/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            console.error('Producto no encontrado');
            return res.status(404).send('Producto no encontrado');
        }
        console.log('Producto recuperado:', product);
        res.send(product);
    } catch (error) {
        console.error('Error al obtener el producto:', error);
        res.status(500).send(error);
    }
});

// Crear un producto
app.post('/products', async (req, res) => {
    try {
        const { id, ...productData } = req.body;

        // Generar un ID automáticamente si no se proporciona
        const productId = id || new mongoose.Types.ObjectId().toString();

        const product = new Product({ id: productId, ...productData });
        await product.save();
        console.log('Producto creado:', product);
        res.status(201).send(product);
    } catch (error) {
        console.error('Error al crear el producto:', error);
        res.status(500).send(error);
    }
});

// Actualizar un producto
app.put('/products/:id', async (req, res) => {
    try {
        const product = await Product.findOneAndUpdate({ id: req.params.id }, req.body, { new: true });
        if (!product) {
            console.error('Producto no encontrado para actualizar');
            return res.status(404).send('Producto no encontrado');
        }
        console.log('Producto actualizado:', product);
        res.send(product);
    } catch (error) {
        console.error('Error al actualizar el producto:', error);
        res.status(500).send(error);
    }
});

// Eliminar un producto
app.delete('/products/:id', async (req, res) => {
    try {
        const product = await Product.findOneAndDelete({ id: req.params.id });
        if (!product) {
            console.error('Producto no encontrado para eliminar');
            return res.status(404).send('Producto no encontrado');
        }
        console.log('Producto eliminado:', product);
        res.send(product);
    } catch (error) {
        console.error('Error al eliminar el producto:', error);
        res.status(500).send(error);
    }
});
// Carrito
app.post('/shopping_card/add', isAuthenticated, async (req, res) => {
    const { id, size, quantity, category } = req.body;

    console.log('Datos recibidos en /shopping_card/add:', { id, size, quantity, category });

    if (!id || !size || !quantity || !category) {
        console.log('Faltan datos en la solicitud POST');
        return res.status(400).send('Todos los campos son obligatorios.');
    }

    try {
        const user = await User.findById(req.session.userId);
        console.log('Usuario encontrado antes de actualizar el carrito:', user);

        if (!user) {
            return res.status(404).send('Usuario no encontrado.');
        }

        // Verificar si el producto ya está en el carrito
        const existingItem = user.cart.find(item => item.id === id && item.size === size);
        if (existingItem) {
            console.log('Producto ya existente en el carrito. Incrementando cantidad.');
            existingItem.quantity += quantity;
        } else {
            console.log('Agregando nuevo producto al carrito:', { id, size, quantity, category });
            user.cart.push({ id, size, quantity, category });
        }

        console.log('Carrito actualizado antes de guardar:', user.cart);

        await user.save();
        console.log('Carrito guardado con éxito:', user.cart);
        res.status(200).send('Producto agregado al carrito.');
    } catch (error) {
        console.error('Error al agregar producto al carrito:', error);
        res.status(500).send('Error al agregar producto al carrito.');
    }
});


app.get('/shopping_card', async (req, res) => {
    console.log('Usuario en sesión:', req.session.userId);

    try {
        const user = await User.findById(req.session.userId);

        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        const cartDetails = await Promise.all(
            user.cart.map(async item => {
                const product = await Product.findOne({ id: item.id });
                return {
                    id: item.id,
                    nombre: product?.nombre || 'Producto desconocido',
                    precio: product?.precio || 0,
                    imagen: product?.imagen || '',
                    size: item.size,
                    quantity: item.quantity,
                    category: item.category,
                    stock: product?.stock[item.size] || 0,
                };
            })
        );

        console.log('Detalles del carrito enviados al cliente:', cartDetails);
        res.json(cartDetails);
    } catch (error) {
        console.error('Error al obtener el carrito:', error);
        res.status(500).json({ error: 'Error al obtener el carrito.' });
    }
});

app.put('/shopping_card/update', async (req, res) => {
    try {
        const { id, size, newQuantity } = req.body;

        // Verificar si el producto existe y obtener el stock disponible para la talla
        const product = await Product.findOne({ id });
        if (!product) {
            return res.status(404).json({ error: 'Producto no encontrado.' });
        }

        const stockAvailable = product.stock[size];
        if (newQuantity > stockAvailable) {
            return res.status(400).json({ error: `Stock insuficiente. Solo hay ${stockAvailable} disponibles para la talla ${size}.` });
        }

        // Actualizar la cantidad en el carrito del usuario
        const user = await User.findById(req.session.userId);
        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado.' });
        }

        const item = user.cart.find(item => item.id === id && item.size === size);
        if (item) {
            item.quantity = parseInt(newQuantity, 10);
        } else {
            return res.status(404).json({ error: 'Producto no encontrado en el carrito.' });
        }

        await user.save();

        // Devuelve el carrito actualizado
        const updatedCart = await Promise.all(
            user.cart.map(async item => {
                const product = await Product.findOne({ id: item.id });
                return {
                    id: item.id,
                    nombre: product?.nombre || 'Producto desconocido',
                    precio: product?.precio || 0,
                    imagen: product?.imagen || '',
                    size: item.size,
                    quantity: item.quantity,
                    category: item.category,
                    stock: product?.stock[item.size] || 0,
                };
            })
        );

        res.json(updatedCart);
    } catch (error) {
        console.error('Error al actualizar el carrito:', error);
        res.status(500).json({ error: 'Error al actualizar el carrito.' });
    }
});

app.delete('/shopping_card/remove', isAuthenticated, async (req, res) => {
    console.log('Solicitud DELETE recibida en /shopping_card/remove');
    console.log('Cuerpo de la solicitud:', req.body);

    const { id, size } = req.body;

    try {
        const user = await User.findById(req.session.userId);
        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        // Filtrar el carrito eliminando el producto con el ID y talla especificados
        user.cart = user.cart.filter(item => item.id !== id || item.size !== size);

        // Guardar cambios en la base de datos
        await user.save();

        // Reconstruir el carrito con detalles completos de cada producto
        const cartDetails = await Promise.all(
            user.cart.map(async item => {
                const product = await Product.findOne({ id: item.id });
                return {
                    id: item.id,
                    nombre: product?.nombre || 'Producto desconocido',
                    precio: product?.precio || 0,
                    imagen: product?.imagen || '',
                    size: item.size,
                    quantity: item.quantity,
                    category: item.category,
                    stock: product?.stock[item.size] || 0,
                };
            })
        );

        console.log('Carrito actualizado después de eliminar:', cartDetails);
        res.json({ message: 'Producto eliminado del carrito', cart: cartDetails });
    } catch (error) {
        console.error('Error eliminando producto del carrito:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

// Ruta para agregar un producto a la wishlist
app.post('/wishlist/add', isAuthenticated, async (req, res) => {
    const { id } = req.body; // Aquí usamos el campo `id`

    try {
        console.log('ID del producto recibido:', id);

        // Buscar el producto en la base de datos usando `id`
        const product = await Product.findOne({ id });
        if (!product) {
            console.error(`Producto con id ${id} no encontrado en la base de datos.`);
            return res.status(404).send('Producto no encontrado.');
        }

        // Buscar al usuario autenticado
        const user = await User.findById(req.session.userId);
        if (!user) {
            return res.status(404).send('Usuario no encontrado.');
        }

        // Agregar el producto a la wishlist del usuario si no existe ya
        if (!user.wishlist.includes(id)) {
            user.wishlist.push(id);
            await user.save();
            return res.status(200).send('Producto agregado a la wishlist.');
        } else {
            return res.status(400).send('Producto ya está en la wishlist.');
        }
    } catch (error) {
        console.error('Error al agregar producto a la wishlist:', error);
        res.status(500).send('Error al agregar producto a la wishlist.');
    }
});




// Ruta para obtener la wishlist del usuario
app.get('/wishlist', isAuthenticated, async (req, res) => {
    try {
        // Buscar al usuario y obtener su wishlist
        const user = await User.findById(req.session.userId);
        if (!user) {
            return res.status(404).send('Usuario no encontrado.');
        }

        // Buscar productos en la base de datos que coincidan con los IDs en la wishlist
        const wishlistProducts = await Product.find({ id: { $in: user.wishlist } });
        res.json(wishlistProducts);
    } catch (error) {
        console.error('Error al obtener la wishlist:', error);
        res.status(500).send('Error al obtener la wishlist.');
    }
});

// Ruta para eliminar un producto de la wishlist
app.delete('/wishlist/remove/:id', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.userId; // Obtén el ID del usuario de la sesión
        const productId = req.params.id; // Obtén el ID del producto desde los parámetros

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).send('Usuario no encontrado.');
        }

        // Filtra la wishlist para eliminar el producto
        user.wishlist = user.wishlist.filter(product => product !== productId);
        await user.save();

        res.status(200).send('Producto eliminado de la wishlist.');
    } catch (error) {
        console.error('Error al eliminar de la wishlist:', error);
        res.status(500).send('Error al eliminar el producto de la wishlist.');
    }
});



// Ruta para crear un Payment Intent con Stripe
app.post('/create-payment-intent', async (req, res) => {
    try {
        const { amount } = req.body;
        const paymentIntent = await stripe.paymentIntents.create({
            amount: amount,
            currency: 'usd',
            payment_method_types: ['card'],
        });

        res.send({ clientSecret: paymentIntent.client_secret });
    } catch (error) {
        console.error('Error al crear el Payment Intent:', error);
        res.status(500).send({ error: error.message });
    }
});

// Ruta para registrar un usuario
app.post('/register', async (req, res) => {
    const { username, password } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ username, password: hashedPassword, wishlist: [] });

        await user.save();

        // Establecer la sesión del usuario automáticamente después del registro
        req.session.userId = user._id;

        // Redirigir directamente al cliente
        res.redirect('/home.html');
    } catch (err) {
        console.error('Error al registrar el usuario:', err);
        res.status(500).redirect('/register.html');
    }
});


// Ruta para autenticar un usuario
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(404).send('Usuario no encontrado.');
        }

        const passwordMatch = await bcrypt.compare(password, user.password);
        if (passwordMatch) {
            req.session.userId = user._id;

            // Redirigir al inicio después del inicio de sesión
            res.redirect('/home.html');
        } else {
            res.status(401).send('Contraseña incorrecta.');
        }
    } catch (error) {
        console.error('Error al iniciar sesión:', error);
        res.status(500).send('Error al iniciar sesión.');
    }
});


// Ruta para cerrar sesión
app.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).send('Error al cerrar sesión.');
        }
        res.status(200).send('Sesión cerrada con éxito.');
    });
});

// Ruta para servir otras páginas según el nombre
app.get('/:page', (req, res) => {
    const pageName = req.params.page;
    const filePath = path.join(__dirname, 'views', `${pageName}.html`);

    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
            console.error(`Archivo no encontrado: ${filePath}`);
            res.status(404).send('Página no encontrada');
        } else {
            res.sendFile(filePath);
        }
    });
});






// Ruta para autenticar un usuario
app.post('/authenticate', async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(404).send('Usuario no encontrado.');
        }

        const passwordMatch = await bcrypt.compare(password, user.password);
        if (passwordMatch) {
            req.session.userId = user._id;
            res.redirect('/home.html'); // Redirige al usuario al home si inicia sesión correctamente
        } else {
            res.status(401).send('Contraseña incorrecta.');
        }
    } catch (error) {
        console.error('Error al iniciar sesión:', error);
        res.status(500).send('Error al iniciar sesión.');
    }
});


// Iniciar el servidor
app.listen(port, () => {
    console.log(`Servidor escuchando en http://localhost:${port}`);
});

module.exports = app;
