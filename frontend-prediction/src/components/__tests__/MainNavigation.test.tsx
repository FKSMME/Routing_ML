import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MainNavigation, type NavigationItem } from "@components/MainNavigation";

const ITEMS: NavigationItem[] = [
  { id: "one", label: "첫번째", description: "First", icon: <span data-testid="icon-one" /> },
  { id: "two", label: "두번째", description: "Second", icon: <span data-testid="icon-two" /> },
  { id: "three", label: "세번째", description: "Third", icon: <span data-testid="icon-three" /> },
];

describe("MainNavigation", () => {
  it("renders navigation items with accessible labels", () => {
    const onSelect = vi.fn();
    render(<MainNavigation items={ITEMS} activeId="one" onSelect={onSelect} />);

    expect(screen.getByRole("tablist")).toBeInTheDocument();
    const buttons = screen.getAllByRole("tab");
    expect(buttons).toHaveLength(ITEMS.length);
    expect(buttons[0]).toHaveAttribute("aria-selected", "true");
    expect(buttons[1]).toHaveAttribute("aria-label", "두번째 - Second");
  });

  it("invokes onSelect when clicking a navigation item", async () => {
    const onSelect = vi.fn();
    render(<MainNavigation items={ITEMS} activeId="one" onSelect={onSelect} />);

    const navs = screen.getAllByRole("tablist");
    const nav = navs[navs.length - 1];
    const target = within(nav).getAllByRole("tab", { name: /두번째/ })[0];
    fireEvent.click(target);

    expect(onSelect).toHaveBeenCalledWith("two");
  });

  it("supports keyboard focus traversal across tabs", async () => {
    const onSelect = vi.fn();
    render(<MainNavigation items={ITEMS} activeId="one" onSelect={onSelect} />);

    const user = userEvent.setup();
    const navs = screen.getAllByRole("tablist");
    const nav = navs[navs.length - 1];
    await user.tab();
    expect(document.activeElement).toHaveAttribute("aria-label", "첫번째 - First");

    await user.tab();
    expect(document.activeElement).toHaveAttribute("aria-label", "두번째 - Second");

    await user.tab();
    expect(document.activeElement).toHaveAttribute("aria-label", "세번째 - Third");
  });

  it("matches snapshot for desktop layout", () => {
    const { container } = render(
      <div data-layout="desktop">
        <MainNavigation items={ITEMS} activeId="one" onSelect={vi.fn()} />
      </div>,
    );

    expect(container.firstChild).toMatchSnapshot();
  });

  it("matches snapshot for mobile layout", () => {
    const { container } = render(
      <div data-layout="mobile" data-nav-mode="drawer">
        <MainNavigation items={ITEMS} activeId="two" onSelect={vi.fn()} />
      </div>,
    );

    expect(container.firstChild).toMatchSnapshot();
  });
});
