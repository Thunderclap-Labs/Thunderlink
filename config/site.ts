export type SiteConfig = typeof siteConfig;

export const siteConfig = {
  name: "Thunderlink",
  description: "Global satellite network - connect to any satellite, anywhere, anytime.",
  navItems: [
    {
      label: "Home",
      href: "/",
    },
    {
      label: "Bookings",
      href: "/bookings",
    },
    {
      label: "Pricing",
      href: "/pricing",
    },
    {
      label: "Docs",
      href: "/docs",
    },
    {
      label: "About",
      href: "/about",
    },
  ],
  navMenuItems: [
    {
      label: "Home",
      href: "/",
    },
    {
      label: "Bookings",
      href: "/bookings",
    },
    {
      label: "Pricing",
      href: "/pricing",
    },
    {
      label: "Settings",
      href: "/settings",
    },
    {
      label: "Help & Feedback",
      href: "/help-feedback",
    },
  ],
  links: {
    github: "https://github.com/heroui-inc/heroui",
    twitter: "https://twitter.com/hero_ui",
    docs: "https://heroui.com",
    discord: "https://discord.gg/9b6yyZKmH4",
    sponsor: "https://patreon.com/jrgarciadev",
  },
};
