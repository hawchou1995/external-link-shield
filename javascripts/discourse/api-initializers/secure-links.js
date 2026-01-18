import { apiInitializer } from "discourse/lib/api";
import ExternalLinkConfirm from "../components/modal/external-link-confirm";
import { i18n } from "discourse-i18n";

export default apiInitializer((api) => {
  const currentUser = api.container.lookup("service:current-user");
  const modal = api.container.lookup("service:modal");

  // 辅助函数：匹配域名
  const matchesDomain = (url, domainString) => {
    if (!domainString || !url) return false;
    const cleanUrl = url.replace(/^https?:\/\//, "");
    const domains = domainString.split("|").filter(d => d.trim());
    return domains.some(d => cleanUrl.includes(d.trim()));
  };

  // 辅助函数：判断是否为内部链接
  const isInternal = (link) => {
    const url = link.href;
    if (url.startsWith("/") || url.startsWith("#")) return true;
    if (url.includes(window.location.hostname)) return true;
    if (matchesDomain(url, settings.internal_domains)) return true;
    return false;
  };

  // 辅助函数：绑定弹窗事件（抽取出来以便 TL1 逻辑复用）
  const attachConfirmModal = (element, url, securityLevel) => {
    // 如果全局开关关闭且不是风险/危险链接，则不绑定
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
        if (
          link.classList.contains("mention") || 
          link.classList.contains("hashtag") || 
          link.classList.contains("lightbox") ||
          link.classList.contains("attachment")
        ) {
          return;
        }

        const url = link.href;
        let securityLevel = "normal";

        // ==========================================
        // 第一步：确定安全等级 (Security Classification)
        // ==========================================
        
        // 1. Blocked (屏蔽) - 最高优先级，直接替换
        if (matchesDomain(url, settings.blocked_domains)) {
          const span = document.createElement("span");
          span.classList.add("blocked-link");
          span.innerText = `[${i18n(themePrefix("secure_links.blocked_text"))}]`;
          span.title = url;
          link.replaceWith(span);
          return; 
        }

        // 2. Internal (内部) - 直接放行
        if (isInternal(link)) {
          return; 
        }

        // 3. Trusted (受信任) - 标记并放行 (不走权限检查，也不弹窗)
        if (matchesDomain(url, settings.excluded_domains)) {
          // Trusted 域名通常也希望跳过“未登录拦截”等逻辑，所以直接 return
          return; 
        }

        // 4. 其他分级
        if (matchesDomain(url, settings.dangerous_domains)) {
          securityLevel = "dangerous";
        } else if (matchesDomain(url, settings.risky_domains)) {
          securityLevel = "risky";
        }

        // 标记 dataset 用于 CSS 图标渲染
        link.dataset.securityLevel = securityLevel;


        // ==========================================
        // 第二步：用户权限检查 (User Permission Checks)
        // ==========================================

        // 1. 匿名用户拦截 (Anonymous Blocking)
        if (!currentUser && settings.enable_anonymous_blocking) {
          const loginLink = document.createElement("a");
          loginLink.href = settings.anonymous_redirect_url || "/login";
          loginLink.innerText = i18n(themePrefix("secure_links.login_to_view"));
          loginLink.classList.add("restricted-link-login"); // 可选：用于CSS样式
          link.replaceWith(loginLink);
          return;
        }

        // 如果用户已登录，获取信任等级
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

        // 3. TL1 用户需手动点击 (Manual Reveal)
        if (trustLevel === 1 && settings.enable_tl1_manual_reveal) {
          const button = document.createElement("a");
          button.href = "#";
          button.innerText = i18n(themePrefix("secure_links.click_to_view"));
          button.classList.add("secure-links-reveal"); // 对应你提供的图片样式
          
          // 保持原有的 CSS 图标逻辑（虽然此时是按钮，但我们可能希望它看起来像链接）
          button.dataset.securityLevel = securityLevel; 

          button.addEventListener("click", (e) => {
            e.preventDefault();
            
            // 恢复原始链接
            const realLink = document.createElement("a");
            realLink.href = url;
            realLink.innerText = url; // 或者保持原有 link.innerText，但在 decorateCookedElement 里获取 innerText 比较安全
            // 如果想保留原链接的文字/HTML内容，需要一开始就 cloneNode，这里简化为显示 URL 或原文本
            // 为了最佳体验，我们尝试保留原有的 innerHTML:
            realLink.innerHTML = link.innerHTML; 
            realLink.dataset.securityLevel = securityLevel;
            
            // 重新绑定弹窗事件
            attachConfirmModal(realLink, url, securityLevel);
            
            button.replaceWith(realLink);
          });

          link.replaceWith(button);
          return;
        }

        // ==========================================
        // 第三步：绑定交互事件 (Interaction)
        // ==========================================
        // TL2+ 用户或未开启限制的情况
        attachConfirmModal(link, url, securityLevel);
      });
    },
    { id: "secure-link-shield", onlyStream: true }
  );
});
