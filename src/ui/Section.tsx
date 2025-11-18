import * as React from 'react';
import { cn } from '@/helpers/utils';
import { Card } from './Card';

export type SectionProps = {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  hoverable?: boolean;
};

export function Section({
  title,
  description,
  children,
  className,
  headerClassName,
  contentClassName,
  hoverable = true,
}: SectionProps) {
  const hasHeader = Boolean(title || description);

  return (
    <Card className={className} hoverable={hoverable}>
      <div className={cn('space-y-4', !hasHeader && 'space-y-0')}>
        {hasHeader ? (
          <div className={cn('space-y-1', headerClassName)}>
            {title ? <h2 className="text-sm font-medium text-white">{title}</h2> : null}
            {description ? <p className="text-xs text-white/60">{description}</p> : null}
          </div>
        ) : null}
        <div className={contentClassName}>{children}</div>
      </div>
    </Card>
  );
}
