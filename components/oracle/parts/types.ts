import type { Appearance } from "@/lib/persona";
import type { PersonaMaterials } from "./materials";

export interface PartProps {
  appearance: Appearance;
  mats: PersonaMaterials;
}
