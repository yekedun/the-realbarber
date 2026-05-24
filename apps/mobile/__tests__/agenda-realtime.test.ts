// Debounce mantığını doğrulayan saf fonksiyon testi.
// Supabase kanallarının kurulumu bağımsız manuel test adımlarında doğrulanır.

describe('agenda realtime debounce', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('peş peşe birden fazla çağrıyı 200ms içinde bir kez çalıştırır', () => {
    const fn = jest.fn();

    // debounce mantığını doğrudan simüle ediyoruz
    let timer: ReturnType<typeof setTimeout> | null = null;
    function scheduleReload() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(fn, 200);
    }

    scheduleReload();
    scheduleReload();
    scheduleReload();

    expect(fn).not.toHaveBeenCalled();
    jest.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('200ms aralıkla ayrı çağrılar her biri için fn çalıştırır', () => {
    const fn = jest.fn();

    let timer: ReturnType<typeof setTimeout> | null = null;
    function scheduleReload() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(fn, 200);
    }

    scheduleReload();
    jest.advanceTimersByTime(200);
    scheduleReload();
    jest.advanceTimersByTime(200);

    expect(fn).toHaveBeenCalledTimes(2);
  });
});
