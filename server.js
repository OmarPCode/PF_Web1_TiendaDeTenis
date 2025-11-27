/**************************************************************
 *  Proyecto Final - Desarrollo de Software Seguro
 *  Incluye:
 *  - Helmet
 *  - Rate Limiting
 *  - Sesiones seguras
 *  - CSRF Protection
 *  - Validación con express-validator
 *  - MongoDB con credenciales desde .env
require("dotenv").config();

const express = require("express");
const path = require("path");
const cors = require("cors");
const bodyParser = require("body-parser");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const session = require("express-session");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const csrf = require("csurf");
const { body, validationResult } = require("express-validator");
const fs = require("fs");

// Modelo de usuario
const User = require("./public/user");

// Inicializar app
const app = express();
const port = 3000;

/* ============================================================
 *                   MIDDLEWARE GENERAL
 * ============================================================*/

// Helmet (protección web básica: XSS, MIME sniffing, etc.)
app.use(helmet());

// CORS
app.use(cors());

// Body parsers
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, "public")));

/* ============================================================
 *                      CONFIGURACIÓN SESIÓN
 * ============================================================*/

app.use(
  session({
    name: "session_id",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true, // evita acceso desde JS
      secure: false, // en producción debe ser true con HTTPS
      sameSite: "lax", // protege contra CSRF básico
      maxAge: 1000 * 60 * 60, // 1 hora
    },
  })
);

/* ============================================================
 *                   RATE LIMITING (Anti-DoS)
 * ============================================================*/

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100,
  message: "Demasiadas solicitudes, intenta más tarde.",
});
app.use("/api/", limiter);

/* ============================================================
 *                      CSRF Protection
 * ============================================================*/

app.use(csrf());

/* ============================================================
 *                      CONEXIÓN A MONGO
 * ============================================================*/

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("Conectado a MongoDB correctamente"))
  .catch((err) => console.error("Error en la conexión a MongoDB:", err));

/* ============================================================
 *                 UTILIDAD PARA AUTENTICACIÓN
 * ============================================================*/

function isAuthenticated(req, res, next) {
  if (req.session && req.session.userId) return next();
  return res.status(401).json({ msg: "Usuario no autenticado" });
}

/* ============================================================
 *                 RUTAS DE PÁGINAS (Frontend)
 * ============================================================*/

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "index.html"));
});

app.get("/signup", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "CrearCuenta.html"));
});

app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "IniciarSesion.html"));
});

/* ============================================================
 *                    API: REGISTRO
 * ============================================================*/

app.post(
  "/api/register",
  body("email").isEmail().withMessage("Email inválido").escape(),
  body("password")
    .isLength({ min: 8 })
    .withMessage("La contraseña debe tener mínimo 8 caracteres"),
  async (req, res) => {
    // Validación
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    try {
      // Verificar si existe usuario
      const existing = await User.findOne({ email });
      if (existing) {
        return res.status(409).json({ msg: "El usuario ya existe" });
      }

      // Encriptar contraseña
      const hashedPassword = bcrypt.hashSync(password, 10);

      // Crear usuario
      const newUser = new User({
        email,
        password: hashedPassword,
      });

      await newUser.save();

      req.session.userId = newUser._id;

      res.json({ msg: "Registro exitoso" });
    } catch (err) {
      console.error("Error en registro:", err);
      res.status(500).json({ msg: "Error interno del servidor" });
    }
  }
);

/* ============================================================
 *                         LOGIN
 * ============================================================*/

app.post(
  "/api/login",
  body("email").isEmail(),
  async (req, res) => {
    const { email, password } = req.body;

    try {
      const user = await User.findOne({ email });

      if (!user) {
        return res.status(401).json({ msg: "Credenciales inválidas" });
      }

      const isMatch = bcrypt.compareSync(password, user.password);

      if (!isMatch) {
        return res.status(401).json({ msg: "Credenciales inválidas" });
      }

      req.session.userId = user._id;

      res.json({ msg: "Login exitoso" });
    } catch (err) {
      console.error("Error en login:", err);
      res.status(500).json({ msg: "Error interno del servidor" });
    }
  }
);

/* ============================================================
 *                       LOGOUT
 * ============================================================*/

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ msg: "Sesión cerrada" });
  });
});

/* ============================================================
 *                     CHECKOUT (simulado)
 * ============================================================*/

app.post("/api/checkout", isAuthenticated, (req, res) => {
  console.log("Orden recibida:", req.body);
  res.json({ msg: "Orden procesada" });
});

/* ============================================================
 *                       INICIAR SERVIDOR
 * ============================================================*/

app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});
