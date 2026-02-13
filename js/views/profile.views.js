import { supabase } from "../core/supabase.js"
import { toast } from "../ui/toast.js"

export async function loadProfile() {

  const { data:{ user }} =
    await supabase.auth.getUser()

  if (!user)
    location.href = "index.html"

  const { data } =
    await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single()

  if (data)
    profileName.value = data.nome
}

export async function updateProfile() {

  const nome = profileName.value

  const { data:{ user }} =
    await supabase.auth.getUser()

  const { error } =
    await supabase
      .from("profiles")
      .update({ nome })
      .eq("id", user.id)

  if(error){
    toast(error.message)
  }else{
    toast("Perfil atualizado!")
  }
}
