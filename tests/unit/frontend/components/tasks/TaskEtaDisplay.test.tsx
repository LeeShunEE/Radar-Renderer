/**
 * TaskEtaDisplay 单元测试：null/非正数返回 null，格式化分支。
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TaskEtaDisplay } from "@/components/tasks/TaskEtaDisplay";

describe("TaskEtaDisplay", () => {
  it("etaSeconds 为 null 时不渲染", () => {
    const { container } = render(<TaskEtaDisplay etaSeconds={null} position={1} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("etaSeconds <= 0 时不渲染", () => {
    const { container } = render(<TaskEtaDisplay etaSeconds={0} position={1} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("秒级（<60）格式化为 秒", () => {
    render(<TaskEtaDisplay etaSeconds={45} position={2} />);
    expect(screen.getByText(/排队 #2，预计 45 秒/)).toBeInTheDocument();
  });

  it("整分钟格式化为 分钟", () => {
    render(<TaskEtaDisplay etaSeconds={120} position={1} />);
    expect(screen.getByText(/预计 2 分钟/)).toBeInTheDocument();
  });

  it("带余秒格式化为 分 秒", () => {
    render(<TaskEtaDisplay etaSeconds={90} position={1} />);
    expect(screen.getByText(/预计 1 分 30 秒/)).toBeInTheDocument();
  });
});
