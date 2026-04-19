import { Box } from "@mui/material";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { SxProps, Theme } from "@mui/material/styles";

type ChartDimensions = {
  width: number;
  height: number;
};

type ChartContainerProps = {
  children?: ReactNode;
  className?: string;
  renderChart: (dimensions: ChartDimensions) => ReactNode;
  sx?: SxProps<Theme>;
};

function ChartContainer({ children, className, renderChart, sx }: ChartContainerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dimensions, setDimensions] = useState<ChartDimensions | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.ResizeObserver === "undefined") {
      setDimensions({ width: 0, height: 0 });
      return undefined;
    }

    const node = containerRef.current;
    if (!node) {
      return undefined;
    }

    let frameId = 0;

    const updateSize = () => {
      const { width, height } = node.getBoundingClientRect();
      const nextWidth = Math.floor(width);
      const nextHeight = Math.floor(height);

      setDimensions((current) => {
        if (nextWidth <= 0 || nextHeight <= 0) {
          return null;
        }
        if (current && current.width === nextWidth && current.height === nextHeight) {
          return current;
        }
        return { width: nextWidth, height: nextHeight };
      });
    };

    const scheduleUpdate = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(updateSize);
    };

    scheduleUpdate();

    const resizeObserver = new window.ResizeObserver(scheduleUpdate);
    resizeObserver.observe(node);

    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <Box
      ref={containerRef}
      className={className}
      sx={{
        position: "relative",
        minWidth: 0,
        minHeight: 0,
        ...sx
      }}
    >
      {dimensions ? renderChart(dimensions) : null}
      {children}
    </Box>
  );
}

export default ChartContainer;
