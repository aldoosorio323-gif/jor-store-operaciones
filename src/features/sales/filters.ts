import { salesFiltersSchema } from "@/validations/sales";
export function parseSalesFilters(input:Record<string,string|string[]|undefined>){const one=(v:string|string[]|undefined)=>Array.isArray(v)?v[0]:v;const parsed=salesFiltersSchema.safeParse({page:one(input.page),query:one(input.query)??"",status:one(input.status)??"all"});return parsed.success?parsed.data:{page:1,query:"",status:"all"};}
