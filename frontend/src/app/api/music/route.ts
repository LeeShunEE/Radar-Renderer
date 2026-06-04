import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  const dir = path.join(process.cwd(), "public", "music");

  try {
    const files = fs.readdirSync(dir);
    const music = files.filter((f) =>
      /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(f),
    );
    return NextResponse.json(
      music.map((name) => ({
        name,
        path: `music/${name}`,
      })),
    );
  } catch {
    return NextResponse.json([]);
  }
}
