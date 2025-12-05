require('dotenv').config();

const express = require('express');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const session = require('express-session');

// Stripe desactivado temporalmente (mock)
const stripe = {
  paymentIntents: {
    create: async () => ({ client_secret: "test_mode" })
  }
};

const fs = require('fs');
const User = require('./public/user');

const app = express();
const port = 3000;

/* ======================= MONGODB ======================= */

// CONEXIÓN SEGURA (usa .env)
const mongoConnection = process.env.MONGO_URI;

mongoose
  .connect(mongoConnection)
  .then(() => console.log('Conectado a MongoDB correctamente'))
  .catch(err => console.error('Error en la conexión a MongoDB:', err));

/* ======================= MIDDLEWARE ======================= */

app.use(session({
  secret: 'clave_super_secreta',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'views')));

/* ======================= MODELO PRODUCTOS ======================= */

const productSchema = new mongoose.Schema({
  id: String,
  nombre: String,
  precio: Number,
  categoria: String,
  imagen: String,
  stock: Object
});

const Product = mongoose.model('Product', productSchema);

/* ======================= AUTH ======================= */

function isAuthenticated(req, res, next) {
  if (req.session && req.session.userId) next();
  else res.status(401).send('Usuario no autenticado.');
}

/* ======================= RUTAS BASE ======================= */

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'home.html'));
});

/* ======================= PRODUCTOS ======================= */

app.get('/products.json', async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (error) {
    res.status(500).send('Error al cargar los productos');
  }
});

app.post('/products', async (req, res) => {
  try {
    const { id, ...productData } = req.body;
    const productId = id || new mongoose.Types.ObjectId().toString();
    const product = new Product({ id: productId, ...productData });
    await product.save();
    res.status(201).send(product);
  } catch (error) {
    res.status(500).send(error);
  }
});

/* ======================= CARRITO ======================= */

// Agregar producto al carrito y devolver el carrito actualizado en JSON
app.post('/shopping_card/add', isAuthenticated, async (req, res) => {
  const { id, size, quantity, category } = req.body;

  if (!id || !size || !quantity || !category) {
    return res.status(400).send('Todos los campos son obligatorios.');
  }

  const user = await User.findById(req.session.userId);
  if (!user) return res.status(404).send('Usuario no encontrado.');

  const qtyNumber = Number(quantity) || 1;

  const existingItem = user.cart.find(item => item.id === id && item.size === size);
  if (existingItem) {
    existingItem.quantity += qtyNumber;
  } else {
    user.cart.push({ id, size, quantity: qtyNumber, category });
  }

  await user.save();

  const cartItems = user.cart || [];
  const productIds = cartItems.map(item => item.id);
  const products = await Product.find({ id: { $in: productIds } });

  const cartData = cartItems.map(item => {
    const product = products.find(p => p.id === item.id);
    return {
      id: item.id,
      size: item.size,
      quantity: item.quantity,
      category: item.category,
      nombre: product ? product.nombre : 'Producto no encontrado',
      imagen: product ? product.imagen : '',
      precio: product ? product.precio : 0,
      stock: product && product.stock ? (product.stock[item.size] ?? 0) : 0
    };
  });

  res.status(200).json(cartData);
});

// Obtener carrito del usuario logueado
app.get('/shopping_card', isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    if (!user) return res.status(404).send('Usuario no encontrado.');

    const cartItems = user.cart || [];
    if (cartItems.length === 0) {
      return res.json([]);
    }

    const productIds = cartItems.map(item => item.id);
    const products = await Product.find({ id: { $in: productIds } });

    const cartData = cartItems.map(item => {
      const product = products.find(p => p.id === item.id);
      return {
        id: item.id,
        size: item.size,
        quantity: item.quantity,
        category: item.category,
        nombre: product ? product.nombre : 'Producto no encontrado',
        imagen: product ? product.imagen : '',
        precio: product ? product.precio : 0,
        stock: product && product.stock ? (product.stock[item.size] ?? 0) : 0
      };
    });

    res.json(cartData);
  } catch (error) {
    console.error('Error al obtener el carrito:', error);
    res.status(500).send('Error al obtener el carrito.');
  }
});

