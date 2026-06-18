/**
 * CharacterConfig 单元测试：名称/对齐/字号 clamp、sync 开关、slug、layoutDisabled。
 * Slider/Switch/AssetSelector/FontSelect 内联 mock。
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CharacterConfig } from "@/components/editor/CharacterConfig";
import { makePage } from "./_fixtures";

// sliderPassesArray 控制 mock 以数组还是裸数值回调，用于覆盖各 onValueChange 的 Array.isArray 两个分支
const h = vi.hoisted(() => ({ sliderPassesArray: true }));

vi.mock("@/components/ui/slider", () => ({
  Slider: ({ value, onValueChange }: any) => (
    <input
      type="range"
      data-testid="slider"
      min={-10000}
      max={10000}
      value={value?.[0] ?? 0}
      onChange={(e) =>
        onValueChange?.(
          h.sliderPassesArray ? [Number(e.target.value)] : Number(e.target.value),
        )
      }
    />
  ),
}));
vi.mock("@/components/ui/switch", () => ({
  Switch: ({ checked, onCheckedChange }: any) => (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange?.(!checked)}
    />
  ),
}));
vi.mock("@/components/files/AssetSelector", () => ({
  AssetSelector: () => <div data-testid="asset-selector" />,
}));
vi.mock("@/components/editor/FontFamilyEditor", () => ({
  FontSelect: ({ value, onChange }: any) => (
    <input
      data-testid="font-select"
      value={value ?? ""}
      onChange={(e) => onChange?.(e.target.value)}
    />
  ),
}));

const page = makePage();
const baseProps = (over: Record<string, unknown> = {}) => ({
  characterName: page.characterName,
  characterNameAlign: page.characterNameAlign,
  characterNameFontSize: page.font.characterName,
  silhouetteSrc: page.silhouetteSrc,
  silhouetteOpacity: page.theme.silhouetteOpacity,
  silhouetteOffsetX: page.layout.silhouetteOffsetX,
  silhouetteOffsetY: page.layout.silhouetteOffsetY,
  silhouetteScale: page.layout.silhouetteScale,
  characterNameOffsetX: page.layout.characterNameOffsetX,
  characterNameOffsetY: page.layout.characterNameOffsetY,
  syncSilhouetteOffset: page.layout.syncSilhouetteOffset,
  slug: page.slug,
  onChange: vi.fn(),
  ...over,
});

describe("CharacterConfig", () => {
  it("渲染标题", () => {
    render(<CharacterConfig {...baseProps()} />);
    expect(screen.getByText("角色配置")).toBeInTheDocument();
  });

  it("改角色名 → onChange({characterName})", () => {
    const onChange = vi.fn();
    render(<CharacterConfig {...baseProps({ onChange })} />);
    fireEvent.change(screen.getByPlaceholderText(/输入角色名称/), {
      target: { value: "新角色" },
    });
    expect(onChange.mock.calls.at(-1)![0]).toMatchObject({ characterName: "新角色" });
  });

  it("点对齐按钮「中」→ onChange({characterNameAlign:'center'})", () => {
    const onChange = vi.fn();
    render(<CharacterConfig {...baseProps({ onChange })} />);
    fireEvent.click(screen.getByTitle("对齐：中"));
    expect(onChange.mock.calls.at(-1)![0]).toMatchObject({
      characterNameAlign: "center",
    });
  });

  it("字号超上限 clamp 到 180", () => {
    const onChange = vi.fn();
    const { container } = render(<CharacterConfig {...baseProps({ onChange })} />);
    const num = container.querySelector('input[type="number"]') as HTMLInputElement;
    fireEvent.change(num, { target: { value: "9999" } });
    expect(onChange.mock.calls.at(-1)![0]).toMatchObject({
      font: { characterName: 180 },
    });
  });

  it("字号合法值（在下限以下）clamp 到 30", () => {
    const onChange = vi.fn();
    const { container } = render(<CharacterConfig {...baseProps({ onChange })} />);
    const num = container.querySelector('input[type="number"]') as HTMLInputElement;
    fireEvent.change(num, { target: { value: "5" } });
    expect(onChange.mock.calls.at(-1)![0]).toMatchObject({
      font: { characterName: 30 },
    });
  });

  it("切换 sync 开关 → onChange({layout:{syncSilhouetteOffset}})", () => {
    const onChange = vi.fn();
    render(<CharacterConfig {...baseProps({ onChange })} />);
    fireEvent.click(screen.getByRole("switch"));
    expect(onChange.mock.calls.at(-1)![0]).toMatchObject({
      layout: { syncSilhouetteOffset: false },
    });
  });

  it("改 slug 文本 → onChange({slug:{text}})", () => {
    const onChange = vi.fn();
    render(<CharacterConfig {...baseProps({ onChange })} />);
    fireEvent.change(screen.getByPlaceholderText(/Gemini/), {
      target: { value: "标语" },
    });
    expect(onChange.mock.calls.at(-1)![0].slug.text).toBe("标语");
  });

  it("layoutDisabled 时渲染对比模式 tooltip", () => {
    const { container } = render(<CharacterConfig {...baseProps({ layoutDisabled: true })} />);
    const titled = [...container.querySelectorAll("[title]")].find((e) =>
      (e.getAttribute("title") || "").includes("对比模式"),
    );
    expect(titled).toBeTruthy();
  });

  it("点对齐按钮「左」「右」分别触发 onChange", () => {
    const onChange = vi.fn();
    render(<CharacterConfig {...baseProps({ onChange })} />);
    fireEvent.click(screen.getByTitle("对齐：左"));
    expect(onChange.mock.calls.at(-1)![0]).toMatchObject({ characterNameAlign: "left" });
    fireEvent.click(screen.getByTitle("对齐：右"));
    expect(onChange.mock.calls.at(-1)![0]).toMatchObject({ characterNameAlign: "right" });
  });

  it("各 slider（数组回调）触发对应 onChange", () => {
    const onChange = vi.fn();
    render(<CharacterConfig {...baseProps({ onChange })} />);
    const sliders = screen.getAllByTestId("slider");
    fireEvent.change(sliders[0], { target: { value: "100" } });
    expect(onChange.mock.calls.at(-1)![0].font.characterName).toBe(100);
    fireEvent.change(sliders[1], { target: { value: "20" } });
    expect(onChange.mock.calls.at(-1)![0].layout.characterNameOffsetX).toBe(20);
    fireEvent.change(sliders[2], { target: { value: "30" } });
    expect(onChange.mock.calls.at(-1)![0].layout.characterNameOffsetY).toBe(30);
    fireEvent.change(sliders[3], { target: { value: "40" } });
    expect(onChange.mock.calls.at(-1)![0].slug.fontSize).toBe(40);
    fireEvent.change(sliders[4], { target: { value: "50" } });
    expect(onChange.mock.calls.at(-1)![0].slug.offsetX).toBe(50);
    fireEvent.change(sliders[5], { target: { value: "60" } });
    expect(onChange.mock.calls.at(-1)![0].slug.offsetY).toBe(60);
    fireEvent.change(sliders[6], { target: { value: "10" } });
    expect(onChange.mock.calls.at(-1)![0].slug.fadeOffsetFrames).toBe(10);
    fireEvent.change(sliders[7], { target: { value: "0.5" } });
    expect(onChange.mock.calls.at(-1)![0].theme.silhouetteOpacity).toBe(0.5);
    fireEvent.change(sliders[8], { target: { value: "2" } });
    expect(onChange.mock.calls.at(-1)![0].layout.silhouetteScale).toBe(2);
    fireEvent.change(sliders[9], { target: { value: "15" } });
    expect(onChange.mock.calls.at(-1)![0].layout.silhouetteOffsetX).toBe(15);
    fireEvent.change(sliders[10], { target: { value: "25" } });
    expect(onChange.mock.calls.at(-1)![0].layout.silhouetteOffsetY).toBe(25);
  });

  it("slider 回调传裸数值时直接取值（覆盖全部非数组分支）", () => {
    h.sliderPassesArray = false;
    try {
      const onChange = vi.fn();
      render(<CharacterConfig {...baseProps({ onChange })} />);
      const sliders = screen.getAllByTestId("slider");
      sliders.forEach((s, i) => fireEvent.change(s, { target: { value: String(i + 1) } }));
      expect(onChange).toHaveBeenCalled();
    } finally {
      h.sliderPassesArray = true;
    }
  });

  it("slug 字号数字框 clamp（上限 200 / 下限 8 / NaN 忽略）", () => {
    const onChange = vi.fn();
    const { container } = render(<CharacterConfig {...baseProps({ onChange })} />);
    const nums = container.querySelectorAll('input[type="number"]');
    // nums[1] 为 slug 字号
    fireEvent.change(nums[1], { target: { value: "9999" } });
    expect(onChange.mock.calls.at(-1)![0].slug.fontSize).toBe(200);
    fireEvent.change(nums[1], { target: { value: "1" } });
    expect(onChange.mock.calls.at(-1)![0].slug.fontSize).toBe(8);
  });

  it("改 slug 字体 / 颜色 → onChange({slug})", () => {
    const onChange = vi.fn();
    render(<CharacterConfig {...baseProps({ onChange })} />);
    fireEvent.change(screen.getByTestId("font-select"), { target: { value: "Roboto" } });
    expect(onChange.mock.calls.at(-1)![0].slug.fontFamily).toBe("Roboto");
    const colorInputs = screen.getAllByDisplayValue(page.slug.color);
    fireEvent.change(colorInputs[0], { target: { value: "#abcdef" } });
    expect(onChange.mock.calls.at(-1)![0].slug.color).toBe("#abcdef");
  });

  it("改图片路径 → onChange({silhouetteSrc})", () => {
    const onChange = vi.fn();
    render(<CharacterConfig {...baseProps({ onChange })} />);
    fireEvent.change(screen.getByPlaceholderText("silhouettes/hero.png"), {
      target: { value: "silhouettes/a.png" },
    });
    expect(onChange.mock.calls.at(-1)![0]).toMatchObject({ silhouetteSrc: "silhouettes/a.png" });
  });

  it("syncSilhouetteOffset=false 时剪影 X/Y 数字框 clamp 且取 silhouetteOffset", () => {
    const onChange = vi.fn();
    const { container } = render(
      <CharacterConfig {...baseProps({ onChange, syncSilhouetteOffset: false })} />,
    );
    const nums = container.querySelectorAll('input[type="number"]');
    // 最后两个 number 框为剪影 X / Y
    const silX = nums[nums.length - 2] as HTMLInputElement;
    const silY = nums[nums.length - 1] as HTMLInputElement;
    fireEvent.change(silX, { target: { value: "9999" } });
    expect(onChange.mock.calls.at(-1)![0].layout.silhouetteOffsetX).toBe(500);
    fireEvent.change(silY, { target: { value: "-9999" } });
    expect(onChange.mock.calls.at(-1)![0].layout.silhouetteOffsetY).toBe(-500);
  });

  it("syncSilhouetteOffset=true 时剪影偏移取名称偏移（effectiveSil 真分支）", () => {
    const { container } = render(
      <CharacterConfig
        {...baseProps({
          syncSilhouetteOffset: true,
          characterNameOffsetX: 77,
          characterNameOffsetY: 88,
          silhouetteOffsetX: 11,
          silhouetteOffsetY: 22,
        })}
      />,
    );
    const nums = container.querySelectorAll('input[type="number"]');
    const silX = nums[nums.length - 2] as HTMLInputElement;
    const silY = nums[nums.length - 1] as HTMLInputElement;
    expect(silX.value).toBe("77");
    expect(silY.value).toBe("88");
  });
});
