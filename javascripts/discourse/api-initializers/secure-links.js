import { apiInitializer } from "discourse/lib/api";
import ExternalLinkConfirm from "../components/modal/external-link-confirm";
import { i18n } from "discourse-i18n";

export default apiInitializer((api) => {
  const currentUser = api.container.lookup("service:current-user");
  const modal = api.container.lookup("service:modal");

  const safeSplit = (str) => (str || "").split("|").filter(Boolean);

  const getHostnameFromConfig = (entry) => {
    let d = entry.trim().toLowerCase();
    try {
      const urlObj = new URL(d.startsWith('http') ? d : `http://${d}`);
      return urlObj.hostname.replace(/^www\./, '');
    } catch (e) {
      return d.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].split('?')[0];
    }
  };

  const BLOCKED_LIST = safeSplit(settings.blocked_domains).map(getHostnameFromConfig);
  const INTERNAL_LIST = safeSplit(settings.internal_domains).map(getHostnameFromConfig);
  const TRUSTED_LIST = safeSplit(settings.excluded_domains).map(getHostnameFromConfig);
  const DANGEROUS_LIST = safeSplit(settings.dangerous_domains).map(getHostnameFromConfig);
  const RISKY_LIST = safeSplit(settings.risky_domains).map(getHostnameFromConfig);

  const matchesDomain = (urlStr, domainList) => {
    if (!urlStr) return false;
    try {
      const urlObj = new URL(urlStr); 
      const linkHostname = urlObj.hostname.toLowerCase().replace(/^www\./, '');
      return domainList.some(configHostname => {
        return linkHostname === configHostname || linkHostname.endsWith("." + configHostname);
      });
    } catch (e) {
      return false; 
    }
  };

  const isInternal = (link) => {
    try {
      const href = link.getAttribute("href");
      if (!href || href.startsWith("#")) return true; 
      if (href.startsWith("/")) return true; 
      if (link.href.includes(window.location.hostname)) return true;
      if (matchesDomain(link.href, INTERNAL_LIST)) return true;
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
        openInNewTab: settings.external_links_in_new_tab
      }
    });
  };

  // 💥 终极修复：全局事件委托 (Event Delegation) 💥
  // 无论 DOM 怎么被其他插件(如登录可见插件)重写，只要带有 data-security-level 属性，点击事件就绝不会丢失！
  if (!window._secureLinksDelegated) {
    document.body.addEventListener("click", (e) => {
      const link = e.target.closest("a[data-security-level]");
      if (!link) return;

      const level = link.dataset.securityLevel;
      
      // 受信或内部链接，直接放行
      if (level === "internal" || level === "trusted") return;
      // 普通链接且未开启弹窗，直接放行
      if (level === "normal" && !settings.enable_exit_confirmation) return;

      // 拦截并弹窗
      openModal(e, link.href, level);
    });
    window._secureLinksDelegated = true;
  }

  api.decorateCookedElement((element) => {
    if (!element) return;

    try {
      const links = element.querySelectorAll("a[href]");
      
      links.forEach(link => {
        if (
          link.classList.contains("mention") || 
          link.classList.contains("lightbox") || 
          link.classList.contains("attachment") || 
          link.classList.contains("onebox")
        ) return;

        const url = link.href;

        if (matchesDomain(url, BLOCKED_LIST)) {
          const span = document.createElement("span");
          span.classList.add("blocked-link"); 
          span.innerText = `[${i18n(themePrefix("secure_links.blocked_text"))}]`;
          link.replaceWith(span);
          return;
        }

        if (isInternal(link)) {
          link.dataset.securityLevel = "internal"; 
          link.setAttribute("target", "_blank");
          link.setAttribute("rel", "noopener noreferrer");
          return;
        }

        if (matchesDomain(url, TRUSTED_LIST)) {
          link.dataset.securityLevel = "trusted"; 
          link.setAttribute("target", "_blank");
          link.setAttribute("rel", "noopener noreferrer");
          return; 
        }

        let level = "normal";
        if (matchesDomain(url, DANGEROUS_LIST)) level = "dangerous";
        else if (matchesDomain(url, RISKY_LIST)) level = "risky";
        
        link.dataset.securityLevel = level;

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

        link.setAttribute("target", "_blank");
        link.setAttribute("rel", "noopener noreferrer");

        // TL1 手动显示逻辑
        if (currentUser && currentUser.trust_level === 1 && settings.enable_tl1_manual_reveal) {
          const button = document.createElement("a");
          button.href = "javascript:void(0)";
          button.innerText = i18n(themePrefix("secure_links.click_to_view"));
          button.className = "secure-links-reveal";
          button.addEventListener("click", (e) => {
            e.preventDefault();
            const realLink = document.createElement("a");
            realLink.href = url;
            realLink.setAttribute("target", "_blank"); 
            realLink.innerHTML = link.innerHTML;
            realLink.dataset.securityLevel = level; 
            
            // 手动展开的链接也接入事件系统
            realLink.addEventListener("click", (ev) => {
               if (level === "internal" || level === "trusted") return;
               if (level === "normal" && !settings.enable_exit_confirmation) return;
               openModal(ev, url, level);
            });
            
            button.replaceWith(realLink);
          });
          link.replaceWith(button);
          return;
        }
        
      });

    } catch (e) {
      console.error("[Link Shield] Error:", e);
    }
  }, { id: "secure-link-shield", onlyStream: true });
});
