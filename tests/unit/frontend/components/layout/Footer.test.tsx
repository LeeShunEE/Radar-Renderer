import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { Footer } from "@/components/layout/Footer";

describe("Footer", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("展示注入的版本号", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_VERSION", "v1.2.3");
    render(<Footer />);
    expect(screen.getByText(/版本 v1\.2\.3/)).toBeInTheDocument();
  });

  it("git describe 后缀格式正确展示", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_VERSION", "v1.2.3-5-gabc1234");
    render(<Footer />);
    expect(screen.getByText(/v1\.2\.3-5-gabc1234/)).toBeInTheDocument();
  });

  it("版本号未定义时兜底 unknown", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_VERSION", "");
    render(<Footer />);
    expect(screen.getByText(/版本 unknown/)).toBeInTheDocument();
  });
});
