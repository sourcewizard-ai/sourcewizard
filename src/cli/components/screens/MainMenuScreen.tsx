import React, { useEffect, useState } from "react";
import SelectInput from "ink-select-input";
import type { MenuOption, PageMetadata } from "../types.js";

interface MainMenuScreenProps {
  onSelect: (action: string) => void;
}

export const mainMenuMetadata: PageMetadata = {
  title: "MCP Package Manager - Main Menu",
  menuTitle: "Main Menu",
  menuWidth: 80,
  borderColor: "cyan",
};

export const MainMenuScreen: React.FC<MainMenuScreenProps> = ({ onSelect }) => {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    setProgress(48);
    // const interval = setInterval(() => {
    //   if (progress >= 100) {
    //     setProgress(0);
    //     return;
    //   }
    //   setProgress((prev) => prev + 1);
    // }, 100);
    // return () => clearInterval(interval);
  }, []);

  const mainMenuOptions: MenuOption[] = [
    {
      key: "A",
      label: "Search Packages",
      description: "Search for packages and code snippets in the registry",
      action: "search",
    },
    {
      key: "B",
      label: "Install Package/Snippet",
      description: "Install packages or code snippets with AI guidance",
      action: "install",
    },
    {
      key: "C",
      label: "View Package Information",
      description: "Get detailed information about a specific package",
      action: "info",
    },
    {
      key: "D",
      label: "List All Items",
      description: "Browse all available packages and snippets",
      action: "list",
    },
    {
      key: "E",
      label: "Add New Package/Snippet",
      description: "Add new packages or snippets to the registry",
      action: "add",
    },
    {
      key: "F",
      label: "Registry Statistics",
      description: "View usage statistics and analytics",
      action: "stats",
    },
    {
      key: "G",
      label: "Exit",
      description: "Exit the MCP Package Manager",
      action: "exit",
    },
  ];

  const items = mainMenuOptions.map((option) => ({
    label: option.label,
    value: option.action,
    description: option.description,
  }));

  return (
    <>
      <SelectInput items={items} onSelect={(item) => onSelect(item.value)} />
    </>
  );
};
