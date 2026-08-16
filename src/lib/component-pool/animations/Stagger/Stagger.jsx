import { Children } from "react";
import { FadeIn } from "../FadeIn/FadeIn.jsx";

/** Stagger-animates children with FadeIn and incrementing delay */
export function Stagger({ delay = 80, children, direction = "up", ...props }) {
  return (
    <>{Children.map(children, (child, i) => (
      <FadeIn key={i} direction={direction} delay={i * delay} {...props}>{child}</FadeIn>
    ))}</>
  );
}
