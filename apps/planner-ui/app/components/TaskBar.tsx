import Link from "next/link";
import { fonts, fontSizes } from "../../lib/fonts";
import { GitHubIcon } from "./icons";

function PersonIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Head - top */}
      <rect x="7" y="3" width="6" height="2" fill="#3399FF" />

      {/* Head - middle */}
      <rect x="6" y="5" width="8" height="4" fill="#0066CC" />
      <rect x="7" y="5" width="2" height="2" fill="#3399FF" />

      {/* Head - bottom/chin */}
      <rect x="7" y="9" width="6" height="2" fill="#0066CC" />

      {/* Neck */}
      <rect x="8" y="11" width="4" height="2" fill="#0066CC" />

      {/* Shoulders - triangular slope */}
      {/* Top row - narrower */}
      <rect x="6" y="13" width="8" height="1" fill="#0066CC" />

      {/* Middle row - wider */}
      <rect x="4" y="14" width="12" height="1" fill="#0066CC" />

      {/* Bottom row - widest */}
      <rect x="3" y="15" width="14" height="2" fill="#004499" />
      <rect x="3" y="15" width="14" height="1" fill="#0066CC" />

      {/* Shoulder highlights */}
      <rect x="7" y="13" width="2" height="1" fill="#3399FF" />
      <rect x="5" y="14" width="2" height="1" fill="#3399FF" />
      <rect x="13" y="14" width="2" height="1" fill="#3399FF" />

      {/* Shadow/depth on head */}
      <rect x="13" y="6" width="1" height="2" fill="#004499" />
      <rect x="12" y="10" width="1" height="1" fill="#004499" />
    </svg>
  );
}

interface TaskBarProps {
  initialActiveSection?: string;
  isFloating?: boolean;
  userEmail?: string | null;
}

