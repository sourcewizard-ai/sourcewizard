"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface SidebarIconProps {
  href?: string;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}

function SidebarIcon({ href, icon, label, active, onClick }: SidebarIconProps) {
  const [isHovered, setIsHovered] = React.useState(false);

  const buttonStyle = {
    backgroundColor: !active ? "#c0c0c0" : "#d0d0d0",
    border: "2px solid #000000",
    boxShadow: !active
      ? "inset 2px 2px 0 #ffffff, inset -2px -2px 0 #808080"
      : "inset -1px -1px 0 #ffffff, inset 1px 1px 0 #808080",
    color: "#000000",
    fontFamily: "monospace",
    fontSize: "11px",
    textDecoration: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    padding: "0",
    width: isHovered ? "140px" : "40px",
    height: "40px",
    transition: "width 0.3s ease-in-out",
    overflow: "hidden",
    whiteSpace: "nowrap" as const,
    position: "relative" as const,
  };

  const content = (
    <div
      className="cursor-pointer"
      style={buttonStyle}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      <div style={{
        width: "40px",
        height: "40px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        marginLeft: "-2px"
      }}>
        <div style={{ width: "24px", height: "24px", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {icon}
        </div>
      </div>
      {isHovered && (
        <span style={{
          transition: "opacity 0.2s ease-in-out",
          opacity: 1,
          transitionDelay: "0.1s"
        }}>{label}</span>
      )}
    </div>
  );

  if (onClick || !href) {
    return content;
  }

  return (
    <Link href={href} title={label} style={{ display: "block" }} target="_blank" rel="noopener noreferrer">
      {content}
    </Link>
  );
}

// Windows 3.x style icons - simplified pixel-art style
function DashboardIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
      {/* Computer/Desktop icon */}
      <rect x="6" y="8" width="20" height="14" fill="#00FFFF" stroke="#000" strokeWidth="1.5" />
      <rect x="8" y="10" width="16" height="10" fill="#0000FF" />
      <rect x="13" y="22" width="6" height="2" fill="#808080" stroke="#000" strokeWidth="1" />
      <rect x="10" y="24" width="12" height="2" fill="#C0C0C0" stroke="#000" strokeWidth="1" />
    </svg>
  );
}

function AgentRunsIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
      {/* Document icon */}
      <rect x="8" y="4" width="14" height="22" fill="#FFFFFF" stroke="#000" strokeWidth="1.5" />
      <rect x="8" y="4" width="14" height="3" fill="#0000FF" />
      <line x1="10" y1="10" x2="20" y2="10" stroke="#000" strokeWidth="1.5" />
      <line x1="10" y1="14" x2="20" y2="14" stroke="#000" strokeWidth="1.5" />
      <line x1="10" y1="18" x2="17" y2="18" stroke="#000" strokeWidth="1.5" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
      {/* Toolbox icon */}
      <rect x="7" y="12" width="18" height="13" fill="#808080" stroke="#000" strokeWidth="1.5" />
      <rect x="7" y="12" width="18" height="4" fill="#C0C0C0" stroke="#000" strokeWidth="1.5" />
      <rect x="13" y="9" width="6" height="3" fill="#808080" stroke="#000" strokeWidth="1.5" />
      <circle cx="12" cy="20" r="2" fill="#FFFF00" stroke="#000" strokeWidth="1" />
      <circle cx="20" cy="20" r="2" fill="#FF0000" stroke="#000" strokeWidth="1" />
    </svg>
  );
}

function PackagesIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
      {/* Package/Box icon */}
      <rect x="8" y="10" width="16" height="14" fill="#C0C0C0" stroke="#000" strokeWidth="1.5" />
      <polygon points="8,10 16,6 24,10" fill="#808080" stroke="#000" strokeWidth="1.5" />
      <line x1="16" y1="6" x2="16" y2="24" stroke="#000" strokeWidth="1.5" />
      <line x1="8" y1="10" x2="16" y2="14" stroke="#000" strokeWidth="1.5" />
      <line x1="24" y1="10" x2="16" y2="14" stroke="#000" strokeWidth="1.5" />
    </svg>
  );
}

function HelpIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
      {/* Help book icon */}
      <rect x="8" y="5" width="16" height="22" fill="#FFFF00" stroke="#000" strokeWidth="1.5" />
      <text x="16" y="21" fontSize="16" fill="#000000" fontWeight="bold" textAnchor="middle" fontFamily="Arial">?</text>
    </svg>
  );
}

function IntegrationPlansIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
      {/* Integration/Puzzle piece icon */}
      <rect x="6" y="10" width="10" height="12" fill="#00FFFF" stroke="#000" strokeWidth="1.5" />
      <rect x="16" y="10" width="10" height="12" fill="#FF00FF" stroke="#000" strokeWidth="1.5" />
      <rect x="11" y="8" width="4" height="4" fill="#00FFFF" stroke="#000" strokeWidth="1.5" />
      <rect x="17" y="22" width="4" height="4" fill="#FF00FF" stroke="#000" strokeWidth="1.5" />
      <line x1="8" y1="13" x2="13" y2="13" stroke="#000" strokeWidth="1" />
      <line x1="8" y1="16" x2="13" y2="16" stroke="#000" strokeWidth="1" />
      <line x1="19" y1="13" x2="24" y2="13" stroke="#000" strokeWidth="1" />
      <line x1="19" y1="16" x2="24" y2="16" stroke="#000" strokeWidth="1" />
    </svg>
  );
}

interface SidebarProps {
  userRole?: string | null;
  onMyPlansClick?: () => void;
  onSettingsClick?: () => void;
}

export default function Sidebar({ userRole, onMyPlansClick, onSettingsClick }: SidebarProps) {
  const pathname = usePathname();

  return (
    <div
      className="flex flex-col"
      style={{
        fontFamily: "monospace",
      }}
    >
      <SidebarIcon
        href={process.env.NODE_ENV === "development" ? "http://localhost:3000/dashboard" : "https://sourcewizard.ai/dashboard"}
        icon={<DashboardIcon />}
        label="MCP Dashboard"
        active={pathname === "/dashboard"}
      />
      <SidebarIcon
        icon={<IntegrationPlansIcon />}
        label="My Plans"
        onClick={onMyPlansClick}
        active={false}
      />
      {userRole === "maintainer" && (
        <>
          <SidebarIcon
            href="/dashboard/packages"
            icon={<PackagesIcon />}
            label="Packages"
            active={pathname?.startsWith("/dashboard/packages")}
          />
          <SidebarIcon
            href="/dashboard/agent-runs"
            icon={<AgentRunsIcon />}
            label="Agent Runs"
            active={pathname?.startsWith("/dashboard/agent-runs")}
          />
        </>
      )}
      <SidebarIcon
        icon={<SettingsIcon />}
        label="Settings"
        onClick={onSettingsClick}
        active={false}
      />
    </div>
  );
}
