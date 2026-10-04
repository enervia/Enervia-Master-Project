import { getCustomerContext } from "../../lib/customer-auth.js";
import { requestCustomerData } from "../../lib/supabase-customer.js";
export default async function handler(req,res){
 if(req.method!=="GET")return res.status(405).json({ok:false,error:"Method not allowed"});
 try{
  const ctx=await getCustomerContext(req);
  if(!ctx)return res.status(401).json({ok:false,error:"Authentication required."});
  if(ctx.inactive)return res.status(403).json({ok:false,error:"Customer account is awaiting approval."});
  const base=String(process.env.SUPABASE_URL||"").replace(/\/$/,""),key=String(process.env.SUPABASE_SERVICE_ROLE_KEY||"");
  const rfqs=await requestCustomerData(base+"/rest/v1/rfqs?customer_company_id=eq."+encodeURIComponent(ctx.company.id)+"&customer_visible=eq.true&order=submitted_at.desc",{base,key});
  const quotes=await requestCustomerData(base+"/rest/v1/quotations?customer_company_id=eq."+encodeURIComponent(ctx.company.id)+"&order=created_at.desc",{base,key});
  return res.status(200).json({ok:true,rfqs:rfqs||[],quotations:quotes||[]});
 }catch(e){console.error("Customer RFQ list error",e);return res.status(500).json({ok:false,error:"Unable to load customer requests."})}
}