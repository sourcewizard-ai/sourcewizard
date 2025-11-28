import { fonts, fontSizes } from "../../lib/fonts";

interface LogoProps {
  size?: "normal" | "small";
}

export default function Logo({ size = "normal" }: LogoProps) {
  const isSmall = size === "small";

  return (
    <div
      className={`absolute ${isSmall ? 'top-3 left-3' : 'top-4 left-4'}`}
      style={{ zIndex: 40 }}
    >
      <h1
        className={`text-white italic font-bold ${isSmall ? 'text-base' : 'text-2xl'}`}
        style={{ fontFamily: "monospace", textShadow: "2px 2px 0 black" }}
      >
        SourceWizard
      </h1>
    </div>
  );
}
