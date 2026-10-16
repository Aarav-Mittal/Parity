import React from 'react';
import {
  Coffee,
  Bus,
  Home,
  Wifi,
  PlayCircle,
  ShoppingBag,
  Heart,
  MoreHorizontal,
  Tag,
} from 'lucide-react';

interface CategoryIconProps {
  iconName?: string;
  className?: string;
  colorHex?: string;
}

export function CategoryIcon({ iconName, className = 'h-4 w-4', colorHex }: CategoryIconProps) {
  const IconComponent = (() => {
    switch (iconName?.toLowerCase()) {
      case 'coffee':
        return Coffee;
      case 'bus':
        return Bus;
      case 'home':
        return Home;
      case 'wifi':
        return Wifi;
      case 'playcircle':
        return PlayCircle;
      case 'shoppingbag':
        return ShoppingBag;
      case 'heart':
        return Heart;
      case 'morehorizontal':
        return MoreHorizontal;
      default:
        return Tag;
    }
  })();

  return (
    <span
      className="inline-flex items-center justify-center rounded-lg p-1.5 bg-slate-100 dark:bg-slate-800 transition-colors"
      style={colorHex ? { backgroundColor: `${colorHex}20` } : undefined}
    >
      <IconComponent
        className={`${className} ${!colorHex ? 'text-slate-500 dark:text-slate-400' : ''}`}
        style={colorHex ? { color: colorHex } : undefined}
      />
    </span>
  );
}
