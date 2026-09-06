import React from 'react';
import {
  Amphora,
  Shirt,
  Scissors,
  Hammer,
  Pickaxe,
  Paintbrush,
  TreeDeciduous,
  ShoppingBag,
  Mountain,
  Grid3x3,
  Gem,
  Layers,
  Sparkles,
} from 'lucide-react-native';

type IconComponent = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

export const CRAFT_ICONS: Record<string, IconComponent> = {
  pottery: Amphora,
  weaving: Shirt,
  embroidery: Scissors,
  woodwork: Hammer,
  metalwork: Pickaxe,
  painting: Paintbrush,
  bamboo: TreeDeciduous,
  leather: ShoppingBag,
  stone: Mountain,
  block_print: Grid3x3,
  jewelry: Gem,
  papier_mache: Layers,
  other: Sparkles,
};

export const getCraftIcon = (craftId: string | null | undefined): IconComponent =>
  (craftId && CRAFT_ICONS[craftId]) || Sparkles;
