export function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/[\s\-\(\)]/g, "");
  return /^(\+90|0)?[5][0-9]{9}$/.test(digits) || /^[0-9]{10,15}$/.test(digits);
}