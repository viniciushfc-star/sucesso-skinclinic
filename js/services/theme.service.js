export function toggleTheme() {
  document.body.classList.toggle("dark")
  localStorage.setItem("theme", document.body.classList.contains("dark"))
}

export function loadTheme() {
  const dark = localStorage.getItem("theme")
  if (dark === "true") document.body.classList.add("dark")
}
