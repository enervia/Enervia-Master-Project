import crypto from "crypto";

function b64(value){return Buffer.from(value).toString("base64url");}
function sign(value,secret){return crypto.createHmac("sha256",secret).update(value).digest("base64url");}
function readBody(req){return new Promise((resolve,reject)=>{let raw="";req.on("data",c=>{raw+=c;if(raw.length>10000) reject(new Error("Body too large"));});req.on("end",()=>{try{resolve(JSON.parse(raw||"{}"))}catch{resolve({})}});req.on("error",reject)})}

export default async function handler(req,res){
 if(req.method!=="POST") return res.status(405).json({ok:false,error:"Method not allowed"});
 const password=String(process.env.ADMIN_PASSWORD||"");
 const secret=String(process.env.ADMIN_SESSION_SECRET||"");
 if(!password||!secret) return res.status(503).json({ok:false,error:"Admin authentication is not configured yet."});
 try{
  const body=await readBody(req);
  const supplied=String(body.password||"");
  const a=Buffer.from(supplied),b=Buffer.from(password);
  if(a.length!==b.length||!crypto.timingSafeEqual(a,b)) return res.status(401).json({ok:false,error:"Invalid password."});
  const now=Math.floor(Date.now()/1000),payload=JSON.stringify({iat:now,exp:now+60*60*8});
  const encoded=b64(payload),token=encoded+"."+sign(encoded,secret);
  res.setHeader("Set-Cookie",`enervia_admin=${token}; Path=/; Max-Age=28800; HttpOnly; Secure; SameSite=Strict`);
  return res.status(200).json({ok:true});
 }catch(e){console.error("Admin login error",e);return res.status(400).json({ok:false,error:"Invalid login request."})}
}
