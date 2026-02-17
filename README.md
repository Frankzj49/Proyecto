# Minimarket Web - Gestión de Inventario y Ventas (Firebase)

Aplicación web para gestionar productos, inventario y ventas, con autenticación y control de acceso por roles usando Firebase.

## 🔗 Demo
- Demo (Dashboard directo / modo demo): **https://elesfuerzo-b742d.web.app/**
- Repositorio: **https://github.com/Frankzj49/Proyecto.git**

##  Funcionalidades
- Login con Firebase Authentication
- Dashboard de administración
- Gestión de productos (crear/editar/eliminar)
- Módulo de caja (ventas) con cálculo automático de totales
- Descuento automático de stock al registrar una venta
- Validaciones para evitar ventas sin stock
- Reglas de seguridad en Firestore (roles / acceso)

## Tecnologías
- HTML + CSS + JavaScript (ES6)
- Firebase Authentication
- Cloud Firestore
- Firebase Hosting
- Firestore Security Rules + Indexes

## Estructura del proyecto
- `index.html`: pantalla inicial / login
- `dashboard.html`: panel principal
- `cajero.html`: módulo de ventas
- `auth.js`: lógica de autenticación
- `productos.js`: CRUD y lógica de productos
- `cajero.js`: lógica de ventas y stock
- `app.js`: inicialización Firebase y utilidades
- `firestore.rules`: reglas de seguridad
- `firestore.indexes.json`: índices

## Ejecutar localmente
### Firebase local 
```bash
npm install -g firebase-tools
firebase login
firebase init
firebase serve
