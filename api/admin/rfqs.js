import { listRfqs } from "../../lib/supabase.js";

export default async function handler(req,res){
  if(req.method!=="GET") return res.status(405).json({ok:false,error:"Method not allowed"});
  try {
    const status=String(req.query?.status||"").trim();
    const rfqs=await listRfqs(status);
    return res.status(200).json({ok:true,rfqs});
  } catch(e) {
    console.error("RFQ list error",e);
    return res.status(500).json({ok:false,error:"Unable to load RFQs."});
  }
}
