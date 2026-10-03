import { getRfq } from "../../lib/supabase.js";
export default async function handler(req,res){
 if(req.method!=="GET") return res.status(405).json({ok:false,error:"Method not allowed"});
 const rfqId=String(req.query?.id||"").trim(); if(!rfqId)return res.status(400).json({ok:false,error:"RFQ ID is required."});
 try{const rfq=await getRfq(rfqId);if(!rfq)return res.status(404).json({ok:false,error:"RFQ not found."});return res.status(200).json({ok:true,rfq})}
 catch(e){console.error("RFQ detail error",e);return res.status(500).json({ok:false,error:"Unable to load RFQ."})}
}