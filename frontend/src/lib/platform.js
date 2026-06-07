export const isDesktop = () =>
  typeof window !== "undefined" && !!window.dfsDesktop?.isDesktop;
