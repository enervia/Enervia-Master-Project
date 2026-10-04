import { insertCustomerCompany, insertCustomerProfile } from "../../lib/supabase-customer.js";
const PUBLISHABLE_KEY="sb_publishable_ycM2wXQ6fGdqUja3hiO6aw_ajU-7t-e";
export default async function handler(req,res){
 if(req.method!=="POST")return res.status(405).json({ok:false,error:"Method not allowed"});
 const {email,password,fullName,phone,company}=req.body||{};
 if(!email||!password||!fullName||!company?.legalName)return res.status(400).json({ok:false,error:"Name, email, password and company name are required."});
 if(String(password).length<8)return res.status(400).json({ok:false,error:"Password must be at least 8 characters."});
 try{
  const base=String(process.env.SUPABASE_URL||"").replace(/\/$/,"");
  const auth=await fetch(base+"/auth/v1/signup",{method:"POST",headers:{"Content-Type":"application/json",apikey:PUBLISHABLE_KEY},body:JSON.stringify({email:String(email).trim().toLowerCase(),password:String(password),data:{full_name:String(fullName).trim()}})});
  const a=await auth.json();
  if(!auth.ok||!a.user)return res.status(auth.status===422?409:400).json({ok:false,error:a.msg||a.error_description||"Registration could not be completed."});
  const created=await insertCustomerCompany({...company,email:String(email).trim().toLowerCase(),phone});
  await insertCustomerProfile({userId:a.user.id,companyId:created.id,fullName:String(fullName).trim(),phone,role:"OWNER"});
  return res.status(200).json({ok:true,needsEmailConfirmation:!a.session});
 }catch(e){console.error("Customer registration error",e);return res.status(500).json({ok:false,error:"Registration failed. Please try again."})}
}