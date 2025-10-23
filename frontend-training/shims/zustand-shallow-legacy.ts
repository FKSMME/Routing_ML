import * as shallowModule from "zustand/vanilla/shallow";

export { useShallow } from "zustand/react/shallow";

const shallowFn =
  (shallowModule as { shallow?: (a: unknown, b: unknown) => boolean }).shallow ??
  (shallowModule as { default?: (a: unknown, b: unknown) => boolean }).default;

export const shallow = shallowFn as (a: unknown, b: unknown) => boolean;

export default shallow;
