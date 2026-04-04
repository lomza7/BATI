import { PDFParse } from 'pdf-parse';

export async function extractPdfText(
  buffer: Buffer,
): Promise<{ text: string; pageCount: number }> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });

  try {
    const textResult = await parser.getText();
    const infoResult = await parser.getInfo();

    return {
      text: textResult.text || '',
      pageCount: infoResult.total || 0,
    };
  } finally {
    await parser.destroy();
  }
}
