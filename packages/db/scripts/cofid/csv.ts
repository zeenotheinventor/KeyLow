// A small RFC 4180 reader and writer. The normalised CoFID file is deterministic, so the writer
// always ends lines with a line feed and quotes any field whose edges are whitespace.

const needsQuoting = /[",\r\n]|^\s|\s$/;

function formatField(field: string): string {
  return needsQuoting.test(field) ? `"${field.replaceAll('"', '""')}"` : field;
}

export function formatCsv(rows: readonly (readonly string[])[]): string {
  return rows.map((row) => `${row.map(formatField).join(",")}\n`).join("");
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let fieldStarted = false;

  const endField = (): void => {
    row.push(field);
    field = "";
    fieldStarted = false;
  };
  const endRow = (): void => {
    endField();
    rows.push(row);
    row = [];
  };

  for (let index = 0; index < text.length; index += 1) {
    const character = text.charAt(index);

    if (inQuotes) {
      if (character !== '"') {
        field += character;
      } else if (text.charAt(index + 1) === '"') {
        field += '"';
        index += 1;
      } else {
        inQuotes = false;
      }
    } else if (character === '"') {
      inQuotes = true;
      fieldStarted = true;
    } else if (character === ",") {
      endField();
      fieldStarted = true;
    } else if (character === "\n" || (character === "\r" && text.charAt(index + 1) === "\n")) {
      index += character === "\r" ? 1 : 0;
      endRow();
    } else {
      field += character;
      fieldStarted = true;
    }
  }

  if (inQuotes) {
    throw new Error("A quoted CSV field is never closed");
  }
  if (fieldStarted || field !== "") {
    endRow();
  }
  return rows;
}
