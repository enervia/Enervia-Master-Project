import * as h from "../../lib/customer-handlers.js";
export default async function handler(req,res){
 const path=new URL(req.url,"https://enervia.local").pathname.replace(/^\/api\/customer\/?/,"").replace(/\/$/,"");
 const routes={me:h.me,register:h.register,"complete-registration":h.completeRegistration,rfqs:h.rfqs,"quotation-decision":h.quotationDecision};
 const fn=routes[path];
 if(!fn)return res.status(404).json({ok:false,error:"Customer API route not found."});
 return fn(req,res);
}
