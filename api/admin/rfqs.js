const DEMO_MODE = true;
const demoRfqs = [];
export default async function handler(req,res){
  if(req.method!=="GET") return res.status(405).json({ok:false,error:"Method not allowed"});
  if(DEMO_MODE) return res.status(200).json({ok:true,rfqs:demoRfqs});
  return res.status(401).json({ok:false,error:"Admin authentication is not configured yet."});
}
