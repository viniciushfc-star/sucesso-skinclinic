(function () {
  function show(msg) {
    var el = document.getElementById("bootError");
    if (!el) {
      el = document.createElement("p");
      el.id = "bootError";
      el.setAttribute("role", "alert");
      el.style.cssText = "color:#b91c1c;background:#fef2f2;padding:12px 16px;margin:0;font:14px/1.4 sans-serif;";
      if (document.body) document.body.insertBefore(el, document.body.firstChild);
      else document.addEventListener("DOMContentLoaded", function () {
        document.body.insertBefore(el, document.body.firstChild);
      });
    }
    el.textContent = msg;
  }
  function looksLikeBootFailure(msg) {
    return /does not provide an export|Failed to resolve|Failed to fetch dynamically imported|Unexpected token|SyntaxError/i.test(String(msg || ""));
  }
  window.addEventListener("error", function (e) {
    var m = (e && e.message) || "";
    if (looksLikeBootFailure(m)) {
      show("Esta tela falhou ao carregar. Dê Ctrl+F5. Se continuar, o código no ar está incompleto. Detalhe: " + m);
    }
  });
  window.addEventListener("unhandledrejection", function (e) {
    var r = e && e.reason;
    var m = (r && r.message) || String(r || "");
    if (looksLikeBootFailure(m)) {
      show("Falha ao carregar um módulo. Recarregue a página. Detalhe: " + m);
    }
  });
})();
