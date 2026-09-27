import { Fragment, useEffect, useState } from 'react';
import { ArrowRight, BadgeCheck, ChevronLeft, ChevronRight, ClipboardCheck, PackagePlus, PhoneCall, ShoppingBag, Sparkles, X } from 'lucide-react';
import Header from './Header.jsx';
import { DELIVERY_FEE_MILLIMES, formatTnd, request } from './shared.js';

export default function Storefront() {
  const [articles, setArticles] = useState([]);
  const [selected, setSelected] = useState({});
  const [requestedQuantities, setRequestedQuantities] = useState({});
  const [customer, setCustomer] = useState({ firstName: '', lastName: '', address: '', phone: '' });
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    request('/articles')
      .then(setArticles)
      .catch((reason) => setError(reason.message))
      .finally(() => setLoading(false));
  }, []);

  const featuredArticles = articles.filter((article) => article.image);
  const activeFeaturedIndex = featuredArticles.length ? featuredIndex % featuredArticles.length : 0;
  const featuredArticle = featuredArticles[activeFeaturedIndex];

  useEffect(() => {
    if (featuredArticles.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const intervalId = window.setInterval(() => {
      setFeaturedIndex((current) => (current + 1) % featuredArticles.length);
    }, 5000);
    return () => window.clearInterval(intervalId);
  }, [featuredArticles.length]);

  function changeFeaturedArticle(direction) {
    if (!featuredArticles.length) return;
    setFeaturedIndex((current) => (current + direction + featuredArticles.length) % featuredArticles.length);
  }

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

  function submitOrder(event) {
    event.preventDefault();
    if (selectedCount) setConfirmationOpen(true);
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
        <section className="intro">
          <div className="intro-layout wrap">
            <div className="intro-copy">
              <p className="eyebrow"><span /> RZ COLLECTION PRÉSENTE</p>
              <h1>Or 18K &amp; argent,<br /><em>l’éclat au quotidien.</em></h1>
              <p className="intro-text">Découvrez des bijoux en or 18 carats et en argent, choisis pour accompagner votre style.</p>
              <a className="text-link" href="#collection">Découvrir la collection <ArrowRight size={16} /></a>
              <div className="intro-index">UNE COLLECTION À PORTER <b>{String(articles.length).padStart(2, '0')} PIÈCES</b></div>
            </div>
            <div className="intro-visual">
              {featuredArticle ? (
                <>
                  <Fragment key={featuredArticle._id}>
                    <img src={featuredArticle.image} alt={featuredArticle.title} className="intro-product-image" />
                    <div className="intro-product-caption"><span>À DÉCOUVRIR · {(featuredArticle.stock ?? 0) > 0 ? 'EN STOCK' : 'INDISPONIBLE'}</span><strong>{featuredArticle.title}</strong><b>{(featuredArticle.stock ?? 0) > 0 && Number.isFinite(featuredArticle.priceDT) ? formatTnd(Math.round(featuredArticle.priceDT * 1000)) : (featuredArticle.stock ?? 0) > 0 ? 'Prix à définir' : 'Hors stock'}</b></div>
                  </Fragment>
                </>
              ) : <img src="/rz-mark.svg" alt="Logo RZ Collection My Silver" className="intro-logo-fallback" />}
              <span className="intro-visual-label"><Sparkles size={14} /> RZ COLLECTION · MY SILVER</span>
              {featuredArticles.length > 1 && <div className="featured-controls" aria-label="Navigation des articles mis en avant">
                <span aria-live="polite">{String(activeFeaturedIndex + 1).padStart(2, '0')} / {String(featuredArticles.length).padStart(2, '0')}</span>
                <button type="button" title="Article précédent" aria-label="Article précédent" onClick={() => changeFeaturedArticle(-1)}><ChevronLeft size={17} /></button>
                <button type="button" title="Article suivant" aria-label="Article suivant" onClick={() => changeFeaturedArticle(1)}><ChevronRight size={17} /></button>
              </div>}
            </div>
          </div>
        </section>

        <section className="brand-promise" aria-label="Les engagements de la boutique">
          <div><Sparkles size={18} /><span><strong>Or 18K &amp; argent</strong><small>Des bijoux pour chaque style</small></span></div>
          <div><ClipboardCheck size={18} /><span><strong>Commande simple</strong><small>Sans création de compte</small></span></div>
          <div><PhoneCall size={18} /><span><strong>Confirmation personnelle</strong><small>Nous vous recontactons après commande</small></span></div>
        </section>

        <section className="catalog-section" id="collection">
          <div className="wrap">
            <div className="section-heading">
              <div><p className="eyebrow">LA SÉLECTION RZ</p><h2>Trouvez votre signature <span>{articles.length.toString().padStart(2, '0')}</span></h2></div>
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
      <footer className="site-footer"><span>RZ Collection <b>MY SILVER · 2026</b></span><span>Votre style, votre éclat.</span></footer>
      {selectedCount > 0 && <>
        <div className="basket-dock-spacer" aria-hidden="true" />
        <aside className="basket-dock" aria-label="Votre panier">
          <div className="basket-dock-summary">
            <span className="basket-dock-icon"><ShoppingBag size={18} /></span>
            <span className="basket-dock-copy" aria-live="polite"><strong>{selectedCount} article{selectedCount > 1 ? 's' : ''} dans votre panier</strong><small>Total, livraison comprise <b>{formatTnd(totalMillimes)}</b></small></span>
          </div>
          <a href="#commande" className="basket-dock-action">Finaliser <ArrowRight size={16} /></a>
        </aside>
      </>}
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
