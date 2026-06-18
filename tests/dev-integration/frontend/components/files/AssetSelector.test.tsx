/**
 * AssetSelector dev-integration 测试。
 *
 * 链路：AssetSelector → usePublicAssets + useFileManagement + useUploadObjectUrls
 * → api-client → MSW。render 真实组件，验证公共剪影/音乐 + 用户上传文件同时出现
 * （三链路同时打通）。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import React from "react";
import { AssetSelector } from "@/components/files/AssetSelector";
import { seedAuth, resetAuth } from "../../_helpers";

let urlCounter = 0;

beforeEach(() => {
  seedAuth();
  urlCounter = 0;
  vi.spyOn(URL, "createObjectURL").mockImplementation(() => `blob:mock-${++urlCounter}`);
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
});

afterEach(() => {
  resetAuth();
  vi.restoreAllMocks();
});

describe("AssetSelector（集成）", () => {
  it("silhouettes 分类：公共剪影 + 用户上传文件同时出现", async () => {
    render(<AssetSelector category="silhouettes" value="" onChange={() => {}} />);

    // 公共剪影（来自 MSW /assets/silhouettes）
    await waitFor(() => {
      expect(screen.getByTitle("hero.png")).toBeInTheDocument();
    });
    // 用户上传文件（来自 MSW /files，silhouette.png 匹配图片扩展名）
    await waitFor(() => {
      expect(screen.getByTitle("silhouette.png")).toBeInTheDocument();
    });
  });

  it("music 分类：公共音乐 + 用户上传音乐同时出现", async () => {
    render(<AssetSelector category="music" value="" onChange={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText("bgm.mp3")).toBeInTheDocument();
    });
  });

  it("点选公共剪影回调 onChange 带上 path", async () => {
    let selected = "";
    render(<AssetSelector category="silhouettes" value="" onChange={(p) => (selected = p)} />);

    await waitFor(() => expect(screen.getByTitle("hero.png")).toBeInTheDocument());
    fireEvent.click(screen.getByTitle("hero.png"));

    expect(selected).toBe("silhouettes/hero.png");
  });

  it("上传新文件后列表刷新出现 uploaded.png", async () => {
    render(<AssetSelector category="silhouettes" value="" onChange={() => {}} />);
    await waitFor(() => expect(screen.getByTitle("silhouette.png")).toBeInTheDocument());

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["d"], "up.png", { type: "image/png" })] } });

    await waitFor(() => {
      expect(screen.getByTitle("uploaded.png")).toBeInTheDocument();
    });
  });
});
