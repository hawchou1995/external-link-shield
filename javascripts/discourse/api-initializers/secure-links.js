import { apiInitializer } from "discourse/lib/api";
import ExternalLinkConfirm from "../components/modal/external-link-confirm";
import { i18n } from "discourse-i18n";

export default apiInitializer((api) => {
  const currentUser = api.container.lookup("service:current-user");
  const modal = api.container.lookup("service:modal");

  const safeSplit = (str) => (str || "").split("|").filter(Boolean);

  // 🌟 核心升级：超级清洗函数
  // 不管配置填 "google.com" 还是 "https://google.com/foo"，都能提取出 "google.com"
  const getHostnameFromConfig = (entry) => {
    let d = entry.trim().toLowerCase();
    // 1. 尝试作为 URL 解析
    try {
      // 如果没有协议头，补一个方便解析
      const urlObj = new URL(d.startsWith('http') ? d : `http://${d}`);
      return urlObj.hostname.replace(/^www\./, '');
    } catch (e) {
      // 2. 如果解析失败，进行暴力清洗
      return d
        .replace(/^https?:\/\//, '') // 去掉协议
        .replace(/^www\./, '')       // 去掉 www
        .split('/')[0]               // 🔪 关键：砍掉路径
        .split('?')[0];              // 🔪 关键：砍掉参数
    }
  };

  const matchesDomain = (urlStr, domainString) => {
    if (!urlStr) return false;
    try {
      // 提取链接的 hostname
      const urlObj = new URL(urlStr); 
      const linkHostname = urlObj.hostname.toLowerCase().replace(/^www\./, '');
      
      const configDomains = safeSplit(domainString);
      
      return configDomains.some(entry => {
        const configHostname = getHostnameFromConfig(entry);
        // 匹配：完全相等 OR 是子域名 (例如 linkHostname="a.b.com", config="b.com")
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
      if (href.startsWith("/")) return true; // 相对路径也是内部
      
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

        // --- 1. 屏蔽 (Blocked) - 物理销毁 ---
        if (matchesDomain(url, settings.blocked_domains)) {
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

        // --- 3. 受信 (Trusted) - 优先于登录检查 ---
        if (matchesDomain(url, settings.excluded_domains)) {
          link.dataset.securityLevel = "trusted"; // 🌟 标记给 CSS
          link.setAttribute("target", "_blank");
          link.setAttribute("rel", "noopener noreferrer");
          // 直接 return，不进行后续的登录检查或弹窗绑定
          return; 
        }

        // --- 4. 判定等级 ---
        let level = "normal";
        if (matchesDomain(url, settings.dangerous_domains)) level = "dangerous";
        else if (matchesDomain(url, settings.risky_domains)) level = "risky";
        
        link.dataset.securityLevel = level;

        // --- 5. 登录/权限拦截 (只拦截 Normal/Risky/Dangerous) ---
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
