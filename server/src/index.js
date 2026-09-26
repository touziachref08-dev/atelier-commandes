import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import Article from './models/Article.js';
import Order from './models/Order.js';

dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)) });

const app = express();
const port = Number(process.env.PORT || 4000);
const jwtSecret = process.env.JWT_SECRET;
const adminPassword = process.env.ADMIN_PASSWORD;

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_ORIGIN || true }));
app.use(express.json({ limit: '4mb' }));

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function isValidImage(value) {
  return typeof value === 'string' && (
    /^https?:\/\//i.test(value) || /^data:image\/(png|jpeg|webp|gif);base64,/i.test(value)
  );
}

function requireAdmin(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ message: 'Authentification requise.' });
  try {
    jwt.verify(token, jwtSecret);
    next();
  } catch {
    res.status(401).json({ message: 'Session invalide ou expirée.' });
  }
}

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.post('/api/admin/login', (req, res) => {
  const supplied = Buffer.from(String(req.body?.password ?? ''));
  const expected = Buffer.from(adminPassword);
  const matches = supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
  if (!matches) return res.status(401).json({ message: 'Mot de passe incorrect.' });
  const token = jwt.sign({ role: 'admin' }, jwtSecret, { expiresIn: '8h' });
  res.json({ token });
});

app.get('/api/articles', asyncRoute(async (_req, res) => {
  const articles = await Article.find().sort({ createdAt: -1 }).lean();
  res.json(articles.map((article) => ({ ...article, stock: article.stock ?? 0, priceDT: article.priceDT ?? null })));
}));

app.get('/api/articles/:id', asyncRoute(async (req, res) => {
  const article = await Article.findById(req.params.id).lean();
  if (!article) return res.status(404).json({ message: 'Article introuvable.' });
  res.json(article);
}));

app.post('/api/articles', requireAdmin, asyncRoute(async (req, res) => {
  const { title, description, image, stock, priceDT } = req.body ?? {};
  const parsedPriceDT = Number(priceDT);
  if (!title?.trim() || !description?.trim() || !isValidImage(image) || stock === undefined || stock === '' || !Number.isInteger(Number(stock)) || Number(stock) < 0 || priceDT === undefined || priceDT === '' || !Number.isFinite(parsedPriceDT) || parsedPriceDT < 0 || Math.round(parsedPriceDT * 1000) !== parsedPriceDT * 1000) {
    return res.status(400).json({ message: 'Titre, description, image, stock entier et prix valide (3 décimales maximum) sont obligatoires.' });
  }
  const article = await Article.create({ title, description, image, stock: Number(stock), priceDT: parsedPriceDT });
  res.status(201).json(article);
}));

app.put('/api/articles/:id', requireAdmin, asyncRoute(async (req, res) => {
  const { title, description, image, stock, priceDT } = req.body ?? {};
  const parsedPriceDT = Number(priceDT);
  if (!title?.trim() || !description?.trim() || !isValidImage(image) || stock === undefined || stock === '' || !Number.isInteger(Number(stock)) || Number(stock) < 0 || priceDT === undefined || priceDT === '' || !Number.isFinite(parsedPriceDT) || parsedPriceDT < 0 || Math.round(parsedPriceDT * 1000) !== parsedPriceDT * 1000) {
    return res.status(400).json({ message: 'Titre, description, image, stock entier et prix valide (3 décimales maximum) sont obligatoires.' });
  }
  const article = await Article.findByIdAndUpdate(
    req.params.id, { title, description, image, stock: Number(stock), priceDT: parsedPriceDT }, { new: true, runValidators: true }
  );
  if (!article) return res.status(404).json({ message: 'Article introuvable.' });
  res.json(article);
}));

app.delete('/api/articles/:id', requireAdmin, asyncRoute(async (req, res) => {
  const article = await Article.findByIdAndDelete(req.params.id);
  if (!article) return res.status(404).json({ message: 'Article introuvable.' });
  res.status(204).end();
}));

