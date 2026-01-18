import { apiInitializer } from "discourse/lib/api";
import ExternalLinkConfirm from "../components/modal/external-link-confirm";
import { i18n } from "discourse-i18n";

export default apiInitializer((api) => {
  const currentUser = api.container.lookup("service:current-user");
  const modal = api.container.lookup("service:modal");

  // 辅助函数：匹配域名
  const matchesDomain = (url, domainString) => {
    if (!domainString || !url) return false;
    const domains = domainString.split("|").filter(d => d.trim());
    return domains.some(d => url.includes(d.trim()));
  };

  // 辅助函数：判断是否为内部链接
  const isInternal = (link) => {
    try {
      // 1. 显式检查 href 属性
      const hrefAttr = link.getAttribute("href");
      if (hrefAttr && (hrefAttr.startsWith("/") || hrefAttr.startsWith("#"))) {
        return true;
      }
      // 2. 检查完整 URL
      const url = link.href;
      if (url.includes(window.location.hostname)) return true;
      // 3. 检查设置中的内部域名
      if (matchesDomain(url, settings.internal_domains)) return true;
    } catch (e) {
      // 如果解析出错，默认视为外部链接以保安全
      return false;
    }
    return false;
  };

  const attachConfirmModal = (element, url, securityLevel) => {
    if (!settings.enable_exit_confirmation && securityLevel === "normal") {
      return;
    }
    
    // 移除旧的监听器（防止重复绑定）
    element.removeEventListener("click", element._secureLinkHandler);

    // 定义新的处理器
    const handler = (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation(); // 强制阻止其他事件

      modal.show(ExternalLinkConfirm, {
        model: {
          url: url,
          securityLevel: securityLevel,
          openInNewTab: settings.external_links_in_new_tab
        }
      });
      return false;
    };

    // 保存引用以便清理
    element._secureLinkHandler = handler;
    element.addEventListener("click", handler);
  };

  api.decorateCookedElement((element) => {
    if (!element) return;

    try {
      const links = element.querySelectorAll("a[href]");

      links.forEach((link) => {
        // 排除特殊元素
        if (
          link.classList.contains("mention") || 
          link.classList.contains("hashtag") || 
          link.classList.contains("lightbox") ||
          link.classList.contains("attachment") ||
          link.classList.contains("anchor") || 
          link.classList.contains("onebox")
        ) {
          return;
        }

        const url = link.href;
        
        // 1. 屏蔽域名 (Blocked) - 最高优先级
        if (matchesDomain(url, settings.blocked_domains)) {
          const span = document.createElement("span");
          span.classList.add("blocked-link");
          span.innerText = `[${i18n(themePrefix("secure_links.blocked_text"))}]`;
          span.title = url;
          // 直接替换 DOM，这样原有的 click 事件也没了
          link.replaceWith(span);
          return; 
        }

        if (isInternal(link)) {
          return; 
        }

        // 2. 安全等级判定
        let securityLevel = "normal";
        // 受信任
        if (matchesDomain(url, settings.excluded_domains)) {
          // Trusted 链接不弹窗，直接放行
          return; 
        }
        
        if (matchesDomain(url, settings.dangerous_domains)) {
          securityLevel = "dangerous";
        } else if (matchesDomain(url, settings.risky_domains)) {
          securityLevel = "risky";
        }

        // 标记 dataset 用于 CSS
        link.dataset.securityLevel = securityLevel;

        // 3. 用户权限检查
        // 匿名用户
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

        // TL1 点击查看
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
            realLink.innerHTML = link.innerHTML; // 恢复原文
            realLink.dataset.securityLevel = securityLevel;
            
            // 恢复后的链接也要绑定弹窗逻辑
            attachConfirmModal(realLink, url, securityLevel);
            
            button.replaceWith(realLink);
          });

          link.replaceWith(button);
          return;
        }

        // 4. 绑定弹窗 (Normal/Risky/Dangerous)
        attachConfirmModal(link, url, securityLevel);
      });
    } catch (err) {
      console.error("[External Link Shield] Error decorating links:", err);
    }
  },
  { id: "secure-link-shield", onlyStream: true }
  );
});
