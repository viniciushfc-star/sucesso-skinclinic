import { supabase }
from "../core/supabase.js";

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
   window.location.href =
    "/dashboard.html";
  }else{
   window.location.href =
    "/index.html";
  }

 }catch(err){

  console.error(
   "[AUTH CALLBACK]",
   err
  );

  window.location.href =
   "/index.html";
 }
}

/* auto init (fora do SPA) */
init();
