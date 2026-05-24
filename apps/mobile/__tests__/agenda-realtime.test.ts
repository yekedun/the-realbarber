// Debounce mantığını doğrulayan saf fonksiyon testi.
// Supabase kanallarının kurulumu bağımsız manuel test adımlarında doğrulanır.

import { createDebounce } from '../lib/debounce';

describe('agenda realtime debounce', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('peş peşe birden fazla çağrıyı 200ms içinde bir kez çalıştırır', () => {
    const fn = jest.fn();
    const scheduleReload = createDebounce(fn, 200);

    scheduleReload();
    scheduleReload();
    scheduleReload();

    expect(fn).not.toHaveBeenCalled();
    jest.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('200ms aralıkla ayrı çağrılar her biri için fn çalıştırır', () => {
    const fn = jest.fn();
    const scheduleReload = createDebounce(fn, 200);

    scheduleReload();
    jest.advanceTimersByTime(200);
    scheduleReload();
    jest.advanceTimersByTime(200);

    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('kısmen geçmiş zamanda yeniden çağrı, pencereyi sıfırlar', () => {
    const fn = jest.fn();
    const scheduleReload = createDebounce(fn, 200);

    scheduleReload();
    jest.advanceTimersByTime(100); // henüz ateşlenmedi
    scheduleReload();              // pencere sıfırlandı
    jest.advanceTimersByTime(200); // şimdi ateşleniyor

    expect(fn).toHaveBeenCalledTimes(1);
  });
});
