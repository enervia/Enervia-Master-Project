const DEMO_MODE = true;
const allowed=["NEW","REVIEW","SOURCING","PRICING","PENDING_APPROVAL","QUOTED","CLOSED"];
export default async function handler(req,res){
  if(req.method!=="POST") return res.status(405).json({ok:false,error:"Method not allowed"});
  const {rfqId,status}=req.body||{};
  if(!rfqId||!allowed.includes(status)) return res.status(400).json({ok:false,error:"Invalid RFQ status update."});
  if(DEMO_MODE) return res.status(501).json({ok:false,error:"RFQ persistence is not connected yet."});
  return res.status(401).json({ok:false,error:"Admin authentication is not configured yet."});
}
