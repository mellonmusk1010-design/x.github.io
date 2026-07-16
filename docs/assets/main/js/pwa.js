/**
 * PWA register + optional install prompt
 */
(() => {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    // Relative URLs are essential on project Pages sites: / is the GitHub
    // domain root, while this app lives at /<repository>/.
    navigator.serviceWorker.register("sw.js", { scope: "./" }).catch((err) => {
      console.warn("SW register failed", err);
    });
  });

  let deferred;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e;
    const btn = document.getElementById("pwa-install");
    if (btn) {
      btn.hidden = false;
      btn.addEventListener(
        "click",
        async () => {
          if (!deferred) return;
          deferred.prompt();
          await deferred.userChoice;
          deferred = null;
          btn.hidden = true;
        },
        { once: true }
      );
    }
  });
})();
