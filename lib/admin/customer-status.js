import { requestCustomerData } from "../../lib/supabase-customer.js";
const allowed=["PENDING","ACTIVE","SUSPENDED"];
export default async function handler(req,res){
 if(req.method!=="POST")return res.status(405).json({ok:false,error:"Method not allowed"});
 const {companyId,status}=req.body||{};
 if(!companyId||!allowed.includes(status))return res.status(400).json({ok:false,error:"Invalid customer status."});
 try{const base=String(process.env.SUPABASE_URL||"").replace(/\/$/,""),key=String(process.env.SUPABASE_SERVICE_ROLE_KEY||"");const rows=await requestCustomerData(base+"/rest/v1/customer_companies?id=eq."+encodeURIComponent(companyId),{base,key,method:"PATCH",body:JSON.stringify({status,updated_at:new Date().toISOString()})});if(!rows?.[0])return res.status(404).json({ok:false,error:"Customer not found."});return res.status(200).json({ok:true,customer:rows[0]});}
 catch(e){console.error("Customer status error",e);return res.status(500).json({ok:false,error:"Unable to update customer status."})}
}