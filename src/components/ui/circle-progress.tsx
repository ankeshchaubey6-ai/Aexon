import type { ReactNode } from "react";

interface CircleProgressProps {
  value: number;
  description: ReactNode;
}

export const CircleProgress = ({ description, value = 0 }: CircleProgressProps) => {
  const normalizedValue = Math.min(100, Math.max(0, value));
  const radius = 58;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="flex gap-4 items-center">
      <svg
        className="h-36 w-36 shrink-0"
        viewBox="0 0 140 140"
        role="img"
        aria-label={`Closing rate: ${normalizedValue}%`}
      >
        <g transform="rotate(-90 70 70)">
          <circle
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="16"
            className="text-muted"
          />
          <circle
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="16"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={
              circumference * (1 - normalizedValue / 100)
            }
            className="text-primary"
          />
        </g>
        <text
          x="70"
          y="70"
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-foreground text-lg font-semibold"
        >
          {normalizedValue}%
        </text>
      </svg>
      <div>
        <b>Closing Rate</b>
        <p className="text-muted-foreground">{description}</p>
      </div>
    </div>
  );
};
