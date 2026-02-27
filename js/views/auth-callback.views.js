import { supabase }
from "../core/supabase.js";
import { redirect } from "../core/base-path.js";

/* =========================
   AUTH CALLBACK VIEW
========================= */

export function init(){
 validateSession();
}

async function validateSession(){

 try{

  const {
   data:{ session }
  } = await supabase
   .auth
   .getSession();

  if(session){
   redirect("/dashboard.html");
  }else{
   redirect("/index.html");
  }

 }catch(err){

  console.error(
   "[AUTH CALLBACK]",
   err
  );

  redirect("/index.html");
 }
}

/* auto init (fora do SPA) */
init();
