import { shippingFiltersSchema } from "@/validations/shipping";
export function parseShippingFilters(value:Record<string,string|string[]|undefined>){const one=(v:string|string[]|undefined)=>Array.isArray(v)?v[0]:v;return shippingFiltersSchema.parse({page:one(value.page),query:one(value.query),status:one(value.status)});}
