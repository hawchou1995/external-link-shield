import { apiInitializer } from "discourse/lib/api";
import ExternalLinkConfirm from "../components/modal/external-link-confirm";
import { i18n } from "discourse-i18n";

export default apiInitializer((api) => {
  const currentUser = api.container.lookup("service:current-user");
  const modal = api.container.lookup("service:modal");

  const safeSplit = (str) => (str || "").split("|").filter(Boolean);

  // 🌟 核心修复：基于 Hostname 的精准匹配
  const matchesDomain = (urlStr, domainString) => {
    if (!urlStr) return false;
    try {
      // 提取 hostname (例如 www.reddit.com)
      // 如果是相对路径，new URL 会报错，catch 块会处理
      const urlObj = new URL(urlStr); 
      const hostname = urlObj.hostname.toLowerCase();
      
      const configDomains = safeSplit(domainString);
      
      return configDomains.some(d => {
        const configD = d.trim().toLowerCase();
        // 匹配完全相等，或者以 .domain 结尾 (子域名)
        return hostname === configD || hostname.endsWith("." + configD);
      });
    } catch (e) {
      // 如果不是有效 URL (例如相对路径)，尝试用简单字符串匹配作为兜底
      return safeSplit(domainString).some(d => urlStr.toLowerCase().includes(d.trim().toLowerCase()));
    }
  };

  const isInternal = (link) => {
    try {
      const href = link.getAttribute("href");
      if (!href || href.startsWith("/") || href.startsWith("#")) return true;
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

        // --- 1. 屏蔽 (Blocked) ---
        if (matchesDomain(url, settings.blocked_domains)) {
          const span = document.createElement("span");
          span.classList.add("blocked-link"); 
          span.innerText = `[${i18n(themePrefix("secure_links.blocked_text"))}]`;
          link.replaceWith(span);
          return;
        }

        // --- 2. 内部 (Internal) ---
        if (isInternal(link)) {
          link.dataset.securityLevel = "internal"; // 标记为内部，CSS隐藏图标
          link.setAttribute("target", "_blank");
          link.setAttribute("rel", "noopener noreferrer");
          return;
        }

        // --- 3. 受信 (Trusted) ---
        if (matchesDomain(url, settings.excluded_domains)) {
          link.dataset.securityLevel = "trusted"; // 🌟 标记为信任，CSS显示绿锁
          link.setAttribute("target", "_blank");
          link.setAttribute("rel", "noopener noreferrer");
          return; // 直接放行
        }

        // --- 4. 判定等级 ---
        let level = "normal";
        if (matchesDomain(url, settings.dangerous_domains)) level = "dangerous";
        else if (matchesDomain(url, settings.risky_domains)) level = "risky";
        
        // 🌟 核心：把算出来的 level 赋给 dataset，CSS 靠这个变色
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
            realLink.dataset.securityLevel = level; // 恢复时也要打标
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
