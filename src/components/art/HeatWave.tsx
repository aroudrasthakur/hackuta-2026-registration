export function HeatWaveDefs() {
  return (
    <svg
      className="heat-wave-defs"
      aria-hidden="true"
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <filter
          id="heat-wave"
          x="-20%"
          y="-50%"
          width="140%"
          height="200%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.01 0.045"
            numOctaves="2"
            seed="3"
            result="heat"
          >
            <animate
              attributeName="baseFrequency"
              dur="3.8s"
              values="0.008 0.03;0.018 0.075;0.008 0.03"
              repeatCount="indefinite"
            />
          </feTurbulence>
          <feDisplacementMap
            in="SourceGraphic"
            in2="heat"
            scale="14"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
  );
}
