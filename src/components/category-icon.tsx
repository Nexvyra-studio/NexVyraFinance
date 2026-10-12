import {
  Baby, Banknote, Beer, Bike, Book, Briefcase, Bus, Car, Coffee, Dumbbell, Ellipsis, Film, Fuel,
  Gamepad2, Gift, GraduationCap, HeartPulse, House, Laptop, Music, Package, PawPrint, Pill, Pizza,
  Plane, Repeat, Shirt, ShoppingBag, ShoppingCart, Smartphone, Sofa, TrendingUp, Tv, Utensils, Wifi,
  Wrench, Zap, ArrowLeftRight, type LucideIcon,
} from "lucide-react";

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  utensils: Utensils,
  cart: ShoppingCart,
  car: Car,
  home: House,
  zap: Zap,
  health: HeartPulse,
  game: Gamepad2,
  bag: ShoppingBag,
  repeat: Repeat,
  education: GraduationCap,
  dots: Ellipsis,
  briefcase: Briefcase,
  laptop: Laptop,
  trending: TrendingUp,
  gift: Gift,
  plane: Plane,
  pet: PawPrint,
  shirt: Shirt,
  gym: Dumbbell,
  baby: Baby,
  fuel: Fuel,
  phone: Smartphone,
  wifi: Wifi,
  coffee: Coffee,
  beer: Beer,
  pizza: Pizza,
  bus: Bus,
  bike: Bike,
  pill: Pill,
  sofa: Sofa,
  tv: Tv,
  music: Music,
  film: Film,
  book: Book,
  tools: Wrench,
  package: Package,
  money: Banknote,
};

export const CATEGORY_COLORS = [
  "#F59E6B", "#F7C55E", "#D4F36B", "#8FE07A", "#5BD69B", "#5ED1E0",
  "#6BB8F5", "#7A8CF5", "#B49BF5", "#E58FF5", "#F58FA8", "#9AA3B2",
];

export function CategoryIcon({
  icon,
  color,
  size = 40,
  transfer,
}: {
  icon?: string;
  color?: string;
  size?: number;
  transfer?: boolean;
}) {
  const Icon = transfer ? ArrowLeftRight : CATEGORY_ICONS[icon ?? ""] ?? Ellipsis;
  const c = transfer ? "#9AA3B2" : color ?? "#9AA3B2";
  return (
    <span
      className="grid shrink-0 place-items-center rounded-2xl"
      style={{ width: size, height: size, background: `${c}22`, color: c }}
    >
      <Icon size={Math.round(size * 0.48)} strokeWidth={2} />
    </span>
  );
}
