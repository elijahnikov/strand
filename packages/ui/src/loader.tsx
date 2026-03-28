import type React from "react";

export interface IconProps extends React.SVGAttributes<SVGElement> {
  children?: never;
  color?: string;
  ref?: React.Ref<SVGSVGElement>;
}

const Loader = ({ color = "currentColor", ref, ...props }: IconProps) => (
  <svg
    fill="none"
    height={15}
    ref={ref}
    width={15}
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <title>Loading spinner</title>
    <g
      clipPath="url(#a)"
      stroke={color}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
    >
      <path d="M7.5 1.056v2.222" />
      <path d="m12.057 2.943-1.571 1.571" opacity={0.88} />
      <path d="M13.944 7.5h-2.222" opacity={0.75} />
      <path d="m12.057 12.057-1.571-1.571" opacity={0.63} />
      <path d="M7.5 13.945v-2.223" opacity={0.5} />
      <path d="m2.943 12.057 1.571-1.571" opacity={0.38} />
      <path d="M1.056 7.5h2.222" opacity={0.25} />
      <path d="m2.943 2.943 1.571 1.571" opacity={0.13} />
    </g>
    <defs>
      <clipPath id="a">
        <path d="M0 0h15v15H0z" fill="#fff" />
      </clipPath>
    </defs>
  </svg>
);
Loader.displayName = "Loader";
export default Loader;
