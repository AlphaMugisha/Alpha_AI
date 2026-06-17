export interface ParsedFile {
  name: string;
  content: string;
  type: string;
  size: number;
}

export async function parseFile(file: File): Promise<ParsedFile> {
  const type = file.type;
  const name = file.name;
  const size = file.size;

  if (type === "text/plain" || name.endsWith(".txt") || name.endsWith(".md")) {
    const content = await file.text();
    return { name, content, type: "text", size };
  }

  if (
    type === "application/pdf" ||
    name.endsWith(".pdf")
  ) {
    const content = await parsePDF(file);
    return { name, content, type: "pdf", size };
  }

  if (
    type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    name.endsWith(".docx")
  ) {
    const content = await parseDOCX(file);
    return { name, content, type: "docx", size };
  }

  throw new Error(`Unsupported file type: ${type || name.split(".").pop()}`);
}

async function parsePDF(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/parse-pdf", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) throw new Error("PDF parsing failed");
    const data = await response.json() as { text: string };
    return data.text;
  } catch {
    return await extractTextFromPDFClient(file);
  }
}

async function extractTextFromPDFClient(file: File): Promise<string> {
  const text = await file.text();
  const cleaned = text
    .replace(/[^\x20-\x7E\n\r\t]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.length > 100) return cleaned;
  throw new Error(
    "Could not extract text from PDF. Please copy-paste the content as text instead."
  );
}

async function parseDOCX(file: File): Promise<string> {
  try {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/parse-docx", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) throw new Error("DOCX parsing failed");
    const data = await response.json() as { text: string };
    return data.text;
  } catch {
    throw new Error(
      "Could not parse DOCX file. Please save as .txt and upload again."
    );
  }
}

export function validateFile(file: File): string | null {
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    return "File size must be under 10MB";
  }

  const allowedTypes = [
    "text/plain",
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];
  const allowedExts = [".txt", ".pdf", ".docx", ".md"];
  const ext = "." + file.name.split(".").pop()?.toLowerCase();

  if (!allowedTypes.includes(file.type) && !allowedExts.includes(ext)) {
    return "Only PDF, DOCX, TXT, and MD files are supported";
  }

  return null;
}
