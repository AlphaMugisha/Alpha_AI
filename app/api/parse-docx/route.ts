import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });

    return NextResponse.json({ text: result.value });
  } catch (error) {
    console.error("DOCX parsing error:", error);
    return NextResponse.json(
      { error: "Failed to parse DOCX" },
      { status: 500 }
    );
  }
}
