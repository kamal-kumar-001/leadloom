import React from 'react';
import { cn } from './utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'matrix';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', children, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center font-medium transition-all duration-200 select-none focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-canvas disabled:opacity-50 disabled:pointer-events-none rounded-md';
    
    const variants = {
      primary: 'bg-brand-loom text-text-onAccent hover:bg-brand-loomHover shadow-lg shadow-brand-loom/20 hover:shadow-brand-loom/30 border border-brand-loom/40 focus:ring-brand-loom',
      secondary: 'bg-canvas-elevated text-text-primary hover:bg-canvas-subtle border border-border-muted focus:ring-border-focus',
      outline: 'bg-transparent text-text-primary border border-border-muted hover:border-brand-loom/60 hover:bg-brand-loom/5 focus:ring-brand-loom',
      ghost: 'bg-transparent text-text-secondary hover:text-text-primary hover:bg-canvas-elevated focus:ring-border-focus',
      matrix: 'bg-brand-matrix/10 text-brand-matrix border border-brand-matrix/40 hover:bg-brand-matrix/20 font-mono shadow-sm focus:ring-brand-matrix',
    };

    const sizes = {
      sm: 'text-xs px-2.5 py-1.5 gap-1.5',
      md: 'text-sm px-4 py-2 gap-2',
      lg: 'text-base px-6 py-3 gap-2.5',
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
