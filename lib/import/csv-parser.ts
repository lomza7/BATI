/**
 * Minimal CSV parser tailored for the Hellobat data import system.
 *
 * Goals:
 * - Handle quoted fields that contain commas, newlines, and escaped quotes ("").
 * - Detect the delimiter (comma, semicolon, tab) from the header line.
 * - Detect encoding: try UTF-8 strict first, fall back to Windows-1252 (Latin-1)
 *   when the bytes don't decode cleanly. This catches the mojibake-prone CSVs
 *   that French desktop software (Costructor, Excel on Windows) tend to emit.
 *
 * No external dependency: shipping a 50KB papaparse for two import flows would
 * be wasteful, and a hand-rolled parser is easier to audit.
 */

export interface ParsedCSV {
  headers: string[];
  rows: Record<string, string>[];
  delimiter: string;
  encoding: 'utf-8' | 'windows-1252';
}

/**
 * Decode raw bytes into a string, picking UTF-8 when valid and falling back to
 * Windows-1252 otherwise. We also strip a UTF-8 BOM if present.
 */
export function decodeCsvBuffer(bytes: Uint8Array): {
  text: string;
  encoding: 'utf-8' | 'windows-1252';
} {
  // Strip UTF-8 BOM if present
  let view = bytes;
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    view = bytes.subarray(3);
  }

  // Try strict UTF-8 first.
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(view);
    // If the text contains the U+FFFD replacement char, the source was not
    // really UTF-8 — fall through to windows-1252.
    if (!text.includes('\uFFFD')) {
      return { text, encoding: 'utf-8' };
    }
  } catch {
    // Not valid UTF-8 — fall through.
  }

  // Fallback: Windows-1252 (covers French accented characters from Excel/desktop apps).
  const text = new TextDecoder('windows-1252').decode(view);
  return { text, encoding: 'windows-1252' };
}

/**
 * Pick the most likely delimiter by counting occurrences in the header line.
 * We only consider candidates that appear outside quoted regions.
 */
function detectDelimiter(text: string): string {
  // Look only at the first non-empty logical line for detection. We need to
  // honour quotes — a header like `"Nom, prénom",Email` has one comma inside
  // quotes that should not count.
  const candidates = [',', ';', '\t', '|'];
  const counts: Record<string, number> = {};
  for (const c of candidates) counts[c] = 0;

  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      // Toggle (handles escaped quotes too — we just count flips)
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === '\n' || ch === '\r') {
      if (inQuotes) continue; // multi-line quoted field
      // End of header line
      break;
    }
    if (!inQuotes && candidates.includes(ch)) counts[ch]++;
  }

  let best = ',';
  let bestCount = -1;
  for (const c of candidates) {
    if (counts[c] > bestCount) {
      best = c;
      bestCount = counts[c];
    }
  }
  return best;
}

/**
 * Tokenize a CSV string into a 2D array of cells. Honours RFC 4180-style
 * quoted fields including embedded delimiters, embedded newlines, and the
 * doubled-quote escape ("").
 */
function tokenize(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          // Escaped quote inside a quoted field
          field += '"';
          i += 2;
          continue;
        }
        // End of quoted field
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }

    // Not in quotes
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === delimiter) {
      row.push(field);
      field = '';
      i++;
      continue;
    }
    if (ch === '\r') {
      // Swallow CR; the LF (if any) will close the row
      i++;
      continue;
    }
    if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i++;
      continue;
    }
    field += ch;
    i++;
  }

  // Flush the last field/row
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

/**
 * Parse a CSV file (as raw bytes) into headers + row objects.
 *
 * Errors are non-fatal: a malformed file will still produce whatever rows
 * could be reconstructed. Callers should validate per-row themselves.
 */
export function parseCSV(input: Uint8Array | string): ParsedCSV {
  let text: string;
  let encoding: 'utf-8' | 'windows-1252';
  if (typeof input === 'string') {
    text = input;
    encoding = 'utf-8';
  } else {
    const decoded = decodeCsvBuffer(input);
    text = decoded.text;
    encoding = decoded.encoding;
  }

  const delimiter = detectDelimiter(text);
  const matrix = tokenize(text, delimiter);

  if (matrix.length === 0) {
    return { headers: [], rows: [], delimiter, encoding };
  }

  const headers = matrix[0].map((h) => h.trim());
  const rows: Record<string, string>[] = [];
  for (let r = 1; r < matrix.length; r++) {
    const cells = matrix[r];
    // Skip fully-empty trailing lines
    if (cells.length === 1 && cells[0].trim() === '') continue;
    const obj: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      obj[headers[c]] = (cells[c] ?? '').trim();
    }
    rows.push(obj);
  }

  return { headers, rows, delimiter, encoding };
}
