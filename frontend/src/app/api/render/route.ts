import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import path from "path";
import fs from "fs";
import os from "os";
import { COMP_NAME, MULTI_COMP_NAME } from "../../../../types/constants";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { mode = "single", codec } = body;

    const entry = path.resolve(process.cwd(), "src", "remotion", "index.ts");
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "remotion-"));

    const bundleLocation = await bundle({
      entryPoint: entry,
      publicDir: path.resolve(process.cwd(), "public"),
      webpackOverride: (config) => config,
    });

    const isMulti = mode === "multi";
    const compositionId = isMulti ? MULTI_COMP_NAME : COMP_NAME;
    const inputProps = isMulti ? body.inputProps : body.inputProps;

    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: compositionId,
      inputProps,
      chromiumOptions: {
        gl: "angle",
        enableMultiProcessOnLinux: true,
      },
    });

    const ext = codec === "gif" ? "gif" : "mp4";
    const outputPath = path.join(tmpDir, `output.${ext}`);

    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      codec: codec === "gif" ? "gif" : "h264",
      outputLocation: outputPath,
      inputProps,
      concurrency: null,
      hardwareAcceleration: "if-possible",
      chromiumOptions: {
        gl: "angle",
        enableMultiProcessOnLinux: true,
      },
      onProgress: () => {},
    });

    const fileBuffer = fs.readFileSync(outputPath);
    fs.rmSync(tmpDir, { recursive: true, force: true });

    const mimeType =
      codec === "gif" ? "image/gif" : "video/mp4";

    const filename = isMulti
      ? `radar-multi-page.${ext}`
      : `radar-chart.${ext}`;

    return new Response(new Uint8Array(fileBuffer), {
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error("Render error:", error);
    return Response.json({ error: error.message || "渲染失败" }, { status: 500 });
  }
}