app.post('/api/orders', asyncRoute(async (req, res) => {
  const { firstName, lastName, address, phone, items } = req.body ?? {};
  if (!firstName?.trim() || !lastName?.trim() || !address?.trim() || !phone?.trim() || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Prénom, nom, adresse, téléphone et au moins un article sont obligatoires.' });
  }
  const quantities = new Map();
  for (const item of items) {
    if (!mongoose.isValidObjectId(item.articleId)) {
      return res.status(400).json({ message: 'Un article sélectionné est invalide.' });
    }
    const quantity = Number(item.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      return res.status(400).json({ message: 'Chaque quantité doit être un entier entre 1 et 99.' });
    }
    quantities.set(item.articleId, (quantities.get(item.articleId) || 0) + quantity);
    if (quantities.get(item.articleId) > 99) {
      return res.status(400).json({ message: 'La quantité cumulée d’un même article ne peut pas dépasser 99.' });
    }
  }
  const articles = await Article.find({ _id: { $in: [...quantities.keys()] } }).lean();
  if (articles.length !== quantities.size) {
    return res.status(400).json({ message: 'Un ou plusieurs articles ne sont plus disponibles.' });
  }
  if (articles.some((article) => !Number.isFinite(article.priceDT) || article.priceDT < 0)) {
    return res.status(409).json({ message: 'Un article n’a pas encore de prix. Contactez la boutique pour finaliser cette commande.' });
  }
  const reserved = [];
  const deliveryFeeMillimes = 8000;
  try {
    for (const article of articles) {
      const quantity = quantities.get(String(article._id));
      const updated = await Article.findOneAndUpdate(
        { _id: article._id, stock: { $gte: quantity } },
        { $inc: { stock: -quantity } },
        { new: true }
      ).lean();
      if (!updated) {
        await Promise.all(reserved.map(({ id, amount }) => Article.updateOne({ _id: id }, { $inc: { stock: amount } })));
        return res.status(409).json({ message: `Stock insuffisant pour « ${article.title} ». Actualisez la page et réduisez la quantité.` });
      }
      reserved.push({ id: article._id, amount: quantity });
    }
    const subtotalMillimes = articles.reduce((sum, article) => {
      const unitPriceMillimes = Math.round(article.priceDT * 1000);
      return sum + unitPriceMillimes * quantities.get(String(article._id));
    }, 0);
    const order = await Order.create({
      firstName,
      lastName,
      customerName: `${firstName.trim()} ${lastName.trim()}`,
      address,
      phone,
      subtotalMillimes,
      deliveryFeeMillimes,
      totalMillimes: subtotalMillimes + deliveryFeeMillimes,
      items: articles.map((article) => ({
        article: article._id,
        title: article.title,
        image: article.image,
        quantity: quantities.get(String(article._id)),
        unitPriceMillimes: Math.round(article.priceDT * 1000)
      }))
    });
    res.status(201).json({ id: order.id, message: 'Commande enregistrée.' });
  } catch (error) {
    await Promise.all(reserved.map(({ id, amount }) => Article.updateOne({ _id: id }, { $inc: { stock: amount } })));
    throw error;
  }
}));

app.get('/api/admin/orders', requireAdmin, asyncRoute(async (_req, res) => {
  const orders = await Order.find().sort({ createdAt: -1 }).lean();
  res.json(orders);
}));

app.patch('/api/admin/orders/:id', requireAdmin, asyncRoute(async (req, res) => {
  const statuses = ['nouvelle', 'en préparation', 'terminée', 'annulée'];
  if (!statuses.includes(req.body?.status)) {
    return res.status(400).json({ message: 'Statut de commande invalide.' });
  }
  const order = await Order.findByIdAndUpdate(
    req.params.id, { status: req.body.status }, { new: true, runValidators: true }
  );
  if (!order) return res.status(404).json({ message: 'Commande introuvable.' });
  res.json(order);
}));

app.use((error, _req, res, _next) => {
  console.error(error);
  if (error.name === 'ValidationError' || error.name === 'CastError') {
    return res.status(400).json({ message: 'Les données envoyées sont invalides.' });
  }
  res.status(500).json({ message: 'Une erreur serveur est survenue.' });
});

if (!adminPassword || !jwtSecret) {
  console.error('Configurez ADMIN_PASSWORD et JWT_SECRET dans le fichier .env à la racine.');
  process.exit(1);
}

mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/atelier_commandes')
  .then(() => app.listen(port, () => console.log(`API prête sur http://localhost:${port}`)))
  .catch((error) => {
    console.error('Connexion MongoDB impossible :', error.message);
    process.exit(1);
  });
