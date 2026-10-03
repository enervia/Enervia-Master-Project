import { updateRfqPricing } from "../../lib/supabase.js";
export default async function handler(req,res){
 if(req.method!=="POST")return res.status(405).json({ok:false,error:"Method not allowed"});
 const {rfqId,defaultMarkupPercent,items}=req.body||{};
 if(!rfqId)return res.status(400).json({ok:false,error:"RFQ ID is required."});
 const markup=Number(defaultMarkupPercent);
 if(!Number.isFinite(markup)||markup<0||markup>1000)return res.status(400).json({ok:false,error:"Invalid markup percent."});
 try{
  const rfq=await updateRfqPricing(String(rfqId),markup,Array.isArray(items)?items:[]);
  if(!rfq)return res.status(404).json({ok:false,error:"RFQ not found."});
  return res.status(200).json({ok:true,rfq});
 }catch(e){console.error("RFQ pricing error",e);return res.status(500).json({ok:false,error:"Unable to update pricing."})}
}