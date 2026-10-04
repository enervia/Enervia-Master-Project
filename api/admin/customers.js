import { requestCustomerData } from "../../lib/supabase-customer.js";
export default async function handler(req,res){
 if(req.method!=="GET")return res.status(405).json({ok:false,error:"Method not allowed"});
 try{const base=String(process.env.SUPABASE_URL||"").replace(/\/$/,""),key=String(process.env.SUPABASE_SERVICE_ROLE_KEY||"");const companies=await requestCustomerData(base+"/rest/v1/customer_companies?order=created_at.desc",{base,key});return res.status(200).json({ok:true,customers:companies||[]});}
 catch(e){console.error("Customer list error",e);return res.status(500).json({ok:false,error:"Unable to load customers."})}
}