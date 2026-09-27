const API = import.meta.env.VITE_API_URL || '/api';

export const statuses = ['nouvelle', 'en préparation', 'terminée', 'annulée'];
export const DELIVERY_FEE_MILLIMES = 8000;

export function formatTnd(millimes) {
  return new Intl.NumberFormat('fr-TN', {
    style: 'currency', currency: 'TND', minimumFractionDigits: 3, maximumFractionDigits: 3
  }).format(millimes / 1000);
}

export async function request(path, options = {}, token = '') {
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

export function formatDate(date) {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date));
}
