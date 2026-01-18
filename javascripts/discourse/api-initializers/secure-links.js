import { apiInitializer } from "discourse/lib/api";
import ExternalLinkConfirm from "../components/modal/external-link-confirm";
import { i18n } from "discourse-i18n";

export default apiInitializer((api) => {
  const currentUser = api.container.lookup("service:current-user");
  const modal = api.container.lookup("service:modal");

  // 安全分割函数
  const safeSplit = (str) => {
    return (str || "").split("|").filter(d => d.trim());
  };

  const matchesDomain = (url, domainString) => {
    if (!url) return false;
    const domains = safeSplit(domainString);
    return domains.some(d => url.includes(d.trim()));
  };

  const isInternal = (link) => {
    try {
      const hrefAttr = link.getAttribute("href");
      if (hrefAttr && (hrefAttr.startsWith("/") || hrefAttr.startsWith("#"))) return true;
      const url = link.href;
      if (url.includes(window.location.hostname)) return true;
      if (matchesDomain(url, settings.internal_domains)) return true;
    } catch (e) { return false; }
    return false;
  };

  // 弹窗绑定逻辑
  const attachConfirmModal = (element, url, securityLevel) => {
    if (!settings.enable_exit_confirmation && securityLevel === "normal") return;

    // 移除旧监听器，防止重复
    if (element._secureLinkHandler) {
      element.removeEventListener("click", element._secureLinkHandler);
    }

    const handler = (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      modal.show(ExternalLinkConfirm, {
        model: {
          url: url,
          securityLevel: securityLevel,
          openInNewTab: settings.external_links_in_new_tab
        }
      });
      return false;
    };
    
    element._secureLinkHandler = handler;
    element.addEventListener("click", handler);
  };

  api.decorateCookedElement((element) => {
    if (!element) return;

    try {
      const links = element.querySelectorAll("a[href]");

      links.forEach((link) => {
        // 排除特殊类
        if (
          link.classList.contains("mention") || 
          link.classList.contains("hashtag") || 
          link.classList.contains("lightbox") ||
          link.classList.contains("attachment") ||
          link.classList.contains("anchor") || 
          link.classList.contains("onebox")
        ) return;

        const url = link.href;

        // 1. 屏蔽 (Blocked)
        if (matchesDomain(url, settings.blocked_domains)) {
          const span = document.createElement("span");
          span.classList.add("blocked-link");
          span.innerText = `[${i18n(themePrefix("secure_links.blocked_text"))}]`;
          span.title = url;
          link.replaceWith(span);
          return; // 结束处理
        }

        if (isInternal(link)) return;

        // 2. 判定等级
        let securityLevel = "normal";
        if (matchesDomain(url, settings.excluded_domains)) {
          // Trusted 链接不弹窗，直接放行
          return; 
        }
        
        if (matchesDomain(url, settings.dangerous_domains)) {
          securityLevel = "dangerous";
        } else if (matchesDomain(url, settings.risky_domains)) {
          securityLevel = "risky";
        }

        link.dataset.securityLevel = securityLevel;

        // 3. 用户权限拦截 (Anonymous / TL0)
        // 匿名
        if (!currentUser && settings.enable_anonymous_blocking) {
          const loginLink = document.createElement("a");
          loginLink.href = settings.anonymous_redirect_url || "/login";
          loginLink.innerText = i18n(themePrefix("secure_links.login_to_view"));
          loginLink.classList.add("restricted-link-login");
          link.replaceWith(loginLink);
          return;
        }

        const trustLevel = currentUser ? currentUser.trust_level : 0;

        // TL0
        if (trustLevel === 0 && settings.enable_tl0_blocking) {
          const tlLink = document.createElement("a");
          tlLink.href = settings.tl0_redirect_url || "#";
          tlLink.innerText = i18n(themePrefix("secure_links.first_trust_level_to_view"));
          tlLink.classList.add("restricted-link-tl0");
          link.replaceWith(tlLink);
          return;
        }

        // TL1 手动查看
        if (trustLevel === 1 && settings.enable_tl1_manual_reveal) {
          const button = document.createElement("a");
          button.href = "#";
          button.innerText = i18n(themePrefix("secure_links.click_to_view"));
          button.classList.add("secure-links-reveal");
          button.dataset.securityLevel = securityLevel; 

          button.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            const realLink = document.createElement("a");
            realLink.href = url;
            realLink.innerHTML = link.innerHTML;
            realLink.dataset.securityLevel = securityLevel;
            attachConfirmModal(realLink, url, securityLevel);
            button.replaceWith(realLink);
          });
          link.replaceWith(button);
          return;
        }

        // 4. 绑定弹窗
        attachConfirmModal(link, url, securityLevel);
      });
    } catch (e) {
      console.error("[Link Shield] Error:", e);
    }
  }, { id: "secure-link-shield", onlyStream: true });
});
