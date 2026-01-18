import { apiInitializer } from "discourse/lib/api";
import ExternalLinkConfirm from "../components/modal/external-link-confirm";
import { i18n } from "discourse-i18n";

export default apiInitializer((api) => {
  const currentUser = api.container.lookup("service:current-user");
  const modal = api.container.lookup("service:modal");

  const safeSplit = (str) => (str || "").split("|").filter(Boolean);

  const matchesDomain = (url, domainString) => {
    if (!url) return false;
    const u = url.toLowerCase();
    return safeSplit(domainString).some(d => u.includes(d.trim().toLowerCase()));
  };

  // 内部链接判定
  const isInternal = (link) => {
    try {
      const href = link.getAttribute("href");
      if (!href || href.startsWith("#")) return true; // 锚点视为内部
      // 注意：相对路径 /foo 也是内部，但我们需要让它走下面的逻辑去加 _blank
      if (href.startsWith("/")) return true; 
      
      if (link.href.includes(window.location.hostname)) return true;
      if (matchesDomain(link.href, settings.internal_domains)) return true;
    } catch(e) { return false; }
    return false;
  };

  const openModal = (e, url, level) => {
    e.preventDefault();
    e.stopPropagation();
    modal.show(ExternalLinkConfirm, {
      model: {
        url: url,
        securityLevel: level,
        openInNewTab: true // 强制弹窗内的链接也新标签页
      }
    });
  };

  api.decorateCookedElement((element) => {
    if (!element) return;

    try {
      const links = element.querySelectorAll("a[href]");
      
      links.forEach(link => {
        // 排除干扰项
        if (
          link.classList.contains("mention") || 
          link.classList.contains("lightbox") || 
          link.classList.contains("attachment") || 
          link.classList.contains("onebox")
        ) return;

        const url = link.href;

        // --- 1. 屏蔽域名 (Blocked) ---
        if (matchesDomain(url, settings.blocked_domains)) {
          const span = document.createElement("span");
          span.classList.add("blocked-link"); 
          span.innerText = `[${i18n(themePrefix("secure_links.blocked_text"))}]`;
          link.replaceWith(span);
          return;
        }

        // --- 2. 内部域名 (Internal) ---
        if (isInternal(link)) {
          // 🌟 需求实现：内部域名也要新标签页打开
          link.setAttribute("target", "_blank");
          link.setAttribute("rel", "noopener noreferrer");
          return; // 不弹窗，直接放行
        }

        // --- 3. 受信任域名 (Trusted) ---
        if (matchesDomain(url, settings.excluded_domains)) {
          // 强制新标签页
          link.setAttribute("target", "_blank");
          link.setAttribute("rel", "noopener noreferrer");
          return; // CSS 会加绿锁，不弹窗
        }

        // --- 4. 判定等级 ---
        let level = "normal";
        if (matchesDomain(url, settings.dangerous_domains)) level = "dangerous";
        else if (matchesDomain(url, settings.risky_domains)) level = "risky";
        
        link.dataset.securityLevel = level;

        // --- 5. 登录/权限拦截 ---
        if (!currentUser && settings.enable_anonymous_blocking) {
          const newLink = document.createElement("a");
          newLink.href = settings.anonymous_redirect_url || "/login";
          newLink.className = "restricted-link-login"; 
          newLink.innerText = i18n(themePrefix("secure_links.login_to_view"));
          link.replaceWith(newLink);
          return;
        }

        if (currentUser && currentUser.trust_level === 0 && settings.enable_tl0_blocking) {
          const newLink = document.createElement("a");
          newLink.href = settings.tl0_redirect_url || "#";
          newLink.className = "restricted-link-tl0";
          newLink.innerText = i18n(themePrefix("secure_links.first_trust_level_to_view"));
          link.replaceWith(newLink);
          return;
        }

        // --- 6. 强制新标签页 (对剩下的外链) ---
        link.setAttribute("target", "_blank");
        link.setAttribute("rel", "noopener noreferrer");

        // --- 7. TL1 手动查看 ---
        if (currentUser && currentUser.trust_level === 1 && settings.enable_tl1_manual_reveal) {
          const button = document.createElement("a");
          button.href = "javascript:void(0)";
          button.innerText = i18n(themePrefix("secure_links.click_to_view"));
          button.className = "secure-links-reveal";
          button.addEventListener("click", (e) => {
            e.preventDefault();
            const realLink = document.createElement("a");
            realLink.href = url;
            realLink.setAttribute("target", "_blank"); // 恢复后也要新标签
            realLink.innerHTML = link.innerHTML;
            realLink.dataset.securityLevel = level;
            realLink.addEventListener("click", (ev) => openModal(ev, url, level));
            button.replaceWith(realLink);
          });
          link.replaceWith(button);
          return;
        }

        // --- 8. 绑定弹窗 ---
        if (level === "normal" && !settings.enable_exit_confirmation) return;

        link.addEventListener("click", (e) => openModal(e, url, level));
      });

    } catch (e) {
      console.error("[Link Shield] Error:", e);
    }
  }, { id: "secure-link-shield", onlyStream: true });
});
