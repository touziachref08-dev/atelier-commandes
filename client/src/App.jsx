import { useEffect, useState } from 'react';
import {
  ArrowLeft, ArrowRight, BadgeCheck, ClipboardList, ImagePlus, LockKeyhole,
  LogOut, PackagePlus, Pencil, Plus, ShoppingBag, Trash2, X
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || '/api';
const statuses = ['nouvelle', 'en préparation', 'terminée', 'annulée'];
const DELIVERY_FEE_MILLIMES = 8000;

function formatTnd(millimes) {
  return new Intl.NumberFormat('fr-TN', {
    style: 'currency', currency: 'TND', minimumFractionDigits: 3, maximumFractionDigits: 3
  }).format(millimes / 1000);
}

async function request(path, options = {}, token = '') {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message || 'La requête n’a pas abouti.');
  }
  return response.status === 204 ? null : response.json();
}

function formatDate(date) {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date));
}

function Header({ admin = false }) {
  return (
    <header className="site-header">
      <a className="brand" href="/" aria-label="L'Atelier, accueil">
        <span className="brand-mark">A<span>.</span></span>
        <span className="brand-name">l’atelier<small>OBJETS & PETITES SÉRIES</small></span>
      </a>
      {admin && <a className="header-link" href="/"><ArrowLeft size={16} /> Retour boutique</a>}
    </header>
  );
}

