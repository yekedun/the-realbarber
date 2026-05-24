import {
  serviceFormToDb,
  serviceRowToView,
  type ServiceRow,
} from '../lib/service-mappers';

describe('service mappers', () => {
  it('maps Supabase is_active into the mobile active flag', () => {
    const row: ServiceRow = {
      id: 'svc-1',
      name: 'Kesim',
      duration_min: 30,
      price_cents: 25000,
      is_active: false,
    };

    expect(serviceRowToView(row)).toEqual({
      id: 'svc-1',
      name: 'Kesim',
      duration: 30,
      price: 250,
      active: false,
    });
  });

  it('writes the DB is_active column instead of a non-existent active column', () => {
    expect(serviceFormToDb({
      name: 'Sakal',
      duration: 20,
      price: 150,
      active: true,
    })).toEqual({
      name: 'Sakal',
      duration_min: 20,
      price_cents: 15000,
      is_active: true,
    });
  });
});
