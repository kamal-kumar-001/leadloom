'use client';

import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from './utils';

export interface MagneticButtonProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  pullRadius?: number;
}

export function MagneticButton({
  children,
  className,
  onClick,
  pullRadius = 25,
}: MagneticButtonProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const { clientX, clientY } = e;
    const { left, top, width, height } = ref.current.getBoundingClientRect();
    const centerX = left + width / 2;
    const centerY = top + height / 2;
    const distanceX = clientX - centerX;
    const distanceY = clientY - centerY;

    // Dampen pull translation within perimeter
    setPosition({
      x: (distanceX / width) * pullRadius,
      y: (distanceY / height) * pullRadius,
    });
  };

  const handleMouseLeave = () => {
    setPosition({ x: 0, y: 0 });
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      animate={{ x: position.x, y: position.y }}
      transition={{ type: 'spring', stiffness: 180, damping: 14, mass: 0.1 }}
      onClick={onClick}
      className={cn('inline-block cursor-pointer select-none', className)}
    >
      {children}
    </motion.div>
  );
}
