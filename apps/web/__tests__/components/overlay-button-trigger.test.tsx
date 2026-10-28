import {
  DropdownButtonTrigger,
  PopoverButtonTrigger,
} from "@/components/ui/overlay-button-trigger";
import { Dropdown, Popover } from "@heroui-v3/react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("overlay button triggers", () => {
  it("renders a dropdown trigger as one button", () => {
    const { container } = render(
      <Dropdown>
        <DropdownButtonTrigger aria-label="Open menu">Open</DropdownButtonTrigger>
        <Dropdown.Popover>
          <Dropdown.Menu aria-label="Menu">
            <Dropdown.Item id="item">Item</Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
    );

    const trigger = screen.getByRole("button", { name: "Open menu" });

    expect(container.querySelectorAll("button")).toHaveLength(1);
    expect(trigger.querySelector("button")).toBeNull();
  });

  it("renders a popover trigger without nesting an interactive button", () => {
    const { container } = render(
      <Popover>
        <PopoverButtonTrigger aria-label="Show details">Details</PopoverButtonTrigger>
        <Popover.Content>
          <Popover.Dialog>More information</Popover.Dialog>
        </Popover.Content>
      </Popover>
    );

    const trigger = screen.getByRole("button", { name: "Show details" });

    expect(container.querySelectorAll("button")).toHaveLength(0);
    expect(trigger.querySelector("button")).toBeNull();
  });
});
