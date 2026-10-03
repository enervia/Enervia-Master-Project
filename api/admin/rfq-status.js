import { updateRfqStatus } from "../../lib/supabase.js";

const allowed=["NEW","REVIEW","SOURCING","PRICING","PENDING_APPROVAL","QUOTED","CLOSED"];

export default async function handler(req,res){
  if(req.method!=="POST") return res.status(405).json({ok:false,error:"Method not allowed"});
  const {rfqId,status,changedBy}=req.body||{};
  if(!rfqId||!allowed.includes(status)) return res.status(400).json({ok:false,error:"Invalid RFQ status update."});
  try {
    const rfq=await updateRfqStatus(String(rfqId),status,String(changedBy||"admin"));
    if(!rfq) return res.status(404).json({ok:false,error:"RFQ not found."});
    return res.status(200).json({ok:true,rfq});
  } catch(e) {
    console.error("RFQ status update error",e);
    return res.status(500).json({ok:false,error:"Unable to update RFQ status."});
  }
}
