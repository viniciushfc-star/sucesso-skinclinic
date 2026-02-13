let container;

function createContainer(){

 if(container) return;

 container = document.createElement("div");
 container.id = "toast-container";
 document.body.append(container);
}

export function toast(
 msg,
 type="info",
 time=3000
){

 createContainer();

 const t = document.createElement("div");
 t.className = `toast toast-${type}`;

 const icons = {
  success:"✔",
  error:"✖",
  info:"ℹ"
 };

 t.innerHTML = `
  <span class="toast-icon">
   ${icons[type] || "ℹ"}
  </span>
  <span>${msg}</span>
 `;

 container.append(t);

 setTimeout(()=>{
  t.classList.add("show");
 },50);

 setTimeout(()=>{
  t.classList.remove("show");
  setTimeout(()=>t.remove(),300);
 }, time);
}
