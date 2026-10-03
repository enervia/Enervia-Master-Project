const COOKIE="enervia_admin";
function b64decode(value){try{return JSON.parse(atob(value.replace(/-/g,"+").replace(/_/g,"/").padEnd(Math.ceil(value.length/4)*4,"=")))}catch{return null}}
function hexToBytes(hex){const out=new Uint8Array(hex.length/2);for(let i=0;i<out.length;i++)out[i]=parseInt(hex.slice(i*2,i*2+2),16);return out}
function base64urlToBytes(value){const b64=value.replace(/-/g,"+").replace(/_/g,"/").padEnd(Math.ceil(value.length/4)*4,"=");const raw=atob(b64);const out=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);return out}
async function validToken(token,secret){
 const parts=token.split(".");if(parts.length!==2)return false;
 const payload=b64decode(parts[0]);if(!payload||!payload.exp||payload.exp<Math.floor(Date.now()/1000))return false;
 const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["verify"]);
 return await crypto.subtle.verify("HMAC",key,base64urlToBytes(parts[1]),new TextEncoder().encode(parts[0]));
}
export default async function middleware(req){
 const {pathname}=new URL(req.url);
 const login=pathname==="/b2b/login.html";
 const protectedPage=pathname.startsWith("/b2b/")||pathname.startsWith("/admin/");
 const protectedApi=pathname.startsWith("/api/admin/");
 if(!protectedPage&&!protectedApi)return;
 if(login)return;
 const cookie=req.headers.get("cookie")||"";
 const match=cookie.match(/(?:^|;\s*)enervia_admin=([^;]+)/);
 const secret=String(process.env.ADMIN_SESSION_SECRET||"");
 const ok=!!secret&&!!match&&await validToken(decodeURIComponent(match[1]),secret);
 if(ok)return;
 if(protectedApi)return new Response(JSON.stringify({ok:false,error:"Authentication required."}),{status:401,headers:{"content-type":"application/json"}});
 const next=encodeURIComponent(pathname+new URL(req.url).search);
 return Response.redirect(new URL("/b2b/login.html?next="+next,req.url));
}
export const config={matcher:["/b2b/:path*","/admin/:path*","/api/admin/:path*"]};
