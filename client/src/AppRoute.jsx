import { lazy, Suspense } from 'react';

const Storefront = lazy(() => import('./Storefront.jsx'));
const Admin = lazy(() => import('./Admin.jsx'));

export default function AppRoute() {
  const Page = window.location.pathname.startsWith('/admin') ? Admin : Storefront;

  return (
    <Suspense fallback={<main className="empty-state">Chargement…</main>}>
      <Page />
    </Suspense>
  );
}
