let loader;

export function showLoader() {

 if(!loader){
  loader = document.createElement("div");
  loader.id = "globalLoader";
  loader.innerHTML = `
   <div class="spinner"></div>
  `;
  document.body.appendChild(loader);
 }

 loader.classList.remove("hidden");
}

export function hideLoader(){
 if(loader)
  loader.classList.add("hidden");
}
