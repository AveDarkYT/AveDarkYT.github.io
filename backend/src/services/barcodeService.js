'use strict';

/**
 * Validación de formatos de código de barras
 * Soporta: EAN-13, EAN-8, CODE-39, CODE-128, UPC-A, UPC-E, QR
 */

const BARCODE_PATTERNS = {
  'EAN-13':  /^\d{13}$/,
  'EAN-8':   /^\d{8}$/,
  'UPC-A':   /^\d{12}$/,
  'UPC-E':   /^\d{8}$/,
  'CODE-39': /^[A-Z0-9\-\.\$\/\+\% ]{1,43}$/,
  'CODE-128': /^[\x00-\x7F]{1,80}$/,
  'QR':      /^.{1,4296}$/
};

/**
 * Valida un código de barras e intenta detectar su formato.
 * @param {string} barcode - El código escaneado
 * @returns {{ valid: boolean, format: string|null, reason: string|null }}
 */
function validateBarcode(barcode) {
  if (!barcode || typeof barcode !== 'string') {
    return { valid: false, format: null, reason: 'El código de barras es vacío o inválido' };
  }

  const trimmed = barcode.trim();

  if (trimmed.length === 0) {
    return { valid: false, format: null, reason: 'El código de barras está vacío' };
  }

  if (trimmed.length > 4296) {
    return { valid: false, format: null, reason: 'El código de barras supera la longitud máxima' };
  }

  // Detectar formato automáticamente
  for (const [format, pattern] of Object.entries(BARCODE_PATTERNS)) {
    if (pattern.test(trimmed)) {
      // Validación adicional del dígito verificador para EAN-13
      if (format === 'EAN-13' && !validateEAN13Checksum(trimmed)) {
        continue; // No es un EAN-13 válido, seguir probando
      }
      return { valid: true, format, reason: null };
    }
  }

  // Si no coincide con ningún patrón conocido pero tiene caracteres válidos,
  // aceptarlo como formato desconocido (flexibilidad para códigos internos)
  if (/^[A-Za-z0-9\-\_\.\$\/\+\% ]+$/.test(trimmed)) {
    return { valid: true, format: 'INTERNO', reason: null };
  }

  return {
    valid: false,
    format: null,
    reason: `El código "${trimmed}" contiene caracteres inválidos`
  };
}

/**
 * Valida el dígito verificador de un código EAN-13
 */
function validateEAN13Checksum(barcode) {
  const digits = barcode.split('').map(Number);
  const checkDigit = digits.pop();
  const sum = digits.reduce((acc, digit, index) => {
    return acc + digit * (index % 2 === 0 ? 1 : 3);
  }, 0);
  const computed = (10 - (sum % 10)) % 10;
  return computed === checkDigit;
}

/**
 * Normaliza un código (elimina espacios, convierte a mayúsculas si es CODE-39)
 */
function normalizeBarcode(barcode) {
  if (!barcode) return '';
  return barcode.trim();
}

module.exports = { validateBarcode, validateEAN13Checksum, normalizeBarcode };
