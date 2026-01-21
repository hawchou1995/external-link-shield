import { apiInitializer } from "discourse/lib/api";
import ExternalLinkConfirm from "../components/modal/external-link-confirm";
import { i18n } from "discourse-i18n";

export default apiInitializer((api) => {
  const currentUser = api.container.lookup("service:current-user");
  const modal = api.container.lookup("service:modal");

  const safeSplit = (str) => (str || "").split("|").filter(Boolean);

  // 🔧 工具函数：提取纯净域名
  const getHostnameFromConfig = (entry) => {
    let d = entry.trim().toLowerCase();
    try {
      const urlObj = new URL(d.startsWith('http') ? d : `http://${d}`);
      return urlObj.hostname.replace(/^www\./, '');
    } catch (e) {
      return d
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .split('/')[0]
        .split('?')[0];
    }
  };

  // ⚡️⚡️ 极致优化：预先计算所有列表 (只执行一次) ⚡️⚡️
  // 避免在遍历成百上千个链接时重复解析配置字符串
  const BLOCKED_LIST = safeSplit(settings.blocked_domains).map(getHostnameFromConfig);
  const INTERNAL_LIST = safeSplit(settings.internal_domains).map(getHostnameFromConfig);
  const TRUSTED_LIST = safeSplit(settings.excluded_domains).map(getHostnameFromConfig);
  const DANGEROUS_LIST = safeSplit(settings.dangerous_domains).map(getHostnameFromConfig);
  const RISKY_LIST = safeSplit(settings.risky_domains).map(getHostnameFromConfig);

  // 🔄 优化后的匹配函数：直接使用预处理好的 domainList 数组
  const matchesDomain = (urlStr, domainList) => {
    if (!urlStr) return false;
    try {
      const urlObj = new URL(urlStr); 
      const linkHostname = urlObj.hostname.toLowerCase().replace(/^www\./, '');
      
      // 直接在缓存的列表中查找
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
      // ⚡️ 使用缓存列表
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

        // --- 1. 屏蔽 (Blocked) ⚡️ 使用缓存列表 ---
        if (matchesDomain(url, BLOCKED_LIST)) {
          const span = document.createElement("span");
          span.classList.add("blocked-link"); 
          span.innerText = `[${i18n(themePrefix("secure_links.blocked_text"))}]`;
          link.replaceWith(span);
          return;
        }

        // --- 2. 内部 (Internal) ---
        if (isInternal(link)) {
          link.dataset.securityLevel = "internal"; 
          link.setAttribute("target", "_blank");
          link.setAttribute("rel", "noopener noreferrer");
          return;
        }

        // --- 3. 受信 (Trusted) ⚡️ 使用缓存列表 ---
        if (matchesDomain(url, TRUSTED_LIST)) {
          link.dataset.securityLevel = "trusted"; 
          link.setAttribute("target", "_blank");
          link.setAttribute("rel", "noopener noreferrer");
          return; 
        }

        // --- 4. 判定等级 ⚡️ 使用缓存列表 ---
        let level = "normal";
        if (matchesDomain(url, DANGEROUS_LIST)) level = "dangerous";
        else if (matchesDomain(url, RISKY_LIST)) level = "risky";
        
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

        // --- 6. 强制新标签页 ---
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
            realLink.setAttribute("target", "_blank"); 
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
