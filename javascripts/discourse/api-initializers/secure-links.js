import { apiInitializer } from "discourse/lib/api";
import ExternalLinkConfirm from "../components/modal/external-link-confirm";
import { i18n } from "discourse-i18n";

export default apiInitializer((api) => {
  const currentUser = api.container.lookup("service:current-user");
  const modal = api.container.lookup("service:modal");

  // 安全读取设置
  const safeSplit = (str) => (str || "").split("|").filter(Boolean);

  const matchesDomain = (url, domainString) => {
    if (!url) return false;
    // 简单检查字符串包含，支持 "google.com" 也支持 "http://..."
    return safeSplit(domainString).some(d => url.includes(d.trim()));
  };

  const isInternal = (link) => {
    try {
      const href = link.getAttribute("href");
      // 排除相对路径和锚点
      if (!href || href.startsWith("/") || href.startsWith("#")) return true;
      // 排除当前域名
      if (link.href.includes(window.location.hostname)) return true;
      // 排除配置的内部域名
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

    const links = element.querySelectorAll("a[href]");
    links.forEach(link => {
      // 排除 Discourse 特殊元素
      if (link.classList.contains("mention") || link.classList.contains("lightbox") || link.classList.contains("attachment") || link.classList.contains("onebox")) return;

      const url = link.href;

      // --- 1. 屏蔽域名 (Blocked) ---
      // 行为：链接被替换为文本，完全无法点击
      if (matchesDomain(url, settings.blocked_domains)) {
        const span = document.createElement("span");
        span.classList.add("blocked-link"); // CSS会添加图标
        span.innerText = `[${i18n(themePrefix("secure_links.blocked_text"))}]`;
        span.title = url;
        link.replaceWith(span);
        return;
      }

      // --- 2. 内部域名 (Internal) ---
      // 行为：跳过所有逻辑
      if (isInternal(link)) return;

      // --- 3. 受信域名 (Trusted) ---
      // 行为：跳过确认弹窗，也跳过用户等级检查
      if (matchesDomain(url, settings.excluded_domains)) {
        // CSS 会处理图标 (绿色锁)，这里直接返回，不绑定任何弹窗事件
        return;
      }

      // --- 4. 判定等级 (Risky / Dangerous / Normal) ---
      let level = "normal";
      if (matchesDomain(url, settings.dangerous_domains)) level = "dangerous";
      else if (matchesDomain(url, settings.risky_domains)) level = "risky";

      // 标记等级，供 CSS 使用 (添加图标)
      link.dataset.securityLevel = level;

      // --- 5. 登录/权限拦截 (针对剩余的 External/Risky/Dangerous) ---
      
      // 未登录拦截
      if (!currentUser && settings.enable_anonymous_blocking) {
        const loginLink = document.createElement("a");
        loginLink.href = settings.anonymous_redirect_url || "/login";
        loginLink.innerText = i18n(themePrefix("secure_links.login_to_view"));
        loginLink.classList.add("restricted-link-login");
        link.replaceWith(loginLink);
        return;
      }

      // TL0 拦截
      if (currentUser && currentUser.trust_level === 0 && settings.enable_tl0_blocking) {
        const tlLink = document.createElement("a");
        tlLink.href = settings.tl0_redirect_url || "#";
        tlLink.innerText = i18n(themePrefix("secure_links.first_trust_level_to_view"));
        tlLink.classList.add("restricted-link-tl0");
        link.replaceWith(tlLink);
        return;
      }

      // TL1 手动查看 (可选)
      if (currentUser && currentUser.trust_level === 1 && settings.enable_tl1_manual_reveal) {
        const button = document.createElement("a");
        button.href = "#";
        button.innerText = i18n(themePrefix("secure_links.click_to_view"));
        button.classList.add("secure-links-reveal");
        // 点击后恢复原样并触发弹窗
        button.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const realLink = document.createElement("a");
          realLink.href = url;
          realLink.innerHTML = link.innerHTML;
          realLink.dataset.securityLevel = level;
          // 重新绑定弹窗事件
          realLink.addEventListener("click", (ev) => openModal(ev, url, level));
          button.replaceWith(realLink);
        });
        link.replaceWith(button);
        return;
      }

      // --- 6. 绑定弹窗事件 ---
      // 普通外链如果不开启确认，则不绑定
      if (level === "normal" && !settings.enable_exit_confirmation) return;

      // 绑定弹窗
      link.addEventListener("click", (e) => openModal(e, url, level));
    });
  }, { id: "secure-link-shield", onlyStream: true });
});
