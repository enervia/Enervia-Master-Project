import { getCustomerContext } from "../../lib/customer-auth.js";
import { requestCustomerData } from "../../lib/supabase-customer.js";
export default async function handler(req,res){
 if(req.method!=="POST")return res.status(405).json({ok:false,error:"Method not allowed"});
 const {quotationId,decision,reason,note}=req.body||{};
 if(!quotationId||!["ACCEPT","IGNORE"].includes(decision))return res.status(400).json({ok:false,error:"Invalid quotation decision."});
 if(decision==="IGNORE"&&!reason)return res.status(400).json({ok:false,error:"Please select a reason."});
 try{
  const ctx=await getCustomerContext(req);
  if(!ctx||ctx.inactive)return res.status(403).json({ok:false,error:"Customer account is not active."});
  const base=String(process.env.SUPABASE_URL||"").replace(/\/$/,""),key=String(process.env.SUPABASE_SERVICE_ROLE_KEY||"");
  const rows=await requestCustomerData(base+"/rest/v1/quotations?id=eq."+encodeURIComponent(quotationId)+"&customer_company_id=eq."+encodeURIComponent(ctx.company.id)+"&limit=1",{base,key});
  const q=rows?.[0];if(!q)return res.status(404).json({ok:false,error:"Quotation not found."});
  const status=decision==="ACCEPT"?"ACCEPTED":"IGNORED";
  const now=new Date().toISOString();
  const updated=await requestCustomerData(base+"/rest/v1/quotations?id=eq."+encodeURIComponent(quotationId),{base,key,method:"PATCH",body:JSON.stringify({status,customer_decision_note:String(note||"").slice(0,2000),decided_at:now,updated_at:now})});
  await requestCustomerData(base+"/rest/v1/customer_rfq_actions",{base,key,method:"POST",body:JSON.stringify({rfq_id:q.rfq_id,user_id:ctx.user.id,action:decision==="ACCEPT"?"ACCEPT":"IGNORE",ignore_reason:decision==="IGNORE"?reason:null,note:String(note||"").slice(0,2000)})});
  await requestCustomerData(base+"/rest/v1/quotation_events",{base,key,method:"POST",body:JSON.stringify({quotation_id:quotationId,event_type:status,user_id:ctx.user.id,note:String(note||"").slice(0,2000)})});
  return res.status(200).json({ok:true,quotation:updated?.[0]||null});
 }catch(e){console.error("Customer quotation decision error",e);return res.status(500).json({ok:false,error:"Unable to save quotation decision."})}
}