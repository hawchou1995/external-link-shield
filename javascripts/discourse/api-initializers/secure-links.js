import { apiInitializer } from "discourse/lib/api";
import ExternalLinkConfirm from "../components/modal/external-link-confirm";
import { i18n } from "discourse-i18n";

export default apiInitializer("0.11", (api) => {
  const currentUser = api.getCurrentUser();
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
      if (!href || href.startsWith("#") || href.startsWith("/")) return true; 
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

  // 全局事件捕获，哪怕内容被重写，弹窗拦截依然坚不可摧
  if (!window._secureLinksDelegated) {
    document.body.addEventListener("click", (e) => {
      const link = e.target.closest("a[data-security-level]");
      if (!link) return;

      const level = link.dataset.securityLevel;
      if (level === "internal" || level === "trusted") return;
      if (level === "normal" && !settings.enable_exit_confirmation) return;

      openModal(e, link.href, level);
    }, true);
    window._secureLinksDelegated = true;
  }

  // 这是给链接穿护盾的核心逻辑
  const applyShield = (element) => {
    if (!element) return;
    const links = element.querySelectorAll("a[href]");
    
    links.forEach(link => {
      if (
        link.classList.contains("mention") || 
        link.classList.contains("lightbox") || 
        link.classList.contains("attachment") || 
        link.classList.contains("onebox") ||
        link.hasAttribute("data-security-level") // 防止重复处理
      ) return;

      const url = link.href;

      if (matchesDomain(url, BLOCKED_LIST)) {
        const span = document.createElement("span");
        span.className = "blocked-link"; 
        span.innerText = `[${i18n(themePrefix("secure_links.blocked_text"))}]`;
        link.replaceWith(span);
        return;
      }

      if (isInternal(link)) {
        link.dataset.securityLevel = "internal"; 
        link.classList.add("internal-link");
        link.setAttribute("target", "_blank");
        link.setAttribute("rel", "noopener noreferrer");
        return;
      }

      if (matchesDomain(url, TRUSTED_LIST)) {
        link.dataset.securityLevel = "trusted"; 
        link.classList.add("trusted-link");
        link.setAttribute("target", "_blank");
        link.setAttribute("rel", "noopener noreferrer");
        return; 
      }

      let level = "normal";
      if (matchesDomain(url, DANGEROUS_LIST)) {
          level = "dangerous";
          link.classList.add("dangerous-link");
      } else if (matchesDomain(url, RISKY_LIST)) {
          level = "risky";
          link.classList.add("risky-link");
      } else {
          link.classList.add("external-link"); // 找回被抹去的外部链接图标标识！
      }
      
      link.dataset.securityLevel = level;
      link.setAttribute("target", "_blank");
      link.setAttribute("rel", "noopener noreferrer");

      if (!currentUser && settings.enable_anonymous_blocking) {
        const newLink = document.createElement("a");
        newLink.href = settings.anonymous_redirect_url || "/login";
        newLink.className = "restricted-link-login " + link.className; 
        newLink.innerText = i18n(themePrefix("secure_links.login_to_view"));
        link.replaceWith(newLink);
        return;
      }

      if (currentUser && currentUser.trust_level === 0 && settings.enable_tl0_blocking) {
        const newLink = document.createElement("a");
        newLink.href = settings.tl0_redirect_url || "#";
        newLink.className = "restricted-link-tl0 " + link.className;
        newLink.innerText = i18n(themePrefix("secure_links.first_trust_level_to_view"));
        link.replaceWith(newLink);
        return;
      }

      if (currentUser && currentUser.trust_level === 1 && settings.enable_tl1_manual_reveal) {
        const button = document.createElement("a");
        button.href = "javascript:void(0)";
        button.innerText = i18n(themePrefix("secure_links.click_to_view"));
        button.className = "secure-links-reveal " + link.className;
        button.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const realLink = document.createElement("a");
          realLink.href = url;
          realLink.setAttribute("target", "_blank"); 
          realLink.setAttribute("rel", "noopener noreferrer");
          realLink.innerHTML = link.innerHTML;
          realLink.dataset.securityLevel = level; 
          realLink.className = link.className; 
          button.replaceWith(realLink);
        });
        link.replaceWith(button);
        return;
      }
    });
  };

  // 正常页面渲染时触发
  api.decorateCookedElement(applyShield, { id: "secure-link-shield", onlyStream: true });
  
  // 监听自定义事件，专门为了配合后面的【隐藏插件】解锁内容后重新刷新图标！
  document.addEventListener("secureContentUnlocked", (e) => {
    applyShield(e.detail.element);
  });
});