// Eliminar un producto (id + talla) del carrito
app.delete('/shopping_card/remove', isAuthenticated, async (req, res) => {
  const { id, size } = req.body;

  if (!id || !size) {
    return res.status(400).send('id y size son obligatorios.');
  }

  const user = await User.findById(req.session.userId);
  if (!user) return res.status(404).send('Usuario no encontrado.');

  user.cart = user.cart.filter(item => !(item.id === id && item.size === size));

  await user.save();

  const cartItems = user.cart || [];
  if (cartItems.length === 0) {
    return res.json([]);
  }

  const productIds = cartItems.map(item => item.id);
  const products = await Product.find({ id: { $in: productIds } });

  const cartData = cartItems.map(item => {
    const product = products.find(p => p.id === item.id);
    return {
      id: item.id,
      size: item.size,
      quantity: item.quantity,
      category: item.category,
      nombre: product ? product.nombre : 'Producto no encontrado',
      imagen: product ? product.imagen : '',
      precio: product ? product.precio : 0,
      stock: product && product.stock ? (product.stock[item.size] ?? 0) : 0
    };
  });

  res.json(cartData);
});

// Vaciar todo el carrito
app.post('/shopping_card/clear', isAuthenticated, async (req, res) => {
  const user = await User.findById(req.session.userId);
  if (!user) return res.status(404).send('Usuario no encontrado.');

  user.cart = [];
  await user.save();

  res.json([]);
});

/* ======================= WISHLIST ======================= */

// Agregar producto a la wishlist
app.post('/wishlist/add', isAuthenticated, async (req, res) => {
  const { id } = req.body;
  const product = await Product.findOne({ id });
  if (!product) return res.status(404).send('Producto no encontrado.');

  const user = await User.findById(req.session.userId);
  if (!user) return res.status(404).send('Usuario no encontrado');

  if (!user.wishlist.includes(id)) {
    user.wishlist.push(id);
    await user.save();
  }

  res.status(200).send('Producto agregado a wishlist');
});

app.get('/wishlist', isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    if (!user) return res.status(404).send('Usuario no encontrado');

    const wishlistIds = user.wishlist || [];
    if (wishlistIds.length === 0) {
      return res.json([]);
    }

    const products = await Product.find({ id: { $in: wishlistIds } });
    res.json(products);
  } catch (error) {
    console.error('Error al obtener wishlist:', error);
    res.status(500).send('Error al cargar la wishlist');
  }
});


async function handleWishlistRemove(req, res) {
  try {
    const id = req.body.id || req.query.id || req.params.id;
    console.log('Solicitud para eliminar de wishlist:', {
      method: req.method,
      url: req.originalUrl,
      body: req.body,
      query: req.query,
      params: req.params,
      idDetectado: id
    });

    const user = await User.findById(req.session.userId);
    if (!user) {
      return res.json([]);
    }

    if (id) {
      user.wishlist = (user.wishlist || []).filter(prodId => String(prodId) !== String(id));
      await user.save();
    }

    const wishlistIds = user.wishlist || [];
    const products = wishlistIds.length
      ? await Product.find({ id: { $in: wishlistIds } })
      : [];

    res.json(products);
  } catch (error) {
    console.error('Error al eliminar de wishlist:', error);
    res.status(500).send('Error al eliminar de la wishlist');
  }
}

app.all('/wishlist/remove', isAuthenticated, handleWishlistRemove);
app.all('/wishlist/remove/:id', isAuthenticated, handleWishlistRemove);

/* ======================= STRIPE ======================= */

app.post('/create-payment-intent', async (req, res) => {
  try {
    const { amount } = req.body;

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      payment_method_types: ['card']
    });

    res.send({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

/* ======================= LOGIN ======================= */

app.post('/register', async (req, res) => {
  console.log('Body recibido en /register:', req.body);

  const { username, password } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
      username,
      password: hashedPassword,
      wishlist: [],
      cart: []
    });

    await user.save();
    console.log('Usuario guardado en Mongo:', user);

    req.session.userId = user._id;
    res.redirect('/home.html');
  } catch (error) {
    console.error('Error al registrar usuario:', error);
    res.status(500).send('Error al registrar usuario');
  }
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  const user = await User.findOne({ username });
  if (!user) return res.status(404).send('Usuario no encontrado.');

  const passwordMatch = await bcrypt.compare(password, user.password);
  if (!passwordMatch) return res.status(401).send('Contraseña incorrecta');

  req.session.userId = user._id;
  res.redirect('/home.html');
});

app.post('/logout', (req, res) => {
  req.session.destroy();
  res.send('Sesión cerrada');
});

/* ======================= SERVIDOR ======================= */

app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});
