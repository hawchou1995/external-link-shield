import { apiInitializer } from "discourse/lib/api";
import ExternalLinkConfirm from "../components/modal/external-link-confirm";
import { i18n } from "discourse-i18n";

export default apiInitializer((api) => {
  const currentUser = api.container.lookup("service:current-user");
  const modal = api.container.lookup("service:modal");

  // 辅助函数：匹配域名
  // ✨ 修复：不再剥离 http/https，直接检查包含关系
  // 这样既支持 "google.com" (模糊)，也支持 "https://site.com/vpn" (精确)
  const matchesDomain = (url, domainString) => {
    if (!domainString || !url) return false;
    const domains = domainString.split("|").filter(d => d.trim());
    return domains.some(d => url.includes(d.trim()));
  };

  // 辅助函数：判断是否为内部链接
  const isInternal = (link) => {
    // 1. 显式检查 href 属性原始值（排除锚点）
    const hrefAttr = link.getAttribute("href");
    if (hrefAttr && (hrefAttr.startsWith("/") || hrefAttr.startsWith("#"))) {
      return true;
    }
    // 2. 检查完整 URL
    const url = link.href;
    if (url.includes(window.location.hostname)) return true;
    // 3. 检查设置中的内部域名
    if (matchesDomain(url, settings.internal_domains)) return true;
    
    return false;
  };

  // 辅助函数：绑定弹窗事件
  const attachConfirmModal = (element, url, securityLevel) => {
    if (!settings.enable_exit_confirmation && securityLevel === "normal") {
      return;
    }
    element.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      modal.show(ExternalLinkConfirm, {
        model: {
          url: url,
          securityLevel: securityLevel,
          openInNewTab: settings.external_links_in_new_tab
        }
      });
    });
  };

  api.decorateCookedElement((element) => {
      const links = element.querySelectorAll("a[href]");

      links.forEach((link) => {
        // 排除 Discourse 特殊元素
        if (
          link.classList.contains("mention") || 
          link.classList.contains("hashtag") || 
          link.classList.contains("lightbox") ||
          link.classList.contains("attachment") ||
          link.classList.contains("anchor") || // 排除标题锚点
          link.classList.contains("onebox")
        ) {
          return;
        }

        const hrefAttr = link.getAttribute("href");
        if (hrefAttr && (hrefAttr.startsWith("#") || hrefAttr.startsWith("mailto:"))) {
            return;
        }

        if (isInternal(link)) {
          return; 
        }

        const url = link.href;
        let securityLevel = "normal";

        // ==========================================
        // 第一步：确定安全等级
        // ==========================================
        
        // Blocked (屏蔽)
        if (matchesDomain(url, settings.blocked_domains)) {
          const span = document.createElement("span");
          span.classList.add("blocked-link");
          span.innerText = `[${i18n(themePrefix("secure_links.blocked_text"))}]`;
          span.title = url;
          link.replaceWith(span);
          return; 
        }

        // Trusted (受信任) - 优先处理，直接放行
        // ✨ 这里修复后，配置完整的 https URL 也能匹配成功，从而跳过下面的登录拦截
        if (matchesDomain(url, settings.excluded_domains)) {
          return; 
        }

        // 其他分级
        if (matchesDomain(url, settings.dangerous_domains)) {
          securityLevel = "dangerous";
        } else if (matchesDomain(url, settings.risky_domains)) {
          securityLevel = "risky";
        }

        link.dataset.securityLevel = securityLevel;

        // ==========================================
        // 第二步：用户权限检查 (拦截匿名/TL0)
        // ==========================================

        // 1. 匿名用户拦截
        if (!currentUser && settings.enable_anonymous_blocking) {
          const loginLink = document.createElement("a");
          loginLink.href = settings.anonymous_redirect_url || "/login";
          loginLink.innerText = i18n(themePrefix("secure_links.login_to_view"));
          loginLink.classList.add("restricted-link-login");
          link.replaceWith(loginLink);
          return;
        }

        const trustLevel = currentUser ? currentUser.trust_level : 0;

        // 2. TL0 用户拦截
        if (trustLevel === 0 && settings.enable_tl0_blocking) {
          const tlLink = document.createElement("a");
          tlLink.href = settings.tl0_redirect_url || "#";
          tlLink.innerText = i18n(themePrefix("secure_links.first_trust_level_to_view"));
          tlLink.classList.add("restricted-link-tl0");
          link.replaceWith(tlLink);
          return;
        }

        // 3. TL1 用户需手动点击
        if (trustLevel === 1 && settings.enable_tl1_manual_reveal) {
          const button = document.createElement("a");
          button.href = "#";
          button.innerText = i18n(themePrefix("secure_links.click_to_view"));
          button.classList.add("secure-links-reveal");
          button.dataset.securityLevel = securityLevel; 

          button.addEventListener("click", (e) => {
            e.preventDefault();
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

        // ==========================================
        // 第三步：绑定交互事件
        // ==========================================
        attachConfirmModal(link, url, securityLevel);
      });
    },
    { id: "secure-link-shield", onlyStream: true }
  );
});
