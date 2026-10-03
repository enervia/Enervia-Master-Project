import { updateRfqStatus } from "../../lib/supabase.js";
export default async function handler(req,res){
 if(req.method!=="POST")return res.status(405).json({ok:false,error:"Method not allowed"});
 const {rfqId}=req.body||{}; if(!rfqId)return res.status(400).json({ok:false,error:"RFQ ID is required."});
 try{
  const rfq=await updateRfqStatus(String(rfqId),"QUOTED","admin");
  if(!rfq)return res.status(404).json({ok:false,error:"RFQ not found."});
  return res.status(200).json({ok:true,rfq});
 }catch(e){console.error("Quotation approval error",e);return res.status(500).json({ok:false,error:"Unable to approve quotation."})}
}