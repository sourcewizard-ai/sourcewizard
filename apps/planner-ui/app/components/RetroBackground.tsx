interface RetroBackgroundProps {
  pattern?: string;
}

export const backgroundPatterns: Record<string, React.CSSProperties> = {
  grid: {
    background:
      "linear-gradient(to bottom, #0000FF 0%, #0000FF 1.8%, #0000EE 1.8%, #0000EE 3.6%, #0000DD 3.6%, #0000DD 5.4%, #0000CC 5.4%, #0000CC 7.2%, #0000BB 7.2%, #0000BB 9%, #0000AA 9%, #0000AA 10.8%, #000099 10.8%, #000099 12.6%, #000088 12.6%, #000088 14.4%, #000077 14.4%, #000077 16.2%, #000066 16.2%, #000066 18%, #000055 18%, #000055 19.8%, #000044 19.8%, #000044 21.6%, #000033 21.6%, #000033 23.4%, #000022 23.4%, #000022 25.2%, #000011 25.2%, #000011 27%, #000000 27%)",
  },
  waves: {
    backgroundColor: '#003366',
    backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='20' viewBox='0 0 40 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 10 Q 10 3, 20 10 T 40 10' stroke='%230099FF' stroke-width='2' fill='none'/%3E%3C/svg%3E")`,
    backgroundSize: '40px 20px',
    backgroundRepeat: 'repeat',
  },
  solid: {
    background: '#0a0a14',
  },
  'neon-grid': {
    backgroundColor: '#1a1a2e',
    backgroundImage: 'linear-gradient(#00FFFF 2px, transparent 2px), linear-gradient(90deg, #00FFFF 2px, transparent 2px)',
    backgroundSize: '50px 50px',
  },
  'purple-haze': {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  },
  'cyber-pink': {
    background: 'linear-gradient(to bottom right, #FF00FF 0%, #8B008B 50%, #000033 100%)',
  },
  sunset: {
    background: 'linear-gradient(to bottom, #ff6b35 0%, #f7931e 25%, #c13584 50%, #833ab4 75%, #000033 100%)',
  },
  matrix: {
    backgroundColor: '#000000',
    backgroundImage: 'linear-gradient(#00FF00 1px, transparent 1px), linear-gradient(90deg, #00FF00 1px, transparent 1px)',
    backgroundSize: '40px 40px',
  },
  'commodore-64': {
    backgroundColor: '#7869C4',
    backgroundImage: 'linear-gradient(#3E31A2, #3E31A2)',
    backgroundSize: '85% 85%',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
  },
  'teal-gradient': {
    background: '#54B3B3',
  },
  'lavender': {
    background: '#B3B3DA',
  },
  'stripes': {
    backgroundColor: '#4a6fa5',
    backgroundImage: 'repeating-linear-gradient(0deg, #6b9bd1 0px, #6b9bd1 5px, #4a6fa5 5px, #4a6fa5 10px)',
  },
  'cubes': {
    backgroundColor: '#1a1a2e',
    backgroundImage: `
      linear-gradient(30deg, #2a2a4e 12%, transparent 12.5%, transparent 87%, #2a2a4e 87.5%, #2a2a4e),
      linear-gradient(150deg, #2a2a4e 12%, transparent 12.5%, transparent 87%, #2a2a4e 87.5%, #2a2a4e),
      linear-gradient(30deg, #2a2a4e 12%, transparent 12.5%, transparent 87%, #2a2a4e 87.5%, #2a2a4e),
      linear-gradient(150deg, #2a2a4e 12%, transparent 12.5%, transparent 87%, #2a2a4e 87.5%, #2a2a4e),
      linear-gradient(60deg, #3a3a5e 25%, transparent 25.5%, transparent 75%, #3a3a5e 75%, #3a3a5e),
      linear-gradient(60deg, #3a3a5e 25%, transparent 25.5%, transparent 75%, #3a3a5e 75%, #3a3a5e)
    `,
    backgroundSize: '40px 70px',
    backgroundPosition: '0 0, 0 0, 20px 35px, 20px 35px, 0 0, 20px 35px',
  },
  'tiles': {
    backgroundColor: '#5a6a8e',
    backgroundImage: `
      repeating-linear-gradient(0deg, #8a9abe 0px, #8a9abe 1px, transparent 1px, transparent 19px, #3a4a6e 19px, #3a4a6e 20px, transparent 20px, transparent 20px),
      repeating-linear-gradient(90deg, #8a9abe 0px, #8a9abe 1px, transparent 1px, transparent 19px, #3a4a6e 19px, #3a4a6e 20px, transparent 20px, transparent 20px)
    `,
    backgroundSize: '20px 20px',
  },
};

export default function RetroBackground({ pattern = 'grid' }: RetroBackgroundProps) {
  const getPatternStyle = () => {
    return backgroundPatterns[pattern] || backgroundPatterns.grid;
  };

  return (
    <>
      {/* Background gradient bars - position absolute to stay at top */}
      <div
        className="absolute inset-x-0 top-0"
        style={{
          ...getPatternStyle(),
          height: "100vh",
          zIndex: 1,
        }}
      />

      {/* Dithering overlay */}
      <div
        className="absolute inset-x-0 top-0 pointer-events-none"
        style={{
          backgroundImage: `
            radial-gradient(circle at 25% 25%, rgba(255,255,255,0.1) 1px, transparent 1px),
            radial-gradient(circle at 75% 75%, rgba(0,0,0,0.15) 1px, transparent 1px)
          `,
          backgroundSize: "4px 4px, 4px 4px",
          backgroundPosition: "0 0, 2px 2px",
          opacity: 0.25,
          height: "100vh",
          zIndex: 2,
        }}
      />
    </>
  );
}