export default function TaskBar({
  initialActiveSection = "home",
  isFloating = false,
  userEmail = null
}: TaskBarProps) {
  // Desktop sections (always visible)
  const homeUrl = process.env.NODE_ENV === 'development'
    ? 'http://localhost:3000'
    : 'https://sourcewizard.ai';

  const desktopSections = [
    { id: "home", name: "Home", href: homeUrl, external: true }, // Different app
    { id: "planner", name: "Planner", href: "/", external: false },
    { id: "login", name: "Dashboard", href: "/dashboard", external: true },
    { id: "Docs", name: "Docs", href: "https://docs.sourcewizard.ai", external: true },
  ];
  // Mobile menu sections (hidden on mobile, shown in hamburger menu)
  const mobileMenuSections = [
    { id: "blog", name: "Blog", href: "/blog", external: true },
    { id: "packages", name: "Packages", href: "/packages", external: true },
    { id: "contact", name: "Contact", href: "/contact", external: true },
  ];

  // Product dropdown items
  const productItems = [
    { id: "cli", name: "CLI", href: "/cli", disabled: false, external: true },
    { id: "planner", name: "Web Planner", href: "/", disabled: false }
  ];

  const getStaticButtonStyle = (section: string, isActive: boolean = false) => {
    return {
      backgroundColor: !isActive ? "#c0c0c0" : "#d0d0d0",
      border: "2px solid #000000",
      boxShadow: !isActive ? "inset 2px 2px 0 #ffffff, inset -2px -2px 0 #808080" : "inset -1px -1px 0 #ffffff, inset 1px 1px 0 #808080",
      color: "#000000",
      fontFamily: "monospace",
      fontSize: "11px",
      transform: "translate(0px, 0px)",
      textDecoration: "none",
      display: "inline-block",
    };
  };

  return (
    <div
      className={`taskbar-container ${isFloating
        ? 'top-[36px] md:top-[8px]'
        : 'w-full flex justify-center'
        }`}
      style={{
        fontFamily: "monospace",
        ...(isFloating ? {
          left: '50%',
          transform: 'translateX(-50%)',
          position: 'fixed',
          zIndex: 50
        } : {
          backgroundColor: "transparent",
        })
      }}
    >
      <div className="relative hamburger-menu-container">
        {/* Hidden checkbox for pure CSS dropdown */}
        <input type="checkbox" id="hamburger-toggle" className="hamburger-checkbox" />

        {/* Main TaskBar */}
        <div
          className="flex bg-gray-300"
          style={{
            ...(isFloating ? {
              backgroundColor: "#b0b0b0",
              border: "2px solid #808080",
              boxShadow: "2px 2px 0 #000000",
            } : {})
          }}
        >
          {/* Hamburger Menu Button - leftmost position */}
          <label
            htmlFor="hamburger-toggle"
            className="hamburger-button taskbar-button px-2 py-1 cursor-pointer transition-none select-none whitespace-nowrap"
            style={getStaticButtonStyle("hamburger")}
            title="Menu"
          >
            ☰
          </label>

          {/* Desktop sections - always visible */}
          {desktopSections.map((section) => {
            const Component = section.external ? 'a' : Link;
            const props = { href: section.href };

            return (
              <Component
                key={section.id}
                {...props}
                className="px-2 py-1 cursor-pointer transition-none select-none whitespace-nowrap block"
                style={getStaticButtonStyle(section.id, section.id === initialActiveSection)}
              >
                {section.name}
              </Component>
            );
          })}

          {/* GitHub Star Button */}
          <a
            href="https://github.com/sourcewizard-ai/sourcewizard"
            target="_blank"
            rel="noopener noreferrer"
            className="taskbar-button px-2 py-1 cursor-pointer transition-none select-none whitespace-nowrap flex items-center gap-1"
            style={getStaticButtonStyle("github")}
            title="Star us on GitHub"
          >
            <GitHubIcon />
          </a>

          {/* User Profile Icon - Hidden for now */}
          {false && userEmail && (
            <div
              className="px-2 select-none whitespace-nowrap flex items-center"
              style={{
                ...getStaticButtonStyle("user", true),
                cursor: 'default',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title={userEmail || undefined}
            >
              <PersonIcon />
            </div>
          )}
        </div>

        {/* Dropdown Menu - sibling of checkbox for CSS targeting */}
        <div
          className="hamburger-dropdown absolute top-full left-0 mt-1 bg-gray-300"
          style={{
            border: "2px solid #808080",
            boxShadow: "2px 2px 0 #000000",
            minWidth: "120px",
          }}
        >
          {/* Product dropdown item - first item */}
          <div className="relative product-dropdown-container">
            <input type="checkbox" id="product-toggle" className="product-checkbox" />
            <label
              htmlFor="product-toggle"
              className="block w-full px-2 py-1 cursor-pointer transition-none select-none whitespace-nowrap text-left"
              style={getStaticButtonStyle("mobile-product")}
            >
              Product ▶
            </label>

            {/* Product submenu */}
            <div
              className="product-submenu absolute left-full top-0 bg-gray-300"
              style={{
                border: "2px solid #808080",
                boxShadow: "2px 2px 0 #000000",
                minWidth: "100px",
              }}
            >
              {productItems.map((item) => {
                if (item.disabled) {
                  return (
                    <div
                      key={`product-${item.id}`}
                      className="block w-full px-2 py-1 cursor-not-allowed transition-none select-none whitespace-nowrap text-left"
                      style={{
                        ...getStaticButtonStyle(`product-${item.id}`),
                        backgroundColor: "#a0a0a0",
                        color: "#606060",
                        opacity: 0.6
                      }}
                    >
                      {item.name}
                    </div>
                  );
                }

                const Component = item.external ? 'a' : Link;
                return (
                  <Component
                    key={`product-${item.id}`}
                    href={item.href}
                    className="block w-full px-2 py-1 cursor-pointer transition-none select-none whitespace-nowrap text-left"
                    style={getStaticButtonStyle(`product-${item.id}`)}
                  >
                    {item.name}
                  </Component>
                );
              })}
            </div>
          </div>

          {mobileMenuSections.map((section) => {
            const Component = section.external ? 'a' : Link;
            return (
              <Component
                key={`mobile-${section.id}`}
                href={section.href}
                className="block w-full px-2 py-1 cursor-pointer transition-none select-none whitespace-nowrap text-left"
                style={getStaticButtonStyle(`mobile-${section.id}`)}
              >
                {section.name}
              </Component>
            );
          })}
        </div>
      </div>
    </div>
  );
}
