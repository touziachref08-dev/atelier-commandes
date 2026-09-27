import { useEffect, useState } from 'react';
import {
  ArrowLeft, ArrowRight, ClipboardList, ImagePlus, LockKeyhole, LogOut,
  PackagePlus, Pencil, ShoppingBag, Trash2, X
} from 'lucide-react';
import Header from './Header.jsx';
import { formatDate, formatTnd, request, statuses } from './shared.js';

export default function Admin() {
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
                <label>Titre<input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} maxLength={120} required placeholder="Ex. Bague en or 18K" /></label>
                <label>Prix de vente (DT)<input type="number" min="0" step="0.001" required value={draft.priceDT} onChange={(event) => setDraft({ ...draft, priceDT: event.target.value })} placeholder="Ex. 250.000" /></label>
                <label>Description<textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} maxLength={2000} rows={4} required placeholder="Matière, détails et conseils d’entretien…" /></label>
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
      <footer className="site-footer"><span>RZ Collection <b>MY SILVER · ADMINISTRATION</b></span><span><LogOut size={14} /> Session privée</span></footer>
    </>
  );
}
