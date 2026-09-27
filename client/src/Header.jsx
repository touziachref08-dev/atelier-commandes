import { ArrowLeft } from 'lucide-react';

export default function Header({ admin = false }) {
  return (
    <header className="site-header">
      <a className="brand" href="/" aria-label="RZ Collection My Silver, accueil">
        <img className="brand-mark" src="/rz-mark.svg" alt="" aria-hidden="true" />
        <span className="brand-name">RZ Collection<small>MY SILVER · ACCESSOIRES</small></span>
      </a>
      {admin && <a className="header-link" href="/"><ArrowLeft size={16} /> Retour boutique</a>}
    </header>
  );
}
