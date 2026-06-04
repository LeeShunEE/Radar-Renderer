import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  const dir = path.join(process.cwd(), "public", "silhouettes");

  try {
    const files = fs.readdirSync(dir);
    const images = files.filter((f) =>
      /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(f),
    );
    return NextResponse.json(
      images.map((name) => ({
        name,
        path: `silhouettes/${name}`,
      })),
    );
  } catch {
    return NextResponse.json([]);
  }
}
