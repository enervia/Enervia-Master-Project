import { getWipCounts } from "../../lib/supabase.js";
export default async function handler(req,res){
 if(req.method!=="GET")return res.status(405).json({ok:false,error:"Method not allowed"});
 try{return res.status(200).json({ok:true,counts:await getWipCounts()})}
 catch(e){console.error("WIP error",e);return res.status(500).json({ok:false,error:"Unable to load WIP data."})}
}