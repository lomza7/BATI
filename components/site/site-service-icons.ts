// Icônes disponibles pour les services affichés sur le site vitrine.
// Partagé entre l'éditeur admin (picker) et le rendu public.

import {
  Hammer,
  PaintBucket,
  Wrench,
  Home,
  Shield,
  Ruler,
  Zap,
  Droplets,
  Flame,
  Layers,
  Brush,
  HardHat,
  Building2,
  Plug,
  Thermometer,
  Pipette,
  TreePine,
  Warehouse,
  Lightbulb,
  Settings,
  type LucideIcon,
} from 'lucide-react';

export interface ServiceIconOption {
  name: string;
  label: string;
  Icon: LucideIcon;
}

export const SERVICE_ICONS: ServiceIconOption[] = [
  { name: 'Wrench', label: 'Clé à molette', Icon: Wrench },
  { name: 'Hammer', label: 'Marteau', Icon: Hammer },
  { name: 'PaintBucket', label: 'Peinture', Icon: PaintBucket },
  { name: 'Brush', label: 'Pinceau', Icon: Brush },
  { name: 'Home', label: 'Maison', Icon: Home },
  { name: 'Building2', label: 'Bâtiment', Icon: Building2 },
  { name: 'Warehouse', label: 'Hangar', Icon: Warehouse },
  { name: 'HardHat', label: 'Casque chantier', Icon: HardHat },
  { name: 'Ruler', label: 'Règle', Icon: Ruler },
  { name: 'Layers', label: 'Couches', Icon: Layers },
  { name: 'Zap', label: 'Électricité', Icon: Zap },
  { name: 'Plug', label: 'Prise', Icon: Plug },
  { name: 'Lightbulb', label: 'Ampoule', Icon: Lightbulb },
  { name: 'Droplets', label: 'Gouttes', Icon: Droplets },
  { name: 'Pipette', label: 'Plomberie', Icon: Pipette },
  { name: 'Flame', label: 'Flamme', Icon: Flame },
  { name: 'Thermometer', label: 'Température', Icon: Thermometer },
  { name: 'TreePine', label: 'Sapin', Icon: TreePine },
  { name: 'Shield', label: 'Bouclier', Icon: Shield },
  { name: 'Settings', label: 'Réglages', Icon: Settings },
];

export const SERVICE_ICON_MAP: Record<string, LucideIcon> = Object.fromEntries(
  SERVICE_ICONS.map((i) => [i.name, i.Icon])
);

export const DEFAULT_SERVICE_ICON = 'Wrench';
