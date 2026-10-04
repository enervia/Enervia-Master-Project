import { requestCustomerData } from "../../lib/supabase-customer.js";
export default async function handler(req,res){
 if(req.method!=="GET")return res.status(405).json({ok:false,error:"Method not allowed"});
 const id=String(req.query?.rfqId||"");if(!id)return res.status(400).json({ok:false,error:"RFQ ID is required."});
 try{
  const base=String(process.env.SUPABASE_URL||"").replace(/\/$/,""),key=String(process.env.SUPABASE_SERVICE_ROLE_KEY||"");
  const rows=await requestCustomerData(base+"/rest/v1/quotations?rfq_id=eq."+encodeURIComponent(id)+"&limit=1",{base,key});
  const quotation=rows?.[0]||null;
  if(!quotation)return res.status(200).json({ok:true,quotation:null,actions:[]});
  const actions=await requestCustomerData(base+"/rest/v1/customer_rfq_actions?rfq_id=eq."+encodeURIComponent(id)+"&order=created_at.desc",{base,key});
  return res.status(200).json({ok:true,quotation,actions:actions||[]});
 }catch(e){console.error("Quotation lookup error",e);return res.status(500).json({ok:false,error:"Unable to load quotation."})}
}