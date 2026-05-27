type BlockReason = 'anlik' | 'mola' | 'kisisel';

interface BuildBlockInsertInput {
  staffId: string | null;
  startTime: string;
  durationMin: number;
  reason: BlockReason;
  baseDate?: Date;
}

export interface BlockInsertPayload {
  staff_id: string;
  starts_at: string;
  ends_at: string;
  reason: string;
  created_via: 'app';
}

export type BuildBlockInsertResult =
  | { ok: true; payload: BlockInsertPayload }
  | { ok: false; message: string };

const REASON_MAP: Record<BlockReason, string> = {
  anlik: 'walkin',
  mola: 'break',
  kisisel: 'personal',
};

function parseTimeHM(time: string): { h: number; m: number } | null {
  const parts = time.split(':');
  if (parts.length !== 2) return null;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (!Number.isInteger(h) || !Number.isInteger(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return { h, m };
}

export function buildBlockInsert(input: BuildBlockInsertInput): BuildBlockInsertResult {
  if (!input.staffId) {
    return { ok: false, message: 'Hesap bilgileri yuklenemedi. Lutfen tekrar deneyin.' };
  }

  const parsed = parseTimeHM(input.startTime);
  if (!parsed) {
    return { ok: false, message: `Geçersiz saat formatı: "${input.startTime}"` };
  }

  if (input.durationMin <= 0 || input.durationMin > 480) {
    return { ok: false, message: 'Geçersiz süre. 1-480 dakika arası olmalı.' };
  }

  const reason = REASON_MAP[input.reason];
  if (!reason) {
    return { ok: false, message: `Geçersiz neden: "${input.reason}"` };
  }

  const startsAt = new Date(input.baseDate ?? new Date());
  startsAt.setHours(parsed.h, parsed.m, 0, 0);
  const endsAt = new Date(startsAt.getTime() + input.durationMin * 60_000);

  return {
    ok: true,
    payload: {
      staff_id: input.staffId,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      reason,
      created_via: 'app',
    },
  };
}
