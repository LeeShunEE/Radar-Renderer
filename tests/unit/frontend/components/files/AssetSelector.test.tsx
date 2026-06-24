/**
 * AssetSelector 单元测试：公共/用户资源合并、两类资源渲染、选择/清除、上传、刷新、音频播放。
 * mock 三个 hooks + lucide 图标（便于按 testid 定位图标按钮）+ window.Audio（jsdom 无 audio 实现）。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AssetSelector } from "@/components/files/AssetSelector";

// 可变 hook 返回状态（hoisted 便于在测试内调整 loading / 资源列表）
const assets = vi.hoisted(() => ({
  silhouettes: [{ name: "hero.png", path: "silhouettes/hero.png" }],
  music: [{ name: "bg.mp3", path: "music/bg.mp3" }],
  loading: false,
  refresh: vi.fn(),
}));
const fileMgmt = vi.hoisted(() => ({
  files: [{ name: "my-sil.png" }, { name: "my-song.mp3" }],
  loading: false,
  uploading: false,
  upload: vi.fn().mockResolvedValue(undefined),
  getDownloadUrl: vi.fn((n: string) => `http://cdn/${n}`),
}));
const uploadUrls = vi.hoisted(() => ({
  getObjectUrl: vi.fn(() => "blob:cached"),
}));

vi.mock("@/hooks/usePublicAssets", () => ({
  usePublicAssets: () => assets,
}));
vi.mock("@/hooks/useFileManagement", () => ({
  useFileManagement: () => fileMgmt,
}));
vi.mock("@/hooks/useUploadObjectUrls", () => ({
  useUploadObjectUrls: () => uploadUrls,
}));

describe("AssetSelector", () => {
  beforeEach(() => {
    // jsdom 无 HTMLAudioElement.play 实现，整体桩掉。
    // 用普通 function（非箭头）以便 `new Audio()` 可作为构造函数调用。
    (window as any).Audio = vi.fn().mockImplementation(function (this: any) {
      this.play = vi.fn().mockResolvedValue(undefined);
      this.pause = vi.fn();
      this.onended = null;
    });
    assets.silhouettes = [{ name: "hero.png", path: "silhouettes/hero.png" }];
    assets.music = [{ name: "bg.mp3", path: "music/bg.mp3" }];
    assets.loading = false;
    fileMgmt.files = [{ name: "my-sil.png" }, { name: "my-song.mp3" }];
    fileMgmt.loading = false;
    fileMgmt.uploading = false;
  });

  it("silhouettes 类别：渲染公共资源网格 + 用户上传区", () => {
    render(<AssetSelector category="silhouettes" value="" onChange={vi.fn()} />);
    expect(screen.getByText("剪影图片")).toBeInTheDocument();
    expect(screen.getByText("公共资源")).toBeInTheDocument();
    expect(screen.getByText("我的上传")).toBeInTheDocument();
    expect(screen.getByTitle("hero.png")).toBeInTheDocument();
    expect(screen.getByTitle("my-sil.png")).toBeInTheDocument();
  });

  it("点击公共剪影 → onChange(path)", () => {
    const onChange = vi.fn();
    render(<AssetSelector category="silhouettes" value="" onChange={onChange} />);
    fireEvent.click(screen.getByTitle("hero.png"));
    expect(onChange).toHaveBeenCalledWith("silhouettes/hero.png");
  });

  it("value 匹配时显示选中样式与「清除选择」", () => {
    render(
      <AssetSelector
        category="silhouettes"
        value="silhouettes/hero.png"
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByTitle("hero.png").className).toContain("border-primary");
    expect(screen.getByText("清除选择")).toBeInTheDocument();
  });

  it("清除选择 → onChange('')", () => {
    const onChange = vi.fn();
    render(
      <AssetSelector
        category="silhouettes"
        value="silhouettes/hero.png"
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByText("清除选择"));
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("value 为空时不渲染「清除选择」", () => {
    render(<AssetSelector category="silhouettes" value="" onChange={vi.fn()} />);
    expect(screen.queryByText("清除选择")).toBeNull();
  });

  it("music 类别：渲染列表项与播放按钮", () => {
    render(
      <AssetSelector category="music" value="" onChange={vi.fn()} showPlayButton />,
    );
    expect(screen.getByText("背景音乐")).toBeInTheDocument();
    expect(screen.getByText("bg.mp3")).toBeInTheDocument();
    expect(screen.getByText("my-song.mp3")).toBeInTheDocument();
    expect(screen.getAllByText("▶").length).toBeGreaterThan(0);
  });

  it("点击 music 项 → onChange(path)", () => {
    const onChange = vi.fn();
    render(<AssetSelector category="music" value="" onChange={onChange} />);
    fireEvent.click(screen.getByText("bg.mp3"));
    expect(onChange).toHaveBeenCalledWith("music/bg.mp3");
  });

  it("music 公共项播放按钮 → 构造 Audio 并切到暂停态", () => {
    render(
      <AssetSelector
        category="music"
        value="music/bg.mp3"
        onChange={vi.fn()}
        showPlayButton
      />,
    );
    fireEvent.click(screen.getAllByText("▶")[0]);
    expect(window.Audio).toHaveBeenCalled();
    expect(screen.getByText("⏸")).toBeInTheDocument();
  });

  it("再次点击播放中项 → 暂停回到播放态", () => {
    render(
      <AssetSelector
        category="music"
        value="music/bg.mp3"
        onChange={vi.fn()}
        showPlayButton
      />,
    );
    fireEvent.click(screen.getAllByText("▶")[0]);
    fireEvent.click(screen.getByText("⏸"));
    expect(screen.getAllByText("▶").length).toBeGreaterThan(0);
  });

  it("music 用户上传项播放 → 走 objectURL 分支", () => {
    render(
      <AssetSelector category="music" value="" onChange={vi.fn()} showPlayButton />,
    );
    // 用户上传项 my-song.mp3 的播放按钮
    const playBtns = screen.getAllByText("▶");
    // 第二个播放按钮属于用户上传项
    fireEvent.click(playBtns[playBtns.length - 1]);
    expect(uploadUrls.getObjectUrl).toHaveBeenCalledWith("my-song.mp3");
  });

  it("刷新按钮 → refresh 调用", () => {
    render(<AssetSelector category="silhouettes" value="" onChange={vi.fn()} />);
    // 头部图标按钮为前两个 button（刷新在前）
    fireEvent.click(screen.getAllByRole("button")[0]);
    expect(assets.refresh).toHaveBeenCalled();
  });

  it("上传按钮 → 触发隐藏 file input 的 click", () => {
    render(<AssetSelector category="silhouettes" value="" onChange={vi.fn()} />);
    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const clickSpy = vi.spyOn(fileInput, "click");
    // 上传按钮为头部第二个 button
    fireEvent.click(screen.getAllByRole("button")[1]);
    expect(clickSpy).toHaveBeenCalled();
  });

  it("handleUpload 选择文件 → upload 调用并清空 input value", async () => {
    const upload = vi.fn().mockResolvedValue(undefined);
    fileMgmt.upload = upload;
    render(<AssetSelector category="silhouettes" value="" onChange={vi.fn()} />);
    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [{ name: "x.png" }] } });
    await Promise.resolve();
    expect(upload).toHaveBeenCalled();
  });

  it("加载中且无资源 → 显示「加载中...」", () => {
    assets.loading = true;
    assets.silhouettes = [];
    fileMgmt.loading = false;
    fileMgmt.files = [];
    render(<AssetSelector category="silhouettes" value="" onChange={vi.fn()} />);
    expect(screen.getByText("加载中...")).toBeInTheDocument();
  });

  it("无任何资源 → 显示「暂无资源」", () => {
    assets.silhouettes = [];
    fileMgmt.files = [];
    render(<AssetSelector category="silhouettes" value="" onChange={vi.fn()} />);
    expect(screen.getByText(/暂无资源/)).toBeInTheDocument();
  });

  describe("backgrounds 类别", () => {
    beforeEach(() => {
      // 用户文件包含一个视频和一个图片，以及一个音频（应被过滤掉）
      fileMgmt.files = [
        { name: "bg-video.mp4" },
        { name: "bg-image.png" },
        { name: "should-be-excluded.mp3" },
      ];
    });

    it("header 显示「背景媒体」", () => {
      render(<AssetSelector category="backgrounds" value="" onChange={vi.fn()} />);
      expect(screen.getByText("背景媒体")).toBeInTheDocument();
    });

    it("upload input 的 accept 为「image/*,video/*」", () => {
      render(<AssetSelector category="backgrounds" value="" onChange={vi.fn()} />);
      const fileInput = document.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      expect(fileInput.accept).toBe("image/*,video/*");
    });

    it("mp4 和 png 用户文件出现在「我的上传」中", () => {
      render(<AssetSelector category="backgrounds" value="" onChange={vi.fn()} />);
      expect(screen.getByText("我的上传")).toBeInTheDocument();
      expect(screen.getByTitle("bg-video.mp4")).toBeInTheDocument();
      expect(screen.getByTitle("bg-image.png")).toBeInTheDocument();
    });

    it("mp4 用户文件渲染 <video> 元素", () => {
      const { container } = render(
        <AssetSelector category="backgrounds" value="" onChange={vi.fn()} />,
      );
      const videos = container.querySelectorAll("video");
      expect(videos.length).toBe(1);
      // 视频 src 走 objectURL（鉴权）
      expect(videos[0].src).toContain("blob:cached");
    });

    it("png 用户文件渲染 <img> 元素（不是 <video>）", () => {
      const { container } = render(
        <AssetSelector category="backgrounds" value="" onChange={vi.fn()} />,
      );
      // 找 grid 内 img（objectURL src）
      const imgs = container.querySelectorAll("img");
      const bgImg = Array.from(imgs).find((el) =>
        el.src.includes("blob:cached"),
      );
      expect(bgImg).toBeDefined();
    });

    it("mp3 用户文件不出现在 backgrounds 中", () => {
      render(<AssetSelector category="backgrounds" value="" onChange={vi.fn()} />);
      expect(screen.queryByTitle("should-be-excluded.mp3")).toBeNull();
    });

    it("点击 backgrounds 项 → onChange(path)", () => {
      const onChange = vi.fn();
      render(<AssetSelector category="backgrounds" value="" onChange={onChange} />);
      fireEvent.click(screen.getByTitle("bg-image.png"));
      expect(onChange).toHaveBeenCalledWith("http://cdn/bg-image.png");
    });

    it("背景类别无公共资源（不显示「公共资源」区块）", () => {
      render(<AssetSelector category="backgrounds" value="" onChange={vi.fn()} />);
      expect(screen.queryByText("公共资源")).toBeNull();
    });
  });
});
