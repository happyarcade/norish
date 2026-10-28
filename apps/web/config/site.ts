export type SiteConfig = typeof siteConfig;

export const siteConfig = {
  name: "Norish",
  description: "Nourish every meal.",
  navItems: [
    {
      label: "Dashboard",
      href: "/dashboard",
    },
    {
      label: "Recipes",
      href: "/",
    },
    {
      label: "Meal Planner",
      href: "/calendar",
    },
    {
      label: "Prep Table",
      href: "/prep-table",
    },
    {
      label: "Groceries",
      href: "/groceries",
    },
  ],
  navMenuItems: [
    {
      label: "Profile",
      href: "/profile",
    },
  ],
  links: {
    github: "https://github.com/mikevanes/norish",
  },
};
