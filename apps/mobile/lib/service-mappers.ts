export interface ServiceRow {
  id: string;
  name: string;
  duration_min: number;
  price_cents: number | null;
  is_active: boolean;
}

export interface ServiceView {
  id: string;
  name: string;
  duration: number;
  price: number;
  active: boolean;
}

export interface ServiceForm {
  name: string;
  duration: number;
  price: number;
  active: boolean;
}

export function serviceRowToView(row: ServiceRow): ServiceView {
  return {
    id: row.id,
    name: row.name,
    duration: row.duration_min,
    price: Math.round((row.price_cents ?? 0) / 100),
    active: row.is_active,
  };
}

export function serviceFormToDb(form: ServiceForm) {
  return {
    name: form.name,
    duration_min: form.duration,
    price_cents: form.price * 100,
    is_active: form.active,
  };
}