function Storefront() {
  const [articles, setArticles] = useState([]);
  const [selected, setSelected] = useState({});
  const [requestedQuantities, setRequestedQuantities] = useState({});
  const [customer, setCustomer] = useState({ firstName: '', lastName: '', address: '', phone: '' });
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    request('/articles')
      .then(setArticles)
      .catch((reason) => setError(reason.message))
      .finally(() => setLoading(false));
  }, []);

  const selectedCount = Object.values(selected).reduce((total, quantity) => total + quantity, 0);
  const subtotalMillimes = articles.reduce((total, article) => {
    if (!selected[article._id] || !Number.isFinite(article.priceDT)) return total;
    return total + Math.round(article.priceDT * 1000) * selected[article._id];
  }, 0);
  const totalMillimes = subtotalMillimes + (selectedCount ? DELIVERY_FEE_MILLIMES : 0);

  function changeQuantity(article, amount) {
    setSelected((current) => {
      const nextQuantity = Math.max(0, Math.min(article.stock ?? 0, (current[article._id] || 0) + amount));
      const next = { ...current };
      if (nextQuantity === 0) delete next[article._id];
      else next[article._id] = nextQuantity;
      return next;
    });
  }

  function addRequestedQuantity(article) {
    const remaining = (article.stock ?? 0) - (selected[article._id] || 0);
    const quantity = Number.parseInt(requestedQuantities[article._id] ?? '1', 10);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > remaining) return;
    setSelected((current) => ({ ...current, [article._id]: (current[article._id] || 0) + quantity }));
    setRequestedQuantities((current) => ({ ...current, [article._id]: '1' }));
    document.getElementById('commande')?.scrollIntoView({ behavior: 'smooth' });
  }

  async function submitOrder(event) {
    event.preventDefault();
    if (!selectedCount) return;
    setConfirmationOpen(true);
  }

  async function confirmOrder() {
    setError('');
    setNotice('');
    setSubmitting(true);
    try {
      const result = await request('/orders', {
        method: 'POST',
        body: JSON.stringify({
          ...customer,
          items: Object.entries(selected).map(([articleId, quantity]) => ({ articleId, quantity }))
        })
      });
      setNotice(`${result.message} Nous vous recontacterons au ${customer.phone}.`);
      setCustomer({ firstName: '', lastName: '', address: '', phone: '' });
      setSelected({});
      setConfirmationOpen(false);
      setArticles(await request('/articles'));
    } catch (reason) {
      setError(reason.message);
      setConfirmationOpen(false);
      const refreshedArticles = await request('/articles').catch(() => articles);
      setArticles(refreshedArticles);
      setSelected((current) => Object.fromEntries(Object.entries(current).flatMap(([articleId, quantity]) => {
        const available = refreshedArticles.find((article) => article._id === articleId)?.stock ?? 0;
        return available > 0 ? [[articleId, Math.min(quantity, available)]] : [];
      })));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Header />
      <main>
        <section className="intro wrap">
          <div className="intro-copy">
            <p className="eyebrow"><span /> SÉLECTION DU MOMENT</p>
            <h1>De belles choses,<br /><em>à garder longtemps.</em></h1>
            <p className="intro-text">Découvrez les pièces de l’atelier et composez votre commande en quelques instants.</p>
            <a className="text-link" href="#collection">Explorer les articles <ArrowRight size={16} /></a>
          </div>
          <div className="intro-stamp" aria-label="Créé avec soin">
            <span>FAIT AVEC</span><b>soin</b><span>DEPUIS L’ATELIER</span>
          </div>
          <div className="intro-index">COLLECTION <b>01 / 26</b></div>
        </section>

        <section className="catalog-section" id="collection">
          <div className="wrap">
            <div className="section-heading">
              <div><p className="eyebrow">LA COLLECTION</p><h2>Articles disponibles <span>{articles.length.toString().padStart(2, '0')}</span></h2></div>
              <a href="#commande" className="basket-link"><ShoppingBag size={17} /> Ma sélection <b>{selectedCount}</b></a>
            </div>
            {error && <p className="notice error" role="alert">{error}</p>}
            {loading ? <div className="empty-state">Chargement de la collection…</div> : articles.length === 0 ? (
              <div className="empty-state"><span className="empty-icon"><PackagePlus size={22} /></span><h3>La collection se prépare</h3><p>Les nouveaux articles apparaîtront ici dès leur publication.</p></div>
            ) : (
              <div className="product-grid">
                {articles.map((article, index) => (
                  <article className="product" key={article._id} style={{ '--delay': `${index * 70}ms` }}>
                    <div className="product-image-wrap">
                      <img src={article.image} alt={article.title} className="product-image" loading="lazy" />
                      <span className="product-number">N° {String(index + 1).padStart(2, '0')}</span>
                    </div>
                    <div className="product-info">
                      <div className="product-copy"><h3>{article.title}</h3><p>{article.description}</p><strong className="product-price">{Number.isFinite(article.priceDT) ? formatTnd(Math.round(article.priceDT * 1000)) : 'Prix à définir'}</strong><span className={`stock-label ${(article.stock ?? 0) > 0 ? 'in-stock' : 'out-stock'}`}><i />{(article.stock ?? 0) > 0 ? 'En stock' : 'Hors stock'}</span></div>
                      <div className="product-buy">
                        {(article.stock ?? 0) > 0 && Number.isFinite(article.priceDT) && <div className="requested-quantity"><label htmlFor={`quantity-${article._id}`}>Quantité</label><input
                          id={`quantity-${article._id}`}
                          type="number"
                          min="1"
                          max={(article.stock ?? 0) - (selected[article._id] || 0)}
                          step="1"
                          value={requestedQuantities[article._id] ?? '1'}
                          disabled={(article.stock ?? 0) <= (selected[article._id] || 0)}
                          onChange={(event) => setRequestedQuantities((current) => ({ ...current, [article._id]: event.target.value }))}
                          aria-label={`Quantité à acheter pour ${article.title}`}
                        />
                        <button type="button" className="buy-button" disabled={(article.stock ?? 0) <= (selected[article._id] || 0) || Number(requestedQuantities[article._id] ?? '1') < 1 || Number(requestedQuantities[article._id] ?? '1') > (article.stock ?? 0) - (selected[article._id] || 0)} onClick={() => addRequestedQuantity(article)}>{selected[article._id] ? 'Ajouter' : 'Acheter'} <ArrowRight size={15} /></button></div>}
                        {selected[article._id] > 0 && <div className="cart-quantity" aria-label={`${selected[article._id]} dans le panier`}><span>Dans la sélection : {selected[article._id]}</span><button type="button" aria-label={`Retirer un ${article.title} de la sélection`} onClick={() => changeQuantity(article, -1)}><X size={13} /></button></div>}
                        {(article.stock ?? 0) < 1 && <button type="button" className="buy-button" disabled>Indisponible</button>}
                        {(article.stock ?? 0) > 0 && !Number.isFinite(article.priceDT) && <span className="price-pending">Prix à définir</span>}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="order-section" id="commande">
          <div className="wrap order-layout">
            <div className="order-intro">
              <p className="eyebrow">ON S’OCCUPE DE LA SUITE</p>
              <h2>Votre commande,<br /><em>en toute simplicité.</em></h2>
              <p>Indiquez vos coordonnées et nous vous recontacterons pour confirmer les détails.</p>
              <div className="order-summary"><ShoppingBag size={18} /><span>Votre sélection</span><strong>{selectedCount} article{selectedCount > 1 ? 's' : ''}</strong></div>
              {selectedCount > 0 && <><ul className="selected-list">{articles.filter((article) => selected[article._id]).map((article) => <li key={article._id}><span>{article.title} × {selected[article._id]}</span><b>{formatTnd(Math.round((article.priceDT || 0) * 1000) * selected[article._id])}</b></li>)}</ul><div className="price-summary"><div><span>Sous-total</span><b>{formatTnd(subtotalMillimes)}</b></div><div><span>Livraison</span><b>{formatTnd(DELIVERY_FEE_MILLIMES)}</b></div><div className="price-total"><strong>Total à payer</strong><strong>{formatTnd(totalMillimes)}</strong></div></div></>}
            </div>
            <form className="order-form" onSubmit={submitOrder}>
              <div className="form-number">VOS COORDONNÉES</div>
              <div className="customer-name-fields">
                <label>Prénom<input value={customer.firstName} onChange={(event) => setCustomer({ ...customer, firstName: event.target.value })} required maxLength={80} autoComplete="given-name" placeholder="Prénom" /></label>
                <label>Nom<input value={customer.lastName} onChange={(event) => setCustomer({ ...customer, lastName: event.target.value })} required maxLength={80} autoComplete="family-name" placeholder="Nom" /></label>
              </div>
              <label>Adresse de livraison<textarea value={customer.address} onChange={(event) => setCustomer({ ...customer, address: event.target.value })} required maxLength={500} autoComplete="street-address" rows={3} placeholder="Rue, code postal, ville" /></label>
              <label>Numéro de téléphone<input value={customer.phone} onChange={(event) => setCustomer({ ...customer, phone: event.target.value })} required type="tel" maxLength={30} autoComplete="tel" placeholder="06 00 00 00 00" /></label>
              {error && <p className="notice error" role="alert">{error}</p>}
              {notice && <p className="notice success" role="status">{notice}</p>}
              <button className="button button-dark button-wide" type="submit" disabled={!selectedCount}>Continuer vers la confirmation <ArrowRight size={17} /></button>
              {!selectedCount && <p className="form-hint">Choisissez au moins un article pour continuer.</p>}
            </form>
          </div>
        </section>
      </main>
      <footer className="site-footer"><span>l’atelier <b>© 2026</b></span><span>Des objets choisis, simplement.</span></footer>
      {confirmationOpen && <div className="confirm-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !submitting) setConfirmationOpen(false); }}>
        <section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
          <button className="confirm-close" type="button" aria-label="Fermer la confirmation" disabled={submitting} onClick={() => setConfirmationOpen(false)}><X size={18} /></button>
          <p className="eyebrow">DERNIÈRE ÉTAPE</p><h2 id="confirm-title">Confirmer<br /><em>la commande.</em></h2>
          <p className="confirm-copy">Vérifiez vos coordonnées et votre sélection avant l’envoi.</p>
          <div className="confirm-details"><span>{customer.firstName} {customer.lastName}</span><span>{customer.address}</span><span>{customer.phone}</span></div>
          <ul className="confirm-items">{articles.filter((article) => selected[article._id]).map((article) => <li key={article._id}><span>{article.title} × {selected[article._id]}</span><b>{formatTnd(Math.round((article.priceDT || 0) * 1000) * selected[article._id])}</b></li>)}</ul>
          <div className="price-summary confirm-price-summary"><div><span>Sous-total</span><b>{formatTnd(subtotalMillimes)}</b></div><div><span>Livraison</span><b>{formatTnd(DELIVERY_FEE_MILLIMES)}</b></div><div className="price-total"><strong>Total à payer</strong><strong>{formatTnd(totalMillimes)}</strong></div></div>
          <div className="confirm-actions"><button className="button button-quiet" type="button" disabled={submitting} onClick={() => setConfirmationOpen(false)}>Modifier</button><button className="button button-dark" type="button" disabled={submitting} onClick={confirmOrder}>{submitting ? 'Enregistrement…' : 'Confirmer la commande'} <BadgeCheck size={16} /></button></div>
        </section>
      </div>}
    </>
  );
}

function Admin() {
  const [token, setToken] = useState(() => sessionStorage.getItem('atelier-admin-token') || '');
  const [password, setPassword] = useState('');
  const [articles, setArticles] = useState([]);
  const [orders, setOrders] = useState([]);
  const [section, setSection] = useState('orders');
  const [draft, setDraft] = useState({ title: '', description: '', image: '', stock: '0', priceDT: '' });
  const [editing, setEditing] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function loadDashboard(authToken = token) {
    const [nextArticles, nextOrders] = await Promise.all([
      request('/articles'), request('/admin/orders', {}, authToken)
    ]);
    setArticles(nextArticles);
    setOrders(nextOrders);
  }

  useEffect(() => {
    if (token) loadDashboard().catch((reason) => {
      setError(reason.message);
      if (reason.message.includes('Session') || reason.message.includes('Authentification')) signOut();
    });
  }, [token]);

  function signOut() {
    sessionStorage.removeItem('atelier-admin-token');
    setToken('');
    setOrders([]);
  }

  async function login(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await request('/admin/login', { method: 'POST', body: JSON.stringify({ password }) });
      sessionStorage.setItem('atelier-admin-token', result.token);
      setToken(result.token);
      setPassword('');
    } catch (reason) {
      setError(reason.message);
    } finally {
      setBusy(false);
    }
  }

  function startEdit(article) {
    setEditing(article._id);
    setDraft({ title: article.title, description: article.description, image: article.image, stock: String(article.stock ?? 0), priceDT: article.priceDT == null ? '' : String(article.priceDT) });
    setSection('articles');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function resetDraft() {
    setEditing('');
    setDraft({ title: '', description: '', image: '', stock: '0', priceDT: '' });
  }

  async function saveArticle(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await request(editing ? `/articles/${editing}` : '/articles', {
        method: editing ? 'PUT' : 'POST', body: JSON.stringify(draft)
      }, token);
      await loadDashboard();
      setMessage(editing ? 'Article mis à jour.' : 'Article publié.');
      resetDraft();
    } catch (reason) {
      setError(reason.message);
    } finally {
      setBusy(false);
    }
  }

  async function removeArticle(id) {
    if (!window.confirm('Supprimer cet article ? Les commandes déjà reçues garderont leur récapitulatif.')) return;
    setError('');
    try {
      await request(`/articles/${id}`, { method: 'DELETE' }, token);
      setArticles((current) => current.filter((article) => article._id !== id));
      setMessage('Article supprimé.');
    } catch (reason) {
      setError(reason.message);
    }
  }

  async function changeStatus(id, status) {
    try {
      const updated = await request(`/admin/orders/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }, token);
      setOrders((current) => current.map((order) => order._id === id ? updated : order));
    } catch (reason) {
      setError(reason.message);
    }
  }

  async function readImage(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) return setError('Choisissez un fichier image.');
    if (file.size > 2 * 1024 * 1024) return setError('L’image doit peser 2 Mo maximum.');
    const reader = new FileReader();
    reader.onload = () => setDraft((current) => ({ ...current, image: String(reader.result) }));
    reader.onerror = () => setError('Impossible de lire cette image.');
    reader.readAsDataURL(file);
  }

  if (!token) {
    return <><Header admin /><main className="admin-login wrap"><div className="login-mark"><LockKeyhole size={24} /></div><p className="eyebrow">ESPACE PRIVÉ</p><h1>Bonjour,<br /><em>administrateur.</em></h1><p className="login-copy">Connectez-vous pour gérer la collection et suivre les commandes.</p><form className="login-form" onSubmit={login}><label>Mot de passe<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" autoFocus /></label>{error && <p className="notice error" role="alert">{error}</p>}<button className="button button-dark button-wide" disabled={busy}>{busy ? 'Connexion…' : 'Ouvrir la session'} <ArrowRight size={17} /></button></form><a className="back-link" href="/"><ArrowLeft size={15} /> Revenir à la boutique</a></main></>;
  }

  return (
    <>
      <Header admin />
      <main className="admin-page wrap">
        <div className="admin-heading"><div><p className="eyebrow">ESPACE DE GESTION</p><h1>Le tableau <em>de bord.</em></h1></div><button className="icon-button" title="Fermer la session" aria-label="Fermer la session" onClick={signOut}><LogOut size={18} /></button></div>
        <nav className="admin-tabs" aria-label="Sections d'administration">
          <button className={section === 'orders' ? 'active' : ''} onClick={() => setSection('orders')}><ClipboardList size={17} /> Commandes <span>{orders.length}</span></button>
          <button className={section === 'articles' ? 'active' : ''} onClick={() => setSection('articles')}><PackagePlus size={17} /> Articles <span>{articles.length}</span></button>
        </nav>
        {error && <p className="notice error" role="alert">{error}</p>}
        {message && <p className="notice success" role="status">{message}</p>}

        {section === 'orders' ? (
          <section className="dashboard-section"><div className="dashboard-title"><div><p className="eyebrow">SUIVI CLIENT</p><h2>Les commandes</h2></div><span className="count-label">{orders.length} au total</span></div>
            {orders.length === 0 ? <div className="empty-state admin-empty"><span className="empty-icon"><ShoppingBag size={22} /></span><h3>Pas encore de commande</h3><p>Les prochaines demandes apparaîtront dans cette liste.</p></div> :
              <div className="orders-list">{orders.map((order, index) => <article className="order-row" key={order._id}>
                <div className="order-row-top"><span className="order-number">CMD-{String(orders.length - index).padStart(3, '0')}</span><time>{formatDate(order.createdAt)}</time></div>
                <div className="order-customer"><h3>{order.customerName}</h3><p>{order.address}</p>{order.phone && <a className="order-phone" href={`tel:${order.phone}`}>{order.phone}</a>}</div>
                <div className="order-items">
                  {order.items.map((item, itemIndex) => <div className="order-item" key={`${order._id}-${item.article || item.title}-${itemIndex}`}>
                    {item.image ? <img src={item.image} alt={item.title} className="order-item-image" /> : <span className="order-item-placeholder">Photo</span>}
                    <div className="order-item-details"><strong>{item.title}</strong><span>Quantité : <b>{item.quantity}</b></span>{Number.isFinite(item.unitPriceMillimes) && <small>{formatTnd(item.unitPriceMillimes)} / unité</small>}</div>
                    {Number.isFinite(item.unitPriceMillimes) && <strong className="order-item-total">{formatTnd(item.unitPriceMillimes * item.quantity)}</strong>}
                  </div>)}
                  {Number.isFinite(order.subtotalMillimes) && <div className="admin-order-summary"><span>Sous-total</span><b>{formatTnd(order.subtotalMillimes)}</b></div>}
                  {Number.isFinite(order.deliveryFeeMillimes) && <div className="admin-order-summary"><span>Livraison</span><b>{formatTnd(order.deliveryFeeMillimes)}</b></div>}
                  {Number.isFinite(order.totalMillimes) && <strong className="admin-order-total">Total à encaisser : {formatTnd(order.totalMillimes)}</strong>}
                </div>
                <label className="status-field"><span>Statut</span><select value={order.status} onChange={(event) => changeStatus(order._id, event.target.value)}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></label>
              </article>)}</div>}
          </section>
        ) : (
          <section className="dashboard-section article-admin"><div className="dashboard-title"><div><p className="eyebrow">VOTRE SÉLECTION</p><h2>{editing ? 'Modifier l’article' : 'Publier un article'}</h2></div></div>
            <div className="admin-workspace">
              <form className="article-form" onSubmit={saveArticle}>
                <label>Titre<input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} maxLength={120} required placeholder="Ex. Vase en grès" /></label>
                <label>Prix de vente (DT)<input type="number" min="0" step="0.001" required value={draft.priceDT} onChange={(event) => setDraft({ ...draft, priceDT: event.target.value })} placeholder="Ex. 25.500" /></label>
                <label>Description<textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} maxLength={2000} rows={4} required placeholder="Quelques mots sur cette pièce…" /></label>
                <label>Quantité en stock<input type="number" min="0" step="1" required value={draft.stock} onChange={(event) => setDraft({ ...draft, stock: event.target.value })} /></label>
                <label>Adresse de l’image<input value={draft.image.startsWith('data:') ? '' : draft.image} onChange={(event) => setDraft({ ...draft, image: event.target.value })} placeholder="https://…" /></label>
                <label className="upload-control"><input type="file" accept="image/*" onChange={(event) => readImage(event.target.files?.[0])} /><ImagePlus size={17} /><span>Importer une image</span><small>2 Mo max.</small></label>
                {draft.image && <img className="image-preview" src={draft.image} alt="Aperçu de l’article" />}
                <div className="form-actions"><button className="button button-dark" disabled={busy}>{busy ? 'Enregistrement…' : editing ? 'Enregistrer' : 'Publier'} <ArrowRight size={16} /></button>{editing && <button type="button" className="button button-quiet" onClick={resetDraft}><X size={16} /> Annuler</button>}</div>
              </form>
              <div className="managed-articles">{articles.length === 0 ? <p className="managed-empty">Aucun article publié pour l’instant.</p> : articles.map((article) => <article className="managed-article" key={article._id}><img src={article.image} alt="" /><div><h3>{article.title}</h3><p>{article.description}</p><strong className="managed-price">{Number.isFinite(article.priceDT) ? formatTnd(Math.round(article.priceDT * 1000)) : 'Prix à définir'}</strong><span className={`stock-label ${(article.stock ?? 0) > 0 ? 'in-stock' : 'out-stock'}`}><i />{article.stock ?? 0} en stock</span></div><button type="button" className="edit-article-button" title={`Modifier ${article.title}`} onClick={() => startEdit(article)}><Pencil size={14} /><span>Modifier</span></button><button type="button" className="icon-button icon-danger" title={`Supprimer ${article.title}`} aria-label={`Supprimer ${article.title}`} onClick={() => removeArticle(article._id)}><Trash2 size={16} /></button></article>)}</div>
            </div>
          </section>
        )}
      </main>
      <footer className="site-footer"><span>l’atelier <b>ADMINISTRATION</b></span><span><LogOut size={14} /> Session privée</span></footer>
    </>
  );
}

export default function App() {
  return window.location.pathname.startsWith('/admin') ? <Admin /> : <Storefront />;
}
