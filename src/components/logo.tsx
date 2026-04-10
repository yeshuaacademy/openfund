import Image from "next/image";

import openfundLight from "@/../public/logo/openfund_light.png";
import openfundDark from "@/../public/logo/openfund_dark.png";
import { cn } from "@/helpers/utils";

interface LogoProps {
  isLarge?: boolean;
  className?: string;
  priority?: boolean;
}

const BASE_WIDTH = {
  small: 150,
  large: 240,
} as const;

const LOGO_HEIGHT_RATIO = openfundLight.height / openfundLight.width;

const Logo = ({ isLarge = false, className, priority = false }: LogoProps) => {
  const width = isLarge ? BASE_WIDTH.large : BASE_WIDTH.small;
  const height = Math.round(width * LOGO_HEIGHT_RATIO);

  return (
    <div
      className={cn(
        "flex items-center gap-3",
        isLarge ? "min-h-[48px]" : "min-h-[36px]",
        className
      )}
    >
      <Image
        src={openfundLight}
        width={width}
        height={height}
        alt="Yeshua Academy Finance logo"
        priority={priority}
        className="block dark:hidden"
      />
      <Image
        src={openfundDark}
        width={width}
        height={height}
        alt="Yeshua Academy Finance logo"
        priority={priority}
        className="hidden dark:block"
      />
    </div>
  );
};

export default Logo;
