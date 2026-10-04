import { getCustomerContext } from "../../lib/customer-auth.js";
export default async function handler(req,res){
 if(req.method!=="GET")return res.status(405).json({ok:false,error:"Method not allowed"});
 try{const ctx=await getCustomerContext(req,{requireActive:false});if(!ctx)return res.status(401).json({ok:false,error:"Authentication required."});return res.status(200).json({ok:true,user:{id:ctx.user.id,email:ctx.user.email},profile:ctx.profile,company:ctx.company,active:!ctx.inactive});}
 catch(e){console.error("Customer me error",e);return res.status(500).json({ok:false,error:"Unable to load customer profile."})}
}