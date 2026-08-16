import { Children, cloneElement, isValidElement } from "react";
import { cn } from "../../utils/cn.js";

/**
 * ButtonGroup — renders a row of buttons that share borders between them,
 * giving a segmented-control appearance.
 *
 * @param {"horizontal"|"vertical"} [orientation="horizontal"]
 * @param {"sm"|"md"|"lg"}          [size="md"]        - Passed to all child Buttons
 * @param {boolean}                 [attached=true]    - Share borders (pill → square joins)
 * @param {string}                  [className]
 *
 * @example
 * <ButtonGroup>
 *   <Button variant="secondary">Day</Button>
 *   <Button variant="secondary">Week</Button>
 *   <Button variant="secondary">Month</Button>
 * </ButtonGroup>
 *
 * // Vertical segmented control
 * <ButtonGroup orientation="vertical">
 *   <Button variant="secondary" leftIcon={<ListIcon size={14}/>}>List</Button>
 *   <Button variant="secondary" leftIcon={<GridIcon size={14}/>}>Grid</Button>
 * </ButtonGroup>
 */
export function ButtonGroup({
  children,
  orientation = "horizontal",
  size,
  attached = true,
  className,
  ...props
}) {
  const isHorizontal = orientation === "horizontal";
  const childArray   = Children.toArray(children).filter(isValidElement);
  const count        = childArray.length;

  return (
    <div
      role="group"
      className={cn(
        "inline-flex",
        isHorizontal ? "flex-row" : "flex-col",
        attached && "divide-x-0",
        className
      )}
      {...props}
    >
      {childArray.map((child, i) => {
        const isFirst = i === 0;
        const isLast  = i === count - 1;
        const isMid   = !isFirst && !isLast;

        // Build rounded corner classes based on position + orientation
        let radiusClass = "";
        if (attached) {
          if (isHorizontal) {
            if (isFirst) radiusClass = "rounded-r-none border-r-0";
            else if (isLast) radiusClass = "rounded-l-none";
            else radiusClass = "rounded-none border-r-0";
          } else {
            if (isFirst) radiusClass = "rounded-b-none border-b-0";
            else if (isLast) radiusClass = "rounded-t-none";
            else radiusClass = "rounded-none border-b-0";
          }
        }

        return cloneElement(child, {
          key: i,
          size: size ?? child.props.size,
          className: cn(radiusClass, child.props.className),
        });
      })}
    </div>
  );
}