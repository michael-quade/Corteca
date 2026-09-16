import * as XLSX from "xlsx";

/** Builds and downloads an .xlsx file from a flat header/row shape — client-side only. */
export function exportRowsToXlsx(
  filename: string,
  headers: string[],
  rows: Record<string, unknown>[],
): void {
  const aoa: unknown[][] = [
    headers,
    ...rows.map((row) => headers.map((h) => row[h] ?? "")),
  ];
  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
  XLSX.writeFile(workbook, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}
