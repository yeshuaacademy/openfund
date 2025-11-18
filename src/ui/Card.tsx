import * as React from 'react';
import { Card as ShadcnCard } from '@/components/ui/card';
import { cn } from '@/helpers/utils';

export type CardProps = React.ComponentProps<typeof ShadcnCard> & {
  hoverable?: boolean;
};

export function Card({ className, hoverable = true, ...props }: CardProps) {
  return (
    <ShadcnCard
      className={cn(
        'rounded-2xl border border-white/10 bg-[#060F1F]/60 p-6 shadow-inner shadow-black/30 transition-all duration-200 ease-out',
        hoverable &&
          'hover:-translate-y-0.5 hover:border-white/20 hover:bg-[#060F1F]/80 hover:shadow-[0_35px_80px_-60px_rgba(41,112,255,0.65)]',
        className,
      )}
      {...props}
    />
  );
}
