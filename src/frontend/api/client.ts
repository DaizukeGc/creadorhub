// Cliente HTTP tipado para el frontend con manejo de credenciales y cookies
export async function apiFetch<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const defaultHeaders: Record<string, string> = {
    'Accept': 'application/json'
  };

  if (!(options.body instanceof FormData)) {
    defaultHeaders['Content-Type'] = 'application/json';
  }

  const response = await fetch(endpoint, {
    ...options,
    credentials: 'include', // Para enviar/recibir cookies HttpOnly
    headers: {
      ...defaultHeaders,
      ...options.headers
    }
  });

  const data: any = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || data.message || `Error en la solicitud (${response.status})`);
  }

  return data as T;
}

// Helper para notificaciones Toast
export function showToast(message: string, type: 'success' | 'error' | 'info' = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const icons = {
    success: 'fa-check-circle',
    error: 'fa-exclamation-circle',
    info: 'fa-info-circle'
  };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i><span>${escapeHTML(message)}</span>`;

  container.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

export function escapeHTML(str: string): string {
  return String(str || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c] || c));
}

export function formatMoney(amount: number): string {
  return `$${Number(amount || 0).toLocaleString('es-CO')}`;
}
