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

export const IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
];
const IMAGE_EXTS = [".png", ".jpg", ".jpeg", ".webp", ".gif"];

export function isImageFile(file: File): boolean {
  const ext = "." + (file.name.split(".").pop()?.toLowerCase() ?? "");
  return IMAGE_TYPES.includes(file.type) || IMAGE_EXTS.includes(ext);
}

/** Reads a file as a base64 string WITHOUT the `data:<mime>;base64,` prefix. */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      resolve(result.includes(",") ? result.split(",")[1] : result);
    };
    reader.onerror = () => reject(new Error("Could not read the image file."));
    reader.readAsDataURL(file);
  });
}

export function validateFile(file: File, allowImages = false): string | null {
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    return "File size must be under 10MB";
  }

  const allowedTypes = [
    "text/plain",
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ...(allowImages ? IMAGE_TYPES : []),
  ];
  const allowedExts = [
    ".txt",
    ".pdf",
    ".docx",
    ".md",
    ...(allowImages ? IMAGE_EXTS : []),
  ];
  const ext = "." + file.name.split(".").pop()?.toLowerCase();

  if (!allowedTypes.includes(file.type) && !allowedExts.includes(ext)) {
    return allowImages
      ? "Only images, PDF, DOCX, TXT, and MD files are supported"
      : "Only PDF, DOCX, TXT, and MD files are supported";
  }

  return null;
}
