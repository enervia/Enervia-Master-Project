export default async function handler(req,res){
 if(req.method!=="POST") return res.status(405).json({ok:false,error:"Method not allowed"});
 res.setHeader("Set-Cookie","enervia_admin=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict");
 return res.status(200).json({ok:true});
}
