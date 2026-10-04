import { updateRfqStatus, getRfq, createQuotationFromRfq } from "../../lib/supabase.js";
export default async function handler(req,res){
 if(req.method!=="POST")return res.status(405).json({ok:false,error:"Method not allowed"});
 const {rfqId}=req.body||{}; if(!rfqId)return res.status(400).json({ok:false,error:"RFQ ID is required."});
 try{
  const current=await getRfq(String(rfqId));
  if(!current)return res.status(404).json({ok:false,error:"RFQ not found."});
  if(current.status!=="PENDING_APPROVAL")return res.status(400).json({ok:false,error:"RFQ must be PENDING_APPROVAL before quotation approval."});
  const quotation=await createQuotationFromRfq(String(rfqId));
  const rfq=await updateRfqStatus(String(rfqId),"QUOTED","admin");
  return res.status(200).json({ok:true,rfq,quotation});
 }catch(e){console.error("Quotation approval error",e);return res.status(500).json({ok:false,error:"Unable to approve quotation."})}
}