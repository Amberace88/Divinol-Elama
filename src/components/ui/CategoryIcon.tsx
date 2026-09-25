import { Bike, Car, Cog, Droplets, Factory, Gauge, HardHat, Snowflake, SprayCan, Truck, type LucideProps } from "lucide-react";

const map = { car: Car, truck: Truck, bike: Bike, cog: Cog, gauge: Gauge, factory: Factory, droplets: Droplets, spray: SprayCan, snowflake: Snowflake, hardhat: HardHat };

export function CategoryIcon({ name, ...props }: { name: string } & LucideProps) {
  const Icon = map[name as keyof typeof map] ?? Droplets;
  return <Icon {...props} />;
}
